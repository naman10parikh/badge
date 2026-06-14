// src/mcp/__tests__/contract.test.ts — the Contract layer (PLAN §9 "Contract" row):
//   "badge-mcp JSON-RPC: tools/list + each tool's schema; A2A card resolves".
//
// server.test.ts already covers tools/list / tools/call / resources. This file fills the
// two contract assertions that were NOT regression-guarded before Wave T:
//
//   1. JSON-RPC ENVELOPE round-trip — every response must echo the request's `id` and carry
//      `jsonrpc:"2.0"`. The server's reply()/replyError() do this, but nothing asserted it;
//      a regression (e.g. dropping the id, or emitting a bare result) would silently break
//      any spec-compliant MCP client. We send requests with DISTINCT ids (incl. a string id)
//      and a batch, and assert correct id correspondence.
//   2. A2A CARD resolves — `.well-known/agent.json` parses, declares all 7 PLAN §4
//      capabilities, and one capability (classify) ROUND-TRIPS through the exact CLI
//      invocation the card advertises, returning the structured {plane,problem,default_tool}.
//
// Hermetic: the server runs under tsx's ESM loader (no build needed — same as server.test.ts
// and bin/badge); the A2A round-trip shells out to `bin/badge` (also tsx). No real network,
// no new deps.

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_TS = join(HERE, "..", "server.ts");
const REPO_ROOT = join(HERE, "..", "..", "..");
const BADGE_BIN = join(REPO_ROOT, "bin", "badge");
const A2A_CARD = join(REPO_ROOT, ".well-known", "agent.json");

/** Run a batch of JSON-RPC requests against a fresh server and collect the responses. */
function rpc(requests: object[]): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx/esm", SERVER_TS], {
      stdio: ["pipe", "pipe", "pipe"],
    });
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

/** Shell out to the badge CLI exactly as the A2A card advertises and parse its --json stdout. */
function cli(args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BADGE_BIN, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`badge ${args.join(" ")} exited ${code}: ${err}`));
      try {
        resolve(JSON.parse(out) as Record<string, unknown>);
      } catch (e) {
        reject(new Error(`bad JSON from CLI. stdout=${out} err=${String(e)}`));
      }
    });
  });
}

describe("contract: badge-mcp JSON-RPC envelope round-trip", () => {
  it("echoes the request id (number) and carries jsonrpc:\"2.0\" on a tools/list response", async () => {
    const [res] = await rpc([{ jsonrpc: "2.0", id: 42, method: "tools/list" }]);
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(42); // the exact id the client sent, not null/0/undefined
    expect(res.result).toBeTruthy();
  });

  it("echoes a STRING id (JSON-RPC ids may be strings) on a tools/call response", async () => {
    const [res] = await rpc([
      {
        jsonrpc: "2.0",
        id: "req-abc",
        method: "tools/call",
        params: { name: "badge_classify", arguments: { task: "agent calls my MCP server" } },
      },
    ]);
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe("req-abc");
  });

  it("an ERROR response (unknown tool) still echoes the id + jsonrpc, and uses error not result", async () => {
    const [res] = await rpc([
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "badge_nope", arguments: {} } },
    ]);
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(7);
    expect(res.error).toBeTruthy();
    expect(res.result).toBeUndefined();
  });

  it("a batch of requests gets responses correlated by id (no cross-talk)", async () => {
    const responses = await rpc([
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { jsonrpc: "2.0", id: 2, method: "resources/list" },
    ]);
    const byId = new Map(responses.map((r) => [r.id, r]));
    // Each id must come back exactly once, with a result (correlation, not order, is the contract).
    expect(byId.has(1)).toBe(true);
    expect(byId.has(2)).toBe(true);
    expect((byId.get(1) as Record<string, unknown>).result).toBeTruthy();
    expect((byId.get(2) as Record<string, unknown>).result).toBeTruthy();
  });

  it("every tools/list tool advertises a non-empty input schema (the 'each tool's schema' contract)", async () => {
    const [res] = await rpc([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
    const tools = (res.result as { tools: Array<{ name: string; inputSchema: { type?: string } }> }).tools;
    expect(tools.length).toBe(6);
    for (const t of tools) {
      expect(t.inputSchema).toBeTruthy();
      // a real JSON-Schema object, not a bare {} — the contract is "each tool's schema".
      expect(t.inputSchema.type).toBe("object");
    }
  });
});

describe("contract: A2A card (.well-known/agent.json) resolves", () => {
  it("parses as valid JSON and is the badge card", () => {
    const card = JSON.parse(readFileSync(A2A_CARD, "utf8")) as { name: string; skills: unknown[] };
    expect(card.name).toBe("badge");
    expect(Array.isArray(card.skills)).toBe(true);
  });

  it("declares all 7 PLAN §4 capabilities as skills", () => {
    const card = JSON.parse(readFileSync(A2A_CARD, "utf8")) as { skills: Array<{ id: string }> };
    const ids = card.skills.map((s) => s.id).sort();
    expect(ids).toEqual(
      ["advise", "audit", "classify", "init", "mcp-check", "migrate", "saml-triage"].sort(),
    );
  });

  it("the classify capability ROUND-TRIPS through the CLI invocation the card advertises", async () => {
    const card = JSON.parse(readFileSync(A2A_CARD, "utf8")) as {
      skills: Array<{ id: string; cli: string }>;
    };
    const classifySkill = card.skills.find((s) => s.id === "classify");
    expect(classifySkill).toBeTruthy();
    // The card advertises a CLI invocation (e.g. "node bin/badge classify ... --json").
    expect(classifySkill!.cli).toMatch(/classify/);
    expect(classifySkill!.cli).toMatch(/--json/);

    // Drive that capability for real and assert the structured answer comes back (the card
    // is only "resolved" if the capability it points at actually works end-to-end).
    const out = (await cli(["classify", "agent calls my MCP server", "--json"])) as {
      plane: number;
      problem: string;
      default_tool: string;
    };
    expect(out.plane).toBe(2);
    expect(out.problem).toBe("P1");
    expect(out.default_tool).toContain("Stytch");
  });
});
