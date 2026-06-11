// src/cli/dispatch.ts — the ONE shared command wrapper (B1 owns this seam).
//
// Every badge sub-command runs through dispatch(): it times the handler, calls
// appendRun() exactly once on completion (the observability seam — Component 10, body
// in src/obs/runs.ts), and maps a thrown BadgeError to a non-zero exit with a clean
// message (no stack-trace crash — PLAN §9 chaos-b). E3 fleshes out the obs body but
// never re-edits this file or any src/cli/*.ts handler: the call site lives here, once.

import { appendRun } from "../obs/runs.js";
import { BadgeError, printHuman, printJson } from "./output.js";

export interface CommandMeta {
  /** sub-command name, e.g. "classify". */
  cmd: string;
  /** the EM JTBD this command serves, or null. */
  jtbd: number | null;
  /** the model invoked, or null for the deterministic ($0) brain path. */
  model?: string | null;
}

export interface HandlerResult {
  /** the structured object emitted under --json. */
  data: unknown;
  /** human-readable lines emitted when --json is absent. */
  human: string[];
}

/**
 * Run a command handler with timing, observability, and graceful error handling.
 * @param meta   command identity (name + jtbd + model) for the run record.
 * @param json   whether --json was requested.
 * @param handler the pure command logic returning { data, human }.
 */
export async function dispatch(
  meta: CommandMeta,
  json: boolean,
  handler: () => HandlerResult | Promise<HandlerResult>,
): Promise<void> {
  const start = Date.now();
  let outcome: "ok" | "error" = "ok";
  try {
    const result = await handler();
    if (json) {
      printJson(result.data);
    } else {
      printHuman(result.human);
    }
  } catch (err) {
    outcome = "error";
    const code = err instanceof BadgeError ? err.code : 1;
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      printJson({ error: message });
    } else {
      process.stderr.write(`badge ${meta.cmd}: ${message}\n`);
    }
    appendRun({
      ts: new Date().toISOString(),
      cmd: meta.cmd,
      jtbd: meta.jtbd,
      model: meta.model ?? null,
      duration_ms: Date.now() - start,
      outcome,
    });
    process.exitCode = code;
    return;
  }
  appendRun({
    ts: new Date().toISOString(),
    cmd: meta.cmd,
    jtbd: meta.jtbd,
    model: meta.model ?? null,
    duration_ms: Date.now() - start,
    outcome,
  });
}
