import { expect, test } from "@playwright/test";
import { installMockApi } from "./helpers/mockApi";

test("support modal opens bottom-right and stays fully visible", async ({ page }) => {
  await installMockApi(page);
  await page.goto("/");

  const supportTrigger = page.getByRole("button", { name: /Contatta il supporto|Contact support/i });
  await expect(supportTrigger).toBeVisible();
  await supportTrigger.click();

  const modal = page.locator(".home-support-modal");
  await expect(modal).toBeVisible();

  const box = await modal.boundingBox();
  expect(box).not.toBeNull();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const b = box!;
  const v = viewport!;

  // Fully inside viewport (not clipped).
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(v.width);
  expect(b.y + b.height).toBeLessThanOrEqual(v.height);

  // Anchored to bottom-right corner area.
  const rightGap = v.width - (b.x + b.width);
  const bottomGap = v.height - (b.y + b.height);
  expect(b.x).toBeGreaterThan(v.width * 0.45);
  expect(rightGap).toBeLessThanOrEqual(24);
  expect(bottomGap).toBeLessThanOrEqual(24);
});
