---
name: agent-auth-classifier
description: Classify an agent-auth task as P1/P2/P3/P4 before picking a tool, then design it with the intersection rule + read/draft/commit gradient. The flagship skill.
trigger: "agent needs auth", "MCP server OAuth", "agent acts on a user's behalf", "agent identity", "give my agent an identity", "is this agent design safe", "agent reads/sends email", "Claude/ChatGPT calls my server"
---

# agent-auth-classifier

> badge's **core competency** (EM JTBD-4). The agent-auth field looks confusing until you
> separate FOUR distinct problems; picking the wrong vendor for the wrong P is the #1
> architecture error. Encodes the P1-P4 router + the **intersection rule** (OP O16) + the
> read/draft/commit gradient (OP O18) + the 6 anti-patterns to refuse (KP I). Runs
> `badge classify` under the hood.

## When to use
Any task where an AGENT (not a human) is the principal — calling an MCP server, acting on a
user's behalf, bootstrapping its own identity, or running autonomously. For human login
(Plane 1), use **auth-provider-selection** instead.

## Steps

1. **Place the plane (model: haiku).** Plane 1 = human CIAM (the login box). Plane 2 = agent/MCP.
   If Plane 2, continue. (badge's reason to exist is Plane 2.)

2. **Classify P1-P4 (model: sonnet) — run `badge classify "<task>"`:**
   - **P1 — Agent → MY MCP server** (agent has identity, needs a scoped token to call my server).
     Default: **Stytch Connected Apps** (DCR is opt-in — enable it, KP-E3). Alts: BetterAuth
     OAuth-2.1-Provider, raw MCP OAuth.
   - **P2 — Agent identity bootstrap + human ownership** (agent has NO identity; register +
     human vouches). Default: **WorkOS `auth.md`** (the new 2026 primitive; composes ON TOP of
     MCP OAuth).
   - **P3 — Agent → THIRD-PARTY SaaS on a user's behalf** (act in user's Google/Slack without
     holding creds). Default: **Auth0 Token Vault + CIBA** (Token Exchange / on-behalf-of; the
     agent never sees the raw provider refresh token).
   - **P4 — Capability-scoped autonomous agent, self-host.** Default: **BetterAuth `agent-auth`**
     — flag it UNSTABLE (v2 redesign in flight, GD-G).

3. **If the task is "is this safe?" apply the design rules (model: sonnet):**
   - **THE INTERSECTION RULE (OP O16):** the agent's effective authority = `agent_perms ∩ user_perms`,
     scoped + audience-bound + short-lived (5-30 min). **Never the union.**
   - **Policy gate before EVERY tool call (OP O17)** — never trust the model's direct API request.
   - **Read/draft/commit gradient (OP O18)** — reads/drafts low-friction; irreversible actions
     (send email, move funds) → out-of-band human approval (CIBA).
   - **Delegation, never impersonation (OP O20)** — RFC 8693 OBO token carries `sub` (user) + `act` (agent).
   - **Vault provider tokens per-user/per-provider OUTSIDE the LLM context (OP O21).**
   - **Immutable per-action audit trail (OP O22)** — policy version, prompt hash, approval status.

4. **REFUSE the 6 anti-patterns (model: haiku) — `badge audit <path> --agent`:** single shared API
   key · "god mode with prompted guardrails" · blanket sign-up consent · UI-only authz · no
   read/draft/commit gradient · no immutable audit trail (KP I1-I7). A system prompt saying
   "don't delete" is NOT a security control.

## Output format
`{ plane, problem: P1|P2|P3|P4, default_tool, alternatives, rationale, cites }`; for design tasks,
the intersection-rule tuple `(user, agent, scopes, audience, tenant, task_id, expiry)` + the
gradient + the explicit refusal of any anti-pattern present.

## Refuse
- Choosing a tool before classifying the P (the #1 architecture error).
- Computing authority as the union instead of the intersection (OP O16).
- Accepting "god mode + prompt guardrail" as a design (KP-I2).

Brain: `brain/EXPERTISE-MAP.md` (JTBD-4, JTBD-6), `brain/OPINIONS.md` (O16-O22), `brain/KNOWN-PITFALLS.md` (I1-I7), `brain/BATTLE-TESTED-SCENARIOS.md` (BTS-15).
