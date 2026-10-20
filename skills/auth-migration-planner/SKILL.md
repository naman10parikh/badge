---
name: auth-migration-planner
description: "Plan a provider migration (X→Y) as a dual-validation window + the four named casualties — never a big-bang cutover that force-logs-out every user. Use when a team is switching auth providers (for example Clerk to BetterAuth, or Auth0 to WorkOS) and must not log anyone out."
trigger: ["migrate off Clerk", "switch auth providers", "move from Auth0 to WorkOS", "migrate to BetterAuth without logging everyone out", "auth provider migration plan", "Okta tax renewal shock", "leaving our auth vendor"]
---

# auth-migration-planner

> The migration job (EM JTBD-8). Every credible migration story repeats one shape: the bulk
> import is EASY (hours); the hard part is the **1-2 week dual-validation window** where the
> backend accepts BOTH old and new tokens and users age over gradually. Encodes the
> dual-validation rule (OP O32) + the four named casualties (OP O33). Runs `badge migrate`
> under the hood. (For the heavyweight full-repo migration plan, dispatch the
> `badge-migration-planner` sub-agent.)

## When to use
A team is moving from one auth provider to another (Clerk→BetterAuth for ownership/reliability,
Auth0→WorkOS for the "Okta tax", any X→Y) and wants to do it WITHOUT a forced mass logout. For
CHOOSING the destination provider in the first place, use **auth-provider-selection**; for an
agent-auth task, use **agent-auth-classifier**.

## Steps

1. **Refuse the big-bang cutover up front (model: haiku).** A same-day swap force-logs-out every
   active user. The only safe shape is the dual-validation window (OP O32, `brain/OPINIONS.md`).
   Say this first — it reframes the whole plan.

2. **Emit the dual-validation plan (model: sonnet) — run `badge migrate --from <X> --to <Y>`:**
   1. **Bulk-import users** — the EASY/fast part (hours). Passwords port if the hash algo matches;
      else lazy re-hash on first login.
   2. **Open a 1-2 week dual-validation window** — rewrite EVERY auth endpoint to accept BOTH the
      old and the new session/token type.
   3. **Migrate gradually** — the sign-in page starts issuing new-provider sessions; old sessions
      age out naturally (no forced logout).
   4. **Handwrite the security-critical token-verification path** — do NOT trust an auto-migrator
      for it (BTS-4, the Val Town reference migration).
   5. **Verify backend token-format handling FIRST** — that's the hard step, not the import (token
      formats differ; middleware needs updating).
   6. **Age out the last old sessions** and remove the old-provider acceptance path after the window.

3. **Name the four casualties — they do NOT migrate cleanly (model: sonnet, OP O33):**
   - **active sessions** — every logged-in user is forced out unless the dual-validation window runs.
   - **SSO / SAML connections** — enterprise IdP trust must be RE-ESTABLISHED, not ported (LobeHub
     lost SSO data).
   - **social-account links** — users must manually re-link Google/GitHub/etc. (the simplest path
     drops them).
   - **custom claims** — app-specific token claims don't survive; re-derive them on the new provider.
   Plan to re-establish these, not port them — the up-front honesty generic docs omit.

4. **Surface the migration-specific gotchas (model: haiku):**
   - **Auth0→WorkOS (the "Okta tax"):** WorkOS ~$125/SSO-connection vs Auth0's per-MAU model is
     dramatically cheaper for 5-10 enterprise SSO customers; **Auth0 password-hash bulk export is
     gated — verify the current policy** before committing (BTS-16).
   - **Clerk→BetterAuth (the reference):** people leave Clerk on RELIABILITY (session
     single-point-of-failure) + two-users-tables/webhook drift, not only price (BTS-1/BTS-8).

## Output format
A migration `plan` (the 6 dual-validation steps, in order), the four `casualties` (each with how to
re-establish it), the `window` (1-2 weeks), provider-specific `notes`, and the cites. NEVER a
big-bang cutover.

## Refuse
- A same-day / big-bang cutover (forces a mass logout — OP O32).
- Trusting an auto-migrator for the token-verification path (handwrite it — BTS-4).
- Promising the four casualties "just port" — they must be re-established (OP O33).

Brain: `brain/EXPERTISE-MAP.md` (JTBD-8), `brain/OPINIONS.md` (O32/O33), `brain/BATTLE-TESTED-SCENARIOS.md` (BTS-4/BTS-16), `brain/KNOWN-PITFALLS.md` (C9 — BetterAuth wants its own user table).
