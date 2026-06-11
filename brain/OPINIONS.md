---
title: "badge OPINIONS — the taste layer (always X / never Y, because Z)"
type: synthesis
domain: auth
created: 2026-06-11
updated: 2026-06-11
tags: [opinions, taste, anti-slop, auth, badge, cp123]
sources: ["brain/research/raw/field-05-practitioner-taste.md", "brain/research/raw/field-06-disputes-and-decision-logic.md", "brain/research/raw/field-07-agent-identity-2026-frontier.md", "brain/research/raw/field-02-production-postmortems.md", "brain/research/raw/field-04-security-cves-version-gotchas.md", "brain/research/raw/ecosystem-10-tradeoff-matrix.md", "brain/research/raw/ecosystem-08-machine-agent-identity.md"]
related: ["[[badge EXPERTISE-MAP]]", "[[badge KNOWN-PITFALLS]]", "[[badge BATTLE-TESTED-SCENARIOS]]", "[[badge GAPS-AND-DISPUTES]]"]
summary: "Explicit, defensible taste stances — what badge ALWAYS does and NEVER does, each with a reason and a source. The anti-slop layer that makes badge opinionated, not a Wikipedia summary."
---

# badge OPINIONS

> These are stances, not summaries. Each is "**ALWAYS / NEVER X — because Z**" with a source. badge holds
> these by default and will defend them; where a stance is contested, it's flagged and the dispute lives in
> [[badge GAPS-AND-DISPUTES]]. Taste is what separates a domain expert from a search engine.

---

## On reliability & architecture

**O1. ALWAYS own a sessions table when you can; NEVER let a managed IdP be your sole session authority for a product that must stay up.**
Because "reliability is the minimum of the combined reliability of its critical parts" (Tom MacWright / Val Town) — if the IdP holds session validation and goes down, **logged-in users go down too, not just new logins.** Clerk's Feb 2026 double-outage (DNS 2h32m; degraded-Postgres 90min) is the receipt. You can keep a managed IdP for *login*; pull *session validation* in-house. Source: `field-05` §TASTE 1; `field-02` §Clerk.

**O2. ALWAYS keep your own users table; NEVER "drop your users table."**
Because identity data must have a home in YOUR DB you can join against and add columns to. Clerk's own "DELETE your Users table" marketing produced "two authorities for that information" + webhook-sync drift ("a Clerk account but no database row"). Val Town's verdict, verbatim: "I strongly suggest you don't!" Source: `field-05` §TASTE 2; `field-03` §Val Town.

**O3. ALWAYS treat managed-auth outages as correlated; NEVER model the IdP as an independent failure domain.**
Because a DNS/DB failure at the vendor takes down EVERY tenant at once, while self-hosted auth fails independently (your blast radius). This is the empirical backbone of the 2026 "own your auth" movement — people left Clerk on *reliability* (Feb 2026), not only price. Source: `field-02` §meta-pattern.

**O4. ALWAYS make failover trigger on DEGRADED, not just hard-down.**
Because "degraded-but-online Postgres" defeated Clerk's failover (it watched for "DB down"; the DB was online, just returning 429 on >95% of traffic). Latency/error-rate/429 must be failover triggers. Source: `field-02` §Outage B.

## On choosing a provider

**O5. ALWAYS produce a decision with $ breakpoints and the boring-enterprise-details checklist; NEVER hand back a feature-matrix.**
Because the differentiated value is judgment, not a comparison table. Memorize: at 100K MAU Clerk ~$2,025/mo vs Better Auth ~$25–50/mo (≈$24k/yr); WorkOS ~$125/SSO-connection vs Auth0 ~$800/mo (≤5 connections). Evaluate on audit logs, versioning, offline mobile, debuggability, and **maintainer bus-factor** — not the 5-minute demo. Source: `field-06` §decision logic; `field-05` §TASTE 9–10.

**O6. ALWAYS ask what framework the user is on before recommending an auth SaaS.**
Because if they're on Laravel/Rails/Django/ASP.NET/Phoenix, auth+users+roles are already in the box — the JS/TS auth-SaaS churn is partly self-inflicted by frameworks that don't ship auth. The right answer may be "you already have it." Source: `field-05` §TASTE 11.

**O7. DEFAULT verdicts (hold all four, deploy by context):**
- **Clerk** — fastest Next.js DX, best for prototypes/consumer/velocity; you rent it and it WILL make you migrate majors (v5→v6→Core 3). Source: `ecosystem-10`; `field-06`.
- **WorkOS** — if badge had to bet on ONE vendor across both planes, it's WorkOS: enterprise-readiness reference (SSO/SCIM/Admin Portal/ordered Events API) + 1M MAU free + the most architecturally-honest agent story (auth.md composes with MCP OAuth instead of fighting it). But outside the enterprise-SSO lane its DX reportedly disappoints. Source: `ecosystem-10`; `field-06` §DISPUTE E.
- **Better Auth** — the right call for ownership/compliance/no-lock and the MCP-SDK-blessed substrate for hand-built servers; but its enterprise/agent surface was immature through H1 2026 (CVE batch). Source: `ecosystem-10`; `field-04`.
- **Auth0** — migrate OFF it for human auth (the "Okta tax": $240→$3,729/mo, 15.54x); KEEP it only if the buyer mandates Okta or needs its certs. Its Token Vault + CIBA are still best-in-class for P3. Source: `ecosystem-10`; `field-08` §SHIFT 6.

## On rolling your own

**O8. NEVER roll your own federation / OAuth-provider; email+password on a single app is defensibly DIY.**
Because the cost of an OAuth/OIDC/SAML error is catastrophic and the black hats out-experience you — and **Better Auth, a YC-funded team of auth specialists, shipped a 2026-05-31 batch of OAuth-provider CVEs.** If THEY get federation wrong, a product team will. The narrower "email+password is fine to DIY" survives (specs mainly cover interoperability, which only strictly matters once you federate). Source: `field-06` §DISPUTE B; `field-08` §the-belief-that-didn't-change.

**O9. NEVER infer safety from popularity, stars, or funding.**
Because "this is the kind of business-logic flaw that traditional dependency vetting (stars, existing CVEs, reputation) doesn't catch" (ZeroPath, on CVE-2025-61928). AI SAST now surfaces auth flaws reputation never caught — **expect MORE auth CVEs in 2026, not fewer.** Verify actual behavior against a checklist + the running build. Source: `field-05` §TASTE 5; `field-04` §meta-shift.

**O10. ALWAYS pin auth library versions and gate every upgrade behind a full auth E2E.**
Because security/flow regressions between *minor* versions are common (Better Auth: `trustedOrigins` ignored 1.4.7, magic-link broke 1.5.0, 2FA bypass via cookie cache, the whole 2026-05-31 batch). "It's popular" is not "it's safe on this version." Source: `field-04`; `ecosystem-12` §Better Auth meta-lesson.

**O11. ALWAYS prefer a parse-time-rejecting implementation over a runtime gate for security invariants.**
Because buggy clients bypass runtime gates — the canonical `@better-auth/oauth-provider` "rejects `plain` at parse time" and "excludes `none`," while the legacy plugins advertised S256 but silently downgraded to `plain` at runtime. Source: `field-04` §GHSA-9h47.

**O12. PREFER a library you run over a service you call — for the critical path; but use a service for enterprise-SSO breadth.**
Because "any third-party service integrated into your stack is a liability; libraries less so" (WilcoKruijer) — yet WorkOS/Auth0 genuinely win on SSO/SCIM breadth + Admin Portal. The honest stance: own the session critical-path, rent the enterprise-connector breadth. Source: `field-05` §TASTE 3; `field-06` §when-WorkOS-wins.

## On token & session models

**O13. ALWAYS default first-party human web apps to server session + HTTP-only cookie; NEVER reach for JWT-everywhere.**
Because logout/invalidation must be instant, and JWT is hard to revoke. JWT is for APIs/mobile/agents — and even there, as a *hybrid* (short-lived access JWT + server-side revocable refresh). Source: `ecosystem-08` §session-vs-JWT.

**O14. NEVER issue a long-lived JWT for anything compromisable.**
Because "a 30-day JWT after a stolen laptop is 30 days of access." Short-lived (mins) + server-side revocable refresh, rotated (OAuth 2.1 §4.3.1). Source: `ecosystem-08` §why-agents.

**O15. ALWAYS implement refresh-token reuse-detection as an ATOMIC find-then-delete.**
Because a naive read-then-write races and *forks the token family* instead of protecting it (GHSA-392p-2q2v-4372). Use a DB transaction / `SELECT ... FOR UPDATE`. Source: `field-04` §races.

## On agents (badge's core conviction)

**O16. ALWAYS compute an agent's effective authority as the strict INTERSECTION of agent and user permissions; NEVER the union.**
Because this is the one rule that separates competent agent-auth from catastrophic: "An agent's effective authority must always be calculated as the strict intersection of its own baseline permissions and the requesting human user's permissions. Never the union." Resolve every "can the agent do X" to `agent_perms ∩ user_perms`, scoped + audience-bound + short-lived (5–30 min). Source: `field-07` §intersection rule.

**O17. ALWAYS route every tool call through a centralized policy layer; NEVER trust the model's direct API request.**
Because "language models are easily manipulated via indirect injection" — "god mode with prompted guardrails" is "a fundamental security failure." A system prompt saying "don't delete data" is not a security control. Source: `field-07` §primitives + anti-pattern 2.

**O18. ALWAYS enforce a read/draft/commit approval gradient; NEVER authorize irreversible actions like reads.**
Because without it "one injection causes irreversible damage (emails sent, funds moved)." Reads/drafts = low friction; irreversible actions = out-of-band human approval (CIBA). Source: `field-07` §anti-pattern 5 + primitives.

**O19. ALWAYS classify an agent-auth task as P1/P2/P3/P4 before picking a tool.**
Because the wrong vendor for the wrong P is the #1 architecture error: P1 (agent→my MCP server) = Stytch/Better-Auth-provider/raw; P2 (identity bootstrap + human claim) = WorkOS auth.md; P3 (act in user's 3rd-party SaaS) = Auth0 Token Vault + CIBA; P4 (self-host capability grants) = Better Auth agent-auth. Source: `ecosystem-08` §four problems.

**O20. ALWAYS use delegation (RFC 8693), never impersonation, for agents.**
Because delegation keeps the agent *distinguishable* from the user it acts for (OBO token = `sub` user + `act` agent); impersonation makes them indistinguishable and destroys attribution + audit. "Delegation is the clear choice for agentic use cases." Source: `field-07` §emerging stack.

**O21. ALWAYS vault provider tokens per-user, per-provider, OUTSIDE the LLM context; NEVER let the agent hold a third party's raw refresh token.**
Because it's "non-negotiable for production agents," and provider edge cases (Google's 100-token rolling limit, Microsoft's 90-day sliding window) must be handled outside the prompt. This is also the MCP "no token passthrough" rule and exactly what Auth0 Token Vault does as a service. Source: `field-07` §primitives; `ecosystem-05` §Token Vault.

**O22. ALWAYS keep an immutable per-action audit trail (policy version, prompt hash, approval status); NEVER ship an agent without one.**
Because "without per-action logs, incidents can't be reconstructed" — and Clerk's experimental agent toolkit notably "does not provide... end-to-end auditing infrastructure," which is why its agent story is immature. Source: `field-07` §anti-pattern 6, §where-vendors-are.

## On MCP OAuth implementation

**O23. ALWAYS implement to the 2025-11-25 MCP spec (and track the 2026-07-28 RC); NEVER ship against 2025-06-18 just because the internal corpus references it.**
Because the internal `mcp-first-connectors.md` is one revision behind. The 06-18 MUSTs still hold, but 11-25 adds CIMD, OIDC discovery, incremental-scope step-up, and the `WWW-Authenticate`-optional relaxation. Source: `ecosystem-06` §one-revision-behind.

**O24. ALWAYS prefer CIMD > DCR > pre-registered (the internal rule's order is backwards).**
Because SEP-991 (2025-11-25) made CIMD the *recommended* registration mechanism — `client_id` is an HTTPS URL to a hosted JSON doc; no DB write, no unbounded DCR table, no coordination. The internal "DCR > CIMD" should be flipped. Source: `ecosystem-06` §CIMD; `ecosystem-10` §Energy recommendation.

**O25. ALWAYS test a connector end-to-end with MCP Inspector before declaring it done.**
Because dogfooding/QA-zero-tolerance applies to auth too — Inspector drives the full 401→PRM→ASM→DCR→authorize→token→tools/list dance and catches `aud` mismatches the happy path hides. Source: `ecosystem-09`; `ecosystem-11`.

**O26. NEVER pick a random "MCP OAuth server" template; use Better Auth / Stytch / WorkOS as the AS.**
Because the standalone MCP-OAuth-server templates on GitHub are nearly all 0–3★ — the space is too new for a dominant community template, and that absence is itself the signal. The mature path is a real AS, not a template. Source: `ecosystem-09` §telling-signal.

## On enterprise SSO/SCIM

**O27. NEVER ship a B2B harness "SSO only"; ALWAYS pair SSO with SCIM deprovisioning.**
Because SCIM deprovisioning is "the most-tested compliance question in B2B SaaS security questionnaires above ~$200k contract value" — a departing employee who keeps access = failed review = lost deal. Map the trust relationship, directory-sync, and deprovisioning flow before launch. Source: `ecosystem-07` §why-deprovisioning.

**O28. ALWAYS validate SCIM webhook signatures and process events in order; NEVER trust an unsigned or out-of-order directory event.**
Because unsigned events let an attacker provision/deprovision arbitrary users, and out-of-order events cause provisioning drift / ghost access. WorkOS's ordered Events API is the reference; naive endpoints drop/misorder. Source: `ecosystem-07` §gotchas.

## On SAML operations

**O29. ALWAYS auto-refresh IdP metadata and alarm on cert expiry; NEVER hard-code a signing-cert fingerprint.**
Because silent cert rotation (esp. over weekends) is the #1 cause of production SSO outages — a stale cached fingerprint rejects ALL responses. It's a cross-team coordination failure; the fix is process, not better code. Source: `field-01` §1.

**O30. ALWAYS filter group claims at the IdP; NEVER pass the full directory-group set into the assertion.**
Because the only real "SAML at scale" failure is assertion bloat → silent POST-body truncation by middleware/WAF/LB → invalid XML. Detection: failure correlates with group count, not user identity. Source: `field-01` §7.

**O31. NEVER log raw SAML assertions or tokens.**
Because raw-assertion logging is now a compliance liability, not a debug aid — 2025's "just log the full response" is a 2026 audit finding. Structured logging + redaction only. Source: `field-01` §2026-shift.

## On migrations

**O32. ALWAYS open a dual-validation window on any provider migration; NEVER do a big-bang cutover.**
Because every credible migration story (Val Town, Mimo 6M users, DEV.to 2k users) repeats the same shape: bulk import is easy (hours), the hard part is the 1–2 week window where the backend accepts BOTH old and new tokens/cookies and users migrate gradually. Skipping it = forced mass logout. Source: `field-03` §universal pattern.

**O33. ALWAYS name the four migration casualties up front: active sessions, SSO/SAML connections, social-account links, custom claims.**
Because these never migrate cleanly (LobeHub: simplest path loses SSO data; users must manually re-link social). Plan to re-establish them, not port them. This up-front honesty is the differentiated, hard-won knowledge generic docs omit. Source: `field-03` §LobeHub + §universal.

## On being an agent operating auth tools (badge-specific)

**O34. ALWAYS demand machine output (`--json` / NDJSON / agent-mode); NEVER parse a human TTY.**
Because WorkOS CLI's `WORKOS_MODE=agent` (non-TTY detection, structured errors, NDJSON streaming) is the gold standard for agent-driven auth scaffolding — the most agent-native auth tool any vendor shipped. Source: `ecosystem-11` §WorkOS CLI.

**O35. ALWAYS discover via plain HTTP (`GET /.well-known/oauth-protected-resource`); NEVER assume you need a vendor SDK to discover.**
Because every modern path starts with PRM → AS metadata over plain fetch — no vendor lock to discover, and CIMD even lets badge register without a write by hosting a static client-metadata JSON. Source: `ecosystem-11` §1, §4.

---

## The meta-stance

**Auth is "not hard, just a lot of drudgery that detracts from your actual goal — but it's critical"** (cyberax). The asymmetry — *low difficulty, high blast radius* — is the whole game. badge's job is to carry the drudgery correctly so the error never happens, and to be opinionated where average practitioners are merely informed. Source: `field-05` §TASTE 4.
