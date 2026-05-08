import { expect, test } from "@playwright/test";
import { installMockApi } from "./helpers/mockApi";

test("register and submit new supplier profile without approval", async ({ page }) => {
  await installMockApi(page);
  const suffix = Date.now().toString();
  const supplierEmail = `manual_submit_${suffix}@test.com`;
  const companyName = `Atlas Procurement ${suffix}`;
  const registrationNumber = suffix.slice(-10);
  const taxId = `2${suffix.slice(-10)}`.slice(0, 11);
  const vatNumber = `3${suffix.slice(-10)}`.slice(0, 11);
  const filePath = "tests/e2e/artifacts/random-upload.pdf";

  await page.goto("/register");
  await page.getByRole("button", { name: "EN" }).click();
  await page.getByLabel("Full name").fill("Nora Esposito");
  await page.getByLabel("Email").fill(supplierEmail);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(verify-otp|supplier|supplier\/dashboard)/, { timeout: 10000 });

  if (page.url().includes("/verify-otp")) {
    await page.evaluate(() => window.sessionStorage.setItem("revamp_email_verified", "1"));
    await page.goto("/supplier/dashboard");
  }
  await expect(page.getByRole("heading", { name: "Supplier Workspace" })).toBeVisible();

  const profileForm = page.locator("form.supplier-profile-form");
  await profileForm.getByLabel("Company name").fill(companyName);
  await profileForm.getByRole("textbox", { name: "Country", exact: true }).fill("Italy");
  await profileForm.getByLabel("Trading name").fill("Atlas Procurement");
  await profileForm.getByLabel("Company type").selectOption("LLC");
  await profileForm.getByLabel("Registration number").fill(registrationNumber);
  await profileForm.getByLabel("Tax ID").fill(taxId);
  await profileForm.getByLabel("VAT number").fill(vatNumber);
  await profileForm.getByLabel("Country of incorporation").fill("Italy");
  const incorporationDateField = profileForm.locator("label", { hasText: "Incorporation date" });
  await incorporationDateField.getByRole("button", { name: /Open calendar|Apri calendario/i }).click();
  await page.getByRole("dialog", { name: /Open calendar|Apri calendario/i }).locator(".supplier-date-day-btn:not([disabled])").first().click();
  await profileForm.getByLabel("Website").fill(`https://atlas-${suffix}.example.com`);
  await profileForm.getByLabel("Employee count").selectOption("SMALL");
  await profileForm.getByLabel("Annual revenue").selectOption("_100K_500K");
  await profileForm.getByLabel("Address line 1").fill("Via Torino 58");
  await profileForm.getByLabel("Address line 2").fill("Suite 4");
  await profileForm.getByRole("textbox", { name: "City", exact: true }).fill("Turin");
  await profileForm.getByLabel(/State/i).fill("TO");
  await profileForm.getByLabel("Postal code").fill("10121");
  await profileForm.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByText("Profile updated successfully.").first()).toBeVisible();

  const wizardNav = page.locator(".supplier-wizard-steps");
  await wizardNav.getByRole("button", { name: "Categories", exact: true }).click();
  const categoryChecks = page.locator(".checkbox-grid input[type='checkbox']");
  await categoryChecks.nth(0).check();
  await categoryChecks.nth(1).check();
  await page.getByRole("button", { name: "Save Categories" }).click();
  await expect(page.getByText("Categories saved.").first()).toBeVisible();

  await wizardNav.getByRole("button", { name: "Contacts", exact: true }).click();
  const contactsPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Contacts" }) });
  await contactsPanel.getByLabel("Full name").fill("Nora Esposito");
  await contactsPanel.getByLabel("Email").fill(supplierEmail);
  await contactsPanel.getByLabel("Type").selectOption("PRIMARY");
  await contactsPanel.getByLabel("Job title").fill("Procurement Manager");
  await contactsPanel.getByLabel("Phone number").fill("3400008899");
  await contactsPanel.getByRole("button", { name: "Add Contact" }).click();
  await expect(page.getByText("Contact added.").first()).toBeVisible();

  await wizardNav.getByRole("button", { name: "Documents", exact: true }).click();
  const documentsPanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Documents" }) });
  await documentsPanel.getByLabel("Type").first().selectOption("COMPANY_PROFILE");
  const expiryDateField = documentsPanel.locator("label", { hasText: "Expiry date" });
  await expiryDateField.getByRole("button", { name: /Open calendar|Apri calendario/i }).click();
  await page.getByRole("dialog", { name: /Open calendar|Apri calendario/i }).locator(".supplier-date-day-btn:not([disabled])").first().click();
  await documentsPanel.getByLabel("Notes").fill("Submit-only E2E document");
  await documentsPanel.locator("input[type='file']").setInputFiles(filePath);
  await documentsPanel.getByRole("button", { name: "Upload Document" }).click();
  await expect(page.getByText("Document uploaded.").first()).toBeVisible();

  await page.getByRole("button", { name: "Submit Profile For Review" }).first().click();
  await expect(page.getByText("Profile submitted for validation.").first()).toBeVisible();
  await expect(page.locator(".supplier-status-badge").first()).toContainText(/Pending|PENDING/i);

  await page.screenshot({ path: "tests/e2e/artifacts/05-supplier-submitted-no-approval.png", fullPage: true });
});
