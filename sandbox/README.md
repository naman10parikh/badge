# badge sandbox — isolated runtime for the acceptance test (Component 11, E5)

badge's **real integration point** is not a unit test — it's scaffolding Clerk auth into a
*fresh* Next.js app and driving a **live sign-in → protected-route** flow (PLAN §5). That has
to run **isolated + reproducibly**: a clean box per run, no leakage from a previous run, the
same toolchain every time. This directory is that isolated runtime.

## The two isolation paths (and which one runs the gate)

| Path | When | What runs | Is it the CI gate? |
| --- | --- | --- | --- |
| **GH Actions ubuntu runner** (the ALT, and the active gate) | always in CI | `.github/workflows/acceptance.yml` → `pnpm run acceptance` inside a fresh `ubuntu-latest` job | **YES** — this is the red-blocking acceptance gate |
| **E2B microVM** (the DEFAULT when `E2B_API_KEY` present) | local / parallel reproduction | `sandbox/run-in-sandbox.mjs` boots `badge-acceptance` (Firecracker), runs `pnpm install && build && run acceptance` | No — optional reproduction |

Per **HARNESS-OVERRIDES §11**: E2B is the default *when present*, but it is **NOT a hard CI
gate**. The GitHub Actions ubuntu runner is the **accepted documented alt** and is what the
`acceptance.yml` job uses. A fresh `ubuntu-latest` job is itself a clean, reproducible,
isolated box per run — it satisfies the isolation need without an E2B dependency. So when
`E2B_API_KEY` is absent, the acceptance gate still runs (on the runner); nothing is skipped.

## Files

- `e2b.toml` — the `badge-acceptance` E2B template definition (Node 22 + pnpm + Chromium deps).
- `e2b.Dockerfile` — the image (mirrors the runner toolchain so a green E2B run == a green CI run).
- `run-in-sandbox.mjs` — the driver: boots E2B when available, else prints the runner-alt path
  and exits 0 (E2B is not a gate). `--build-template` builds the image first.

## Cold-start & break-even (why each path, honestly)

- **E2B cold start ≈ 150 ms** (Firecracker microVM), billed per-second while alive. Great for
  *parallel* acceptance runs (e.g. the pass^k k≥3 in three clean boxes at once) and for
  reproducing a flake locally without polluting your machine.
- **GH ubuntu runner** has a higher per-job spin-up (tens of seconds: VM + checkout + pnpm +
  Playwright install) but it's **already paid for** inside the CI minutes and needs no extra
  key or template build. For the **single** acceptance gate on each push/PR, the runner is the
  cheaper, simpler choice — there is nothing to provision and the isolation is equivalent.
- **Break-even:** E2B wins once you run the acceptance flow **many times in parallel** or
  **frequently outside CI** (the ~150 ms start + clean-box-per-run amortizes the template-build
  cost — roughly past a few dozen runs/day, mirroring the energy-fleet ~11k sandbox-hrs/mo
  managed-vs-self-host figure). For one gate per commit, the runner is the right default — which
  is exactly why `acceptance.yml` targets `ubuntu-latest`, and E2B stays the documented default
  *only when its key is present* for local/parallel reproduction.

## Run it

```bash
# Active gate (no E2B needed) — same command the CI job runs:
pnpm run acceptance            # FAILS LOUDLY if CLERK_TEST_* secrets are absent (S1)

# Optional E2B reproduction (needs E2B_API_KEY + `e2b` CLI):
node sandbox/run-in-sandbox.mjs --build-template
```
