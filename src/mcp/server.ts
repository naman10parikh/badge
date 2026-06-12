// src/mcp/server.ts — badge's own `badge-mcp` stdio server (Component 7, C1).
//
// Exposes badge's verbs as MCP tools so Claude / the energy hub call them natively over
// stdio (HARNESS-OVERRIDES §7: own server, stdio-local sufficient for C1; no hosted-OAuth
// needed for a dev-tool agents call locally). Each tool delegates to the SAME B2-B4 CLI
// logic (no re-implementation — Surgical Changes): classify/advise/audit/saml_triage/
// migrate/mcp_check all call the exported handler and return its `.data` as JSON text.
// Plus `badge://brain/{file}` resources expose the 5 brain files as readable MCP resources.
//
// HAND-ROLLED JSON-RPC over stdio (no @modelcontextprotocol/sdk dependency): the board
// pins deps tightly (PLAN §7) and the C1 bar is a `tools/list` JSON-RPC response + tool
// dispatch — a minimal line-delimited JSON-RPC loop hits that bar with zero new deps
// (Karpathy Simplicity First). Speaks MCP method names (initialize / tools/list /
// tools/call / resources/list / resources/read) at protocol version 2025-11-25.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { classify } from "../cli/classify.js";
import { advise } from "../cli/advise.js";
import { audit, type AuditKind } from "../cli/audit.js";
import { samlTriage } from "../cli/saml-triage.js";
import { migrate } from "../cli/migrate.js";
import { mcpCheck } from "../cli/mcp-check.js";
import type { HandlerResult } from "../cli/dispatch.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BRAIN_DIR = join(REPO_ROOT, "brain");
const PROTOCOL_VERSION = "2025-11-25";

// ── Tool registry ───────────────────────────────────────────────────────────
// Each tool: a name, a JSON-schema for its args, and a run() that delegates to a CLI
// handler and returns the structured `.data`. The run() may be sync or async (mcp-check).
interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => HandlerResult | Promise<HandlerResult>;
}

const TOOLS: ToolDef[] = [
  {
    name: "badge_classify",
    description:
      "Place the plane (1 human-CIAM / 2 agent-MCP) and classify an agent-auth task P1-P4; return the default tool, alternatives, and rationale. badge's core verb (EM JTBD-4).",
    inputSchema: {
      type: "object",
      properties: { task: { type: "string", description: "the agent-auth task description" } },
      required: ["task"],
    },
    run: (args) => classify(String(args.task ?? "")),
  },
  {
    name: "badge_advise",
    description:
      "Recommend an auth provider as a DECISION with $ breakpoints + the boring-enterprise checklist, not a feature table (OP O5).",
    inputSchema: {
      type: "object",
      properties: {
        useCase: { type: "string", enum: ["consumer", "b2b", "enterprise", "self-host"] },
        mau: { type: "number", description: "monthly active users (for $ breakpoints)" },
        enterprise: { type: "boolean", description: "force the enterprise SSO/SCIM checklist" },
      },
      required: ["useCase"],
    },
    run: (args) =>
      advise({
        useCase: String(args.useCase ?? ""),
        mau: typeof args.mau === "number" ? args.mau : undefined,
        enterprise: Boolean(args.enterprise),
      }),
  },
  {
    name: "badge_audit",
    description:
      "Audit auth/OAuth/MCP config or code statically against the pitfall checklist (PKCE method, RFC-8707 audience bind, account-linking gate, rotation atomicity, redirect exactness, alg=none). Flags {severity, rule, cve?, fix} (KP A-J).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "path to the config/code to audit" },
        kind: { type: "string", enum: ["mcp", "scim", "agent", "saml"], description: "enable kind-specific detectors" },
      },
      required: ["path"],
    },
    run: (args) =>
      audit({
        path: String(args.path ?? ""),
        kind: args.kind ? (String(args.kind) as AuditKind) : undefined,
      }),
  },
  {
    name: "badge_saml_triage",
    description:
      "Run the 7-step SSO/SAML triage runbook (timestamps→cert→ACS→Issuer→Audience→sig-alg→Destination) for a production symptom; land on the most-likely cause (cert rotation is #1) (EM JTBD-7, OP O29).",
    inputSchema: {
      type: "object",
      properties: { symptom: { type: "string", description: "the production SSO/SAML failure symptom" } },
      required: ["symptom"],
    },
    run: (args) => samlTriage(String(args.symptom ?? "")),
  },
  {
    name: "badge_migrate",
    description:
      "Emit a provider-migration plan: the dual-validation window + the four casualties (sessions, SSO, social links, claims). NEVER a big-bang cutover (EM JTBD-8, OP O32/O33).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "the source provider" },
        to: { type: "string", description: "the target provider" },
      },
      required: ["from", "to"],
    },
    run: (args) => migrate({ from: String(args.from ?? ""), to: String(args.to ?? "") }),
  },
  {
    name: "badge_mcp_check",
    description:
      "Drive PRM→ASM→DCR/CIMD→authorize→token→tools/list against an MCP server and report 2025-11-25 spec gaps. The one network-touching verb (EM JTBD-5, OP O25). Degrades gracefully offline.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string", description: "the MCP server base URL" } },
      required: ["url"],
    },
    run: (args) => mcpCheck(String(args.url ?? "")),
  },
];

// ── Brain resources (badge://brain/{file}) ──────────────────────────────────
// The 5 canonical brain files + TOOL-MATRIX, exposed as readable MCP resources so an
// MCP client can read badge's expertise corpus directly (Component 2 surfaced over MCP).
const BRAIN_FILES = [
  "EXPERTISE-MAP.md",
  "BATTLE-TESTED-SCENARIOS.md",
  "KNOWN-PITFALLS.md",
  "OPINIONS.md",
  "GAPS-AND-DISPUTES.md",
  "TOOL-MATRIX.md",
];

function brainResources(): Array<{ uri: string; name: string; mimeType: string }> {
  return BRAIN_FILES.filter((f) => existsSync(join(BRAIN_DIR, f))).map((f) => ({
    uri: `badge://brain/${f}`,
    name: `brain/${f}`,
    mimeType: "text/markdown",
  }));
}

// ── JSON-RPC framing helpers ────────────────────────────────────────────────
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

function reply(id: number | string | null | undefined, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }) + "\n");
}

function replyError(id: number | string | null | undefined, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }) + "\n");
}

/** Wrap a handler's structured `.data` as an MCP tool-result text block. */
function toToolResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// ── Method dispatch ─────────────────────────────────────────────────────────
async function handle(req: JsonRpcRequest): Promise<void> {
  const { id, method, params } = req;
  switch (method) {
    case "initialize":
      reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "badge-mcp", version: "0.1.0" },
      });
      return;

    case "notifications/initialized":
      // A notification (no id) — nothing to reply.
      return;

    case "tools/list":
      reply(id, {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
      return;

    case "tools/call": {
      const name = String(params?.name ?? "");
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) {
        replyError(id, -32602, `unknown tool: ${name}`);
        return;
      }
      try {
        const result = await tool.run(args);
        reply(id, toToolResult(result.data));
      } catch (err) {
        // A BadgeError (bad input) becomes an MCP tool error result, not a transport error,
        // so the client sees the message rather than a crashed server (chaos-b parity).
        const message = err instanceof Error ? err.message : String(err);
        reply(id, { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true });
      }
      return;
    }

    case "resources/list":
      reply(id, { resources: brainResources() });
      return;

    case "resources/read": {
      const uri = String(params?.uri ?? "");
      const m = /^badge:\/\/brain\/(.+)$/.exec(uri);
      if (!m || !BRAIN_FILES.includes(m[1])) {
        replyError(id, -32602, `unknown resource: ${uri}`);
        return;
      }
      const file = join(BRAIN_DIR, basename(m[1]));
      try {
        const text = readFileSync(file, "utf8");
        reply(id, { contents: [{ uri, mimeType: "text/markdown", text }] });
      } catch {
        replyError(id, -32603, `failed to read ${uri}`);
      }
      return;
    }

    default:
      // Unknown method — only error if it expects a response (has an id).
      if (id !== undefined && id !== null) replyError(id, -32601, `method not found: ${method}`);
      return;
  }
}

// ── stdio loop ──────────────────────────────────────────────────────────────
// Line-delimited JSON-RPC: one request per line in, one response per line out.
const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(trimmed) as JsonRpcRequest;
  } catch {
    replyError(null, -32700, "parse error");
    return;
  }
  void handle(req);
});
