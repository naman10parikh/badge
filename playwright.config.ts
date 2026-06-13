// playwright.config.ts — drives the cockpit E2E (CP123 G2).
//
// Scope: ONLY the cockpit test (`cockpit/__tests__/`). The acceptance E2E
// (acceptance/e2e/protected-route.spec.ts) ships its OWN generated config into the
// ephemeral create-next-app target at run time (see acceptance/run.mjs) — it is NOT run
// by this root config. Keeping them separate means `pnpm exec playwright test cockpit`
// boots only the stdlib cockpit server, with no Clerk-key dependency.
//
// webServer boots `node cockpit/server.mjs` on :7788 and waits for it before the test;
// Playwright tears it down after. Zero-dep server → no install/build step in the webServer.

import { defineConfig, devices } from "@playwright/test";

const PORT = 7788;

export default defineConfig({
  testDir: "cockpit/__tests__",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node cockpit/server.mjs",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
