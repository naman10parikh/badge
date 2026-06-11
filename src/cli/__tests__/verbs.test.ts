// src/cli/__tests__/verbs.test.ts — unit tests for the 5 reasoning verbs (B4):
// audit / saml-triage / advise / migrate / mcp-check. Each is checked against the
// golden-task answer in brain/BATTLE-TESTED-SCENARIOS.md (graded against the Resolution
// text — no self-grading). audit + saml-triage + advise + migrate are pure brain logic;
// mcp-check's offline-graceful path is the only network-adjacent case (tested via an
// unreachable URL — no real network needed).

import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { audit, type AuditResult } from "../audit.js";
import { samlTriage, type TriageResult } from "../saml-triage.js";
import { advise, type Advice } from "../advise.js";
import { migrate, type MigrationPlan } from "../migrate.js";
import { mcpCheck, type McpCheckResult } from "../mcp-check.js";
import { BadgeError } from "../output.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIXTURES = join(REPO_ROOT, "eval", "fixtures");

describe("audit — the pitfall checklist (KP A-J)", () => {
  it("G2/BTS-6: flags KP-A2 (alg=none + plain PKCE) on the legacy fixture", () => {
    const r = audit({ path: join(FIXTURES, "plain-pkce") }).data as AuditResult;
    expect(r.clean).toBe(false);
    expect(r.findings.some((f) => f.rule === "KP-A2")).toBe(true);
    expect(r.findings.some((f) => f.cve === "GHSA-9h47-pqcx-hjr4")).toBe(true);
  });

  it("clean config produces zero findings (no false positives)", () => {
    const r = audit({ path: join(FIXTURES, "clean") }).data as AuditResult;
    expect(r.clean).toBe(true);
    expect(r.findings.length).toBe(0);
  });

  it("missing path throws BadgeError (chaos: corrupt input)", () => {
    expect(() => audit({ path: join(FIXTURES, "does-not-exist-xyz") })).toThrow(BadgeError);
  });
});

describe("saml-triage — the 7-step runbook (EM JTBD-7)", () => {
  it("G5/BTS-9: 'nothing changed our side' + sig failing → cert rotation #1", () => {
    const r = samlTriage("SSO broke this morning, signature validation failing, nothing changed our side").data as TriageResult;
    expect(r.steps.length).toBe(7);
    expect(r.most_likely_cause.toLowerCase()).toMatch(/rotation/);
    expect(r.fix.toLowerCase()).toMatch(/metadata/);
  });

  it("G6/BTS-10: only-admins + truncated assertion → group-bloat → POST truncation", () => {
    const r = samlTriage("SSO fails only for our admins; the assertion looks truncated").data as TriageResult;
    expect(r.most_likely_cause.toLowerCase()).toMatch(/bloat|truncat/);
    expect(r.fix.toLowerCase()).toMatch(/filter group claims/);
  });

  it("emits the runbook in frequency order (cert is step 2, the #1 default cause)", () => {
    const r = samlTriage("login fails").data as TriageResult;
    expect(r.steps[0].n).toBe(1);
    expect(r.steps[1].check.toLowerCase()).toMatch(/cert/);
  });

  it("empty symptom throws BadgeError", () => {
    expect(() => samlTriage("")).toThrow(/empty symptom/);
  });
});

describe("advise — a DECISION with $ breakpoints (OP O5)", () => {
  it("enterprise: emits a $ figure + the re-verify caveat + SCIM stance", () => {
    const a = advise({ useCase: "enterprise", mau: 100000 }).data as Advice;
    expect(a.breakpoints.length).toBeGreaterThan(0);
    expect(a.breakpoints.some((b) => /\$/.test(b.cost))).toBe(true);
    expect(a.caveat).toMatch(/re-verify/i);
    expect(a.reliability_note.toLowerCase()).toMatch(/scim|deprovision/);
  });

  it("consumer: recommends Clerk and names the BetterAuth $ delta", () => {
    const a = advise({ useCase: "consumer" }).data as Advice;
    expect(a.recommendation).toMatch(/Clerk/);
    expect(a.breakpoints.some((b) => /2,025/.test(b.cost))).toBe(true);
  });

  it("--enterprise flag forces the boring-enterprise checklist on for any use-case", () => {
    const a = advise({ useCase: "consumer", enterprise: true }).data as Advice;
    expect(a.checklist.length).toBeGreaterThan(0);
    expect(a.checklist.join(" ").toLowerCase()).toMatch(/maintainer bus-factor/);
  });

  it("unknown use-case throws BadgeError", () => {
    expect(() => advise({ useCase: "banana" })).toThrow(/unknown use-case/);
  });
});

describe("migrate — dual-validation window + four casualties (OP O32/O33)", () => {
  it("G7/BTS-4: Clerk→BetterAuth names all four casualties + the dual-validation window", () => {
    const m = migrate({ from: "clerk", to: "betterauth" }).data as MigrationPlan;
    expect(m.casualties.length).toBe(4);
    expect(m.window.toLowerCase()).toMatch(/dual validation|1-2 weeks/);
    expect(m.plan.join(" ").toLowerCase()).toMatch(/never.*big-bang|gradually/);
    expect(m.notes.join(" ")).toMatch(/Val Town|BTS-4/);
  });

  it("G11/BTS-16: Auth0→WorkOS flags the hash-export gate + the $ math", () => {
    const m = migrate({ from: "auth0", to: "workos" }).data as MigrationPlan;
    expect(m.notes.join(" ").toLowerCase()).toMatch(/hash.?export.*gated|gated.*support/);
    expect(m.notes.join(" ")).toMatch(/125|Okta tax/);
  });

  it("same from/to throws BadgeError", () => {
    expect(() => migrate({ from: "clerk", to: "clerk" })).toThrow(/same provider/);
  });
});

describe("mcp-check — discovery dance, offline-graceful (EM JTBD-5)", () => {
  it("unreachable URL degrades to reachable:false with a clear message, no crash", async () => {
    const r = (await mcpCheck("https://badge-nonexistent-test-host.invalid/mcp")).data as McpCheckResult;
    expect(r.reachable).toBe(false);
    expect(r.gaps[0].toLowerCase()).toMatch(/offline|reach|timeout|dns/);
  });

  it("non-HTTPS (non-localhost) URL throws BadgeError", async () => {
    await expect(mcpCheck("http://example.com/mcp")).rejects.toThrow(/HTTPS/);
  });

  it("malformed URL throws BadgeError", async () => {
    await expect(mcpCheck("not a url")).rejects.toThrow(/invalid URL/);
  });
});
