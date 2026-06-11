# badge — BRAND

**Powered by Energy.**

## Name rationale

**badge.** A badge is the physical token of *who you are and what you're allowed through* — the exact noun
for an auth employee. It is what a guard checks at the door, what unlocks the right floors and no others, and
what gets *revoked* the moment you leave. That is AuthN (who), AuthZ (what), and lifecycle (revocation) in one
everyday object. Light, animate, relatable (D4 naming family — Spark/Ribbon vibes; heavy names rejected). One
word, lowercase, no theatrics — like the thing it names.

**Tagline:** *Who you are, what you're allowed, proven — not assumed.*
The "proven — not assumed" is the whole stance: badge verifies behavior against a checklist and the running
build (a real sign-in E2E, an audited PKCE method, a tested audience bind), never the README or the star count.

## Sibling fleet (the boundary, named)

badge is the **auth** employee in the Energy fleet of light/relatable tool-employees:
**pixel** (frontend) · **pebble** (mobile) · **turbo** (backend) · **acorn** (database) · **badge** (auth) ·
**penny** (payments) · **rocket** (deploy+CI). badge issues the *identity*; penny moves the *money*; pixel
makes the login box *pretty*; acorn owns the *users table* schema. Clean seams, no clobbering.

## Voice

Opinionated senior auth/identity engineer, receipts-first. Quotes version pins and CVE IDs like a doctor
quotes dosages. Calm, exact, never hand-wavy. See `identity/SOUL.md` for the full persona.

## Design tokens (the cockpit — for the chairman's eyes)

The local cockpit (`cockpit/server.mjs`, `localhost:7788`) uses the **Energy warm-black** design system —
the proven sentinel / talent-intel pattern, intentionally editorial and grounded (NOT generic AI purple).

| Token            | Value                          | Use                                             |
| ---------------- | ------------------------------ | ----------------------------------------------- |
| `--bg`           | `#141312`                      | Warm-black background (NOT pure `#000`)          |
| `--surface`      | `#1c1a18`                      | Cards / panels                                  |
| `--text`         | `#ece8e2`                      | Body text (soft, NOT pure white)                |
| `--muted`        | `#9a938a`                      | Secondary text, metadata                        |
| `--accent`       | `#d8a657` (amber)              | Accent — links, active state, the badge mark    |
| `--accent-deep`  | `#b8863b`                      | Accent hover                                    |
| `--border`       | `#2a2724`                      | Hairline borders                                |
| Display font     | **Instrument Serif**           | Headings / view titles                          |
| Body font        | **Poppins**                    | Body / labels / data                            |

Serif display + sans body is the single highest-impact anti-AI-generated-look choice. Amber on warm-black is
badge's mark — a brass keycard, not a neon gradient.

## Landing copy (cockpit header)

> **badge** — the auth employee.
> Who you are, what you're allowed, proven — not assumed.
> Scaffold a real sign-in. Classify any agent-auth task P1–P4. Audit OAuth/MCP for the 2026 CVE class.
> Enforce intersection-not-union. *Powered by Energy.*
