---
type: research
domain: auth
topic: real-world breakage (GitHub issues)
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Real-world breakage — top GitHub issues by engagement

Curated from `gh search issues` sorted by comment count, closed + open, across the canonical repos (accessed 2026-06-10). These are the failure modes badge will actually hit. NOT a feature list — these are the scars.

## Better Auth (`better-auth/better-auth`)

| Issue | Comments | State / closed | Why it matters |
|-------|----------|----------------|----------------|
| [#7558 Incomplete flow in the new OAuth 2.1 Provider plugin](https://github.com/better-auth/better-auth/issues/7558) | 11 | closed 2026-04-22 | **The agent/MCP-relevant one.** On v1.4.17: when a consumer app runs the generic OAuth plugin against a provider app running the new `oauth-provider` plugin, after the user signs in on the provider, they are NOT redirected back to the consumer — the provider's normal post-login redirect (to its dashboard) takes over, OR the page hangs. Session is created but **the OAuth flow never completes**. Lesson: Better Auth's OAuth-2.1-Provider plugin had real authorize-flow completion bugs as recently as April 2026 — do NOT assume it's battle-tested; pin + test the full redirect round-trip. |
| [#6423 Expired & Rotated OAuth Tokens Are Not Being Deleted in MCP Flow](https://github.com/better-auth/better-auth/issues/6423) | 6 | closed 2026-04-01 | In `mcp/token` (index.ts), the `refresh_token` path throws on an expired refresh token but never DELETES it; and on issuing a new access+refresh pair, the OLD token row is never removed. Result: **DB fills with stale/rotated tokens; reuse-detection/cleanup is broken.** Directly violates OAuth 2.1 §4.3.1 rotation hygiene. badge: verify your IdP actually deletes the rotated token, don't trust the happy path. |
| [#7041 Access-Control-Allow-Origin * when redirected from ChatGPT to login](https://github.com/better-auth/better-auth/issues/7041) | 11 | closed 2026-03-28 | CORS breakage when an LLM client (ChatGPT) redirects to your app's login during an MCP/OAuth flow. The wildcard ACAO header fails the cross-origin consent redirect. badge: agent-driven consent redirects have different CORS needs than browser logins. |
| [#7614 Better Auth MCP Server returning "Unauthorized"](https://github.com/better-auth/better-auth/issues/7614) | 8 | closed 2026-01-26 | Generic "MCP server says Unauthorized" — usually `aud`/resource mismatch or token not presented as Bearer. The most common first-time MCP-auth failure. |
| [#2202 Support for only external IDPs and no database?](https://github.com/better-auth/better-auth/issues/2202) | 67 | closed 2025-12-04 | Huge thread. People with an existing IdP (Keycloak, etc.) want Better Auth WITHOUT it owning a user table. **Better Auth "really wants to own the user table"** — structural friction for anyone federating to an external IdP. This is THE recurring complaint. |
| [#6798 trustedOrigins disregarded in v1.4.7](https://github.com/better-auth/better-auth/issues/6798) | 29 | closed 2025-12-27 | A version-specific regression where `trustedOrigins` config was ignored → CSRF/redirect-origin checks silently bypassed. Lesson: Better Auth ships frequently and origin/security config has regressed between minors — pin and re-test security config on upgrade. |
| [#6613 Upgrade 1.3→1.4: runWithRequestState error on Cloudflare Workers](https://github.com/better-auth/better-auth/issues/6613) | 33 | closed 2026-01-12 | Edge-runtime breakage on a minor upgrade. Better Auth + CF Workers/edge is fragile across versions. |
| [#8228 Magic link sign-in broken since 1.5.0](https://github.com/better-auth/better-auth/issues/8228) | 13 | closed 2026-03-01 | Schema generation removed the magic-link `verifications` table → feature broke on upgrade. Another "minor version broke a core flow" data point. |

**Better Auth meta-lesson:** fast-moving, own-your-DB, and **security/flow regressions between minor versions are common** (trustedOrigins, magic link, OAuth provider completion, MCP token cleanup). Pin versions, gate upgrades behind a full auth E2E.

## Clerk (`clerk/javascript`)

| Issue | Comments | State / closed | Why it matters |
|-------|----------|----------------|----------------|
| [#1436 Infinite redirect loop in NextJS dev](https://github.com/clerk/javascript/issues/1436) | 101 | closed 2023-08 | The single most-discussed Clerk issue ever. Redirect loops from middleware/matcher misconfig. Old but the class persists. |
| ["can't detect usage of clerkMiddleware()" family](https://github.com/clerk/javascript/issues/4827) | recurring | multiple | The #1 ongoing Clerk footgun: `auth()` called on a route the middleware matcher doesn't cover → hard error. Spans authMiddleware (#3033, #2736 "when used in Layout") and clerkMiddleware (#4827) eras. Clerk has a dedicated error doc for it. badge: middleware `matcher` correctness is the most common Clerk break. |
| [#6996 @clerk/tanstack-react-start: Cannot read 'get' in getCookie](https://github.com/clerk/javascript/issues/6996) | 28 | closed 2025-12-10 | Recent (Dec 2025) framework-adapter cookie-read crash — shows new-framework adapters lag the core. |
| [#4374 clerk not compatible nextjs 15](https://github.com/clerk/javascript/issues/4374) | 17 | closed 2024-10 | Every Next.js major has a "Clerk not compatible yet" window. Clerk advertises "same-day Next.js 16 support" now, but historically there's a gap. |

**Clerk meta-lesson:** the failure surface is overwhelmingly **middleware matcher + redirect config**, and **framework-version-compat windows**. The product churns majors (v5→v6→Core 3) which forces migrations.

## WorkOS authkit-nextjs (`workos/authkit-nextjs`)

| Issue | Comments | State | Why it matters |
|-------|----------|-------|----------------|
| [#229 After 0.17.2 on Netlify: "calling withAuth on a route that isn't covered by AuthKit middleware"](https://github.com/workos/authkit-nextjs/issues/229) | 15 | **open** | The SAME class as Clerk's "can't detect middleware" — host/runtime (Netlify) + middleware coverage mismatch. Still open. badge: this "withAuth/getSession on uncovered route" error is a CROSS-VENDOR pattern, not Clerk-specific. |
| [#47 How to compose authKitMiddleware with custom middleware?](https://github.com/workos/authkit-nextjs/issues/47) | 24 | closed 2025-01 | Composing AuthKit's middleware with your own is non-obvious. WorkOS later added "composable proxy/middleware helpers" (PR #348, Jan 2026) and a fix to avoid calling `headers()` in middleware (PR #354) — so this was a real, recently-addressed pain. |
| [#115 getSession inside middleware always returns { user: null }](https://github.com/workos/authkit-nextjs/issues/115) | 13 | closed 2025-01 | Session not populated in middleware context — same trap as Clerk's serverside-auth-data-missing issues. |
| [#28 Refresh Token Race Condition](https://github.com/workos/authkit-nextjs/issues/28) | 14 | closed 2024-06 | Concurrent requests racing on refresh → token churn. Relevant to high-concurrency agent traffic. |
| [#24 Wildcards in redirect URI do not work as expected](https://github.com/workos/authkit-nextjs/issues/24) | 10 | closed 2024-09 | Redirect-URI exact-match strictness bites people (matches the MCP "exact redirect match MUST" rule). |

**WorkOS meta-lesson:** middleware composition + session-in-middleware + redirect-URI exactness. Actively maintained (Jan 2026 middleware fixes), but the "uncovered route" error is live and unsolved on some hosts.

## Cross-vendor pattern (the through-line)
The dominant Next.js auth bug across ALL THREE hosted libs is **"auth helper called on a route the middleware doesn't cover" / session null in middleware**. If badge advises Next.js App Router auth, the #1 preventable support ticket is middleware `matcher` coverage + edge/host quirks. Second is **redirect-URI / origin exactness**. Third (agent-era) is **OAuth-provider flow completion + token rotation/cleanup**.

## Sources
- gh search issues across better-auth/better-auth, clerk/javascript, workos/authkit-nextjs (accessed 2026-06-10)
- Issue bodies quoted: BA #7558, BA #6423, BA #2202 (read via `gh issue view`)
