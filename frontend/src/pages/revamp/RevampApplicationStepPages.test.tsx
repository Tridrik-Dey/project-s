import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../../i18n/I18nContext";
import { RevampApplicationStep1Page } from "./RevampApplicationStep1Page";
import { RevampApplicationStep2Page } from "./RevampApplicationStep2Page";
import { RevampApplicationStep3Page } from "./RevampApplicationStep3Page";
import { RevampApplicationStep4Page } from "./RevampApplicationStep4Page";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ auth: { token: "test-token" } })
}));

const getRevampApplicationSummaryMock = vi.fn();
const getRevampApplicationSectionsMock = vi.fn();
const saveRevampApplicationSectionMock = vi.fn();

vi.mock("../../api/revampApplicationApi", async () => {
  const actual = await vi.importActual("../../api/revampApplicationApi");
  return {
    ...actual,
    getRevampApplicationSummary: (...args: unknown[]) => getRevampApplicationSummaryMock(...args),
    getRevampApplicationSections: (...args: unknown[]) => getRevampApplicationSectionsMock(...args),
    saveRevampApplicationSection: (...args: unknown[]) => saveRevampApplicationSectionMock(...args)
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

function section(
  sectionKey: string,
  completed: boolean,
  payloadJson = "{}",
  updatedAt = "2026-01-01T00:00:00"
) {
  return {
    id: `${sectionKey}-id`,
    applicationId: "app-1",
    sectionKey,
    sectionVersion: 1,
    completed,
    payloadJson,
    updatedAt
  };
}

describe("Revamp Step Pages", () => {
  beforeEach(() => {
    getRevampApplicationSummaryMock.mockReset();
    getRevampApplicationSectionsMock.mockReset();
    saveRevampApplicationSectionMock.mockReset();
  });

  it("renders Step 1 ALBO_A heading", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_A"));
    getRevampApplicationSectionsMock.mockResolvedValue([
      section("S1", true, JSON.stringify({ taxCode: "AAAAAA00A00A000A" }))
    ]);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/step/1"]}>
          <Routes>
            <Route path="/application/:applicationId/step/1" element={<RevampApplicationStep1Page />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(await screen.findByRole("heading", { name: "Sezione 1 - Dati Anagrafici" })).toBeInTheDocument();
  });

  it("redirects Step 2 to Step 1 when S1 is incomplete", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_A"));
    getRevampApplicationSectionsMock.mockResolvedValue([
      section("S1", false),
      section("S2", false)
    ]);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/step/2"]}>
          <Routes>
            <Route path="/application/:applicationId/step/1" element={<div>step1-route</div>} />
            <Route path="/application/:applicationId/step/2" element={<RevampApplicationStep2Page />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("step1-route")).toBeInTheDocument();
    });
  });

  it("renders Step 3A branch title for docente/formatore", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_A"));
    getRevampApplicationSectionsMock.mockResolvedValue([
      section("S1", true),
      section("S2", true, JSON.stringify({ professionalType: "DOCENTE_FORMATORE" })),
      section("S3A", true)
    ]);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/step/3"]}>
          <Routes>
            <Route path="/application/:applicationId/step/3" element={<RevampApplicationStep3Page />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(await screen.findByRole("heading", { name: "Sezione 3A - Ambiti Tematici Docente" })).toBeInTheDocument();
  });

  it("renders Step 4 ALBO_B heading", async () => {
    getRevampApplicationSummaryMock.mockResolvedValue(appSummary("ALBO_B"));
    getRevampApplicationSectionsMock.mockResolvedValue([
      section("S1", true),
      section("S2", true),
      section("S3", true),
      section("S4", false)
    ]);

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/application/app-1/step/4"]}>
          <Routes>
            <Route path="/application/:applicationId/step/4" element={<RevampApplicationStep4Page />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(await screen.findByRole("heading", { name: "Sezione 4 - Certificazioni e Accreditamenti" })).toBeInTheDocument();
  });
});
