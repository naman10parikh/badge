---
type: research
domain: auth
topic: field intelligence — migration war stories (provider A→B, what broke)
researcher: FIELD-INTELLIGENCE (CP123 Wave-R)
created: 2026-06-11
status: done
currency: June 2026
---

# Field Intelligence — Auth migration war stories (what actually broke)

> Real teams, real provider switches, real breakage. Centerpiece: Val Town's
> Supabase→Clerk→Better Auth (May 2026). Every claim cited.

## ⭐ Val Town: Supabase → Clerk → Better Auth (the definitive 2026 war story)
Source: **Tom MacWright / Val Town engineering blog, "From Supabase to Clerk to Better Auth"**
https://blog.val.town/better-auth (post date ~May 2026). HN discussion (304 pts, **240 comments**):
https://news.ycombinator.com/item?id=48038827 (accessed 2026-06-11).

**Why they left Supabase (2023):** moved off Supabase entirely → Render (DB) + Clerk (auth). Post doesn't dwell on Supabase-auth specifics.

**Why they left Clerk (the concrete pain — this is the meat):**
1. **Account-wide rate limit that only bites at scale.** The user-data endpoint was rate-limited to **"five requests per second" for the ENTIRE account across all users.** Worked fine in dev (you only load your own avatar); **broke in production** the moment social features needed to render *other* users' avatars/usernames in lists. This is the canonical "works in dev, dies at scale" auth trap.
2. **Clerk wants to be BOTH your users table AND your sessions table.** That assumption ("a user only sees their own avatar") is wrong for any social/multi-user UI. Result: Val Town had to keep its own users table too → **"two authorities for that information, and the complexity of two users tables."**
3. **Single point of failure on session validation.** Val Town had **no sessions table** — Clerk managed all refresh/validation. So *"if Clerk goes down, the whole website goes down"* — including already-logged-in users. They cite **"two and three nines of uptime" since May 2025** (i.e., Clerk dipping to 99.x–99.9%).
4. **Webhook-sync inconsistency.** Signup required webhooks to sync Clerk→their DB; users could land in inconsistent states — *"a user has a Clerk account but no Val Town database row."*

**The verbatim taste (quote these):**
- *"A hard lesson you learn building a complex system is that its reliability is the minimum of the combined reliability of its critical parts."*
- On Clerk's old marketing ("Consider dropping your users table" 2021 / "DELETE your Users table" 2023): **"I strongly suggest you don't!"**
- *"There aren't a ton of great options for authentication... a lot of open source auth solutions are ancient and semi-abandoned."*
- On velocity: *"Making decisions and sticking with them is good for development velocity and team sanity."* (explains why a known-bad choice rode for ~2.5 years).

**HOW they migrated Clerk → Better Auth (the actual playbook):**
- **Two-week parallel period** supporting BOTH Clerk and Better Auth cookies simultaneously.
- **Every auth endpoint rewritten to accept either session type.**
- Users migrated **gradually** — the sign-in page started issuing Better Auth sessions; old Clerk sessions aged out.
- Final implementation **handwritten entirely** (no automated migration tool). Security-critical code got *"close reading, rewriting, and testing"* to avoid introducing vulns.
- **Verdict:** *"so far it really has been better."* Likes Better Auth's high code quality, framework integrations, and that the **paid add-on is "basically stateless"** and not in the session path (so paid-service downtime ≠ auth downtime).

## Mimo: Auth0 → Firebase, 6 MILLION users
Source: surfaced via WebSearch (buildmvpfast / migration roundups, accessed 2026-06-11) — corroboration recommended.
- Migrated **~6M users** with **custom token-exchange endpoints** + Auth0 webhooks for the trickle.
- **~8 hours for the bulk import** + **weeks of preparation.** Lesson: the import is fast; the *prep* (mapping identities, dual-validation window, testing) is where the time goes.

## DEV.to: Auth0 → Authon (and the general migration taste), 2026
Source: **"Auth0 vs Clerk vs Authon: Migrating Your Auth Layer in 2026"**
https://dev.to/alanwest/auth0-vs-clerk-vs-authon-migrating-your-auth-layer-in-2026-4aao (2026, accessed 2026-06-11).
- Migrated **~2,000 users** off Auth0.
- **The hard step is backend verification, not the user import:** *"Token formats differ, so any backend middleware needs updating. Plan for a session where both old and new tokens are valid during the transition."* (Same dual-validation-window lesson as Val Town and Mimo — this is the universal migration pattern.)
- Taste: Auth0 *"dashboard is powerful but honestly feels bloated in 2026"*; Actions *"has a learning curve that'll eat an afternoon"*; Clerk's DX is *"genuinely best-in-class for React/Next.js."*

## LobeHub: Clerk → Better Auth (documented data-loss caveats)
Source: **LobeHub self-hosting migration docs, "Migrating from Clerk to Better Auth"** (accessed 2026-06-11; page returned 403 to WebFetch, summary via WebSearch result).
- **Two paths:** (a) *simplest* — let users reset passwords, but this **loses SSO connection data**; (b) *full* migration — preserves SSO connections.
- **Users must manually re-link social accounts** after first logging in via email+password.
- Lesson: **SSO/social-link data is the part that does NOT migrate cleanly.** Email/password users are easy; OAuth-linked and SAML-linked identities are the casualties.

## Auth0 → WorkOS: enterprise SSO connections at scale
Source: **WorkOS guide, "How to migrate enterprise SSO connections from Auth0 to WorkOS"**
https://workos.com/guide/auth0-to-workos-enterprise-connections-migration-guide + WorkOS blog
https://workos.com/blog/workos-vs-auth0-vs-clerk-the-best-auth-platform-for-b2b-saas-in-2026 (accessed 2026-06-11). Vendor source — interested party.
- WorkOS claims it migrated **"1,000s of enterprise SSO connections from Auth0 to WorkOS with almost zero friction for IT admins and end-users."** (Vendor claim; the *number* is plausible given the per-connection model, but "zero friction" is marketing — treat as a ceiling, not a floor.)
- The structural driver: Auth0 gates enterprise connections behind expensive tiers (Professional ~$800/mo for up to 5 enterprise connections, then sales). WorkOS prices per-connection (~$125). For 5–10 SSO customers WorkOS is far cheaper — which is *why* the migrations happen.

## The universal migration pattern (synthesis across ALL stories above)
Every credible migration story repeats the SAME three-part shape:
1. **Bulk user import is the easy, fast part** (hours). Passwords (bcrypt/argon hashes) port if both sides use the same algo, or you do lazy re-hash on first login.
2. **The hard part is the dual-validation window** — a period (1–2 weeks typical) where the backend accepts BOTH old and new tokens/cookies, migrating users gradually. Skipping this = forced mass logout.
3. **The casualties are always: active sessions, SSO/SAML connections, social-account links, and custom claims.** These do not migrate cleanly. Plan to re-establish them, not port them.

**badge design implication:** an Auth domain-expert should, on any "migrate from X to Y" request, immediately produce the dual-validation-window plan and flag the four casualty categories — that's the differentiated, hard-won knowledge generic docs omit.
