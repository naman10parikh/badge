// src/cli/migrate.ts — `badge migrate --from <p> --to <p>` (B4d): the dual-validation-
// window plan + the four casualties. Every credible migration story repeats the same
// shape (Val Town, Mimo, DEV.to): bulk import is the easy part; the hard part is the 1-2
// week window where the backend accepts BOTH old and new tokens. NEVER a big-bang cutover.
// Grounded in EM JTBD-8, OP O32/O33, BTS-4/BTS-16. Pure brain logic; works offline.

import { BadgeError } from "./output.js";
import type { HandlerResult } from "./dispatch.js";

export interface MigrationPlan {
  from: string;
  to: string;
  /** the ordered dual-validation-window steps. */
  plan: string[];
  /** the four things that never migrate cleanly (OP O33). */
  casualties: string[];
  window: string;
  /** provider-pair-specific notes (e.g. Auth0 hash-export gate). */
  notes: string[];
  cites: string[];
}

// The four casualties that never migrate cleanly — always named up front (OP O33 / BTS-4).
const FOUR_CASUALTIES = [
  "active sessions — every logged-in user is forced out unless you run the dual-validation window",
  "SSO / SAML connections — enterprise IdP trust must be RE-ESTABLISHED, not ported (LobeHub lost SSO data)",
  "social-account links — users must manually re-link Google/GitHub/etc. (the simplest migration path drops them)",
  "custom claims — app-specific token claims don't survive; re-derive them on the new provider",
];

// The universal 3-part migration shape (EM 8.1 / BTS-4 Val Town playbook).
const DUAL_VALIDATION_PLAN = [
  "1. Bulk-import users (the EASY/fast part — hours). Passwords port if the hash algo matches; else lazy re-hash on first login.",
  "2. Open a 1-2 week DUAL-VALIDATION WINDOW: rewrite EVERY auth endpoint to accept BOTH the old and the new session/token type.",
  "3. Migrate users GRADUALLY: the sign-in page starts issuing new-provider sessions; old sessions age out naturally (no forced logout).",
  "4. Handwrite the security-critical code with close reading — do NOT trust an auto-migrator for the token-verification path (BTS-4).",
  "5. Verify backend token-format handling FIRST — that's the hard step, not the import (token formats differ; middleware needs updating).",
  "6. After the window, age out the last old sessions and remove the old-provider acceptance path.",
];

// Provider-pair-specific notes (only the pairs the brain has receipts for).
function pairNotes(from: string, to: string): string[] {
  const f = from.toLowerCase();
  const tgt = to.toLowerCase();
  const notes: string[] = [];
  if (f.includes("clerk") && (tgt.includes("better") || tgt.includes("betterauth"))) {
    notes.push(
      "Clerk→BetterAuth is the reference migration (Val Town, May 2026): two-week parallel period supporting BOTH cookie types; every endpoint accepts either session; 'so far it really has been better.' (BTS-4)",
    );
    notes.push("Motivation pattern: leaving Clerk on RELIABILITY (session single-point-of-failure) + the two-users-tables/webhook-drift complexity, not only price (BTS-1/BTS-8).");
  }
  if (f.includes("auth0") && (tgt.includes("workos"))) {
    notes.push(
      "Auth0→WorkOS for enterprise SSO: WorkOS ~$125/connection (1M MAU free core) vs the Auth0 'Okta tax' (one user $240→$3,729/mo, 15.54x). Migrate connections under a dual-validation window (BTS-16).",
    );
    notes.push("⚠️ Auth0 password-hash bulk export is GATED behind a support request (historical blocker — verify the current policy before you commit a timeline; GD flag).");
  }
  if (f.includes("auth0")) {
    notes.push("Auth0 is the thing teams MIGRATE OFF on price; keep it only if the buyer mandates Okta or needs its certs (OP O7).");
  }
  return notes;
}

/**
 * Emit a provider-migration plan: the dual-validation window + the four casualties.
 * @param opts from + to provider names (both required).
 */
export function migrate(opts: { from: string; to: string }): HandlerResult {
  if (!opts.from?.trim() || !opts.to?.trim()) {
    // PLAN §9 chaos-b: missing arg → clear message + non-zero exit, no crash.
    throw new BadgeError("migrate needs --from <provider> and --to <provider>");
  }
  if (opts.from.trim().toLowerCase() === opts.to.trim().toLowerCase()) {
    throw new BadgeError(`--from and --to are the same provider ("${opts.from}") — nothing to migrate`);
  }

  const plan: MigrationPlan = {
    from: opts.from,
    to: opts.to,
    plan: DUAL_VALIDATION_PLAN,
    casualties: FOUR_CASUALTIES,
    window: "1-2 weeks of dual validation (accept both old + new sessions; age out gradually)",
    notes: pairNotes(opts.from, opts.to),
    cites: ["EM-JTBD-8", "OP-O32", "OP-O33", "BTS-4"],
  };
  return { data: plan, human: renderHuman(plan) };
}

function renderHuman(m: MigrationPlan): string[] {
  const lines = [
    `migrate:     ${m.from} → ${m.to}`,
    `window:      ${m.window}`,
    "",
    "plan (NEVER a big-bang cutover):",
    ...m.plan.map((s) => `  ${s}`),
    "",
    "the four casualties (re-establish, don't port):",
    ...m.casualties.map((c) => `  - ${c}`),
  ];
  if (m.notes.length > 0) {
    lines.push("", "notes:");
    lines.push(...m.notes.map((n) => `  - ${n}`));
  }
  lines.push("", `cites:       ${m.cites.join(", ")}`);
  return lines;
}
