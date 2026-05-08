import { expect, test } from "@playwright/test";
import { installMockApi } from "./helpers/mockApi";

test("support details toggle icon is not clipped when toggled", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: /Contatta il supporto|Contact support/i }).click();
  const modal = page.locator(".home-support-modal");
  await expect(modal).toBeVisible();

  const toggle = page.getByRole("button", { name: /Aggiungi nome ed email|Add name and email/i });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await page.waitForTimeout(150);
  await toggle.click();
  await page.waitForTimeout(150);

  const toggleBox = await toggle.boundingBox();
  const icon = toggle.locator("svg");
  const iconBox = await icon.boundingBox();
  expect(toggleBox).not.toBeNull();
  expect(iconBox).not.toBeNull();

  const t = toggleBox!;
  const i = iconBox!;

  // Icon must remain fully inside toggle bounds (no clipping).
  expect(i.x).toBeGreaterThanOrEqual(t.x);
  expect(i.y).toBeGreaterThanOrEqual(t.y);
  expect(i.x + i.width).toBeLessThanOrEqual(t.x + t.width);
  expect(i.y + i.height).toBeLessThanOrEqual(t.y + t.height);
});

test("send icon button is not clipped after expanding details", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: /Contatta il supporto|Contact support/i }).click();
  const modal = page.locator(".home-support-modal");
  await expect(modal).toBeVisible();

  const toggle = page.getByRole("button", { name: /Aggiungi nome ed email|Add name and email/i });
  await toggle.click();

  const sendBtn = page.locator(".home-support-send-icon-btn");
  await expect(sendBtn).toBeVisible();

  const modalBox = await modal.boundingBox();
  const buttonBox = await sendBtn.boundingBox();
  expect(modalBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();

  const m = modalBox!;
  const b = buttonBox!;

  // Must stay fully inside modal surface.
  expect(b.x).toBeGreaterThanOrEqual(m.x);
  expect(b.y).toBeGreaterThanOrEqual(m.y);
  expect(b.x + b.width).toBeLessThanOrEqual(m.x + m.width);
  expect(b.y + b.height).toBeLessThanOrEqual(m.y + m.height);
});
