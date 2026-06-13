#!/usr/bin/env node
// cockpit/server.mjs — badge cockpit (CP123 G1).
//
// A zero-dependency Node `http` server + vanilla-JS SPA for THE CHAIRMAN's eyes
// (D3: "product surface per employee = local web cockpit"). Agents never use this —
// they call the CLI / MCP. This is the human window into badge's brain, runs, and evals.
//
// HARD CONTRACT (HARNESS-OVERRIDES product-surface + MASTER-TODOS G1):
//   - Node stdlib ONLY. No express / fastify / any framework import. No build step.
//   - The server SHELLS OUT to the CLI via `child_process.execFile('node',
//     ['bin/badge', verb, arg, '--json'])` and parses stdout JSON. It does NOT `import`
//     the TS CLI modules (that would pull a transpile step and break the stdlib-only
//     contract). This keeps the cockpit a thin presentation layer over the real employee.
//   - Localhost only (127.0.0.1:7788, Q5). Never exposed. No auth by design.
//
// Four views (PLAN §10): (1) Brain browser — the 5 brain files + TOOL-MATRIX with the
// BM25 search box (the queryable memory layer, visualized); (2) Run log — tail
// logs/runs.jsonl; (3) Eval scores — the eval pyramid (L1/L2/L3 + 14 golden tasks +
// acceptance + pass^k); (4) Ask-the-employee — text box → badge classify/advise/audit
// → renders the structured answer. This is badge talking.

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");           // cockpit/ → repo root
const PUBLIC = join(__dirname, "public");      // static SPA assets
const BRAIN = join(REPO, "brain");
const PORT = Number(process.env.BADGE_COCKPIT_PORT || 7788);
const HOST = "127.0.0.1";                      // never bind 0.0.0.0 — chairman-only, never exposed
const EXEC_TIMEOUT_MS = 20_000;                // a CLI call is sub-second; 20s is a generous crash-guard

// The 6 brain documents the Brain-browser view renders. Order is the reading order:
// the 5 brain files (EXPERTISE-MAP first — it's the map) + TOOL-MATRIX. MOC/ORG_* are
// navigation/plumbing, not part of the chairman's 5-file brain, so they're excluded here.
const BRAIN_FILES = [
  "EXPERTISE-MAP.md",
  "BATTLE-TESTED-SCENARIOS.md",
  "KNOWN-PITFALLS.md",
  "OPINIONS.md",
  "GAPS-AND-DISPUTES.md",
  "TOOL-MATRIX.md",
];

// The ask-the-employee verbs the cockpit is allowed to drive. An allowlist (not a
// pass-through) — defense in depth on top of execFile's arg-array (no shell, no injection).
// Each entry says how to assemble argv from the request so `--json` lands in the right slot.
const ASK_VERBS = {
  // classify takes a positional <task>; --json is a global flag.
  classify: (q) => ["classify", q, "--json"],
  // advise has NO positional — it reads --use-case (default consumer if blank).
  advise: (q) => ["advise", "--use-case", q || "consumer", "--json"],
  // audit takes a positional <path> (a file/dir to run the pitfall checklist over).
  audit: (q) => ["audit", q, "--json"],
  // saml-triage takes a positional <symptom>.
  "saml-triage": (q) => ["saml-triage", q, "--json"],
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// ---------------------------------------------------------------- helpers ---

/** Send a JSON body with the given status. */
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

/**
 * Shell out to the badge CLI and parse its --json stdout. Never throws — returns
 * { ok, data } or { ok:false, error } so a CLI non-zero exit (e.g. classify "")
 * renders as a clean error card instead of crashing the server.
 */
function runBadge(argv) {
  return new Promise((resolve) => {
    execFile(
      "node",
      ["bin/badge", ...argv],
      { cwd: REPO, timeout: EXEC_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const out = (stdout || "").trim();
        if (out) {
          try {
            return resolve({ ok: true, data: JSON.parse(out) });
          } catch {
            // CLI printed something non-JSON (shouldn't with --json) — surface it raw.
            return resolve({ ok: false, error: "non-JSON CLI output", raw: out });
          }
        }
        const msg = (stderr || "").trim() || (err && err.message) || "CLI produced no output";
        return resolve({ ok: false, error: msg });
      },
    );
  });
}

/** BM25 search over brain/**.md via the canonical scripts/memory-search.sh (the A5 layer). */
function runSearch(query, limit = 6) {
  return new Promise((resolve) => {
    execFile(
      "bash",
      ["scripts/memory-search.sh", query, "--limit", String(limit)],
      { cwd: REPO, timeout: EXEC_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        // memory-search.sh prints human-formatted ranked hits; the SPA renders the text
        // block verbatim in a <pre>. We pass it through rather than re-parse (the cited
        // node ids — KP-A1 / BTS-5 — are already in the text, which is the whole point).
        resolve({ ok: true, text: (stdout || "").trim() || "(no matches)" });
      },
    );
  });
}

/** Read a brain file by basename, guarded against traversal (must be in the allowlist). */
async function readBrainFile(name) {
  if (!BRAIN_FILES.includes(name)) {
    return { ok: false, error: `unknown brain file: ${name}` };
  }
  const p = join(BRAIN, name);
  try {
    const md = await readFile(p, "utf-8");
    return { ok: true, name, markdown: md };
  } catch (e) {
    return { ok: false, error: `cannot read ${name}: ${e.message}` };
  }
}

/** Tail the last N lines of logs/runs.jsonl as parsed objects (newest first). */
async function readRuns(limit = 200) {
  const p = join(REPO, "logs", "runs.jsonl");
  if (!existsSync(p)) return { ok: true, rows: [] };
  try {
    const text = await readFile(p, "utf-8");
    const lines = text.split("\n").filter((l) => l.trim());
    const rows = [];
    for (const line of lines) {
      try {
        rows.push(JSON.parse(line));
      } catch {
        // skip a corrupt line rather than fail the whole view (observability is best-effort)
      }
    }
    rows.reverse(); // newest first
    return { ok: true, rows: rows.slice(0, limit), total: lines.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Eval pyramid status. Reads eval/state.json (gitignored, regenerated by `npm run eval`)
 * if present; if absent, runs `node bin/badge runs --json` is NOT a substitute, so we
 * report state-missing honestly and let the SPA show a "run `npm run eval`" hint. We do
 * NOT auto-run the eval here (it's a multi-second job; the cockpit is a viewer).
 */
async function readEvalState() {
  const p = join(REPO, "eval", "state.json");
  if (!existsSync(p)) {
    return { ok: true, present: false };
  }
  try {
    const obj = JSON.parse(await readFile(p, "utf-8"));
    return { ok: true, present: true, state: obj };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Serve a static file from cockpit/public with a path-traversal guard. */
async function serveStatic(req, res, urlPath) {
  // Map "/" → index.html; strip query already removed by caller.
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  // Normalize and refuse anything that escapes PUBLIC.
  const safe = normalize(join(PUBLIC, rel));
  if (!safe.startsWith(PUBLIC)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    const s = await stat(safe);
    if (!s.isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    const body = await readFile(safe);
    const mime = MIME[extname(safe)] || "application/octet-stream";
    res.writeHead(200, { "content-type": mime });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}

// ---------------------------------------------------------------- router ---

const server = createServer(async (req, res) => {
  // Only GET is served — the cockpit is read-only + execute-a-known-verb; no mutations.
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;

  try {
    // --- API: list the brain files (basenames + titles) for the Brain-browser nav.
    if (path === "/api/brain/list") {
      return sendJson(res, 200, { files: BRAIN_FILES });
    }

    // --- API: a single brain file's raw markdown (SPA renders it client-side).
    if (path === "/api/brain/file") {
      const name = url.searchParams.get("name") || "";
      const r = await readBrainFile(name);
      return sendJson(res, r.ok ? 200 : 400, r);
    }

    // --- API: BM25 search over the brain (the queryable memory layer, surfaced).
    if (path === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q) return sendJson(res, 400, { ok: false, error: "empty query" });
      const r = await runSearch(q);
      return sendJson(res, 200, r);
    }

    // --- API: the run log (observability).
    if (path === "/api/runs") {
      const r = await readRuns();
      return sendJson(res, r.ok ? 200 : 500, r);
    }

    // --- API: the eval pyramid state.
    if (path === "/api/eval") {
      const r = await readEvalState();
      return sendJson(res, r.ok ? 200 : 500, r);
    }

    // --- API: ask-the-employee — drive a CLI verb, return the structured answer.
    if (path === "/api/ask") {
      const verb = (url.searchParams.get("verb") || "classify").trim();
      const q = (url.searchParams.get("q") || "").trim();
      const build = ASK_VERBS[verb];
      if (!build) {
        return sendJson(res, 400, { ok: false, error: `unknown verb: ${verb}` });
      }
      if (!q && verb !== "advise") {
        // advise tolerates a blank (defaults to consumer); the others need an argument.
        return sendJson(res, 400, { ok: false, error: "empty task" });
      }
      const r = await runBadge(build(q));
      return sendJson(res, 200, { ok: r.ok, verb, answer: r.data, error: r.error });
    }

    // --- Everything else: static SPA assets.
    return await serveStatic(req, res, path);
  } catch (e) {
    // Last-resort guard — a handler bug returns 500 JSON, never crashes the process.
    return sendJson(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  // The grep'd banner string ("badge") — also the verify line greps the served HTML.
  process.stdout.write(`badge cockpit → http://${HOST}:${PORT}  (chairman-only, never exposed)\n`);
});
