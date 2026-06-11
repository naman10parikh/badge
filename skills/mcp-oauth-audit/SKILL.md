---
name: mcp-oauth-audit
description: Audit an MCP server / OAuth provider for 2025-11-25 spec compliance — the 2026-05-31 BetterAuth CVE batch, the MUSTs, CIMD>DCR, audience binding — and never infer safety from stars.
trigger: "is my MCP server spec-compliant", "audit my OAuth provider", "RFC 8707 audience binding", "PKCE S256 / plain", "2025-11-25 MCP spec", "is BetterAuth safe", "MCP server returns Unauthorized"
---

# mcp-oauth-audit

> The spec-compliance job (EM JTBD-5). badge implements/audits to the **2025-11-25** spec —
> NOT the internal corpus's 2025-06-18 — and prefers **CIMD > DCR** (the internal order is
> backwards). Encodes the 2026-05-31 BetterAuth CVE batch (KP-A), the MUSTs, the Inspector
> test (OP O25), and "popularity ≠ safety" (OP O9). Runs `badge mcp-check` / `badge audit --mcp`.

## When to use
Securing or auditing an MCP server's OAuth, or any OAuth-2.1 provider an agent will talk to.

## Steps

1. **State the spec target (model: haiku):** **2025-11-25** (track the 2026-07-28 RC). If a plan
   cites only 2025-06-18, that's a currency bug (KP-E1, `brain/KNOWN-PITFALLS.md`).

2. **Static audit of the config/code (model: sonnet) — `badge audit <path> --mcp` (no live keys, Q7):**
   - **PKCE S256 only** — `plain` is banned (RFC 9700 §2.1.1); a missing `code_challenge_method`
     must NOT silently downgrade to `plain` (KP-A2 / GHSA-9h47-pqcx-hjr4).
   - **No `alg=none`** advertised in `id_token_signing_alg_values_supported` (KP-A2).
   - **RFC 8707:** `resource=` on BOTH `/authorize` AND `/token`; audience bound to the canonical
     URI on the auth code AND refresh row (KP-A1 / GHSA-p2fr-6hmx-4528 — the stable 1.6.x BetterAuth
     line was NOT patched; require 1.7.0).
   - **Exact-match, HTTPS-only redirect URIs** (KP-F2; `javascript:` redirect XSS).
   - **Refresh rotation = atomic find-then-delete** (KP-A3; a naive read-then-write forks the token
     family instead of protecting it).
   - **No token passthrough; tokens in Authorization header only, never logged, never in a URL** (KP-J2).

3. **Live discovery probe (model: sonnet) — `badge mcp-check <url>`:** drives PRM
   (.well-known/oauth-protected-resource) → ASM (.well-known/oauth-authorization-server) →
   registration → reports gaps. **Prefer CIMD > DCR > pre-registered** (SEP-991; OP O24) — CIMD's
   `client_id` is an HTTPS URL to a hosted JSON doc, no DB write, no unbounded DCR table.

4. **Reject popularity-as-safety (model: haiku).** BetterAuth (300K+ downloads, YC, $5M) shipped
   an unauth API-key CVE (CVE-2025-61928) AND the 2026-05-31 OAuth/SSO/MCP/SCIM batch. Verify
   behavior against this checklist + the running build — never the README or the star count (OP O9).

5. **End-to-end test before declaring done (model: sonnet):** drive the full
   401→PRM→ASM→register→authorize→token→tools/list dance with **MCP Inspector** (OP O25) — it
   catches `aud` mismatches the happy path hides (the #1 first-time failure, KP-E5).

## Output format
`{ findings: [{ severity, rule (KP node), cve?, detected, fix }] }` from the static audit, plus the
mcp-check discovery report `{ reachable, registration, pkce_method, gaps, next }`. Each finding cites
its KP node + GHSA/CVE id.

## Refuse
- Trusting a library's OAuth/MCP server as spec-correct by default (the 2026-05-31 lesson).
- Rolling your own AS — use BetterAuth/Stytch/WorkOS/Auth0 (OP O8/O26).
- Inferring safety from stars/funding (OP O9).

Brain: `brain/KNOWN-PITFALLS.md` (A1-A5, E1-E6, F2, J2), `brain/OPINIONS.md` (O8/O9/O23/O24/O25/O26), `brain/EXPERTISE-MAP.md` (JTBD-5), `brain/BATTLE-TESTED-SCENARIOS.md` (BTS-5/BTS-6/BTS-13/BTS-14).
