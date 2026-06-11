// src/obs/runs.ts — observability append-helper (Component 10).
//
// OWNERSHIP (CP123 board): B1 owns the *interface* + *call site* (the shared dispatch
// wrapper in src/cli/index.ts calls appendRun() on every command completion). E3 owns
// the hardened body + the scripts/runs-view.mjs aggregator. This minimal body is live
// so the seam works cold (no command crashes if logging is the only thing wired); E3
// enriches it (rotation, schema validation) without re-editing any src/cli/*.ts file.
//
// One line per invocation in logs/runs.jsonl (NOT gitignored):
//   { ts, cmd, jtbd, model, duration_ms, outcome }

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUNS_PATH = join(REPO_ROOT, "logs", "runs.jsonl");

export interface RunRecord {
  /** ISO-8601 timestamp of completion. */
  ts: string;
  /** The badge sub-command, e.g. "classify", "audit", "init". */
  cmd: string;
  /** The job-to-be-done number this command serves (EM JTBD), or null if N/A. */
  jtbd: number | null;
  /** The model invoked, or null for the deterministic ($0, tokenless) brain path. */
  model: string | null;
  /** Wall-clock duration of the command in milliseconds. */
  duration_ms: number;
  /** "ok" on success, "error" on a non-zero exit. */
  outcome: "ok" | "error";
}

/**
 * Append one observability record to logs/runs.jsonl. Never throws — observability
 * must not break the command it observes (a logging failure is swallowed with a warn,
 * per typescript.md "no silent catch").
 */
export function appendRun(record: RunRecord): void {
  try {
    mkdirSync(dirname(RUNS_PATH), { recursive: true });
    appendFileSync(RUNS_PATH, JSON.stringify(record) + "\n");
  } catch (err) {
    // Intentionally non-fatal: observability is best-effort, never blocks the command.
    console.warn(
      "[obs/runs] failed to append run record:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
