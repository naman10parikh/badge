---
type: research
domain: auth
topic: field intelligence — explicit TASTE (opinions great practitioners hold that average ones don't)
researcher: FIELD-INTELLIGENCE (CP123 Wave-R)
created: 2026-06-11
status: done
currency: June 2026
---

# Field Intelligence — Practitioner TASTE (verbatim opinions worth absorbing)

> The mission asked for "opinions great practitioners hold that average ones don't — quote them."
> These are the load-bearing beliefs of people who've shipped auth at scale and gotten burned.
> Source threads (accessed 2026-06-11): HN 48038827 (Supabase→Clerk→Better Auth, 240c),
> HN 44030492 (Better Auth Launch, 106c), HN 44380185 (Better Auth $5M raise, 178c),
> val.town blog, ZeroPath CVE writeup.

## TASTE 1 — "Reliability is the minimum of the combined reliability of its critical parts."
— **Tom MacWright / Val Town** (https://blog.val.town/better-auth). The single best one-liner in auth.
The corollary average devs miss: **if your IdP holds the session authority, your uptime ceiling = the IdP's uptime, and logged-in users go down too, not just new logins.** This is WHY teams pull session validation back in-house (own a sessions table), even when they keep a managed IdP for login.

## TASTE 2 — "Consider dropping your users table" is WRONG. Keep your users table.
Clerk's own 2021/2023 marketing said "DELETE your Users table." Val Town's verdict: **"I strongly suggest you don't!"** The hard-won belief: **identity data must have a home in YOUR database** that you control, join against, and add columns to. Outsourcing the users table creates "two authorities for that information" and webhook-sync inconsistency ("a user has a Clerk account but no [app] database row"). Echoed by `primitivesuave`: *"if I want an additional column per user, it's a lot easier to add a Postgres column than using some API for appending data to a user in Cognito/Auth0/Okta in some rigid format."*

## TASTE 3 — "Any third-party service integrated into your stack is a liability; libraries less so."
— `WilcoKruijer` (HN): *"You could almost call the comparison between Clerk and Better Auth unfair. One is a service and one is a library, apples to oranges... It's about time for more services to be replaced by libraries."* The taste: **prefer a library you run over a service you call**, for the parts that are on the critical path. (Counterpoint in field-06: services win for enterprise SSO breadth.)

## TASTE 4 — Auth is "not hard, just a lot of drudgery that detracts from your actual goal — but it's critical."
— `cyberax` (HN). The nuance average devs get wrong in BOTH directions: it's neither "trivial, roll your own" NOR "impossibly hard, always outsource." It's **tedious-but-tractable, and the cost of an error is catastrophic.** That asymmetry (low difficulty, high blast radius) is the whole game.

## TASTE 5 — Popularity / stars / reputation are NOT a security signal.
— `etlun` / ZeroPath, on CVE-2025-61928: *"This is the kind of business logic flaw that traditional dependency vetting (stars, existing CVEs, reputation) doesn't catch."* Backed by hard evidence: Better Auth (300K+ weekly downloads, YC, $5M) shipped an unauth API-key-creation CVE AND a 2026-05-31 batch of OAuth/SSO/MCP holes. **The great-practitioner move: verify the actual auth behavior (PKCE method, audience binding, account-linking gate) against a checklist; never infer safety from popularity.**

## TASTE 6 — The "should a self-taught dev write auth?" debate (the sharpest exchange in the corpus)
A genuine, high-quality disagreement among experienced people (HN 44380185). Worth holding ALL sides:
- `yodon`: *"Pretty sure auth is not something I want a self-taught dev (or even most CS-graduate devs) writing. OAuth2, JWTs, hashes, timestamps, validations... are all totally simple until they're not. The black hats have way more experience and way more time invested."*
- `risyachka` (agreeing, sharper): *"it's not difficult if you know all the specs. The issue is 99% don't know them and are not very good at following them, and the cost of error is very high. I've seen a lot of startups that failed to implement even google oauth securely."*
- `hobofan` (the concrete failure catalog): *"Storing password hashes in an inappropriate manner → BOOM, all your user's passwords are reversible... Not validating a nonce correctly → BOOM, auth tokens hijacked... Not validating session timestamps → BOOM, outdated tokens used to gain PII."*
- `motorest` (the dissent): *"Specs only cover a single responsibility: interoperability. This is not a critical requirement of auth services, unless you have a hard requirement on federated auth."* (i.e., for a plain email+password app, spec-mastery matters less than people claim.)
**badge takeaway:** the expert consensus is "auth competence is a real, learnable skill with a high error cost" — the dissent narrows it to "spec-mastery only strictly matters once you do federation/OIDC." Both are true; badge should calibrate advice to whether the user is doing federation.

## TASTE 7 — NextAuth's "email+password is insecure, DIY it" stance is a turn-off; out-of-the-box matters.
— `gardnr` (HN): NextAuth *"has a preachy disclaimer about how email and password is inherently insecure, so they leave you to your own devices to implement password hashing... gave a sense that NextAuth was the first to dominate and feels as though they can dictate morals."* `koakuma-chan`: *"I was so frustrated with NextAuth I ended up using nginx to set up http basic auth."* **Taste: a good auth library ships the secure default (password hashing) rather than moralizing and offloading the dangerous part to the user.** This is a major reason Better Auth displaced NextAuth in 2026.

## TASTE 8 — VC money will eventually compromise an OSS auth library's "awesomeness."
— `shafyy` (responding to hope that Better Auth's $5M wouldn't hurt it): *"It most certainly will at some point."* The taste/skepticism: **OSS-with-VC has a monetization clock**; the free library's incentives drift toward the paid product. Hold this when betting a stack on a young, VC-funded auth lib. (Mitigant per `bekacru`: the paid dashboard is "basically stateless" and out of the session path — so the lock-in surface is smaller than Clerk's.)

## TASTE 9 — OSS abandonment risk is real and specific — read the commit tempo.
Discussion of Lucia (sunset into a tutorial — *"the author is going to college now"*) and OpenAuth (*"seems dead. No activity for 2 months,"* `threatofrain`). `FireBeyond`: *"No activity for nearly 3 months with 67 open issues, 32 open PRs (many as simple as 'fix typo')."* Counter-take `apgwoz`: *"No activity for 2 months implies death? ... Why can't we assume people who work on open source are sometimes taking a break?"* **badge takeaway: for any auth dependency, the maintenance/bus-factor signal (commit tempo, open-PR rot, single-maintainer) is a first-class selection criterion — not an afterthought.** The corollary great-practitioner move (Lucia's): if the library is thin enough, *learn to host auth yourself* so no abandonment can strand you.

## TASTE 10 — Clerk is "perfect for prototyping, suffers at the details."
— `cyberax`: *"Clerk looks really good initially. It's perfect if you want to prototype something and not care about auth. It's only when you start getting into the details that you begin to suffer."* Concrete details he hit: **no offline auth on mobile** (had to cache the JWT refresh token + pluck it from the undocumented `__clerk_client_jwt` key), **no audit logs, no versioning** (someone "probably accidentally changed a setting" with no trail), obfuscated/impenetrable JS, and a JS blob "now triggering the browser inspectors for being slow to load." **The general taste: evaluate auth on the boring enterprise details (audit logs, versioning, offline, debuggability), not the 5-minute demo.**

## TASTE 11 — Match auth to your framework's batteries before reaching for a SaaS.
Recurring chorus (`giancarlostoro`, `dsagent`, `skydhash`, `rozap`): if you're on Laravel/Rails/Django/ASP.NET Core/Phoenix, **auth+users+roles are already in the box** (Laravel Socialite, etc.) — *"as a postgres/phoenix/elixir enjoyer I am blissfully unaware of all this SaaS churn."* **Taste: the JS/TS ecosystem's auth-SaaS churn is partly self-inflicted by frameworks that DON'T ship auth.** badge should ask what framework the user is on before recommending anything — the answer may be "you already have it."
