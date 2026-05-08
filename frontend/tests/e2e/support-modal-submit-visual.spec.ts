import { expect, test } from "@playwright/test";
import { installMockApi } from "./helpers/mockApi";

test("support send button remains fully visible after submit click", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: /Contatta il supporto|Contact support/i }).click();
  const modal = page.locator(".home-support-modal");
  await expect(modal).toBeVisible();

  await page.locator(".home-support-topic-chip").first().click();
  await page.getByLabel(/Messaggio|Message/i).fill("Test support message from Playwright");
  await page.getByRole("button", { name: /Aggiungi nome ed email|Add name and email/i }).click();
  await page.getByLabel(/Nome|Name/i).fill("Playwright User");
  await page.getByLabel(/^Email$/i).fill("playwright@example.com");

  const sendBtn = page.locator(".home-support-send-icon-btn");
  await expect(sendBtn).toBeVisible();
  const modalBoxBefore = await modal.boundingBox();
  const buttonBoxBefore = await sendBtn.boundingBox();
  expect(modalBoxBefore).not.toBeNull();
  expect(buttonBoxBefore).not.toBeNull();

  const mBefore = modalBoxBefore!;
  const bBefore = buttonBoxBefore!;
  expect(bBefore.x).toBeGreaterThanOrEqual(mBefore.x);
  expect(bBefore.y).toBeGreaterThanOrEqual(mBefore.y);
  expect(bBefore.x + bBefore.width).toBeLessThanOrEqual(mBefore.x + mBefore.width);
  expect(bBefore.y + bBefore.height).toBeLessThanOrEqual(mBefore.y + mBefore.height);

  await sendBtn.click();

  // Wait for visual response (toast or loading transition).
  await page.waitForTimeout(600);

  // On success the modal may auto-close; accept either:
  // 1) modal still open with button visible and unclipped, or
  // 2) success toast shown and modal closed.
  if (await modal.isVisible().catch(() => false)) {
    const modalBoxAfter = await modal.boundingBox();
    const buttonBoxAfter = await sendBtn.boundingBox();
    expect(modalBoxAfter).not.toBeNull();
    expect(buttonBoxAfter).not.toBeNull();
    const mAfter = modalBoxAfter!;
    const bAfter = buttonBoxAfter!;
    expect(bAfter.x).toBeGreaterThanOrEqual(mAfter.x);
    expect(bAfter.y).toBeGreaterThanOrEqual(mAfter.y);
    expect(bAfter.x + bAfter.width).toBeLessThanOrEqual(mAfter.x + mAfter.width);
    expect(bAfter.y + bAfter.height).toBeLessThanOrEqual(mAfter.y + mAfter.height);
  } else {
    await expect(page.getByText(/richiesta supporto inviata|support request sent/i)).toBeVisible();
  }

  await page.screenshot({ path: "tests/e2e/artifacts/support-modal-submit-visual.png", fullPage: true });
});
