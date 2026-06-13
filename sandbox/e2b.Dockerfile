# sandbox/e2b.Dockerfile — the E2B sandbox image for badge's acceptance test (E5).
#
# A minimal Node 22 + pnpm + Playwright-Chromium box that can run the PLAN §5 invocation
# (create-next-app → badge init → playwright sign-in E2E) in isolation. Mirrors the toolchain
# the GH ubuntu runner provides (the documented alt), so a green run here == a green CI run.

FROM node:22-bookworm

# pnpm via corepack (matches the repo's pnpm-only rule + the CI's pnpm 9).
RUN corepack enable && corepack prepare pnpm@9 --activate

# Playwright Chromium system deps (the acceptance E2E drives a real browser).
RUN npx -y playwright@latest install-deps chromium

WORKDIR /workspace

# The repo is mounted/synced at run time by sandbox/run-in-sandbox.mjs; nothing is baked in
# so the image stays small and the code is always current. The driver runs:
#   pnpm install && pnpm build && pnpm run acceptance
# with the Clerk test secrets injected as env (never baked into the image).
