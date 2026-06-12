// src/dispatch/route.ts — the task router (Component 8, D1).
//
// HARNESS-OVERRIDES §8 (OVERRIDE: routing = the task classifier; the decision spine IS
// dispatch). Maps a free-text task → { jtbd, problem?, handler } and names the CLI verb
// that should run it. This is badge's "place the plane → classify P → pick the tool"
// spine applied at the routing layer: e.g. "SSO broke this morning" → JTBD 7 →
// `saml-triage`; "which provider" → JTBD 2 → `advise`; "agent calls my MCP server" →
// JTBD 4 → `classify` (and, for an agent task, the P1-P4 problem from B2's classifier).
//
// Reuses src/cli/classify.ts for the P1-P4 leg — does NOT re-implement the router (the
// "needs B2" dependency is load-bearing; Surgical Changes). Grounded in PLAN §2 JTBD map.

import { classify, type Problem } from "../cli/classify.js";

/** The CLI verb a task routes to. Mirrors the §4 command tree handlers. */
export type Handler =
  | "init"
  | "classify"
  | "advise"
  | "audit"
  | "saml-triage"
  | "migrate"
  | "mcp-check";

export interface Route {
  /** the EM/PLAN §2 jobs-to-be-done number (1-10). */
  jtbd: number;
  /** the agent problem P1-P4 when the task is a Plane-2 agent task, else null. */
  problem: Problem | null;
  /** the CLI verb that handles this task. */
  handler: Handler;
  /** a one-line why, for observability/explainability. */
  rationale: string;
}

// JTBD detection rules, in priority order. The FIRST match wins, so the most specific /
// highest-signal jobs are listed before the broad ones. Each maps a set of lowercased
// phrase fragments → the JTBD number + the handler. (PLAN §2 JTBD map.)
interface JtbdRule {
  jtbd: number;
  signals: string[];
  handler: Handler;
  rationale: string;
}

const JTBD_RULES: JtbdRule[] = [
  // JTBD 7 — diagnose a SAML/SSO production failure → saml-triage. High-signal: "SSO broke",
  // signature failures, cert. Checked early so "SSO broke this morning" doesn't fall to the
  // generic provider-advice path.
  {
    jtbd: 7,
    signals: [
      "sso broke",
      "sso is broken",
      "sso down",
      "sso fail",
      "saml",
      "signature failing",
      "sig validation",
      "signature error",
      "assertion",
      "cert rotation",
      "certificate",
      "works for users not admins",
      "only for admins",
      "idp",
      "metadata",
    ],
    handler: "saml-triage",
    rationale: "JTBD 7 — a SAML/SSO production failure; run the 7-step triage runbook (EM JTBD-7).",
  },
  // JTBD 8 — migrate provider X→Y → migrate.
  {
    jtbd: 8,
    signals: [
      "migrate",
      "migration",
      "move off",
      "switch from",
      "switch off",
      "move from",
      "without logging everyone out",
      "without forcing a logout",
      "off clerk",
      "off auth0",
    ],
    handler: "migrate",
    rationale: "JTBD 8 — a provider migration; emit the dual-validation window + the four casualties (EM JTBD-8).",
  },
  // JTBD 5 — build/secure an MCP server's OAuth → mcp-check (drive the discovery dance).
  // A LIVE check of a specific server URL goes here; designing/classifying an agent's auth
  // relationship is JTBD 4 (classify), handled below.
  {
    jtbd: 5,
    signals: [
      "check my mcp server",
      "is my mcp server spec",
      "mcp server spec-compliant",
      "mcp server compliant",
      "drive the oauth",
      "discovery dance",
      "rfc 8707",
      "pkce method",
      "audience bound",
      "audience binding",
      "2025-11-25",
      "inspector",
    ],
    handler: "mcp-check",
    rationale: "JTBD 5 — verify an MCP server's OAuth against 2025-11-25; drive PRM→ASM→register→token→tools/list (EM JTBD-5).",
  },
  // JTBD 3/6 — audit an existing config against the pitfall checklist → audit.
  {
    jtbd: 6,
    signals: [
      "audit",
      "is this safe",
      "is my config",
      "review my auth",
      "check this config",
      "pitfall",
      "vulnerable",
      "cve",
      "spec-compliant config",
      "account-takeover",
      "account takeover",
    ],
    handler: "audit",
    rationale: "JTBD 6 — audit an existing auth/OAuth/MCP config statically against the pitfall checklist (KP A-J).",
  },
  // JTBD 1 — scaffold auth into an app → init.
  {
    jtbd: 1,
    signals: [
      "scaffold",
      "set up auth",
      "set up clerk",
      "add auth to",
      "wire up auth",
      "init auth",
      "sign-in flow",
      "sign in flow",
      "protected route",
      "get a login working",
    ],
    handler: "init",
    rationale: "JTBD 1 — scaffold auth into a target app to a working sign-in→protected-route flow (EM JTBD-1).",
  },
  // JTBD 2 — pick a CIAM provider (or self-host) → advise. The broad "which provider /
  // what'll it cost" question; listed LATE so more-specific jobs win first.
  {
    jtbd: 2,
    signals: [
      "which provider",
      "which auth",
      "what provider",
      "clerk vs",
      "vs workos",
      "vs betterauth",
      "vs better auth",
      "vs auth0",
      "what'll it cost",
      "what will it cost",
      "pricing",
      "should we use",
      "recommend a provider",
      "choose a provider",
      "pick a provider",
      "enterprise-ready",
      "scim",
    ],
    handler: "advise",
    rationale: "JTBD 2 — a provider DECISION with $ breakpoints + the boring-enterprise checklist (EM JTBD-2 / OP O5).",
  },
];

// Agent-task signals (Plane 2). If present and no higher-priority JTBD matched, the task
// is an agent-auth classification (JTBD 4 → classify), and we attach the P1-P4 problem.
const AGENT_SIGNALS = [
  "agent",
  "mcp",
  "claude",
  "chatgpt",
  "llm",
  "on behalf",
  "autonomous",
  "auth.md",
  "token vault",
  "connected apps",
  "tool call",
];

/**
 * Route a free-text task to its JTBD + handler (+ P1-P4 for agent tasks).
 * @param task the task description.
 */
export function route(task: string): Route {
  const t = (task ?? "").trim().toLowerCase();

  // 1. Highest-priority: an explicit JTBD signal (SAML, migration, MCP-check, audit, init, advise).
  const matched = JTBD_RULES.find((rule) => rule.signals.some((sig) => t.includes(sig)));

  // 2. Agent task → JTBD 4 (classify), with the P1-P4 problem from B2's classifier. This is
  //    checked even if a JTBD rule matched ONLY when that rule isn't a stronger, non-agent job:
  //    an agent-classification question ("agent calls my MCP server") must beat the generic
  //    advise/audit catch — so if the task has agent signals AND the matched rule is the broad
  //    advise/audit/init (JTBD 1/2/6) without an MCP-check/migration/SAML signal, prefer classify.
  const isAgent = AGENT_SIGNALS.some((s) => t.includes(s));
  const matchedIsBroad = matched ? [1, 2, 6].includes(matched.jtbd) : false;

  if (isAgent && (!matched || matchedIsBroad)) {
    // Delegate the P1-P4 leg to the classifier (no re-implementation).
    const c = classify(task).data as { plane: number; problem: Problem | null };
    if (c.plane === 2) {
      return {
        jtbd: 4,
        problem: c.problem,
        handler: "classify",
        rationale:
          "JTBD 4 — an agent-auth task; classify the plane + P1-P4 and route to the default tool (EM JTBD-4, the core competency).",
      };
    }
  }

  if (matched) {
    return { jtbd: matched.jtbd, problem: null, handler: matched.handler, rationale: matched.rationale };
  }

  // 3. No signal at all → default to advise (the safest "I'm not sure what you need, here's a
  //    provider decision by use-case" landing — JTBD 2). Better than guessing a destructive verb.
  return {
    jtbd: 2,
    problem: null,
    handler: "advise",
    rationale:
      "JTBD 2 (default) — no specific job signal detected; route to a provider decision by use-case. Re-phrase with more detail (e.g. 'SSO broke', 'agent calls my MCP server', 'audit this config') to route precisely.",
  };
}
