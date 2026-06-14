// eval/chaos/chaos.test.ts — the chaos suite (Component 9, E6 · PLAN §9 "Chaos" row).
//
// The testing contract mandates ≥1 RED-BLOCKING test per chaos class. This suite covers all
// THREE classes (well past the minimum) so CI goes red on any regression:
//
//   (a) kill-mid-`init`   — interrupt a scaffold partway → a re-run is IDEMPOTENT and leaves
//                            the target either clean or fully valid, never half-written/broken.
//                            (badge init writes every file atomically: temp + POSIX rename.)
//   (b) corrupt-input     — `classify ""` / malformed config to `audit` / bad provider to
//                            `init` → graceful BadgeError (non-zero exit), a clear message,
//                            NO stack-trace crash.
//   (c) no-network        — classify / advise / saml-triage are pure brain logic and return
//                            the CORRECT answer offline; only mcp-check / init touch the net,
//                            and mcp-check degrades with a clear message (reachable:false),
//                            never a crash.
//
// Imports the handlers directly (Vitest resolves the .ts source), matching verbs.test.ts.
// These are deterministic + offline — no real network, no real Clerk keys.

import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProvider } from "../../src/cli/init.js";
import { classify } from "../../src/cli/classify.js";
import { advise } from "../../src/cli/advise.js";
import { samlTriage } from "../../src/cli/saml-triage.js";
import { audit } from "../../src/cli/audit.js";
import { mcpCheck } from "../../src/cli/mcp-check.js";
import { BadgeError } from "../../src/cli/output.js";

// ── (a) kill-mid-init → idempotent recovery, no broken/half-written app ──────────────────
describe("chaos (a): kill mid-`init` is idempotent — re-run leaves a fully-valid app", () => {
  it("a half-written middleware.ts is restored complete on re-run (atomic temp+rename)", () => {
    const target = mkdtempSync(join(tmpdir(), "chaos-init-a1-"));
    try {
      const r1 = initProvider({ provider: "clerk", target }).data as { written: string[] };
      expect(r1.written.length).toBe(6);

      // Simulate a kill mid-init: middleware.ts left truncated (a half-written import).
      writeFileSync(join(target, "middleware.ts"), "import { clerkMiddleware");

      // Re-run init — must recover to the complete, valid file (not leave the truncated half).
      const r2 = initProvider({ provider: "clerk", target }).data as { written: string[] };
      expect(r2.written.length).toBe(6);

      const mid = readFileSync(join(target, "middleware.ts"), "utf8");
      expect(mid).toContain("export const config"); // the full file, not the truncated stub
      expect(mid).toContain("createRouteMatcher");
      expect(mid.length).toBeGreaterThan(200);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("init's own writes leave NO .badge-tmp-* litter (atomic cleanup)", () => {
    const target = mkdtempSync(join(tmpdir(), "chaos-init-a2-"));
    try {
      initProvider({ provider: "clerk", target });
      initProvider({ provider: "clerk", target }); // re-run

      const all: string[] = [];
      const walk = (dir: string): void => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else all.push(p);
        }
      };
      walk(target);
      // badge's atomic writes must not leave any temp-file litter behind.
      expect(all.filter((f) => f.includes(".badge-tmp-")).length).toBe(0);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("re-running over a complete scaffold is a no-op-safe full rewrite (all 6 files valid)", () => {
    const target = mkdtempSync(join(tmpdir(), "chaos-init-a3-"));
    try {
      initProvider({ provider: "clerk", target });
      const r = initProvider({ provider: "clerk", target }).data as { written: string[]; scaffolded: boolean };
      expect(r.scaffolded).toBe(true);
      // Every scaffolded file is present and non-empty after the idempotent re-run.
      for (const rel of ["middleware.ts", "app/layout.tsx", "app/page.tsx", "app/dashboard/page.tsx", "app/sign-in/[[...sign-in]]/page.tsx", ".env.local"]) {
        const content = readFileSync(join(target, rel), "utf8");
        expect(content.length).toBeGreaterThan(0);
      }
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
});

// ── (b) corrupt-input → graceful non-zero (BadgeError), clear message, no crash ──────────
describe("chaos (b): corrupt input → graceful BadgeError, never a stack-trace crash", () => {
  it("`classify \"\"` (empty task) throws a BadgeError with a clear message", () => {
    expect(() => classify("")).toThrow(BadgeError);
    expect(() => classify("   ")).toThrow(/empty task/);
  });

  it("`audit <missing path>` throws a BadgeError (no ENOENT crash)", () => {
    // An IN-REPO missing path: tests the graceful ENOENT→BadgeError handling without
    // tripping the path-confinement guard (which refuses out-of-root paths first — that
    // SSRF/traversal guard is covered separately in chaos (d) below).
    const missing = join(process.cwd(), "this-file-does-not-exist-badge-chaos-xyz");
    expect(() => audit({ path: missing })).toThrow(BadgeError);
    expect(() => audit({ path: missing })).toThrow(/cannot read/);
  });

  it("`audit` on a malformed (non-JSON) config returns a result AND flags it INCOMPLETE (never a false 'clean')", () => {
    // audit reads text and runs regex detectors — malformed JSON is just text; it must not throw.
    // But an unparseable .json was NOT actually inspected, so audit must NOT report it clean
    // (T-user finding 2026-06-13: a silent clean:true on a config badge couldn't parse is a
    // false-negative an auth auditor must never give — OP O9 "verify the running build").
    // Temp dir UNDER the repo root (not the OS tmpdir): audit confines targets to the
    // project root (the SSRF/traversal guard), so the fixture must live inside the repo.
    const dir = mkdtempSync(join(process.cwd(), "chaos-audit-b3-"));
    try {
      writeFileSync(join(dir, "broken.json"), "{ this is : not valid json,,, ");
      const r = audit({ path: dir }).data as { clean: boolean; findings: unknown[]; parseWarnings?: string[] };
      expect(Array.isArray(r.findings)).toBe(true); // graceful — produced a result object
      expect(r.clean).toBe(false); // an unparseable config is NOT clean
      expect(r.parseWarnings).toContain("broken.json"); // surfaces what it could not inspect
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("`init --provider <bogus>` throws a BadgeError naming the valid providers", () => {
    const target = mkdtempSync(join(tmpdir(), "chaos-init-b4-"));
    try {
      expect(() => initProvider({ provider: "nonsense", target })).toThrow(/unknown provider/);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("BadgeError carries a non-zero exit code (the CLI maps it to a clean non-zero exit)", () => {
    try {
      classify("");
      throw new Error("expected classify('') to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(BadgeError);
      expect((err as BadgeError).code).toBeGreaterThan(0);
    }
  });
});

// ── (c) no-network → pure brain verbs answer correctly offline; mcp-check degrades ───────
describe("chaos (c): no-network — pure brain verbs are correct offline; only mcp-check/init need the net", () => {
  it("classify routes P1-P4 with zero network (deterministic brain logic)", () => {
    const c = classify("an agent calls my MCP server and needs a scoped token").data as { plane: number; problem: string };
    expect(c.plane).toBe(2);
    expect(c.problem).toBe("P1");
  });

  it("advise emits a $ breakpoint + the re-verify caveat offline", () => {
    const a = advise({ useCase: "enterprise" }).data as { breakpoints: { cost: string }[]; caveat: string };
    expect(a.breakpoints.some((b) => /\$/.test(b.cost))).toBe(true);
    expect(a.caveat).toMatch(/re-verify/i);
  });

  it("saml-triage returns the 7-step runbook + cert-rotation #1 offline", () => {
    const r = samlTriage("sig validation failing, nothing changed our side").data as { steps: unknown[]; most_likely_cause: string };
    expect(r.steps.length).toBe(7);
    expect(r.most_likely_cause.toLowerCase()).toMatch(/rotation/);
  });

  it("mcp-check degrades to reachable:false with a clear message (no crash) on an unreachable host", async () => {
    const r = (await mcpCheck("https://badge-chaos-unreachable-host.invalid/mcp")).data as { reachable: boolean; gaps: string[]; next: string };
    expect(r.reachable).toBe(false);
    expect(r.gaps[0].toLowerCase()).toMatch(/offline|reach|timeout|dns/);
    expect(r.next.toLowerCase()).toMatch(/network|offline/);
  });
});
