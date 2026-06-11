---
type: research
domain: auth
topic: field intelligence — agent/machine identity, the 2026 frontier (badge's reason to exist)
researcher: FIELD-INTELLIGENCE (CP123 Wave-R)
created: 2026-06-11
status: done
currency: June 2026
---

# Field Intelligence — Agent identity, the 2026 frontier

> This is the cutting-edge surface — and the one badge (an Auth domain-expert harness in an
> agent-native company) most needs to own. The field is in "competing proposals" phase: the
> problem is well-defined, worst practices are documented, no single standard has won yet.
> Sources accessed 2026-06-11.

## The emerging standard stack (what production teams build on in 2026)
Source — WebSearch synthesis + Arcade.dev, "Multi-User AI Agent Auth: OAuth & MCP Guide"
(https://www.arcade.dev/blog/ai-agent-authentication-authorization/) + DEV/Arcade, "How to manage
multi-user AI agent auth in 2026" (https://dev.to/arcade/...-2943) + Ping Identity "Identity for AI."

- **OAuth 2.1 + PKCE + RFC 8693 (Token Exchange)** is the mature base everyone converges on.
- **RFC 8693 delegation vs impersonation (quote-worthy):** delegation keeps the acting party *distinguishable* from the party it acts for; impersonation makes them indistinguishable. **"Delegation is the clear choice for agentic use cases."** The OBO token carries `sub` (the user who delegated) + `act` (the agent acting).
- **The MCP authorization spec** "developed as a broad collaboration with **Anthropic, Arcade.dev, Microsoft, Okta/Auth0**, and others" → OAuth-style protected resources + AS discovery + **audience binding via Resource Indicators (RFC 8707)** + **delegation via Token Exchange (RFC 8693)**. (This is the through-line to `energy/.claude/rules/mcp-first-connectors.md` — same RFCs.)
- **Full RFC stack for agent tokens (Arcade):** RFC 8693 (token exchange) + RFC 8707 (resource/audience) + **RFC 9449 DPoP (sender-constraining)** + **RFC 9126 PAR (pushed authorization requests)** + **RFC 9396 RAR (rich authorization requests)**. badge should know all five by number.

## ⭐ THE INTERSECTION RULE (the single most important agent-auth principle)
Verbatim (Arcade): **"An agent's effective authority must always be calculated as the strict intersection of its own baseline permissions and the requesting human user's permissions. Never the union."**
And: **"treat every agent action as delegated user access, never as the agent's own blanket access."**
- The runtime evaluates a **delegated execution context**: a bounded, short-lived tuple of `(user, agent, scopes, audience, tenant, task_id, expiry)`.
- **badge takeaway:** this is the one rule that separates competent agent-auth from catastrophic. Any "agent can do X" question must resolve to `agent_perms ∩ user_perms`, scoped + audience-bound + short-lived (5–30 min).

## ⭐ The confused-deputy exfil chain (the canonical agent-auth disaster)
Verbatim (Arcade): a confused deputy is when **"an application gets tricked into misusing its inherited authority."** In agent contexts: an agent with blanket admin access + a poisoned RAG doc or malicious prompt → **"a single injection can weaponize the agent to scan inboxes, summarize sensitive financial data, and exfiltrate via external tool calls — the whole exfil chain completes without a human in the loop."**
- This is the SAME confused-deputy class the MCP-first rule defends against (token passthrough / audience binding), now realized through prompt injection. **Mitigation: enforce the intersection rule cryptographically (scoped, audience-bound tokens) + policy gate before EVERY tool call.**

## The 6 agent-auth anti-patterns (verbatim labels, Arcade)
1. **Single API key routing** — one privileged service-account key shared across all users → breaks identity attribution; one injection inherits max blast radius.
2. **"God mode with prompted guardrails"** — root creds + a system prompt saying "do not delete data" → "a fundamental security failure; language models are easily manipulated via indirect injection."
3. **Blanket sign-up consent** — massive multi-system OAuth scopes at onboarding → least-privilege violation, consent fatigue, dangerous premature tokens.
4. **UI-only authorization checks** — backend tool endpoints lacking delegated-user-context verification → attackers bypass the chat UI and trigger actions unvalidated.
5. **No read/draft/commit gradient** — treating every action with identical authorization → one injection causes irreversible damage (emails sent, funds moved).
6. **No immutable audit trail** — without per-action logs (policy version, prompt hash, approval status), incidents can't be reconstructed.

## Best-practice primitives badge should encode
- **Two-identity model:** project-level OAuth client (the agent app) + user-level identity (the human). Evaluate BOTH every call.
- **Read/draft/commit approval gradient:** reads/drafts = low friction; irreversible actions = out-of-band human approval.
- **Policy eval before every tool call (verbatim):** *"Never trust a language model's direct API request. Every tool call must route through a centralized policy layer."* Hook into existing IdPs (Okta, Entra, SailPoint) — don't build a duplicate authz DSL.
- **Per-user, per-provider token vaulting (verbatim):** *"non-negotiable for production agents."* Handle provider edge cases OUTSIDE the LLM context — e.g., **Google's 100-token rolling limit, Microsoft's 90-day sliding inactivity window.**
- **JIT consent via MCP URL Elicitation (SEP)** — pause, request granular scope, capture cryptographic consent, broker token, resume without losing conversation.
- **Bind first-time auth to verified app user** — prevents flow-phishing (attacker redirects OAuth consent to their own browser). Server-side verifier matches `flow_id` ↔ authenticated session.

## ⭐ Architectural claim: the control point is the RUNTIME, not the gateway
Verbatim (Arcade, interested party — they sell a runtime): **"The control point in an agentic architecture is the execution layer where the tool runs. That's where credentials are resolved, permissions are checked, and actions are taken on behalf of a specific human. That's the runtime."** A stateless gateway "cannot see execution context... A gateway adds a redundant hop, not a control point."
- **For GAPS:** this is a vendor thesis (Arcade sells the runtime). The competing view (API gateways / Kong / Cloudflare) is that the gateway CAN carry context via headers. Capture as a genuine open architectural dispute — badge should not assume "runtime > gateway" is settled.

## Where the vendors actually are (2026)
- **Clerk agent toolkit:** "a new experimental package," docs say **"recommended for testing purposes only"**; injects `userId`/`sessionId`/`orgId` into prompts + adapters for Vercel AI SDK, LangChain, MCP. Critically (WorkOS, Nov 2025): *"it does not provide a separate, independent agent identity object, nor end-to-end auditing infrastructure."* → Clerk's agent story is immature as of H1 2026. Source: https://workos.com/blog/clerk-vs-workos-agent-identity-enterprise-authentication (WorkOS-authored).
- **Clerk M2M tokens:** GA **Oct 14 2025** (beta Aug 15 2025); now issuable as **JWTs for networkless verification, eliminating per-verification cost.** Source: https://clerk.com/changelog/2025-10-14-m2m-ga.
- **WorkOS:** ships an "MCP Auth — Secure auth for MCP servers" product + an OBO-flow writeup (https://workos.com/blog/oauth-on-behalf-of-ai-agents) — but the comparison piece gives no concrete agent-token spec. WorkOS powers auth for OpenAI/Anthropic/Perplexity/Cursor/Vercel/Plaid (founder `grinich`, HN) — so its enterprise+agent surface is the one to benchmark.
- **Better Auth:** has `mcp` + `oidc-provider` + `device-authorization` plugins — but those are EXACTLY the surface that took the 2026-05-31 CVE batch (field-04). Powerful + hackable, but verify hard.
- **Stacklok/ToolHive issue #5194:** "Embedded auth server should support RFC 8693 token exchange so agents can act on behalf of users" — concrete evidence that even agent-infra projects are still RETROFITTING RFC 8693 in 2026. The standard is agreed; implementations lag.

## 2026 macro: RSAC 2026 named MCP security "the question everyone kept asking"
Source: Coalition for Secure AI, "After RSAC 2026: The MCP Security Question Everyone Kept Asking"
(https://www.coalitionforsecureai.org/after-rsac-2026-the-mcp-security-question-everyone-kept-asking/, accessed 2026-06-11). MCP/agent auth went from niche to a headline security topic at the industry's flagship conference in 2026 — confirming badge is building into the hottest, least-settled corner of identity.
