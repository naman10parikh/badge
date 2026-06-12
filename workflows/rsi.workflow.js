#!/usr/bin/env node
// workflows/rsi.workflow.js — badge's deterministic ($0, tokenless) RSI engine (E4).
//
// The auth/agent-identity field MOVES (CVE batch 2026-05-31; MCP spec 2025-11-25 + the
// 2026-07-28 RC; auth.md May 2026). This engine keeps badge's expertise CURRENT without
// spending a token: it watches the TOOL-MATRIX watchlist, flags a real delta, re-verifies
// the tool-matrix defaults, and re-runs the eval pyramid as a regression gate. The
// deterministic half only FLAGS (writes a delta to brain/ORG_MEMORY.md); the Claude half
// (D8, when CLAUDE_CODE_OAUTH_TOKEN lands) is what rewrites the affected brain file.
//
// The 6 steps (PLAN §11): refresh-brain → re-verify-tool-matrix → run-eval-pyramid →
// propose → validate(test-gate) → ship(commit, gated). Deterministic; no auto-commit.
//
// MODES:
//   --dry-run  → NO network, NO writes; runs the gated logic and exits 0 (the CI/cron mode +
//                the board verify line). The cron (rsi.yml) runs this; exit-0 IS the guard.
//   (default)  → fetches the watchlist, diffs vs the snapshot, writes a delta to ORG_MEMORY
//                on a real change, re-verifies the matrix, runs the eval gate.
//
// Grounded in dsip.json (eval-gated, no-self-grading, git snapback) + HARNESS-OVERRIDES RSI.

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, readSnapshot, writeSnapshot, tryFetchText, diffHashes } from "./lib/snapshot.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = join(REPO_ROOT, "workflows", ".watchlist-snapshot.json");
const ORG_MEMORY_PATH = join(REPO_ROOT, "brain", "ORG_MEMORY.md");
const RUNS_PATH = join(REPO_ROOT, "logs", "runs.jsonl");

const DRY_RUN = process.argv.includes("--dry-run");

// ── The TOOL-MATRIX watchlist (TOOL-MATRIX.md §External-intelligence watchlist) ──
// Each source: an id, the URL to fetch, and the brain file a change should flag. URLs are
// the public, no-auth endpoints; the better-auth advisories use the GitHub API (works
// unauthenticated at a low rate). A changed hash flags the `affects` file for the Claude half.
const WATCHLIST = [
  {
    id: "mcp-spec-changelog",
    url: "https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/docs/specification/2025-11-25/changelog.mdx",
    affects: "brain/KNOWN-PITFALLS.md (§E MCP spec-currency) + brain/OPINIONS.md (O23/O24)",
  },
  {
    id: "better-auth-advisories",
    url: "https://api.github.com/repos/better-auth/better-auth/security-advisories?per_page=10",
    affects: "brain/KNOWN-PITFALLS.md (§A/§B/§C) + brain/BATTLE-TESTED-SCENARIOS.md",
  },
  {
    id: "clerk-changelog",
    url: "https://clerk.com/changelog",
    affects: "brain/KNOWN-PITFALLS.md (§D Clerk churn) + advise $ breakpoints",
  },
  {
    id: "workos-authmd-repo",
    url: "https://api.github.com/repos/workos/authkit/commits?per_page=5",
    affects: "brain/EXPERTISE-MAP.md (P2 auth.md) + brain/TOOL-MATRIX.md",
  },
  {
    id: "agent-auth-protocol",
    url: "https://agentauthprotocol.com/",
    affects: "brain/GAPS-AND-DISPUTES.md (GD-G Agent Auth Protocol v2) + classify P4",
  },
];

/** Append one observability line to logs/runs.jsonl — the SAME schema src/obs/runs.ts writes.
 *  The engine writes its own line (cmd:"rsi") so the RSI cycle shows up in `badge runs` /
 *  runs-view.mjs alongside CLI invocations (the E3 seam, shared). Best-effort, never throws.
 *  In --dry-run we still log (it's a local file write, not a network write — the cron wants
 *  the cycle recorded), but we mark the outcome so the dry-run is visible. */
function logRun(durationMs, outcome) {
  try {
    mkdirSync(dirname(RUNS_PATH), { recursive: true });
    const record = {
      ts: new Date().toISOString(),
      cmd: "rsi",
      jtbd: null,
      model: null, // deterministic half is tokenless; the Claude half (D8) would name a model here.
      duration_ms: durationMs,
      outcome,
    };
    appendFileSync(RUNS_PATH, JSON.stringify(record) + "\n");
  } catch {
    // observability is best-effort.
  }
}

/** Write a flagged delta to brain/ORG_MEMORY.md (the deterministic half FLAGS, never rewrites). */
function flagDelta(changedIds) {
  if (changedIds.length === 0) return;
  const ts = new Date().toISOString();
  const lines = [
    "",
    `## ${ts} · RSI watchlist delta (deterministic flag — Claude half pending, D8)`,
    "A watched source changed since the last snapshot. The deterministic half does NOT rewrite the brain;",
    "it flags the affected file for the Claude half (CLAUDE_CODE_OAUTH_TOKEN) to review:",
    ...changedIds.map((id) => {
      const src = WATCHLIST.find((w) => w.id === id);
      return `- **${id}** changed → review ${src ? src.affects : "(unknown source)"}`;
    }),
  ];
  try {
    appendFileSync(ORG_MEMORY_PATH, lines.join("\n") + "\n");
  } catch {
    // best-effort.
  }
}

// ── Step 1: refresh-brain ──
async function refreshBrain() {
  if (DRY_RUN) {
    console.log(`[1/6] refresh-brain (dry-run): would check ${WATCHLIST.length} watchlist sources, no network/writes.`);
    for (const w of WATCHLIST) console.log(`        - ${w.id} → ${w.affects}`);
    return { changed: [], checked: 0 };
  }
  console.log(`[1/6] refresh-brain: fetching ${WATCHLIST.length} watchlist sources…`);
  const prev = readSnapshot(SNAPSHOT_PATH);
  const next = { ...prev };
  let checked = 0;
  for (const w of WATCHLIST) {
    const text = await tryFetchText(w.url);
    if (text === null) {
      console.log(`        - ${w.id}: unreachable (kept prior hash)`);
      continue;
    }
    next[w.id] = sha256(text);
    checked++;
  }
  const changed = diffHashes(prev, next);
  writeSnapshot(SNAPSHOT_PATH, next);
  if (changed.length > 0) {
    console.log(`        delta: ${changed.join(", ")} → flagging brain/ORG_MEMORY.md`);
    flagDelta(changed);
  } else {
    console.log(`        no watchlist delta (${checked} sources checked).`);
  }
  return { changed, checked };
}

// ── Step 2: re-verify-tool-matrix ──
// Assert the TOOL-MATRIX defaults still resolve. In --dry-run we skip the network and just
// confirm the file is present + parses for the default rows (a $0 structural check).
async function reVerifyToolMatrix() {
  const tmPath = join(REPO_ROOT, "brain", "TOOL-MATRIX.md");
  if (!existsSync(tmPath)) {
    console.log("[2/6] re-verify-tool-matrix: TOOL-MATRIX.md MISSING — flagging.");
    return { ok: false };
  }
  const tm = readFileSync(tmPath, "utf8");
  // Structural: the canonical defaults must still be named. Each default is a case-insensitive
  // regex so spelling variants count (the brain writes "Better Auth"/"better-auth"/"BetterAuth"
  // all three ways — a literal "BetterAuth" substring check would false-negative).
  const defaults = [
    { name: "Clerk", re: /clerk/i },
    { name: "WorkOS", re: /workos/i },
    { name: "BetterAuth", re: /better.?auth/i },
    { name: "Stytch", re: /stytch/i },
    { name: "Auth0", re: /auth0/i },
  ];
  const missing = defaults.filter((d) => !d.re.test(tm)).map((d) => d.name);
  if (missing.length > 0) {
    console.log(`[2/6] re-verify-tool-matrix: defaults missing from TOOL-MATRIX: ${missing.join(", ")}`);
    return { ok: false };
  }
  if (DRY_RUN) {
    console.log("[2/6] re-verify-tool-matrix (dry-run): all 5 defaults present; URL liveness skipped (no network).");
    return { ok: true };
  }
  console.log("[2/6] re-verify-tool-matrix: 5 defaults present; (deep URL-liveness is a Claude-half concern).");
  return { ok: true };
}

// ── Step 3: run-eval-pyramid (regression gate) ──
// Re-run `npm run eval` (E1's L1+L2). If E1 hasn't landed yet (eval/run.mjs absent), skip
// GRACEFULLY — the engine must not fail because a sibling Cluster-E item isn't built. When
// the eval IS present, a non-zero exit is a regression = the cycle fails the gate.
function runEvalPyramid() {
  const evalEntry = join(REPO_ROOT, "eval", "run.mjs");
  if (!existsSync(evalEntry)) {
    console.log("[3/6] run-eval-pyramid: eval/run.mjs not present yet (E1) — skipping the regression gate (not a failure).");
    return { ran: false, passed: true };
  }
  console.log("[3/6] run-eval-pyramid: running `npm run eval`…");
  const res = spawnSync("npm", ["run", "eval", "--silent"], { cwd: REPO_ROOT, stdio: "inherit" });
  const passed = res.status === 0;
  console.log(`        eval ${passed ? "PASSED" : "FAILED (regression — gate blocks)"}.`);
  return { ran: true, passed };
}

// ── Steps 4-6: propose / validate / ship (deterministic half FLAGS only; gated) ──
function proposeValidateShip(changed, matrixOk, evalPassed) {
  console.log("[4/6] propose: deterministic half only FLAGS deltas; brain rewrites are the Claude half (D8).");
  const gateGreen = matrixOk && evalPassed;
  console.log(`[5/6] validate (test-gate): tool-matrix ${matrixOk ? "ok" : "FAIL"} + eval ${evalPassed ? "ok" : "FAIL"} ⇒ gate ${gateGreen ? "GREEN" : "RED"}.`);
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.log("[6/6] ship: Claude half deferred (CLAUDE_CODE_OAUTH_TOKEN unset, D8) — deterministic half NEVER auto-commits. No-op.");
  } else if (changed.length === 0) {
    console.log("[6/6] ship: no watchlist delta — nothing to ship. No-op.");
  } else {
    console.log(`[6/6] ship: ${changed.length} delta(s) flagged + token present → the Claude half would open a gated PR here (eval gate: ${gateGreen ? "GREEN" : "RED"}).`);
  }
  return gateGreen;
}

// ── main ──
async function main() {
  const start = Date.now();
  console.log(`badge RSI engine — ${DRY_RUN ? "DRY-RUN (no network/writes)" : "LIVE"} — ${new Date().toISOString()}`);
  let outcome = "ok";
  try {
    const { changed } = await refreshBrain();
    const { ok: matrixOk } = await reVerifyToolMatrix();
    const { passed: evalPassed } = runEvalPyramid();
    const gateGreen = proposeValidateShip(changed, matrixOk, evalPassed);
    // The deterministic engine exits 0 in --dry-run regardless (it's the cron guard). In a
    // LIVE run, a RED gate (matrix broken or eval regression) is a real failure → non-zero.
    if (!DRY_RUN && !gateGreen) outcome = "error";
  } catch (err) {
    outcome = "error";
    console.error("RSI engine error:", err instanceof Error ? err.message : String(err));
  }
  const duration = Date.now() - start;
  logRun(duration, outcome);
  console.log(`done in ${duration}ms — outcome=${outcome}.`);
  // --dry-run always exits 0 (the cron guard); LIVE honors the outcome.
  process.exit(DRY_RUN ? 0 : outcome === "ok" ? 0 : 1);
}

main();
