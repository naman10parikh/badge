// cockpit/__tests__/cockpit.e2e.ts — the cockpit E2E (CP123 G2, PLAN §9 + §10).
//
// Loads the cockpit on :7788 (booted by playwright.config.ts's webServer), types a task
// into the ask-the-employee box, and asserts the rendered STRUCTURED answer — plane, P
// (P1-P4), default tool, rationale. Red-blocking in CI. This proves the cockpit's headline
// "badge talking" view actually drives the CLI and renders the structured result, not that
// a page merely loaded.
//
// It also smoke-checks the other three views render their data (brain browser file content,
// run-log rows, eval pyramid) so a regression in any view turns CI red.

import { test, expect } from "@playwright/test";

test.describe("badge cockpit", () => {
  test("loads on :7788 and shows the badge brand + nav", async ({ page }) => {
    await page.goto("/");
    // The literal brand word the G1 verify greps — also the human anchor.
    await expect(page.locator(".brand-mark")).toHaveText("badge");
    await expect(page.getByRole("button", { name: "Ask the employee" })).toBeVisible();
  });

  test("ask-the-employee renders a P1-P4 classify answer (plane + P + tool + rationale)", async ({ page }) => {
    await page.goto("/");

    // Go to the ask view, type the canonical P1 task, ask.
    await page.getByRole("button", { name: "Ask the employee" }).click();
    await page.locator("#ask-input").fill("an agent calls my MCP server");
    await page.locator("#ask-btn").click();

    const answer = page.locator("#ask-answer");

    // The structured answer must render: the P pill, the plane, the default tool, a rationale.
    await expect(answer.locator(".ans-pill")).toHaveText("P1", { timeout: 15_000 });
    await expect(answer.locator(".ans-plane")).toContainText("plane 2");
    await expect(answer.locator(".ans-tool")).toContainText("Stytch");
    await expect(answer.locator(".ans-rationale")).toContainText(/P1/);
    // At least one citation chip (EM-JTBD-4 / OP-O23 …) — badge cites its brain.
    await expect(answer.locator(".cite").first()).toBeVisible();
  });

  test("ask-the-employee can switch verb to advise and render $ breakpoints", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ask the employee" }).click();
    await page.locator("#ask-verb").selectOption("advise");
    await page.locator("#ask-input").fill("consumer");
    await page.locator("#ask-btn").click();

    const answer = page.locator("#ask-answer");
    await expect(answer.locator(".ans-tool")).toContainText(/Clerk|BetterAuth/, { timeout: 15_000 });
    // The differentiated value — a decision with $ breakpoints, not a feature table.
    await expect(answer.locator(".bp").first()).toBeVisible();
    await expect(answer.locator(".bp-cost").first()).toContainText("$");
  });

  test("brain browser renders a brain file's markdown", async ({ page }) => {
    await page.goto("/");
    // Brain is the default view; the first file (EXPERTISE-MAP) auto-loads.
    await expect(page.locator("#brain-files li").first()).toContainText("EXPERTISE-MAP");
    // Markdown rendered to real headings (the renderer turned ## into <h2>).
    await expect(page.locator("#brain-content h1, #brain-content h2").first()).toBeVisible({ timeout: 15_000 });
  });

  test("brain search returns a cited hit (the queryable memory layer)", async ({ page }) => {
    await page.goto("/");
    await page.locator("#search-input").fill("RFC 8707 audience binding");
    await page.locator("#search-btn").click();
    // memory-search.sh prints cited node ids (BTS-5 / KP-A1) into the results <pre>.
    await expect(page.locator("#search-results")).toContainText(/BTS-\d|KP-[A-Z]\d|EM-JTBD/, { timeout: 15_000 });
  });

  test("run log lists invocations and eval scores render the pyramid", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Run log" }).click();
    // At least one run row (the cockpit's own /api/ask calls + prior CLI runs populate it).
    await expect(page.locator("#runs-body tr").first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Eval scores" }).click();
    // Either the pyramid cards (state present) or the "run npm run eval" hint — both are valid;
    // assert the view rendered SOMETHING beyond the loading placeholder.
    await expect(page.locator(".eval-cards, #eval-body .muted").first()).toBeVisible({ timeout: 15_000 });
  });
});
