#!/usr/bin/env node
// scripts/runs-view.mjs — standalone observability aggregator (Component 10, E3).
//
// Reads the append-only logs/runs.jsonl that src/obs/runs.ts writes (one line per CLI
// invocation + per RSI cycle: { ts, cmd, jtbd, model, duration_ms, outcome }) and prints
// an aggregate: totals, by-command counts, ok/error split, p50/p95/max duration, and the
// model split (tokenless deterministic vs a named model). Zero deps (stdlib only) so it
// runs cold without a build. `badge runs` (src/cli/runs.ts) is the in-CLI view; this is the
// standalone script the cockpit + CI can shell out to. Best-effort: never throws on a
// corrupt line. Grounded in PLAN §3.10 / HARNESS-OVERRIDES §10.
//
// Usage:  node scripts/runs-view.mjs [--since <ISO-ts>] [--json]

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS_PATH = join(REPO_ROOT, "logs", "runs.jsonl");

// ── args ──
const args = process.argv.slice(2);
const json = args.includes("--json");
const sinceIdx = args.indexOf("--since");
const since = sinceIdx >= 0 ? args[sinceIdx + 1] : null;

/** Parse the run log, skipping malformed lines (best-effort, never throws). */
function readRuns() {
  let text;
  try {
    text = readFileSync(RUNS_PATH, "utf8");
  } catch {
    return []; // no log yet — an empty aggregate is correct, not an error.
  }
  const records = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      // skip a corrupt line.
    }
  }
  return records;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

let records = readRuns();
if (since) records = records.filter((r) => typeof r.ts === "string" && r.ts >= since);

const byCmd = {};
const byModel = {};
let ok = 0;
let error = 0;
const durations = [];
for (const r of records) {
  byCmd[r.cmd] = (byCmd[r.cmd] ?? 0) + 1;
  const modelKey = r.model ?? "deterministic ($0)";
  byModel[modelKey] = (byModel[modelKey] ?? 0) + 1;
  if (r.outcome === "ok") ok++;
  else if (r.outcome === "error") error++;
  if (typeof r.duration_ms === "number") durations.push(r.duration_ms);
}
durations.sort((a, b) => a - b);

const summary = {
  total: records.length,
  since: since ?? null,
  by_cmd: byCmd,
  by_model: byModel,
  by_outcome: { ok, error },
  duration_ms: {
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    max: durations.length ? durations[durations.length - 1] : 0,
  },
};

if (json) {
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
} else {
  const lines = [
    `runs:        ${summary.total}${since ? ` (since ${since})` : ""}`,
    `outcome:     ok=${ok}  error=${error}`,
    `duration_ms: p50=${summary.duration_ms.p50}  p95=${summary.duration_ms.p95}  max=${summary.duration_ms.max}`,
    "",
    "by command:",
    ...Object.entries(byCmd)
      .sort((a, b) => b[1] - a[1])
      .map(([cmd, n]) => `  ${String(cmd).padEnd(14)} ${n}`),
    "",
    "by model:",
    ...Object.entries(byModel)
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `  ${String(m).padEnd(20)} ${n}`),
  ];
  if (summary.total === 0) lines.push("", "  (no runs logged yet)");
  process.stdout.write(lines.join("\n") + "\n");
}
