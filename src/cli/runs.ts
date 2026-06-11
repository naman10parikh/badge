// src/cli/runs.ts — `badge runs [--since <ts>]` (the observability VIEW, B1 wires it;
// E3 owns the standalone scripts/runs-view.mjs aggregator). Reads the append-only
// logs/runs.jsonl that src/obs/runs.ts writes and aggregates it: count by command, by
// outcome, total + p50/p95 duration. Works offline. Grounded in PLAN §3.10 / HARNESS §10.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HandlerResult } from "./dispatch.js";
import type { RunRecord } from "../obs/runs.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUNS_PATH = join(REPO_ROOT, "logs", "runs.jsonl");

export interface RunsSummary {
  total: number;
  by_cmd: Record<string, number>;
  by_outcome: { ok: number; error: number };
  duration_ms: { p50: number; p95: number; max: number };
  since: string | null;
}

/** Parse logs/runs.jsonl into records, skipping malformed lines (best-effort, never throws). */
function readRuns(): RunRecord[] {
  let text: string;
  try {
    text = readFileSync(RUNS_PATH, "utf8");
  } catch {
    return []; // no log yet — an empty summary is correct, not an error.
  }
  const records: RunRecord[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as RunRecord);
    } catch {
      // skip a corrupt line — observability is best-effort.
    }
  }
  return records;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

/**
 * Aggregate the run log.
 * @param opts optional ISO timestamp; only runs at or after it are included.
 */
export function runsView(opts: { since?: string }): HandlerResult {
  let records = readRuns();
  if (opts.since) {
    records = records.filter((r) => r.ts >= opts.since!);
  }

  const byCmd: Record<string, number> = {};
  let ok = 0;
  let error = 0;
  const durations: number[] = [];
  for (const r of records) {
    byCmd[r.cmd] = (byCmd[r.cmd] ?? 0) + 1;
    if (r.outcome === "ok") ok++;
    else error++;
    durations.push(r.duration_ms);
  }
  durations.sort((a, b) => a - b);

  const summary: RunsSummary = {
    total: records.length,
    by_cmd: byCmd,
    by_outcome: { ok, error },
    duration_ms: {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      max: durations.length ? durations[durations.length - 1] : 0,
    },
    since: opts.since ?? null,
  };
  return { data: summary, human: renderHuman(summary) };
}

function renderHuman(s: RunsSummary): string[] {
  const lines = [
    `runs:        ${s.total}${s.since ? ` (since ${s.since})` : ""}`,
    `outcome:     ok=${s.by_outcome.ok}  error=${s.by_outcome.error}`,
    `duration_ms: p50=${s.duration_ms.p50}  p95=${s.duration_ms.p95}  max=${s.duration_ms.max}`,
    "",
    "by command:",
    ...Object.entries(s.by_cmd)
      .sort((a, b) => b[1] - a[1])
      .map(([cmd, n]) => `  ${cmd.padEnd(12)} ${n}`),
  ];
  if (s.total === 0) lines.push("  (no runs logged yet)");
  return lines;
}
