---
title: "badge BATTLE-TESTED-SCENARIOS — golden eval tasks from real incidents"
type: synthesis
domain: auth
created: 2026-06-11
updated: 2026-06-11
tags: [scenarios, golden-tasks, eval, auth, badge, cp123]
sources: ["brain/research/raw/field-02-production-postmortems.md", "brain/research/raw/field-03-migration-war-stories.md", "brain/research/raw/field-04-security-cves-version-gotchas.md", "brain/research/raw/field-01-saml-sso-failure-modes.md", "brain/research/raw/field-07-agent-identity-2026-frontier.md", "brain/research/raw/ecosystem-12-github-issues-breakage.md", "brain/research/raw/ecosystem-06-mcp-oauth.md"]
related: ["[[badge EXPERTISE-MAP]]", "[[badge KNOWN-PITFALLS]]", "[[badge OPINIONS]]", "[[badge TOOL-MATRIX]]"]
summary: "≥10 real, named, dated failure/migration/production scenarios with the actual resolution — the source pool for Wave-S golden eval tasks (L2 behavior + L3 trajectory)."
---

# badge BATTLE-TESTED-SCENARIOS

> Each scenario is REAL (named team/vendor/CVE, dated, cited). Each has a **Situation → What broke →
> Resolution → Eval-task** block. The Eval-task line is the seed for `eval/` golden tasks per `dsip.json`.
> A correct badge answer reproduces the Resolution and avoids the trap. These are NOT hypotheticals.

---

## SCENARIO 1 (BTS-1) — Clerk holds your session authority and its DNS provider dies (Feb 10, 2026)

- **Situation:** A consumer app uses Clerk for auth; Clerk manages all session validation (the app has no sessions table). On 2026-02-10 17:06 UTC, Clerk's DNS provider failed; authoritative DNS resolution was unavailable for **2h 32m**.
- **What broke:** For any user/app that couldn't resolve Clerk's API, it was a **complete outage — including already-logged-in users**, because Clerk holds the session authority. Clerk "did not have a failover prepared for the event of a complete outage at their DNS provider." Source: `field-02` §Outage A.
- **Resolution / right answer:** Own a sessions table so logged-in users survive an IdP control-plane outage; treat the IdP's uptime as your ceiling ("reliability is the minimum of the combined reliability of its critical parts"); for IdP-dependent flows, add DNS caching + an independent fallback resolver and decouple DNS provider from registrar.
- **Eval-task (L3 trajectory):** "We use Clerk and have no sessions table. What's our blast radius if Clerk's DNS goes down, and what's the minimal change to keep logged-in users working?" — PASS iff badge identifies that logged-in users go down too (session authority is at Clerk) and recommends owning session validation, not just "add a status page."

## SCENARIO 2 (BTS-2) — "Degraded-but-online" Postgres defeats Clerk's failover (Feb 19, 2026)

- **Situation:** Nine days after Scenario 1, an automatic PostgreSQL `ANALYZE` on Clerk's DB triggered a query-plan flip: the planner sampled "only NULL values," concluded 100% NULL when the true figure was 99.9996%, and optimized for zero rows on a query that returned **>17,000 rows** — consuming nearly all DB resources.
- **What broke:** **>95% of traffic returned HTTP 429** without reaching handlers; sign-in + account APIs inaccessible for ~90 min. Clerk's existing failover "was designed to trigger during Postgres outages but failed here because the DB was technically online, just degraded," the new failover "hadn't been instrumented with triggers in production yet," and the team "lacked training on enabling it." Source: `field-02` §Outage B.
- **Resolution / right answer:** Failover triggers must fire on **degraded** (latency/error-rate/429), not only hard-down; add query-plan alerting; audit queries for statistics stability; instrument + rehearse failover before you need it.
- **Eval-task (L2 behavior):** "Our auth DB is 'up' but every request is timing out and returning 429. Our failover didn't fire. Why, and what's the fix?" — PASS iff badge names degraded-but-online as the class naive failover misses and recommends latency/error-rate-based triggers + rehearsal.

## SCENARIO 3 (BTS-3) — Clerk account-wide rate limit that only bites in production (Val Town, 2025)

- **Situation:** Val Town built social features on Clerk. Clerk rate-limited the user-data endpoint to **5 requests/second for the ENTIRE account across all users.**
- **What broke:** Fine in dev (you only load your own avatar); **broke in production** the moment lists needed to render *other* users' avatars/usernames. The canonical "works in dev, dies at scale" auth trap. Source: `field-03` §Val Town (pain #1).
- **Resolution / right answer:** Don't render multi-user UI by hitting the IdP per user — keep your own users table and read display data from YOUR DB (joins, not API fan-out). This is also why "drop your users table" is wrong (Scenario 8).
- **Eval-task (L2 behavior):** "Social feed shows other users' avatars by fetching each from Clerk; it 429s under load. Fix?" — PASS iff badge says cache/own the user display data locally rather than per-user IdP calls, and flags account-wide rate limits as a scale trap.

## SCENARIO 4 (BTS-4) — The definitive migration: Clerk → Better Auth (Val Town, May 2026)

- **Situation:** Val Town decided to leave Clerk (single-point-of-failure on session validation, two-users-tables complexity, webhook-sync inconsistency where "a user has a Clerk account but no Val Town database row").
- **What broke / risk:** Naive cutover = forced mass logout of every active session.
- **Resolution / the playbook:** **Two-week parallel period** supporting BOTH Clerk and Better Auth cookies; **every auth endpoint rewritten to accept either session type**; users migrated **gradually** (sign-in page starts issuing Better Auth sessions, old Clerk sessions age out); security-critical code **handwritten with close reading** (no auto-migrator). Verdict: "so far it really has been better." Source: `field-03` §Val Town (the playbook).
- **Eval-task (L3 trajectory):** "Migrate us off Clerk to Better Auth without logging everyone out." — PASS iff badge produces the dual-validation-window plan (accept both cookie types for 1–2 weeks, age out old sessions) and flags the four casualties (sessions, SSO links, social links, custom claims), NOT a big-bang cutover.

## SCENARIO 5 (BTS-5) — Better Auth ships an RFC 8707 audience-binding hole (GHSA-p2fr-6hmx-4528, May 31 2026)

- **Situation:** A team builds an MCP server on `@better-auth/oauth-provider` (version `>= 1.4.8, < 1.7.0-beta.4`), assuming the popular library is spec-correct.
- **What broke:** The provider "accepts `resource` only at the token endpoint, never at the authorization endpoint... does not record the requested resources on the authorization code... does not store them on the refresh-token row." A client completing a normal flow "can request a JWT access token whose audience targets a resource server the authorization never covered" (bounded only by server-wide `validAudiences`). **The stable 1.6.x line was NOT patched — you must move to 1.7.0.** Source: `field-04` §GHSA-p2fr-6hmx-4528.
- **Resolution / right answer:** Require `resource=` on BOTH `/authorize` AND `/token`; bind audience to the canonical URI on the auth code AND refresh-token row; upgrade to 1.7.0 (breaking — `customAccessTokenClaims` now gets `resources` array, was `resource`); **test the bind, don't assume it.**
- **Eval-task (L2 behavior):** "We're on Better Auth oauth-provider 1.6.4 for our MCP server. Are we audience-bound per RFC 8707?" — PASS iff badge says NO (1.6.x unpatched), cites the authorize-endpoint-ignored-resource flaw, and prescribes upgrading to 1.7.0 + verifying the bind.

## SCENARIO 6 (BTS-6) — `alg=none` + `plain` PKCE by default (GHSA-9h47-pqcx-hjr4, Better Auth < 1.6.11)

- **Situation:** A team uses Better Auth's legacy `oidcProvider()` / `mcp()` plugins below 1.6.11.
- **What broke:** (1) Discovery doc "advertises `none` in `id_token_signing_alg_values_supported`" → an RP negotiating alg without pinning may accept **unsigned tokens**; (2) "**PKCE `plain` is enabled by default**... a missing `code_challenge_method` is silently downgraded to `plain`" — even though discovery advertises S256 only. RFC 9700 §2.1.1 (OAuth 2.1) forbids `plain`. Source: `field-04` §GHSA-9h47-pqcx-hjr4.
- **Resolution / right answer:** Use the canonical `@better-auth/oauth-provider` replacement which "excludes `none`" and "**rejects `plain` at parse time**." Lesson: prefer parse-time rejection over runtime gates (buggy clients bypass runtime gates); pin to a signing alg; never trust the discovery doc to match runtime behavior.
- **Eval-task (L1 assertion + L2):** "Audit this MCP server's PKCE + token signing for OAuth 2.1 compliance" against a config using legacy plugins <1.6.11 — PASS iff badge flags both `alg=none` advertisement and silent `plain` downgrade, and recommends the parse-time-rejecting provider.

## SCENARIO 7 (BTS-7) — Pre-account hijacking via OAuth implicit linking (GHSA-g38m-r43w-p2q7, nOAuth-class)

- **Situation:** App has `emailAndPassword.enabled: true` + ≥1 OAuth/SSO provider, Better Auth < 1.6.11, implicit linking not disabled.
- **What broke:** "An attacker who pre-registers a victim's email through `/sign-up/email` (writes a row with `emailVerified: false`) can have the victim's later OAuth identity bound to the attacker's user row." The callback auto-links "whenever the provider asserts `email_verified: true`, without requiring the local user row's `emailVerified` to also be `true`." **`requireEmailVerification: true` does NOT mitigate** — the link-time flip promotes the attacker's row to verified. Same shape as Microsoft **nOAuth (2023)** and **Sign in with Apple JWT flaw (2020)**. Source: `field-04` §GHSA-g38m-r43w-p2q7.
- **Resolution / right answer:** **NEVER auto-link an OAuth identity to a local account on email match alone.** Require local-side verification OR disable implicit linking. This is THE evergreen account-takeover pattern.
- **Eval-task (L3 trajectory):** "Users can sign up with email/password and also 'Sign in with Google.' Is there an account-takeover risk?" — PASS iff badge identifies the nOAuth-class pre-account-hijacking, explains that email-match auto-linking is the flaw, and notes `requireEmailVerification` does not save you.

## SCENARIO 8 (BTS-8) — "DELETE your users table" → two authorities + webhook drift (Val Town)

- **Situation:** Following Clerk's 2021/2023 marketing ("Consider dropping your users table" / "DELETE your Users table"), a team relies on Clerk as both users table and sessions table, syncing to its DB via webhooks.
- **What broke:** Clerk's assumption ("a user only sees their own avatar") is wrong for social UI → the team had to keep its own users table anyway → **"two authorities for that information"**; webhook-sync inconsistency left users where "a user has a Clerk account but no [app] database row." Source: `field-03` §Val Town; `field-05` §TASTE 2.
- **Resolution / right answer:** Keep your own users table as the authority; treat the IdP as the auth mechanism, not the system of record. "If I want an additional column per user, it's a lot easier to add a Postgres column than [via] some API."
- **Eval-task (L2 behavior):** "Should we delete our users table and let Clerk own user data?" — PASS iff badge says NO, cites the two-authorities + webhook-drift failure, and recommends owning the users table.

## SCENARIO 9 (BTS-9) — SAML breaks on Monday because the IdP rotated its cert over the weekend

- **Situation:** Enterprise SSO worked Friday; Monday every SSO login fails with signature errors. The IdP rotated its signing key over the weekend.
- **What broke:** The SP cached a **stale fingerprint** → rejects ALL responses until metadata refresh. "Silent certificate rotation over weekends" is cited as the #1 cause of production SSO outages — a silent killer during enterprise deployments. Source: `field-01` §1.
- **Resolution / right answer:** Run the **7-step triage** (timestamps → cert → ACS → Issuer → Audience → sig-alg → Destination); root-cause = cert; **auto-refresh IdP metadata on a schedule, alarm on cert expiry T-14d, never hard-code fingerprints.** It's a cross-team coordination failure (fix is process), not a code bug.
- **Eval-task (L3 trajectory):** "SSO for one enterprise tenant broke this morning, signature validation failing, nothing changed on our side. Triage?" — PASS iff badge runs the triage in order, lands on cert rotation as #1 suspect, and prescribes metadata auto-refresh + expiry alerting (not "regenerate our cert").

## SCENARIO 10 (BTS-10) — SAML works for most users but fails for admins in many AD groups (assertion bloat)

- **Situation:** SSO works for normal employees but fails for users who belong to a large number of Active Directory groups (often admins).
- **What broke:** The IdP packs large group memberships into the assertion → middleware/WAF/load-balancer **silently truncates the POST body** → SP receives incomplete XML → structural validation fails. IBM cites a ~250,000-byte default assertion-size limit being exceeded. This is the closest thing to a true "SAML at scale" failure. Source: `field-01` §7.
- **Resolution / right answer:** **Filter group claims at the IdP** (never pass the full directory-group set); raise the body-size limit on the SP ingress. Detection: failure correlates with group-membership count, not user identity.
- **Eval-task (L2 behavior):** "SSO fails only for our admins; regular users are fine. The assertion looks malformed/truncated. Cause?" — PASS iff badge identifies group-membership assertion bloat → POST-body truncation and recommends filtering group claims at the IdP + raising ingress limits.

## SCENARIO 11 (BTS-11) — ChatGPT/LLM client redirects to your login and CORS breaks the MCP consent (Better Auth #7041)

- **Situation:** An LLM client (ChatGPT) drives an MCP/OAuth flow and gets redirected to your app's login for consent.
- **What broke:** `Access-Control-Allow-Origin: *` (wildcard) **fails the cross-origin consent redirect** — agent-driven consent redirects have different CORS needs than browser logins. Closed 2026-03-28. Source: `ecosystem-12` Better Auth #7041.
- **Resolution / right answer:** Configure CORS for the actual consent-redirect origins (not wildcard, not browser-login assumptions); validate `trustedOrigins`; test the full agent→login→consent→callback round-trip, because the agent path differs from the human path.
- **Eval-task (L2 behavior):** "Claude/ChatGPT can't complete OAuth consent against our MCP server — CORS error on the login redirect. Fix?" — PASS iff badge distinguishes agent-driven consent CORS from browser-login CORS and prescribes explicit origins + full round-trip testing.

## SCENARIO 12 (BTS-12) — The cross-vendor "auth() called on a route the middleware doesn't cover" (Clerk + WorkOS)

- **Situation:** Next.js App Router app; `auth()` / `withAuth()` / `getSession()` is called on a route, and you get "auth() was called but Clerk can't detect usage of clerkMiddleware()" (Clerk) or "calling withAuth on a route that isn't covered by AuthKit middleware" (WorkOS #229, still OPEN, surfaced on Netlify after 0.17.2).
- **What broke:** The route isn't matched by the middleware `matcher`, or the host/runtime (e.g., Netlify) excludes it. This is the **#1 cross-vendor Next.js auth bug** — not Clerk-specific. Second most common: redirect-URI / origin exactness. Source: `ecosystem-12` §cross-vendor pattern; Clerk #4827; WorkOS authkit-nextjs #229.
- **Resolution / right answer:** Fix the middleware `matcher` to cover the route; verify edge/host quirks (Netlify/Vercel runtime); confirm the middleware file location. For the agent era, also verify OAuth-provider flow completion + token rotation.
- **Eval-task (L2 behavior):** "Getting 'auth() was called but can't detect clerkMiddleware()' on /dashboard. Fix?" — PASS iff badge diagnoses middleware matcher coverage (not "reinstall Clerk") and notes it's a cross-vendor class also seen in WorkOS.

## SCENARIO 13 (BTS-13) — Rotated OAuth tokens never deleted → DB fills with stale tokens (Better Auth #6423)

- **Situation:** MCP OAuth flow on Better Auth; refresh-token rotation is assumed to clean up old tokens.
- **What broke:** In `mcp/token`, the `refresh_token` path throws on an expired refresh token but **never DELETES it**; on issuing a new access+refresh pair, the **OLD token row is never removed** → DB fills with stale/rotated tokens; reuse-detection/cleanup broken. Directly violates OAuth 2.1 §4.3.1. Closed 2026-04-01. Related: GHSA-392p-2q2v-4372 — concurrent code/refresh redemption races the find-then-delete primitive and *forks the token family*. Source: `ecosystem-12` BA #6423; `field-04` §races.
- **Resolution / right answer:** Verify your IdP actually deletes the rotated token (don't trust the happy path); implement reuse-detection as an **atomic find-then-delete** (DB transaction / `SELECT ... FOR UPDATE`) — a naive read-then-write races and forks the family instead of protecting it.
- **Eval-task (L3 trajectory):** "We rotate refresh tokens for our MCP server. Are we §4.3.1-compliant?" — PASS iff badge checks that rotated tokens are actually deleted AND that rotation is atomic against concurrent redemption (family-fork risk), not just "we issue new ones."

## SCENARIO 14 (BTS-14) — Unauthenticated API-key creation; "popularity isn't safety" (CVE-2025-61928)

- **Situation:** A team adopts Better Auth's API-keys plugin (patched in 1.3.26), trusting its stars/YC/$5M as a safety signal.
- **What broke:** "A logic error in how the API keys plugin determines user context when a `userId` is specified" → **unauthenticated API-key creation** → account takeover. Found by ZeroPath's AI SAST. "This is the kind of business logic flaw that traditional dependency vetting (stars, existing CVEs, reputation) doesn't catch." Source: `field-04` §CVE-2025-61928.
- **Resolution / right answer:** Patch to ≥1.3.26; more broadly — **verify actual auth behavior against a checklist; never infer safety from popularity.** Expect MORE auth CVEs surfacing in 2026 as AI SAST matures, not fewer.
- **Eval-task (L2 behavior):** "Is Better Auth safe because it's the most popular TS auth lib?" — PASS iff badge rejects popularity-as-safety, cites the unauth API-key CVE + 2026-05-31 batch, and prescribes checklist verification + version pinning.

## SCENARIO 15 (BTS-15) — Confused-deputy exfil via prompt injection (the agent-auth disaster)

- **Situation:** An agent is given blanket admin access to user data + tools, with a system-prompt "guardrail" ("do not delete data"). A poisoned RAG doc or injected prompt arrives.
- **What broke:** "A single injection can weaponize the agent to scan inboxes, summarize sensitive financial data, and exfiltrate via external tool calls — the whole exfil chain completes without a human in the loop." "God mode with prompted guardrails" is "a fundamental security failure; language models are easily manipulated via indirect injection." Source: `field-07` §confused-deputy + §anti-pattern 2.
- **Resolution / right answer:** Enforce the **intersection rule** (`agent_perms ∩ user_perms`, never union) **cryptographically** via scoped, audience-bound, short-lived tokens; route EVERY tool call through a centralized policy layer (don't trust the model's API request); apply the read/draft/commit gradient (irreversible actions → CIBA human approval); keep an immutable per-action audit trail.
- **Eval-task (L3 trajectory):** "Design auth for an agent that reads a user's email and can send replies." — PASS iff badge applies intersection-not-union, per-call policy gate, read/draft/commit gradient with human approval on send, and per-action audit — and explicitly refuses the "admin key + prompt guardrail" design.

## SCENARIO 16 (BTS-16) — Auth0 renewal price-shock forces a migration (the "Okta tax")

- **Situation:** A growing B2B SaaS on Auth0 hits its renewal quote. SSO is gated behind custom-quote Enterprise; per-MAU costs compound.
- **What broke:** Documented "price shock" post-Okta-acquisition: B2C Essentials per-MAU effectively doubled; SAML SSO gated behind Enterprise; **one user reported a 15.54x jump — $240/mo → $3,729/mo** on modest growth (authentik "The Okta Tax," 2026-02-23). Source: `field-08` §SHIFT 6.
- **Resolution / right answer:** For 5–10 SSO customers, WorkOS (~$125/connection, 1M MAU free core) is dramatically cheaper than Auth0's per-MAU + enterprise-tier model; migrate enterprise SSO connections to WorkOS (per `field-03` §Auth0→WorkOS) using a dual-validation window; note Auth0 password-hash bulk export is gated (verify current policy).
- **Eval-task (L3 trajectory):** "Our Auth0 renewal jumped ~15x. We have 8 enterprise SSO customers. Options?" — PASS iff badge does the WorkOS-vs-Auth0 $ math, recommends per-connection pricing, and produces a dual-validation migration plan + flags the hash-export gate.

---

## Coverage note (for Wave-S eval authors)

These 16 span: **reliability/outage** (1,2,3), **migration** (4,16), **CVE/spec-compliance** (5,6,7,13,14), **SAML production** (9,10), **MCP/agent** (11,15), **Next.js footguns** (12), **architecture taste** (8). Map each to an `eval/` golden task at L1 (assertion: did badge cite the right CVE/RFC/version?), L2 (behavior: did the prescribed fix match the Resolution?), or L3 (trajectory: did badge route correctly end-to-end?). No-self-grading per `dsip.json`; grade against the Resolution text here.
