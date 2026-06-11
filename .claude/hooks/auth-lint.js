#!/usr/bin/env node
// .claude/hooks/auth-lint.js — badge's own auth-anti-pattern guard (B6).
//
// PARSE-TIME REJECTION (OP O11): blocks badge's own staged auth output the moment it
// contains a non-negotiable footgun, rather than relying on a runtime gate. Fires + BLOCKS
// (exit 2 for a PreToolUse hook = "deny") on a seeded violation:
//   - `code_challenge_method=plain`        (KP-A2 / GHSA-9h47-pqcx-hjr4) — RFC 9700 §2.1.1 bans plain
//   - `alg=none` advertised                (KP-A2) — unsigned-token risk
//   - wildcard / non-exact `redirect_uri`  (KP-F2 / GHSA-86j7-9j95-vpqj)
//   - token in a URL / query string        (KP-J2 / OP O14) — leak surface
//
// TWO MODES:
//   1. CLI (testing):   node .claude/hooks/auth-lint.js <path>   → scans the file/dir; exit 1 on a finding.
//   2. PreToolUse hook: reads the tool-call JSON on stdin (Write/Edit content) → exit 2 (deny) on a finding.
//
// Clean input → exit 0. Stdlib only (no build step) so it runs cold as a Claude Code hook.

import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Each detector: a regex over the (raw) text + the KP-cited message emitted on a hit.
const DETECTORS = [
  {
    // Matches both bare-code (`code_challenge_method=plain`) and JSON-quoted-key
    // (`"code_challenge_method": "plain"`) forms — the closing `"` after the key name is optional.
    re: /code_challenge_method["']?\s*[:=]\s*["']?plain\b/i,
    msg: "KP-A2 (GHSA-9h47-pqcx-hjr4): PKCE `plain` method — RFC 9700 §2.1.1 bans it. Use S256 and a parse-time-rejecting provider.",
  },
  {
    re: /\bpkce\b[^\n]*\bplain\b/i,
    msg: "KP-A2 (GHSA-9h47-pqcx-hjr4): PKCE `plain` referenced — require S256 (a missing method must NOT downgrade to plain).",
  },
  {
    // Bare `alg: none`, JSON-quoted `"alg": "none"`, or `none` listed in a *_signing_alg_values_supported array.
    re: /(alg["']?\s*[:=]\s*["']?none\b)|(id_token_signing_alg[^\n]*\bnone\b)|(signing_alg_values_supported[^\]\n]*\bnone\b)/i,
    msg: "KP-A2: `alg=none` advertised — an RP may accept unsigned tokens. Exclude `none`; pin a real signing alg (RS256/ES256).",
  },
  {
    // A `*` anywhere in a redirect_uri value (quoted JSON or bare code) — wildcard/substring matching is the footgun.
    re: /redirect_uris?["']?\s*[:=][^\n]*\*/i,
    msg: "KP-F2 (GHSA-86j7-9j95-vpqj): wildcard `redirect_uri` — substring/wildcard matching enables open-redirect / `javascript:` XSS. Use exact-match HTTPS URIs only.",
  },
  {
    re: /(redirect_uri|callback_url)["']?\s*[:=][^\n]*http:\/\/(?!localhost|127\.0\.0\.1)/i,
    msg: "KP-F2: non-HTTPS `redirect_uri` (non-localhost) — redirect URIs must be HTTPS except for localhost.",
  },
  {
    re: /[?&](access_token|refresh_token|id_token)=/i,
    msg: "KP-J2 (OP O14): token in a URL/query string — XSS-readable / leaked in logs. Authorization header only; never put a token in a URL.",
  },
  {
    re: /(console\.log|console\.error|logger\.\w+)\([^)]*\b(access_token|refresh_token|assertion|saml.?response)\b/i,
    msg: "KP-J2 / OP O31: token or raw SAML assertion logged — a compliance liability. Redact; structured logging only.",
  },
];

/** Scan a blob of text; return the list of cited violation messages (empty = clean). */
function scan(text) {
  const findings = [];
  for (const d of DETECTORS) {
    if (d.re.test(text)) findings.push(d.msg);
  }
  return findings;
}

/** Read a file or (shallow) directory into one text blob for scanning. */
function readTarget(path) {
  const st = statSync(path);
  if (st.isFile()) return readFileSync(path, "utf8");
  const parts = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".git")) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p, depth + 1);
      else if (entry.isFile()) {
        try {
          parts.push(readFileSync(p, "utf8"));
        } catch {
          /* skip unreadable file */
        }
      }
    }
  };
  walk(path, 0);
  return parts.join("\n");
}

/** Read all of stdin (for the PreToolUse hook mode). */
function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main() {
  const pathArg = process.argv[2];

  // MODE 1 — CLI: a path was passed (the verify line + manual testing).
  if (pathArg) {
    let text;
    try {
      text = readTarget(pathArg);
    } catch (err) {
      process.stderr.write(`auth-lint: cannot read "${pathArg}": ${err.message}\n`);
      process.exit(1);
    }
    const findings = scan(text);
    if (findings.length > 0) {
      process.stderr.write(`auth-lint BLOCKED ${pathArg} — ${findings.length} auth anti-pattern(s):\n`);
      for (const f of findings) process.stderr.write(`  ✗ ${f}\n`);
      process.exit(1); // non-zero for the CLI/test path
    }
    process.exit(0); // clean
  }

  // MODE 2 — PreToolUse hook: parse the tool-call JSON on stdin; scan Write/Edit content.
  const raw = readStdin();
  if (!raw.trim()) process.exit(0); // nothing to inspect

  let payload = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // not JSON we understand — don't block
  }
  const input = payload.tool_input || payload.toolInput || {};
  // Only inspect content-bearing tools (Write / Edit / MultiEdit).
  const content =
    input.content ||
    input.new_string ||
    (Array.isArray(input.edits) ? input.edits.map((e) => e.new_string || "").join("\n") : "") ||
    "";
  if (!content) process.exit(0);

  const findings = scan(content);
  if (findings.length > 0) {
    // Claude Code PreToolUse: exit 2 = block the tool call; stderr is shown to the model.
    process.stderr.write(`auth-lint blocked this write — badge does not ship these auth anti-patterns:\n`);
    for (const f of findings) process.stderr.write(`  ✗ ${f}\n`);
    process.exit(2);
  }
  process.exit(0);
}

main();
