---
type: research
domain: auth
topic: what an AGENT (not a human) operating these tools needs
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Agent-operator notes — CLIs, APIs, MCP servers for the AUTH domain

This is the badge-specific lens: badge is an AGENT employee. What can an agent actually DRIVE (not click)? CLIs that work headless, APIs, and MCP servers that exist FOR agents. All accessed 2026-06-10.

## CLIs an agent can drive headless

### WorkOS CLI (`workos/cli`, 51★, pushed 2026-06-10) — THE standout for agents
- **AI-powered, explicitly agent-mode.** README: "automatically integrates WorkOS AuthKit into your app," "Uses Claude to intelligently adapt to your project structure."
- **"Agent & CI Ready":** non-TTY auto-detection, `--json` output, structured errors, headless installer with **NDJSON streaming**, and `WORKOS_MODE=agent` for deterministic automation.
- Commands an agent uses: `install` (`--api-key`, `--client-id`, headless flags), `seed` (declarative YAML resource provisioning), `setup-org`, `onboard-user`, `debug-sso`, `debug-sync`, plus resource CRUD (org/user/role/permission). `--json` everywhere.
- Supports 15 frameworks (Next.js, React Router, TanStack Start, SvelteKit, Express, Django, Rails, Go, ASP.NET, Spring Boot, Phoenix, Laravel...).
- **badge takeaway:** this is the most agent-native auth tool shipped by any vendor — an agent can scaffold + configure WorkOS auth end-to-end with deterministic JSON/NDJSON. Use `WORKOS_MODE=agent`.
- Source: WebFetch [github.com/workos/cli](https://github.com/workos/cli) (accessed 2026-06-10).

### Better Auth CLI (`@auth/agent-cli` + core `npx auth`)
- Core: `npx auth migrate` / `npx auth generate` (schema), driveable headless.
- **`@auth/agent-cli`** — a CLI specifically for AGENTS to drive the Agent Auth flow (register / list capabilities / execute). Pairs with `@auth/agent` client. This is the client-side counterpart to the `@better-auth/agent-auth` server plugin.
- Source: [Better Auth agent-auth docs](https://better-auth.com/docs/plugins/agent-auth) (accessed 2026-06-10).

### Clerk
- No first-class "agent mode" CLI. `npx @clerk/upgrade` exists (codemod tool for version migration) — useful but human-migration-oriented, not an agent-runtime tool.

## MCP servers / SDKs that EXIST for agents in this domain

### The MCP-server-AS brokers (an agent connects via these)
- **Stytch Connected Apps** — an agent (Claude, ChatGPT) hits a Stytch-protected MCP server: DCR at `https://{domain}/v1/oauth2/register` (opt-in), authorize, token at `/v1/oauth2/token`, JWKS at `/.well-known/jwks.json`. Backend verifies with `client.idp.introspectTokenLocal(token)` or JWKS. Frameworks: `mcp-handler` + `@hono/stytch-auth` (Next/Hono), FastMCP `BearerAuthProvider` (Python). The agent just speaks MCP OAuth; Stytch is the AS.
- **Better Auth MCP adapter** — the agent-auth plugin "exposes agent auth as MCP tools for any MCP-compatible AI agent discovery and execution." So an agent can discover+invoke capabilities as MCP tools.
- **WorkOS auth.md** — provider-neutral; an agent that "can read your auth.md" can self-register via `POST /agent-auth` after discovering the `agent_auth` block in `/.well-known/oauth-protected-resource`, then complete a claim ceremony. No vendor SDK required on the agent side — it's HTTP + the spec.

### MCP client OAuth (what the AGENT side uses to authenticate to ANY MCP server)
- **MCP TypeScript SDK** (`modelcontextprotocol/typescript-sdk`, 12,644★) ships the CLIENT helpers: `OAuthClientProvider`, `handleOAuthUnauthorized`, `extractWWWAuthenticateParams`. (Server-side OAuth was removed — use Better Auth/Stytch/WorkOS/Auth0 as the AS.) This is what badge uses when ACTING AS an MCP client connecting out.
- **MCP Inspector** (`modelcontextprotocol/inspector`, 10,049★) — an agent/dev can drive the full OAuth handshake to TEST a server. badge should use it to verify any connector it builds.

### Auth0 for AI Agents (agent-runtime APIs)
- **Token Vault** — agent calls Auth0 at runtime to get a scoped third-party token (Token Exchange) WITHOUT holding the provider refresh token. The agent never sees raw creds.
- **CIBA** — agent triggers an async human-approval (backchannel) before a sensitive action; agent polls/awaits the grant.
- Integrates with Amazon Bedrock AgentCore (agent-runtime context).

## What badge (as an agent) needs to KNOW operationally
1. **Discovery is HTTP, not SDK.** Every modern path starts with `GET /.well-known/oauth-protected-resource` (PRM) → AS metadata. An agent can do this with plain fetch — no vendor lock to discover.
2. **Prefer `--json`/NDJSON/agent-mode flags.** WorkOS CLI `WORKOS_MODE=agent` is the gold standard; demand deterministic machine output, never parse human TTY.
3. **Token hygiene is enforced by spec, not optional.** Never log tokens, never put them in URLs (Authorization header only), rotate refresh tokens, validate `aud`=your canonical URI. (Matches `mcp-first-connectors.md` lines exactly.)
4. **CIMD lets an agent register WITHOUT a write.** Host a static client-metadata JSON at an HTTPS URL, pass that URL as `client_id` (SEP-991). Cleaner than DCR for an agent that can host a file.
5. **Classify the task P1-P4** (see `ecosystem-08`) before picking a tool — the agent's job is identity-shaped routing, not feature matching.
6. **Test with MCP Inspector** before declaring a connector done (dogfood / QA-zero-tolerance).

## badge tooling shortlist (install/use these)
- `workos/cli` with `WORKOS_MODE=agent` — scaffold/configure/debug auth headlessly.
- `@better-auth/agent-auth` + `@auth/agent-cli` — self-host agent identity + agent-side CLI.
- MCP TS SDK client OAuth helpers — for badge acting as an MCP client.
- MCP Inspector — for verifying any server badge builds.
- Auth0 Token Vault API + CIBA — when the task is P3 (act in user's third-party SaaS).

## Sources
- https://github.com/workos/cli (accessed 2026-06-10)
- https://better-auth.com/docs/plugins/agent-auth (accessed 2026-06-10)
- https://github.com/modelcontextprotocol/typescript-sdk (accessed 2026-06-10)
- https://github.com/modelcontextprotocol/inspector (accessed 2026-06-10)
- https://stytch.com/docs/guides/connected-apps/mcp-server-overview (accessed 2026-06-10)
- https://auth0.com/ai (accessed 2026-06-10)
