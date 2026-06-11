---
type: research
domain: auth
topic: agent-plane GitHub scars (MCP SDK/Inspector/BetterAuth-MCP) + Token Vault mechanics + Clerk SCIM GA timeline
researcher: ECOSYSTEM (CP123 Wave-R, verification pass)
created: 2026-06-11
status: done
---

# Agent-plane scars + load-bearing mechanics — June 2026

Net-new material the `ecosystem-12` GitHub-issue file didn't reach: the **MCP TypeScript SDK / MCP Inspector / Better Auth-MCP** issue surface (the tools badge itself will USE to build and test connectors), the **Auth0 Token Vault** runtime mechanics (the P3 answer), and the **Clerk Directory Sync (SCIM) GA timeline** (very recent — corrects the corpus's flat "Clerk has SCIM" claim).

Issues mined via `gh api search/issues` (the `gh search issues --repo` form shell-mangles the `repo:` qualifier into one quoted string — use `gh api -X GET search/issues -f q='repo:OWNER/NAME term'` instead). All accessed 2026-06-11.

---

## A. MCP Inspector — the test tool badge was told to trust has spec gaps

`ecosystem-09`/`11` tell badge to verify every connector with `modelcontextprotocol/inspector`. Real caveat from its own issue tracker:

| Issue | Comments | State | Why it matters for badge |
|---|---|---|---|
| [#675 The inspector does not follow the spec according to authorization scenarios](https://github.com/modelcontextprotocol/inspector/issues/675) | 18 | **OPEN** | The canonical OAuth test harness **does not fully implement the authorization spec's scenarios.** badge must NOT treat "it works in Inspector" as proof of spec-compliance — Inspector's own auth flow has gaps. Cross-check against the actual Claude Connectors flow (callback `https://claude.ai/api/mcp/auth_callback`) before declaring a connector done. |
| [#996 Fix: OAuth CORS errors when Connection Type is 'Via Proxy'](https://github.com/modelcontextprotocol/inspector/pull/996) | 25 | closed | OAuth **CORS** breakage in proxy mode — corroborates the cross-vendor "agent-driven consent redirects have different CORS needs" pattern (BA #7041 ChatGPT-redirect ACAO in `ecosystem-12`). CORS is THE recurring agent-OAuth failure across MCP Inspector, Better Auth, and ChatGPT clients. |
| [#345 support manual entry of OAuth client information](https://github.com/modelcontextprotocol/inspector/pull/345) | 28 | closed | The most-discussed Inspector change: needing to MANUALLY enter `client_id`/secret because **DCR isn't always available**. Confirms the corpus thesis that DCR-vs-pre-registered fallback is a daily reality, not an edge case. |
| [#1387 show auth response bodies with masked secrets + reveal toggle](https://github.com/modelcontextprotocol/inspector/pull/1387) | 19 | closed | Inspector now masks tokens in displayed auth responses — even the debugger treats token-leak as a first-class concern (matches `mcp-first-connectors.md` "never log tokens"). |

**badge rule:** Inspector is necessary but not sufficient for QA. Use it for the happy-path handshake; verify spec edge cases (iss validation, exact-redirect-match, refresh rotation, 401→PRM re-discovery) separately, and do a real end-to-end against Claude Connectors before shipping.

## B. MCP TypeScript SDK — the AS-vs-RS split is the hard part of client OAuth

The SDK removed server OAuth (use Better Auth etc., per `ecosystem-06`), but the CLIENT side has its own real friction:

| Issue/PR | Comments | Why it matters |
|---|---|---|
| [#416 Separate authorization server and resource server on client auth flow](https://github.com/modelcontextprotocol/typescript-sdk/pull/416) | 22 | The single biggest client-OAuth design pain: the MCP **resource server** and the **authorization server** are often DIFFERENT origins (e.g. your MCP server points `authorization_servers` at Auth0/Clerk/WorkOS). The client must discover PRM on the RS, then ASM on the *separate* AS, and bind `resource=` to the RS while talking tokens to the AS. Getting this split right is where hand-rolled clients break. |
| [#485 Composable fetch middleware for auth and cross-cutting concerns](https://github.com/modelcontextprotocol/typescript-sdk/pull/485) | 22 | Auth as fetch-middleware (inject Bearer, catch 401, refresh, retry-once) is the clean client pattern — but it wasn't there originally; people had to build it. badge's client should wrap fetch with: attach token → on 401 parse `WWW-Authenticate` → refresh/re-discover → retry once. |
| [#1710 minimal AuthProvider interface with OAuthClientProvider adapter](https://github.com/modelcontextprotocol/typescript-sdk/pull/1710) | 3 | The current client-auth abstraction (`AuthProvider` + `OAuthClientProvider` adapter) — what `ecosystem-11` names as badge's client surface. This is the seam to implement against. |

**badge rule:** when acting as an MCP client (Energy's `mcp-first-connectors.md` client role), the load-bearing complexity is the **RS≠AS discovery split** (PRM on the resource server → `authorization_servers` → ASM on that AS) and **fetch-middleware 401-refresh-retry**. Budget for these; they are the documented breakage points.

## C. Better Auth MCP plugin is being RE-PLATFORMED right now (live architectural shift)

Two issues opened **2026-06-11 (today)** signal an in-flight change badge must track:

| Issue | Opened | Signal |
|---|---|---|
| [#9992 feat(oauth-provider)!: migrate MCP plugin onto the OAuth provider](https://github.com/better-auth/better-auth/issues/9992) | 2026-06-11 | **Breaking-change marker (`!`).** Better Auth is consolidating the standalone **MCP plugin onto the `@better-auth/oauth-provider` package.** Meaning: the MCP-server-auth path in Better Auth is being unified under the OAuth 2.1 provider (the right move — one AS, MCP as a consumer of it). badge: if building on Better Auth's MCP support, expect the MCP plugin API to change and to route through `oauth-provider`. Pin and watch this issue. |
| [#9991 fix: harden session authority against stale cookie cache and unverified selectors](https://github.com/better-auth/better-auth/issues/9991) | 2026-06-11 | Active session-security hardening (stale cookie cache, unverified selectors) — reinforces the `ecosystem-12` meta-lesson that **session/security internals are still actively churning**. Another reason to pin + E2E-gate upgrades. |
| [#7373 support forced schema file generation and migration](https://github.com/better-auth/better-auth/issues/7373) | 2026-01-14 (11c, open) | Schema-migration friction (forcing `npx auth generate`) is a recurring operational pain — relevant to the "Better Auth owns the user table" complaint (BA #2202). |

**badge bottom line:** Better Auth's agent/MCP story is the right *substrate* (it's what the MCP SDK punts to) but it is **mid-refactor as of June 2026** — the MCP plugin is being folded into `oauth-provider`. Treat the MCP-specific surface as moving; the underlying `@better-auth/oauth-provider` (OAuth 2.1 + OIDC + client_credentials + DCR + introspection + revocation) is the stable thing to build against.

## D. Auth0 Token Vault — the P3 runtime mechanics (how an agent gets a 3rd-party token)

`ecosystem-05` named Token Vault as the P3 ("agent acts in user's Google/Slack") answer; here's the implementable detail (from [Auth0 docs — Token Vault](https://auth0.com/docs/secure/tokens/token-vault), accessed 2026-06-11):

- **Setup:** user authorizes a **federated/connected** provider via OAuth; "Auth0 automatically adds that connected account to the user profile" and **stores BOTH the provider's access + refresh tokens in the Vault**.
- **Runtime — three token-exchange mechanisms** (the agent exchanges its Auth0 token for the *provider's* access token):
  | Exchange | Input token | Use case |
  |---|---|---|
  | **Refresh-token exchange** | Auth0 **refresh** token | web / mobile / native apps holding a user session |
  | **Access-token exchange** | Auth0 **access** token | SPAs exchanging a token from another service |
  | **Privileged-worker exchange** | signed **JWT bearer** assertion | backend / M2M / **autonomous agent** service-to-service |
- **What the app/agent receives:** ONLY the **provider's access token** — **never the provider refresh token.** Auth0 holds and rotates the long-lived refresh token; the agent only ever sees short-lived, scoped, provider access tokens at runtime. **This IS Energy's `mcp-first-connectors.md` "no token passthrough / server holds its own provider token" rule delivered as a managed service** — Token Vault is the hosted incarnation of that exact pattern.
- **Supported connections (June 2026):** Social — Google, Microsoft, Box, Slack, GitHub, custom social; Enterprise — Google Workspace, Microsoft Entra ID (Azure AD), generic OIDC.
- **Free tier:** Auth0 for AI Agents free tier = **2 connected apps in Token Vault** + async authorization (CIBA) + core features (per `ecosystem-05`).
- **Orgs caveat:** for Auth0 Organizations, authenticate the user to the target org FIRST, then run the connected-accounts flow.

**badge rule for P3:** the "privileged-worker exchange" (signed JWT bearer assertion) is the agent/M2M path — badge's autonomous agents use that to mint a scoped Google/Slack token at runtime without ever touching the refresh token. If the task is "agent acts in the user's third-party SaaS," Token Vault is the most turnkey managed answer and maps 1:1 to the no-passthrough rule.

## E. Clerk Directory Sync (SCIM) — GA'd only April 2026 (corrects the corpus's flat claim)

`ecosystem-07` listed Clerk SCIM as a plain "yes." Reality is more current and more nuanced:

- **Clerk Directory Sync (SCIM 2.0) reached GENERAL AVAILABILITY on 2026-04-16** — i.e. it was NOT GA before mid-April 2026. (Source: [Clerk Changelog — Directory Sync (SCIM) is now generally available, 2026-04-16](https://clerk.com/changelog/2026-04-16-directory-sync).)
- **Groups + custom-attribute mapping GA'd even later — 2026-05-21**, completing the rollout. Groups mapping auto-assigns Clerk **roles** from IdP group membership (added to group → mapped role applied; removed → falls back to next mapped role). (Source: [Clerk Changelog — Groups and custom attributes mapping GA, 2026-05-21](https://clerk.com/changelog/2026-05-21-directory-sync-groups-attributes-ga).)
- **Setup (per enterprise connection):** Dashboard → SSO connections → pick the connection → Directory Sync tab → Enable SCIM → Clerk generates an **Endpoint URL + Bearer token** you paste into the IdP. (Source: [Clerk Docs — Directory Sync (SCIM)](https://clerk.com/docs/guides/configure/auth-strategies/enterprise-connections/directory-sync), accessed 2026-06-11.)
- **Pricing:** SCIM (incl. groups/custom attributes) is **included with the enterprise connection at no extra charge** — you pay for the connection (~$75/additional, per `ecosystem-13`), SCIM rides along free. (Same docs/changelog.)

**badge correction:** Clerk's SCIM is **real and free-with-connection, but only fully GA since May 2026** — months newer than WorkOS's. For a B2B harness that needed SCIM *in early 2026*, Clerk literally couldn't (GA was April). Today it can, and groups→roles mapping is a genuine convenience. WorkOS still leads on the **ordered Events API** (guaranteed in-order SCIM event processing — `ecosystem-07`), which Clerk's changelog does not claim. So: Clerk SCIM = adequate + free + new; WorkOS SCIM = the reference for ordering/reliability at high contract value.

## F. Cross-cutting agent-plane through-lines (the synthesis)
1. **CORS is the #1 agent-OAuth failure** — MCP Inspector #996, Better Auth #7041 (ChatGPT redirect), proxy-mode breakage. Agent-driven consent redirects ≠ browser logins; plan CORS explicitly for the AS consent + callback origins.
2. **DCR-vs-pre-registered fallback is daily reality** — Inspector #345 (manual client entry) is one of its most-discussed PRs. Always support pre-registered `client_id` fallback; prefer CIMD where the AS supports it (`ecosystem-06`).
3. **RS≠AS discovery split is the hard client problem** — MCP SDK #416. PRM on the resource server → `authorization_servers` → ASM on a possibly-different AS; bind `resource=` to the RS.
4. **Everything is mid-flight** — Better Auth folding MCP into oauth-provider (today), authkit-nextjs 2 majors in 5 weeks, MCP spec RC (2026-07-28) adding `iss` validation. The agent plane is NOT settled; pin everything and re-verify on upgrade.
5. **The "no refresh-token-to-the-agent" rule is becoming product** — Auth0 Token Vault returns only provider access tokens; this is `mcp-first-connectors.md` as a service. Expect WorkOS/Stytch to ship equivalents.

## Sources
- gh api search/issues across modelcontextprotocol/{typescript-sdk,inspector}, better-auth/better-auth, stytchauth/stytch-node (accessed 2026-06-11)
- https://github.com/modelcontextprotocol/inspector/issues/675 (open, accessed 2026-06-11)
- https://github.com/modelcontextprotocol/typescript-sdk/pull/416 (accessed 2026-06-11)
- https://github.com/better-auth/better-auth/issues/9992 (opened 2026-06-11)
- https://github.com/better-auth/better-auth/issues/9991 (opened 2026-06-11)
- https://auth0.com/docs/secure/tokens/token-vault (accessed 2026-06-11)
- https://clerk.com/changelog/2026-04-16-directory-sync (accessed 2026-06-11 via search index)
- https://clerk.com/changelog/2026-05-21-directory-sync-groups-attributes-ga (accessed 2026-06-11 via search index)
- https://clerk.com/docs/guides/configure/auth-strategies/enterprise-connections/directory-sync (accessed 2026-06-11)
