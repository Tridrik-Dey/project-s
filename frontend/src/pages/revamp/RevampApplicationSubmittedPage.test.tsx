import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nContext";
import { RevampApplicationSubmittedPage } from "./RevampApplicationSubmittedPage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ auth: { token: "test-token" } })
}));

const getRevampApplicationSummaryMock = vi.fn();

vi.mock("../../api/revampApplicationApi", async () => {
  const actual = await vi.importActual("../../api/revampApplicationApi");
  return {
    ...actual,
    getRevampApplicationSummary: (...args: unknown[]) => getRevampApplicationSummaryMock(...args)
  };
});

vi.mock("../../utils/revampApplicationSession", () => ({
  saveRevampApplicationSession: vi.fn()
}));

describe("RevampApplicationSubmittedPage", () => {
  beforeEach(() => {
    getRevampApplicationSummaryMock.mockReset();
  });

  it("redirects to recap route when application is not submitted", async () => {
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

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/submitted"]}>
          <Routes>
            <Route path="/application/:applicationId/submitted" element={<RevampApplicationSubmittedPage />} />
            <Route path="/application/:applicationId/recap" element={<div>recap-route</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("recap-route")).toBeInTheDocument();
    });
  });

  it("renders confirmation when application status is SUBMITTED", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue({
      id: "app-1",
      applicantUserId: "u-1",
      registryType: "ALBO_B",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "B-2026-0009",
      currentRevision: 1,
      submittedAt: "2026-01-02T00:00:00",
      updatedAt: "2026-01-02T00:00:00"
    });

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/submitted"]}>
          <Routes>
            <Route path="/application/:applicationId/submitted" element={<RevampApplicationSubmittedPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(await screen.findByText("Candidatura inviata")).toBeInTheDocument();
    expect(screen.getByText("B-2026-0009")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copia protocollo" })).toBeEnabled();
  });
});
