---
type: research
domain: auth
tool: Stytch Connected Apps
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Stytch Connected Apps — June 2026 state of the art

## What it is
**Connected Apps** is Stytch's purpose-built **OAuth-2.1-for-agents / MCP** layer. It can run as a **standalone authorization layer ON TOP of an existing CIAM/IdP** (you keep your current login; Stytch becomes just the OAuth AS that issues agent tokens), or be embedded directly into your MCP server. This "standalone" framing is its key differentiator: you don't have to rip out Clerk/Auth0/your-own-auth to add agent OAuth.
- Source: [Connected Apps standalone](https://stytch.com/blog/connected-apps-standalone/), [stytch.com/connected-apps](https://stytch.com/connected-apps) (accessed 2026-06-10).
- Independent ranking: listed among "Best Authentication Platforms for AI Agents and MCP Servers in 2026." Source: [MarkTechPost 2026-05-25](https://www.marktechpost.com/2026/05/25/best-authentication-platforms-for-ai-agents-and-mcp-servers-in-2026/).

## The OAuth 2.1 flow it implements (MCP-compliant)
Follows **RFC 9728 (PRM)** + **RFC 8414 (ASM)** — i.e. the same MCP OAuth substrate as the spec. Sequence:
1. MCP server validates JWT via **"Introspect Access Token"** API (or local JWKS).
2. **PRM** at `/.well-known/oauth-protected-resource` (resource URI, authorization_servers, scopes_supported).
3. **ASM** at `/.well-known/oauth-authorization-server` (Stytch publishes endpoints).
4. **DCR** — OPT-IN, enabled in dashboard. Clients POST to the registration endpoint; Stytch returns `client_id`, marking "Third Party Public" clients.
5. **Consent** — client redirects to `authorization_endpoint` with PKCE params.
6. **Consent grant** — Identity component validates the request, prompts member for consent, issues auth code.
7. **Token exchange** at `token_endpoint` → access + refresh tokens.
8. **Resource access** — Bearer token to MCP server.
- Source: WebFetch of [Stytch — Remote MCP Server Authorization overview](https://stytch.com/docs/guides/connected-apps/mcp-server-overview) (accessed 2026-06-10).

## Concrete endpoints (Stytch as AS)
- Authorize: `https://{domain}/oauth/authorize`
- Token: `https://{domain}/v1/oauth2/token`
- Register (DCR): `https://{domain}/v1/oauth2/register`
- JWKS: `https://{domain}/.well-known/jwks.json`

## Tokens & scopes
- Access tokens = JWT, **RS256**. Refresh tokens = bearer, **3600s** expiry.
- Scopes inferred from `scopes_supported` in PRM. Examples: `openid`, `email`, `profile`, plus custom (`manage:project_data`, `manage:project_data`). Token claims include `sub`.
- Each MCP client gets a unique `client_id` (pre-registered for enterprise OR auto via DCR). "Each agent gets its own identity and credentials, preventing token reuse or spoofing." (verbatim from search snippet, accessed 2026-06-10).

## SDK / framework surface (what a builder actually wires)
- Backend: `stytch` (npm), method `client.idp.introspectTokenLocal(token)`.
- Next.js: `mcp-handler` + `@hono/stytch-auth`.
- FastMCP (Python): `BearerAuthProvider` with JWKS URI validation.
- Hono: `@hono/stytch-auth`.
- Consent UI components: `<IdentityProvider />` (`@stytch/react`), `<B2BIdentityProvider />` (`@stytch/react/b2b`) — host the authorization endpoint and prompt for consent. Member/user must be logged in before consenting.
- DCR API refs: B2B + Consumer "connected-apps/application-management/dynamic-client-registration".

## Org-level controls
Admin org-level policy controls + human-in-the-loop approvals; full consent lifecycle management (drop-in UI). Source: [stytch.com/connected-apps](https://stytch.com/connected-apps) (accessed 2026-06-10).

## Honest take for badge
- **Best fit:** you already have auth and just need to add **standards-correct OAuth for MCP/agents WITHOUT replacing your IdP**. This is the cleanest "bolt agent-OAuth onto an existing app" option in the market — it's the most MCP-spec-literal of the hosted vendors (PRM/ASM/DCR/PKCE all present, RS256 JWT, JWKS).
- **vs WorkOS auth.md:** Stytch solves "agent gets a token to call my MCP server" (the OAuth dance). WorkOS auth.md solves the EARLIER "agent with no identity registers + a human claims it." They're complementary, not the same problem. badge should know: if the question is "remote MCP server authorization," Stytch is the most turnkey; if it's "agent identity bootstrap + ownership," auth.md.
- **vs Better Auth agent-auth:** Stytch = hosted + MCP-OAuth-native; Better Auth = self-host + a competing `agent-configuration` protocol. For Energy's `mcp-first-connectors.md` (which IS MCP OAuth 2.1), Stytch is the more directly aligned hosted broker.
- **Watch-outs:** DCR is opt-in (must enable in dashboard) — if you forget, Claude Connectors' auto-registration fails. 3600s refresh expiry is short; confirm rotation behavior. Hosted = your consent/token plane lives at Stytch.

## Sources
- https://stytch.com/docs/guides/connected-apps/mcp-server-overview (accessed 2026-06-10)
- https://stytch.com/docs/guides/connected-apps/mcp-servers (accessed 2026-06-10)
- https://stytch.com/blog/connected-apps-standalone/ (accessed 2026-06-10)
- https://stytch.com/blog/agent-to-agent-oauth-guide/ (accessed 2026-06-10)
- https://stytch.com/blog/mcp-oauth-dynamic-client-registration/ (accessed 2026-06-10)
- https://stytch.com/connected-apps (accessed 2026-06-10)
- https://www.marktechpost.com/2026/05/25/best-authentication-platforms-for-ai-agents-and-mcp-servers-in-2026/ (2026-05-25)
