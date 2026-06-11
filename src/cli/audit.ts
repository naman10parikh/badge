// src/cli/audit.ts — `badge audit <path>` (B4a): run the pitfall checklist statically
// against auth/OAuth/MCP config or code. No live keys (Q7) — detects from the config text
// (PKCE method string, redirect-URI shape, alg list, account-linking flags, rotation
// pattern). Flags { severity, rule, cve?, fix }. Grounded in KP A-J (the 2026-05-31 batch).
// Works offline (PLAN §9 chaos no-network). The seam the auth-lint hook (B6) shares.

import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BadgeError } from "./output.js";
import type { HandlerResult } from "./dispatch.js";

export type Severity = "critical" | "high" | "medium" | "low";
export type AuditKind = "mcp" | "scim" | "agent" | "saml";

export interface Finding {
  severity: Severity;
  /** the KP node id this finding maps to (citable). */
  rule: string;
  /** the CVE/GHSA id when one applies. */
  cve?: string;
  /** a one-line description of what was detected. */
  detected: string;
  /** the prescribed fix (from the brain's AVOID). */
  fix: string;
}

export interface AuditResult {
  path: string;
  kind: AuditKind | "general";
  findings: Finding[];
  /** true when zero findings — the clean path. */
  clean: boolean;
}

// A detector tests the (lowercased) config text for a pitfall signature and, on a hit,
// returns the Finding. Each maps to a KNOWN-PITFALLS node. Detectors are pure string/regex
// checks so audit stays offline + key-free (Q7). Order: most-severe class first.
interface Detector {
  test: (text: string, raw: string) => boolean;
  finding: Finding;
}

const DETECTORS: Detector[] = [
  // KP-A2 — `plain` PKCE accepted / advertised (RFC 9700 §2.1.1 forbids plain).
  {
    test: (t) =>
      /code_challenge_method\s*[:=]\s*["']?plain/.test(t) ||
      /pkce[^\n]*plain/.test(t) ||
      /"plain"/.test(t) && /code_challenge/.test(t),
    finding: {
      severity: "high",
      rule: "KP-A2",
      cve: "GHSA-9h47-pqcx-hjr4",
      detected: "PKCE `plain` method accepted/advertised — a missing code_challenge_method silently downgrades to plain (RFC 9700 §2.1.1 forbids it).",
      fix: "Use a parse-time-rejecting provider (@better-auth/oauth-provider rejects `plain` at parse time, excludes `none`). Require S256; prefer parse-time rejection over a runtime gate (OP O11) — buggy clients bypass runtime gates.",
    },
  },
  // KP-A2 — `alg=none` advertised in the discovery doc → unsigned tokens.
  {
    test: (t) =>
      /alg\s*[:=]\s*["']?none/.test(t) ||
      /id_token_signing_alg[^\n]*none/.test(t) ||
      /signing_alg_values_supported[^\]]*none/.test(t),
    finding: {
      severity: "high",
      rule: "KP-A2",
      cve: "GHSA-9h47-pqcx-hjr4",
      detected: "`alg=none` advertised in id_token_signing_alg_values_supported — an RP negotiating alg without pinning may accept unsigned tokens.",
      fix: "Exclude `none` from the discovery doc; pin to a real signing alg (RS256/ES256). Use @better-auth/oauth-provider (excludes none) and never trust the discovery doc to match runtime behavior.",
    },
  },
  // KP-F2 / A5 — wildcard or non-exact, non-HTTPS redirect_uri.
  {
    test: (t) =>
      /redirect_uri[^\n]*\*/.test(t) ||
      /redirect_uris?\s*[:=][^\n]*["']\*/.test(t) ||
      /(redirect_uri|callback)[^\n]*http:\/\/(?!localhost|127\.0\.0\.1)/.test(t),
    finding: {
      severity: "medium",
      rule: "KP-F2",
      cve: "GHSA-86j7-9j95-vpqj",
      detected: "Wildcard or non-HTTPS redirect_uri — substring/wildcard matching enables open-redirect / stored XSS via `javascript:` URIs.",
      fix: "Exact-match, HTTPS-only redirect URIs everywhere (the MCP rule + the cross-vendor #2 footgun, KP-F2). Localhost is the only HTTP exception.",
    },
  },
  // KP-J2 / O14 — token in URL / query string / logged.
  {
    test: (t) =>
      /access_token=/.test(t) ||
      /token\s*[:=][^\n]*req\.query/.test(t) ||
      /(console\.log|logger)[^\n]*(access_token|refresh_token|assertion)/.test(t),
    finding: {
      severity: "high",
      rule: "KP-J2",
      detected: "Token in URL/query string or logged — XSS-readable / leaked in logs (the agent analog of JWT-in-localStorage).",
      fix: "Authorization header only (agent) / HTTP-only cookie (web). Never log tokens or assertions; never put a token in a URL (OP O14/O31, J2).",
    },
  },
  // KP-A1 — RFC 8707: resource only at /token, not /authorize (audience-binding hole).
  {
    test: (t) =>
      (/resource/.test(t) && /\/token/.test(t) && !/\/authorize/.test(t)) ||
      /better-auth\/oauth-provider[^\n]*1\.[0-6]\./.test(t) ||
      /oauth-provider["']?\s*[:=]?\s*["']?\^?1\.6\./.test(t),
    finding: {
      severity: "high",
      rule: "KP-A1",
      cve: "GHSA-p2fr-6hmx-4528",
      detected: "RFC 8707 audience-binding gap — `resource` honored only at /token (not /authorize), or @better-auth/oauth-provider on the unpatched 1.4.8–<1.7.0 line.",
      fix: "Require `resource=` on BOTH /authorize AND /token; bind audience to the canonical URI on the auth code AND refresh row; upgrade to 1.7.0 (the stable 1.6.x line was NOT patched). Test the bind — never assume it.",
    },
  },
  // KP-B1 — nOAuth-class implicit account-linking on email match alone. Only fires when
  // auto-linking appears ENABLED: an explicit `false` / "disabled" / "require...verification"
  // means the footgun is already closed (the clean-fixture case), so don't flag it.
  {
    test: (t) => {
      // Closed if linking is explicitly false (`autolink...": false`) or described as disabled.
      const linkingDisabled =
        /auto.?link[a-z]*["']?\s*[:=]\s*(false|"false")/.test(t) ||
        /link[a-z]*["']?\s*[:=]\s*(false|"false")/.test(t) ||
        /link[a-z\s-]*disabl/.test(t) ||
        /disabl[a-z\s-]*link/.test(t);
      if (linkingDisabled) return false;
      return (
        /auto.?link/.test(t) ||
        (/email.?match/.test(t) && /link/.test(t)) ||
        (/emailandpassword/.test(t) && /(oauth|social|google|github)/.test(t) && !/disabl/.test(t))
      );
    },
    finding: {
      severity: "high",
      rule: "KP-B1",
      cve: "GHSA-g38m-r43w-p2q7",
      detected: "Possible nOAuth-class pre-account-hijacking — OAuth identity auto-linked to a local row on email match. `requireEmailVerification` does NOT mitigate (link-time flip promotes the attacker's row).",
      fix: "NEVER auto-link an OAuth identity to a local account on email match alone. Require local-side verification OR disable implicit linking entirely (KP-B1; nOAuth 2023 / Sign-in-with-Apple 2020).",
    },
  },
];

// Kind-specific extra detectors (only run when --mcp/--scim/--agent/--saml is passed).
const KIND_DETECTORS: Record<AuditKind, Detector[]> = {
  mcp: [
    {
      // KP-E1 — targeting the stale 2025-06-18 spec instead of 2025-11-25.
      test: (t) => /2025-06-18/.test(t) && !/2025-11-25/.test(t),
      finding: {
        severity: "medium",
        rule: "KP-E1",
        detected: "Targets the stale MCP spec revision 2025-06-18 — the latest STABLE is 2025-11-25 (2026-07-28 RC in flight).",
        fix: "Implement to 2025-11-25 (CIMD recommended over DCR per SEP-991, OIDC discovery, incremental-scope step-up); track the 2026-07-28 RC (OP O23/O24).",
      },
    },
    {
      // KP-E2 — DCR preferred over CIMD (the order is now backwards).
      test: (t) => /dcr/.test(t) && !/cimd/.test(t),
      finding: {
        severity: "low",
        rule: "KP-E2",
        detected: "Registration defaults to DCR with no CIMD — SEP-991 made CIMD the recommended mechanism (the 'DCR > CIMD' order is backwards).",
        fix: "Prefer CIMD > DCR > pre-registered: client_id = an HTTPS URL to a hosted JSON metadata doc; no DB write, no unbounded DCR table (OP O24).",
      },
    },
  ],
  scim: [
    {
      // KP-H1 — unsigned SCIM events processed.
      test: (t) => /scim/.test(t) && !/(signature|verify|hmac|sign)/.test(t),
      finding: {
        severity: "high",
        rule: "KP-H1",
        detected: "SCIM events processed without visible signature verification — an attacker can provision/deprovision arbitrary users.",
        fix: "Validate webhook signatures before processing; reject any event that fails verification; process events in order (WorkOS ordered Events API is the reference — KP-H1/H2, OP O28).",
      },
    },
  ],
  agent: [
    {
      // KP-I7 — union instead of intersection (the master agent-auth rule).
      test: (t) => /union/.test(t) && /(perm|scope|authority)/.test(t),
      finding: {
        severity: "critical",
        rule: "KP-I7",
        detected: "Agent authority computed as a UNION of agent+user permissions — the master agent-auth anti-pattern.",
        fix: "Enforce the strict INTERSECTION: agent_perms ∩ user_perms, scoped + audience-bound + short-lived (5-30 min); policy gate before EVERY tool call (OP O16/O17).",
      },
    },
    {
      // KP-I2 — god mode + prompted guardrail.
      test: (t) =>
        (/admin|root|god.?mode/.test(t) && /(prompt|system.?prompt|instruction)/.test(t) && /(guard|don't|do not|never)/.test(t)),
      finding: {
        severity: "critical",
        rule: "KP-I2",
        detected: "'God mode with prompted guardrails' — root creds + a system-prompt 'don't delete' guard. A fundamental security failure (LLMs are easily manipulated via indirect injection).",
        fix: "Enforce limits cryptographically (scoped/audience-bound tokens), not in the prompt. Read/draft/commit gradient; irreversible actions → out-of-band human approval (CIBA) (OP O17/O18, KP-I2/I5).",
      },
    },
  ],
  saml: [
    {
      // KP-G7 — raw assertion logging.
      test: (t) => /(log|console)[^\n]*(assertion|saml.?response)/.test(t),
      finding: {
        severity: "medium",
        rule: "KP-G7",
        detected: "Raw SAML assertion logging — now a compliance liability, not a debug aid (2025's 'just log the full response' is a 2026 audit finding).",
        fix: "Structured logging + redaction only; never log raw assertions or tokens (OP O31).",
      },
    },
    {
      // KP-G1 — hard-coded signing cert fingerprint.
      test: (t) => /(fingerprint|cert|x509)[^\n]*[:=]/.test(t) && /(["'][A-Fa-f0-9:]{20,})/.test(t),
      finding: {
        severity: "high",
        rule: "KP-G1",
        detected: "Hard-coded signing-cert fingerprint — silent cert rotation (esp. weekends) is the #1 cause of production SSO outages; a stale cached fingerprint rejects ALL responses.",
        fix: "Auto-refresh IdP metadata on a schedule; alarm on cert expiry T-14d; never hard-code fingerprints (OP O29).",
      },
    },
  ],
};

/** Read the target path's text (file → its content; dir → all readable files concatenated). */
function readTarget(path: string): string {
  let st;
  try {
    st = statSync(path);
  } catch {
    throw new BadgeError(`cannot read "${path}" — no such file or directory`);
  }
  if (st.isFile()) {
    return readFileSync(path, "utf8");
  }
  // Directory: concatenate readable files (shallow + one level deep is enough for fixtures/config).
  const parts: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 3) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".git")) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p, depth + 1);
      } else if (entry.isFile()) {
        try {
          parts.push(`# ${entry.name}\n` + readFileSync(p, "utf8"));
        } catch {
          // unreadable file (binary/permission) — skip, not fatal.
        }
      }
    }
  };
  walk(path, 0);
  return parts.join("\n\n");
}

/**
 * Audit a config/code path against the pitfall checklist.
 * @param opts path (required) + optional kind (mcp|scim|agent|saml) to enable extra detectors.
 */
export function audit(opts: { path: string; kind?: AuditKind }): HandlerResult {
  const raw = readTarget(opts.path);
  const text = raw.toLowerCase();

  const detectors = [...DETECTORS, ...(opts.kind ? KIND_DETECTORS[opts.kind] : [])];
  const findings: Finding[] = [];
  for (const d of detectors) {
    if (d.test(text, raw)) {
      findings.push(d.finding);
    }
  }

  const result: AuditResult = {
    path: opts.path,
    kind: opts.kind ?? "general",
    findings,
    clean: findings.length === 0,
  };
  // The CLI verb itself exits 0 (the audit RAN successfully); the findings are in the data.
  // The auth-lint hook (B6) is what exits non-zero on a violation to gate staged code.
  return { data: result, human: renderHuman(result) };
}

function renderHuman(r: AuditResult): string[] {
  if (r.clean) {
    return [`audit: ${r.path} (${r.kind})`, "", "✓ no pitfalls detected against the KP checklist."];
  }
  const lines = [`audit: ${r.path} (${r.kind}) — ${r.findings.length} finding(s)`, ""];
  for (const f of r.findings) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.rule}${f.cve ? ` (${f.cve})` : ""}`);
    lines.push(`  detected: ${f.detected}`);
    lines.push(`  fix:      ${f.fix}`, "");
  }
  return lines;
}
