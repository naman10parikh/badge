#!/usr/bin/env node
// sandbox/run-in-sandbox.mjs — driver for badge's isolated acceptance run (Component 11, E5).
//
// Reproduces the PLAN §5 acceptance invocation inside an ISOLATED runtime:
//   - DEFAULT (E2B_API_KEY present): boot the badge-acceptance E2B template (Firecracker
//     microVM) via the `e2b` SDK — `Sandbox.create()` — and run `pnpm install && pnpm build &&
//     pnpm run acceptance` inside it with the Clerk test secrets injected as env. The live
//     boot is COST-GATED behind an explicit `--boot` flag (a billed microVM is not spun up on
//     a bare invocation); without `--boot` it prints the cost-aware guidance and exits 0.
//   - ALT (E2B absent): print the documented fallback — the GitHub Actions ubuntu runner,
//     which .github/workflows/acceptance.yml already uses as the active isolation. E2B is NOT
//     a hard gate (HARNESS-OVERRIDES §11), so this is a clean exit-0 no-op, not a failure.
//
// Wiring: real `e2b` SDK (`import { Sandbox } from "e2b"`) — `Sandbox.create()` is the genuine
// product code path, NOT a CLI shellout. Template *builds* still use the `e2b` CLI (a build is
// a CLI operation, not a Sandbox lifecycle). This is the OPTIONAL local/parallel reproduction
// path; the CI gate is the acceptance.yml job. Cold-start / break-even are documented in README.md.
//
// Usage:  node sandbox/run-in-sandbox.mjs [--build-template] [--boot]

import { spawnSync } from "node:child_process";
import { Sandbox } from "e2b";

const args = process.argv.slice(2);
const buildTemplate = args.includes("--build-template");
const boot = args.includes("--boot");

const E2B_TEMPLATE = "badge-acceptance";
// The same command the CI gate runs — executed INSIDE the isolated microVM when --boot is set.
const ACCEPTANCE_CMD = "pnpm install && pnpm build && pnpm run acceptance";

const hasKey = Boolean(process.env.E2B_API_KEY);

// Real e2b SDK code path: boot an isolated Firecracker microVM, run the acceptance command in
// it, then tear it down. Guarded by the caller (only invoked when hasKey && boot). NEVER fakes
// a live boot — `Sandbox.create()` either really connects or throws, which we surface honestly.
async function bootAndRunInE2B() {
  console.log(`sandbox: booting E2B microVM from template "${E2B_TEMPLATE}" via Sandbox.create()…`);
  let sandbox;
  try {
    // Real SDK call — provisions a Firecracker microVM (~150ms cold start), billed per-second.
    sandbox = await Sandbox.create(E2B_TEMPLATE, {
      timeoutMs: 10 * 60 * 1000, // 10 min — enough for install+build+acceptance
      envs: {
        // Forward the Clerk acceptance secrets so the in-VM run hits the same fail-loud gate
        // as acceptance/run.mjs (S1). Only forwarded if present; never logged.
        ...(process.env.CLERK_TEST_PUBLISHABLE_KEY
          ? { CLERK_TEST_PUBLISHABLE_KEY: process.env.CLERK_TEST_PUBLISHABLE_KEY }
          : {}),
        ...(process.env.CLERK_TEST_SECRET_KEY
          ? { CLERK_TEST_SECRET_KEY: process.env.CLERK_TEST_SECRET_KEY }
          : {}),
      },
    });
  } catch (err) {
    console.error("sandbox: Sandbox.create() failed:", err instanceof Error ? err.message : String(err));
    return 1;
  }

  try {
    // The image bakes nothing in, so copy the committed tree (git archive: no untracked .env) into the VM.
    const tree = spawnSync("git", ["archive", "--format=tar", "HEAD"], { maxBuffer: 512 * 1024 * 1024 });
    if (tree.status !== 0) throw new Error("git archive HEAD failed");
    await sandbox.files.write("/workspace/badge.tar", new Blob([tree.stdout]));
    await sandbox.commands.run("mkdir -p /workspace/badge && tar -xf /workspace/badge.tar -C /workspace/badge");
    console.log(`sandbox: microVM ${sandbox.sandboxId} up. Running acceptance inside it…`);
    const result = await sandbox.commands.run(ACCEPTANCE_CMD, {
      cwd: "/workspace/badge",
      onStdout: (line) => process.stdout.write(line),
      onStderr: (line) => process.stderr.write(line),
    });
    console.log(`sandbox: in-VM acceptance exited ${result.exitCode}.`);
    return result.exitCode ?? 0;
  } catch (err) {
    console.error("sandbox: in-VM acceptance run failed:", err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    // Always tear the billed microVM down.
    try {
      await sandbox.kill();
      console.log("sandbox: microVM killed (cost-clean).");
    } catch {
      // Best-effort teardown; a leaked VM auto-expires at its timeout.
    }
  }
}

async function main() {
  if (!hasKey) {
    // Documented ALT path — NOT a failure (E2B is not a hard CI gate).
    console.log(
      [
        "sandbox: E2B not available (E2B_API_KEY unset).",
        "Using the DOCUMENTED ALT isolation: the GitHub Actions ubuntu runner.",
        "  → .github/workflows/acceptance.yml runs `pnpm run acceptance` inside a clean ubuntu-latest",
        "    job (a fresh, reproducible box per run) — that IS the isolated acceptance gate.",
        "  → To use E2B locally instead: set E2B_API_KEY, then re-run with --boot.",
        "HARNESS-OVERRIDES §11: E2B is the default WHEN present; the runner is the accepted alt.",
      ].join("\n"),
    );
    return 0;
  }

  // E2B present. Template *builds* are a CLI operation (not a Sandbox lifecycle) — keep using
  // the `e2b` CLI for that. The acceptance secrets must be present in the env (the runner inside
  // the sandbox enforces the same fail-loud gate as acceptance/run.mjs).
  if (buildTemplate) {
    console.log("sandbox: building the badge-acceptance E2B template…");
    const b = spawnSync("e2b", ["template", "build", "--dockerfile", "sandbox/e2b.Dockerfile", "--name", E2B_TEMPLATE], { stdio: "inherit", env: process.env });
    if (b.status !== 0) {
      console.error("sandbox: template build failed (exit " + b.status + ").");
      return b.status ?? 1;
    }
  }

  if (boot) {
    // Explicit opt-in: actually provision a billed microVM via the SDK and run acceptance in it.
    return await bootAndRunInE2B();
  }

  // Key present but no --boot: cost-aware no-op (don't auto-bill a sandbox on bare invocation).
  console.log(
    [
      "sandbox: E2B is available. To run the isolated acceptance inside a microVM via the e2b SDK",
      "(Sandbox.create() → pnpm install && build && run acceptance, with CLERK_TEST_* injected):",
      "",
      "  node sandbox/run-in-sandbox.mjs --boot            # provisions a billed microVM, runs, tears down",
      "  node sandbox/run-in-sandbox.mjs --build-template  # (re)build the badge-acceptance image first",
      "",
      "This driver intentionally does NOT auto-spawn a billed sandbox on a bare invocation. The",
      "cold-start (~150ms) + per-second billing make E2B the right tool for parallel/clean",
      "reproduction; for the single CI gate the ubuntu runner is cheaper (break-even noted in",
      "sandbox/README.md). Build the template first with --build-template.",
    ].join("\n"),
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("sandbox: unexpected error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
