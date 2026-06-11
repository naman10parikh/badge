---
type: research
domain: auth
tool: Clerk
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Clerk — June 2026 state of the art

## Current version: Core 3 (released 2026-03-03)

Clerk uses a unified "Core N" version label across all SDKs. **Core 3** is the current major as of June 2026.
- Source: [Clerk Changelog — Core 3](https://clerk.com/changelog/2026-03-03-core-3) (accessed 2026-06-10), dated 2026-03-03.
- Upgrade tool: `npx @clerk/upgrade` — scans codebase and applies codemods for most breaking changes.
- Requires **Node.js 20.9.0+**.

### Core 3 breaking changes (the load-bearing ones)

| Change | Detail | Migration impact |
|--------|--------|------------------|
| Package renames | `@clerk/clerk-react` → `@clerk/react`; `@clerk/clerk-expo` → `@clerk/expo` | import paths change everywhere |
| `@clerk/types` deprecated | types now via subpath exports from SDK packages | remove direct `@clerk/types` dep |
| Component consolidation | `<SignedIn>`, `<SignedOut>`, `<Protect>` → single `<Show>` with `when` prop. `when="signed-in"`, `when="signed-out"`, `when={(has) => has({ role: 'admin' })}` | every guard component must be rewritten |
| `getToken()` offline semantics | now THROWS `ClerkOfflineError` when offline (previously returned `null`). `null` now unambiguously = signed out | any code treating `null` as "offline" breaks |
| Proactive background token refresh | tokens refresh before expiry | fewer stale-token bugs |
| Clerk Elements deprecated | in favor of redesigned `useSignIn`/`useSignUp`/`useCheckout` hooks | custom-flow UIs must migrate |
| Hooks redesigned | `useSignIn`/`useSignUp`/`useCheckout` expose `fetchStatus` ("idle"\|"fetching"), structured `errors.fields`, `signIn.status` ("needs_first_factor"\|"needs_second_factor"\|"complete") | error-handling code changes |
| New `useWaitlist` hook | waitlist support | additive |

Source for all rows: [Clerk Changelog — Core 3](https://clerk.com/changelog/2026-03-03-core-3) (2026-03-03).

### Core 3 additive features
- Theme editor (visual component customization).
- Keyless mode for TanStack Start, Astro, React Router.
- `satelliteAutoSync` option (default `false`).
- `UNSAFE_PortalProvider` for custom portaled UI.
- `clerkMiddleware` Frontend API proxy via `frontendApiProxy: { enabled: true }`.

## App Router API (current canonical surface)

The v5→v6 transition (which Core 3 builds on) already changed the App Router story; the key facts as of June 2026:

- **`clerkMiddleware()` is the middleware** (replaced `authMiddleware()`). It **protects NOTHING by default** — you opt routes in. This is the opposite of the old `authMiddleware()` which protected all routes by default.
  - Source: [clerkMiddleware() | Next.js — SDK Reference](https://clerk.com/docs/reference/nextjs/clerk-middleware) (accessed 2026-06-10).
- **`authMiddleware()` was REMOVED in v6.** It survived (deprecated) in v5; v6 deleted it. Migrating off it is mandatory for anyone on v6/Core 3.
  - Source: [Upgrade to @clerk/nextjs v6](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/nextjs-v6) (accessed 2026-06-10).
- **`auth()` is ASYNC** — must be `await`ed in App Router (Server Components, Route Handlers, Server Actions). Synchronous `auth()` is gone.
  - It exposes `isAuthenticated`, `userId`, `redirectToSignIn`, and `has()` for authz checks.
  - Source: [auth() — App Router — Next.js](https://clerk.com/docs/reference/nextjs/app-router/auth) (accessed 2026-06-10).
- **Classic footgun (still the #1 error):** "auth() was called but Clerk can't detect usage of clerkMiddleware()." Means the middleware file isn't matched by the route, or the matcher excludes it. Dedicated error doc exists.
  - Source: [Clerk: auth() was called but Clerk can't detect usage of clerkMiddleware()](https://clerk.com/docs/reference/nextjs/errors/auth-was-called) (accessed 2026-06-10).

Minimal current pattern (Core 3 / v6, App Router):
```ts
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
const isProtected = createRouteMatcher(['/dashboard(.*)'])
export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect()   // opt-in protection
})
// in a Server Component / Route Handler:
import { auth } from '@clerk/nextjs/server'
const { userId, isAuthenticated } = await auth()   // MUST await
```

## Organizations (B2B)

- Clerk has first-class **Organizations**: memberships, roles, permissions, invitations, org switcher UI. Roles checked via `auth().has({ role: 'org:admin' })` / `has({ permission: '...' })`.
- This is Clerk's main B2B SaaS surface and is included in the core product (not a paid add-on for basic org features).

## SAML / Enterprise SSO add-on

- **Enterprise SSO (SAML + OIDC) is a paid add-on**, not in the free tier. Clerk supports SAML connections to Okta, Google Workspace, Microsoft Entra/Azure AD, plus custom SAML IdPs, and EASIE (Enterprise-Assertion SSO via Google/Microsoft).
- Pricing note: Enterprise SSO historically billed per-connection (~$50/connection/mo on the Pro plan tier) — TREAT AS APPROXIMATE, verify on current pricing page. (Flagged: pricing changes frequently; could not confirm exact June-2026 number from a primary source in this pass — see GAPS.)

## Machine / agent authentication (Clerk's M2M story)

Clerk shipped a **Machine Authentication** product. As of June 2026 it covers:
- **Machine tokens** — long-lived tokens for backend services / M2M.
- **OAuth tokens** — Clerk can act as an OAuth provider.
- **API keys** — issue/verify API keys for your own API.
- Token formats: **JWT** (self-contained, networkless verification via instance public key, CANNOT be instantly revoked) vs **Opaque** (random string, DB lookup, CAN be instantly revoked, adds latency).
  - Source: [Token formats — Machine authentication](https://clerk.com/docs/guides/development/machine-auth/token-formats) (accessed 2026-06-10).
- Trade-off is the classic one: JWT = fast + unrevokable-until-expiry; opaque = revocable + network-dependent. badge should default agents to **short-lived JWT** for hot-path verification and opaque only where instant revocation is a hard requirement.

## Honest take for badge
- **Best fit:** Next.js App Router consumer/prosumer apps that want batteries-included UI components + organizations with minimal code. Core 3's `<Show>` + async `auth()` is clean.
- **Friction:** opinionated, hosted-only (your user data lives at Clerk), and Enterprise SSO/SCIM is paid. The v5→v6→Core 3 churn (authMiddleware removal, package renames, async auth) means migration debt is real and recurring — Clerk ships majors aggressively.
- **Agent plane:** Machine auth exists but is M2M-token-flavored, not a full agent-registration/claim protocol like WorkOS `auth.md` or Better Auth `agent-auth`. Clerk is a human-CIAM-first product that bolted on M2M; it is NOT the pick if the core problem is "agents register themselves against my MCP server."

## Sources
- https://clerk.com/changelog/2026-03-03-core-3 (2026-03-03)
- https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3 (accessed 2026-06-10)
- https://clerk.com/docs/guides/development/upgrading/upgrade-guides/nextjs-v6 (accessed 2026-06-10)
- https://clerk.com/docs/reference/nextjs/clerk-middleware (accessed 2026-06-10)
- https://clerk.com/docs/reference/nextjs/app-router/auth (accessed 2026-06-10)
- https://clerk.com/docs/reference/nextjs/errors/auth-was-called (accessed 2026-06-10)
- https://clerk.com/docs/guides/development/machine-auth/token-formats (accessed 2026-06-10)
