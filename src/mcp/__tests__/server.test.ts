// src/mcp/__tests__/server.test.ts — contract tests for badge-mcp (C1).
//
// Spawns the stdio server (via the tsx loader so it runs cold without a prior build,
// matching bin/badge's strategy) and drives JSON-RPC over stdin/stdout: tools/list must
// return all six badge_* tools; tools/call must round-trip and DELEGATE to the same CLI
// logic (classify → P1/Stytch); resources/list must expose the brain files. This is the
// "Contract" layer of PLAN §9 (JSON-RPC tools/list + each tool's schema).

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_TS = join(HERE, "..", "server.ts");

/**
 * Run a batch of JSON-RPC requests against a fresh server process and collect the
 * line-delimited JSON responses. The server is launched with tsx's ESM loader so the test
 * is hermetic (no build step required) — the same loader bin/badge uses.
 */
function rpc(requests: object[]): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx/esm", SERVER_TS],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", () => {
      const lines = out.split("\n").filter((l) => l.trim());
      try {
        resolve(lines.map((l) => JSON.parse(l) as Record<string, unknown>));
      } catch (e) {
        reject(new Error(`bad JSON from server. stdout=${out} stderr=${err} err=${String(e)}`));
      }
    });
    for (const r of requests) child.stdin.write(JSON.stringify(r) + "\n");
    child.stdin.end();
  });
}

describe("badge-mcp stdio server", () => {
  it("tools/list returns all six badge_* tools with input schemas", async () => {
    const [res] = await rpc([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
    const result = res.result as { tools: Array<{ name: string; inputSchema: unknown }> };
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "badge_advise",
        "badge_audit",
        "badge_classify",
        "badge_mcp_check",
        "badge_migrate",
        "badge_saml_triage",
      ].sort(),
    );
    // every tool advertises an inputSchema (contract requirement).
    for (const t of result.tools) expect(t.inputSchema).toBeTruthy();
  });

  it("tools/call badge_classify DELEGATES to the CLI logic (P1/Stytch)", async () => {
    const [res] = await rpc([
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "badge_classify", arguments: { task: "agent calls my MCP server" } },
      },
    ]);
    const result = res.result as { content: Array<{ text: string }> };
    const data = JSON.parse(result.content[0].text) as { plane: number; problem: string; default_tool: string };
    expect(data.plane).toBe(2);
    expect(data.problem).toBe("P1");
    expect(data.default_tool).toContain("Stytch");
  });

  it("tools/call on a bad-input verb returns an isError result, not a crash", async () => {
    const [res] = await rpc([
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "badge_classify", arguments: { task: "" } },
      },
    ]);
    const result = res.result as { content: Array<{ text: string }>; isError?: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("empty task");
  });

  it("tools/call on an unknown tool returns a JSON-RPC error", async () => {
    const [res] = await rpc([
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "badge_nope", arguments: {} } },
    ]);
    expect((res.error as { message: string }).message).toContain("unknown tool");
  });

  it("resources/list exposes the brain files as badge://brain/* resources", async () => {
    const [res] = await rpc([{ jsonrpc: "2.0", id: 5, method: "resources/list" }]);
    const result = res.result as { resources: Array<{ uri: string }> };
    const uris = result.resources.map((r) => r.uri);
    expect(uris).toContain("badge://brain/OPINIONS.md");
    expect(uris).toContain("badge://brain/KNOWN-PITFALLS.md");
  });

  it("resources/read returns the brain file content", async () => {
    const [res] = await rpc([
      { jsonrpc: "2.0", id: 6, method: "resources/read", params: { uri: "badge://brain/OPINIONS.md" } },
    ]);
    const result = res.result as { contents: Array<{ text: string }> };
    expect(result.contents[0].text).toContain("badge OPINIONS");
  });
});
