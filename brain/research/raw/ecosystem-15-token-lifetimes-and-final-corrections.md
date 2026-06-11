---
type: research
domain: auth
topic: token-lifetime corrections (Stytch) + BetterAuth-SCIM gap confirm + repo-shape confirms
researcher: ECOSYSTEM (CP123 Wave-R, verification pass)
created: 2026-06-11
status: done
---

# Token-lifetime corrections + final repo confirms — June 2026

Targeted corrections from primary-source verification. Two of these FIX errors in the earlier corpus; one resolves an open question; the rest are confirms. All accessed 2026-06-11.

---

## CORRECTION 1 — Stytch token lifetimes (the corpus had the refresh-token wrong)

`ecosystem-04-stytch.md` states: *"Access tokens = JWT, RS256. Refresh tokens = bearer, **3600s** expiry."* The **3600s is the ACCESS-token default, not the refresh token.** Corrected mechanics:

- **Access token:** JWT, RS256; lifetime = client's **`access_token_expiry_minutes`**, **defaults to 60 minutes (3600s).** (This is what the corpus mislabeled as the refresh expiry.)
- **Refresh token — PUBLIC clients** (First-Party Public / Third-Party Public — i.e. agents, SPAs, MCP clients): **expiry = 3 months from issuance**, and **rotated on every use** (the old refresh token is rotated out, a new `refresh_token` returns in the response). This is the OAuth-2.1-§4.3.1-compliant rotation path — and it's the one agents/MCP clients hit.
- **Refresh token — CONFIDENTIAL clients** (First/Third-Party Confidential — backend with a secret): **initial expiry 6 months, each use extends +3 months (sliding window), NO rotation.**
- Stytch summary: "manage JWT issuance, provide JWKS, **rotate refresh tokens**, allow **instant revocation** … short token lifetimes + rotating refresh tokens limit damage from leaks."
- Sources: [Stytch — Exchange Refresh Token for Access Token](https://stytch.com/docs/api/connected-app-token-refresh-token); [Stytch — Connected App Token](https://stytch.com/docs/b2b/api/connected-app-token); [Stytch — Understanding Client Types](https://stytch.com/docs/guides/connected-apps/client-types) (accessed 2026-06-11).

**badge implications:**
- Quote Stytch as **"60-min access tokens (configurable via `access_token_expiry_minutes`); refresh tokens 3 months + rotated for public/agent clients, 6-month sliding + no rotation for confidential."** The corpus's "3600s refresh, confirm rotation" line was both mislabeled AND its open question is now answered: **public/agent clients DO get rotated refresh tokens** (spec-compliant), confidential ones do NOT (they rely on the secret + sliding window instead).
- The **client-type choice drives the security model**: an agent should register as a **Public** client (rotation on) — NOT confidential — so it gets OAuth-2.1 refresh rotation. Registering an agent as confidential disables rotation, which is the wrong posture for a compromisable long-running agent (per `ecosystem-08`'s "never let a compromisable principal hold a non-rotating long-lived credential").

## CORRECTION 2 — Better Auth SSO plugin has NO SCIM (confirms the residual WorkOS/Clerk edge)

`ecosystem-13` upgraded Better Auth's SSO standing (SAML hardened, #96 closed, self-serve dashboard) but kept SCIM as the remaining gap. **Confirmed from the SSO plugin docs:**

- The SSO plugin covers: **SAML 2.0** (SP- and IdP-initiated, assertion encryption, signed AuthnRequests, attribute mapping), **OIDC/OAuth2** (auto-discovery from provider metadata), and **login-time provisioning** via a **`provisionUser` callback** (+ `provisionUserOnEveryLogin` to re-sync on each login).
- **It does NOT do SCIM 2.0 / directory sync / background deprovisioning.** Quote: the docs contain "no references to SCIM, directory synchronization, or automatic user deprovisioning. The provisioning capabilities are limited to login-time operations only — users are created or updated when they authenticate, not through background directory sync."
- Source: [Better Auth — SSO plugin docs](https://better-auth.com/docs/plugins/sso) (accessed 2026-06-11).

**badge implication — the precise SSO/SCIM standing as of June 2026:**
- **SAML/OIDC login:** Better Auth ≈ WorkOS ≈ Clerk (all solid; Better Auth's v1.5 hardening closed the gap).
- **SCIM deprovisioning** (the deal-blocker above ~$200k ACV per `ecosystem-07`): **WorkOS (ordered Events API) > Clerk (GA'd Apr 2026, free-with-connection) >> Better Auth (NONE — only login-time `provisionUser`; you'd build SCIM yourself).**
- So the honest one-liner: *Better Auth caught up on SSO but still has no SCIM* — for a regulated B2B harness that must auto-deprovision, Better Auth means **building the SCIM endpoint + ordering + signature validation yourself** (the `ecosystem-07` burden). That's the real cost of the self-host choice; don't hand-wave it.

## RESOLVED — the corpus's "confirm Stytch rotation" open question
Answered above: **public/agent clients get rotated refresh tokens (3-month); confidential clients get a 6-month sliding window with no rotation.** Close this item.

## CONFIRMS (repo shapes, for citation integrity)

| Repo | Stars | Pushed | Lang / License | Note |
|---|---|---|---|---|
| [workos/auth.md](https://github.com/workos/auth.md) | 418★ | 2026-06-10 | TypeScript / **NO license declared** | Desc confirms mechanic: *"open protocol that lets agents register for services on behalf of users — discoverable through a Markdown file at your domain."* ⚠️ **No LICENSE file** is a real adoption risk for an "open" protocol — flag it; "open" currently means "published," not "permissively licensed." Worth re-checking before Energy depends on it. |
| [better-auth/agent-auth-protocol](https://github.com/better-auth/agent-auth-protocol) | **151★** | 2026-05-20 | — | corpus said "(small)" — it's 151★, growing. The spec repo (v1.0 published, v2.0 grant-centric redesign in design). |
| [workos/cli](https://github.com/workos/cli) | 51★ | 2026-06-10 | — | confirms `ecosystem-11`'s "most agent-native auth CLI" (the `WORKOS_MODE=agent` tool) is live + actively pushed. |

## Net-new corrections to feed the corpus
1. `ecosystem-04` (Stytch): fix the token-lifetime line — **3600s = access token; refresh = 3mo rotated (public) / 6mo sliding no-rotation (confidential)**; and add the **"register agents as PUBLIC clients to get rotation"** rule.
2. `ecosystem-13`/`07`/`10`: Better Auth SSO ≈ WorkOS/Clerk now, **but SCIM is genuinely absent in Better Auth** (login-time `provisionUser` only) — keep SCIM as the WorkOS>Clerk>>BetterAuth ordering.
3. `ecosystem-09` (repos): `agent-auth-protocol` = **151★** (not "small"); flag **`workos/auth.md` has NO license** despite being "open."

## Sources
- https://stytch.com/docs/api/connected-app-token-refresh-token (accessed 2026-06-11)
- https://stytch.com/docs/b2b/api/connected-app-token (accessed 2026-06-11)
- https://stytch.com/docs/guides/connected-apps/client-types (accessed 2026-06-11)
- https://better-auth.com/docs/plugins/sso (accessed 2026-06-11)
- gh repo view workos/auth.md, better-auth/agent-auth-protocol, workos/cli (accessed 2026-06-11)
