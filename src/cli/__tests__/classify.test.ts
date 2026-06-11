// src/cli/__tests__/classify.test.ts — unit tests for the P1-P4 router (B2). Each P has a
// detection case; Plane-1 (no agent) routes to provider selection; empty input throws.
// The classifier is pure brain logic (no network) so these run fast + offline.

import { describe, it, expect } from "vitest";
import { classify, type Classification } from "../classify.js";
import { BadgeError } from "../output.js";

function run(task: string): Classification {
  return classify(task).data as Classification;
}

describe("classify — the P1-P4 router", () => {
  it("P1: agent → my MCP server → Stytch Connected Apps", () => {
    const c = run("agent calls my MCP server");
    expect(c.plane).toBe(2);
    expect(c.problem).toBe("P1");
    expect(c.default_tool).toMatch(/Stytch Connected Apps/);
  });

  it("P2: identity bootstrap + human vouch → WorkOS auth.md", () => {
    const c = run("the agent has no identity yet — register it and let a human vouch for it");
    expect(c.plane).toBe(2);
    expect(c.problem).toBe("P2");
    expect(c.default_tool).toMatch(/WorkOS auth\.md/);
  });

  it("P3: act in a user's third-party SaaS → Auth0 Token Vault + CIBA", () => {
    const c = run("agent reads a user's email and can send replies on their behalf");
    expect(c.plane).toBe(2);
    expect(c.problem).toBe("P3");
    expect(c.default_tool).toMatch(/Auth0 Token Vault/);
  });

  it("P4: self-host capability-scoped autonomous agent → BetterAuth agent-auth (UNSTABLE)", () => {
    const c = run("self-host a capability-scoped autonomous agent that earns money");
    expect(c.plane).toBe(2);
    expect(c.problem).toBe("P4");
    expect(c.default_tool).toMatch(/BetterAuth agent-auth/);
    expect(c.default_tool).toMatch(/UNSTABLE/);
  });

  it("Plane 1: human login → provider-selection route, no P", () => {
    const c = run("let humans log into my first-party web app");
    expect(c.plane).toBe(1);
    expect(c.problem).toBeNull();
    expect(c.default_tool).toMatch(/Clerk/);
  });

  it("agent task with no specific signal defaults to P1", () => {
    const c = run("my agent needs auth somehow");
    expect(c.plane).toBe(2);
    expect(c.problem).toBe("P1");
  });

  it("empty task throws BadgeError (chaos: corrupt input)", () => {
    expect(() => classify("")).toThrow(BadgeError);
    expect(() => classify("   ")).toThrow(/empty task/);
  });

  it("every classification carries citable brain node ids", () => {
    const c = run("agent calls my MCP server");
    expect(c.cites.length).toBeGreaterThan(0);
    expect(c.cites.every((cite) => /^(EM|OP|KP|BTS|GD|TM)-/.test(cite))).toBe(true);
  });
});
