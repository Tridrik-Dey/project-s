import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nContext";
import { RevampApplicationRecapPage } from "./RevampApplicationRecapPage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ auth: { token: "test-token" } })
}));

const getRevampApplicationSummaryMock = vi.fn();
const getRevampApplicationSectionsMock = vi.fn();
const submitRevampApplicationMock = vi.fn();

vi.mock("../../api/revampApplicationApi", async () => {
  const actual = await vi.importActual("../../api/revampApplicationApi");
  return {
    ...actual,
    getRevampApplicationSummary: (...args: unknown[]) => getRevampApplicationSummaryMock(...args),
    getRevampApplicationSections: (...args: unknown[]) => getRevampApplicationSectionsMock(...args),
    submitRevampApplication: (...args: unknown[]) => submitRevampApplicationMock(...args)
  };
});

vi.mock("../../utils/revampApplicationSession", () => ({
  saveRevampApplicationSession: vi.fn()
}));

function makeSection(sectionKey: string, completed: boolean, payloadJson = "{}") {
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

describe("RevampApplicationRecapPage", () => {
  beforeEach(() => {
    getRevampApplicationSummaryMock.mockReset();
    getRevampApplicationSectionsMock.mockReset();
    submitRevampApplicationMock.mockReset();
  });

  it("redirects recap to step 5 when required sections are incomplete", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue({
      id: "app-1",
      applicantUserId: "u-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "DRAFT",
      protocolCode: null,
      currentRevision: 1,
      submittedAt: null,
      updatedAt: "2026-01-01T00:00:00"
    });
    getRevampApplicationSectionsMock.mockResolvedValue([
      makeSection("S1", true),
      makeSection("S2", true, JSON.stringify({ professionalType: "DOCENTE_FORMATORE" })),
      makeSection("S3A", true),
      makeSection("S4", true),
      makeSection("S5", false)
    ]);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/recap"]}>
          <Routes>
            <Route path="/application/:applicationId/recap" element={<RevampApplicationRecapPage />} />
            <Route path="/application/:applicationId/step/5" element={<div>step5-route</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("step5-route")).toBeInTheDocument();
    });
  });

  it("redirects recap to submitted route when status is SUBMITTED", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue({
      id: "app-1",
      applicantUserId: "u-1",
      registryType: "ALBO_B",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "B-2026-0001",
      currentRevision: 1,
      submittedAt: "2026-01-02T00:00:00",
      updatedAt: "2026-01-02T00:00:00"
    });
    getRevampApplicationSectionsMock.mockResolvedValue([
      makeSection("S1", true),
      makeSection("S2", true),
      makeSection("S3", true),
      makeSection("S4", true),
      makeSection("S5", true)
    ]);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/recap"]}>
          <Routes>
            <Route path="/application/:applicationId/recap" element={<RevampApplicationRecapPage />} />
            <Route path="/application/:applicationId/submitted" element={<div>submitted-route</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("submitted-route")).toBeInTheDocument();
    });
  });

  it("enables submit when all required sections are complete", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue({
      id: "app-1",
      applicantUserId: "u-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "DRAFT",
      protocolCode: null,
      currentRevision: 1,
      submittedAt: null,
      updatedAt: "2026-01-01T00:00:00"
    });
    getRevampApplicationSectionsMock.mockResolvedValue([
      makeSection("S1", true),
      makeSection("S2", true, JSON.stringify({ professionalType: "DOCENTE_FORMATORE" })),
      makeSection("S3A", true),
      makeSection("S4", true),
      makeSection("S5", true)
    ]);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/recap"]}>
          <Routes>
            <Route path="/application/:applicationId/recap" element={<RevampApplicationRecapPage />} />
            <Route path="/application/:applicationId/submitted" element={<div>submitted-route</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    const submitButton = await screen.findByRole("button", { name: "Invia candidatura" });
    expect(submitButton).toBeEnabled();
  });
});
