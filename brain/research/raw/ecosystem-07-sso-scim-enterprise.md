---
type: research
domain: auth
topic: enterprise SSO + SCIM
researcher: ECOSYSTEM (CP123 Wave-R)
created: 2026-06-10
status: done
---

# Enterprise SSO + SCIM — June 2026

## The mental model (SSO ≠ SCIM — they're complementary, both required for enterprise-ready)
- **SSO (SAML 2.0 / OIDC)** handles **login time** — the trust relationship that lets an enterprise's IdP (Okta, Entra/Azure AD, Google Workspace, Ping) authenticate the user into your app. SAML is the legacy-but-dominant enterprise protocol; OIDC is the modern one. You support BOTH because enterprises mandate whichever they standardized on.
- **SCIM 2.0 (inbound)** handles **lifecycle** — the IdP automatically PROVISIONS users into your SaaS when IT adds an employee, and **DEPROVISIONS** them when IT removes one. Webhook/event-driven.
- "SAML and SCIM are not competing — SAML handles login, SCIM handles provisioning/deprovisioning; used together for enterprise-ready." Source: [WorkOS — SCIM vs SAML](https://workos.com/blog/scim-vs-saml) (accessed 2026-06-10).

## Why deprovisioning is the load-bearing requirement
- **SCIM-driven deprovisioning is non-negotiable for regulated industries** and is "the most-tested compliance question in B2B SaaS security questionnaires above ~$200k contract value." If a departing employee keeps access because you only did SSO and not SCIM, you fail the security review and lose the deal.
- Source: [guptadeepak — SCIM Provisioning B2B Practitioner's Guide](https://guptadeepak.com/ciam-compass/guides/scim-provisioning/) (accessed 2026-06-10).
- **badge rule:** for any B2B SaaS selling upmarket, SSO + SCIM ship TOGETHER, planned in one deployment. "Map the SSO trust relationship, directory-sync path, and deprovisioning flow before launch so authentication and lifecycle state cannot diverge."

## SCIM gotchas (real breakage badge must prevent)
1. **Validate webhook signatures before processing directory events. Reject any lifecycle event that fails signature verification.** (Unsigned SCIM events = attacker can provision/deprovision arbitrary users.)
2. **Ordering & delivery:** out-of-order or dropped SCIM events cause provisioning drift (user created-then-deleted processed in wrong order = ghost access). WorkOS's pitch is its **Events API processes every SCIM request in order and real-time** — "never miss a provisioning request." This is a genuine differentiator; naive SCIM endpoints drop/misorder events.
3. **Smaller CIAM products have rough or missing SCIM.** "WorkOS, Frontegg, Auth0, and SSOJet ship SCIM cleanly; smaller CIAM products often have rough implementations or lack it entirely." Source: [WorkOS alternatives / scalekit](https://www.scalekit.com/blog/workos-alternatives) (accessed 2026-06-10).

## Who ships enterprise SSO/SCIM well (June 2026)
| Vendor | SSO (SAML/OIDC) | SCIM 2.0 | IT-admin self-serve portal | Notes |
|--------|------|------|------|------|
| **WorkOS** | yes | yes (ordered Events API) | yes (hosted Admin Portal) | the reference implementation; SSO/SCIM are PAID (not in 1M-MAU free tier), ~$125/connection/mo |
| **Auth0/Okta** | yes | yes | yes | breadth + certs, but SSO gated behind "$1,500+/mo" enterprise |
| **Clerk** | yes (SAML + EASIE) | yes (SCIM) | partial | Enterprise SSO is a PAID add-on; org-first B2B |
| **Frontegg / SSOJet / Scalekit** | yes | yes | yes | WorkOS competitors specializing in B2B enterprise-readiness |
| **Better Auth** | SSO plugins exist (SAML was the #1 requested issue, #96, 71 comments) | via plugins/self-build | no | you own it; less turnkey for enterprise IT |

## Honest take for badge
- **Enterprise-readiness = SSO + SCIM + Admin Portal + Audit Logs, shipped together.** WorkOS is the cleanest turnkey path and the market reference; its whole business model is "free consumer auth, monetize SSO/SCIM." Auth0 has the breadth but the pricing pain. Clerk does it but as paid add-ons and is more consumer/org-first.
- **The compliance reality:** above ~$200k ACV, SCIM deprovisioning + signed-webhook validation are deal-blockers, not nice-to-haves. badge should never let a B2B harness ship "SSO only."
- **Self-host (Better Auth):** doable but you carry the SCIM ordering/signature burden yourself — only choose if data-ownership outweighs the turnkey value.

## Sources
- https://workos.com/blog/scim-vs-saml (accessed 2026-06-10)
- https://workos.com/guide/scim-vs-sso (accessed 2026-06-10)
- https://guptadeepak.com/ciam-compass/guides/scim-provisioning/ (accessed 2026-06-10)
- https://www.scalekit.com/blog/workos-alternatives (accessed 2026-06-10)
- https://www.microsoft.com/en-us/security/business/security-101/what-is-scim (accessed 2026-06-10)
