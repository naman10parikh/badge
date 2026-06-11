---
type: research
domain: auth
tool: Auth0 (Okta) — primarily as migration SOURCE
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Auth0 — June 2026 (mostly as the thing people MIGRATE OFF, plus Auth0 for AI Agents)

## Why badge treats Auth0 mainly as a migration SOURCE
Auth0 (owned by Okta) is the incumbent enterprise IdP. The 2025-2026 narrative is **migration AWAY** from it, driven by two complaints repeated across every comparison page:
1. **Per-MAU pricing that scales painfully**, and
2. **SSO locked behind enterprise plans — "$1,500+/mo"** (every B2B SaaS with 5-10 SSO customers finds WorkOS dramatically cheaper).
- Source: [WorkOS — Top 5 Auth0 alternatives in 2025](https://workos.com/blog/auth0-alternatives-2025); [WorkOS vs Auth0](https://workos.com/compare/auth0) (accessed 2026-06-10).
- WorkOS's own number for the alternative: SSO/SCIM at **$125/connection/month** with volume discounts vs Auth0's enterprise gate.

### Migration playbook (the standard pattern badge should know)
- **Strangler-fig / incremental:** stand up the new IdP (WorkOS or Clerk) for a SUBSET first (new signups, or % of traffic), leave existing Auth0 flows intact, monitor for edge cases, expand until Auth0 is fully phased out. WorkOS publishes a step-by-step Auth0 migration guide (map identities → logic → flows → fill feature gaps).
- **Password-hash export caveat:** moving users off Auth0 with their password hashes requires an Auth0 support request (bulk hash export is gated) — a classic migration blocker. (Flagged: could not re-confirm the exact 2026 export policy from a primary Auth0 doc this pass — see GAPS.)
- **Better Auth migration friction (real-world):** the recurring complaint is "Better Auth really wants to own the user table, which NextAuth/Auth0 never forced." Migrating to a self-host lib means adopting ITS schema. Source: search snippet citing a "Migrating to Better Auth ... nightmare" thread (accessed 2026-06-10).

## Auth0 for AI Agents (now GA — the part badge should NOT dismiss)
Auth0 went hard on the agent plane and it is **generally available** as of 2026.
- **Token Vault** — securely connects AI agents to third-party apps (Google, Slack, etc.) using the **Token Exchange** standard, so the agent NEVER holds/sees the provider's raw refresh token. Token Vault manages the full token lifecycle; the agent requests API access at runtime. This is Auth0's answer to "agent needs to call Gmail on the user's behalf without holding Gmail creds."
- **Async authorization via CIBA** (Client-Initiated Backchannel Authentication) — human-in-the-loop: pauses the agent's sensitive action until the user approves on another trusted device.
- **Free tier:** 2 connected apps in Token Vault + async authorization + core features.
- Recognition: "Most Innovative AI Infrastructure Security Solution 2026."
- Integrates with Amazon Bedrock AgentCore.
- Source: [Auth0 Token Vault](https://auth0.com/blog/auth0-token-vault-secure-token-exchange-for-ai-agents/); [Auth0 for AI Agents now GA](https://dev.to/auth0/auth0-for-ai-agents-is-now-generally-available-29el); [auth0.com/ai](https://auth0.com/ai) (accessed 2026-06-10).

### How Auth0's agent story differs from the others
- **Token Vault = "agent calls a THIRD party on behalf of a user"** (OAuth Token Exchange / on-behalf-of). This is a DIFFERENT problem than:
  - Stytch Connected Apps = "agent gets a token to call MY MCP server,"
  - WorkOS auth.md = "agent registers + a human claims it,"
  - Better Auth agent-auth = "self-hosted agent capability grants."
- Token Vault is the strongest answer specifically for **"my agent needs to act in the user's Google/Slack/etc."** — the connected-third-party-credentials problem. It maps almost 1:1 to Energy's `mcp-first-connectors.md` "no token passthrough / server holds its own provider token" rule — Token Vault IS that pattern as a managed service.
- **CIBA** is the canonical async-human-approval primitive; Better Auth's agent-auth also lists `ciba` as an approval method, confirming CIBA is becoming the industry-standard backchannel approval for agents.

## Honest take for badge
- **As a target:** only if the buyer already mandates Okta/Auth0, or needs Auth0's breadth of enterprise compliance certs. Otherwise the pricing/SSO-gating makes it the default thing to migrate OFF.
- **As an agent tool:** Token Vault + CIBA are genuinely best-in-class for the "agent acts in third-party SaaS on a user's behalf" problem. If badge's task is exactly that, Auth0-for-AI-Agents is a serious contender even if you wouldn't pick Auth0 for human login.
- **Net:** badge should know Auth0 (a) as the migration source with concrete pricing pain ($1,500+/mo SSO gate), and (b) as the owner of Token Vault/CIBA — the on-behalf-of-third-party + async-approval primitives the whole field is converging on.

## Sources
- https://auth0.com/blog/auth0-token-vault-secure-token-exchange-for-ai-agents/ (accessed 2026-06-10)
- https://dev.to/auth0/auth0-for-ai-agents-is-now-generally-available-29el (accessed 2026-06-10)
- https://auth0.com/ai (accessed 2026-06-10)
- https://auth0.com/blog/securing-amazon-bedrock-agentcore-agents-auth0-for-ai-agents/ (accessed 2026-06-10)
- https://workos.com/blog/auth0-alternatives-2025 (accessed 2026-06-10)
- https://workos.com/compare/auth0 (accessed 2026-06-10)
