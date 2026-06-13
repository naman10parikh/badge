// acceptance/e2e/protected-route.spec.ts — THE acceptance E2E (G1, PLAN §5/§9).
//
// Copied by acceptance/run.mjs into the ephemeral create-next-app target after
// `badge init --provider clerk`. It drives the trajectory the scaffold pre-empts the Clerk
// Core-3 footgun for (clerkMiddleware() protects nothing by default — the scaffold's matcher
// + auth.protect() cover /dashboard):
//
//   1. logged-out GET /dashboard  → REDIRECTED to /sign-in   (the protect() gate fires)
//   2. sign in with the Clerk TEST user (+clerk_test email + the 424242 test OTP code)
//   3. land on /dashboard with the signed-in marker (data-testid="signed-in-marker")
//
// We assert the redirect-THEN-access trajectory, not just a 200 (PLAN §5 verify step 3).
// Clerk **test mode**: `+clerk_test` addressing + the fixed 424242 code mean no real email
// round-trip; @clerk/testing's setupClerkTestingToken() bypasses bot detection so the flow
// is deterministic in CI. Keys + the test user come from the env (CLERK_TEST_USER_EMAIL /
// CLERK_TEST_USER_PASSWORD), never hard-coded.

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

const TEST_EMAIL = process.env.CLERK_TEST_USER_EMAIL ?? "";
const TEST_PASSWORD = process.env.CLERK_TEST_USER_PASSWORD ?? "";

test.describe("badge acceptance — Clerk sign-in → protected route", () => {
  test("logged-out /dashboard redirects to /sign-in, then sign-in lands on /dashboard", async ({ page }) => {
    // Testing token bypasses Clerk's bot detection so the flow is deterministic in CI.
    await setupClerkTestingToken({ page });

    // 1. Logged-out access to the protected route → must be redirected to sign-in.
    await page.goto("/dashboard");
    await page.waitForURL(/\/sign-in/, { timeout: 30_000 });
    expect(page.url()).toContain("/sign-in");

    // 2. Sign in with the Clerk test user. Clerk's hosted <SignIn> renders an identifier
    //    field, then either a password or an email-code step depending on the instance config.
    await page.waitForSelector('input[name="identifier"]', { timeout: 30_000 });
    await page.fill('input[name="identifier"]', TEST_EMAIL);
    await page.getByRole("button", { name: /continue/i }).click();

    // Password path (most common for a test user created with a password):
    const passwordField = page.locator('input[name="password"]');
    if (await passwordField.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await passwordField.fill(TEST_PASSWORD);
      await page.getByRole("button", { name: /continue/i }).click();
    } else {
      // Email-code path: Clerk test mode accepts the fixed 424242 verification code.
      const codeField = page.locator('input[name="code"], input[autocomplete="one-time-code"]').first();
      await codeField.waitFor({ timeout: 15_000 });
      await codeField.fill("424242");
    }

    // 3. Land on the protected dashboard with the signed-in marker (defense-in-depth assert).
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByTestId("signed-in-marker")).toBeVisible({ timeout: 30_000 });
  });
});
