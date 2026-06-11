---
type: research
domain: auth
topic: field intelligence — real CVEs + version-specific gotchas (the scars, with patch versions)
researcher: FIELD-INTELLIGENCE (CP123 Wave-R)
created: 2026-06-11
status: done
currency: June 2026 (most advisories published 2026-05-31)
---

# Field Intelligence — Real auth CVEs + version gotchas

> These are GHSA/CVE-confirmed, version-pinned defects in the libraries badge would build on.
> Crucially, several map DIRECTLY onto the badge MCP-OAuth compliance checklist
> (`energy/.claude/rules/mcp-first-connectors.md`) — they are that checklist's *failure receipts*.
> Source for all GHSA-* below: `gh api repos/better-auth/better-auth/security-advisories`, accessed 2026-06-11.

## The Better Auth 2026-05-31 advisory batch — a coordinated OAuth/SSO/MCP hardening dump
On **2026-05-31**, Better Auth published a LARGE batch of advisories across its `oauth-provider`,
`sso`, `scim`, `mcp`, and `oidc-provider` plugins. This is the single most important data point in
this whole research: **the most popular TS auth library (300K+ weekly downloads) shipped its
OAuth-provider/MCP surface with multiple spec-compliance holes, and only fixed them in mid-2026.**
Do NOT assume any auth library's OAuth-2.1/MCP server is spec-correct by default — verify against the checklist.

### ⭐ GHSA-p2fr-6hmx-4528 [medium] — `@better-auth/oauth-provider`: access-token audience NOT bound to the grant (RFC 8707 violation)
**This is the badge-checklist item #2 and #7 (Resource Indicator + Audience binding) failing in the wild.**
- **Affected:** `>= 1.4.8, < 1.7.0-beta.4` (the stable `1.6.x` line was **NOT patched** — you must move to 1.7.0).
- **The flaw (verbatim):** the provider "accepts `resource` only at the token endpoint, never at the authorization endpoint... It does not record the requested resources on the authorization code, and it does not store them on the refresh-token row." → A client that completes a normal flow "can request a JWT access token whose audience targets a resource server the authorization never covered," limited only by the server-wide `validAudiences` allowlist. **The refresh grant has the same gap.**
- **Why badge cares:** the MCP-first rule MANDATES `resource=` on BOTH `/authorize` AND `/token`, and audience binding to the canonical URI (confused-deputy defense). Better Auth shipped *exactly* the violation the rule warns about. Real receipt: spec-compliance is not free; you must test the bind, not assume it.
- **Breaking-fix note:** the 1.7.0 fix makes resource requests "only narrow" the authorized resource; uncovered → `invalid_target`; `customAccessTokenClaims` now gets a `resources` array (was `resource`). Migration is breaking.

### ⭐ GHSA-9h47-pqcx-hjr4 [high] — `oidcProvider`/`mcp`: `alg=none` advertised + `plain` PKCE accepted BY DEFAULT
**This is badge-checklist item #1 (PKCE S256, plain banned) failing by default.**
- **Affected:** `better-auth` below `1.6.11`, when using the legacy `oidcProvider()` or `mcp()` plugins.
- **Two defects (verbatim):**
  1. Discovery doc "advertises `none` in `id_token_signing_alg_values_supported`" → any RP doing alg negotiation "without pinning to a real signing algorithm may accept **unsigned tokens**."
  2. "**PKCE `plain` is enabled by default.**... a missing `code_challenge_method` parameter is silently downgraded to `plain`." Discovery *advertises* `S256` only — contradicting runtime acceptance of `plain`. "RFC 9700 §2.1.1 (OAuth 2.1) explicitly forbids `plain`."
- **Why badge cares:** the rule bans `plain` PKCE and unsigned tokens. Real receipt: the *legacy* plugins violated both; the *canonical* `@better-auth/oauth-provider` replacement "excludes `none`" and "rejects `plain` at parse time." **Lesson: prefer the parse-time-rejecting implementation; runtime gates get bypassed by buggy clients.**

### ⭐ GHSA-g38m-r43w-p2q7 [high] — core: pre-account hijacking via OAuth implicit linking (nOAuth-class)
**The single most important *conceptual* auth gotcha in this file.**
- **Affected:** `better-auth < 1.6.11`, when `emailAndPassword.enabled: true` + ≥1 OAuth/SSO provider + implicit linking not disabled.
- **The attack (verbatim):** "An attacker who pre-registers a victim's email through `/sign-up/email` (which writes a row with `emailVerified: false`) can have the victim's later OAuth identity bound to the attacker's user row." The callback auto-links "whenever the provider asserts `email_verified: true`, without requiring the local user row's `emailVerified` to also be `true`."
- **The kicker:** `requireEmailVerification: true` does **NOT** mitigate — "the link-time `emailVerified` flip promotes the attacker's row to verified."
- **Lineage (quote-worthy):** "the same shape as Microsoft **'nOAuth' (2023)** and the **Sign in with Apple JWT flaw (2020)**." This bug class is *evergreen* — account-linking-by-email is a foundational footgun.
- **badge takeaway:** NEVER auto-link an OAuth identity to a local account on email match alone. Require local-side verification OR disable implicit linking. This is THE account-takeover pattern every Auth expert must know cold.

### GHSA-392p-2q2v-4372 [high] + GHSA-7w99-5wm4-3g79 [high] — OAuth code/refresh concurrent-redemption races
- Authorization-code grant "allows concurrent redemption when two token requests race the find-then-delete primitive"; refresh-token rotation "forks the token family on concurrent redemption."
- **badge takeaway:** OAuth-2.1 refresh rotation (rule item #6) is subtle — the *reuse-detection* requires an atomic find-then-delete. A naive read-then-write races, and the "rotation" you think protects you forks the family instead. Use a DB transaction / `SELECT ... FOR UPDATE` or atomic delete.

### GHSA-5rr4-8452-hf4v [critical] — `@better-auth/sso`: SSRF via unvalidated OIDC endpoints on provider registration
- Letting a tenant register an SSO connection with an arbitrary OIDC issuer URL → SSRF against internal services when the server fetches that issuer's metadata.
- **badge takeaway:** discovery-by-URL (which the MCP-first rule embraces) is an SSRF vector. Validate/allowlist issuer hosts; block internal IP ranges on metadata fetch.

### Other notable ones in the batch (one-liners):
- **GHSA-j8v8-g9cx-5qf4 [high]** SCIM: authenticated user can regenerate the SCIM provider token (single-tenant).
- **GHSA-gv74-j8m3-fg5f [high]** SSO: provider may allow registration for any org member **without checking their role**.
- **GHSA-86j7-9j95-vpqj [medium]** oidc-provider: stored XSS via `javascript:` `redirect_uri` (→ exact-match redirect URIs, rule's anti-pattern).
- **GHSA-pw9m-5jxm-xr6h [medium]** refresh-token replay via missing client auth on oidc-provider + **mcp** plugins.
- **GHSA-2vg6-77g8-24mp [low]** stale sessions persist after user deletion (admin/anon/SCIM) — relevant to deprovisioning correctness.

## Pre-batch Better Auth CVEs (late 2025 / early 2026) — the library churns
- **CVE-2025-61928 [account takeover] — patched 1.3.26.** Unauthenticated API-key creation: "a logic error in how the API keys plugin determines user context when a `userId` is specified." Found by ZeroPath's AI SAST. Author quote: *"This is the kind of business logic flaw that traditional dependency vetting (stars, existing CVEs, reputation) doesn't catch."* Source: https://zeropath.com/blog/breaking-authentication-unauthenticated-api-key-creation-in-better-auth-cve-2025-61928 + HN https://news.ycombinator.com/item?id=45637295 (accessed 2026-06-11).
- **GHSA-xg6x-h9c9-2m83 [high] 2026-04-01** — 2FA bypass via premature session caching (`session.cookieCache`). **2FA was *bypassable* via the cookie cache.**
- **GHSA-p6v2-xcpg-h6xw [high] 2026-05-11** — rate limiter keys IPv6 addresses individually → **bypassable via prefix rotation** (an attacker rotates within their /64). Classic IPv6 rate-limit footgun.
- **GHSA-x732-6j76-qmhm [high] 2025-12-15** — double-slash path normalization (`rou3`) bypasses `disabledPaths` + rate limits.
- **GHSA-4vcf-q4xf-f48m [high] 2025-11-24** — passkey deletion IDOR.
- **GHSA-wmjr-v86c-m9jj [low] 2025-11-26** — multi-session sign-out accepts forged cookies to revoke arbitrary sessions.

## Clerk version-churn gotchas (from ecosystem-12 + corroboration)
- The product churns MAJORS: v5 → v6 → **Core 3**. Each major forces a migration. e.g. **issue #8205 (closed 2026-03-30):** `attempt_verification` returns 500 after the **Core 3** upgrade.
- **#8205 / Core 3** and the recurring **"can't detect usage of clerkMiddleware()"** family (matcher misconfig) are the dominant Clerk break classes (see ecosystem-12 for the full list — not re-listed here to avoid dup).

## 2026 meta-shift (invalidates 2025 wisdom)
- **2025 take:** "Better Auth = community darling, just use it, it's simpler/cheaper than Clerk."
- **2026 correction:** Better Auth's OAuth-provider/SSO/MCP/SCIM surface had a **coordinated CVE batch on 2026-05-31** + a 2FA bypass + an unauth API-key CVE. The library is excellent for *core* session auth but its *enterprise/agent* surface (the exact thing badge needs) was immature through H1 2026. **Pin versions, gate upgrades behind a full auth E2E, and verify every MCP-OAuth checklist item against the actual running build — do not trust "it's popular."**
- **AI SAST changed the discovery curve:** ZeroPath-class tools now find *business-logic* auth flaws that stars/reputation never surfaced. Expect MORE auth CVEs surfacing in 2026, not fewer — popularity is no longer a safety signal.
