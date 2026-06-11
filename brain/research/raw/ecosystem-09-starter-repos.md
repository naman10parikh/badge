---
type: research
domain: auth
topic: best starter / template / example repos
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Best starter / template / example repos — June 2026

Star counts + last push via `gh repo view` / `gh search repos` (accessed 2026-06-10). NOTE field quirk: `gh repo view`→`stargazerCount`; `gh search repos`→`stargazersCount`.

## Canonical source repos (the libraries themselves)
| Repo | Stars | Last push | Why |
|------|-------|-----------|-----|
| [better-auth/better-auth](https://github.com/better-auth/better-auth) | **28,659★** | 2026-06-11 | The framework. Pushed DAILY — extremely active. The self-host pick + MCP-SDK-recommended OAuth lib. |
| [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | **12,644★** | 2026-06-11 | MCP TS SDK. Client-side OAuth helpers live here (`OAuthClientProvider`, `extractWWWAuthenticateParams`); server OAuth was REMOVED → use external lib. |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | **87,040★** | 2026-06-07 | Reference MCP servers — study how real servers wire auth/transport. |
| [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector) | **10,049★** | 2026-06-10 | **Visual MCP testing tool — USE THIS to test badge's OAuth flow end-to-end** (it drives the 401→PRM→ASM→DCR→authorize→token→tools/list dance). |
| [clerk/javascript](https://github.com/clerk/javascript) | 1,711★ | 2026-06-11 | Clerk SDKs (the core service is closed-source; this is the client/SDK monorepo). |

## Best human-auth starter templates (Better Auth — the live ecosystem)
| Repo | Stars | Last push | Stack | Why |
|------|-------|-----------|-------|-----|
| [zexahq/better-auth-starter](https://github.com/zexahq/better-auth-starter) | **352★** | 2026-06-07 | Next.js + Drizzle + PostgreSQL + admin dashboard + user management | most-starred, freshly maintained, includes admin/org surface |
| [TheOrcDev/better-auth-starter](https://github.com/TheOrcDev/better-auth-starter) | 343★ | 2026-01-10 | Drizzle + Neon + shadcn | clean minimal Next.js baseline |
| [fluid-design-io/payload-better-auth-starter](https://github.com/fluid-design-io/payload-better-auth-starter) | 112★ | 2026-05-28 | PayloadCMS + Better Auth | if CMS-backed |
| [TheOrcDev/tanstack-start-better-auth-starter](https://github.com/TheOrcDev/tanstack-start-better-auth-starter) | 42★ | 2025-12-03 | TanStack Start | non-Next framework reference |

## Best WorkOS / AuthKit examples (official)
| Repo | Stars | Last push | Why |
|------|-------|-----------|-----|
| [workos/authkit](https://github.com/workos/authkit) | **3,262★** | 2026-04-14 | "the world's best login box" — the AuthKit reference. |
| [workos/auth.md](https://github.com/workos/auth.md) | **418★** | 2026-06-10 | **THE open agent-registration protocol repo.** Pushed today. Read this for the P2 (agent-bootstrap+claim) reference. |
| [workos/next-b2b-starter-kit](https://github.com/workos/next-b2b-starter-kit) | 92★ | 2025-12-11 | enterprise-ready B2B SaaS starter (SSO/SCIM/orgs). The B2B reference. |
| [workos/next-authkit-example](https://github.com/workos/next-authkit-example) | 105★ | 2025-12-15 | minimal Next.js AuthKit example. |
| [workos/mcp.shop](https://github.com/workos/mcp.shop) | 102★ | 2026-04-02 | a real MCP storefront app (built for "MCP Night") — end-to-end MCP+auth example. |

## Best Stytch Connected-Apps / MCP examples (official, `stytchauth`)
| Repo | Stars | Last push | Why |
|------|-------|-----------|-----|
| [stytchauth/mcp-stytch-consumer-todo-list](https://github.com/stytchauth/mcp-stytch-consumer-todo-list) | 27★ | 2026-03-12 | **the canonical Cloudflare Workers + Stytch MCP server example** (consumer). Best starting point for P1 (agent→my MCP server) with a hosted IdP. |
| [stytchauth/mcp-stytch-b2b-okr-manager](https://github.com/stytchauth/mcp-stytch-b2b-okr-manager) | 7★ | 2026-03-12 | B2B variant (org-scoped). |
| [stytchauth/vercel-mcp-example](https://github.com/stytchauth/vercel-mcp-example) | 2★ | 2026-05-12 | Vercel-hosted MCP variant. |
| [stytchauth/mcp-examples](https://github.com/stytchauth/mcp-examples) | 1★ | 2026-02-13 | monorepo of Stytch MCP examples. |

## The agent-auth protocol repos (bleading-edge, low-star = new)
| Repo | Stars | Last push | Why |
|------|-------|-----------|-----|
| [better-auth/agent-auth](https://github.com/better-auth/agent-auth) | 43★ | 2026-05-20 | the `@better-auth/agent-auth` plugin (P4). New + "heavy development." |
| [better-auth/agent-auth-protocol](https://github.com/better-auth/agent-auth-protocol) | (small) | — | the protocol spec (v1.0 published, v2.0 in design). |

## Honest take for badge
- **For a human-auth quickstart:** clone `zexahq/better-auth-starter` (self-host) OR `workos/next-b2b-starter-kit` (hosted+enterprise). Both fresh.
- **For an MCP-server-with-auth quickstart:** `stytchauth/mcp-stytch-consumer-todo-list` (hosted IdP, Cloudflare Workers) is the cleanest end-to-end; `workos/mcp.shop` is a fuller app.
- **For testing whatever badge builds:** `modelcontextprotocol/inspector` — it's the de-facto way to exercise the OAuth handshake against your server without standing up Claude.
- **Telling signal:** the standalone "MCP OAuth server" template repos on GitHub are nearly all **0-3★** (wille/mcp-oauth-server 3★, etc.) — the space is too new for a dominant community template. The mature path is "use Better Auth / Stytch / WorkOS, not a random template." That absence is itself a finding.

## Sources
- gh repo view / gh search repos across the above orgs (accessed 2026-06-10)
