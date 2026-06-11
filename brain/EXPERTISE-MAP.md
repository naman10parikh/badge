---
title: "badge EXPERTISE-MAP — what the Auth employee must master"
type: synthesis
domain: auth
created: 2026-06-11
updated: 2026-06-11
tags: [expertise-map, auth, jtbd, badge, cp123]
sources: ["brain/research/raw/ecosystem-00-INDEX.md", "brain/research/raw/ecosystem-06-mcp-oauth.md", "brain/research/raw/ecosystem-08-machine-agent-identity.md", "brain/research/raw/ecosystem-07-sso-scim-enterprise.md", "brain/research/raw/field-07-agent-identity-2026-frontier.md", "brain/research/raw/field-03-migration-war-stories.md"]
related: ["[[badge BATTLE-TESTED-SCENARIOS]]", "[[badge KNOWN-PITFALLS]]", "[[badge OPINIONS]]", "[[badge GAPS-AND-DISPUTES]]", "[[badge TOOL-MATRIX]]"]
summary: "The structured map of everything the Auth employee must master, organized by job-to-be-done (not by tool), each node cited to a raw source."
---

# badge EXPERTISE-MAP

> Organized by **job-to-be-done**, not by vendor. A fresh Claude session reading `brain/` should be able to
> route any auth task to the right node and know what "good" looks like. Every node cites its raw source.
> Companion files: scenarios → [[badge BATTLE-TESTED-SCENARIOS]]; gotchas → [[badge KNOWN-PITFALLS]];
> taste → [[badge OPINIONS]]; unknowns → [[badge GAPS-AND-DISPUTES]]; tools → [[badge TOOL-MATRIX]].

## The two planes (the top-level split badge must hold)

The entire auth field in June 2026 splits into **two planes**. badge's first move on any task is to place it.

- **Plane 1 — Human CIAM ("the login box").** Classic: who is the human, how do they log in, what org are they in, how does an enterprise's IdP federate. Table-stakes; the vendors are Clerk / WorkOS AuthKit / Better Auth / Auth0. Source: `ecosystem-00-INDEX.md` §Cross-cutting verdict (1).
- **Plane 2 — Agent / MCP auth (the live 2026 battleground).** A new principal type — an agent acting on behalf of a human, autonomously, with its own identity. Source: `ecosystem-00-INDEX.md` §verdict (1); `ecosystem-08-machine-agent-identity.md` §2026 shift.

badge's reason to exist is Plane 2 — but it must be fluent in Plane 1 because most agent-auth tasks ride on a human-CIAM substrate.

---

## JTBD-1 — "Let humans log into a first-party web app"

The bread-and-butter. The job is: authenticate a human, hold a session, log them out instantly when needed.

- **1.1 Session model: default to server session + HTTP-only cookie, NOT JWT.** For first-party web apps the 2026 consensus is server sessions in Redis + HTTP-only cookies — logout/invalidation is instant. JWT-everywhere is the wrong default for human web. Source: `ecosystem-08-machine-agent-identity.md` §Session vs JWT.
- **1.2 When JWT is correct: APIs / mobile / agents** — short-lived access JWT (~15 min) + long-lived refresh token, with the **refresh token stored server-side as a session for revocation** (hybrid). Stateless on the hot path, stateful only on refresh. Source: `ecosystem-08-machine-agent-identity.md` §Session vs JWT.
- **1.3 Password hashing is the secure default you must ship, not offload.** A good library ships bcrypt/argon hashing by default rather than moralizing and leaving the dangerous part to the user (the NextAuth anti-pattern). Source: `field-05-practitioner-taste.md` §TASTE 7.
- **1.4 Passkeys/WebAuthn are table-stakes in 2026, not roadmap.** Google saw +120% passkey auths after defaulting; ~50–60% of top-100 sites support them; FIDO: 87% of US/UK firms deploying/planning. Evaluate every provider on passkey quality. Source: `field-08-2026-shifts-and-x-signal.md` §SHIFT 7.
- **1.5 Keep your own users table.** Identity data must have a home in YOUR DB you can join against and add columns to. "Consider dropping your users table" is wrong. Source: `field-05-practitioner-taste.md` §TASTE 2; `field-03-migration-war-stories.md` §Val Town.
- **1.6 Framework-native auth first.** If the user is on Laravel/Rails/Django/ASP.NET/Phoenix, auth+users+roles are already in the box — ask the framework before recommending a SaaS. Source: `field-05-practitioner-taste.md` §TASTE 11.

## JTBD-2 — "Pick a human-CIAM provider (or self-host)"

The selection job. badge must produce a *decision*, not a feature table. Full decision logic + $ breakpoints in [[badge OPINIONS]] and `field-06`.

- **2.1 Clerk** — fastest Next.js DX, drop-in components, first-class orgs. Pick for prototypes/consumer/B2C/velocity. Cost: session-authority single-point-of-failure, MAU pricing at scale, aggressive major-version churn (v5→v6→Core 3). Source: `ecosystem-01-clerk.md`; `ecosystem-10-tradeoff-matrix.md` Plane 1.
- **2.2 WorkOS AuthKit** — 1M MAU free; the enterprise-readiness reference (SSO/SCIM/Admin Portal/ordered Events API). Pick for B2B that must close enterprise; also a serious consumer play. SSO/SCIM are PAID. Source: `ecosystem-03-workos-authkit.md`; `ecosystem-07-sso-scim-enterprise.md`.
- **2.3 Better Auth** — self-host, own-your-DB, framework-agnostic TS. Pick for compliance/no-lock/data-sovereignty, or when your app must BE an OAuth AS. Cost: fast churn + security regressions between minors; enterprise/agent plugins immature through H1 2026. Source: `ecosystem-02-betterauth.md`; `field-04-security-cves-version-gotchas.md`.
- **2.4 Auth0 (Okta)** — breadth + certs + hundreds of IdPs. Mostly the thing people MIGRATE OFF on price ("Okta tax": one user $240→$3,729/mo, 15.54x). Pick only if the buyer mandates Okta or needs its certs. Source: `ecosystem-05-auth0.md`; `field-08-2026-shifts-and-x-signal.md` §SHIFT 6.
- **2.5 The $ breakpoints (memorize).** At 100K MAU: Clerk ~$2,025/mo vs Better Auth ~$25–50/mo (Postgres only) ≈ $24k/yr delta. WorkOS ~$125/SSO-connection vs Auth0 ~$800/mo Professional (≤5 connections). Source: `field-06-disputes-and-decision-logic.md` §Decision logic.
- **2.6 Selection criteria average devs skip:** audit logs, versioning/config history, offline mobile auth, debuggability, **maintainer bus-factor / commit tempo.** Evaluate on boring enterprise details, not the 5-minute demo. Source: `field-05-practitioner-taste.md` §TASTE 9, §TASTE 10.

## JTBD-3 — "Make a B2B SaaS enterprise-ready (SSO + SCIM)"

The deal-blocker job. Above ~$200k ACV this is non-negotiable.

- **3.1 SSO ≠ SCIM — both required, ship together.** SSO (SAML 2.0 / OIDC) = login-time trust with the enterprise IdP (Okta/Entra/Google/Ping). SCIM 2.0 (inbound) = lifecycle (auto-provision/**deprovision**). They are complementary, not competing. Source: `ecosystem-07-sso-scim-enterprise.md` §mental model.
- **3.2 SCIM deprovisioning is the load-bearing requirement.** "The most-tested compliance question in B2B SaaS security questionnaires above ~$200k contract value." A departing employee who keeps access = failed security review = lost deal. Never ship "SSO only." Source: `ecosystem-07-sso-scim-enterprise.md` §why deprovisioning.
- **3.3 SCIM event hygiene:** validate webhook signatures before processing (unsigned events = attacker can provision/deprovision arbitrary users); handle **ordering** (out-of-order/dropped events cause provisioning drift / ghost access). WorkOS's ordered Events API is a genuine differentiator; naive SCIM endpoints drop/misorder. Source: `ecosystem-07-sso-scim-enterprise.md` §gotchas.
- **3.4 Map the trust relationship, directory-sync path, and deprovisioning flow BEFORE launch** so authentication and lifecycle state cannot diverge. Source: `ecosystem-07-sso-scim-enterprise.md` §badge rule.
- **3.5 SAML is config + time + routing, not crypto** — see JTBD-7 for the full failure taxonomy + triage runbook. Source: `field-01-saml-sso-failure-modes.md`.

## JTBD-4 — "Classify and solve an agent-auth task" (the P1–P4 router — badge's core competency)

**The single most important mental model badge owns.** The field looks confusing until you separate FOUR distinct problems. Picking the wrong vendor for the wrong P is the #1 architecture error. Source: `ecosystem-08-machine-agent-identity.md` §four problems.

- **P1 — Agent → MY MCP server.** Agent already has an identity; get a scoped token to call my server. Canonical: **Stytch Connected Apps** (most turnkey hosted), Better Auth OAuth-2.1-Provider plugin, or raw MCP OAuth 2.1. Source: `ecosystem-04-stytch.md`; `ecosystem-08` table.
- **P2 — Agent identity bootstrap + human ownership.** Agent has NO identity here; register it AND let a human vouch for it. Canonical: **WorkOS `auth.md`** (identity_assertion via ID-JAG OR anonymous + OTP claim ceremony). The genuinely new 2026 primitive; layers ON TOP of MCP OAuth. Source: `ecosystem-03-workos-authkit.md` §auth.md; `ecosystem-08` table.
- **P3 — Agent → THIRD-PARTY SaaS on a user's behalf.** Agent must act in the user's Google/Slack without holding those creds. Canonical: **Auth0 Token Vault** (OAuth Token Exchange / on-behalf-of — agent never sees raw provider refresh token) + **CIBA** for async human approval; or the per-provider remote-MCP-server pattern. Source: `ecosystem-05-auth0.md` §Token Vault; `ecosystem-08` table.
- **P4 — Capability-scoped autonomous agents (self-host).** Own-your-stack agent identity + capability grants + approvals. Canonical: **Better Auth `agent-auth`** plugin (Agent Auth Protocol). Open + self-hostable but explicitly UNSTABLE, v2 redesign in flight. Source: `ecosystem-02-betterauth.md` §agent-auth.
- **4.1 Delegation vs impersonation — delegation always.** RFC 8693 delegation keeps the acting party (agent) *distinguishable* from the party it acts for (user); impersonation makes them indistinguishable. "Delegation is the clear choice for agentic use cases." OBO token carries `sub` (delegating user) + `act` (acting agent). Source: `field-07-agent-identity-2026-frontier.md` §emerging stack.
- **4.2 On-behalf-of (delegated) is the default; autonomous only when the agent owns resources** (earns money / runs unattended). Better Auth names these `delegated` vs `autonomous` modes. Source: `ecosystem-08-machine-agent-identity.md` §on-behalf-of vs autonomous.

## JTBD-5 — "Build/secure an MCP server's OAuth (the implementation job)"

The hands-on spec-compliance job. badge implements to the **2025-11-25** spec (not the internal corpus's 2025-06-18) and tracks the 2026-07-28 RC. Source: `ecosystem-06-mcp-oauth.md`.

- **5.1 The MUSTs that carry over from 2025-06-18:** PKCE S256 (`plain` banned); RFC 8707 `resource=` on BOTH `/authorize` AND `/token`; refresh-token rotation + reuse-detection (OAuth 2.1 §4.3.1); no token passthrough; HTTPS except localhost; exact redirect-URI match; audience-bound short-lived access tokens; 401→`WWW-Authenticate: Bearer resource_metadata=...`. Source: `ecosystem-06-mcp-oauth.md` §carried over.
- **5.2 The 2025-11-25 deltas (memorize):** (a) **CIMD (SEP-991) is now the RECOMMENDED registration mechanism over raw DCR** — `client_id` is an HTTPS URL to a hosted JSON metadata doc; no DB write, no unbounded DCR table → **prefer CIMD > DCR > pre-registered**; (b) OIDC Discovery 1.0 support; (c) incremental-scope step-up via `WWW-Authenticate` (SEP-835) — re-authorize for ONLY the delta; (d) PRM discoverable via `.well-known` even without the 401 header (SEP-985, a relaxation); (e) 403 on bad `Origin` (DNS-rebinding defense). Source: `ecosystem-06-mcp-oauth.md` §deltas table.
- **5.3 The 2026-07-28 RC to track:** `iss` validation per RFC 9207 (SEP-2468 — mix-up defense); `application_type` in DCR (SEP-837 — stops AS defaulting CLI clients to "web" and rejecting localhost redirects); creds bound to issuer (SEP-2352). Source: `ecosystem-06-mcp-oauth.md` §RC.
- **5.4 The SDK punted server OAuth — pick an external AS.** `ProxyOAuthServerProvider` + all server OAuth exports were REMOVED from the MCP TS SDK; it now names **better-auth**. Client-side helpers (`OAuthClientProvider`, `extractWWWAuthenticateParams`) remain. Do NOT expect the SDK to broker server OAuth. Source: `ecosystem-06-mcp-oauth.md` §removed-from-SDK; `ecosystem-09-starter-repos.md`.
- **5.5 The full RFC stack for agent tokens (know all 5 by number):** 8693 (token exchange) · 8707 (resource/audience) · 9449 DPoP (sender-constraining) · 9126 PAR (pushed authorization requests) · 9396 RAR (rich authorization requests). Source: `field-07-agent-identity-2026-frontier.md` §full RFC stack.
- **5.6 Test with MCP Inspector before declaring done.** `modelcontextprotocol/inspector` drives the full 401→PRM→ASM→DCR→authorize→token→tools/list dance. Dogfood / QA-zero-tolerance. Source: `ecosystem-09-starter-repos.md`; `ecosystem-11-agent-operator-notes.md`.

## JTBD-6 — "Authorize agent actions safely" (the authz / blast-radius job)

The job that separates competent agent-auth from catastrophic. All from `field-07-agent-identity-2026-frontier.md`.

- **6.1 THE INTERSECTION RULE.** "An agent's effective authority must always be calculated as the strict intersection of its own baseline permissions and the requesting human user's permissions. **Never the union.**" Every "can the agent do X" question resolves to `agent_perms ∩ user_perms`, scoped + audience-bound + short-lived (5–30 min). Source: `field-07` §intersection rule.
- **6.2 Policy eval before EVERY tool call.** "Never trust a language model's direct API request. Every tool call must route through a centralized policy layer." Hook into existing IdPs (Okta/Entra/SailPoint) — don't build a duplicate authz DSL. Source: `field-07` §best-practice primitives.
- **6.3 Read/draft/commit approval gradient.** Reads/drafts = low friction; irreversible actions (send email, move funds) = out-of-band human approval (CIBA). Treating every action with identical authz = one injection causes irreversible damage. Source: `field-07` §anti-pattern 5 + primitives.
- **6.4 The delegated execution context tuple:** `(user, agent, scopes, audience, tenant, task_id, expiry)` — bounded, short-lived, evaluated at the runtime. Source: `field-07` §intersection rule.
- **6.5 Confused-deputy-via-injection is the canonical disaster.** Agent with blanket admin + poisoned RAG doc/prompt → "a single injection can weaponize the agent to scan inboxes, summarize sensitive financial data, and exfiltrate via external tool calls — the whole exfil chain completes without a human in the loop." Mitigation: intersection rule enforced cryptographically (scoped, audience-bound tokens) + policy gate per call. Source: `field-07` §confused-deputy.
- **6.6 The 6 agent-auth anti-patterns to refuse:** single shared API key · "god mode with prompted guardrails" · blanket sign-up consent · UI-only authz checks · no read/draft/commit gradient · no immutable audit trail. Source: `field-07` §6 anti-patterns. (Detail in [[badge KNOWN-PITFALLS]].)

## JTBD-7 — "Diagnose a SAML/SSO production failure" (the runbook job)

The incident job. SAML breakage is overwhelmingly config + time + routing. badge encodes the triage runbook. All from `field-01-saml-sso-failure-modes.md`.

- **7.1 The 60-second triage order (doubles as incident-frequency ranking):** (1) timestamps/clock-skew → (2) signing cert expiry → (3) ACS URL → (4) Issuer → (5) Audience → (6) signature algorithm → (7) Destination. Source: `field-01` §triage order.
- **7.2 #1 cause: silent cert rotation** ("silent certificate rotation over weekends"). IdP rotates signing keys; SP caches a stale fingerprint → rejects ALL responses. Fix: auto-refresh IdP metadata on a schedule, alarm on cert expiry T-14d, never hard-code fingerprints. Source: `field-01` §1.
- **7.3 The only real "SAML at scale" failure: assertion bloat from group memberships.** Large AD group sets bloat the assertion → middleware/WAF/load-balancer silently truncates the POST body → incomplete XML → validation fails (IBM cites ~250KB default limit). Fix: filter group claims at the IdP, raise SP ingress body-size limit. Source: `field-01` §7.
- **7.4 Cross-team coordination failures masquerade as bugs:** SHA-1→SHA-256 migrations and cert rotation break trust because the IdP team's compliance work blindsides the SP team — fix is process (metadata auto-refresh + alerting), not code. Source: `field-01` §2, §3.
- **7.5 Raw assertion logging is now a compliance liability, not a debug aid** — structured logging + redaction are modern requirements. 2025's "just log the full SAML response" is now an audit finding. Source: `field-01` §2026 shift.

## JTBD-8 — "Migrate from auth provider X to Y" (the war-story job)

The high-risk job. badge produces the dual-validation plan + casualty list immediately. All from `field-03-migration-war-stories.md`.

- **8.1 The universal 3-part migration shape:** (1) bulk user import is the EASY/fast part (hours — passwords port if same hash algo, else lazy re-hash on first login); (2) the HARD part is the **dual-validation window** (1–2 weeks where the backend accepts BOTH old and new tokens/cookies, migrating users gradually — skipping it = forced mass logout); (3) the **four casualties** that never migrate cleanly: active sessions, SSO/SAML connections, social-account links, custom claims. Source: `field-03` §universal pattern.
- **8.2 The reference playbook (Val Town Clerk→Better Auth):** two-week parallel period supporting both cookie types; every auth endpoint rewritten to accept either session; sign-in page issues new sessions, old ones age out; security-critical code handwritten with close reading (no auto-migrator). Source: `field-03` §Val Town.
- **8.3 Backend verification is the hard step, not the import.** "Token formats differ, so any backend middleware needs updating." Source: `field-03` §DEV.to.
- **8.4 SSO/social-link data is the casualty.** LobeHub: simplest path loses SSO connection data; users must manually re-link social accounts. Email/password users are easy; OAuth/SAML-linked identities are the casualties. Source: `field-03` §LobeHub.
- **8.5 Auth0 password-hash bulk export is gated** behind a support request (historical blocker — verify current policy). Source: `field-03`; `ecosystem-05-auth0.md`; flagged in [[badge GAPS-AND-DISPUTES]].

## JTBD-9 — "Operate auth as an AGENT, not a human" (the badge-is-an-agent job)

What badge can DRIVE headless (not click). All from `ecosystem-11-agent-operator-notes.md`.

- **9.1 Discovery is HTTP, not SDK.** Every modern path starts with `GET /.well-known/oauth-protected-resource` (PRM) → AS metadata. Plain fetch; no vendor lock to discover. Source: `ecosystem-11` §1.
- **9.2 Demand machine output: `--json` / NDJSON / agent-mode.** **WorkOS CLI `WORKOS_MODE=agent`** is the gold standard (non-TTY detection, structured errors, NDJSON streaming, headless installer). Never parse human TTY. Source: `ecosystem-11` §WorkOS CLI; §2.
- **9.3 CIMD lets an agent register WITHOUT a write** — host a static client-metadata JSON at an HTTPS URL, pass that URL as `client_id` (SEP-991). Cleaner than DCR for an agent that can host a file. Source: `ecosystem-11` §4.
- **9.4 Agent-side toolbelt:** `workos/cli` (`WORKOS_MODE=agent`) for scaffold/configure/debug; `@better-auth/agent-auth` + `@auth/agent-cli` for self-host agent identity; MCP TS SDK client OAuth helpers for badge-as-MCP-client; MCP Inspector for verification; Auth0 Token Vault + CIBA for P3. Full surface in [[badge TOOL-MATRIX]]. Source: `ecosystem-11` §shortlist.
- **9.5 Token hygiene is spec-enforced, not optional:** Authorization header only (never URL), never log tokens, rotate refresh, validate `aud`=your canonical URI. Source: `ecosystem-11` §3.

## JTBD-10 — "Reason about reliability & blast radius" (the architecture-judgment job)

The judgment that turns a feature comparison into an architecture decision. From `field-02` + `field-05`.

- **10.1 Reliability is the minimum of the combined reliability of its critical parts.** If your IdP holds the session authority and goes down, **logged-in users go down too** — not just new logins. This is WHY teams pull session validation back in-house even while keeping a managed IdP for login. Source: `field-05-practitioner-taste.md` §TASTE 1; `field-02-production-postmortems.md` §Clerk.
- **10.2 Managed-auth outages are CORRELATED, not independent.** A DNS/DB failure at the vendor takes down EVERY tenant at once; self-hosted auth fails independently (your blast radius). Empirical backbone of the "own your auth" movement. Source: `field-02` §meta-pattern.
- **10.3 "Degraded-but-online" is a failure class naive failover misses.** Clerk's Feb 19 2026 Postgres query-plan flip stayed "online but degraded" → failover that watches for "DB down" never fired. Any auth product MUST treat slow/degraded as a failover trigger. Source: `field-02` §Outage B.
- **10.4 Misconfiguration > vendor choice as a breach source.** "I've seen more breaches from misconfigured Auth0 than from choosing the 'wrong' provider." Source: `field-02` §reframing; `field-05` §TASTE 5.
- **10.5 Popularity is NOT a security signal.** Better Auth (300K+ weekly downloads, YC, $5M) shipped an unauth API-key CVE + a coordinated OAuth/SSO/MCP CVE batch. Verify actual behavior (PKCE method, audience binding, account-linking gate) against a checklist; never infer safety from stars. Source: `field-05` §TASTE 5; `field-04-security-cves-version-gotchas.md` §meta-shift.

---

## How badge routes a task (the decision spine)

1. **Place the plane** — human CIAM (Plane 1) or agent/MCP (Plane 2)?
2. **If agent: classify P1/P2/P3/P4** (JTBD-4) before touching a tool.
3. **If "is this safe": apply the intersection rule + per-call policy gate + read/draft/commit gradient** (JTBD-6).
4. **If "which provider": produce a decision with $ breakpoints + the boring-enterprise-details checklist** (JTBD-2), not a feature table.
5. **If "migrate X→Y": emit the dual-validation-window plan + the four casualties immediately** (JTBD-8).
6. **If "SSO/SAML broke": run the 7-step triage runbook** (JTBD-7).
7. **If implementing MCP OAuth: target 2025-11-25, prefer CIMD, test with Inspector** (JTBD-5).
8. **Always: never trust popularity; verify against the checklist; reliability = min of parts** (JTBD-10).
