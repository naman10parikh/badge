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
| `ecosystem-13-verification-and-version-deltas.md` | **GAP resolution + current versions** (Clerk SSO price model change, Auth0 hash-export confirmed, BetterAuth v1.6.16 + v1.5 enterprise-SSO upgrade, authkit-nextjs v4 churn) | done (2nd pass) |
| `ecosystem-14-agent-plane-scars-and-mechanics.md` | **Agent-plane GitHub scars** (MCP SDK/Inspector/BetterAuth-MCP) + Auth0 Token Vault runtime mechanics + Clerk SCIM GA timeline | done (2nd pass) |
| `ecosystem-15-token-lifetimes-and-final-corrections.md` | **Stytch token-lifetime correction** + BetterAuth-no-SCIM confirm + repo-shape confirms | done (2nd pass) |

## Cross-cutting verdict (TL;DR for the brain)

1. **The market split (June 2026):** "Auth for humans" (Clerk, Auth0, WorkOS AuthKit, BetterAuth) is now table-stakes; the live battleground is **"auth for agents / MCP servers."** Four credible answers exist: Stytch Connected Apps (most mature, standalone-layer), WorkOS `auth.md` (open spec for agent *registration/claiming*), Better Auth `agent-auth` plugin (open protocol, self-host), and the raw MCP OAuth 2.1 spec implemented yourself.
2. **MCP OAuth 2.1 (2025-06-18) is the substrate everyone builds on.** PKCE S256 MUST, RFC 8707 resource indicators MUST, DCR (RFC 7591) SHOULD, refresh rotation MUST. CIMD (Client ID Metadata Documents, SEP-991) is the emerging fix for DCR's unbounded-DB problem. This matches `mcp-first-connectors.md` exactly.
3. **`auth.md` (WorkOS, Apr 2026) is the genuinely new primitive:** it answers "how does an agent that nobody pre-registered get an *identity* and prove a human owns it" — via PRM/ASM discovery + `identity_assertion` OR anonymous registration + a claim-ceremony (OTP). It is provider-neutral and layers ON TOP of MCP OAuth.
4. **Clerk Core 3 (March 2026)** is the current major; `auth()` is async, `clerkMiddleware()` replaced `authMiddleware()` (removed in v6), protects nothing by default.
5. **BetterAuth is the self-host/own-your-DB pick** and is what the MCP TS SDK docs now *recommend* after `ProxyOAuthServerProvider` was removed from the SDK.

## GAPS-AND-DISPUTES (updated after 2nd-pass verification — see ecosystem-13/14/15)

1. **Clerk Enterprise-SSO price — RESOLVED (model changed).** The old ~$50/connection figure was the legacy "Enhanced Authentication" add-on ($100/mo bundle). Post-2026-02-05 ("New plans, more value"), Enterprise Connections are **metered inside Pro: 1 included, ~$75 per additional connection/mo** (SuperTokens 2026 guide + Clerk changelog). Detail in `ecosystem-13`. RESIDUAL: `clerk.com/pricing` + most `clerk.com/docs` are WAF-blocked to WebFetch — for a hard live quote, drive the page with `bb` (Browserbase) or a browser.
2. **Auth0 password-hash export — RESOLVED (confirmed gated).** Still behind a support ticket ("I would like to obtain an export of my tenant password hashes"), paid-tier only, ~1 week. BUT the better path is **lazy/trickle migration via a custom DB connection** (no hash export, no user-facing reset). Detail in `ecosystem-13`.
3. **auth.md publish date — RESOLVED.** **2026-05-21, author Garrett Galow** (WorkOS blog index). Repo `workos/auth.md` confirmed 418★, TypeScript, **but NO license declared** (flag — `ecosystem-15`).
4. **Better Auth v1.6.0 exact release DATE — UNVERIFIED.** The GitHub release page rendered "April 6, **2025**" to automated fetch, which is impossible (v1.5 = 2026-02-28; `gh release list` shows v1.6.11 on 2026-05-12). Treat **v1.6.0 ≈ late-April 2026**; do NOT cite the 2025 date. (`ecosystem-13`)
5. **Stytch refresh-token rotation — RESOLVED.** Public/agent clients: 3-month refresh, **rotated each use**. Confidential clients: 6-month sliding, **no rotation**. Access token = 60-min default. The corpus's `ecosystem-04` mislabeled 3600s as the refresh expiry — corrected in `ecosystem-15`.

(Also note: Clerk's core service is closed-source — the 1,711★ `clerk/javascript` repo is SDKs only, so "GitHub breakage" signal for Clerk is SDK-level, not server-level. And Clerk's Directory Sync/SCIM only reached GA **2026-04-16** (groups/attrs 2026-05-21) — newer than the corpus implied; `ecosystem-14`.)

(Also note: Clerk's core service is closed-source — the 1,711★ `clerk/javascript` repo is SDKs only, so "GitHub breakage" signal for Clerk is SDK-level, not server-level.)

## badge implication

badge (the Auth domain-expert employee) must be fluent in BOTH planes: (a) classic human CIAM choice (Clerk vs WorkOS vs BetterAuth vs Auth0-migration), and (b) the agent/MCP plane (Stytch Connected Apps vs WorkOS auth.md vs BetterAuth agent-auth vs roll-your-own MCP OAuth). The internal `mcp-first-connectors.md` rule already commits Energy to MCP OAuth 2.1 client↔server as the default connector architecture — badge's job is to make that compliant and to advise which IdP brokers it.
