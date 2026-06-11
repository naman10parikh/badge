---
type: research
domain: auth
tool: MCP OAuth 2.1 spec
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# MCP OAuth 2.1 — June 2026 state of the art (CURRENCY-CRITICAL)

## ⚠️ The internal corpus is one revision behind
Energy's `mcp-first-connectors.md` rule and `2026-04-17_mcp_oauth_briefing.md` both target the **2025-06-18** MCP authorization spec. **As of June 2026 the latest STABLE spec is 2025-11-25**, and a **2026-07-28 release candidate** exists. badge must implement to **2025-11-25** (and be aware of the RC), not 2025-06-18. The 06-18 fundamentals (PKCE S256, RFC 8707, DCR, refresh rotation) all still hold — but there are important additions and one relaxation.
- Source: [MCP 2025-11-25 changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog) (accessed 2026-06-10).

## What carried over UNCHANGED from 2025-06-18 (still MUST)
- **PKCE S256 — MUST.** `code_verifier` 43-128 chars; `code_challenge = BASE64URL(SHA256(verifier))`; `plain` banned.
- **Resource Indicator RFC 8707 — MUST.** `resource=<canonical-MCP-URL>` on BOTH `/authorize` and `/token`. Canonical = lowercase scheme/host, no fragment, prefer no trailing slash. Confused-deputy / audience-binding defense.
- **Refresh token rotation — MUST** for public clients (OAuth 2.1 §4.3.1). Detect reuse → revoke chain.
- **No token passthrough — MUST NOT.** An MCP server must NOT forward the client-issued token to a downstream third party; it uses its own stored creds.
- **HTTPS everywhere except localhost; exact redirect-URI match; short-lived audience-bound access tokens.**
- 401 → `WWW-Authenticate: Bearer resource_metadata="..."` ; 403 = insufficient scope ; 400 = malformed.

## What CHANGED / was ADDED in 2025-11-25 (the deltas badge must know)

| # | Change | SEP / PR | What it means for badge |
|---|--------|----------|-------------------------|
| 1 | **OpenID Connect Discovery 1.0 support** for AS discovery | PR #797 | Client can use OIDC `.well-known/openid-configuration` in addition to RFC 8414 ASM. Broadens which IdPs "just work." |
| 2 | **Incremental scope consent via `WWW-Authenticate`** | SEP-835 | On 403/insufficient-scope, server signals the *additional* scopes needed in `WWW-Authenticate`; client re-authorizes for ONLY the delta (step-up), not a full re-grant. badge connectors should parse this and do minimal step-up. |
| 3 | **CIMD — OAuth Client ID Metadata Documents as RECOMMENDED registration** | SEP-991 / PR #1296 | The big one. Client's `client_id` IS an HTTPS URL pointing to a JSON metadata doc the client hosts. Server fetches + caches it. Decentralized identity, NO prior coordination, NO unbounded DCR database. **CIMD is now the recommended registration mechanism over raw DCR.** |
| 4 | **PRM discovery aligned to RFC 9728 — `WWW-Authenticate` now OPTIONAL** with fallback to `.well-known` | SEP-985 | RELAXATION: a client can discover PRM by trying `/.well-known/oauth-protected-resource` directly even if the 401 didn't carry the header. Don't hard-depend on the header existing. |
| 5 | **HTTP 403 for invalid `Origin` headers** in Streamable HTTP | PR #1439 | DNS-rebinding defense; servers MUST 403 bad Origins. |
| 6 | **Security Best Practices guidance updated** | — | Re-read [/specification/draft/basic/security_best_practices] before shipping. |

Source for the whole table: [MCP 2025-11-25 changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog) (accessed 2026-06-10).

### CIMD in one paragraph (because it changes the connector design)
With DCR (RFC 7591), every client POSTs to `/register` and the AS must persist a row → unbounded DB growth + spam surface. With **CIMD (SEP-991)**, the client hosts a static JSON at e.g. `https://app.example.com/oauth-client.json` and passes THAT URL as its `client_id`. The AS fetches the doc at runtime (with caching) to learn `redirect_uris`, `client_name`, etc. No write, no DB row, no coordination. This is the same idea WorkOS's `auth.md` `identity_assertion` and Energy's `mcp-first-connectors.md` "DCR > CIMD > pre-registered" line gesture at — but as of Nov 2025 CIMD is officially RECOMMENDED. **badge should prefer CIMD where the AS supports it, fall back to DCR, then pre-registered.**
- Corroboration: [kane.mx — MCP OAuth SEP-991 Simplifies Client Registration](https://kane.mx/posts/2025/mcp-oauth-sep-991-simplified-registration/) (2025); [Den Delimarsky — What's New in the 2025-11-25 MCP Authorization Spec](https://den.dev/blog/mcp-november-authorization-spec/) (accessed 2026-06-10).

## 2026-07-28 Release Candidate — auth changes (published 2026-05-21)
Forward-looking; not yet stable, but badge should track:
| Change | SEP | Detail |
|--------|-----|--------|
| **Issuer (`iss`) validation per RFC 9207** | SEP-2468 | Clients MUST validate the `iss` param on authorization responses. "low-cost mitigation for a class of mix-up attack that is more prevalent in MCP's single-client, many-server deployment pattern." Future versions will REQUIRE rejecting responses that omit `iss`. |
| **`application_type` declaration in DCR** | SEP-837 | Clients declare `application_type` (e.g. `native`) so AS don't default CLI/desktop clients to `"web"` and wrongly reject localhost redirect URIs. Directly fixes a real Claude-Desktop-class bug. |
| **Credentials bound to issuer** | SEP-2352 | Registered creds bound to the issuing AS `issuer`; on resource migration between AS, client MUST re-register. |
| **Refresh-token requests from OIDC-style AS documented** | SEP-2207 | — |
| **Scope accumulation during step-up clarified** | SEP-2350 | pairs with SEP-835. |
| **`.well-known` discovery suffix clarified** | SEP-2351 | — |
- Source: WebFetch of [The 2026-07-28 MCP Specification Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) (published 2026-05-21; accessed 2026-06-10).

## The removed-from-SDK gotcha (still true, still important)
`ProxyOAuthServerProvider` and ALL server-side OAuth exports (`mcpAuthRouter`, `OAuthServerProvider`, `OAuthTokenVerifier`, `requireBearerAuth`, `authenticateClient`, `allowedMethods`) were **REMOVED from the MCP TypeScript SDK**. The SDK now tells you to use an external auth library (it names **better-auth**). The CLIENT-side OAuth helpers (`OAuthClientProvider`, `handleOAuthUnauthorized`, `extractWWWAuthenticateParams`) remain.
- Source: internal `2026-04-17_mcp_oauth_briefing.md` §Sources (cites TS SDK `docs/migration.md`). Implication: do NOT expect the SDK to broker server OAuth — pick Better Auth / Stytch / WorkOS / Auth0 / your own.

## badge implementation checklist (2025-11-25 baseline)
1. PKCE S256 (carry-over). 2. `resource=` on authorize+token (carry-over). 3. **Prefer CIMD, then DCR, then pre-registered.** 4. PRM via `.well-known` even without `WWW-Authenticate` header (SEP-985). 5. Parse `WWW-Authenticate` for incremental-scope step-up (SEP-835). 6. Refresh rotation + reuse detection (carry-over). 7. Validate `aud` = your canonical URI (carry-over). 8. 403 on bad Origin (Streamable HTTP). 9. (RC-ready) validate `iss` per RFC 9207. 10. Never log tokens; never in URL query.

## Sources
- https://modelcontextprotocol.io/specification/2025-11-25/changelog (accessed 2026-06-10)
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization (baseline)
- https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ (2026-05-21)
- https://den.dev/blog/mcp-november-authorization-spec/ (accessed 2026-06-10)
- https://kane.mx/posts/2025/mcp-oauth-sep-991-simplified-registration/ (2025)
- https://www.descope.com/blog/post/mcp-auth-spec (accessed 2026-06-10)
- internal: ~/energy/resources/read/2026-04-17_mcp_oauth_briefing.md
- internal: ~/energy/.claude/rules/mcp-first-connectors.md
