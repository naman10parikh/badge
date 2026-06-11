---
type: research
domain: auth
topic: machine/agent identity + session vs JWT
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Machine / agent identity + session-vs-JWT — June 2026

## The four distinct "agent identity" problems (do not conflate — this is the key mental model)
The field looks confusing until you separate the problems. Each vendor leads with a different one:

| Problem | One-line | Canonical answer(s) June 2026 |
|---------|----------|-------------------------------|
| **P1. Agent → MY MCP server** | agent already has an identity; get a scoped token to call my server | Stytch Connected Apps; Better Auth OAuth-2.1-Provider plugin; raw MCP OAuth 2.1 |
| **P2. Agent identity bootstrap + human ownership** | agent has NO identity here; register it AND let a human vouch | **WorkOS `auth.md`** (identity_assertion / anonymous + claim ceremony) |
| **P3. Agent → THIRD-PARTY SaaS on a user's behalf** | agent must act in the user's Google/Slack without holding those creds | **Auth0 Token Vault** (OAuth Token Exchange); per-provider remote MCP servers (the `mcp-first-connectors.md` pattern) |
| **P4. Capability-scoped autonomous agents (self-host)** | own-your-stack agent identity + capability grants + approvals | **Better Auth `agent-auth`** plugin (Agent Auth Protocol) |

badge's first move on any "auth for agents" task: **classify it as P1/P2/P3/P4.** The wrong vendor for the wrong P is the #1 architecture error.

## Machine-to-machine (M2M) — the classic, pre-agent layer
- **Client Credentials grant** (OAuth 2.0 `grant_type=client_credentials`) is still the baseline for service-to-service (no user). Every IdP supports it (Auth0, WorkOS, Clerk machine tokens, Stytch).
- **Clerk Machine Authentication** offers machine tokens / API keys / OAuth tokens, JWT-vs-opaque trade-off (see `ecosystem-01-clerk.md`).
- **The 2026 shift:** agents are NOT pure M2M (no user) NOR pure user-auth — they're a THIRD mode: "acting on behalf of a user, but autonomously, with their own identity." That's why Client Credentials alone is insufficient and why P1-P4 above exist. The identity model that's winning: **the agent is its own OAuth client with its own `client_id`, acting on-behalf-of a user via scoped, time-limited, revocable tokens** (Stytch's framing; corroborated by Auth0 Token Vault + CIBA).
- Source: [Stytch agent-to-agent OAuth guide](https://stytch.com/blog/agent-to-agent-oauth-guide/) (2025-08-18): "Use Authorization Code + PKCE for all public clients (agents); the implicit grant is deprecated. The agent is the OAuth client; the user grants scoped permissions through explicit consent. Tokens are scoped, time-limited, and revocable."

## On-behalf-of vs autonomous (the identity axis)
- **On-behalf-of (delegated):** token carries the user's `sub`; agent acts AS the user within granted scopes. Most consumer agent use-cases. Better Auth agent-auth calls this `delegated` mode.
- **Autonomous:** agent has its OWN principal, not impersonating a user. Better Auth calls this `autonomous` mode. Needed for agents that own resources / earn money / run unattended (directly relevant to Energy's earning agents).
- **Sub-agent derivation:** Agent Auth Protocol v2 (in design) adds "sub-agent derivation" — a parent agent minting scoped identities for child agents. This is the recursive-grid analog at the identity layer; badge should track it. Source: agentauthprotocol.com (accessed 2026-06-10).

## Session vs JWT — the 2026 consensus (with an agent twist)
- Sessions = **stateful, instantly revocable, need a store** (Redis). JWT = **stateless, no store, hard to revoke**.
- **2026 default for first-party web apps:** server sessions in Redis + HTTP-only cookies. Logout/invalidation is instant. Source: [businesscompass — Session vs JWT 2026](https://blogs.businesscompassllc.com/2026/02/session-based-auth-vs-jwt-tokens.html) (2026-02); [rune.codes JWT vs Session 2026](https://rune.codes/hub/authentication/jwt-vs-session-authentication-beginners-guide-choosing-2026) (accessed 2026-06-10).
- **2026 default for APIs / mobile / AGENTS:** short-lived JWT access token (~15 min) + long-lived refresh token, **refresh token stored server-side as a session for revocation**. Hybrid. The primary access token stays stateless (fast verification on the hot path); statefulness is pushed to the refresh token only.
- **Why this matters for agents specifically:** agents are long-running and high-frequency. The danger quote: "a 30-day JWT after a stolen laptop is 30 days of access." For agents that can be compromised, you MUST be able to revoke — so the hybrid (short JWT + revocable server-side refresh) is the right default, NOT long-lived JWTs. Clerk's opaque-token option and the MCP refresh-rotation MUST exist for exactly this reason.
- **Common mistake to flag:** JWT in `localStorage` (XSS-readable). For agents the analog is logging the token or putting it in a URL — both banned by `mcp-first-connectors.md`.

## badge defaults (synthesized)
1. Classify the problem P1-P4 first.
2. First-party human web app → **server session + HTTP-only cookie** (Redis), not JWT.
3. Agent / API token → **short-lived JWT (mins) + server-side revocable refresh, rotated** (OAuth 2.1 §4.3.1).
4. Agent identity → **own `client_id`, Authorization Code + PKCE, scoped/time-limited/revocable**, on-behalf-of by default, autonomous only when the agent owns resources.
5. Never long-lived JWT for anything compromisable. Never token in localStorage / URL / logs.

## Sources
- https://stytch.com/blog/agent-to-agent-oauth-guide/ (2025-08-18)
- https://blogs.businesscompassllc.com/2026/02/session-based-auth-vs-jwt-tokens.html (2026-02)
- https://rune.codes/hub/authentication/jwt-vs-session-authentication-beginners-guide-choosing-2026 (accessed 2026-06-10)
- https://www.loginradius.com/blog/identity/jwt-vs-session-based-authentication (accessed 2026-06-10)
- https://agentauthprotocol.com/ (accessed 2026-06-10)
- internal: ~/energy/.claude/rules/mcp-first-connectors.md
