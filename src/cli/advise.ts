// src/cli/advise.ts — `badge advise` (B4c): a DECISION with $ breakpoints + the
// boring-enterprise checklist, NOT a feature table (OP O5). Pure brain logic; works
// offline. Every $ figure carries the "re-verify at decision time" caveat (Q10 / GD U1)
// because the pricing is a June-2026 snapshot. Grounded in EM JTBD-2, OP O5/O7/O27.

import { BadgeError } from "./output.js";
import type { HandlerResult } from "./dispatch.js";

export type UseCase = "consumer" | "b2b" | "enterprise" | "self-host";

export interface Breakpoint {
  /** the provider this figure is for. */
  provider: string;
  /** the cost expressed as a load-bearing $ number. */
  cost: string;
  /** the condition the cost applies at (e.g. "@100K MAU"). */
  at: string;
}

export interface Advice {
  use_case: UseCase;
  recommendation: string;
  why: string;
  breakpoints: Breakpoint[];
  /** the boring-enterprise-details checklist devs skip (EM 2.6 / OP O5). */
  checklist: string[];
  reliability_note: string;
  /** the honesty layer attached to every $ figure (Q10 / GD U1/U4/U5). */
  caveat: string;
  cites: string[];
}

// The canonical $ breakpoints to memorize (OP O5, EM 2.5). Each is a June-2026 snapshot.
const CAVEAT =
  "Every $ figure is a June-2026 snapshot (GD U1/U4/U5) — re-verify on the vendor's pricing page at decision time.";

// The selection criteria average devs skip (EM 2.6 / OP O5) — evaluate on these, not the demo.
const ENTERPRISE_CHECKLIST = [
  "audit logs (who-did-what, exportable)",
  "versioning / config history (can you diff + roll back an auth config change?)",
  "offline mobile auth behavior",
  "debuggability (can you reproduce a prod auth failure locally?)",
  "maintainer bus-factor / commit tempo (is the project one bad week from unmaintained?)",
  "SCIM deprovisioning shipped + ordered events (NOT 'SSO only' — OP O27)",
  "SAML metadata auto-refresh + cert-expiry alerting (OP O29)",
];

interface UseCaseRule {
  recommendation: string;
  why: string;
  breakpoints: Breakpoint[];
  reliability_note: string;
  cites: string[];
}

// Use-case → decision. The recommendation is a DECISION, not a comparison table (OP O5).
const RULES: Record<UseCase, UseCaseRule> = {
  consumer: {
    recommendation: "Clerk (velocity) — or BetterAuth if cost/ownership dominates at scale",
    why: "Fastest Next.js DX + drop-in components for prototypes/consumer/B2C/velocity. The cost is session-authority single-point-of-failure + MAU pricing at scale + aggressive major-version churn (v5→v6→Core 3). If you will cross ~100K MAU and want to own the critical path, BetterAuth on your own Postgres is ~$24k/yr cheaper.",
    breakpoints: [
      { provider: "Clerk", cost: "~$2,025/mo", at: "@100K MAU" },
      { provider: "BetterAuth", cost: "~$25-50/mo (Postgres only)", at: "@100K MAU (≈ $24k/yr delta vs Clerk)" },
    ],
    reliability_note:
      "Reliability is the minimum of the combined reliability of its critical parts (OP O1). If Clerk holds session validation and its control plane goes down, logged-in users go down too — not just new logins (BTS-1/BTS-2). Keep a managed IdP for login, but own session validation if you must stay up.",
    cites: ["EM-JTBD-2", "OP-O5", "OP-O7", "OP-O1"],
  },
  b2b: {
    recommendation: "WorkOS AuthKit",
    why: "B2B that must close enterprise needs SSO + SCIM as the deal-blocker. WorkOS is the enterprise-readiness reference (SSO/SCIM/Admin Portal/ordered Events API) with 1M MAU free on the core — and if badge had to bet on ONE vendor across both planes, it's WorkOS (auth.md composes with MCP OAuth instead of fighting it). SSO/SCIM are PAID, priced per connection.",
    breakpoints: [
      { provider: "WorkOS", cost: "~$125/SSO connection (1M MAU free core)", at: "per enterprise connection" },
      { provider: "Auth0", cost: "~$800/mo Professional (≤5 connections)", at: "the thing teams migrate OFF on price" },
    ],
    reliability_note:
      "Pair SSO with SCIM deprovisioning — never ship 'SSO only' (OP O27). SCIM deprovisioning is the most-tested compliance question above ~$200k ACV; a departing employee who keeps access = failed review = lost deal.",
    cites: ["EM-JTBD-2", "EM-JTBD-3", "OP-O7", "OP-O27"],
  },
  enterprise: {
    recommendation: "WorkOS AuthKit (SSO + SCIM together) — Auth0 only if the buyer mandates Okta",
    why: "Above ~$200k ACV, SSO + SCIM deprovisioning is non-negotiable. WorkOS ships both with an Admin Portal + ordered Events API; per-connection pricing beats Auth0's per-MAU + enterprise-tier model dramatically. Keep Auth0 only when the buyer mandates Okta or needs its certs (its Token Vault + CIBA remain best-in-class for P3 agent-on-behalf flows).",
    breakpoints: [
      { provider: "WorkOS", cost: "~$125/SSO connection", at: "per enterprise connection (1M MAU free core)" },
      { provider: "Auth0", cost: "the 'Okta tax': one user $240/mo → $3,729/mo (15.54x)", at: "post-Okta-acquisition renewal shock (BTS-16)" },
    ],
    reliability_note:
      "Validate SCIM webhook signatures + process events in order (OP O28); naive endpoints drop/misorder → provisioning drift / ghost access. WorkOS's ordered Events API is the reference. For SAML, auto-refresh IdP metadata + alarm on cert expiry T-14d (OP O29).",
    cites: ["EM-JTBD-3", "OP-O27", "OP-O28", "OP-O7"],
  },
  "self-host": {
    recommendation: "BetterAuth (own-your-DB, framework-agnostic TS) — pin the version, gate upgrades behind a full auth E2E",
    why: "For compliance / no-lock / data-sovereignty, or when your app must BE an OAuth AS, BetterAuth is the right call and the MCP-SDK-blessed substrate for hand-built servers. The cost is real: fast churn + security regressions between minors (the 2026-05-31 OAuth/SSO/MCP/SCIM CVE batch; trustedOrigins ignored in 1.4.7; magic-link broke at 1.5.0). Never infer safety from its popularity (OP O9).",
    breakpoints: [
      { provider: "BetterAuth", cost: "~$25-50/mo (your Postgres only)", at: "@100K MAU" },
      { provider: "Clerk", cost: "~$2,025/mo", at: "@100K MAU (the managed alternative you're avoiding)" },
    ],
    reliability_note:
      "Self-hosted auth fails INDEPENDENTLY — your blast radius, not every tenant at once (OP O3). That independence is the whole point of owning it. But you now own the CVE response: pin versions, gate every upgrade behind a full auth E2E, re-verify security config on upgrade (OP O10).",
    cites: ["EM-JTBD-2", "OP-O7", "OP-O8", "OP-O9", "OP-O10"],
  },
};

/**
 * Produce a provider DECISION (not a feature table) for a use-case, with $ breakpoints.
 * @param opts use-case (required), optional MAU, optional enterprise-checklist flag.
 */
export function advise(opts: { useCase: string; mau?: number; enterprise?: boolean }): HandlerResult {
  const useCase = opts.useCase as UseCase;
  if (!RULES[useCase]) {
    // PLAN §9 chaos-b: bad input → clear message + non-zero exit, no crash.
    throw new BadgeError(
      `unknown use-case "${opts.useCase}" — expected one of: consumer | b2b | enterprise | self-host`,
    );
  }
  const rule = RULES[useCase];
  // The enterprise checklist always shows for enterprise/b2b; --enterprise forces it on for any use-case.
  const showChecklist = opts.enterprise || useCase === "enterprise" || useCase === "b2b";

  const advice: Advice = {
    use_case: useCase,
    recommendation: rule.recommendation,
    why: rule.why,
    breakpoints: rule.breakpoints,
    checklist: showChecklist ? ENTERPRISE_CHECKLIST : [],
    reliability_note: rule.reliability_note,
    caveat: CAVEAT,
    cites: rule.cites,
  };
  return { data: advice, human: renderHuman(advice, opts.mau) };
}

function renderHuman(a: Advice, mau?: number): string[] {
  const lines = [
    `use-case:    ${a.use_case}${mau ? ` (@${mau.toLocaleString()} MAU)` : ""}`,
    `decision:    ${a.recommendation}`,
    "",
    `why:         ${a.why}`,
    "",
    "$ breakpoints (re-verify — see caveat):",
    ...a.breakpoints.map((b) => `  - ${b.provider}: ${b.cost}  (${b.at})`),
  ];
  if (a.checklist.length > 0) {
    lines.push("", "boring-enterprise-details checklist (evaluate on THESE, not the demo):");
    lines.push(...a.checklist.map((c) => `  - ${c}`));
  }
  lines.push("", `reliability: ${a.reliability_note}`, "", `caveat:      ${a.caveat}`, `cites:       ${a.cites.join(", ")}`);
  return lines;
}
