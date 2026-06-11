---
title: "badge GAPS-AND-DISPUTES — where sources disagree, where none exists, what's unconfirmed"
type: synthesis
domain: auth
created: 2026-06-11
updated: 2026-06-11
tags: [gaps, disputes, unconfirmed, open-questions, auth, badge, cp123]
sources: ["brain/research/raw/ecosystem-00-INDEX.md", "brain/research/raw/field-06-disputes-and-decision-logic.md", "brain/research/raw/field-07-agent-identity-2026-frontier.md", "brain/research/raw/field-05-practitioner-taste.md", "brain/research/raw/field-08-2026-shifts-and-x-signal.md", "brain/research/raw/ecosystem-01-clerk.md", "brain/research/raw/ecosystem-05-auth0.md", "brain/research/raw/ecosystem-02-betterauth.md"]
related: ["[[badge EXPERTISE-MAP]]", "[[badge OPINIONS]]", "[[badge TOOL-MATRIX]]", "[[badge BATTLE-TESTED-SCENARIOS]]"]
summary: "Honest map of where credible sources disagree (both sides), where no good source exists (badge must experiment), and what could not be confirmed this pass — so badge doesn't bluff."
---

# badge GAPS-AND-DISPUTES

> Three classes: **DISPUTES** (credible sources disagree — both sides held, badge calibrates by context),
> **UNCONFIRMED** (a claim badge must re-verify at decision time before quoting), and **EXPERIMENT-NEEDED**
> (no good source — badge must form its own view via tests). Knowing what you don't know is expertise too.

---

## PART 1 — DISPUTES (both sides credible; do NOT pick one silently)

### DISPUTE A — "Everyone is fleeing Clerk" vs "Clerk is commercially winning"
- **Pro-flee (cyberax, HN 48038827):** "Clerk is just a mess. They are trying to cram EVERYTHING into their libraries: Web3 crap, Stripe, etc... Every time we upgraded React, Clerk libraries were the biggest pain... the libraries are obfuscated."
- **Pro-Clerk (notbekacru, same thread):** "companies like Replit and several other large startups are actually adopting Clerk... if your world mainly revolves around X, it can seem like everyone is moving away from Clerk."
- **Credibility twist:** `notbekacru` was flagged as a likely **sockpuppet** (account 2 hours old, username = negation of the Better Auth founder); Clerk cofounder `colinclerk` publicly disavowed it.
- **badge resolution:** BOTH are true — Clerk is commercially winning (Replit + large startups DO use it — weight the FACT, not the sockpuppet messenger) AND has a vocal, real escape cohort driven by reliability (Feb 2026) + churn + price. Do not present either as the whole story. Source: `field-06` §DISPUTE A.

### DISPUTE B — "Roll your own auth" vs "never roll your own"
- **Never-DIY (yodon, risyachka, hobofan):** high error cost; black hats out-experience you; "99% don't know the specs"; concrete failure catalog (password hashes, nonce, timestamps → BOOM).
- **DIY-is-fine (motorest):** "Specs only cover a single responsibility: interoperability. This is not a critical requirement of auth services, unless you have a hard requirement on federated auth."
- **badge resolution (both would accept):** DIY is defensible for **email+password on a single app**; it becomes genuinely dangerous once you add **federation (OIDC/SAML), token rotation, account-linking, MFA** — exactly where Better Auth ITSELF shipped CVEs. "Don't roll your own" really means "don't roll your own *federation/OAuth-provider*." Calibrate advice to whether the user is federating. Source: `field-06` §DISPUTE B; `field-05` §TASTE 6.

### DISPUTE C — Data residency: "managed CIAM all have EU regions now" vs "Clerk/WorkOS are US-only"
- **Source 1 (Auth Omnibus roundup):** "most modern managed CIAM offer EU regions: Auth0, Stytch, Clerk, ... WorkOS (EU)."
- **Source 2 (CIAM Compass / elest.io):** "Clerk and WorkOS both have only US data residency at present"; Clerk "stores user data on US servers with no EU data residency option, relying on the Data Privacy Framework which has already been challenged in court twice."
- **Status: UNRESOLVED — directly contradictory as of mid-2026.** badge MUST verify each provider's CURRENT EU-region status from the provider's own docs at decision time — do not trust roundups. What IS agreed: for **sovereignty** (not just residency), the strong options are EU-native/self-host — **Ory Network (EU-default), Zitadel Cloud (Swiss), Hanko (German), or self-host on EU infra**. The macro-trend (elest.io: "EU Data Residency Laws Are Driving the Self-Hosting Boom") is real. Source: `field-06` §DISPUTE C.

### DISPUTE D — Is Better Auth's paid dashboard real lock-in?
- **Skeptic (portaouflop):** "If I use the commercial option what is the difference to a 3rd party solution? It seems you would still have a 3rd party to offload Auth to?"
- **Founder (bekacru):** the dashboard "connects directly to your existing setup... What you're really 'buying' is additional features like bot protection, analytics"; per val.town it's "basically stateless" and NOT in the session path.
- **badge resolution:** Unlike Clerk (where the service IS your session authority), Better Auth's paid tier is OFF the critical path — so the lock-in/uptime-coupling is materially smaller. But it IS still a third party if you opt into bot-protection/analytics. Honest framing: "self-host = $0 + you own everything; paid dashboard = convenience features, not a session dependency." Source: `field-06` §DISPUTE D.

### DISPUTE E — WorkOS's pitch vs a real defector
- **Founder (grinich, HN):** "WorkOS is focused on enterprise features for b2b apps... Today we power auth for OpenAI, Anthropic, Perplexity, Cursor, Vercel, Plaid, and hundreds more." (Verifiable, strong logo set.)
- **Defector (yard2010, same thread):** migrated "from WorkOS which was so frustrating and lacking in many aspects, or in other words a huge mistake when picking" → went to Firebase.
- **badge resolution:** WorkOS is the enterprise-SSO leader by logos but is NOT universally loved — outside the enterprise-SSO lane its DX reportedly disappoints. Matches its own positioning ("SSO is the core product"). Recommend WorkOS *for enterprise SSO/SCIM*; be cautious recommending it as a general consumer-auth DX play. Source: `field-06` §DISPUTE E.

### DISPUTE F — The control point for agent auth: RUNTIME vs GATEWAY (a genuine open architectural dispute)
- **Runtime thesis (Arcade — interested party, sells a runtime):** "The control point in an agentic architecture is the execution layer where the tool runs... A stateless gateway cannot see execution context... A gateway adds a redundant hop, not a control point."
- **Competing view (API gateways — Kong / Cloudflare):** the gateway CAN carry execution context via headers and is a legitimate enforcement point.
- **Status: UNSETTLED.** badge should NOT assume "runtime > gateway" is decided — it's a vendor thesis from a runtime vendor. Capture as an open architectural dispute; the right answer is likely "policy must be enforced wherever the credential is resolved and the action is taken," which can be either depending on architecture. Source: `field-07` §architectural claim.

### DISPUTE G — Does the Agent Auth Protocol (Better Auth) win, or does MCP-OAuth-native (Stytch/WorkOS) win?
- **Agent Auth Protocol bet (Better Auth agent-auth):** a *separate* protocol — `/.well-known/agent-configuration` discovery + agent-self-signed short-lived JWTs — explicitly "NOT meant to compete with OAuth"; v1.0 published, v2.0 (grant-centric, sub-agent derivation, host attestation) in design. But "heavy development, not stable."
- **MCP-OAuth-native bet (Stytch Connected Apps / WorkOS auth.md):** layers on the MCP OAuth 2.1 substrate (PRM/ASM/DCR/PKCE/8707) that Energy's `mcp-first-connectors.md` already commits to.
- **badge resolution + TENSION FLAG:** these are *different discovery surfaces* — do NOT conflate them. Better Auth's **OAuth-2.1-Provider** plugin IS MCP-OAuth-compliant; its **agent-auth** plugin is a SEPARATE, newer, competing model. Choosing agent-auth is a bet on the Agent Auth Protocol winning, which is **not guaranteed**. For Energy's mcp-first rule, the MCP-OAuth-native path (Stytch/WorkOS/raw) is the aligned default. Source: `ecosystem-02` §tension; `ecosystem-08` §P4.

### DISPUTE H — OSS-with-VC: will the money compromise the free library?
- **Pessimist (shafyy, on Better Auth's $5M):** "It most certainly will at some point" — OSS-with-VC has a monetization clock; incentives drift toward the paid product.
- **Mitigant (bekacru + val.town):** the paid tier is "basically stateless" and off the session path, so the lock-in surface is smaller than Clerk's.
- **badge resolution:** hold the skepticism when betting a stack on a young, VC-funded auth lib, but note Better Auth's specific mitigation (paid tier off the critical path). Watch the commit tempo + whether free features start migrating to paid. Source: `field-05` §TASTE 8.

### DISPUTE I — Does OSS abandonment risk justify avoiding thin auth libs?
- **Abandonment-is-real (threatofrain, FireBeyond):** Lucia sunset into a tutorial ("the author is going to college now"); OpenAuth "seems dead. No activity for 2 months"; "67 open issues, 32 open PRs (many as simple as 'fix typo')."
- **Don't-over-read-it (apgwoz):** "No activity for 2 months implies death? ... people who work on open source are sometimes taking a break."
- **badge resolution:** maintainer bus-factor / commit tempo / open-PR rot IS a first-class selection criterion — but a 2-month gap alone isn't death. The great-practitioner move (Lucia's lesson): if the library is thin enough, learn to host auth yourself so no abandonment can strand you. Source: `field-05` §TASTE 9.

---

## PART 2 — UNCONFIRMED (re-verify before quoting; do not bluff a number)

### U1. Clerk Enterprise-SSO per-connection price (June 2026)
- Recorded ~$50/connection/mo from prior knowledge, but **could NOT confirm from a primary Clerk pricing page** this pass. WorkOS's competing number (~$125/connection/mo) and Auth0's (~$800/mo Professional / $1,500+ enterprise gate) ARE cited. **Action:** verify Clerk's current number on its pricing page before quoting. Source: `ecosystem-00-INDEX.md` §GAPS (1); `ecosystem-01` §pricing-note.

### U2. Auth0 password-hash bulk-export policy (2026)
- The migration playbook references Auth0 gating bulk password-hash export behind a support request (a known historical blocker), but **could not re-confirm the exact 2026 policy from a primary Auth0 doc.** Treat as "historically true, verify at migration time." Source: `ecosystem-00-INDEX.md` §GAPS (2); `ecosystem-05`; `field-03`.

### U3. Mimo "Auth0 → Firebase, 6M users, ~8h import" war story
- Surfaced via WebSearch (buildmvpfast / migration roundups), **corroboration recommended** — the specific numbers (6M users, ~8h bulk, weeks of prep) are plausible and consistent with the universal pattern but are second-hand. Use the *pattern* (import fast, prep slow) confidently; cite the *numbers* with a caveat. Source: `field-03` §Mimo.

### U4. WorkOS "1,000s of enterprise SSO connections migrated with almost zero friction"
- **Vendor claim (WorkOS, interested party).** The *number* is plausible given the per-connection model; "**zero friction**" is marketing. Treat as a ceiling, not a floor. Source: `field-03` §Auth0→WorkOS; `field-06` §when-WorkOS-wins.

### U5. Clerk free-tier exact $ and "Enhanced Auth add-on" fate (Feb 5 2026 pricing change)
- Sources agree the free tier moved **10K → 50K** Monthly Retained Users and unlimited applications landed, but disagree on Pro price (**$20 vs $25/mo**) and the exact framing of the eliminated Enhanced Authentication add-on. **Action:** re-quote current numbers from Clerk's pricing page; the "$2,025/mo at 100K MAU" figure roughly holds but the *crossover* moved from ~10K to ~50K. Source: `field-08` §SHIFT 1.

### U6. auth.md publish date — RESOLVED but logged
- Initially saw April (aggregator) vs May 21 (blog body). **Confirmed 2026-05-21, author Garrett Galow** from the WorkOS blog index. Logged for the audit trail; per-tool files already use May 21. (Not an open gap — included so badge doesn't re-litigate it.) Source: `ecosystem-00-INDEX.md` §GAPS (3); `ecosystem-03`.

### U7. Stytch refresh-token rotation behavior
- Stytch refresh tokens have a **3600s expiry** (short); whether/how they rotate on use was **not confirmed** from a primary doc. **Action:** verify rotation + reuse-detection behavior before relying on Stytch for high-frequency agent traffic. Source: `ecosystem-04` §watch-outs.

---

## PART 3 — EXPERIMENT-NEEDED (no good source; badge must form its own view via tests)

> Per `dsip.json` `externalIntelligence` + the open-endedness mandate: where the field has no settled answer,
> badge runs experiments (against the real tools / MCP Inspector) and writes findings back to `ORG_MEMORY`.

### E1. Does each candidate AS actually bind audience to the grant? (the GHSA-p2fr receipt generalizes)
- Better Auth shipped an RFC 8707 audience-binding hole; **there is no published audit confirming Stytch / WorkOS / Auth0 do the bind correctly on every path.** EXPERIMENT: use MCP Inspector to complete a flow, then request a token whose `aud` targets an uncovered resource — confirm each AS returns `invalid_target`, not a token. Write results to `ORG_MEMORY`. Source: `field-04` §GHSA-p2fr (the generalizable test).

### E2. Which AS supports CIMD today, in practice?
- SEP-991 made CIMD *recommended* (2025-11-25), but **which production AS actually accept a `client_id` that is an HTTPS metadata URL is undocumented in this corpus.** EXPERIMENT: test CIMD registration against Stytch / WorkOS / a Better-Auth-backed AS; record support matrix. (This directly feeds the "CIMD > DCR > pre-registered" stance — verify it's *available* before recommending it.) Source: `ecosystem-06` §CIMD.

### E3. Real-world MCP-OAuth interop across LLM clients (Claude vs ChatGPT)
- The CORS/consent-redirect breakage (BA #7041) shows **agent-driven consent differs by client.** No single source maps which clients break on which AS configs. EXPERIMENT: drive the full consent round-trip from Claude AND ChatGPT against badge's connector; record the deltas (CORS, redirect handling, DCR expectations). Source: `ecosystem-12` BA #7041; `field-07`.

### E4. The runtime-vs-gateway control-point question (DISPUTE F) for Energy's specific architecture
- The dispute is unsettled in general; **for Energy's recursive-grid / earning-agent architecture there is no source at all.** EXPERIMENT: prototype both a runtime-enforced and a gateway-enforced policy gate for one agent tool, measure which can actually see the `(user, agent, scopes, audience, tenant, task_id)` context. Source: `field-07` §architectural claim.

### E5. Sub-agent identity derivation (Agent Auth Protocol v2, in design)
- v2 adds "sub-agent derivation" (a parent agent minting scoped identities for children) — the recursive-grid analog at the identity layer. **The protocol is in design; no stable implementation exists.** EXPERIMENT-WHEN-AVAILABLE: track agentauthprotocol.com; when v2 ships, test parent→child scoped-identity derivation against Energy's recursive-grid model. This is badge's most strategically relevant frontier. Source: `ecosystem-08` §sub-agent derivation; `ecosystem-02` §protocol version.

### E6. X / Twitter practitioner signal (skipped this pass — documented)
- The field researcher attempted X via energy's `scripts/x-content-intel/` with a valid session (45 cookies) but the **`SearchTimeline` GraphQL query ID was stale → HTTP 404.** Relied on HN (4 threads, 240+178+106+ comments), GitHub issues + security-advisories API, and WebSearch instead — stronger primary sources than tweets. **For a future pass:** use the `x-feed-curate` / `x-content-intel` skill (self-heals the query ID via live DOM) or the browser-DOM→`--from-json` login-light pattern; do NOT hand-roll the GraphQL hash. The X gap does not materially weaken findings. Source: `field-08` §X-signal.

---

## What the corpus does NOT cover (honest scope limits)

- **Non-TS/JS ecosystems** are referenced only as "your framework probably ships auth" (Laravel/Rails/Django/Phoenix) — no deep treatment. If a task is in those stacks, badge must research the in-framework auth directly.
- **Biometric / device-bound passkey implementation details** — passkeys are flagged as table-stakes (`field-08` §SHIFT 7) but the corpus has no implementation depth (attestation, sync-vs-device-bound, fallback UX). EXPERIMENT/RESEARCH needed before deep passkey work.
- **Pricing is a moving target** — every $ figure here (U1, U4, U5, the 100K-MAU math) must be re-verified at decision time; the corpus is a June-2026 snapshot.
- **Clerk server-side internals** are closed-source — the `clerk/javascript` repo is SDKs only, so "GitHub breakage" signal for Clerk is SDK-level, not server-level. Source: `ecosystem-00-INDEX.md` §note.

---

## Verdict on research quality (for the audit trail)
The corpus is **good-enough to make a fresh session dangerous** in this vertical: primary-source CVE/GHSA receipts, dated vendor postmortems, named war stories, and the P1–P4 + intersection-rule mental models are all present and cross-checked. The honest weaknesses are (a) **pricing currency** (re-verify every number), (b) **the X signal gap** (mitigated by stronger HN/GitHub sources), and (c) **passkey implementation depth** (table-stakes but shallow). The agent frontier (E1–E5) is correctly framed as experiment-needed rather than bluffed — which is itself a sign of disciplined research.
