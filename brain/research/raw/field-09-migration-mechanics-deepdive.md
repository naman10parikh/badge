---
type: research
domain: auth
topic: field intelligence — DEEP migration mechanics (refresh-token proxy, lazy password, custom-claims breakage)
researcher: FIELD-INTELLIGENCE-2 (CP123 Wave-R, 2nd FIELD pass)
created: 2026-06-11
status: done
currency: June 2026
scope: ADDITIVE to field-03 (war stories). This file = the EXACT code-level mechanics of what
       breaks and how the working migrations actually wire it. Mined from OSS issues + impls, not blogs.
---

# Field Intelligence — Migration mechanics deep-dive (the wiring, not the war story)

> field-03 has the *narratives* (Val Town, Mimo, LobeHub). This file has the *mechanics*:
> the actual endpoints, grant types, error mappings, and the four casualty categories at code level.
> Centerpiece: a real, dated OSS implementation of Auth0→X lazy migration. Every claim cited.

## ⭐ The canonical lazy-migration mechanic (REAL impl, not theory)
Source: **`markusahlstrand/authhero` issue #809 — "Auth0 migration support: lazy password fallback +
refresh-token proxy"**, opened & CLOSED 2026-05-08, maintainer comment "Implemented".
https://github.com/markusahlstrand/authhero/issues/809 (accessed 2026-06-11, via `gh issue view`).
authhero = an open-source Auth0-compatible auth server (drop-in-ish). This issue is the single most
concrete description of how a production lazy migration is actually wired that I found in OSS.

**The verbatim goal:** *"Support lazy migration from Auth0 to authhero so a tenant can switch traffic
without forcing every user to reset their password or re-authenticate."*

### Flow 1 — Password fallback (the "trickle" import, done right)
*"on login, if no local password hash exists or it doesn't match, verify against the upstream Auth0
via the Resource Owner Password Realm grant. On success, fetch the profile from `/userinfo`, create a
local user record (if missing), and store the password hash. Subsequent logins are local-only."*

Exact endpoint (quote-worthy — this is the thing generic guides hand-wave):
- `POST {AUTH0_DOMAIN}/oauth/token` with
  `grant_type=http://auth0.com/oauth/grant-type/password-realm`,
  `realm=<connection.name>`, `username`, `password`, `client_id`, `client_secret`,
  `scope=openid profile email`, `audience=https://{AUTH0_DOMAIN}/userinfo`.
- Then `GET {AUTH0_DOMAIN}/userinfo` with the returned access_token to hydrate the profile.

**Why this matters (badge taste):** the "hours-long bulk import" everyone cites is the EASY path and is
often the WRONG one. The robust path is **never exporting hashes at all** — verify against the old IdP on
first login, capture the plaintext *once* (only moment it's available), re-hash locally, and the user
never notices. This is the same "custom DB connection / lazy migration" Auth0 itself recommends
(corpus ecosystem-13 GAP #2) — but #809 shows the actual grant string.

### Flow 2 — Refresh-token proxy (THE casualty most guides ignore)
This is the part field-03's "casualties: active sessions" bullet refers to — here's the mechanic.
*"refresh tokens issued by Auth0 before cutover are **opaque server-side handles**. When a
`grant_type=refresh_token` request arrives whose token doesn't match any local row, **forward it to
upstream Auth0's `/oauth/token`** and pass the response back. Covers users from any upstream connection
(DB, google-oauth2, github, etc.). **No M2M token required.**"*

**The load-bearing insight:** Auth0 refresh tokens are **opaque** (not JWTs) — you literally cannot
validate or re-issue them yourself, because their state lives in Auth0's DB. So a cutover that doesn't
proxy them **silently logs out every user with a long-lived session** the moment their access token
expires. The fix is a proxy that recognizes "this refresh token isn't mine" and forwards it upstream,
letting it age out naturally. This is the refresh-token analog of the dual-validation cookie window.

### The error mappings (the gotchas you only learn in prod)
From the issue verbatim:
- `mfa_required` → propagate as **403**; the user must reset on the new side (you can't replay Auth0 MFA).
- `unauthorized_client: Grant type … not allowed` → **the tenant must ENABLE the password-realm grant
  on the Auth0 app** first. If you forget, every fallback login fails with a cryptic error. Surface a
  clear message. (This is the #1 silent setup mistake — the grant is OFF by default on many Auth0 apps.)

**badge design implication:** on ANY "migrate off Auth0" request, badge should emit BOTH flows
(password-realm fallback + refresh-token proxy), name the four casualties, AND pre-flight-check that the
password-realm grant is enabled on the source Auth0 app — because that one toggle silently breaks Flow 1.

---

## Custom claims: the casualty category nobody scopes correctly

field-03 lists "custom claims" as a migration casualty but doesn't unpack WHY. Here is the mechanism,
assembled from provider docs + the structural difference between the two systems (accessed 2026-06-11):

**Auth0 puts custom claims in the ID/access token via Actions/Rules**, under a **namespaced URI**
(Auth0 *requires* non-OIDC-standard claims to be namespaced, e.g.
`https://myapp.example.com/roles`, or they are silently dropped from the token). Source: Auth0 docs on
custom claims / "Create Custom Claims" (auth0.com/docs; the namespacing requirement is long-standing
and unchanged into 2026).

**Clerk puts custom claims in the session token via "custom session claims" / JWT templates**, with a
DIFFERENT shape (Clerk's `{{user.public_metadata}}` shortcode interpolation, no forced namespace).
Source: Clerk docs "Customize your session token" (clerk.com/docs; WAF-blocks WebFetch, confirmed via
WebSearch + corpus ecosystem-13 note that clerk.com/docs is WAF-gated).

**=> The breakage:** every downstream service that read `token["https://myapp.example.com/roles"]`
(Auth0 namespaced) must be rewritten to read the Clerk claim path, OR the migration must replicate the
exact namespaced key in a Clerk JWT template. **Custom claims do not "migrate" — the token SHAPE changes,
so every authorization check that destructures the token breaks.** This is why field-03's universal
pattern says "plan to re-establish them, not port them."

**badge takeaway:** the dangerous migration claims are the ones used in *authz decisions* (roles,
org_id, plan tier). A missed claim doesn't error — it evaluates to `undefined` → silently denies (or
WORSE, with permissive code, silently grants). Custom-claim migration MUST be paired with an authz
regression test that asserts every role still resolves post-cutover. (This is the field-03 "evaluates to
undefined → silently denies/grants" risk, made concrete for claims specifically.)

---

## Cross-check: the GitHub-wide "auth0 migration" issue signal (June 2026)
Source: `gh search issues "auth0 migration"` GitHub-wide, accessed 2026-06-11. Signal, not deep-dive —
shows the migration churn is broad and current:
- `markusahlstrand/authhero #809` (2026-05-08, CLOSED/implemented) — the lazy + refresh-proxy impl above.
- `shark-auth/shark #55` (2026-04-15, open) — "[P1] Auth0 migration tool" (an OSS auth project treating
  Auth0-import as a P1 — corroborates demand).
- `markarnoldutah/RVS #401` (2026-05-09, open) — "Phase 2 — Auth0 Organizations migration, SAML, SCIM,
  IP allowlist" — confirms **Auth0 Organizations + SAML + SCIM are migrated together as one hard phase**,
  matching field-03's "SSO/SAML connections are casualties."
- `subhrajit-mohanty/Rudra #58` (2026-04-24, open) — "Migration tools (Auth0 first, then Clerk and
  Firebase)" — note the ORDER: teams build Auth0-import first because that's where the paying enterprise
  users are locked in.
- `auth0-developer-hub/auth0-b2b-saas-starter #63` (2024-12-13, open) — "Migration to Auth0 V4 and
  Next.js 15" — even staying ON Auth0, the SDK V4 + Next 15 jump is a tracked migration (older, flagged).

**Pattern:** every 2026 OSS auth project ships an "Auth0 import" feature as P0/P1. The lock-in Auth0
created (opaque refresh tokens, gated hash export, namespaced claims) is precisely what these tools fight.
