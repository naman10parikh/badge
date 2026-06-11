// src/cli/output.ts — shared output + error helpers for the badge CLI.
// Every command emits structured output under --json (EM JTBD-9 / OP O34: never parse a
// human TTY). BadgeError carries a non-zero exit for graceful corrupt-input handling
// (PLAN §9 chaos-b: malformed input → clear message + non-zero exit, never a crash).

export class BadgeError extends Error {
  readonly code: number;
  constructor(message: string, code = 1) {
    super(message);
    this.name = "BadgeError";
    this.code = code;
  }
}

/** Print a structured result as pretty JSON (the --json path). */
export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

/**
 * Render a human-readable view. Each command supplies its own renderer; this is the
 * fallback that pretty-prints the same object a machine would get, so the human and
 * --json surfaces never diverge in content.
 */
export function printHuman(lines: string[]): void {
  process.stdout.write(lines.join("\n") + "\n");
}
