---
title: "badge KNOWN-PITFALLS — version-specific gotchas with detection + avoidance"
type: synthesis
domain: auth
created: 2026-06-11
updated: 2026-06-11
tags: [pitfalls, gotchas, cve, version-specific, auth, badge, cp123]
sources: ["brain/research/raw/field-04-security-cves-version-gotchas.md", "brain/research/raw/ecosystem-12-github-issues-breakage.md", "brain/research/raw/ecosystem-01-clerk.md", "brain/research/raw/ecosystem-06-mcp-oauth.md", "brain/research/raw/field-01-saml-sso-failure-modes.md", "brain/research/raw/field-07-agent-identity-2026-frontier.md", "brain/research/raw/ecosystem-07-sso-scim-enterprise.md"]
related: ["[[badge EXPERTISE-MAP]]", "[[badge BATTLE-TESTED-SCENARIOS]]", "[[badge OPINIONS]]", "[[badge TOOL-MATRIX]]"]
summary: "The gotcha list — version-pinned CVEs, library footguns, and spec traps, each with how to DETECT it and how to AVOID it."
---

# badge KNOWN-PITFALLS

> Format per pitfall: **[severity] What it is · Affected versions · DETECT · AVOID**. Version pins are
> load-bearing — quote them. CVE/GHSA IDs are receipts. When in doubt, verify against the running build,
> not the docs or the star count. Cross-ref scenarios in [[badge BATTLE-TESTED-SCENARIOS]].

---

## A. OAuth-provider / MCP spec-compliance pitfalls (Better Auth 2026-05-31 batch)

> Meta-warning: on **2026-05-31** the most popular TS auth library (300K+ weekly downloads) shipped a
> coordinated advisory batch across `oauth-provider`/`sso`/`scim`/`mcp`/`oidc-provider`. **Do NOT assume any
> auth library's OAuth-2.1/MCP server is spec-correct by default.** Source: `field-04` §batch intro.

### A1. [medium→high] Access token NOT bound to the grant's resource (RFC 8707 hole) — GHSA-p2fr-6hmx-4528
- **Affected:** `@better-auth/oauth-provider` `>= 1.4.8, < 1.7.0-beta.4`. **The stable 1.6.x line was NOT patched** — you must move to 1.7.0.
- **DETECT:** Provider accepts `resource` only at `/token`, not `/authorize`; doesn't record requested resources on the auth code or refresh-token row. Test: complete a normal flow, then request a token whose `aud` targets a resource the authorization never covered — if you get a token (bounded only by server-wide `validAudiences`), you're vulnerable. The refresh grant has the same gap.
- **AVOID:** Require `resource=` on BOTH `/authorize` AND `/token`; bind audience to the canonical URI on the auth code AND refresh row; upgrade to 1.7.0 (breaking: `customAccessTokenClaims` now gets `resources` array, was `resource`; uncovered resource → `invalid_target`). **Test the bind; never assume it.** Source: `field-04` §GHSA-p2fr-6hmx-4528.

### A2. [high] `alg=none` advertised + `plain` PKCE accepted by default — GHSA-9h47-pqcx-hjr4
- **Affected:** `better-auth < 1.6.11` using legacy `oidcProvider()` or `mcp()` plugins.
- **DETECT:** Discovery doc lists `none` in `id_token_signing_alg_values_supported`; a missing `code_challenge_method` is silently downgraded to `plain` even though discovery advertises S256 only (runtime contradicts discovery).
- **AVOID:** Use the canonical `@better-auth/oauth-provider` (excludes `none`, **rejects `plain` at parse time**); pin to a real signing alg; prefer **parse-time rejection over runtime gates** (buggy clients bypass runtime gates). RFC 9700 §2.1.1 forbids `plain`. Source: `field-04` §GHSA-9h47-pqcx-hjr4.

### A3. [high] OAuth code/refresh concurrent-redemption races — GHSA-392p-2q2v-4372 + GHSA-7w99-5wm4-3g79
- **Affected:** Better Auth OAuth grant (pre-batch fix).
- **DETECT:** Auth-code grant allows concurrent redemption when two token requests race the find-then-delete; refresh rotation **forks the token family** on concurrent redemption (the "rotation" you think protects you actually forks).
- **AVOID:** Make reuse-detection an **atomic find-then-delete** — DB transaction / `SELECT ... FOR UPDATE` / atomic delete. A naive read-then-write races. Source: `field-04` §races; scenario 13.

### A4. [critical] SSRF via unvalidated OIDC endpoints on SSO registration — GHSA-5rr4-8452-hf4v
- **Affected:** `@better-auth/sso` (pre-batch fix).
- **DETECT:** A tenant can register an SSO connection with an arbitrary OIDC issuer URL; the server fetches that issuer's metadata → SSRF against internal services. Discovery-by-URL (which MCP-first embraces) is an SSRF vector.
- **AVOID:** Validate/allowlist issuer hosts; **block internal IP ranges (RFC 1918, link-local, metadata endpoints) on metadata fetch.** Source: `field-04` §GHSA-5rr4-8452-hf4v.

### A5. [high/medium] SCIM + SSO authz holes in the batch
- **GHSA-j8v8-g9cx-5qf4 [high]** SCIM: an authenticated user can regenerate the SCIM provider token (single-tenant). **DETECT:** SCIM token regeneration not gated to admins. **AVOID:** gate token mgmt to privileged roles.
- **GHSA-gv74-j8m3-fg5f [high]** SSO: provider may allow registration for any org member **without checking role**. **DETECT:** SSO connection creation not role-gated. **AVOID:** enforce role checks on SSO/SCIM admin actions.
- **GHSA-86j7-9j95-vpqj [medium]** oidc-provider: stored XSS via `javascript:` `redirect_uri`. **DETECT:** non-exact, non-HTTPS redirect URIs accepted. **AVOID:** exact-match HTTPS redirect URIs only (also the MCP rule).
- **GHSA-pw9m-5jxm-xr6h [medium]** refresh-token replay via missing client auth on oidc-provider + **mcp** plugins. **AVOID:** require client auth on refresh.
- **GHSA-2vg6-77g8-24mp [low]** stale sessions persist after user deletion (admin/anon/SCIM) → **deprovisioning correctness bug.** **DETECT:** deleted user's sessions still validate. **AVOID:** cascade session revocation on deletion. Source: `field-04` §other notable.

## B. The evergreen account-takeover pitfalls (know these cold)

### B1. [high] nOAuth-class pre-account-hijacking via OAuth implicit linking — GHSA-g38m-r43w-p2q7
- **Affected:** `better-auth < 1.6.11` with `emailAndPassword.enabled: true` + ≥1 OAuth/SSO provider + implicit linking not disabled. **But the CLASS is provider-agnostic and evergreen** (Microsoft nOAuth 2023, Sign in with Apple JWT 2020).
- **DETECT:** Callback auto-links an OAuth identity to a local row whenever the provider asserts `email_verified: true`, **without requiring the local row's `emailVerified` to also be true.** An attacker pre-registers the victim's email via `/sign-up/email` (writes `emailVerified: false`); the victim's later OAuth login binds to the attacker's row. **`requireEmailVerification: true` does NOT mitigate** (link-time flip promotes the attacker's row to verified).
- **AVOID:** **NEVER auto-link an OAuth identity to a local account on email match alone.** Require local-side verification OR disable implicit linking entirely. Source: `field-04` §GHSA-g38m-r43w-p2q7; scenario 7.

### B2. [account takeover] Unauthenticated API-key creation — CVE-2025-61928
- **Affected:** Better Auth API-keys plugin, **patched 1.3.26.**
- **DETECT:** Logic error in how the plugin determines user context when a `userId` is specified → API key created without authentication. (Found by AI SAST; stars/reputation did NOT surface it.)
- **AVOID:** Patch ≥1.3.26; verify auth on key creation against a checklist — popularity is not a safety signal. Source: `field-04` §CVE-2025-61928; scenario 14.

## C. Better Auth version-churn pitfalls (the library moves fast; security regresses between minors)

> Meta-rule: **pin versions, gate every upgrade behind a full auth E2E, re-verify security config on upgrade.**

- **C1. [high] 2FA bypass via premature session caching** — GHSA-xg6x-h9c9-2m83 (2026-04-01). `session.cookieCache` made 2FA *bypassable*. DETECT: 2FA-enabled session validated from cache before second factor. AVOID: upgrade past the patch; don't cache pre-2FA sessions.
- **C2. [high] Rate limiter keys IPv6 individually → bypass via prefix rotation** — GHSA-p6v2-xcpg-h6xw (2026-05-11). DETECT: limiter keys full IPv6 addr; attacker rotates within their /64. AVOID: key rate limits by IPv6 /64 prefix, not full address.
- **C3. [high] `trustedOrigins` disregarded in v1.4.7** — BA #6798 (29 comments). DETECT: CSRF/redirect-origin checks silently bypassed on that version. AVOID: pin off 1.4.7; re-test origin config on upgrade.
- **C4. [high] Magic-link sign-in broken since 1.5.0** — BA #8228. DETECT: schema-gen removed the magic-link `verifications` table → feature broke on upgrade. AVOID: full auth E2E after upgrade.
- **C5. [high] `runWithRequestState` error on Cloudflare Workers (1.3→1.4)** — BA #6613 (33 comments). DETECT: edge-runtime breakage on minor upgrade. AVOID: test on your actual edge runtime before shipping the bump.
- **C6. [high] Double-slash path normalization bypasses `disabledPaths` + rate limits** — GHSA-x732-6j76-qmhm (2025-12-15, `rou3`). AVOID: normalize paths before policy checks.
- **C7. [high] Passkey deletion IDOR** — GHSA-4vcf-q4xf-f48m (2025-11-24). AVOID: authorize passkey deletion to the owner.
- **C8. [low] Multi-session sign-out accepts forged cookies** — GHSA-wmjr-v86c-m9jj (2025-11-26) → revoke arbitrary sessions. AVOID: authenticate the revocation request.
- **C9. [structural] Better Auth "really wants to own the user table"** — BA #2202 (67 comments). DETECT: federating to an existing IdP (Keycloak etc.) without a Better-Auth-owned user table is high-friction. AVOID: know this before adopting if you already have an external IdP / no-DB requirement. Source for C1–C9: `field-04`; `ecosystem-12` BA #6798/#8228/#6613/#2202.

## D. Clerk pitfalls (middleware + version churn)

- **D1. [#1 footgun] "auth() was called but Clerk can't detect usage of clerkMiddleware()"** — recurring (Clerk #4827, and the authMiddleware-era #3033/#2736). DETECT: `auth()` called on a route the middleware `matcher` doesn't cover, or middleware file mislocated. AVOID: fix the `matcher` to cover the route; verify the middleware file path. (Cross-vendor — see F1.) Source: `ecosystem-01`; `ecosystem-12` Clerk.
- **D2. [breaking] Core 3 (2026-03-03) migration debt.** Package renames (`@clerk/clerk-react`→`@clerk/react`); `<SignedIn>/<SignedOut>/<Protect>`→single `<Show when=...>`; **`auth()` is now ASYNC — must `await`**; **`getToken()` now THROWS `ClerkOfflineError` when offline** (previously returned `null`; code treating `null` as "offline" breaks); `authMiddleware()` REMOVED in v6 → must use `clerkMiddleware()` which **protects NOTHING by default** (opt routes in). Requires Node 20.9.0+. AVOID: `npx @clerk/upgrade` codemods; audit every `null`-from-`getToken` and every guard component. Source: `ecosystem-01` §Core 3 breaking.
- **D3. [recurring] Framework-major compat windows.** Every Next.js major has a "Clerk not compatible yet" window historically (#4374); new-framework adapters lag core (e.g. tanstack-react-start cookie crash #6996, Dec 2025; `attempt_verification` 500 after Core 3, #8205). AVOID: don't upgrade Next.js major + Clerk same day; wait for adapter parity. Source: `ecosystem-12`; `field-04` §Clerk churn.
- **D4. [enterprise gap — now PARTIALLY closed] "Clerk has no SCIM" is STALE.** Clerk Directory Sync (SCIM) went GA 2026-04-16 (groups + custom attrs, included with enterprise connection). The deeper **"user-first, not org-first"** architecture critique still stands (orgs layered on a user-first system; tenant enforcement in app code). AVOID quoting the old "no SCIM" line; DO weigh the org-first modeling gap. Source: `field-08` §SHIFT 5.

## E. MCP OAuth spec-currency pitfalls

- **E1. [currency] The internal corpus targets the WRONG spec revision.** Energy's `mcp-first-connectors.md` + `2026-04-17_mcp_oauth_briefing.md` target **2025-06-18**; the latest STABLE spec is **2025-11-25** (with a 2026-07-28 RC). DETECT: any plan citing only 2025-06-18. AVOID: implement to **2025-11-25**, track the RC. Source: `ecosystem-06` §one-revision-behind.
- **E2. [recommendation flip] "DCR > CIMD" is now backwards.** SEP-991 (2025-11-25) made **CIMD the RECOMMENDED registration mechanism over raw DCR**. The internal rule's "DCR > CIMD > pre-registered" should be **"CIMD > DCR > pre-registered."** DETECT: connector design defaulting to DCR. AVOID: prefer CIMD (client_id = HTTPS URL to a hosted JSON doc; no DB write, no unbounded DCR table) where the AS supports it. Source: `ecosystem-06` §CIMD; `ecosystem-10` §Energy recommendation.
- **E3. [DCR opt-in] Stytch DCR is OFF by default.** Must enable in the dashboard; if you forget, Claude Connectors' auto-registration fails. DETECT: agent registration 4xx at `/v1/oauth2/register`. AVOID: enable DCR in the Stytch dashboard before testing agent flows. Source: `ecosystem-04` §watch-outs.
- **E4. [SDK punt] Don't expect the MCP TS SDK to broker server OAuth.** `ProxyOAuthServerProvider` + all server OAuth exports (`mcpAuthRouter`, `OAuthServerProvider`, `requireBearerAuth`, ...) were REMOVED; the SDK names better-auth. Client helpers remain. DETECT: a plan importing removed server-OAuth symbols. AVOID: pick an external AS (Better Auth / Stytch / WorkOS / Auth0 / your own). Source: `ecosystem-06` §removed-from-SDK.
- **E5. [first-time failure] "MCP server returns Unauthorized"** — BA #7614. DETECT: usually `aud`/resource mismatch or token not presented as `Authorization: Bearer`. AVOID: confirm `aud` = your canonical URI and Bearer presentation; the most common first-time MCP-auth failure. Source: `ecosystem-12` BA #7614.
- **E6. [flow completion] OAuth-2.1-Provider authorize flow may not complete** — BA #7558 (closed 2026-04-22, v1.4.17). DETECT: after user signs in on the provider app, they're NOT redirected back to the consumer (provider's own post-login redirect takes over) or the page hangs; session created but OAuth flow never completes. AVOID: pin + test the **full redirect round-trip**, don't assume battle-tested. Source: `ecosystem-12` BA #7558.

## F. Cross-vendor Next.js / hosted-IdP pitfalls

- **F1. [#1 cross-vendor bug] "auth helper called on a route the middleware doesn't cover" / session null in middleware.** Clerk ("can't detect clerkMiddleware()"), WorkOS ("calling withAuth on a route not covered by AuthKit middleware" #229, **still OPEN**, surfaced on Netlify after 0.17.2), and the "getSession in middleware returns null" trap (#115). DETECT: auth helper on an uncovered route; host/runtime (Netlify) excludes the middleware. AVOID: fix `matcher` coverage + verify edge/host quirks — the #1 preventable Next.js auth support ticket. Source: `ecosystem-12` §cross-vendor.
- **F2. [#2 cross-vendor] Redirect-URI / origin exactness.** WorkOS #24 (wildcards in redirect URI don't work), the MCP "exact redirect match MUST" rule, and the `javascript:` redirect-URI XSS (A5). DETECT: relying on wildcard/substring redirect matching. AVOID: exact-match, HTTPS-only redirect URIs everywhere. Source: `ecosystem-12` WorkOS #24; `ecosystem-06`.
- **F3. [concurrency] Refresh-token race under high concurrency** — WorkOS authkit-nextjs #28; mirrors A3. DETECT: concurrent requests racing on refresh → token churn (relevant to high-frequency agent traffic). AVOID: serialize/atomic refresh. Source: `ecosystem-12` WorkOS #28.
- **F4. [composition] Composing the hosted middleware with your own is non-obvious** — WorkOS #47 (24 comments); later got composable proxy helpers (PR #348) + a fix to avoid calling `headers()` in middleware (PR #354). DETECT: custom middleware + AuthKit/Clerk middleware interfering. AVOID: use the vendor's composable middleware helpers; don't call `headers()` inside middleware. Source: `ecosystem-12` WorkOS #47.

## G. SAML / enterprise-SSO production pitfalls (config + time + routing, not crypto)

> Triage order = frequency ranking: timestamps → cert → ACS → Issuer → Audience → sig-alg → Destination.

- **G1. [#1 cause] Silent certificate rotation (esp. weekends).** SP caches a stale fingerprint after IdP key rotation → rejects ALL responses. DETECT: all SSO logins for a tenant fail with signature errors, "nothing changed on our side." AVOID: auto-refresh IdP metadata on a schedule; alarm on cert expiry T-14d; never hard-code fingerprints. Source: `field-01` §1.
- **G2. [scale] Assertion bloat from group memberships → POST-body truncation.** Large AD group sets bloat the assertion; middleware/WAF/LB silently truncates the body (~250KB default limit, IBM); SP gets incomplete XML. DETECT: SSO fails only for admins / users in many groups; assertion looks truncated. AVOID: filter group claims at the IdP; raise SP ingress body-size limit. Source: `field-01` §7.
- **G3. [crypto drift] SHA-1→SHA-256 sig-alg mismatch.** IdP's compliance upgrade breaks trust; XML parses but validation fails cryptographically. DETECT: failures begin right after the IdP team's security audit. AVOID: coordinate cross-team; support the new alg before the IdP switches. Source: `field-01` §2.
- **G4. [time] Clock skew > 2 min / AuthnRequest TTL expiry.** Assertions appear "not yet valid" or "expired" despite valid signatures; or the request ID ages out mid-flow on slow/VPN networks. DETECT: NotBefore/NotOnOrAfter rejections; correlation failures after a pause. AVOID: NTP sync (non-negotiable in distributed setups); reasonable AuthnRequest TTLs. Source: `field-01` §3.
- **G5. [routing] ACS URL / Destination / Issuer / Audience mismatch.** Character-perfect matching required — HTTP vs HTTPS, trailing slashes, staging-vs-prod confusion all break immediately; wrong IdP app selected → Issuer/Audience diverge → rejected before identity is even checked. DETECT: top onboarding failure. AVOID: exact ACS/Destination match; pick the correct IdP app; never point staging IdP at prod SP. Source: `field-01` §4–§5.
- **G6. [correlation] NameID missing/unmapped or wrong format.** IdPs don't auto-configure NameID; or IdP sends `transient` but SP only accepts `emailAddress`. DETECT: valid crypto but SP can't correlate the user. AVOID: explicitly map NameID + agree on format. Source: `field-01` §6.
- **G7. [compliance] Raw assertion logging is now a liability.** 2025's "just log the full SAML response to debug" is now an audit finding. DETECT: full assertions/tokens in logs. AVOID: structured logging + redaction. Source: `field-01` §2026 shift.

## H. SCIM provisioning pitfalls

- **H1. [security] Unsigned SCIM events.** DETECT: directory lifecycle events processed without signature verification → attacker can provision/deprovision arbitrary users. AVOID: **validate webhook signatures before processing; reject any event that fails verification.** Source: `ecosystem-07` §gotcha 1.
- **H2. [correctness] Out-of-order / dropped SCIM events → provisioning drift.** DETECT: a created-then-deleted user processed in wrong order = ghost access. AVOID: process events in order + real-time (WorkOS's ordered Events API is the reference; naive endpoints drop/misorder). Source: `ecosystem-07` §gotcha 2.
- **H3. [deal-blocker] Shipping "SSO only" without SCIM deprovisioning.** DETECT: a B2B harness above ~$200k ACV with no automated deprovisioning. AVOID: ship SSO + SCIM together; map the deprovisioning flow before launch. Source: `ecosystem-07` §why deprovisioning. (Also: smaller CIAM products have rough/missing SCIM — verify the vendor actually ships it cleanly.)

## I. Agent-authorization pitfalls (the 6 anti-patterns to REFUSE)

All from `field-07` §6 anti-patterns + §confused-deputy. badge must refuse designs containing these.

- **I1. Single shared API key routing** — one privileged service-account key across all users → breaks identity attribution; one injection inherits max blast radius. AVOID: per-user delegated identity.
- **I2. "God mode with prompted guardrails"** — root creds + a system prompt saying "don't delete" → "a fundamental security failure; language models are easily manipulated via indirect injection." AVOID: enforce limits cryptographically (scoped/audience-bound tokens), not in the prompt.
- **I3. Blanket sign-up consent** — massive multi-system OAuth scopes at onboarding → least-privilege violation + consent fatigue + dangerous premature tokens. AVOID: JIT consent via MCP URL Elicitation; request granular scope at use-time.
- **I4. UI-only authorization checks** — backend tool endpoints lacking delegated-user-context verification → attacker bypasses the chat UI and triggers actions unvalidated. AVOID: authorize at the tool endpoint, not the UI.
- **I5. No read/draft/commit gradient** — identical authz for all actions → one injection causes irreversible damage (emails sent, funds moved). AVOID: reads/drafts low-friction; irreversible actions → out-of-band human approval (CIBA).
- **I6. No immutable audit trail** — no per-action logs (policy version, prompt hash, approval status) → incidents can't be reconstructed. AVOID: immutable per-action audit.
- **I7. [THE master rule] Computing authority as the UNION instead of the INTERSECTION.** DETECT: any design where the agent's effective authority exceeds `agent_perms ∩ user_perms`. AVOID: strict intersection, never union; bounded short-lived `(user, agent, scopes, audience, tenant, task_id, expiry)` tuple; policy gate before EVERY tool call. Source: `field-07` §intersection rule.

## J. Token-model pitfalls (the boring ones that bite)

- **J1. Long-lived JWT for anything compromisable.** "A 30-day JWT after a stolen laptop is 30 days of access." DETECT: access tokens with multi-day TTL and no revocation path. AVOID: short-lived JWT (mins) + server-side revocable refresh, rotated. Source: `ecosystem-08` §why-agents.
- **J2. JWT in `localStorage` (XSS-readable); for agents the analog is token-in-URL or token-in-logs.** DETECT: token in localStorage / query string / log line. AVOID: HTTP-only cookie (web) / Authorization header only (agent); never log; never in URL. Source: `ecosystem-08`; `mcp-first-connectors.md`.
- **J3. Choosing JWT when you needed instant revocation.** JWT can't be instantly revoked (networkless verification is the tradeoff); opaque tokens are revocable but add a DB lookup + latency. DETECT: "we need to kill this session NOW" against a stateless JWT. AVOID: default agents to short-lived JWT on the hot path, opaque only where instant revocation is a hard requirement; or the hybrid (stateless access + stateful refresh). Source: `ecosystem-01` §token formats; `ecosystem-08`.
- **J4. Provider token edge cases handled INSIDE the LLM context.** DETECT: agent logic trying to manage Google's 100-token rolling limit or Microsoft's 90-day sliding inactivity window in-prompt. AVOID: per-user, per-provider token vaulting OUTSIDE the LLM context ("non-negotiable for production agents"). Source: `field-07` §primitives.

---

## The one meta-pitfall above all

**Inferring safety from popularity / stars / funding.** Better Auth (300K+ downloads, YC, $5M) shipped an unauth API-key CVE *and* a coordinated 2026-05-31 OAuth/SSO/MCP/SCIM batch. AI SAST (ZeroPath-class) now surfaces business-logic auth flaws that reputation never caught — **expect MORE auth CVEs in 2026, not fewer.** badge verifies actual behavior (PKCE method, audience binding, account-linking gate, rotation atomicity) against this list and the running build — never the README. Source: `field-04` §meta-shift; `field-05` §TASTE 5.
