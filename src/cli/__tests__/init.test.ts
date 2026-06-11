// src/cli/__tests__/init.test.ts — unit tests for the Clerk scaffolder (B3). Verifies the
// 5 files + .env.local are written, that /dashboard protection is wired (KP-D2 pre-empt),
// that @clerk/nextjs is pinned, that the scaffold is idempotent (re-run is clean), and that
// the non-Clerk providers stub (HS1). Writes into an OS temp dir, cleaned up after.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProvider, type InitResult } from "../init.js";
import { BadgeError } from "../output.js";

let target: string;

beforeEach(() => {
  target = mkdtempSync(join(tmpdir(), "badge-init-test-"));
});
afterEach(() => {
  rmSync(target, { recursive: true, force: true });
});

describe("init --provider clerk — the acceptance-test scaffolder", () => {
  it("writes middleware, layout, sign-in, dashboard, page + .env.local", () => {
    const r = initProvider({ provider: "clerk", target }).data as InitResult;
    expect(r.scaffolded).toBe(true);
    for (const f of [
      "middleware.ts",
      "app/layout.tsx",
      "app/sign-in/[[...sign-in]]/page.tsx",
      "app/dashboard/page.tsx",
      "app/page.tsx",
      ".env.local",
    ]) {
      expect(existsSync(join(target, f)), `${f} should exist`).toBe(true);
    }
  });

  it("middleware protects /dashboard explicitly (pre-empts the Core-3 'protects nothing' footgun, KP-D2)", () => {
    initProvider({ provider: "clerk", target });
    const mw = readFileSync(join(target, "middleware.ts"), "utf8");
    expect(mw).toMatch(/clerkMiddleware/);
    expect(mw).toMatch(/createRouteMatcher/);
    expect(mw).toMatch(/\/dashboard/);
    expect(mw).toMatch(/auth\.protect/);
  });

  it("layout wraps the app in <ClerkProvider>", () => {
    initProvider({ provider: "clerk", target });
    expect(readFileSync(join(target, "app/layout.tsx"), "utf8")).toMatch(/<ClerkProvider>/);
  });

  it("dashboard awaits auth() (Core-3 async) and renders a signed-in marker", () => {
    initProvider({ provider: "clerk", target });
    const dash = readFileSync(join(target, "app/dashboard/page.tsx"), "utf8");
    expect(dash).toMatch(/await auth\(\)/);
    expect(dash).toMatch(/signed-in-marker/);
  });

  it("pins @clerk/nextjs in the target package.json (does not hard-code keys)", () => {
    const r = initProvider({ provider: "clerk", target }).data as InitResult;
    expect(r.pinned).toMatch(/@clerk\/nextjs@/);
    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    expect(pkg.dependencies["@clerk/nextjs"]).toMatch(/^\^?\d/);
    // The .env.local must reference env, not contain a real (non-placeholder) secret.
    const env = readFileSync(join(target, ".env.local"), "utf8");
    expect(env).toMatch(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=/);
    expect(env).toMatch(/CLERK_SECRET_KEY=/);
  });

  it("is idempotent: a second run leaves the same valid files (chaos: kill-mid-init re-run)", () => {
    const first = initProvider({ provider: "clerk", target }).data as InitResult;
    const second = initProvider({ provider: "clerk", target }).data as InitResult;
    expect(second.written).toEqual(first.written);
    // No leftover temp files from atomic writes.
    const mw = readFileSync(join(target, "middleware.ts"), "utf8");
    expect(mw).toMatch(/clerkMiddleware/);
    expect(existsSync(join(target, `middleware.ts.badge-tmp-${process.pid}`))).toBe(false);
  });

  it("non-Clerk providers stub (HS1: Clerk-only is the C1 bar)", () => {
    for (const provider of ["betterauth", "workos", "stytch"] as const) {
      const t2 = mkdtempSync(join(tmpdir(), "badge-init-stub-"));
      const r = initProvider({ provider, target: t2 }).data as InitResult;
      expect(r.scaffolded).toBe(false);
      expect(r.written.length).toBe(0);
      rmSync(t2, { recursive: true, force: true });
    }
  });

  it("unknown provider throws BadgeError", () => {
    expect(() => initProvider({ provider: "auth9000", target })).toThrow(/unknown provider/);
  });
});
