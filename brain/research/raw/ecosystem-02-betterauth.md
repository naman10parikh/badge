---
type: research
domain: auth
tool: Better Auth + Agent Auth plugin
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Better Auth — June 2026 state of the art

## What it is
Better Auth is the **framework-agnostic, self-hosted, own-your-database** TypeScript auth library. You run it; your user/session/account tables live in YOUR Postgres/MySQL/SQLite via its adapter. This is the structural opposite of Clerk/Auth0/WorkOS (hosted, your data at the vendor).

Crucial endorsement for badge's MCP work: the **MCP TypeScript SDK now recommends Better Auth** for server-side OAuth after `ProxyOAuthServerProvider` and all server OAuth exports (`mcpAuthRouter`, `OAuthServerProvider`, `requireBearerAuth`, etc.) were REMOVED from the SDK. "use an external auth library (e.g., `better-auth`)."
- Source: internal `~/energy/resources/read/2026-04-17_mcp_oauth_briefing.md` §Sources (cites the TS SDK `docs/migration.md`).

## OAuth 2.1 Provider plugin
Better Auth ships an **OAuth 2.1 Provider plugin** — lets your app BE an OAuth/OIDC authorization server (issue tokens, run authorize/token endpoints, support PKCE). This is what makes it viable as the AS behind an MCP resource server.
- Source: [OAuth 2.1 Provider | Better Auth](https://better-auth.com/docs/plugins/oauth-provider) (accessed 2026-06-10).

## Agent Auth plugin (`@better-auth/agent-auth`) — THE notable 2026 thing

Status: **"implementation of a standard on heavy development. Not yet stable and may change."** (verbatim, [Agent Auth | Better Auth](https://better-auth.com/docs/plugins/agent-auth), accessed 2026-06-10).

It makes your Better Auth server an **Agent Auth provider** implementing the **Agent Auth Protocol** ([agentauthprotocol.com](https://agentauthprotocol.com/)). Repo: [github.com/better-auth/agent-auth](https://github.com/better-auth/agent-auth); protocol repo: [github.com/better-auth/agent-auth-protocol](https://github.com/better-auth/agent-auth-protocol).

Positioning (verbatim): "Agent Auth is NOT meant to compete with or replace OAuth... OAuth solves a different problem (letting a user grant a third-party app access to their resources), while Agent Auth is a single protocol purpose-built for agent identity, registration, capabilities, and discovery."

### The flow (5 steps)
1. Agent discovers provider via `/.well-known/agent-configuration`.
2. Agent lists capabilities (`GET /capability/list`) and determines requirements.
3. Agent registers and requests capability grants.
4. User approves via **device authorization** or **CIBA** (backchannel).
5. Agent signs **short-lived JWTs** and invokes capabilities.

### Discovery document (`/.well-known/agent-configuration`)
Fields: `issuer` (base URL), `endpoints` (absolute route URLs, e.g. execute at `POST /capability/execute`), `default_location` (URL agents use as JWT `aud` when a capability has no custom URL). Retrieve server-side via `auth.api.getAgentConfiguration()`.

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/capability/execute` | default capability invocation |
| GET | `/capability/list` | list capabilities |
| GET | `/.well-known/agent-configuration` | discovery doc |
| GET | `/agent/session` | verify agent JWT, resolve session |

### JWT structure (agent-signed, short-lived)
- `aud` — MUST match the invocation URL (capability `location` or `default_location`).
- `jti` — replay protection.
- `capabilities` — array of granted capability names.
- standard expiry validation.

### Capability model
A capability = `{ name, description, input (optional JSON Schema), location (optional custom URL) }`. If `location` is set, the agent calls THAT directly and `onExecute` does NOT run — you handle it in your route via `auth.api.getAgentSession({ headers })` or `verifyAgentRequest(request, auth)`.

Agent session resolution gives `{ user (delegated|autonomous), agent (id,name,mode,capabilityGrants,metadata), host }`.

### Config options (the real surface)
`providerName`, `providerDescription`, `modes` (`["delegated","autonomous"]`), `capabilities`, `onExecute`, `approvalMethods` (`["device_authorization","ciba"]`), `deviceAuthorizationPage`, `defaultHostCapabilities`, `requireAuthForCapabilities`, `trustProxy` (honor `X-Forwarded-Proto` for `aud` validation), `onEvent` (audit hook).

### Install / setup
```bash
npm install @better-auth/agent-auth
npm install @auth/agent @auth/agent-cli   # optional client + CLI
```
```ts
import { agentAuth } from "@better-auth/agent-auth";
export const auth = betterAuth({
  plugins: [ agentAuth({
    providerName: "...",
    capabilities: [...],
    async onExecute({ capability, arguments: args, agentSession }) { /* ... */ }
  })]
});
// app/.well-known/agent-configuration/route.ts
const configuration = await auth.api.getAgentConfiguration();
return NextResponse.json(configuration);
```
Migrations: `npx auth migrate` (or `npx auth generate`).

### Nice extras
- **OpenAPI adapter**: `createFromOpenAPI(spec, opts)` auto-generates one capability per `operationId`. Options: `baseUrl`, `resolveHeaders`, `defaultHostCapabilities` (e.g. `["GET","HEAD"]`), `approvalStrength` (`{ GET:"session", POST:"webauthn" }`), `location`. Lower-level: `fromOpenAPI(spec)` → `Capability[]`, `createOpenAPIHandler(spec, opts)` → `onExecute` proxy.
- **MCP adapter**: exposes agent-auth as MCP tools for any MCP-compatible agent.
- **`@auth/agent-cli`**: a CLI for agents to drive the flow (register/list/execute) — directly relevant to badge's "what an agent operator needs."

### Protocol version
Agent Auth Protocol **v1.0 published**; **v2.0 in active design** — "grant-centric redesign covering capability-scoped grants, host attestation for first-contact, sub-agent derivation, and a normalized approval envelope."
- Source: WebSearch result quoting [agentauthprotocol.com](https://agentauthprotocol.com/) / GitHub (accessed 2026-06-10).

## Honest take for badge
- **Best fit:** when you need to OWN the data (compliance, no-vendor-lock, self-host), or when you need your app to BE the OAuth AS / MCP authorization server. It's the recommended substrate for hand-built MCP servers now that the MCP SDK punted server OAuth to external libs.
- **Agent plane:** `agent-auth` is the most *open/self-hostable* agent-identity option (vs Stytch hosted, vs WorkOS hosted). BUT it's explicitly UNSTABLE and a competing *protocol* to MCP OAuth — it's `agent-configuration`-discovery + agent-signed JWTs, NOT the MCP `oauth-protected-resource` + DCR path. So choosing it is a bet on the Agent Auth Protocol winning, which is NOT guaranteed.
- **Tension with Energy's `mcp-first-connectors.md`:** that rule commits Energy to MCP OAuth 2.1 (PRM/ASM/DCR/PKCE/8707). Better Auth's `agent-auth` is a *different* discovery surface (`.well-known/agent-configuration`, agent-self-signed JWTs). badge must flag this: Better Auth's OAuth-2.1-Provider plugin IS MCP-OAuth-compliant; its agent-auth plugin is a SEPARATE, newer, competing model. Don't conflate them.
- **Maturity risk:** "heavy development, not stable" + a v2 redesign in flight = do not build production on agent-auth without pinning and expecting churn.

## Sources
- https://better-auth.com/docs/plugins/agent-auth (accessed 2026-06-10)
- https://better-auth.com/docs/plugins/oauth-provider (accessed 2026-06-10)
- https://github.com/better-auth/agent-auth (accessed 2026-06-10)
- https://github.com/better-auth/agent-auth-protocol (accessed 2026-06-10)
- https://agentauthprotocol.com/ (accessed 2026-06-10)
- internal: ~/energy/resources/read/2026-04-17_mcp_oauth_briefing.md
