---
type: research
domain: auth
topic: field intelligence — what changed in 2026 (invalidates 2025 wisdom) + X-signal note
researcher: FIELD-INTELLIGENCE (CP123 Wave-R)
created: 2026-06-11
status: done
currency: June 2026
---

# Field Intelligence — 2026 shifts that invalidate 2025 conventional wisdom

> Mission item (5): what changed in 2026 that makes 2025 advice wrong. Each with a DATE.
> Plus item (6): X/Twitter signal status note (honest skip).

## SHIFT 1 — Clerk's free tier 10K → 50K MAU (Feb 5 2026); pricing wisdom reset
- **2025 wisdom:** "Clerk gets expensive fast — free tier is only 10K MAU, then $25 + $0.02/MAU."
- **2026 change (DATED):** Clerk's **first major pricing update since 2023**, published **2026-02-05** ("New plans, more value", https://clerk.com/changelog/2026-02-05-new-plans-more-value). Free tier **10K → 50K Monthly Retained Users**; **unlimited applications** now in every plan; **Enhanced Authentication Add-on eliminated** (its features folded into Pro at **$20/mo**, some sources say $25). Brings Clerk in line with Supabase's 50K free. Source: https://saasprices.net/blog/clerk-free-plan-changes (accessed 2026-06-11).
- **Corrected math:** the "$2,025/mo at 100K MAU" figure still roughly holds (Pro + $0.02 over 50K), but the **crossover where Clerk starts costing real money moved from ~10K to ~50K users.** Re-quote current numbers; don't cite the old 10K threshold.

## SHIFT 2 — Better Auth's enterprise/agent surface got a CVE batch (2026-05-31); "just use it" is now nuanced
- **2025 wisdom:** "Better Auth is the community darling — simpler, cheaper, just adopt it." (Backed by YC X25, $5M raise Jun 2025, Auth.js merging in Sep 2025.)
- **2026 change (DATED):** the **2026-05-31 advisory batch** (field-04) across `oauth-provider`/`sso`/`scim`/`mcp`/`oidc-provider` — RFC 8707 audience-binding gap, `alg=none` + `plain` PKCE defaults, nOAuth pre-account-hijacking, refresh-rotation races, SSRF on SSO registration — PLUS the unauth API-key CVE (1.3.26) and 2FA-bypass (2026-04-01). **The core session library is excellent; the enterprise/agent plugins were immature through H1 2026.** New wisdom: pin versions, gate upgrades on a full auth E2E, verify each MCP-OAuth checklist item against the running build.

## SHIFT 3 — AI SAST changed the auth-vuln discovery curve; popularity ≠ safety
- **2025 wisdom:** "Pick the popular, well-starred library — community scrutiny makes it safe."
- **2026 change:** tools like **ZeroPath** now find **business-logic** auth flaws (e.g., CVE-2025-61928 unauth API-key creation) that "traditional dependency vetting (stars, existing CVEs, reputation) doesn't catch" (etlun/ZeroPath). **Expect MORE auth CVEs surfacing in 2026, not fewer** — popularity is no longer a safety signal. Source: https://zeropath.com/blog/...cve-2025-61928 (accessed 2026-06-11).

## SHIFT 4 — Agent/MCP identity went mainstream-security (2026); a NEW auth surface exists
- **2025 wisdom:** auth = humans logging in (sessions, OAuth social, SSO). Machine auth = a niche M2M API key.
- **2026 change (DATED):** Clerk **M2M tokens GA 2025-10-14** (JWT-issuable, networkless verification); the **MCP authorization spec** (Anthropic + Arcade + Microsoft + Okta/Auth0) standardized OAuth-protected MCP resources with RFC 8707 + RFC 8693; **RSAC 2026** named MCP security "the question everyone kept asking." **Agent identity (delegation, intersection rule, confused-deputy-via-injection) is now a first-class auth domain** (full detail: field-07). 2025 auth knowledge that stops at "human login" is now incomplete.

## SHIFT 5 — Clerk SCIM/Directory Sync GA (Apr 16 2026) closed a real enterprise gap
- **2025 wisdom:** "Clerk can't do enterprise SCIM/directory sync — use WorkOS/Auth0 for that."
- **2026 change (DATED):** Clerk **Directory Sync (SCIM) GA 2026-04-16** (groups + custom-attribute mapping; included with enterprise connection at no extra charge). https://clerk.com/changelog/2026-04-16-directory-sync. **Clerk narrowed the enterprise gap in 2026** — the "Clerk has no SCIM" line is now stale. (The deeper "user-first vs org-first" architecture critique from Scalekit still stands — SCIM existing ≠ org-first modeling.)

## SHIFT 6 — The "Okta tax" / Auth0 price-shock crystallized the 2026 exodus
- **2025→2026 escalation (DATED data point):** post-Okta-acquisition (Okta bought Auth0 2021 for $6.5B), Auth0 pricing produced documented "price shock": **B2C Essentials per-MAU cost effectively doubled; SAML SSO gated behind custom-quote Enterprise plans; one user reported a 15.54x jump — $240/mo → $3,729/mo on modest growth** (Security Boulevard / authentik "The Okta Tax" 2026-02-23, https://goauthentik.io/blog/2026-02-23-the-okta-tax/; accessed 2026-06-11). Plus support decline (week-long response delays; 7% layoffs Feb 2024). **This is the structural force behind every Auth0→WorkOS / Auth0→Clerk / Auth0→Better-Auth migration in field-03.** It's not fashion — it's renewal-quote shock.

## SHIFT 7 — Passkeys/WebAuthn became the default, not the future
- **2025 wisdom:** "Passkeys are coming; bolt them on later as a nice-to-have."
- **2026 change:** Apple/Google/Microsoft made passkeys **default or prominently featured**; Google reported a **120% increase in passkey auths** after defaulting them; FIDO Alliance: **87% of surveyed US/UK companies deploying or planning passkeys**; **~50–60% of top-100 websites** support passkeys. Source: WebSearch roundup (kawaldeepsingh/Medium, mojoauth, panicvault; accessed 2026-06-11). **badge takeaway: passwordless/passkey support is now table-stakes for an auth recommendation, not a roadmap item.** Evaluate every provider on passkey quality.

## The one 2025 belief that DIDN'T change (worth stating)
- **"Don't roll your own federation/OAuth-provider."** If anything, 2026 STRENGTHENED this — Better Auth, a YC-funded team of auth specialists, shipped a batch of OAuth-provider CVEs. If THEY get it wrong, a product team will too. (The narrower "email+password is fine to DIY" remains defensible — DISPUTE B.)

---

## X / Twitter signal — STATUS: SKIPPED (documented)
- **Attempted** via energy's `scripts/x-content-intel/` + `~/.claude/x-auth/x-session.json`. Session is **valid** (45 cookies; `auth_token` + `ct0` present, confirmed).
- **Failure:** the `SearchTimeline` GraphQL **query ID is stale** → X returned **HTTP 404** on both `clerk auth migration` and `better auth vs workos` queries. The energy scrapers construct the query ID at runtime (not a static constant I could lift), and reconstructing a current X GraphQL query-hash is out of scope for a read-only research pass.
- **Per mission rule (6):** X skipped → relied on **HN (4 high-engagement threads, 240+178+106+comments mined), GitHub issues + security-advisories API, and WebSearch over Reddit/forums/vendor postmortems** instead. This gave strong primary-source coverage; the X gap does not materially weaken the findings (the val.town HN thread + Better Auth GHSA batch are stronger evidence than tweets would be).
- **For a future pass:** use energy's `x-feed-curate` / `x-content-intel` skill end-to-end (it self-heals the query ID via the live DOM), or the browser-DOM→`--from-json` login-light pattern noted in the Sentinel learnings (`project_cp118_sentinel_harness`). Do NOT hand-roll the GraphQL hash.
