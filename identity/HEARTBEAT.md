# badge — Heartbeat

> badge is a tool-employee, not a scanning/earning agent — its "heartbeat" is the deterministic RSI watch on
> the fast-moving auth/MCP-spec landscape, plus the eval gate. The engine is `workflows/rsi.workflow.js`
> ($0/tokenless; Claude half on `CLAUDE_CODE_OAUTH_TOKEN` — D8), scheduled by `.github/workflows/rsi.yml`.

## Schedule

| Check                       | Frequency        | Action on anomaly                                                   |
| --------------------------- | ---------------- | ------------------------------------------------------------------ |
| refresh-brain (TM watchlist)| Nightly (RSI)    | Diff vs last snapshot; on a watched delta → write to `brain/ORG_MEMORY.md` + flag the affected brain file (Claude half rewrites it when the token lands) |
| re-verify-tool-matrix       | Nightly (RSI)    | TOOL-MATRIX defaults still resolve (URLs 200, versions parse); on drift → flag for review |
| run-eval-pyramid (L1+L2)    | Nightly + on PR  | Any golden-task regression = red → blocks the cycle (no self-grading) |
| acceptance E2E (Clerk)      | On push/PR (CI)  | Not green ⇒ badge is not done (pass^k k≥3)                          |

## The watchlist (what "the field moved" means — TM)

MCP spec changelog (2025-11-25 → 2026-07-28 RC) · BetterAuth security-advisories
(`gh api repos/better-auth/better-auth/security-advisories`) · Clerk changelog (Core 3 churn) · WorkOS blog +
`auth.md` repo · agentauthprotocol.com · vendor pricing pages (the `advise` $ breakpoints).

## Health indicators

- **Healthy:** last RSI dry-run exit 0; eval pyramid green; acceptance E2E green ×3.
- **Warning:** a watchlist delta flagged + unmerged; one eval regression; a TOOL-MATRIX URL non-200.
- **Critical:** acceptance E2E red, or a new auth CVE in a pinned dependency → escalate (CHAIRMAN-CHECKLIST).

## Recovery

1. Read the flagged delta from `brain/ORG_MEMORY.md`.
2. Check `brain/KNOWN-PITFALLS.md` for the pinned-version fix.
3. If the Claude half is lit (`CLAUDE_CODE_OAUTH_TOKEN`): rewrite the affected brain file, add/update a golden
   task, re-run the eval gate, open a gated PR. Snap back via git if the eval regresses.
4. If not: leave the flag + a CHAIRMAN-CHECKLIST line; the deterministic gate stays green ($0).
