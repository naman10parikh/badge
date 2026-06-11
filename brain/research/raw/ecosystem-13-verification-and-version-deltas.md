---
type: research
domain: auth
topic: GAP verification + current-version deltas (June 2026 re-check)
researcher: ECOSYSTEM (CP123 Wave-R, verification pass)
created: 2026-06-11
status: done
---

# Verification pass + current-version deltas — June 2026

This file is a **second-pass verification** layered on `ecosystem-00..12`. It (a) RESOLVES the three open items in `ecosystem-00-INDEX.md` §GAPS with primary-ish sources, (b) pins the **current versions** of every canonical library (the earlier corpus cited version-specific bugs but rarely stated the live version), and (c) corrects two upgrades to earlier takes — most importantly **Better Auth is no longer weak on enterprise SSO** (the #1-requested SAML issue closed July 2025; v1.5 shipped a hardened SSO/SAML plugin + self-serve onboarding dashboard).

All claims carry URL + access date. Verification done 2026-06-11.

---

## RESOLVED GAP #1 — Clerk Enterprise-SSO pricing (the model CHANGED in Feb 2026)

The prior corpus carried "~$50/connection/mo" from old knowledge and flagged it unverified. The real June-2026 picture is a **pricing-model change**, which is itself the finding:

- **Old model (pre-Feb-2026): "Enhanced Authentication" add-on.** A **$100/month** add-on bundle that included MFA + SAML; SAML connections were described at **$50 each**.
  - Source: [WorkOS — Clerk pricing](https://workos.com/blog/clerk-pricing) (accessed 2026-06-11) — "SAML connections priced at $50… bundled within the Enhanced Authentication: $100/month add-on, alongside MFA."
- **New model (post-2026-02-05 "New plans, more value"): metered Enterprise Connections inside the Pro plan.** Enterprise Connections (SAML **and** OIDC) are now **metered within the Pro plan**, replacing the unlimited-under-add-on structure. Reported terms: **1 enterprise connection included, then ~$75 per additional connection per month**; Pro base ~$20–25/mo; **50,000 free MAU (MRU)** then **~$0.02/user/mo**. "Applications with three or more Enterprise Connections will see increased costs" under the new model.
  - Sources: [Clerk Changelog — New plans, more value (2026-02-05)](https://clerk.com/changelog/2026-02-05-new-plans-more-value); [SuperTokens — Clerk Pricing: The Complete Guide (2026)](https://supertokens.com/blog/clerk-pricing-the-complete-guide) (accessed 2026-06-11) — "1 enterprise connection included; $75 per additional connection per month; ~$0.02 per user per month; Pro ~$20/month"; [Clerk — The real cost of enterprise SSO: per-connection vs per-MAU](https://clerk.com/articles/the-real-cost-of-enterprise-sso-per-connection-vs-per-mau-pricing) (accessed 2026-06-11).
- **badge bottom line:** quote Clerk SSO as **"~$75/additional Enterprise Connection/mo within Pro (1 included), post-Feb-2026 metered model"** — NOT the legacy $50 add-on number. The two coexist in stale blog posts; the metered model is current. Still cheaper per-connection than WorkOS's ~$125/connection and far below Auth0's enterprise gate, but Clerk's MAU pricing kicks in earlier (50K free vs WorkOS 1M free) — so Clerk wins on SSO unit price, WorkOS wins on consumer MAU headroom. (Exact live figure still worth a final check on `clerk.com/pricing`, which is WAF-blocked to automated fetch — see note.)

> Note: `clerk.com/pricing` and most `clerk.com/docs` pages return "unable to verify domain is safe to fetch" to WebFetch (enterprise WAF / bot protection). All Clerk pricing here is triangulated from third-party 2026 analyses + the Clerk changelog/article URLs (which resolved). For a hard quote, drive `clerk.com/pricing` with `bb` (Browserbase) or a browser — flagged in GAPS.

## RESOLVED GAP #2 — Auth0 password-hash export (CONFIRMED still gated in 2026)

Upgraded from "historically true, verify" to **confirmed**:

- **Bulk password-hash export is gated behind a support ticket**, paid-tier only. Exact path: open a ticket → "I have a question regarding my Auth0 account" → **"I would like to obtain an export of my tenant password hashes"** → you receive a compressed JSON of user IDs + password hashes. **Processing can take a week or more.** Not available on the Free subscription tier.
  - Source: search synthesis of Auth0 + third-party migration guides (accessed 2026-06-11): [ZITADEL — Migrate from Auth0 with Password Hashes](https://zitadel.com/docs/guides/migrate/sources/auth0); [FusionAuth — Migrate From Auth0](https://fusionauth.io/docs/lifecycle/migrate-users/provider-specific/auth0); [Auth0 Community — User Migration with custom hash password](https://community.auth0.com/t/user-migration-with-custom-hash-password/86822).
- **The migration-without-hashes alternative (badge should lead with this):** Auth0's **automatic / lazy ("trickle") migration** via a **custom database connection** — you DON'T export hashes at all; instead Auth0 (or the destination IdP) verifies the user's password against the OLD store on next login and silently re-hashes into the new store. Users never reset their password. Trade-off: bulk = fast but needs the hash export; automatic = no hashes needed but drags on until users log in (dormant users never migrate, so you eventually force-reset the long tail).
  - Source: [Auth0 — How to migrate users to Auth0: a technical guide](https://auth0.com/blog/how-to-migrate-users-to-auth0-a-technical-guide/); [WorkOS — Migrate from Auth0](https://workos.com/docs/migrate/auth0) (accessed 2026-06-11).
- **badge bottom line:** the hash-export ticket is real and a week-long blocker, but it's avoidable. For an Auth0→{WorkOS,Clerk,Better Auth} migration, default to **lazy/trickle migration via a custom DB connection** (no hash export, zero user-facing password reset) and only fall back to the bulk hash-export ticket if you must cut over hard/fast or kill the source quickly. This is the single most useful migration fact for the badge employee.

## RESOLVED GAP #3 — auth.md date

Already resolved in the corpus to **2026-05-21, author Garrett Galow** (WorkOS blog). No further dispute. Repo `workos/auth.md` is live and actively pushed (see version table below).

---

## CURRENT VERSIONS — pinned as of 2026-06-11 (the corpus didn't state these)

Verified via `gh release` / `npm view` / `gh issue view` (accessed 2026-06-11):

| Library | Latest STABLE | Pre-release in flight | LTS / pin tag | Cadence signal |
|---|---|---|---|---|
| **better-auth** | **v1.6.16** (2026-06-10) | **v1.7.0-beta.5** (2026-06-10) | **`release-1.4` → 1.4.22** (npm dist-tag) | shipping a patch every 1–3 days; minors ~monthly; **a 1.4 LTS line is maintained** — pin to it for production stability |
| **@workos-inc/authkit-nextjs** | **v4.1.1** (2026-05-27) | — | — | **v4.0.0 was a major on 2026-04-23** (6 weeks before v4.1.1); v3.0.0 was 2026-03-25 → **two majors in ~5 weeks** = real churn |
| **MCP TypeScript SDK** (`modelcontextprotocol/typescript-sdk`) | pushed 2026-06-11 (12.6k★) | — | — | client OAuth helpers only; server OAuth removed (use external lib) |
| **modelcontextprotocol/inspector** | pushed 2026-06-10 (10k★) | — | — | the OAuth-handshake test harness |
| **Clerk** | "Core 3" (2026-03-03) | — | — | majors aggressive (v5→v6→Core 3); SDK monorepo `clerk/javascript` pushed daily |
| **workos/auth.md** | 418★, pushed 2026-06-10 | — | — | the open agent-registration spec repo, actively maintained |
| **better-auth/agent-auth** | 43★, pushed 2026-05-20 | "heavy development, not stable" | — | protocol v1.0 published, v2.0 in design |

**badge production-pinning rule (synthesized):** Better Auth's existence of a **`release-1.4` LTS dist-tag** is the tell — the maintainers themselves acknowledge the `latest` line moves too fast for everyone. For any production auth on Better Auth, pin to a specific patch (or the 1.4 LTS) and gate upgrades behind a full auth E2E (this matches the GitHub-issue meta-lesson in `ecosystem-12`: security/flow regressions land between minors). Same discipline for WorkOS authkit-nextjs given two majors in five weeks.

---

## UPGRADE TO EARLIER TAKE — "Better Auth is weak on enterprise SSO" is now WRONG

The earlier files (`ecosystem-07`, `ecosystem-10`) treated Better Auth's enterprise SSO as "DIY/plugins, less turnkey, SAML was the #1 requested issue." **That snapshot is stale.** Correction:

- **Issue #96 "SAML authentication" — CLOSED 2025-07-02** (71 comments, opened 2024-10-05). SAML is no longer a gap; it shipped.
  - Source: `gh issue view 96 --repo better-auth/better-auth` (accessed 2026-06-11).
- **Better Auth 1.5 (2026-02-28) was the biggest release in the project's history** — "600+ commits, 70 new features, 200 bug fixes, 7 new packages." It hardened the SSO/SAML plugin to enterprise grade:
  - **SAML Single Logout (SLO)** — both SP-initiated and IdP-initiated, configurable signature/digest algorithms.
  - **InResponseTo validation** — replay-attack protection on SAML assertions (and in **v1.6.0 this became the DEFAULT** for SP-initiated flows; opt out via `sso({ saml: { enableInResponseToValidation: false } })`).
  - **ACS error-redirect hardening** — closes open-redirect in the SAML error flow.
  - **XML parser hardening** — configurable size limits on SAML responses/metadata (XXE / billion-laughs defense).
  - **Configurable clock-skew tolerance** for SAML timestamp validation.
  - **OIDC `aud` claim validation** + **Provider CRUD API** (list/get/update/delete SSO providers programmatically) + shared OIDC redirect URI + **multi-domain providers**.
  - **Self-service SSO onboarding dashboard** at `https://dash.better-auth.com/[project]/organization/[orgId]/enterprise` — org admins generate a shareable link that walks an enterprise customer through configuring their SAML IdP. This is the **direct analog to WorkOS's hosted Admin Portal** — the exact feature that used to be WorkOS's moat. Better Auth now has a self-host answer to it.
  - Sources: [Better Auth 1.5 release](https://better-auth.com/blog/1-5) (2026-02-28; accessed 2026-06-11); [Better Auth — SSO plugin docs](https://better-auth.com/docs/plugins/sso) (accessed 2026-06-11); [v1.6.0 release notes](https://github.com/better-auth/better-auth/releases/tag/v1.6.0) (accessed 2026-06-11).
- **badge corrected take:** Better Auth is now a **legitimate enterprise-SSO option, not just a consumer-auth lib**. The SAML security posture (SLO, InResponseTo-by-default, ACS hardening, XML limits) is the stuff enterprise security questionnaires probe — and it's present. The remaining gap vs WorkOS is **SCIM** (still more DIY on Better Auth) and the operational burden of self-hosting the directory-sync ordering/signature logic (`ecosystem-07` SCIM gotchas). So the honest line is: **Better Auth ≈ WorkOS on SSO now; WorkOS still leads on SCIM + zero-ops Admin Portal + ordered Events API.** Update `ecosystem-07`'s table row and `ecosystem-10`'s "Enterprise SSO/SCIM: DIY/plugins" cell to reflect this.

---

## Better Auth 1.5 — the new packages that matter for badge (agent/MCP relevance)

The 1.5 package explosion is directly load-bearing for Energy's MCP-first architecture:

- **`@better-auth/oauth-provider`** — OAuth 2.1 **with OIDC**, grants: `authorization_code`, `refresh_token`, **`client_credentials`** (the M2M grant). Includes **DCR**, JWT/JWKS verification, consent flows, **RFC 7662 introspection + RFC 7009 revocation**, per-endpoint rate limiting. **Replaces the deprecated OIDC Provider plugin.** This is the package that makes a hand-built MCP **server** spec-compliant now that the MCP SDK removed server OAuth (`ecosystem-06`). The `client_credentials` grant + introspection + revocation are exactly the MCP-OAuth-2.1 server primitives.
- **MCP Auth package** — "framework-agnostic remote auth **client**" for token verification without duplicating logic; built-in **Hono** and **Express-like** adapters; handler gets session `{ userId, scopes, accessToken }`. MCP server moved to `mcp.better-auth.com` (per v1.6 notes).
- **`@better-auth/api-key`** — API-key issue/verify, now a **separate package** (was in `better-auth/plugins`). **BREAKING in 1.5:** schema `userId` → `referenceId`, new `configId` field; update imports. (badge migration note: anyone on the old in-core API-key plugin must run this migration.)
- **Seat-based billing** — `seatPriceId` auto-syncs member count to Stripe; also usage-based `lineItems` + subscription schedules. Relevant to Energy's "agents that pay for their own compute" — auth + billing in one lib.
- **Also new in 1.5:** `@better-auth/electron`, `@better-auth/i18n`, dedicated adapter packages (`drizzle`/`prisma`/`kysely`/`mongo`/`memory`), `@better-auth/redis-storage`, `@better-auth/test-utils`, Cloudflare D1 support, CLI init wizard, dynamic base URL.
- Source: [Better Auth 1.5 release](https://better-auth.com/blog/1-5) (2026-02-28; accessed 2026-06-11).

### Better Auth 1.5 breaking changes (the migration tax — badge must warn upgraders)
- API-key plugin: separate install + `userId`→`referenceId` + `configId` (above).
- Deprecated `/forget-password/email-otp` **removed**.
- Test-adapter imports moved: `better-auth/adapters/test` → `@better-auth/test-utils/adapter`.
- `getMigrations` moved to `better-auth/db/migration` subpath.
- **All `@deprecated` APIs removed** (e.g. use `DBAdapter` not `Adapter`).
- Source: [Better Auth 1.5 release](https://better-auth.com/blog/1-5) (accessed 2026-06-11).

### Better Auth 1.6 deltas (on top of 1.5)
- **BREAKING: session `freshAge`** now measured from session *creation* (not update) time; set `session: { freshAge: 0 }` to disable.
- **BREAKING: SAML `InResponseTo` validation ON by default** for SP-initiated flows (above).
- MongoDB now uses native BSON UUID (string UUIDs stay compatible, no migration).
- OpenTelemetry instrumentation (experimental tracing of endpoints/hooks/middleware/DB).
- Non-blocking scrypt password hashing; revoked sessions can't be restored from DB fallback; origin-check middleware on password-reset; pairwise subject identifiers (OIDC Core §8) in oauth-provider; public-client prelogin endpoint; `prompt=none` support fixed.
- Source: [v1.6.0 release notes](https://github.com/better-auth/better-auth/releases/tag/v1.6.0) (accessed 2026-06-11).
- ⚠️ **Currency flag:** the v1.6.0 GitHub page rendered a release date of "April 6, **2025**" to the automated fetch — that is almost certainly a parse/cache error, since v1.5 shipped 2026-02-28 and `gh release list` shows v1.6.11 on 2026-05-12. Treat **v1.6.0 ≈ late-April 2026**, not 2025. Do NOT cite the 2025 date. (Recorded as a GAPS item — exact v1.6.0 date unverified.)

---

## WorkOS authkit-nextjs v4 — the churn the corpus undercounted

`ecosystem-12` cited authkit-nextjs issues but framed it as "actively maintained." The version timeline adds a churn signal badge should weigh:
- **v3.0.0 → 2026-03-25**, **v4.0.0 → 2026-04-23**, **v4.1.1 → 2026-05-27**. **Two majors in ~5 weeks.** This is the same "hosted vendor forces SDK migrations" tax the corpus correctly pinned on Clerk — WorkOS's Next.js SDK has it too, just less discussed. Pair this with the still-OPEN issue #229 ("withAuth on a route not covered by AuthKit middleware," Netlify, post-0.17.2) from `ecosystem-12`.
- Source: `gh release list --repo workos/authkit-nextjs` (accessed 2026-06-11).
- **badge note:** "WorkOS is the stable enterprise pick" is true at the *service/contract* layer (SSO/SCIM/Admin Portal), but its **Next.js SDK churns majors** like everyone else's. Don't sell WorkOS as "no migration debt" — sell it as "the enterprise-readiness service is the moat; budget for SDK majors like any hosted lib."

---

## Net new corrections to feed back into the corpus (for the synthesizer)
1. `ecosystem-00-INDEX.md` §GAPS: mark **#1 (Clerk SSO price) and #2 (Auth0 hash export) RESOLVED**; add new GAP "exact Clerk live pricing is WAF-blocked to fetch — drive via browser" and "Better Auth v1.6.0 exact date unverified (fetch returned a wrong 2025 date)."
2. `ecosystem-07` + `ecosystem-10`: **upgrade Better Auth's enterprise-SSO standing** — #96 closed, v1.5 hardened SAML + shipped a self-serve onboarding dashboard. The only remaining WorkOS-vs-BetterAuth SSO gap is **SCIM + zero-ops Admin Portal + ordered Events API**, not SAML itself.
3. `ecosystem-01` (Clerk): replace the legacy "~$50/connection" line with the **post-Feb-2026 metered model (~$75/additional connection, 1 included)**.
4. `ecosystem-05` (Auth0): upgrade the hash-export note from "could not confirm" to **confirmed + lead with lazy/trickle (custom DB connection) as the no-hash-export path**.
5. Everywhere: **state current versions** — Better Auth **v1.6.16** (1.4 LTS pin available), WorkOS authkit-nextjs **v4.1.1**.

## Sources
- https://workos.com/blog/clerk-pricing (accessed 2026-06-11)
- https://supertokens.com/blog/clerk-pricing-the-complete-guide (accessed 2026-06-11)
- https://clerk.com/changelog/2026-02-05-new-plans-more-value (accessed 2026-06-11, via search index)
- https://clerk.com/articles/the-real-cost-of-enterprise-sso-per-connection-vs-per-mau-pricing (accessed 2026-06-11, via search index)
- https://better-auth.com/blog/1-5 (2026-02-28; accessed 2026-06-11)
- https://github.com/better-auth/better-auth/releases/tag/v1.6.0 (accessed 2026-06-11)
- https://better-auth.com/docs/plugins/sso (accessed 2026-06-11)
- https://zitadel.com/docs/guides/migrate/sources/auth0 (accessed 2026-06-11)
- https://fusionauth.io/docs/lifecycle/migrate-users/provider-specific/auth0 (accessed 2026-06-11)
- https://auth0.com/blog/how-to-migrate-users-to-auth0-a-technical-guide/ (accessed 2026-06-11)
- https://workos.com/docs/migrate/auth0 (accessed 2026-06-11)
- gh release/issue/npm view across better-auth, workos/authkit-nextjs (accessed 2026-06-11)
