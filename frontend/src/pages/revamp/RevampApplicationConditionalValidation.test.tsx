import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nContext";
import { RevampApplicationStep2Page } from "./RevampApplicationStep2Page";
import { RevampApplicationStep3Page } from "./RevampApplicationStep3Page";
import { RevampApplicationStep5Page } from "./RevampApplicationStep5Page";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ auth: { token: "test-token" } })
}));

const getRevampApplicationSummaryMock = vi.fn();
const getRevampApplicationSectionsMock = vi.fn();
const saveRevampApplicationSectionMock = vi.fn();
const sendDeclarationOtpChallengeMock = vi.fn();
const verifyDeclarationOtpChallengeMock = vi.fn();

vi.mock("../../api/revampApplicationApi", async () => {
  const actual = await vi.importActual("../../api/revampApplicationApi");
  return {
    ...actual,
    getRevampApplicationSummary: (...args: unknown[]) => getRevampApplicationSummaryMock(...args),
    getRevampApplicationSections: (...args: unknown[]) => getRevampApplicationSectionsMock(...args),
    saveRevampApplicationSection: (...args: unknown[]) => saveRevampApplicationSectionMock(...args),
    sendDeclarationOtpChallenge: (...args: unknown[]) => sendDeclarationOtpChallengeMock(...args),
    verifyDeclarationOtpChallenge: (...args: unknown[]) => verifyDeclarationOtpChallengeMock(...args)
  };
});

vi.mock("../../utils/revampApplicationSession", () => ({
  saveRevampApplicationSession: vi.fn()
}));

function appSummary(registryType: "ALBO_A" | "ALBO_B") {
  return {
    id: "app-1",
    applicantUserId: "u-1",
    registryType,
    sourceChannel: "PUBLIC",
    status: "DRAFT",
    protocolCode: null,
    currentRevision: 1,
    submittedAt: null,
    updatedAt: "2026-01-01T00:00:00"
  };
}

function section(sectionKey: string, completed: boolean, payloadJson = "{}") {
  return {
    id: `${sectionKey}-id`,
    applicationId: "app-1",
    sectionKey,
    sectionVersion: 1,
    completed,
    payloadJson,
    updatedAt: "2026-01-01T00:00:00"
  };
}

function renderAt(route: string, element: ReactElement) {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/application/:applicationId/step/2" element={<RevampApplicationStep2Page />} />
          <Route path="/application/:applicationId/step/3" element={<RevampApplicationStep3Page />} />
          <Route path="/application/:applicationId/step/5" element={<RevampApplicationStep5Page />} />
          <Route path="/application/:applicationId/step/1" element={<div>step1-route</div>} />
          <Route path="/application/:applicationId/step/4" element={<div>step4-route</div>} />
          <Route path="/application/:applicationId/recap" element={<div>recap-route</div>} />
          <Route path={route.replace("/application/app-1", "/application/:applicationId")} element={element} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("Revamp FE Conditional Validation", () => {
  beforeEach(() => {
    getRevampApplicationSummaryMock.mockReset();
    getRevampApplicationSectionsMock.mockReset();
    saveRevampApplicationSectionMock.mockReset();
    sendDeclarationOtpChallengeMock.mockReset();
    verifyDeclarationOtpChallengeMock.mockReset();
    saveRevampApplicationSectionMock.mockResolvedValue(section("S2", false));
  });

  it("Step2 ALBO_A requires ATECO when professional type is Altro", async () => {
    const user = userEvent.setup();
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_A"));
    getRevampApplicationSectionsMock.mockResolvedValue([section("S1", true), section("S2", false)]);

    renderAt("/application/app-1/step/2", <RevampApplicationStep2Page />);

    const saveButton = await screen.findByRole("button", { name: /Salva sezione/i });
    await user.click(screen.getByRole("button", { name: /Altro/i }));
    await user.click(saveButton);

    expect(await screen.findByText("ATECO obbligatorio per tipologia Altro.")).toBeInTheDocument();
    expect(saveRevampApplicationSectionMock).toHaveBeenCalledWith(
      "app-1",
      "S2",
      expect.any(String),
      false,
      "test-token"
    );
  });

  it("Step2 ALBO_B allows optional RUNTS number when third sector type is set", async () => {
    const user = userEvent.setup();
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_B"));
    getRevampApplicationSectionsMock.mockResolvedValue([
      section("S1", true),
      section(
        "S2",
        false,
        JSON.stringify({
          employeeRange: "16_50",
          revenueBand: "R_100_500K",
          atecoPrimary: "85.59",
          operatingRegions: [{ region: "Lombardia", provincesCsv: "MI" }],
          thirdSectorType: "ETS",
          runtsNumber: ""
        })
      )
    ]);

    renderAt("/application/app-1/step/2", <RevampApplicationStep2Page />);

    await user.click(await screen.findByRole("button", { name: /Salva sezione/i }));

    expect(saveRevampApplicationSectionMock).toHaveBeenCalledWith(
      "app-1",
      "S2",
      expect.any(String),
      true,
      "test-token"
    );
  });

  it("Step3 ALBO_B requires description for selected category services", async () => {
    const user = userEvent.setup();
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_B"));
    getRevampApplicationSectionsMock.mockResolvedValue([
      section("S1", true),
      section("S2", true),
      section(
        "S3",
        false,
        JSON.stringify({
          servicesByCategory: { CAT_A: ["TRAINING_DESIGN"] },
          descriptionsByCategory: { CAT_A: "" }
        })
      )
    ]);
    saveRevampApplicationSectionMock.mockResolvedValue(section("S3", false));

    renderAt("/application/app-1/step/3", <RevampApplicationStep3Page />);

    await user.click(await screen.findByRole("button", { name: /Salva sezione/i }));

    expect(await screen.findByText("Descrizione servizi obbligatoria.")).toBeInTheDocument();
    expect(saveRevampApplicationSectionMock).toHaveBeenCalledWith(
      "app-1",
      "S3",
      expect.any(String),
      false,
      "test-token"
    );
  });

  it("Step5 ALBO_A enforces D.Lgs 81 when in-presence teaching is detected", async () => {
    const user = userEvent.setup();
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_A"));
    getRevampApplicationSectionsMock.mockResolvedValue([
      section("S1", true),
      section("S2", true, JSON.stringify({ professionalType: "DOCENTE_FORMATORE" })),
      section("S3A", true, JSON.stringify({ experiences: [{ deliveryMode: "IN_PRESENCE" }] })),
      section("S4", true),
      section(
        "S5",
        false,
        JSON.stringify({
          truthfulnessDeclaration: true,
          noConflictOfInterest: true,
          noCriminalConvictions: true,
          privacyAccepted: true,
          ethicalCodeAccepted: true,
          qualityEnvSafetyAccepted: true,
          alboDataProcessingConsent: true,
          marketingConsent: false,
          dlgs81ComplianceWhenInPresence: false,
          otpVerified: true
        })
      )
    ]);

    renderAt("/application/app-1/step/5", <RevampApplicationStep5Page />);

    const readyButton = await screen.findByRole("button", { name: /Pronto per invio candidatura/i });
    expect(screen.getByText(/D\.Lgs\. 81\/2008.*obbligatorio/i)).toBeInTheDocument();
    expect(readyButton).toBeDisabled();

    await user.click(screen.getByLabelText(/D\.Lgs\. 81\/2008.*obbligatorio/i));
    await waitFor(() => expect(readyButton).toBeEnabled());
  });

  it("Step5 ALBO_A keeps D.Lgs 81 optional when no in-presence evidence exists", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_A"));
    getRevampApplicationSectionsMock.mockResolvedValue([
      section("S1", true),
      section("S2", true, JSON.stringify({ professionalType: "DOCENTE_FORMATORE" })),
      section("S3A", true, JSON.stringify({ experiences: [{ deliveryMode: "ONLINE" }] })),
      section("S4", true),
      section(
        "S5",
        false,
        JSON.stringify({
          truthfulnessDeclaration: true,
          noConflictOfInterest: true,
          noCriminalConvictions: true,
          privacyAccepted: true,
          ethicalCodeAccepted: true,
          qualityEnvSafetyAccepted: true,
          alboDataProcessingConsent: true,
          marketingConsent: false,
          dlgs81ComplianceWhenInPresence: false,
          otpVerified: true
        })
      )
    ]);

    renderAt("/application/app-1/step/5", <RevampApplicationStep5Page />);

    expect(await screen.findByText(/D\.Lgs\. 81\/2008.*facoltativo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pronto per invio candidatura/i })).toBeEnabled();
  });
});
