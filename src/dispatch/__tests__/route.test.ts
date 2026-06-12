// src/dispatch/__tests__/route.test.ts — D1 router tests (multi-step, per the board verify).
// The two load-bearing assertions are the board's verify line; the rest cover each JTBD →
// handler mapping + the agent-task → classify(+P) leg + the no-signal default.

import { describe, it, expect } from "vitest";
import { route } from "../route.js";

describe("dispatch route — task → JTBD/P → handler", () => {
  // ── the two board-verify assertions ──
  it("'SSO broke this morning' → jtbd 7, handler saml-triage", () => {
    const r = route("SSO broke this morning");
    expect(r.jtbd).toBe(7);
    expect(r.handler).toBe("saml-triage");
  });

  it("'agent calls my MCP server' → jtbd 4, handler classify (+ P1 from the classifier)", () => {
    const r = route("agent calls my MCP server");
    expect(r.jtbd).toBe(4);
    expect(r.handler).toBe("classify");
    expect(r.problem).toBe("P1"); // the P1-P4 leg is delegated to B2's classifier, not re-implemented
  });

  // ── each JTBD → handler ──
  it("'migrate us off Clerk to BetterAuth without logging everyone out' → jtbd 8, migrate", () => {
    const r = route("migrate us off Clerk to BetterAuth without logging everyone out");
    expect(r.jtbd).toBe(8);
    expect(r.handler).toBe("migrate");
  });

  it("'which auth provider should we use, Clerk vs WorkOS' → jtbd 2, advise", () => {
    const r = route("which auth provider should we use, Clerk vs WorkOS");
    expect(r.jtbd).toBe(2);
    expect(r.handler).toBe("advise");
  });

  it("'audit this config for pitfalls' → jtbd 6, audit", () => {
    const r = route("audit this config for pitfalls");
    expect(r.jtbd).toBe(6);
    expect(r.handler).toBe("audit");
  });

  it("'is my MCP server spec-compliant against 2025-11-25' → jtbd 5, mcp-check", () => {
    const r = route("is my MCP server spec-compliant against 2025-11-25");
    expect(r.jtbd).toBe(5);
    expect(r.handler).toBe("mcp-check");
  });

  it("'scaffold a sign-in flow into my Next.js app' → jtbd 1, init", () => {
    const r = route("scaffold a sign-in flow into my Next.js app");
    expect(r.jtbd).toBe(1);
    expect(r.handler).toBe("init");
  });

  // ── agent-task P routing variety (the P leg comes from the classifier) ──
  it("'agent acts on a user's behalf in their Google' → jtbd 4 classify, P3", () => {
    const r = route("agent acts on a user's behalf in their Google");
    expect(r.jtbd).toBe(4);
    expect(r.handler).toBe("classify");
    expect(r.problem).toBe("P3");
  });

  it("'a SAML/SSO question with an agent word does NOT get hijacked to classify' (jtbd 7 wins)", () => {
    // "SSO broke for the agent team" — SAML signal is higher-priority than the agent catch.
    const r = route("SSO broke for the agent team, signature failing");
    expect(r.jtbd).toBe(7);
    expect(r.handler).toBe("saml-triage");
  });

  // ── default ──
  it("an unsignalled task defaults to jtbd 2 advise (never a destructive verb)", () => {
    const r = route("hello there");
    expect(r.jtbd).toBe(2);
    expect(r.handler).toBe("advise");
  });

  it("empty input does not throw — defaults gracefully", () => {
    expect(() => route("")).not.toThrow();
    expect(route("").handler).toBe("advise");
  });
});
