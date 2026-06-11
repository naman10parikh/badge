---
type: research-index
domain: auth (badge harness)
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# badge ECOSYSTEM research — INDEX

June-2026 state of the art for the Auth domain. All files in this dir share the `ecosystem-` prefix.
Every claim carries a URL + access date. Currency target: sources < 6 months old; older sources flagged.

## Files in this corpus

| File | Topic | Status |
|------|-------|--------|
| `ecosystem-00-INDEX.md` | this index + cross-cutting verdicts | live |
| `ecosystem-01-clerk.md` | Clerk: Core 3, App Router API, middleware, orgs, SAML | done |
| `ecosystem-02-betterauth.md` | BetterAuth + Agent-Auth plugin + Agent Auth Protocol | done |
| `ecosystem-03-workos-authkit.md` | WorkOS AuthKit, 1M MAU free, auth.md agent registration | done |
| `ecosystem-04-stytch.md` | Stytch Connected Apps (MCP/agent OAuth) | done |
| `ecosystem-05-auth0.md` | Auth0 (migration SOURCE) + Auth0 for GenAI | done |
| `ecosystem-06-mcp-oauth.md` | MCP OAuth 2.1 (2025-06-18 spec) deep-dive | done |
| `ecosystem-07-sso-scim-enterprise.md` | Enterprise SSO + SCIM landscape | done |
| `ecosystem-08-machine-agent-identity.md` | Machine/agent identities, session vs JWT | done |
| `ecosystem-09-starter-repos.md` | Best starter/template/example repos | done |
| `ecosystem-10-tradeoff-matrix.md` | Honest competitive trade-off matrix | done |
| `ecosystem-11-agent-operator-notes.md` | What an AGENT (not human) needs: CLIs, APIs, MCP servers | done |
| `ecosystem-12-github-issues-breakage.md` | Top GitHub issues revealing real-world breakage | done |

## Cross-cutting verdict (TL;DR for the brain)

1. **The market split (June 2026):** "Auth for humans" (Clerk, Auth0, WorkOS AuthKit, BetterAuth) is now table-stakes; the live battleground is **"auth for agents / MCP servers."** Four credible answers exist: Stytch Connected Apps (most mature, standalone-layer), WorkOS `auth.md` (open spec for agent *registration/claiming*), Better Auth `agent-auth` plugin (open protocol, self-host), and the raw MCP OAuth 2.1 spec implemented yourself.
2. **MCP OAuth 2.1 (2025-06-18) is the substrate everyone builds on.** PKCE S256 MUST, RFC 8707 resource indicators MUST, DCR (RFC 7591) SHOULD, refresh rotation MUST. CIMD (Client ID Metadata Documents, SEP-991) is the emerging fix for DCR's unbounded-DB problem. This matches `mcp-first-connectors.md` exactly.
3. **`auth.md` (WorkOS, Apr 2026) is the genuinely new primitive:** it answers "how does an agent that nobody pre-registered get an *identity* and prove a human owns it" — via PRM/ASM discovery + `identity_assertion` OR anonymous registration + a claim-ceremony (OTP). It is provider-neutral and layers ON TOP of MCP OAuth.
4. **Clerk Core 3 (March 2026)** is the current major; `auth()` is async, `clerkMiddleware()` replaced `authMiddleware()` (removed in v6), protects nothing by default.
5. **BetterAuth is the self-host/own-your-DB pick** and is what the MCP TS SDK docs now *recommend* after `ProxyOAuthServerProvider` was removed from the SDK.

## GAPS-AND-DISPUTES (things not fully confirmed)

1. **Exact Clerk Enterprise-SSO per-connection price (June 2026).** Recorded ~$50/connection/mo from prior knowledge but could NOT confirm from a primary Clerk pricing page this pass. WorkOS's competing number ($125/connection/mo) and Auth0's ($1,500+/mo enterprise SSO gate) ARE cited. Verify Clerk's current number on its pricing page before quoting.
2. **Auth0 password-hash bulk-export policy (2026).** The migration playbook references Auth0 gating bulk password-hash export behind a support request (a known historical blocker), but I could not re-confirm the exact 2026 policy from a primary Auth0 doc. Treat as "historically true, verify."
3. **auth.md publish date — RESOLVED.** Initially saw April (aggregator) vs May 21 (blog body). Confirmed **2026-05-21, author Garrett Galow** from the WorkOS blog index. Logged here for the audit trail; the per-tool file already uses May 21.

(Also note: Clerk's core service is closed-source — the 1,711★ `clerk/javascript` repo is SDKs only, so "GitHub breakage" signal for Clerk is SDK-level, not server-level.)

## badge implication

badge (the Auth domain-expert employee) must be fluent in BOTH planes: (a) classic human CIAM choice (Clerk vs WorkOS vs BetterAuth vs Auth0-migration), and (b) the agent/MCP plane (Stytch Connected Apps vs WorkOS auth.md vs BetterAuth agent-auth vs roll-your-own MCP OAuth). The internal `mcp-first-connectors.md` rule already commits Energy to MCP OAuth 2.1 client↔server as the default connector architecture — badge's job is to make that compliant and to advise which IdP brokers it.
