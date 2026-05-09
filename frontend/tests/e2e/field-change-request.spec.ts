/**
 * E2E test — Field Change Request (FCR) flow
 *
 * Covers:
 *  1. Approved supplier opens "Richiesta Modifica Dati" modal in the
 *     Comunicazioni tab, selects a section and writes a message → submits.
 *  2. FCR appears in the list with status PENDING_ADMIN_REVIEW.
 *  3. Admin switches context, opens the same supplier's Comunicazioni tab,
 *     sees the FCR card with Sblocca / Rifiuta buttons → clicks Sblocca.
 *  4. Supplier switches back, sees the FCR updated to UNLOCKED with the
 *     "Aggiorna Sezione S1" action button visible.
 *
 * All backend calls are intercepted with inline route mocks so this test
 * runs with only the frontend dev-server running (no real backend needed).
 */

import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

// ── IDs that stay consistent throughout the test ─────────────────────────────
const APP_ID    = "app-fcr-e2e-001";
const PROFILE_ID = "profile-fcr-e2e-001";
const FCR_ID    = "fcr-e2e-001";

const SUPPLIER_TOKEN  = "mock:usr_supplier_fcr_e2e";
const ADMIN_TOKEN     = "mock:usr_admin_fcr_e2e";

// ── In-memory FCR store shared across mocked routes ───────────────────────────
type FcrStatus =
  | "PENDING_ADMIN_REVIEW"
  | "UNLOCKED"
  | "REJECTED_BY_ADMIN"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

type Fcr = {
  id: string;
  applicationId: string;
  sectionKey: string;
  supplierMessage: string;
  status: FcrStatus;
  adminNote: string | null;
  unlockedByUserEmail: string | null;
  unlockedAt: string | null;
  submittedAt: string | null;
  beforeValueJson: string | null;
  afterValueJson: string | null;
  reviewCaseId: string | null;
  createdAt: string;
  updatedAt: string;
};

function nowIso() { return new Date().toISOString(); }
function ok<T>(data: T) { return { success: true, message: "OK", data }; }

async function body<T>(route: Route): Promise<T> {
  return JSON.parse(route.request().postData() ?? "{}") as T;
}

// ── Install all route mocks ───────────────────────────────────────────────────
async function installFcrMocks(page: Page) {
  // state
  const fcrs: Fcr[] = [];

  const handle = async (route: Route) => {
    const url  = new URL(route.request().url());
    let   path = url.pathname;
    const method = route.request().method().toUpperCase();

    // normalise v2 prefix so we can write shorter patterns
    if (path.startsWith("/api/v2/")) path = `/api/${path.slice("/api/v2/".length)}`;

    // ── supplier application summary ──────────────────────────────────────
    if (path === "/api/applications/me/latest" && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok({
          id: APP_ID, applicantUserId: "usr_supplier_fcr_e2e",
          registryType: "ALBO_A", sourceChannel: "PUBLIC",
          status: "APPROVED", protocolCode: "E2E-001",
          currentRevision: 1, submittedAt: "2025-01-01T10:00:00",
          updatedAt: nowIso()
        }))
      }); return;
    }

    // ── evaluation aggregate ──────────────────────────────────────────────
    if (path === "/api/applications/me/evaluation-aggregate" && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok({
          supplierRegistryProfileId: PROFILE_ID,
          totalEvaluations: 0, activeEvaluations: 0,
          averageOverallScore: 0, dimensionAverages: {}, scoreDistribution: {}
        }))
      }); return;
    }

    // ── sections ──────────────────────────────────────────────────────────
    if (path === `/api/applications/${APP_ID}/sections` && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok([
          { id: "sec-s1", applicationId: APP_ID, sectionKey: "S1",
            sectionVersion: 1, completed: true,
            payloadJson: JSON.stringify({ companyName: "Acme Srl", address: "Via Roma 1" }),
            updatedAt: nowIso() }
        ]))
      }); return;
    }

    // ── communications ────────────────────────────────────────────────────
    if (path === `/api/applications/${APP_ID}/communications` && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok([
          { eventKey: "revamp.application.submitted",
            message: "Candidatura inviata",
            occurredAt: "2025-01-01T10:00:00" }
        ]))
      }); return;
    }

    // ── open integration request ──────────────────────────────────────────
    if (path === `/api/applications/${APP_ID}/integration-request/open` && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok(null))
      }); return;
    }

    // ── list FCRs ─────────────────────────────────────────────────────────
    if (path === `/api/field-change-requests/applications/${APP_ID}` && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok([...fcrs]))
      }); return;
    }

    // ── create FCR ────────────────────────────────────────────────────────
    if (path === `/api/field-change-requests/applications/${APP_ID}` && method === "POST") {
      const b = await body<{ sectionKey: string; supplierMessage: string }>(route);
      const fcr: Fcr = {
        id: FCR_ID, applicationId: APP_ID,
        sectionKey: b.sectionKey, supplierMessage: b.supplierMessage,
        status: "PENDING_ADMIN_REVIEW", adminNote: null,
        unlockedByUserEmail: null, unlockedAt: null, submittedAt: null,
        beforeValueJson: null, afterValueJson: null, reviewCaseId: null,
        createdAt: nowIso(), updatedAt: nowIso()
      };
      fcrs.push(fcr);
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok(fcr))
      }); return;
    }

    // ── admin unlock FCR ──────────────────────────────────────────────────
    if (path === `/api/field-change-requests/${FCR_ID}/unlock` && method === "POST") {
      const fcr = fcrs.find((f) => f.id === FCR_ID);
      if (fcr) {
        fcr.status = "UNLOCKED";
        fcr.unlockedByUserEmail = "responsabile1@supplierplatform.com";
        fcr.unlockedAt = nowIso();
        fcr.updatedAt = nowIso();
      }
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok(fcr))
      }); return;
    }

    // ── admin reject FCR ──────────────────────────────────────────────────
    if (path === `/api/field-change-requests/${FCR_ID}/reject` && method === "POST") {
      const fcr = fcrs.find((f) => f.id === FCR_ID);
      if (fcr) { fcr.status = "REJECTED_BY_ADMIN"; fcr.updatedAt = nowIso(); }
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok(fcr))
      }); return;
    }

    // ── admin governance role ─────────────────────────────────────────────
    if (path === "/api/admin/users-roles/me" && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok({
          userId: "usr_admin_fcr_e2e",
          email: "responsabile1@supplierplatform.com",
          userRole: "ADMIN", active: true, archived: false,
          accountStatus: "ACTIVE",
          adminRoles: ["RESPONSABILE_ALBO"]
        }))
      }); return;
    }

    // ── admin profile detail ──────────────────────────────────────────────
    if (path === `/api/profiles/${PROFILE_ID}` && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok({
          id: PROFILE_ID, applicationId: APP_ID,
          supplierUserId: "usr_supplier_fcr_e2e",
          supplierEmail: "supplier@e2etest.com",
          registryType: "ALBO_A",
          status: "APPROVED", displayName: "Acme Srl",
          publicSummary: null, aggregateScore: null,
          visible: true, approvedAt: "2025-01-02T10:00:00",
          expiresAt: null, createdAt: nowIso(), updatedAt: nowIso(),
          publicCardView: null, adminCardView: null
        }))
      }); return;
    }

    if (path === `/api/profiles/${PROFILE_ID}/timeline` && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok([])) }); return;
    }

    if (path.startsWith("/api/notifications/events") && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok([])) }); return;
    }

    if (path.startsWith("/api/audit/events") && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok([])) }); return;
    }

    if (path.startsWith("/api/evaluations/summary") && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(ok({
          supplierRegistryProfileId: PROFILE_ID, totalEvaluations: 0,
          activeEvaluations: 0, averageOverallScore: 0,
          dimensionAverages: {}, scoreDistribution: {}
        }))
      }); return;
    }

    // ── dashboard realtime / SSE — return empty stream immediately ───────
    if (
      path.includes("dashboard-stream") ||
      path.includes("/dashboard-events") ||
      path.includes("sse") ||
      path.includes("/stream")
    ) {
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: "data: {}\n\n" }); return;
    }

    // ── default: return empty success ─────────────────────────────────────
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(null)) });
  };

  await page.route("http://localhost:8081/api/**",    handle);
  await page.route("http://127.0.0.1:8081/api/**",   handle);
  await page.route("http://localhost:8081/api/v2/**", handle);
  await page.route("http://127.0.0.1:8081/api/v2/**",handle);
}

// Sets initial auth before the very first navigation.
// Conditional so that switchToAdmin / switchToSupplier mid-test are not
// overwritten when the page navigates again (addInitScript runs on every load).
async function preloadSupplierAuth(page: Page) {
  await page.addInitScript((token) => {
    if (!window.localStorage.getItem("supplier_platform_auth")) {
      window.localStorage.setItem("supplier_platform_auth", JSON.stringify({
        token,
        userId: "usr_supplier_fcr_e2e",
        email: "supplier@e2etest.com",
        fullName: "Acme Srl",
        role: "SUPPLIER"
      }));
      window.sessionStorage.setItem("revamp_email_verified", "1");
    }
  }, SUPPLIER_TOKEN);
}

// Switches auth mid-test (page must have already loaded at least once)
async function switchToAdmin(page: Page) {
  await page.evaluate((token) => {
    window.localStorage.setItem("supplier_platform_auth", JSON.stringify({
      token,
      userId: "usr_admin_fcr_e2e",
      email: "responsabile1@supplierplatform.com",
      fullName: "Responsabile Uno",
      role: "ADMIN"
    }));
  }, ADMIN_TOKEN);
}

async function switchToSupplier(page: Page) {
  await page.evaluate((token) => {
    window.localStorage.setItem("supplier_platform_auth", JSON.stringify({
      token,
      userId: "usr_supplier_fcr_e2e",
      email: "supplier@e2etest.com",
      fullName: "Acme Srl",
      role: "SUPPLIER"
    }));
    window.sessionStorage.setItem("revamp_email_verified", "1");
  }, SUPPLIER_TOKEN);
}

// ── The test ──────────────────────────────────────────────────────────────────

test("FCR full flow: supplier requests → admin unlocks → supplier sees unlocked", async ({ page }) => {
  await installFcrMocks(page);
  await preloadSupplierAuth(page);

  // ── PHASE 1: Supplier dashboard loads with APPROVED status ───────────────
  await page.goto("/supplier/dashboard", { waitUntil: "domcontentloaded" });

  // Ensure dashboard renders — email injected via auth is a reliable anchor
  await expect(page.getByText("supplier@e2etest.com")).toBeVisible({ timeout: 15000 });

  await page.screenshot({ path: "tests/e2e/artifacts/fcr-01-supplier-dashboard.png", fullPage: true });

  // ── PHASE 2: Navigate to Comunicazioni tab ───────────────────────────────
  await page.getByRole("button", { name: /Comunicazioni/i }).click();
  await expect(page.getByText(/Storico comunicazioni/i)).toBeVisible({ timeout: 8000 });

  // The "Richiesta Modifica Dati" button should be visible for approved suppliers
  const requestBtn = page.getByRole("button", { name: /Richiesta Modifica Dati/i });
  await expect(requestBtn).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: "tests/e2e/artifacts/fcr-02-comunicazioni-tab.png", fullPage: true });

  // ── PHASE 3: Open modal and submit FCR ──────────────────────────────────
  await requestBtn.click();

  // Modal should appear
  const modal = page.locator(".modal-panel");
  await expect(modal).toBeVisible({ timeout: 5000 });
  await expect(modal.getByText(/Richiesta Modifica/i)).toBeVisible();

  // Select section
  await modal.locator("select#fcr-section").selectOption("S1");
  // Write message
  await modal.locator("textarea#fcr-message").fill("Ho cambiato sede legale, chiedo aggiornamento indirizzo.");

  await page.screenshot({ path: "tests/e2e/artifacts/fcr-03-modal-filled.png", fullPage: true });

  // Submit
  await modal.getByRole("button", { name: /Invia Richiesta/i }).click();

  // Modal should close after successful submit
  await expect(modal).not.toBeVisible({ timeout: 8000 });

  // ── PHASE 4: FCR appears in list with PENDING_ADMIN_REVIEW ──────────────
  await expect(page.getByText(/Richieste di modifica/i)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Sezione S1/i)).toBeVisible();
  await expect(page.getByText(/In attesa di risposta/i)).toBeVisible();

  await page.screenshot({ path: "tests/e2e/artifacts/fcr-04-pending-status.png", fullPage: true });

  // ── PHASE 5: Switch to Admin ─────────────────────────────────────────────
  await switchToAdmin(page);
  await page.goto(`/admin/albo-a/${PROFILE_ID}`, { waitUntil: "domcontentloaded" });

  // Profile must load (heading appears in multiple spots — first() avoids strict-mode error)
  await expect(page.getByText(/Acme Srl/i).first()).toBeVisible({ timeout: 15000 });

  // ── PHASE 6: Admin navigates to Comunicazioni tab ────────────────────────
  await page.getByRole("button", { name: /Comunicazioni/i }).click();

  // FCR card must appear
  await expect(page.getByText(/Richieste di modifica dati/i)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Sezione S1 — Richiesta modifica/i)).toBeVisible();
  await expect(page.getByText(/Ho cambiato sede legale/i)).toBeVisible();

  // Sblocca / Rifiuta buttons must be present
  const sbloccaBtn = page.getByRole("button", { name: /Sblocca sezione/i });
  const rifiutaBtn = page.getByRole("button", { name: /Rifiuta/i });
  await expect(sbloccaBtn).toBeVisible({ timeout: 5000 });
  await expect(rifiutaBtn).toBeVisible();

  await page.screenshot({ path: "tests/e2e/artifacts/fcr-05-admin-fcr-card.png", fullPage: true });

  // ── PHASE 7: Admin clicks Sblocca ────────────────────────────────────────
  await sbloccaBtn.click();

  // After unlock, buttons disappear and status badge changes
  await expect(sbloccaBtn).not.toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Sbloccata/i)).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: "tests/e2e/artifacts/fcr-06-admin-unlocked.png", fullPage: true });

  // ── PHASE 8: Switch back to Supplier ─────────────────────────────────────
  await switchToSupplier(page);
  await page.goto("/supplier/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("supplier@e2etest.com")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /Comunicazioni/i }).click();

  // FCR must now show UNLOCKED status and the action button
  await expect(page.locator("strong", { hasText: "Sezione S1" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Sezione sbloccata — aggiorna i tuoi dati/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: /Aggiorna Sezione S1/i })).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: "tests/e2e/artifacts/fcr-07-supplier-unlocked.png", fullPage: true });
});
