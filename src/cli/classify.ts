// src/cli/classify.ts — `badge classify` (B2): the P1-P4 router, badge's core verb.
// Places the plane (1 human-CIAM / 2 agent-MCP) then classifies the agent problem
// P1-P4 and returns the default tool + alternatives + rationale. Pure brain logic —
// works offline (PLAN §9 chaos no-network). Grounded in EM JTBD-4, OP O16/O19, TOOL-MATRIX.

import { BadgeError } from "./output.js";
import type { HandlerResult } from "./dispatch.js";

export type Problem = "P1" | "P2" | "P3" | "P4";

export interface Classification {
  plane: 1 | 2;
  problem: Problem | null;
  default_tool: string;
  alternatives: string[];
  rationale: string;
  /** brain node ids backing this routing (citable). */
  cites: string[];
}

// Each P carries its detection signals + the canonical default (TOOL-MATRIX / EM JTBD-4).
// Order matters: P3 (third-party on-behalf) and P2 (identity bootstrap) are checked before
// the broad P1 (agent→my server) so a more specific match wins.
interface ProblemRule {
  problem: Problem;
  // any-of phrase fragments (lowercased) that signal this problem
  signals: string[];
  default_tool: string;
  alternatives: string[];
  rationale: string;
  cites: string[];
}

const PROBLEM_RULES: ProblemRule[] = [
  {
    problem: "P3",
    signals: [
      "on behalf",
      "on a user's behalf",
      "user's google",
      "user's slack",
      "user's gmail",
      "third party",
      "third-party",
      "3rd party",
      "act in",
      "without holding",
      "token vault",
      "act as the user",
      "read a user's email",
      "send replies",
      "reads a user's email",
    ],
    default_tool: "Auth0 Token Vault + CIBA",
    alternatives: ["per-provider remote MCP server (mcp-first pattern)"],
    rationale:
      "P3 — agent acts in a user's THIRD-PARTY SaaS (Google/Slack) without holding raw creds. Token Vault does OAuth Token Exchange / on-behalf-of so the agent never sees the provider refresh token; CIBA for async human approval. Enforce intersection (agent∩user), read/draft/commit gradient with human approval on irreversible sends (OP O16/O18).",
    cites: ["EM-JTBD-4", "OP-O16", "OP-O21"],
  },
  {
    problem: "P2",
    signals: [
      "identity bootstrap",
      "bootstrap",
      "agent has no identity",
      "register the agent",
      "register it",
      "human vouch",
      "vouch",
      "human ownership",
      "human owner",
      "human claim",
      "claim ceremony",
      "auth.md",
      "no identity yet",
      "give the agent an identity",
      "needs an identity",
      "needs identity",
    ],
    default_tool: "WorkOS auth.md",
    alternatives: ["(no real alt — auth.md is the new 2026 primitive)"],
    rationale:
      "P2 — the agent has NO identity yet; register it AND let a human vouch for it. WorkOS auth.md (identity_assertion via ID-JAG, or anonymous + OTP claim) is the genuinely new 2026 primitive and composes ON TOP of MCP OAuth rather than fighting it.",
    cites: ["EM-JTBD-4", "OP-O7"],
  },
  {
    problem: "P4",
    signals: [
      "self-host",
      "self host",
      "own stack",
      "own-your-stack",
      "capability-scoped",
      "capability grant",
      "autonomous agent",
      "runs unattended",
      "earns money",
      "agent owns resources",
      "own our agent identity",
    ],
    default_tool: "BetterAuth agent-auth (flag UNSTABLE — v2 redesign in flight, GD-G)",
    alternatives: ["(bet on the Agent Auth Protocol — see GD-G)"],
    rationale:
      "P4 — self-hosted, capability-scoped autonomous agent identity + approvals. BetterAuth agent-auth (Agent Auth Protocol) is open + self-hostable but explicitly UNSTABLE with a v2 redesign in flight — flag the instability before committing (GD-G). Autonomous mode only when the agent owns resources; otherwise prefer delegated on-behalf-of (RFC 8693).",
    cites: ["EM-JTBD-4", "OP-O20"],
  },
  {
    problem: "P1",
    signals: [
      "my mcp server",
      "calls my mcp",
      "call my mcp",
      "call my server",
      "calls my server",
      "to my server",
      "scoped token to call",
      "agent → my",
      "connected apps",
      "build an mcp server",
      "secure my mcp server",
      "mcp server oauth",
      "oauth for my mcp",
    ],
    default_tool: "Stytch Connected Apps",
    alternatives: ["BetterAuth OAuth-2.1-Provider plugin", "raw MCP OAuth 2.1 (to an external AS)"],
    rationale:
      "P1 — the agent already has an identity; it needs a scoped token to call MY MCP server. Stytch Connected Apps is the most MCP-spec-literal hosted AS (DCR is opt-in — enable it, KP-E3). Implement to the 2025-11-25 spec, prefer CIMD>DCR, audience-bind per RFC 8707, test with MCP Inspector (OP O23/O24/O25).",
    cites: ["EM-JTBD-4", "OP-O23", "OP-O24"],
  },
];

// Plane-2 (agent) signals: if any of these appear, it's an agent-auth task → classify P1-P4.
const AGENT_SIGNALS = [
  "agent",
  "mcp",
  "claude",
  "chatgpt",
  "llm",
  "tool call",
  "on behalf",
  "autonomous",
  "auth.md",
  "token vault",
  "connected apps",
];

/**
 * Classify a task into plane + (if agent) P1-P4 with the default tool + rationale.
 * @param task the free-text task description.
 */
export function classify(task: string): HandlerResult {
  const trimmed = task.trim();
  if (trimmed.length === 0) {
    // PLAN §9 chaos-b: corrupt/empty input → clear message + non-zero exit, no crash.
    throw new BadgeError("empty task — pass a task description, e.g. badge classify \"agent calls my MCP server\"");
  }
  const t = trimmed.toLowerCase();

  const isAgent = AGENT_SIGNALS.some((s) => t.includes(s));
  if (!isAgent) {
    const result: Classification = {
      plane: 1,
      problem: null,
      default_tool: "Clerk (consumer/velocity) | WorkOS AuthKit (B2B/enterprise) | BetterAuth (self-host)",
      alternatives: ["Auth0 (only if the buyer mandates Okta)"],
      rationale:
        "Plane 1 — human CIAM (the login box). No agent principal detected. Route to provider selection (badge advise) by use-case + $ breakpoints; default first-party human web to server session + HTTP-only cookie, not JWT-everywhere (EM 1.1).",
      cites: ["EM-JTBD-1", "EM-JTBD-2", "OP-O5", "OP-O13"],
    };
    return { data: result, human: renderHuman(result, trimmed) };
  }

  // Agent task — find the most specific P (rules are ordered P3, P2, P4, P1).
  const matched = PROBLEM_RULES.find((rule) => rule.signals.some((sig) => t.includes(sig)));
  const rule =
    matched ??
    // Default for an agent task with no specific P signal: P1 (the most common shape —
    // an agent talking to your own server), with an explicit note that it's the fallback.
    {
      ...PROBLEM_RULES.find((r) => r.problem === "P1")!,
      rationale:
        "Plane 2 (agent) but no specific P1-P4 signal in the task — defaulting to P1 (agent→your MCP server, the most common shape). If the agent acts in a user's third-party SaaS that's P3 (Auth0 Token Vault), if it has no identity yet that's P2 (WorkOS auth.md), if it's a self-host capability-scoped autonomous agent that's P4 (BetterAuth agent-auth). Re-run with more detail to disambiguate.",
    };

  const result: Classification = {
    plane: 2,
    problem: rule.problem,
    default_tool: rule.default_tool,
    alternatives: rule.alternatives,
    rationale: rule.rationale,
    cites: rule.cites,
  };
  return { data: result, human: renderHuman(result, trimmed) };
}

function renderHuman(c: Classification, task: string): string[] {
  const lines = [
    `task:        ${task}`,
    `plane:       ${c.plane} (${c.plane === 1 ? "human CIAM" : "agent / MCP"})`,
    `problem:     ${c.problem ?? "— (Plane 1, no agent principal)"}`,
    `default:     ${c.default_tool}`,
    `alternatives: ${c.alternatives.join(" · ")}`,
    `cites:       ${c.cites.join(", ")}`,
    "",
    `rationale:   ${c.rationale}`,
  ];
  return lines;
}
