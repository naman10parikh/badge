// eval/__tests__/auth-lint.test.ts — regression suite for the B6 auth-lint hook
// (.claude/hooks/auth-lint.js). The hook is a load-bearing PARSE-TIME security control
// (OP O11): it must BLOCK badge's own staged auth output the moment it contains a
// non-negotiable footgun (plain PKCE / alg=none / wildcard redirect / token-in-URL).
//
// We invoke the hook AS A CHILD PROCESS (not by importing internals) because that is
// exactly how Claude Code runs it — both the CLI verify path and the PreToolUse stdin
// path. Importing would also run main() and call process.exit().
//
// Locks the false-negative fixed on 2026-06-11: the JSON-quoted-key form
// (`"code_challenge_method": "plain"`) was silently passing because the detector regex
// only matched the bare-code form. If that regression returns, this suite goes red.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const HOOK = resolve(__dirname, "../../.claude/hooks/auth-lint.js");
const PLAIN_PKCE_FIXTURE = resolve(__dirname, "../fixtures/plain-pkce");
const CLEAN_FIXTURE = resolve(__dirname, "../fixtures/clean");

/** Run the hook in CLI mode (path arg). Returns { code, stderr }. */
function runCli(pathArg: string): { code: number; stderr: string } {
  try {
    execFileSync("node", [HOOK, pathArg], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stderr?: string };
    return { code: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

/** Run the hook in PreToolUse mode (tool-call JSON on stdin). Returns { code, stderr }. */
function runHook(payload: unknown): { code: number; stderr: string } {
  try {
    execFileSync("node", [HOOK], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stderr?: string };
    return { code: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

describe("auth-lint hook — CLI mode (the B6 verify path)", () => {
  it("fires non-zero + names KP-A2 on the plain-pkce fixture", () => {
    const { code, stderr } = runCli(PLAIN_PKCE_FIXTURE);
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/KP-A2/);
  });

  it("flags BOTH plain-PKCE AND alg=none on the plain-pkce fixture (regression: JSON-quoted key)", () => {
    const { stderr } = runCli(PLAIN_PKCE_FIXTURE);
    expect(stderr).toMatch(/PKCE `plain`/); // the formerly-missed JSON-quoted-key detection
    expect(stderr).toMatch(/`alg=none`/);
  });

  it("exits 0 with no findings on the clean fixture (no false positives)", () => {
    const { code } = runCli(CLEAN_FIXTURE);
    expect(code).toBe(0);
  });
});

describe("auth-lint hook — PreToolUse mode (the live settings.json path)", () => {
  it("exit 2 (deny) on a Write whose content has plain PKCE", () => {
    const { code, stderr } = runHook({
      tool_name: "Write",
      tool_input: { file_path: "x.ts", content: 'const cfg = { code_challenge_method: "plain" };' },
    });
    expect(code).toBe(2);
    expect(stderr).toMatch(/KP-A2/);
  });

  it("exit 2 (deny) on a Write with a token in a URL", () => {
    const { code } = runHook({
      tool_name: "Write",
      tool_input: { file_path: "x.ts", content: 'const u = "https://x?access_token=abc";' },
    });
    expect(code).toBe(2);
  });

  it("exit 0 (allow) on a clean Write", () => {
    const { code } = runHook({
      tool_name: "Write",
      tool_input: { file_path: "x.ts", content: 'const cfg = { code_challenge_method: "S256" };' },
    });
    expect(code).toBe(0);
  });

  it("exit 0 (fails open) on raw non-JSON stdin so it never wedges the agent", () => {
    // Send raw bytes the hook can't JSON.parse — must allow (exit 0), not crash/block.
    const out = execFileSync("node", [HOOK], {
      input: "this is not json",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    expect(out).toBe(""); // exited 0 (no throw) with no stderr
  });
});
