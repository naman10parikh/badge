// src/cli/saml-triage.ts — `badge saml-triage "<symptom>"` (B4b): the 7-step SSO/SAML
// triage runbook. The step order doubles as the incident-frequency ranking
// (timestamps → cert → ACS → Issuer → Audience → sig-alg → Destination). The symptom
// re-ranks the most-likely cause, but cert rotation is the #1 default (EM JTBD-7, OP O29,
// KP-G). Pure brain logic; works offline (PLAN §9 chaos no-network).

import { BadgeError } from "./output.js";
import type { HandlerResult } from "./dispatch.js";

export interface TriageStep {
  /** 1-7, the canonical order. */
  n: number;
  check: string;
  /** the KP/EM node id backing this step. */
  cite: string;
}

export interface TriageResult {
  symptom: string;
  steps: TriageStep[];
  most_likely_cause: string;
  fix: string;
  cites: string[];
}

// The 7-step runbook in frequency order (EM 7.1 / KP-G). This is the spine — always emitted.
const RUNBOOK: TriageStep[] = [
  { n: 1, check: "timestamps / clock skew — NotBefore / NotOnOrAfter rejections or AuthnRequest TTL aged out (NTP sync, KP-G4)", cite: "KP-G4" },
  { n: 2, check: "signing cert expiry / silent rotation — SP caches a stale fingerprint after IdP key rotation (KP-G1)", cite: "KP-G1" },
  { n: 3, check: "ACS URL — character-perfect match (HTTP vs HTTPS, trailing slash, staging-vs-prod) (KP-G5)", cite: "KP-G5" },
  { n: 4, check: "Issuer — correct IdP app selected; Issuer not diverged (KP-G5)", cite: "KP-G5" },
  { n: 5, check: "Audience — matches your SP entity id exactly (KP-G5)", cite: "KP-G5" },
  { n: 6, check: "signature algorithm — SHA-1→SHA-256 drift after an IdP compliance upgrade (XML parses, validation fails crypto) (KP-G3)", cite: "KP-G3" },
  { n: 7, check: "Destination — exact match; never point a staging IdP at a prod SP (KP-G5)", cite: "KP-G5" },
];

// Symptom signatures → the cause that jumps to #1. If none match, cert rotation is the
// default #1 suspect (it's the #1 cause of production SSO outages — EM 7.2 / KP-G1).
interface CauseRule {
  signals: string[];
  cause: string;
  fix: string;
  cites: string[];
}

const CAUSE_RULES: CauseRule[] = [
  {
    // assertion bloat → POST truncation (only-admins / many-groups).
    signals: ["only admins", "only for admins", "admins fail", "many groups", "group", "truncat", "malformed", "incomplete", "too large", "assertion bloat"],
    cause: "Group-membership assertion bloat → silent POST-body truncation by middleware/WAF/LB (the only real 'SAML at scale' failure — KP-G2). IBM cites a ~250KB default limit. Failure correlates with group COUNT, not user identity.",
    fix: "Filter group claims at the IdP (never pass the full directory-group set); raise the SP ingress body-size limit (OP O30).",
    cites: ["EM-JTBD-7", "KP-G2", "OP-O30"],
  },
  {
    // clock skew / time.
    signals: ["not yet valid", "expired", "notbefore", "notonorafter", "clock", "skew", "ttl", "after a pause", "vpn"],
    cause: "Clock skew > 2 min or AuthnRequest TTL aged out — assertions look 'not yet valid'/'expired' despite valid signatures, or the request id ages out mid-flow on slow/VPN networks (KP-G4).",
    fix: "NTP sync (non-negotiable in distributed setups); set reasonable AuthnRequest TTLs.",
    cites: ["EM-JTBD-7", "KP-G4"],
  },
  {
    // sig-alg drift.
    signals: ["sha-1", "sha1", "sha-256", "sha256", "after the audit", "after their security audit", "algorithm mismatch", "compliance upgrade"],
    cause: "SHA-1→SHA-256 signature-algorithm drift — the IdP's compliance upgrade breaks trust; the XML parses but validation fails cryptographically. Begins right after the IdP team's security audit (KP-G3).",
    fix: "Coordinate cross-team; support the new alg BEFORE the IdP switches. This is a process failure, not a code bug.",
    cites: ["EM-JTBD-7", "KP-G3"],
  },
  {
    // routing / ACS / Destination / Issuer / Audience.
    signals: ["acs", "destination mismatch", "wrong url", "redirect", "staging", "trailing slash", "issuer", "audience", "onboarding", "first time setup", "new tenant"],
    cause: "ACS URL / Destination / Issuer / Audience mismatch — character-perfect matching required; HTTP-vs-HTTPS, trailing slashes, and staging-vs-prod confusion break immediately; wrong IdP app → Issuer/Audience diverge → rejected before identity is checked (KP-G5). The top ONBOARDING failure.",
    fix: "Exact ACS/Destination match; select the correct IdP app; never point a staging IdP at a prod SP.",
    cites: ["EM-JTBD-7", "KP-G5"],
  },
  {
    // NameID.
    signals: ["nameid", "name id", "can't correlate", "cannot correlate", "user not found", "transient", "emailaddress format"],
    cause: "NameID missing/unmapped or wrong format — valid crypto, but the SP can't correlate the user (IdP sends `transient` while the SP only accepts `emailAddress`) (KP-G6).",
    fix: "Explicitly map NameID and agree on the format with the IdP.",
    cites: ["EM-JTBD-7", "KP-G6"],
  },
];

// The #1 default cause when the symptom doesn't strongly match a more specific cause.
const DEFAULT_CAUSE: CauseRule = {
  signals: [],
  cause: "Silent certificate rotation — the #1 cause of production SSO outages (esp. over weekends). The IdP rotates its signing key; the SP caches a stale fingerprint → rejects ALL responses. The classic 'nothing changed on our side' signature failure (KP-G1, BTS-9).",
  fix: "Auto-refresh IdP metadata on a schedule; alarm on cert expiry T-14d; never hard-code fingerprints. It's a cross-team coordination failure — the fix is process, not regenerating YOUR cert (OP O29).",
  cites: ["EM-JTBD-7", "KP-G1", "OP-O29"],
};

/**
 * Triage an SSO/SAML production failure: emit the 7-step runbook + the most-likely cause.
 * @param symptom the free-text production symptom.
 */
export function samlTriage(symptom: string): HandlerResult {
  const trimmed = symptom.trim();
  if (trimmed.length === 0) {
    // PLAN §9 chaos-b: empty input → clear message + non-zero exit, no crash.
    throw new BadgeError('empty symptom — pass a symptom, e.g. badge saml-triage "sig validation failing, nothing changed our side"');
  }
  const t = trimmed.toLowerCase();

  // "nothing changed on our side" + signature failing is the canonical cert-rotation tell —
  // keep it as the strong default rather than letting a stray "redirect" token mis-route it.
  const signatureFailing = /(signature|sig)\s*(validation|verif|fail)/.test(t) || /signature error/.test(t);
  const nothingChanged = /nothing changed/.test(t) || /didn't change anything/.test(t) || /no changes/.test(t);

  let chosen = CAUSE_RULES.find((r) => r.signals.some((s) => t.includes(s)));
  if (!chosen && (signatureFailing || nothingChanged)) {
    chosen = DEFAULT_CAUSE;
  }
  const cause = chosen ?? DEFAULT_CAUSE;

  const result: TriageResult = {
    symptom: trimmed,
    steps: RUNBOOK,
    most_likely_cause: cause.cause,
    fix: cause.fix,
    cites: cause.cites,
  };
  return { data: result, human: renderHuman(result) };
}

function renderHuman(r: TriageResult): string[] {
  const lines = [
    `symptom:     ${r.symptom}`,
    "",
    "7-step triage (frequency order):",
    ...r.steps.map((s) => `  ${s.n}. ${s.check}`),
    "",
    `most likely: ${r.most_likely_cause}`,
    "",
    `fix:         ${r.fix}`,
    `cites:       ${r.cites.join(", ")}`,
  ];
  return lines;
}
