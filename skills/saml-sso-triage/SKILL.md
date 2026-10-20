---
name: saml-sso-triage
description: "Diagnose a SAML/SSO production failure with the 7-step triage runbook — cert rotation is the #1 cause, assertion bloat is the only real \"at scale\" failure, never log raw assertions. Use when SSO or SAML breaks in production: signature failures, cert rotation, truncated assertions, or a NameID that cannot be matched."
trigger: ["SSO broke", "SAML signature failing", "works for users not admins", "nothing changed our side and SSO fails", "cert rotation", "assertion truncated", "NameID can't correlate"]
---

# saml-sso-triage

> The incident job (EM JTBD-7). SAML breakage is overwhelmingly **config + time + routing, not
> crypto**. badge runs a 7-step triage runbook whose order doubles as the incident-frequency
> ranking. Encodes the runbook + cert-rotation-#1 (OP O29) + assertion-bloat (OP O30) +
> never-log-assertions (OP O31). Runs `badge saml-triage "<symptom>"`.

## When to use
An enterprise SSO/SAML flow is failing in production. (For CHOOSING SSO/SCIM tooling, use
auth-provider-selection with `--enterprise`.)

## Steps

1. **Run the 7-step triage in order (model: sonnet) — `badge saml-triage "<symptom>"`:**
   1. **timestamps / clock skew** — NotBefore/NotOnOrAfter rejections or AuthnRequest TTL aged out
      (NTP sync; KP-G4).
   2. **signing cert expiry / silent rotation** — the #1 cause; SP caches a stale fingerprint after
      IdP key rotation → rejects ALL responses (KP-G1).
   3. **ACS URL** — character-perfect match (HTTP-vs-HTTPS, trailing slash, staging-vs-prod; KP-G5).
   4. **Issuer** — correct IdP app selected (KP-G5).
   5. **Audience** — matches your SP entity id exactly (KP-G5).
   6. **signature algorithm** — SHA-1→SHA-256 drift after an IdP compliance upgrade (XML parses,
      validation fails crypto; KP-G3).
   7. **Destination** — exact match; never point a staging IdP at a prod SP (KP-G5).

2. **Pattern-match the symptom to the most-likely cause (model: sonnet):**
   - "signature failing, **nothing changed our side**" → **cert rotation** (the classic tell;
     OP O29). Fix = auto-refresh IdP metadata, alarm on cert expiry T-14d, never hard-code
     fingerprints. NOT "regenerate OUR cert."
   - "fails **only for admins** / users in many groups / assertion truncated" → **group-membership
     assertion bloat → POST-body truncation** by middleware/WAF/LB (~250KB limit; the only real
     "SAML at scale" failure; OP O30). Fix = filter group claims at the IdP + raise the SP ingress
     body-size limit.
   - "fails after their **security audit**" → SHA-1→SHA-256 sig-alg drift (KP-G3). Fix = coordinate
     cross-team, support the new alg before the IdP switches.
   - "valid crypto but **can't correlate the user**" → NameID missing/unmapped/wrong format (KP-G6).

3. **Frame it as a process failure, not a code bug (model: haiku).** Cert rotation and SHA-1→256 are
   cross-team coordination failures the IdP team's compliance work blindsides the SP team with — the
   fix is metadata auto-refresh + alerting, not better code (EM 7.4).

4. **Enforce the logging rule (model: haiku).** **NEVER log raw SAML assertions or tokens** — 2025's
   "just log the full response to debug" is now a compliance audit finding (OP O31 / KP-G7).
   Structured logging + redaction only.

## Output format
The 7-step runbook (in frequency order), the `most_likely_cause` (with its KP node + a one-line why),
the prescribed `fix`, and the cites. Lands on cert rotation as #1 when the symptom is ambiguous.

## Refuse
- "Regenerate our cert" as the reflex fix for a signature failure (it's the IdP's rotation; OP O29).
- Logging the raw assertion to debug (OP O31).
- Treating it as a crypto bug when it's config/time/routing.

Brain: `brain/KNOWN-PITFALLS.md` (G1-G7), `brain/OPINIONS.md` (O29/O30/O31), `brain/EXPERTISE-MAP.md` (JTBD-7), `brain/BATTLE-TESTED-SCENARIOS.md` (BTS-9/BTS-10).
