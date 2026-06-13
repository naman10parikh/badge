# badge

> **Who you are, what you're allowed, proven — not assumed.** Powered by Energy.

badge is the Energy fleet's **auth** domain-expert employee — **AuthN/AuthZ/SSO/SCIM + agent identity**. It's a
tool-employee, not a product: coding agents (Claude Code, the Energy hub, sibling employees) call it via **CLI +
MCP** to get a real sign-in working in an app, pick the right provider as a *decision*, audit OAuth/MCP configs
against the latest CVE class, triage SAML/SSO failures, and plan provider migrations — always enforcing the one
rule that separates competent agent-auth from catastrophic: an agent's authority is the strict **INTERSECTION** of
agent and user permissions, never the union.

The asset is badge's `brain/` (judgment built from 16 named incidents, 35 taste stances, and version-pinned CVEs);
the CLI/MCP/skills/cockpit are thin surfaces over it. badge does **not** do payments (that's penny), the login-box
UI (pixel), the users-table schema (acorn), or deploy/CI (rocket).

## What it does

- **Scaffold** — `badge init --provider clerk` writes a working sign-in→protected-route flow into a Next.js app
  (the acceptance test; alts: betterauth/workos/stytch).
- **Classify** — `badge classify "<task>"` places the plane (human CIAM vs agent/MCP) and classifies any
  agent-auth task as **P1/P2/P3/P4** before a tool is chosen. badge's core verb.
- **Advise** — `badge advise --use-case enterprise --mau 100000` returns a *decision* with $ breakpoints + the
  boring-enterprise-details checklist, not a feature table.
- **Audit** — `badge audit <path> --mcp` runs the pitfall checklist (PKCE method, RFC-8707 audience bind,
  account-linking gate, rotation atomicity, redirect exactness, `alg=none`).
- **Triage** — `badge saml-triage "<symptom>"` runs the 7-step SAML/SSO runbook.
- **Migrate** — `badge migrate --from clerk --to betterauth` emits the dual-validation-window plan + the four
  casualties.
- **MCP-check** — `badge mcp-check <url>` drives PRM→ASM→DCR/CIMD→authorize→token→tools/list against an MCP server
  (spec target **2025-11-25, CIMD > DCR**).

Every command takes `--json`. The same verbs are exposed as MCP tools (`badge_classify`, `badge_advise`,
`badge_audit`, `badge_saml_triage`, `badge_migrate`, `badge_mcp_check`) over a stdio server in `.mcp.json`.

## Quick start

```bash
pnpm install
pnpm build
node bin/badge classify "an agent needs to call my MCP server" --json
node bin/badge advise --use-case enterprise --mau 100000 --json
```

The local cockpit (for the chairman's eyes — agents use CLI/MCP):

```bash
node cockpit/server.mjs   # → http://localhost:7788
```

## For agents

- **[AGENTS.md](AGENTS.md)** — the full agent-facing guide: tool list (CLI + MCP), the P1–P4 router quick-ref,
  the boundary/NOT-list, and how to call badge correctly.
- **[llms.txt](llms.txt)** — the machine map of every surface.
- **[.well-known/agent.json](.well-known/agent.json)** — the A2A agent card.
- **[CLAUDE.md](CLAUDE.md)** — the operating rules (the decision spine + non-negotiables).

## How it works (the harness)

badge is a complete agent-native, recursively self-improving harness — identity, a queryable brain (BM25 over
`brain/`), skills, the `badge` CLI, an auth-lint hook, two sub-agent personas, its own MCP server, a task-classifier
dispatch, an eval pyramid (L1/L2/L3 + the acceptance E2E), observability (`logs/runs.jsonl`), an isolated sandbox,
and a deterministic RSI loop that keeps its auth expertise current as the field moves. The contract is `PLAN.md`;
the build board is `MASTER-TODOS.md`; the per-component DONE bar is `HARNESS-OVERRIDES.md`.

## License

MIT
