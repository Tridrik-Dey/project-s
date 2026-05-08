import { expect, test } from "@playwright/test";

type SectionSnapshot = {
  id: string;
  applicationId: string;
  sectionKey: string;
  sectionVersion: number;
  completed: boolean;
  payloadJson: string;
  updatedAt: string;
};

function isWizardEnabled(): boolean {
  const raw = (process.env.VITE_FEATURE_NEW_WIZARD_AB ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

test("revamp wizard happy path (step1 to submitted)", async ({ page }) => {
  test.skip(!isWizardEnabled(), "Set VITE_FEATURE_NEW_WIZARD_AB=true to run revamp e2e flow.");

  const applicationId = "app-e2e-1";
  const applicantUserId = "usr-e2e-1";
  const challengeId = "challenge-e2e-1";
  const protocolCode = "A-2026-0001";

  let status = "DRAFT";
  const ok = <T,>(data: T, message = "OK") => ({ success: true, message, data });
  const sections = new Map<string, SectionSnapshot>([
    ["S1", { id: "s1", applicationId, sectionKey: "S1", sectionVersion: 1, completed: false, payloadJson: "{}", updatedAt: new Date().toISOString() }],
    ["S2", { id: "s2", applicationId, sectionKey: "S2", sectionVersion: 1, completed: false, payloadJson: "{}", updatedAt: new Date().toISOString() }],
    ["S3A", { id: "s3a", applicationId, sectionKey: "S3A", sectionVersion: 1, completed: false, payloadJson: "{}", updatedAt: new Date().toISOString() }],
    ["S3B", { id: "s3b", applicationId, sectionKey: "S3B", sectionVersion: 1, completed: false, payloadJson: "{}", updatedAt: new Date().toISOString() }],
    ["S3", { id: "s3", applicationId, sectionKey: "S3", sectionVersion: 1, completed: false, payloadJson: "{}", updatedAt: new Date().toISOString() }],
    ["S4", { id: "s4", applicationId, sectionKey: "S4", sectionVersion: 1, completed: false, payloadJson: "{}", updatedAt: new Date().toISOString() }],
    ["S5", { id: "s5", applicationId, sectionKey: "S5", sectionVersion: 1, completed: false, payloadJson: "{}", updatedAt: new Date().toISOString() }]
  ]);

  await page.addInitScript(({ userId }) => {
    window.localStorage.setItem("supplier_platform_auth", JSON.stringify({
      token: `mock:${userId}`,
      userId,
      email: "revamp.e2e@test.com",
      fullName: "Revamp E2E User",
      role: "SUPPLIER"
    }));
    window.sessionStorage.setItem("revamp_email_verified", "1");
  }, { userId: applicantUserId });

  const handler = async (route: Parameters<Parameters<typeof page.route>[1]>[0]) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;
    const now = new Date().toISOString();

    const appMatch = path.match(/^\/api(?:\/v2)?\/applications\/([^/]+)(?:\/(.*))?$/);
    if (appMatch) {
      const appId = appMatch[1];
      const tail = appMatch[2] ?? "";
      if (appId !== applicationId) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Not found" }) });
        return;
      }

      if (tail === "" && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(ok({
            id: applicationId,
            applicantUserId,
            registryType: "ALBO_A",
            sourceChannel: "PUBLIC",
            status,
            protocolCode: status === "SUBMITTED" ? protocolCode : null,
            currentRevision: 1,
            submittedAt: status === "SUBMITTED" ? now : null,
            updatedAt: now
          }))
        });
        return;
      }

      if (tail === "sections" && method === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(Array.from(sections.values()))) });
        return;
      }

      if (tail.startsWith("sections/") && method === "PUT") {
        const sectionKey = decodeURIComponent(tail.slice("sections/".length));
        const payload = JSON.parse(request.postData() || "{}") as { payloadJson: string; completed: boolean };
        const prev = sections.get(sectionKey);
        const next: SectionSnapshot = {
          id: prev?.id ?? `s-${sectionKey.toLowerCase()}`,
          applicationId,
          sectionKey,
          sectionVersion: 1,
          completed: Boolean(payload.completed),
          payloadJson: payload.payloadJson ?? "{}",
          updatedAt: now
        };
        sections.set(sectionKey, next);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok(next)) });
        return;
      }

      if (tail === "submit" && method === "POST") {
        status = "SUBMITTED";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(ok({
            id: applicationId,
            applicantUserId,
            registryType: "ALBO_A",
            sourceChannel: "PUBLIC",
            status,
            protocolCode,
            currentRevision: 1,
            submittedAt: now,
            updatedAt: now
          }))
        });
        return;
      }
    }

    if (path.match(/^\/api(?:\/v2)?\/otp-challenges\/declaration\/send$/) && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ok({
          challengeId,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          status: "PENDING",
          deliveryMode: "SIMULATED",
          targetEmailMasked: "r***@test.com",
          debugCode: "123456"
        }))
      });
      return;
    }

    if (path.match(/^\/api(?:\/v2)?\/otp-challenges\/declaration\/verify$/) && method === "POST") {
      const payload = JSON.parse(request.postData() || "{}") as { challengeId: string; otpCode: string };
      const verified = payload.challengeId === challengeId && payload.otpCode === "123456";
      await route.fulfill({
        status: verified ? 200 : 400,
        contentType: "application/json",
        body: JSON.stringify(ok({
          challengeId,
          verified,
          status: verified ? "VERIFIED" : "FAILED",
          attempts: 1,
          maxAttempts: 3,
          verifiedAt: verified ? now : null
        }))
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ok({})) });
  };

  await page.route("http://localhost:8081/api/**", handler);
  await page.route("http://127.0.0.1:8081/api/**", handler);

  await page.goto(`/application/${applicationId}/step/1`);
  await expect(page.getByRole("heading", { name: "Sezione 1 - Dati Anagrafici" })).toBeVisible();

  await page.getByLabel("Codice fiscale *").fill("RSSMRA85T10A562S");
  await page.getByLabel("Telefono *").fill("3470001122");
  await page.getByLabel("Comune *").fill("Milano");
  await page.getByLabel("Provincia *").fill("MI");
  await page.getByLabel("CAP *").fill("20100");
  await page.getByRole("button", { name: "Salva sezione" }).click();
  await page.getByRole("link", { name: "Vai a Sezione 2" }).click();

  await expect(page.getByRole("heading", { name: "Sezione 2 - Tipologia Professionale" })).toBeVisible();
  await page.getByRole("button", { name: /Docente \/ Formatore|Teacher \/ Trainer/i }).click();
  await page.getByRole("button", { name: "Salva sezione" }).click();
  await page.getByRole("link", { name: "Vai a Sezione 3" }).click();

  await expect(page.getByRole("heading", { name: "Sezione 3A - Ambiti Tematici Docente" })).toBeVisible();
  await page.getByLabel("Ambiti tematici (CSV) *").fill("formazione,orientamento");
  await page.getByLabel("Anni di esperienza *").fill("8");
  await page.getByLabel("Presentazione professionale *").fill("Esperienza consolidata in docenza.");
  await page.getByRole("button", { name: "Salva sezione" }).click();
  await page.getByRole("link", { name: "Vai a Sezione 4" }).click();

  await expect(page.getByRole("heading", { name: "Sezione 4 - Capacita e Referenze" })).toBeVisible();
  await page.getByLabel("Capacita operative *").fill("Gestione classi e progettazione didattica.");
  await page.getByLabel("Referenze sintetiche *").fill("Referenze su progetti formativi pluriennali.");
  await page.getByRole("button", { name: "Salva sezione" }).click();
  await page.getByRole("link", { name: "Vai a Sezione 5" }).click();

  await expect(page.getByRole("heading", { name: "Sezione 5 - Dichiarazioni e Consensi" })).toBeVisible();
  await page.getByLabel("Dichiaro la veridicita delle informazioni fornite.").check();
  await page.getByLabel("Dichiaro assenza di conflitto di interessi.").check();
  await page.getByLabel("Accetto Privacy Policy (GDPR).").check();
  await page.getByLabel("Accetto Codice Etico del Gruppo.").check();
  await page.getByLabel("Accetto standard qualita/ambiente/sicurezza.").check();

  await page.getByRole("button", { name: "Invia OTP" }).click();
  await page.getByLabel("Codice OTP a 6 cifre *").fill("123456");
  await page.getByRole("button", { name: "Verifica OTP" }).click();
  await expect(page.getByText("OTP verificato con successo.")).toBeVisible();

  await page.getByRole("button", { name: "Salva sezione" }).click();
  await page.getByRole("link", { name: "Vai al riepilogo" }).click();
  await expect(page.getByRole("heading", { name: "Riepilogo pre-invio candidatura" })).toBeVisible();

  await page.getByRole("button", { name: "Invia candidatura" }).click();
  await expect(page.getByRole("heading", { name: "Candidatura inviata" })).toBeVisible();
  await expect(page.getByText(protocolCode)).toBeVisible();
});
