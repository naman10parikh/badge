---
title: "badge TOOL-MATRIX — canonical tools, agent-access surface, required secrets"
type: synthesis
domain: auth
created: 2026-06-11
updated: 2026-06-11
tags: [tool-matrix, secrets, cli, mcp, agent-access, auth, badge, cp123]
sources: ["brain/research/raw/ecosystem-11-agent-operator-notes.md", "brain/research/raw/ecosystem-09-starter-repos.md", "brain/research/raw/ecosystem-04-stytch.md", "brain/research/raw/ecosystem-03-workos-authkit.md", "brain/research/raw/ecosystem-02-betterauth.md", "brain/research/raw/ecosystem-05-auth0.md", "brain/research/raw/ecosystem-01-clerk.md", "brain/research/raw/ecosystem-06-mcp-oauth.md", "brain/research/raw/ecosystem-10-tradeoff-matrix.md"]
related: ["[[badge EXPERTISE-MAP]]", "[[badge OPINIONS]]", "[[badge KNOWN-PITFALLS]]", "[[badge GAPS-AND-DISPUTES]]"]
summary: "Canonical tools by job — default vs alternatives, when-to-use-which, the agent-access surface (CLI/API/MCP), and the key env vars/secrets each needs (feeds the Wave-P Required-Secrets manifest)."
---

# badge TOOL-MATRIX

> For each job: the **DEFAULT** tool, the **ALTERNATIVES**, **WHEN to use which**, the **AGENT-ACCESS surface**
> (what badge can actually DRIVE — CLI/API/MCP, headless), and the **SECRETS** each needs. The §Required-Secrets
> manifest at the bottom is the Wave-P input. badge is an AGENT, so the agent-access column is load-bearing —
> prefer tools with `--json`/NDJSON/agent-mode. Picks encode taste from [[badge OPINIONS]].

---

## JOB → DEFAULT tool (the one-line routing table)

| Job (JTBD) | DEFAULT | Why default | Alts |
|---|---|---|---|
| Human CIAM, Next.js, fastest DX | **Clerk** | best-in-class components + orgs | WorkOS AuthKit; Better Auth |
| Human CIAM, B2B must close enterprise | **WorkOS AuthKit** | SSO/SCIM/Admin Portal reference + 1M MAU free | Auth0; Clerk (paid SSO) |
| Self-host / own-DB / sovereignty | **Better Auth** | own your Postgres; MCP-SDK-blessed AS | Ory / Zitadel / Hanko (EU) |
| Migrate OFF (price/Okta-tax) | source=**Auth0** → target=**WorkOS/Better Auth** | per-connection vs per-MAU; or $0 self-host | Firebase (per defectors) |
| P1: agent → MY MCP server | **Stytch Connected Apps** | most MCP-spec-literal hosted; standalone-on-existing-IdP | Better Auth OAuth-2.1-Provider; raw MCP OAuth |
| P2: agent identity bootstrap + human claim | **WorkOS `auth.md`** | open, provider-neutral; composes with MCP OAuth | (no real alt — it's the new primitive) |
| P3: agent → 3rd-party SaaS on user's behalf | **Auth0 Token Vault + CIBA** | Token Exchange; agent never holds raw creds | per-provider remote MCP server (mcp-first pattern) |
| P4: self-host capability-scoped agents | **Better Auth `agent-auth`** | open + self-hostable | (bet on Agent Auth Protocol — see DISPUTE G) |
| Build/secure MCP OAuth (server) | **external AS** (Better Auth / Stytch / WorkOS) | SDK removed server OAuth | roll-your-own to 2025-11-25 |
| Agent-driven auth scaffolding (badge as operator) | **WorkOS CLI `WORKOS_MODE=agent`** | most agent-native auth tool shipped | `@auth/agent-cli` (Better Auth) |
| Test any connector badge builds | **MCP Inspector** | drives full OAuth handshake | manual curl of `.well-known/*` |

---

## TOOL DETAIL (default → alts, with agent-access + secrets)

### 1. Clerk — human CIAM (hosted)
- **Use when:** Next.js consumer/prosumer/B2C, velocity > control, not yet enterprise-SSO-heavy. **Avoid when:** you can't stomach forced majors / hosted user data / session-authority SPOF.
- **Current surface:** Core 3 (2026-03-03); `clerkMiddleware()` (protects nothing by default); `auth()` is async; Node 20.9.0+. Machine Auth = machine tokens / API keys / OAuth tokens (JWT vs opaque). M2M tokens GA 2025-10-14 (JWT-issuable). SCIM GA 2026-04-16.
- **Agent-access:** NO first-class agent-mode CLI. `npx @clerk/upgrade` = human-migration codemods. Agent toolkit is "experimental / testing only," injects `userId`/`sessionId`/`orgId`, **no independent agent identity, no end-to-end auditing** (immature). API + webhooks for backend sync.
- **SECRETS:** `CLERK_SECRET_KEY` (backend), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend), `CLERK_WEBHOOK_SIGNING_SECRET` (verify webhooks — see Scenario 8 sync drift). Source: `ecosystem-01`; `field-07` §where-vendors-are.

### 2. WorkOS AuthKit — human CIAM + enterprise + the agent registration primitive
- **Use when:** B2B that must close enterprise (SSO/SCIM/Admin Portal); cost-sensitive consumer (1M MAU free). **Avoid when:** you need self-host, or general consumer DX outside the SSO lane (DISPUTE E).
- **Current surface:** 1M MAU free (SSO/SCIM PAID, ~$125/connection); ordered Events API (in-order, real-time SCIM — a genuine differentiator); `auth.md` (P2, 2026-05-21, AuthKit support early-access); "MCP Auth" product + OBO writeup.
- **Agent-access — THE standout:** `workos/cli` (51★) is **AI-powered, agent-mode**: non-TTY detection, `--json` everywhere, NDJSON streaming, headless installer, **`WORKOS_MODE=agent`** for deterministic automation. Commands: `install`, `seed` (declarative YAML), `setup-org`, `onboard-user`, `debug-sso`, `debug-sync`, resource CRUD. 15 frameworks. auth.md is HTTP-native (no SDK needed agent-side).
- **SECRETS:** `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD` (AuthKit session encryption, ≥32 chars), redirect URI config. CLI: `--api-key` / `--client-id` flags or env. Source: `ecosystem-03`; `ecosystem-11` §WorkOS CLI.

### 3. Better Auth — self-host human CIAM + the hand-built-MCP-server substrate
- **Use when:** own-DB / compliance / no-lock / EU sovereignty, or your app must BE an OAuth AS. **Avoid when:** you want zero-ops turnkey UI, or you're federating to an existing IdP without a Better-Auth-owned user table (BA #2202). **PIN versions** (O10).
- **Current surface (28,659★, pushed daily):** core session auth (excellent); OAuth 2.1 Provider plugin (= MCP-OAuth-compliant AS); `agent-auth` plugin (P4, UNSTABLE, v2 in design); `mcp` / `oidc-provider` / `sso` / `scim` / `device-authorization` plugins (**the 2026-05-31 CVE-batch surface — verify hard**). MCP TS SDK *recommends* Better Auth for server OAuth.
- **Agent-access:** `npx auth migrate` / `npx auth generate` (headless schema); **`@auth/agent-cli` + `@auth/agent`** = a CLI specifically for AGENTS to drive the Agent Auth flow (register/list/execute); MCP adapter exposes agent-auth as MCP tools.
- **SECRETS:** `BETTER_AUTH_SECRET` (session signing), `BETTER_AUTH_URL` (canonical base / `aud`), `DATABASE_URL` (your Postgres/MySQL/SQLite), per-social-provider `*_CLIENT_ID`/`*_CLIENT_SECRET`. Source: `ecosystem-02`; `ecosystem-09`; `ecosystem-11`.

### 4. Auth0 (Okta) — migration source + best-in-class P3 (Token Vault + CIBA)
- **Use when:** buyer mandates Okta / needs its certs; OR task is **P3** (agent acts in user's Google/Slack). **Avoid when:** price-sensitive human auth (the "Okta tax": $240→$3,729/mo, 15.54x).
- **Current surface:** Auth0 for AI Agents **GA 2026**. **Token Vault** — Token Exchange so the agent never holds the provider's raw refresh token; full token lifecycle; runtime API-access request. **CIBA** — async human-in-the-loop approval on another device. Free tier: 2 connected apps + async auth. Integrates with Amazon Bedrock AgentCore.
- **Agent-access:** Token Vault API (agent requests scoped 3rd-party token at runtime, never sees raw creds); CIBA (agent triggers backchannel approval, polls/awaits grant). Maps 1:1 to MCP "no token passthrough."
- **SECRETS:** `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, plus per-connected-provider creds held in Token Vault (the point: the AGENT doesn't hold them). Source: `ecosystem-05`; `ecosystem-11` §Auth0.

### 5. Stytch Connected Apps — the turnkey P1 (agent → my MCP server)
- **Use when:** you already have auth and just need **standards-correct MCP/agent OAuth without replacing your IdP** (standalone layer). Most MCP-spec-literal hosted vendor. **Avoid when:** you need self-host or an open spec.
- **Current surface:** PRM (`/.well-known/oauth-protected-resource`) + ASM (`/.well-known/oauth-authorization-server`) + **DCR opt-in (enable in dashboard — KNOWN-PITFALL E3)** + PKCE; access tokens = JWT RS256; refresh = 3600s (rotation **UNCONFIRMED — U7**); each client gets unique `client_id`. Endpoints: authorize `/oauth/authorize`, token `/v1/oauth2/token`, register `/v1/oauth2/register`, JWKS `/.well-known/jwks.json`.
- **Agent-access:** agent speaks MCP OAuth; Stytch is the AS. Backend verify via `client.idp.introspectTokenLocal(token)` or JWKS. Frameworks: `mcp-handler` + `@hono/stytch-auth` (Next/Hono); FastMCP `BearerAuthProvider` (Python). Consent UI: `<IdentityProvider/>` / `<B2BIdentityProvider/>`. Canonical example: `stytchauth/mcp-stytch-consumer-todo-list` (Cloudflare Workers).
- **SECRETS:** `STYTCH_PROJECT_ID`, `STYTCH_SECRET`, `STYTCH_PUBLIC_TOKEN`; the Stytch domain for the AS endpoints. Source: `ecosystem-04`; `ecosystem-09`; `ecosystem-11`.

### 6. Raw MCP OAuth 2.1 (roll-your-own to 2025-11-25) — full control / Energy's mcp-first rule
- **Use when:** you want zero vendor + Energy's `mcp-first-connectors.md` default, and have the auth eng. **Avoid when:** you lack auth bandwidth (use a broker). Pair the AS with Better Auth (SDK punted server OAuth).
- **Implement (2025-11-25 baseline):** PKCE S256 · `resource=` on authorize+token (RFC 8707) · **CIMD > DCR > pre-registered** (SEP-991) · PRM via `.well-known` even sans `WWW-Authenticate` (SEP-985) · incremental-scope step-up (SEP-835) · refresh rotation + reuse-detection (atomic) · `aud` = canonical URI · 403 on bad Origin · (RC) `iss` validation (RFC 9207). Full RFC stack: 8693/8707/9449-DPoP/9126-PAR/9396-RAR.
- **Agent-access (badge as MCP CLIENT):** MCP TS SDK client helpers — `OAuthClientProvider`, `handleOAuthUnauthorized`, `extractWWWAuthenticateParams`. Discovery is plain HTTP. CIMD = register without a write (host static client-metadata JSON).
- **SECRETS:** your own AS signing keys (JWKS private key), client creds per connector (or a hosted CIMD doc URL → no client_secret), `aud`/issuer config. Source: `ecosystem-06`; `ecosystem-11`; `field-07`.

---

## Repos badge should clone / study (agent-runnable)

| Repo | ★ | Use |
|---|---|---|
| `modelcontextprotocol/inspector` | 10,049 | **TEST badge's OAuth flow end-to-end** (401→PRM→ASM→DCR→authorize→token→tools/list) — O25 |
| `modelcontextprotocol/typescript-sdk` | 12,644 | client-side OAuth helpers (server OAuth removed) |
| `modelcontextprotocol/servers` | 87,040 | study real server auth/transport wiring |
| `stytchauth/mcp-stytch-consumer-todo-list` | 27 | canonical Cloudflare-Workers + Stytch MCP server (P1 quickstart) |
| `workos/auth.md` | 418 | THE open agent-registration protocol (P2 reference; pushed daily) |
| `workos/mcp.shop` | 102 | fuller MCP + auth example app |
| `workos/next-b2b-starter-kit` | 92 | enterprise B2B (SSO/SCIM/orgs) reference |
| `zexahq/better-auth-starter` | 352 | most-starred self-host human-auth starter (Next+Drizzle+Postgres+admin) |
| `better-auth/agent-auth` | 43 | the P4 plugin (new, "heavy development") |

> Telling signal: standalone "MCP OAuth server" templates are nearly all 0–3★ — **use a real AS, not a template** (O26). Source: `ecosystem-09`.

---

## §Required-Secrets manifest (Wave-P input)

> Grouped by tool. NONE are committed — `.env` gitignored (`.env.example` documents shape).
> badge needs these to operate each tool as an agent. Token hygiene is spec-enforced (O14, J2): Authorization
> header only, never log, never in URL, rotate refresh, validate `aud`.

**Clerk:** `CLERK_SECRET_KEY` · `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` · `CLERK_WEBHOOK_SIGNING_SECRET`
**WorkOS:** `WORKOS_API_KEY` · `WORKOS_CLIENT_ID` · `WORKOS_COOKIE_PASSWORD` (≥32 chars) · (CLI honors `WORKOS_MODE=agent`)
**Better Auth:** `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` · `DATABASE_URL` · per-provider `*_CLIENT_ID`/`*_CLIENT_SECRET`
**Auth0:** `AUTH0_DOMAIN` · `AUTH0_CLIENT_ID` · `AUTH0_CLIENT_SECRET` · (Token Vault holds per-connected-provider creds — agent does NOT)
**Stytch:** `STYTCH_PROJECT_ID` · `STYTCH_SECRET` · `STYTCH_PUBLIC_TOKEN` · Stytch domain (AS endpoints)
**Raw MCP OAuth (own AS):** AS JWKS private signing key · per-connector client creds OR a hosted CIMD `client_id` URL (no secret) · `aud`/issuer config
**badge-as-MCP-client / self-improvement loop:** `CLAUDE_CODE_OAUTH_TOKEN` (lights the Claude half of the DSIP RSI loop per `dsip.json`; deterministic half is tokenless)

**Secret-hygiene rules (enforced):** validate webhook signatures before processing (Clerk/SCIM — H1); allowlist OIDC issuer hosts + block internal IPs on metadata fetch (SSRF — A4); never log tokens/assertions (J2, O31); exact-match HTTPS redirect URIs (F2). Source: `ecosystem-01`–`06`, `ecosystem-11`; secret shapes per each provider's quickstart.

---

## External-intelligence watchlist (feeds `dsip.json` externalIntelligence — re-check at each RSI cycle)

The auth/agent-identity space moves fast (CVE batch 2026-05-31; MCP spec 2025-11-25 + 2026-07-28 RC; auth.md May 2026). badge's nightly loop should watch:
1. **MCP spec changelog** (`modelcontextprotocol.io/specification/.../changelog`) — new SEPs, RC→stable promotions (track `iss` RFC 9207, `application_type` SEP-837).
2. **`gh api repos/better-auth/better-auth/security-advisories`** — the library churns; new GHSAs land in batches.
3. **Clerk changelog** — aggressive majors (v5→v6→Core 3) + pricing changes (Feb 5 2026) + SCIM GA (Apr 16 2026).
4. **WorkOS blog + `workos/auth.md` repo** (pushed daily) — auth.md evolution, AuthKit agent GA.
5. **agentauthprotocol.com** — Agent Auth Protocol v2 (sub-agent derivation — badge's most strategic frontier, E5).
6. **Vendor pricing pages** — every $ figure in this file is a snapshot; re-verify (U1, U4, U5).

When a watched source changes a fact, update the relevant brain file in place (consolidate-never-expand) and write the delta to `ORG_MEMORY`. Source: `dsip.json` externalIntelligence; `field-08` (the 2026 shifts that invalidated 2025 wisdom — the pattern repeats).
