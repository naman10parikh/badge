---
type: research
domain: auth
topic: field intelligence — VERIFIED war stories (primary sources) + 2026 decision-consensus + X status
researcher: FIELD-INTELLIGENCE-2 (CP123 Wave-R, 2nd FIELD pass)
created: 2026-06-11
status: done
currency: June 2026 (older primary sources FLAGGED inline per currency rule)
scope: VERIFIES field-03's flagged-unverified claims against PRIMARY sources, adds the 2026
       cross-vendor decision-consensus, documents X-signal status with root cause.
---

# Field Intelligence — Verified war stories + decision consensus

## ✅ Mimo: Auth0 → Firebase, 6M users — VERIFIED to primary source (but it's a 2020 story)
Source: **Thomas Sattlecker, "How we moved 6 million users from Auth0 to Firebase"**, Firebase
Developers / Medium, **dated 2020-05-19** (https://medium.com/firebase-developers/how-we-moved-6-million-users-from-auth0-to-firebase-d46fd13cfda8;
also mimo.org/blog/...; accessed 2026-06-11).

> ⚠️ **CURRENCY FLAG: this is a 2020 article, NOT a 2026 source.** field-03 cited it as "~6M users"
> without the date. It is still ARCHITECTURALLY load-bearing (the refresh-token-exchange pattern is
> timeless and exactly matches the 2026 authhero #809 mechanic in field-09), but do NOT present it as
> current evidence of migration *trends*. Cite it as "the canonical refresh-token-exchange pattern,
> demonstrated at 6M-user scale (Mimo, 2020)."

**The verbatim core problem (this is THE migration lesson, restated by every later story):**
*"The problem here is that while a valid access token is still authenticating users in our backend,
the refresh token Auth0 issued can not be used to get a new access token from Firebase. We had to find
a way to exchange an Auth0 refresh token for a refresh token from Firebase."*

**The exact 4-step custom-token-exchange (quote-worthy — the real mechanic):**
1. *"Import Auth0 accounts to Firebase"*
2. *"Clients call our custom API endpoint with a newly refreshed Auth0 access token"*
3. *"The endpoint verifies and validates the token, looks up in Firebase if the user exists and, if so,
   generates a custom token."*
4. *"The Client uses the Firebase Admin SDK's custom login token API to get a new access token and
   refresh token."*

**Auth0 webhook role (the trickle for new signups during the window):** *"We implemented a simple hook
which would import a single account to Firebase in the event of a new signup."* (Same pattern as
authhero #809's password-realm fallback — catch stragglers via the old IdP's event hooks.)

**NET-NEW casualty category (not in field-03's list of four):** *"we have cases where multiple accounts
have the same email attached. This is simply not possible in Firebase anymore so filtering the data is
necessary."* **=> DUPLICATE-EMAIL accounts are a 5th casualty.** Auth0 (and many legacy IdPs) allow
multiple identities per email; Firebase/Clerk/most modern IdPs enforce email-uniqueness. The migration
must DEDUPE or DROP duplicate-email accounts — and that's a data-loss decision someone has to own.

**Why they left (the recurring reason):** *"Auth0 was a great partner for handling account management,
[but] they are not the best fit for a consumer heavy platform like Mimo. At the end, Auth0's pricing
model was not sustainable for us."* (B2C per-MAU pricing → the same "Okta tax" force as field-08 SHIFT-6,
just observed in 2020 already — the structural problem predates the 2026 price-shock.)

**The 8-hour timeline is purely the BULK IMPORT, not the project:** *"Importing 6 million accounts
through Firebase's API takes some time."* The project itself was: *"releasing the backend, enabling the
Auth0 rule, requesting the export, transforming data, running import, and releasing apps."*
**=> Reconfirms field-03: the import is hours; the PREP (token-exchange endpoint, dedup, dual-window) is
the real work.**

## Updated casualty list (badge should emit all FIVE on any migration request)
field-03 named four. Mimo + authhero add the fifth and sharpen #1:
1. **Active sessions / refresh tokens** — opaque server-side handles; must PROXY to old IdP (authhero #809)
   or EXCHANGE via custom endpoint (Mimo). Never "just port."
2. **SSO / SAML enterprise connections** — re-establish per-tenant; don't port (field-03 LobeHub).
3. **Social-account links** — users re-link manually after first login (field-03 LobeHub).
4. **Custom claims** — token SHAPE changes; every authz check breaks; pair with authz regression test
   (field-09).
5. **Duplicate-email accounts** — modern IdPs enforce email-uniqueness; dedup or drop (Mimo). 🆕
   Bonus 6th from field-10 #9944: **TOTP/2FA enrollments** — secret-derivation conventions differ;
   often must re-enroll.

---

## The 2026 cross-vendor DECISION CONSENSUS (synthesized from multiple 2026 roundups)
Sources (all accessed 2026-06-11): WorkOS "WorkOS vs Auth0 vs Clerk… B2B SaaS in 2026"
(workos.com/blog/workos-vs-auth0-vs-clerk-the-best-auth-platform-for-b2b-saas-in-2026, vendor),
gautamkhorana.com/blog/authentication-services-2026-clerk-auth0-supabase-workos, ssojet.com/blog/
auth0-vs-workos-ciam-2026, buildmvpfast.com/blog/best-auth-providers-2026. **Independent roundups
converge on the same buyer-segmentation** (which is itself the signal — when competitors AND neutral
blogs agree on positioning, it's real):

- **Clerk** = *"the default for indie SaaS founders shipping fast"* — premium DX, prebuilt UI, orgs OOTB.
  *"Three names come up in almost every conversation: WorkOS, Auth0, and Clerk… they're not built for
  the same buyer."*
- **Auth0** = *"the procurement-friendly default"* — Okta-owned, *"the most mature SSO + SAML story,"*
  enterprise/B2B but per-MAU pricing punishes B2C.
- **WorkOS** = *"purpose-built for one job: helping B2B SaaS companies become enterprise ready… Enterprise
  SSO is the core product, not an afterthought."* Narrow but deep; *"pairs with another service for
  password sign-in"* (it's not a full CIAM by itself).
- **Better Auth** = *"the more natural choice when the database is not Supabase"* (self-host/own-DB).

**The dominant 2026 lifecycle pattern (quote, multiple sources):** *"start on Clerk for speed, hit 50K
MAU, and migrate to Supabase Auth or Better Auth before the cost becomes a real line item."*
**=> badge's single most useful heuristic: Clerk to ship, Better Auth/Supabase to scale, WorkOS bolted
on when the first enterprise SAML deal lands.** This is the empirically-converged default path.

> ⚠️ **Stale-data sighting (live example of field-08 SHIFT-1 in the wild):** the buildmvpfast/WorkOS
> roundups STILL cite Clerk's *"Free 10K MAU, Pro $25/month + $0.02/MAU."* That 10K number was
> **superseded 2026-02-05** (free tier → 50K). This is a CURRENT, observable instance of stale auth
> wisdom propagating through roundups — exactly why badge must verify pricing from the provider's own
> changelog at decision time, never from a comparison blog.

---

## X / Twitter signal — STATUS: ATTEMPTED, BLOCKED (documented with root cause)
**Auth session is VALID** — `~/.claude/x-auth/x-session.json` loaded cleanly (45 cookies; `auth_token`
+ `ct0` + `guest_id` all present and confirmed). The block is NOT auth.

**What I tried (3 methods, all 2026-06-11):**
1. `api.x.com/2/search/adaptive.json` (legacy adaptive search) → empty/non-JSON response (endpoint
   effectively retired for this path).
2. Hand-built `x.com/i/api/graphql/<queryId>/SearchTimeline` with a recent queryId → **HTTP 404**.
3. **Energy's canonical `scripts/x-content-intel/scrape.py --search` (the maintained tool, `SEARCH_DOC_ID
   = "MJpyQGqgklrVl_6rYKQbow"`) → also HTTP 404, "0 unique tweets."**

**Root cause (more precise than the prior FIELD pass's note):** X rotates the GraphQL **persisted-query
`queryId`/`doc_id`** frequently as anti-automation. Even the maintained energy script's stored doc_id is
now stale → every SearchTimeline call 404s. The cookie auth is fine; the persisted-query hash is the
broken link. **To restore X signal, the doc_id must be re-harvested from a live x.com web session
(DevTools → Network → any search → copy the `/graphql/<hash>/SearchTimeline` hash) and patched into
`scrape.py`.** That requires a logged-in browser capture, out of scope for this read-only research pass.

**Decision:** per HARD RULE 6, X is honestly marked SKIPPED-BLOCKED; this pass relies on HN threads
(48038827 Val Town, Clerk postmortem HN items), GitHub issues/advisories (authoritative), Scalekit/
WorkOS/vendor blogs, and primary migration write-ups. The HN + GitHub signal is richer and more
verifiable than X chatter would have been anyway — HN's Val Town thread (240 comments) IS the
highest-signal practitioner discussion in this vertical for 2026.
