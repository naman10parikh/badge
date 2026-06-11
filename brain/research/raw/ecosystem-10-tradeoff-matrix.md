---
type: research
domain: auth
topic: honest competitive trade-off matrix
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Honest competitive trade-off matrix — June 2026

This is opinionated. It encodes taste, not a feature checklist. All facts cited in the per-tool files (`ecosystem-01`..`08`).

## Plane 1 — Human CIAM (the "login box")

| Dimension | Clerk | WorkOS AuthKit | Better Auth | Auth0 (Okta) |
|-----------|-------|----------------|-------------|--------------|
| **Model** | hosted, your data at vendor | hosted, your data at vendor | **self-host, you own the DB** | hosted, your data at vendor |
| **Free tier** | generous MAU then per-MAU | **1M MAU free (permanent)**, SSO/SCIM paid | free (it's a lib) | small free; per-MAU after |
| **DX / Next.js** | best-in-class components + App Router; same-day Next majors | good; AuthKit hosted UI | excellent for code-first/TS; you wire UI | dated DX, heavier |
| **Orgs/B2B** | first-class orgs+roles+UI | strong B2B + Admin Portal | plugins; you assemble | enterprise breadth |
| **Enterprise SSO/SCIM** | PAID add-on | PAID, but the reference impl (ordered Events API) | DIY/plugins | yes but SSO gated $1,500+/mo |
| **Churn / migration debt** | HIGH (v5→v6→Core 3, async auth, package renames) | moderate | HIGH (security/flow regressions between minors) | low (stable, but you'll want to leave on price) |
| **Lock-in** | high (hosted) | high (hosted) | **low (own DB)** | high (hosted) |
| **Pick when** | Next.js consumer/prosumer, want batteries+orgs fast | B2B that must close enterprise; cost-sensitive consumer | compliance/no-lock/own-data; you'll BE an OAuth AS | buyer mandates Okta, or you need its certs |
| **Avoid when** | you can't stomach forced majors / hosted data | you need self-host | you want zero-ops turnkey UI | price-sensitive; modern DX matters |

## Plane 2 — Agent / MCP auth (the live battleground)

| Dimension | Stytch Connected Apps | WorkOS auth.md | Better Auth agent-auth | Auth0 Token Vault | Roll-your-own (MCP OAuth 2.1) |
|-----------|----------------------|----------------|------------------------|-------------------|-------------------------------|
| **Problem solved (P1-P4)** | **P1** agent→my MCP server | **P2** agent identity bootstrap + human claim | **P4** self-host capability grants | **P3** agent→3rd-party SaaS on user's behalf | P1 (+P2/P3 if you build it) |
| **Hosted vs self** | hosted (standalone layer on existing IdP) | hosted (AuthKit, early access) | **self-host** | hosted | self-host |
| **MCP-OAuth-spec literal?** | **YES** (PRM/ASM/DCR/PKCE/RS256/JWKS) | layers ON TOP of MCP OAuth (reuses PRM) | NO — separate `agent-configuration` + agent-signed JWTs | adjacent (Token Exchange) | YES (you implement 2025-11-25) |
| **Maturity** | most mature hosted option | NEW (May 2026), early access | "heavy development, not stable," v2 redesign in flight | **GA** | depends on you |
| **Openness** | proprietary service | **open, provider-neutral spec** | open protocol + open lib | proprietary | fully open |
| **Standout feature** | drop-in consent UI + standalone-on-existing-IdP | claim ceremony (OTP human-ownership binding) | OpenAPI→capabilities; `@auth/agent-cli` | Token Vault (no creds held) + CIBA | total control, zero vendor |
| **Pick when** | you have auth already, just need standards-correct MCP/agent OAuth fast | you need open agent registration + ownership binding, vendor-neutral | you must self-host AND bet on Agent Auth Protocol | agent must act in user's Google/Slack etc. | you want full control / Energy's mcp-first rule, and have the eng |
| **Avoid when** | you need self-host or an open spec | you need GA-stable today | you need stability / it's the spec-compliant MCP path | you're not doing on-behalf-of-3rd-party | you lack auth eng bandwidth (use a broker) |

## The one-paragraph verdicts (taste)
- **Clerk:** the nicest Next.js human-auth DX, but you rent it and Clerk WILL make you migrate majors. Great for speed, painful long-term churn.
- **WorkOS:** the enterprise-readiness reference (SSO/SCIM/Admin Portal/ordered Events API) AND a serious consumer play (1M MAU free) AND the most architecturally-honest agent story (auth.md composes with MCP OAuth, doesn't fight it). If badge had to bet on ONE vendor across both planes, WorkOS is the most defensible.
- **Better Auth:** the right answer when ownership/compliance/no-lock matters, and the MCP-SDK-blessed substrate for hand-built servers — but it's fast-moving with real security regressions between minors, and its agent-auth plugin is a bet on a not-yet-won protocol.
- **Auth0:** migrate off it for human auth (price), but its Token Vault + CIBA are best-in-class for the specific "agent acts in third-party SaaS on the user's behalf" problem.
- **Stytch:** the cleanest way to bolt spec-correct MCP/agent OAuth onto an app that already has auth, without replacing the IdP. Most MCP-spec-literal of the hosted vendors.

## Energy-specific recommendation (ties to `mcp-first-connectors.md`)
Energy's rule already commits to **MCP OAuth 2.1 client↔server** as the default connector architecture. That maps to **roll-your-own (with Better Auth as the AS) OR Stytch as the broker** for P1, and **auth.md / Auth0 Token Vault** for the P2/P3 edges. The rule's "DCR > CIMD > pre-registered" line should be UPDATED to "**CIMD > DCR > pre-registered**" given SEP-991 made CIMD the *recommended* mechanism as of the 2025-11-25 spec (see `ecosystem-06-mcp-oauth.md`).

## Sources
See per-tool files ecosystem-01 through ecosystem-08; all citations there.
