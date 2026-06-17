// src/sandbox/__tests__/e2b-wiring.test.ts — Component 11 (Sandbox/Infra) wiring assertion.
//
// The locked CP123 calibration for the Sandbox cell requires REAL E2B wiring:
//   "the `e2b` SDK (npm package exposing `Sandbox`) as a dependency AND `new Sandbox` /
//    `Sandbox.create` USED in a real product/eval code path (not a template, not a CLI shellout)."
//
// This file regression-guards exactly that — so the cell cannot silently regress to a
// template-only / CLI-shellout state:
//
//   1. SDK DEPENDENCY — `import { Sandbox } from "e2b"` resolves and the named export is the
//      real Sandbox class with a `Sandbox.create` static factory (the calibration's prescribed
//      import form). This proves the `e2b` package is a real dependency, not just an e2b.toml.
//   2. PRODUCT CODE PATH — sandbox/run-in-sandbox.mjs actually imports `{ Sandbox }` from "e2b"
//      and calls `Sandbox.create(` in its driver (a real SDK lifecycle), NOT only shelling out
//      to the `e2b` CLI. We assert the source contains the SDK import + the create() call.
//
// Hermetic: NO network, NO E2B_API_KEY, NO billed microVM boot. We assert the wiring is
// PRESENT and the import RESOLVES — we never invoke a live boot (that stays cred-gated behind
// --boot per HARNESS-OVERRIDES §11). Importing `e2b` does not provision anything; Sandbox.create()
// is only called at runtime behind the E2B_API_KEY + --boot guard.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Sandbox } from "e2b";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const DRIVER = join(REPO_ROOT, "sandbox", "run-in-sandbox.mjs");

describe("Component 11 — Sandbox/Infra: real e2b SDK wiring", () => {
  it("the `e2b` package exposes the Sandbox class with a Sandbox.create static factory", () => {
    // The named export `{ Sandbox }` is the real class (the default export is an esm/cjs
    // interop wrapper). The calibration prescribes this exact import form.
    expect(typeof Sandbox).toBe("function");
    expect(Sandbox.name).toBe("Sandbox");
    expect(typeof Sandbox.create).toBe("function");
  });

  it("e2b is declared as a runtime dependency in package.json (not a dev/template-only artifact)", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies?.e2b).toBeTruthy();
  });

  it("run-in-sandbox.mjs imports { Sandbox } from \"e2b\" and uses Sandbox.create() (real SDK path, not just a CLI shellout)", () => {
    const src = readFileSync(DRIVER, "utf8");
    // Real SDK import (the named-export form the calibration prescribes).
    expect(src).toMatch(/import\s*\{\s*Sandbox\s*\}\s*from\s*["']e2b["']/);
    // Real SDK lifecycle call — Sandbox.create() in a product code path.
    expect(src).toMatch(/Sandbox\.create\s*\(/);
  });
});
