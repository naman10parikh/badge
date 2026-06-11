---
type: research
domain: auth
topic: field intelligence — production postmortems (real outages, named, dated)
researcher: FIELD-INTELLIGENCE (CP123 Wave-R)
created: 2026-06-11
status: done
currency: June 2026
---

# Field Intelligence — Production postmortems (the outages that actually happened)

> These are vendor-published, dated, root-caused incidents. The most credible evidence we have:
> the providers admitting their own failures in writing. Every claim cited with URL + date.

## Clerk — TWO outages in 9 days, Feb 2026 (the "single point of failure" case study)

The auth provider you outsource to IS your availability floor. Clerk had two separate
multi-hour outages 9 days apart in Feb 2026, both with public postmortems.

### Outage A — DNS provider failure (Feb 10, 2026)
Source: **Clerk blog, "Postmortem: DNS Provider Outage (February 10, 2026)"**
https://clerk.com/blog/2026-02-10-dns-outage-postmortem (accessed 2026-06-11).
Also: HN https://news.ycombinator.com/item?id=46958590-era status; status.clerk.com history.

- **Onset:** 2026-02-10 17:06 UTC. **Duration:** authoritative DNS resolution unavailable **2h 32m**.
- **Root cause:** failure at Clerk's DNS provider. Underlying services stayed healthy; traffic couldn't reach them.
- **Blast radius:** successful request volume stayed **>95% of expected** thanks to DNS caching + fallback DNS + emergency customer guidance — BUT for any app/user who couldn't resolve the API, it was a **complete outage** (including already-logged-in users, because Clerk holds the session authority).
- **The damning admission (verbatim sense):** Clerk "did not have a failover prepared for the event of a complete outage at their DNS provider. Although DNS provider redundancy had been planned for 2026, it sits behind other infrastructure improvements that Clerk believed were higher risk to the service."
- **Remediation:** stand up a truly independent DNS provider for failover (ETA weeks); decouple DNS provider from registrar so emergency nameserver changes aren't blocked by a DNS-provider outage.

### Outage B — Postgres query-planner flip (Feb 19, 2026) — a *textbook* DB failure
Source: **Clerk blog, "Postmortem: Clerk System Outage (February 19, 2026)"**
https://clerk.com/blog/2026-02-19-system-outage-postmortem (accessed 2026-06-11).
HN: https://news.ycombinator.com/item?id=47105189 (low engagement, 1 pt).

- **Onset:** 2026-02-19 ~08:11 PST (16:15 UTC). **~90 min to initial recovery, ~1h55m to full stabilization** (18:06 UTC).
- **Root cause (quote-worthy):** an automatic PostgreSQL `ANALYZE` triggered a **query-plan flip**. The planner's sample "only found NULL values," so it "erroneously concluded that 100% of the values were NULL" when the true figure was **99.9996%**. It optimized for zero rows on a query that actually returned **>17,000 rows**, consuming nearly all DB resources.
- **Blast radius:** **>95% of traffic returned 429** (rate-limit) without reaching handlers; sign-in APIs and account-management APIs inaccessible; session access only partially restored via failover at 17:10 UTC while signin stayed down.
- **Architectural weaknesses admitted (verbatim sense):**
  - the previous failover "was designed to trigger during Postgres outages" but **failed here because the DB was technically online, just degraded**.
  - the new failover existed but "hadn't been instrumented with triggers in production yet," and the **team lacked training on enabling it.**
  - Clerk acknowledged it had failed availability expectations **"too many times in recent months."**
- **Remediation:** query-plan alerting, automatic failover instrumentation (weeks), audit all queries for statistics stability, formal incident-comms process.

**badge takeaways from Clerk's bad month:**
1. The val.town line nails it: *"its reliability is the minimum of the combined reliability of its critical parts."* If the IdP holds the session authority and goes down, **logged-in users go down too** — not just new logins.
2. "Degraded-but-online Postgres" is a class of failure that naive failover (which watches for "DB down") misses. Any Auth product MUST treat slow/degraded as a failover trigger, not just hard-down.
3. DNS-provider-coupled-to-registrar is a real single point of failure even for a well-funded ($50M-raised) auth vendor.

## Auth0 / Okta — the historical megabreach context (older, still load-bearing)
- The **Okta support-system breach (Oct 2023)** — attackers accessed HAR files in Okta's support case-management system containing session tokens, and pivoted to customers (Cloudflare, 1Password, BeyondTrust detected it). Still the canonical "your IdP's support desk is part of your attack surface" story. (Widely reported; older than 6mo — flagged. Use as context, not currency.)
- **2026-relevant reframing:** the DEV.to migration author's line — *"I've seen more breaches from misconfigured Auth0 than from choosing the 'wrong' provider"* (https://dev.to/alanwest/auth0-vs-clerk-vs-authon-migrating-your-auth-layer-in-2026-4aao, 2026). The risk is misconfiguration, not vendor choice.

## Meta-pattern across postmortems
- **Managed-auth outages are correlated, not independent.** A DNS or DB failure at the vendor takes down EVERY tenant at once. Self-hosted auth fails independently (your Postgres, your blast radius).
- This is the empirical backbone of the 2026 "own your auth" movement (see field-03 migration stories): people aren't leaving Clerk only on price — the Feb 2026 double-outage is cited repeatedly as the reliability trigger.
