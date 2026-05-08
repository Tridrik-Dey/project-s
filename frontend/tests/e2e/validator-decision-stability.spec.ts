import { expect, test } from "@playwright/test";
import { installMockApi } from "./helpers/mockApi";

async function ensureAppShellLoaded(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await expect(page.getByRole("heading", { name: /Albo Fornitori Digitale/i })).toBeVisible({ timeout: 5000 });
      return;
    } catch {
      if (attempt === 3) throw new Error("App shell did not render (blank-page bootstrap failure).");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);
    }
  }
}

test("admin dashboard quick-actions stay stable while scrolling", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await ensureAppShellLoaded(page);
  const enBtn = page.getByRole("button", { name: /^EN$/i });
  if (await enBtn.isVisible().catch(() => false)) {
    await enBtn.click();
  }
  await page.getByLabel(/Email/i).fill("validator.rossi@supplierplatform.com");
  await page.getByLabel(/Password/i).fill("Test@12345");
  await page.getByRole("button", { name: /Login|Accedi/i }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
  await ensureAppShellLoaded(page);

  const actionBar = page.locator(".home-hero-actions").first();
  await expect(actionBar).toBeVisible({ timeout: 15000 });
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
    }
  });
  await page.waitForTimeout(200);
  const before = await actionBar.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  expect(before.width).toBeGreaterThan(0);
  expect(before.height).toBeGreaterThan(0);
  await page.screenshot({ path: "tests/e2e/artifacts/decision-stability-before-scroll.png", fullPage: true });

  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior }));
  await page.waitForTimeout(250);
  const afterDown = await actionBar.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await expect(actionBar).toBeVisible();

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  await page.waitForTimeout(250);
  const afterUp = await actionBar.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await expect(actionBar).toBeVisible();

  await page.screenshot({ path: "tests/e2e/artifacts/decision-stability-after-scroll.png", fullPage: true });

  const driftXTopReturn = Math.abs(before.x - afterUp.x);
  const driftYTopReturn = Math.abs(before.y - afterUp.y);
  const driftWidthTopReturn = Math.abs(before.width - afterUp.width);

  expect(driftXTopReturn).toBeLessThan(2);
  expect(driftYTopReturn).toBeLessThan(2);
  expect(driftWidthTopReturn).toBeLessThan(2);
  expect(afterDown.width).toBeGreaterThan(0);
  expect(afterDown.height).toBeGreaterThan(0);
});
