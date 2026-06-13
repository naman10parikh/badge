#!/usr/bin/env node
// eval/run.mjs — badge's eval pyramid (Component 9, E1). Hamel L1/L2/L3, graded against
// the **Resolution** text in brain/BATTLE-TESTED-SCENARIOS.md — NO self-grading (dsip.json).
//
// Zero-dep ESM. Imports the COMPILED, deterministic handlers from dist/ (run `pnpm build`
// first — CI + rsi.yml both build before this) so grading is $0, tokenless, and offline.
// Each golden task declares its grader in eval/golden/G*.json:
//   - "verb"        : call the named CLI handler, assert structured fields + Resolution
//                     keyword-coverage against its JSON output.
//   - "brain"       : assert the cited BTS/KP scenario block in the brain file carries the
//                     load-bearing Resolution tokens (badge's knowledge surface for the
//                     reasoning-only goldens — classify routes here; still vs-Resolution).
//   - "acceptance"  : G1, the integration eval — runs in acceptance.yml (E2), not here;
//                     this runner only asserts the acceptance harness + workflow exist.
//
// L1 = structural field assertions (classify returns the right P; audit flags the seeded
//      CVE; advise emits a $ number) — encoded as the `field`/`blob` asserts on each verb.
// L2 = the 50-row hand-labeled set (eval/labeled-set.jsonl): classify macro-F1 vs authored
//      ground truth, gate F1 >= 0.8.
// L3 = the trajectory goldens (G4/G5/G7/G10/G11/G13) — graded deterministically here against
//      their Resolution keyword-coverage (the handlers are deterministic, so a $0 keyword
//      grader is sound). An optional calibrated LLM-judge (gated on ANTHROPIC_API_KEY, off by
//      default — never in the $0 CI path) can be layered later without changing this gate.
//
// Exit 0 iff every required golden PASSes AND F1 >= 0.8. Flipping a golden answer (or a
// Resolution token) turns the run RED. `--ci` requires only the CI-blocking subset (the
// acceptance.yml + ci.yml gate); default (no flag) requires ALL 14. `--json` for machines.
//
// Usage:  node eval/run.mjs [--ci] [--json]

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN_DIR = join(REPO_ROOT, "eval", "golden");
const LABELED = join(REPO_ROOT, "eval", "labeled-set.jsonl");
const STATE_PATH = join(REPO_ROOT, "eval", "state.json");
const RUNS_PATH = join(REPO_ROOT, "logs", "runs.jsonl");

const args = process.argv.slice(2);
const ciOnly = args.includes("--ci");
const asJson = args.includes("--json");

const F1_GATE = 0.8;
const START = Date.now();

// ── load the compiled handlers (dist must exist — build first) ──────────────────────────
let handlers;
try {
  const [classifyM, auditM, adviseM, samlM, migrateM] = await Promise.all([
    import(new URL("../dist/cli/classify.js", import.meta.url)),
    import(new URL("../dist/cli/audit.js", import.meta.url)),
    import(new URL("../dist/cli/advise.js", import.meta.url)),
    import(new URL("../dist/cli/saml-triage.js", import.meta.url)),
    import(new URL("../dist/cli/migrate.js", import.meta.url)),
  ]);
  handlers = {
    classify: (a) => classifyM.classify(a.task),
    audit: (a) => auditM.audit({ path: join(REPO_ROOT, a.path), kind: a.kind }),
    advise: (a) => adviseM.advise({ useCase: a.useCase, mau: a.mau, enterprise: a.enterprise }),
    "saml-triage": (a) => samlM.samlTriage(a.symptom),
    migrate: (a) => migrateM.migrate({ from: a.from, to: a.to }),
  };
} catch (err) {
  console.error(
    "eval: could not load compiled handlers from dist/ — run `pnpm build` first.\n" +
      `  (${err instanceof Error ? err.message : String(err)})`,
  );
  process.exit(1);
}

// ── grader helpers ──────────────────────────────────────────────────────────────────────

/** Resolve a dotted/indexed path against an object. Supports `a.b`, `a[0].b`, `a[*].b`
 *  (the `[*]` form returns the array of that field across all elements). */
function resolvePath(obj, path) {
  const tokens = path.replace(/\[(\*|\d+)\]/g, ".[$1]").split(".").filter(Boolean);
  let cur = obj;
  for (const tok of tokens) {
    if (cur == null) return undefined;
    if (tok === "[*]") {
      if (!Array.isArray(cur)) return undefined;
      // remaining tokens apply to each element; handle the common single-field case.
      return cur; // caller maps the next field; for our asserts we use a[*].field directly below.
    }
    const idx = tok.match(/^\[(\d+)\]$/);
    cur = idx ? cur[Number(idx[1])] : cur[tok];
  }
  return cur;
}

/** Resolve a path that may contain a single `[*]` projecting one field across an array. */
function resolveProjected(obj, path) {
  const star = path.indexOf("[*].");
  if (star === -1) return resolvePath(obj, path);
  const before = path.slice(0, star);
  const field = path.slice(star + 4);
  const arr = resolvePath(obj, before);
  if (!Array.isArray(arr)) return undefined;
  return arr.map((el) => resolvePath(el, field));
}

/** Run one assert against a verb's data object; returns { pass, why }. */
function checkVerbAssert(data, blob, a) {
  if (a.type === "field") {
    const val = a.path.includes("[*].") ? resolveProjected(data, a.path) : resolvePath(data, a.path);
    if ("equals" in a) {
      return { pass: val === a.equals, why: `${a.path} = ${JSON.stringify(val)} (want ${JSON.stringify(a.equals)})` };
    }
    if ("length" in a) {
      const len = Array.isArray(val) ? val.length : undefined;
      return { pass: len === a.length, why: `${a.path}.length = ${len} (want ${a.length})` };
    }
    if ("includes" in a) {
      const arr = Array.isArray(val) ? val : val == null ? [] : [val];
      const hit = arr.some((x) => String(x) === a.includes);
      return { pass: hit, why: `${a.path} ${hit ? "includes" : "MISSING"} "${a.includes}"` };
    }
    return { pass: false, why: `unknown field assert on ${a.path}` };
  }
  if (a.type === "blob") {
    const re = new RegExp(a.match, "i");
    return { pass: re.test(blob), why: `/${a.match}/i ${re.test(blob) ? "matched" : "NOT FOUND"}` };
  }
  return { pass: false, why: `unknown assert type ${a.type}` };
}

/** Extract the cited scenario block from a brain file (between this `## SCENARIO` and the next). */
function brainSection(brainFile, section) {
  const text = readFileSync(join(REPO_ROOT, brainFile), "utf8");
  const startMarker = `## ${section}`;
  const start = text.indexOf(startMarker);
  if (start === -1) return null;
  const rest = text.slice(start + startMarker.length);
  const nextIdx = rest.indexOf("\n## ");
  return (nextIdx === -1 ? rest : rest.slice(0, nextIdx)).toLowerCase();
}

// ── run one golden task ─────────────────────────────────────────────────────────────────
function runGolden(task) {
  const results = [];
  if (task.grader === "acceptance") {
    // Integration eval — delegated to acceptance.yml (E2). Here we only assert the harness exists.
    for (const rel of task.asserts_present ?? []) {
      const present = existsSync(join(REPO_ROOT, rel));
      results.push({ pass: present, why: `${rel} ${present ? "present" : "MISSING"}` });
    }
    return {
      id: task.id,
      level: task.level,
      grader: "acceptance",
      ci_block: task.ci_block,
      delegated: true,
      checks: results,
      pass: results.every((r) => r.pass),
    };
  }

  if (task.grader === "brain") {
    const block = brainSection(task.brain_file, task.section);
    if (block == null) {
      return { id: task.id, level: task.level, grader: "brain", ci_block: task.ci_block, checks: [{ pass: false, why: `section "${task.section}" not found in ${task.brain_file}` }], pass: false };
    }
    for (const a of task.asserts) {
      const re = new RegExp(a.match, "i");
      results.push({ pass: re.test(block), why: `${a.desc}: /${a.match}/i ${re.test(block) ? "matched" : "NOT FOUND"}` });
    }
    return { id: task.id, level: task.level, grader: "brain", ci_block: task.ci_block, checks: results, pass: results.every((r) => r.pass) };
  }

  // grader === "verb"
  const fn = handlers[task.verb];
  if (!fn) return { id: task.id, level: task.level, grader: "verb", ci_block: task.ci_block, checks: [{ pass: false, why: `no handler for verb "${task.verb}"` }], pass: false };
  let data;
  try {
    data = fn(task.args).data;
  } catch (err) {
    return { id: task.id, level: task.level, grader: "verb", ci_block: task.ci_block, checks: [{ pass: false, why: `verb threw: ${err instanceof Error ? err.message : String(err)}` }], pass: false };
  }
  const blob = JSON.stringify(data).toLowerCase();
  for (const a of task.asserts) {
    const r = checkVerbAssert(data, blob, a);
    results.push({ pass: r.pass, why: `${a.desc}: ${r.why}` });
  }
  return { id: task.id, level: task.level, grader: "verb", verb: task.verb, ci_block: task.ci_block, checks: results, pass: results.every((r) => r.pass) };
}

// ── L2: macro-F1 of classify over the hand-labeled set ──────────────────────────────────
function computeF1() {
  const text = readFileSync(LABELED, "utf8");
  const rows = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try {
      obj = JSON.parse(t);
    } catch {
      continue;
    }
    if (obj._comment || !obj.task) continue;
    rows.push(obj);
  }
  const labels = ["P1", "P2", "P3", "P4", "plane1"];
  const per = Object.fromEntries(labels.map((L) => [L, { tp: 0, fp: 0, fn: 0 }]));
  let correct = 0;
  for (const { task, label } of rows) {
    const c = handlers.classify({ task }).data;
    const got = c.plane === 1 ? "plane1" : c.problem;
    if (got === label) correct++;
    for (const L of labels) {
      if (label === L && got === L) per[L].tp++;
      else if (got === L && label !== L) per[L].fp++;
      else if (label === L && got !== L) per[L].fn++;
    }
  }
  let macro = 0;
  const perClass = {};
  for (const L of labels) {
    const { tp, fp, fn } = per[L];
    const prec = tp / (tp + fp || 1);
    const rec = tp / (tp + fn || 1);
    const f1 = (2 * prec * rec) / (prec + rec || 1);
    macro += f1;
    perClass[L] = { precision: +prec.toFixed(3), recall: +rec.toFixed(3), f1: +f1.toFixed(3) };
  }
  return {
    rows: rows.length,
    accuracy: +(correct / (rows.length || 1)).toFixed(3),
    macro_f1: +(macro / labels.length).toFixed(3),
    per_class: perClass,
  };
}

// ── orchestrate ─────────────────────────────────────────────────────────────────────────
const goldenNum = (f) => Number(f.replace(/^G(\d+)\.json$/, "$1"));
const goldenFiles = readdirSync(GOLDEN_DIR)
  .filter((f) => /^G\d+\.json$/.test(f))
  .sort((a, b) => goldenNum(a) - goldenNum(b));

const golden = [];
for (const f of goldenFiles) {
  const task = JSON.parse(readFileSync(join(GOLDEN_DIR, f), "utf8"));
  golden.push(runGolden(task));
}

const f1 = computeF1();

// A golden is "required" when: default run → all; --ci run → only ci_block tasks.
const required = golden.filter((g) => (ciOnly ? g.ci_block : true));
const goldenPass = required.filter((g) => g.pass).length;
const goldenFail = required.length - goldenPass;
const f1Pass = f1.macro_f1 >= F1_GATE;
const allPass = goldenFail === 0 && f1Pass;

// ── persist state (cockpit Cluster-G + RSI engine read this) ────────────────────────────
const state = {
  ts: new Date().toISOString(),
  mode: ciOnly ? "ci" : "full",
  gate: { f1_threshold: F1_GATE, golden_required: required.length, golden_pass: goldenPass, golden_fail: goldenFail, f1_pass: f1Pass },
  pass: allPass,
  f1,
  golden: golden.map((g) => ({ id: g.id, level: g.level, grader: g.grader, ci_block: g.ci_block, pass: g.pass, failed_checks: g.checks.filter((c) => !c.pass).map((c) => c.why) })),
};
try {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
} catch (err) {
  console.warn("[eval] could not write state.json:", err instanceof Error ? err.message : String(err));
}

// ── observability: one line in logs/runs.jsonl (shares E3's schema; cmd:"eval") ──────────
try {
  mkdirSync(dirname(RUNS_PATH), { recursive: true });
  appendFileSync(
    RUNS_PATH,
    JSON.stringify({ ts: new Date().toISOString(), cmd: "eval", jtbd: null, model: null, duration_ms: Date.now() - START, outcome: allPass ? "ok" : "error" }) + "\n",
  );
} catch (err) {
  console.warn("[eval] could not append run record:", err instanceof Error ? err.message : String(err));
}

// ── report ──────────────────────────────────────────────────────────────────────────────
if (asJson) {
  process.stdout.write(JSON.stringify(state, null, 2) + "\n");
} else {
  const lines = [];
  lines.push(`badge eval — ${ciOnly ? "CI-blocking subset" : "full (all 14 golden tasks)"}`);
  lines.push("");
  for (const g of golden) {
    const inScope = ciOnly ? g.ci_block : true;
    const mark = g.pass ? "PASS" : "FAIL";
    const scope = g.ci_block ? "CI" : "  ";
    const skip = inScope ? "" : "  (not in CI subset)";
    lines.push(`  [${mark}] ${g.id.padEnd(4)} ${g.level.padEnd(6)} ${scope} ${g.grader.padEnd(11)}${skip}`);
    if (g.pass === false && inScope) {
      for (const c of g.checks.filter((c) => !c.pass)) lines.push(`         ✗ ${c.why}`);
    }
  }
  lines.push("");
  lines.push(`  L2 classify macro-F1: ${f1.macro_f1} over ${f1.rows} rows (gate ≥ ${F1_GATE}) — ${f1Pass ? "PASS" : "FAIL"}`);
  lines.push(`     accuracy ${f1.accuracy} · ${Object.entries(f1.per_class).map(([L, v]) => `${L}:F1=${v.f1}`).join("  ")}`);
  lines.push("");
  lines.push(`  golden: pass ${goldenPass} / fail ${goldenFail}  (of ${required.length} required)`);
  lines.push(`  RESULT: ${allPass ? "PASS — exit 0" : "FAIL — exit 1"}`);
  process.stdout.write(lines.join("\n") + "\n");
}

process.exit(allPass ? 0 : 1);
