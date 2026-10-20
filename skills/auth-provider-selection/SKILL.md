---
name: auth-provider-selection
description: "Pick a human-CIAM auth provider (or self-host) as a DECISION with $ breakpoints + the boring-enterprise checklist — never a feature table. Use when choosing between Clerk, WorkOS, BetterAuth, Auth0 or self-hosting, or when asking what auth will cost at scale."
trigger: ["which auth provider", "Clerk vs WorkOS vs BetterAuth vs Auth0", "what auth should I use", "what will auth cost at scale", "self-host auth or use a SaaS", "best auth for B2B / enterprise / consumer"]
---

# auth-provider-selection

> The selection job (EM JTBD-2). badge produces a **decision**, not a comparison matrix.
> Encodes `brain/OPINIONS.md` O5/O6/O7 + `brain/EXPERTISE-MAP.md` JTBD-2 + the $ breakpoints.
> Runs `badge advise` under the hood.

## When to use
A human/team is choosing how to authenticate humans (Plane 1). If the task is an AGENT
needing auth (MCP server, on-behalf-of, agent identity), use **agent-auth-classifier** instead
— that's Plane 2.

## Steps

1. **Ask the framework question FIRST (model: haiku).** If they're on Laravel/Rails/Django/
   ASP.NET/Phoenix, auth+users+roles are already in the box — the answer may be "you already
   have it" (OP O6, `brain/OPINIONS.md`). Only proceed to a SaaS if they're on JS/TS or need
   federation depth a framework lacks.

2. **Classify the use-case (model: haiku):** consumer/velocity · B2B-must-close-enterprise ·
   enterprise (>$200k ACV) · self-host/sovereignty. This picks the default.

3. **Emit the decision (model: sonnet) — run `badge advise --use-case <uc> [--mau <n>] [--enterprise]`.**
   The default verdicts (OP O7, `brain/OPINIONS.md`):
   - **consumer/velocity → Clerk** (fastest Next.js DX) — but it's a rental that WILL make you
     migrate majors (v5→v6→Core 3), and at 100K MAU it's ~$2,025/mo vs BetterAuth ~$25-50/mo.
   - **B2B/enterprise → WorkOS AuthKit** (the enterprise-readiness reference: SSO/SCIM/Admin
     Portal/ordered Events API; 1M MAU free core; ~$125/SSO connection).
   - **self-host/sovereignty → BetterAuth** (own-your-DB, MCP-SDK-blessed) — pin the version,
     gate every upgrade behind a full auth E2E (the 2026-05-31 CVE batch; OP O10).
   - **Auth0 → only if the buyer mandates Okta** (the "Okta tax": $240→$3,729/mo, 15.54x).

4. **Attach the boring-enterprise-details checklist (model: sonnet):** audit logs, config/version
   history, offline mobile, debuggability, **maintainer bus-factor**, SCIM deprovisioning,
   SAML metadata auto-refresh. Evaluate on THESE, not the 5-minute demo (OP O5, EM 2.6).

5. **Attach the reliability frame:** reliability = the minimum of the combined reliability of its
   critical parts; if the IdP holds session validation and goes down, logged-in users go down too
   (OP O1, `brain/EXPERTISE-MAP.md` JTBD-10). Recommend owning session validation when uptime matters.

## Output format
A DECISION (one recommended provider + why), a `$ breakpoints` table (each figure carrying the
"re-verify at decision time" caveat — pricing is a June-2026 snapshot), the boring-enterprise
checklist, and a one-line reliability note. NOT a feature-comparison table (OP O5).

## Refuse
- A bare feature matrix with no recommendation (OP O5).
- "Just use Clerk/Auth0" with no plane/use-case/$ reasoning.
- Quoting a $ figure as gospel — always attach the re-verify caveat (GD U1/U4/U5).

Brain: `brain/OPINIONS.md` (O1/O5/O6/O7/O10), `brain/EXPERTISE-MAP.md` (JTBD-2, JTBD-10), `brain/BATTLE-TESTED-SCENARIOS.md` (BTS-1/BTS-8/BTS-16).
