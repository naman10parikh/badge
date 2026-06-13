#!/usr/bin/env node
// acceptance/run.mjs — THE acceptance test (Component 9 top integration eval, E2 + G1).
//
// Runs the PLAN §5 invocation, three times (pass^k, k>=3 — auth flakes are the enemy):
//   1. npx create-next-app@latest <tmp> (ephemeral target)
//   2. node bin/badge init --provider clerk --target <tmp>   (the employee's hands)
//   3. cd <tmp> && pnpm install && pnpm exec playwright test  (the seeded sign-in E2E)
// PASS = the logged-out /dashboard → /sign-in redirect → signed-in /dashboard trajectory
// is green all three runs. Acceptance-not-green ⇒ badge is NOT done (CP122: no faked DONE).
//
// SECRETS (PLAN §5/§8, D7): the Clerk **test** keys are the ONLY live keys the bar needs.
// If CLERK_TEST_* are absent this runner **FAILS LOUDLY** (exit 1) — it is NOT skipped — so
// the §8 provisioning (S1) is forced to complete. Keys come from the env (never hard-coded,
// never committed); the auth-lint hook + .gitignore keep .env out of the tree.
//
// Zero-dep (stdlib + child_process). The Playwright spec lives at acceptance/e2e/ and is
// copied into the ephemeral target after `badge init` (the target is a real Next.js app, so
// it can run Playwright against its own dev server). The cockpit + ci.yml shell out to this.
//
// Usage:  node acceptance/run.mjs [--runs N] [--target <dir>] [--keep] [--json]

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, mkdirSync, copyFileSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const E2E_SPEC = join(REPO_ROOT, "acceptance", "e2e", "protected-route.spec.ts");
const RUNS_PATH = join(REPO_ROOT, "logs", "runs.jsonl");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const keep = args.includes("--keep");
const runsIdx = args.indexOf("--runs");
const RUNS = runsIdx >= 0 ? Math.max(1, Number(args[runsIdx + 1])) : 3; // pass^k, k>=3
const tgtIdx = args.indexOf("--target");
const FIXED_TARGET = tgtIdx >= 0 ? args[tgtIdx + 1] : null;

const START = Date.now();
const REQUIRED_SECRETS = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_TEST_USER_EMAIL",
  "CLERK_TEST_USER_PASSWORD",
];

function logRun(outcome) {
  try {
    mkdirSync(dirname(RUNS_PATH), { recursive: true });
    appendFileSync(
      RUNS_PATH,
      JSON.stringify({ ts: new Date().toISOString(), cmd: "acceptance", jtbd: 1, model: null, duration_ms: Date.now() - START, outcome }) + "\n",
    );
  } catch {
    // observability is best-effort; never blocks the gate.
  }
}

function fail(reason, detail) {
  logRun("error");
  const out = { ok: false, runs_requested: RUNS, reason, detail: detail ?? null };
  if (asJson) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  else {
    process.stderr.write(`\nacceptance: FAIL — ${reason}\n`);
    if (detail) process.stderr.write(`${detail}\n`);
  }
  process.exit(1);
}

// ── secret gate: fail loudly, never skip (PLAN §5) ──────────────────────────────────────
const missing = REQUIRED_SECRETS.filter((k) => !process.env[k] || /REPLACE_ME/.test(process.env[k] ?? ""));
if (missing.length > 0) {
  fail(
    `missing Clerk test secret(s): ${missing.join(", ")}`,
    "These are the ONLY live keys the acceptance bar needs (PLAN §8 / S1). Provision a Clerk TEST instance\n" +
      "(dashboard.clerk.com → API Keys → create a +clerk_test user) and export them, OR set them as GitHub\n" +
      "Actions secrets (CLERK_TEST_PUBLISHABLE_KEY / CLERK_TEST_SECRET_KEY / CLERK_TEST_USER_EMAIL /\n" +
      "CLERK_TEST_USER_PASSWORD). This job FAILS LOUDLY by design — it is never skipped (CP122 no-fake rule).",
  );
}

// ── tool preflight: the invocation needs node + npx + pnpm + a network for create-next-app ──
function toolExists(bin) {
  const r = spawnSync(process.platform === "win32" ? "where" : "command", process.platform === "win32" ? [bin] : ["-v", bin], { stdio: "ignore", shell: process.platform !== "win32" });
  return r.status === 0;
}
for (const bin of ["npx", "pnpm"]) {
  if (!toolExists(bin)) fail(`required tool not found on PATH: ${bin}`, "The acceptance invocation needs npx + pnpm (PLAN §5).");
}

// ── one acceptance pass ─────────────────────────────────────────────────────────────────
function onePass(idx) {
  const target = FIXED_TARGET ?? mkdtempSync(join(tmpdir(), "badge-accept-"));
  const sh = (cmd, cmdArgs, cwd) => execFileSync(cmd, cmdArgs, { cwd: cwd ?? REPO_ROOT, stdio: "inherit", env: process.env });
  try {
    // 1. ephemeral Next.js target.
    sh("npx", ["create-next-app@latest", target, "--ts", "--app", "--tailwind", "--no-eslint", "--use-pnpm", "--yes"]);
    // 2. badge scaffolds Clerk auth (the employee's hands).
    sh("node", [join(REPO_ROOT, "bin", "badge"), "init", "--provider", "clerk", "--target", target]);
    // 3. copy the seeded E2E spec + a minimal Playwright config into the target, install, run.
    const e2eDir = join(target, "e2e");
    mkdirSync(e2eDir, { recursive: true });
    if (!existsSync(E2E_SPEC)) throw new Error(`missing E2E spec at ${E2E_SPEC}`);
    copyFileSync(E2E_SPEC, join(e2eDir, "protected-route.spec.ts"));
    writeFileSync(join(target, "playwright.config.ts"), playwrightConfig());
    sh("pnpm", ["install"], target);
    // @playwright/test drives the browser; @clerk/testing provides the testing-token helper
    // the spec imports (bypasses Clerk bot detection so the sign-in flow is deterministic).
    sh("pnpm", ["add", "-D", "@playwright/test", "@clerk/testing"], target);
    sh("pnpm", ["exec", "playwright", "install", "--with-deps", "chromium"], target);
    sh("pnpm", ["exec", "playwright", "test"], target);
    return { run: idx, target, ok: true };
  } finally {
    if (!keep && !FIXED_TARGET) {
      try {
        rmSync(target, { recursive: true, force: true });
      } catch {
        // best-effort cleanup of the ephemeral dir.
      }
    }
  }
}

/** Playwright config dropped into the ephemeral target — boots `next dev` then runs the spec. */
function playwrightConfig() {
  return `import { defineConfig } from "@playwright/test";
// Auto-generated by badge acceptance/run.mjs — boots the scaffolded Next.js app and runs the
// seeded sign-in → protected-route E2E against it.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
`;
}

// ── run ×N (pass^k) ─────────────────────────────────────────────────────────────────────
const passes = [];
for (let i = 1; i <= RUNS; i++) {
  try {
    passes.push(onePass(i));
  } catch (err) {
    fail(`acceptance run ${i}/${RUNS} failed`, err instanceof Error ? err.message : String(err));
  }
}

logRun("ok");
const out = { ok: true, runs: passes.length, passk: RUNS, trajectory: "logged-out /dashboard → /sign-in → signed-in /dashboard" };
if (asJson) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
else process.stdout.write(`\nacceptance: PASS — ${passes.length}/${RUNS} green (pass^k, the redirect→sign-in→protected trajectory)\n`);
process.exit(0);
