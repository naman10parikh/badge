# AGENTS.md — badge (the Auth employee)

> **For coding agents (Claude Code, the Energy hub, sibling employees) that call badge.**
> badge is a **tool-employee, not a product**: you reach it via **CLI + MCP**, plus a local cockpit for the
> chairman's eyes. The asset is `brain/` (judgment); the CLI/MCP/skills/cockpit are thin surfaces over it.
> Powered by Energy.

## What badge is

The Energy fleet's **auth** domain-expert. It owns **AuthN** (who is the principal), **AuthZ** (what may they
do), **SSO/SCIM** (enterprise federation + lifecycle), and **agent identity** (the 2026 battleground — agents as
a new principal type). It is fluent across two planes: **Plane 1** human CIAM ("the login box") and **Plane 2**
agent/MCP auth — and its reason to exist is Plane 2.

THE acceptance bar: `badge init --provider clerk` in a fresh `create-next-app` → Playwright completes a
sign-in→protected-route E2E with Clerk **test** keys, green ×3 in CI.

## Tool list — CLI (`badge`)

Every command emits structured output under `--json` (never parse a human TTY — OP O34). Exits 0 on success,
non-zero on error.

| Command | What it does | Brain |
| --- | --- | --- |
| `badge init --provider <clerk\|betterauth\|workos\|stytch> [--target <dir>] [--json]` | Scaffold auth into a target app to a working sign-in→protected-route flow (THE acceptance test). | EM JTBD-1 |
| `badge classify "<task>" [--json]` | Place the plane (1/2) + classify **P1/P2/P3/P4**, return the default tool + why. **badge's core verb.** | EM JTBD-4 |
| `badge advise --use-case <consumer\|b2b\|enterprise\|self-host> [--mau <n>] [--enterprise] [--json]` | A **decision** with $ breakpoints + the boring-enterprise-details checklist — not a feature table. | OP O5 |
| `badge audit <path> [--mcp\|--scim\|--agent\|--saml] [--json]` | Run the pitfall checklist (PKCE method, RFC-8707 audience bind, account-linking gate, rotation atomicity, redirect exactness, `alg=none`). Flags severity + the fix. | KP A–J |
| `badge saml-triage "<symptom>" [--json]` | Run the 7-step triage runbook (timestamps→cert→ACS→Issuer→Audience→sig-alg→Destination). | EM JTBD-7 |
| `badge migrate --from <provider> --to <provider> [--json]` | Emit the dual-validation-window plan + the four casualties (sessions, SSO, social links, custom claims). | EM JTBD-8 |
| `badge mcp-check <url> [--json]` | Drive PRM→ASM→DCR/CIMD→authorize→token→tools/list against an MCP server; report spec gaps (target **2025-11-25**). | OP O25 |
| `badge runs [--since <ts>] [--json]` | Aggregate `logs/runs.jsonl` (the observability view). | — |
| `badge --help \| --version` | Standard. | — |

## Tool list — MCP (`badge` stdio server)

Wired in `.mcp.json` (`node dist/mcp/server.js`, stdio, env-refs only — no live keys). `tools/list` returns:

- `badge_classify({ task }) → { plane, problem: "P1|P2|P3|P4", default_tool, alternatives, rationale, cites }`
- `badge_advise({ useCase, mau?, enterprise? }) → { recommendation, breakpoints, checklist, reliability_note }`
- `badge_audit({ path|config, kind?: "mcp|scim|agent|saml" }) → { findings:[{ severity, rule, cve?, fix }] }`
- `badge_saml_triage({ symptom }) → { steps, most_likely_cause, fix }`
- `badge_migrate({ from, to }) → { plan, casualties, window }`
- `badge_mcp_check({ url }) → { discovered, dcr_or_cimd, pkce_method, audience_bound, gaps }`
- (resources) `badge://brain/{file}` — the 5 brain files exposed as readable MCP resources.

## The P1–P4 router (quick reference — badge's single most important model)

Before reaching for a vendor name: **place the plane**, then if it's an agent, **classify the P**.

- **P1** Agent → **MY** MCP server (needs a scoped token to call my server) → default **Stytch Connected Apps**
  (alts: BetterAuth OAuth-2.1-Provider, raw MCP OAuth). DCR is **opt-in** in Stytch (KP-E3).
- **P2** Agent identity **bootstrap** + human ownership (the agent has no identity; register + a human vouches) →
  default **WorkOS `auth.md`**.
- **P3** Agent → **THIRD-PARTY** SaaS on a user's behalf (act in the user's Google/Slack without holding creds) →
  default **Auth0 Token Vault + CIBA**.
- **P4** Capability-scoped autonomous agents, **self-host** → default **BetterAuth `agent-auth`** (UNSTABLE, v2 in
  flight — GD-G).

The master rule for every "can the agent do X": effective authority = the strict **INTERSECTION** of agent and
user permissions, never the union (OP O16). Route every tool call through a policy gate; enforce a read/draft/commit
gradient (OP O17/O18). Spec target: **MCP 2025-11-25**, **CIMD > DCR** (the internal corpus's 2025-06-18 / DCR>CIMD
is one revision behind — KP-E1/E2).

## Boundary — what badge does NOT own (refuse + redirect)

- ❌ **Payments / billing identity** (Stripe customer, entitlement, subscription state) → **penny**. badge issues
  the *identity*; penny moves the *money*.
- ❌ **Frontend / UI of the login box** (component styling, layout, design system) → **pixel**. badge wires the
  auth; pixel makes it pretty.
- ❌ **Database schema for the users table** beyond the auth-owned columns → **acorn**. badge's stance is "keep
  your own users table" (OP O2); acorn designs it.
- ❌ **Deploy / CI of the app** → **rocket**. ❌ **Backend API business logic** → **turbo**.
- ❌ **Earning loops / agent P&L** → **helios**.
- ❌ **Non-TS/JS framework-native auth depth** (Laravel/Rails/Django ship auth in the box — OP O6). badge *says so*
  but has no implementation depth there.

## What NOT to do (calling badge wrong)

- **Don't ask badge for Stripe / billing.** That's penny. badge will refuse and redirect.
- **Don't infer auth-library safety from stars / funding / popularity** (OP O9). Better Auth — 300K+ weekly
  downloads, YC, $5M — shipped an unauth API-key CVE *and* a coordinated 2026-05-31 OAuth/SSO/MCP/SCIM advisory
  batch. badge verifies *behavior* against the checklist + the running build, never the README.
- **Don't compute an agent's authority as the union** of agent+user perms. badge enforces the intersection.
- **Don't expect a hosted endpoint.** For C1 badge's MCP server is **stdio-local** and the CLI is a local bin
  (`node bin/badge …`); discovery against external MCP servers is plain HTTP `fetch` (no browser needed).
- **Don't ask badge to roll its own OAuth/OIDC/SAML provider** (OP O8). It scaffolds/audits a real AS; it never
  hand-rolls federation.

## Where to read more

- **Brain (the judgment):** `brain/EXPERTISE-MAP.md` (the JTBD decision spine) · `brain/BATTLE-TESTED-SCENARIOS.md`
  (16 named incidents) · `brain/KNOWN-PITFALLS.md` (version-pinned CVEs + DETECT/AVOID) · `brain/OPINIONS.md` (35
  taste stances) · `brain/GAPS-AND-DISPUTES.md` · `brain/TOOL-MATRIX.md` (default vs alts).
- **Operating rules:** `CLAUDE.md` (the decision spine + non-negotiables).
- **Skills:** `skills/auth-provider-selection` · `skills/agent-auth-classifier` · `skills/mcp-oauth-audit` ·
  `skills/saml-sso-triage` (+ `skills/auth-migration-planner`).
- **Machine map:** `llms.txt` (repo root). **A2A card:** `.well-known/agent.json`.
