---
type: research
domain: auth
tool: WorkOS AuthKit + auth.md
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# WorkOS AuthKit + auth.md — June 2026 state of the art

## What it is
WorkOS = enterprise-grade identity. **AuthKit** is its hosted auth UI / User Management layer (the Clerk-competitor surface); WorkOS's historical strength is **Enterprise SSO + Directory Sync (SCIM)** sold to companies that need to land enterprise customers fast.

## The 1M MAU free tier (the headline)
- **User Management (AuthKit) is free up to 1,000,000 monthly active users — permanently, no application needed.**
  - A user is "active" if they perform ANY action (sign up, sign in, profile update) in the calendar month.
  - Free tier includes: email/password, social login (Google, GitHub, Microsoft), MFA, user management.
  - Source: [Pricing — WorkOS](https://workos.com/pricing) and [WorkOS for Startups](https://guptadeepak.com/startup-offers/programs/workos-startups) (accessed 2026-06-10).
- **SSO and SCIM (Directory Sync) remain PAID** — they are NOT in the free MAU tier. This is the deliberate wedge: free consumer auth, monetize the enterprise connectors. WorkOS's own comparison page leans on "clear pricing, SCIM, IT-admin self-serve UI" vs Auth0.
  - Source: [WorkOS vs Auth0](https://workos.com/compare/auth0) (accessed 2026-06-10).

## auth.md — agent registration (the genuinely NEW primitive)

`auth.md` is WorkOS's **open, provider-neutral protocol for AI-agent registration** — how an agent that nobody pre-registered gets an identity AND proves a human owns it.
- Publish date: **2026-05-21** per the blog body (WebFetch of [Agent Registration with Auth.md](https://workos.com/blog/agent-registration-with-auth-md)). NOTE: a secondary aggregator implied April 2026 — treat 2026-05-21 as primary, flagged in GAPS.
- "The protocol is open and not tied to WorkOS infrastructure, building on existing OAuth standards; can be implemented by any app or agent provider." WorkOS AuthKit integration is **early access**.
- Source: [WorkOS — Agent Registration with Auth.md](https://workos.com/blog/agent-registration-with-auth-md); [AuthKit Launches auth md](https://cryptodiffer.com/feed/analytics/workos-launches-auth-md-for-ai-agent-registration) (accessed 2026-06-10).

### The 5-stage flow
1. **Discovery** — agent fetches Protected Resource Metadata at `/.well-known/oauth-protected-resource` containing an **`agent_auth`** block, plus Authorization Server metadata. (This DIRECTLY reuses MCP OAuth's PRM/ASM — auth.md layers on top of MCP OAuth, it does NOT replace it.)
2. **Method selection** — agent chooses:
   - **`identity_assertion`** — uses an **ID-JAG** (ID-JWT-Authorization-Grant) carrying a verified email/phone, OR
   - **anonymous registration** — OTP-based.
3. **Registration** — agent `POST`s to `/agent-auth` with the chosen method's payload.
4. **Claim ceremony** (for user-claimed flows) — service emails a claim URL; the user provides a **six-digit OTP** back to the agent to bind credentials to their real account. Endpoints: `POST /agent-auth/claim` then `POST /agent-auth/claim/complete`. Service generates a `claim_token`, HASHES it before storage, emails a one-time view URL. On OTP submission, credentials either upgrade scope or fresh tokens are issued.
5. **Credential usage** — agent presents creds on API calls, handles expiry + 401 recovery.

### HTTP endpoints
- `POST /agent-auth` — primary registration
- `POST /agent-auth/claim` — initiate OTP claim
- `POST /agent-auth/claim/complete` — submit OTP, finalize binding
- `GET /.well-known/oauth-protected-resource` — discovery (the `agent_auth` block lives here)

Source for the flow + endpoints + field names: WebFetch of [workos.com/blog/agent-registration-with-auth-md](https://workos.com/blog/agent-registration-with-auth-md) (accessed 2026-06-10).

### Why this matters / why it's different
- **MCP OAuth answers:** "agent already has an identity, how does it get a token to call this MCP server." **auth.md answers the step BEFORE that:** "this agent has NO identity here yet — how does it register and how does a human vouch for it." It's the *identity-bootstrap + ownership-binding* layer.
- Provider-neutral by design: "The user-claimed flow is open to any agent that can read your auth.md." So you could implement the server side without WorkOS at all — but WorkOS gives you AuthKit-hosted plumbing.

## Honest take for badge
- **Best fit (human plane):** B2B SaaS that must close enterprise deals — WorkOS's SSO+SCIM is the most respected and the IT-admin self-serve portal is a genuine differentiator vs Auth0. The 1M MAU free tier makes it a serious Clerk alternative for consumer too, with a cleaner enterprise upsell path.
- **Best fit (agent plane):** if you want an OPEN spec for agent registration/claiming that isn't locked to one vendor, `auth.md` is the standout. It composes WITH MCP OAuth rather than competing with it — which makes it the most architecturally aligned with Energy's `mcp-first-connectors.md` rule.
- **Watch-outs:** auth.md is new (May 2026) and AuthKit support is EARLY ACCESS — production readiness unproven. SSO/SCIM being paid means "free" is consumer-only; budget for the enterprise tier the moment you sell upmarket.

## Sources
- https://workos.com/pricing (accessed 2026-06-10)
- https://workos.com/blog/agent-registration-with-auth-md (2026-05-21; accessed 2026-06-10)
- https://guptadeepak.com/startup-offers/programs/workos-startups (accessed 2026-06-10)
- https://workos.com/compare/auth0 (accessed 2026-06-10)
- https://www.authkit.com/ (accessed 2026-06-10)
- https://cryptodiffer.com/feed/analytics/workos-launches-auth-md-for-ai-agent-registration (accessed 2026-06-10)
