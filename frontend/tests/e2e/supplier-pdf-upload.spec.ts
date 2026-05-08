import { expect, test } from "@playwright/test";
import { installMockApi } from "./helpers/mockApi";

test("supplier can upload PDF document from FE", async ({ page }) => {
  await installMockApi(page);
  const suffix = Date.now().toString();
  const supplierEmail = `ui_pdf_${suffix}@test.com`;
  const supplierPassword = "Test@12345";
  const filePath = "tests/e2e/artifacts/random-upload.pdf";

  await page.goto("/register");
  await page.getByRole("button", { name: "EN" }).click();
  await page.getByLabel("Full name").fill("UI PDF Supplier");
  await page.getByLabel("Email").fill(supplierEmail);
  await page.getByLabel("Password").fill(supplierPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(verify-otp|supplier|supplier\/dashboard)/, { timeout: 10000 });

  if (page.url().includes("/verify-otp")) {
    await page.evaluate(() => window.sessionStorage.setItem("revamp_email_verified", "1"));
    await page.goto("/supplier/dashboard");
  }
  await expect(page.getByRole("heading", { name: "Supplier Workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();

  await page.goto("/login");
  await page.getByRole("button", { name: "EN" }).click();
  await page.getByLabel("Email").fill(supplierEmail);
  await page.getByLabel("Password").fill(supplierPassword);
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByRole("heading", { name: "Supplier Workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Documents" }).click();

  const documentsPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Documents" }) });
  await documentsPanel.getByLabel("Type").selectOption("COMPANY_PROFILE");
  const expiryDateField = documentsPanel.locator("label", { hasText: "Expiry date" });
  await expiryDateField.getByRole("button", { name: /Open calendar|Apri calendario/i }).click();
  await page.getByRole("dialog", { name: /Open calendar|Apri calendario/i }).locator(".supplier-date-day-btn:not([disabled])").first().click();
  await documentsPanel.getByLabel("Notes").fill("Random PDF upload FE test");
  await documentsPanel.locator("input[type='file']").setInputFiles(filePath);
  await documentsPanel.getByRole("button", { name: "Upload Document" }).click();

  await expect(page.getByText("Document uploaded.").first()).toBeVisible();
  await expect(page.locator(".supplier-doc-list li").first()).toBeVisible();
  await page.screenshot({ path: "tests/e2e/artifacts/04-supplier-pdf-uploaded.png", fullPage: true });
});
