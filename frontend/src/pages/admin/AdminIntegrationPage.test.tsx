import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminIntegrationPage } from "./AdminIntegrationPage";

const getSummaryMock = vi.fn();
const getHistoryMock = vi.fn();
const getLatestIntegrationMock = vi.fn();
const requestIntegrationMock = vi.fn();
const assignCaseMock = vi.fn();

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      token: "admin-token",
      role: "ADMIN"
    }
  })
}));

vi.mock("../../hooks/useAdminGovernanceRole", () => ({
  useAdminGovernanceRole: () => ({
    adminRole: "SUPER_ADMIN",
    loading: false,
    resolved: true
  })
}));

vi.mock("../../api/revampApplicationApi", () => ({
  getRevampApplicationSummary: (...args: unknown[]) => getSummaryMock(...args)
}));

vi.mock("../../api/adminReviewApi", () => ({
  getAdminReviewHistory: (...args: unknown[]) => getHistoryMock(...args),
  getLatestAdminIntegrationRequest: (...args: unknown[]) => getLatestIntegrationMock(...args),
  requestAdminIntegration: (...args: unknown[]) => requestIntegrationMock(...args),
  assignAdminReviewCase: (...args: unknown[]) => assignCaseMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/candidature/9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6/integration"]}>
      <Routes>
        <Route path="/admin/candidature/:applicationId/integration" element={<AdminIntegrationPage />} />
        <Route path="/admin/candidature/:applicationId/review" element={<div>Review destination</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminIntegrationPage", () => {
  beforeEach(() => {
    getSummaryMock.mockReset();
    getHistoryMock.mockReset();
    getLatestIntegrationMock.mockReset();
    requestIntegrationMock.mockReset();
    assignCaseMock.mockReset();
    getLatestIntegrationMock.mockResolvedValue(null);
  });

  it("updates live email preview from selected integration items", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getHistoryMock.mockResolvedValue([
      {
        id: "case-1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Cosa deve correggere o caricare");
    await user.click(screen.getByRole("checkbox", { name: /Documento di identita/i }));
    const firstEnabledInstruction = screen.getAllByPlaceholderText("Aggiungi istruzione specifica").find((input) => !(input as HTMLInputElement).disabled);
    if (!firstEnabledInstruction) throw new Error("Enabled instruction input not found");
    await user.type(firstEnabledInstruction, "Inviare fronte e retro.");
    await user.type(screen.getByLabelText("Messaggio introduttivo *"), "Integrare i documenti mancanti.");

    expect(screen.getByText(/Documento di identita: Inviare fronte e retro/i)).toBeInTheDocument();
  });

  it("submits selected items as requestedItemsJson payload", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getHistoryMock.mockResolvedValue([
      {
        id: "case-send",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    requestIntegrationMock.mockResolvedValue({
      id: "case-send",
      applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      status: "WAITING_SUPPLIER_RESPONSE",
      decision: "INTEGRATION_REQUIRED",
      updatedAt: "2026-04-16T10:00:00Z"
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Cosa deve correggere o caricare");
    await user.click(screen.getByRole("checkbox", { name: /Documento di identita/i }));
    const firstEnabledInstruction = screen.getAllByPlaceholderText("Aggiungi istruzione specifica").find((input) => !(input as HTMLInputElement).disabled);
    if (!firstEnabledInstruction) throw new Error("Enabled instruction input not found");
    await user.type(firstEnabledInstruction, "Upload PDF leggibile.");
    await user.type(screen.getByLabelText("Scadenza risposta *"), "2026-04-30");
    await user.type(screen.getByLabelText("Messaggio introduttivo *"), "Integrare entro la scadenza indicata.");
    await user.click(screen.getByRole("button", { name: "Invia richiesta" }));

    await waitFor(() => {
      expect(requestIntegrationMock).toHaveBeenCalled();
    });

    const args = requestIntegrationMock.mock.calls[0];
    expect(args[0]).toBe("case-send");
    expect(args[1]).toBe("admin-token");
    expect(args[2].dueAt).toBe("2026-04-30T23:59:00");
    expect(args[2].message).toContain("Integrare entro la scadenza");
    expect(args[2].requestedItemsJson).toContain("ID_DOCUMENT");
    expect(args[2].requestedItemsJson).toContain("Upload PDF leggibile.");
    expect(await screen.findByText("Review destination")).toBeInTheDocument();
  });

  it("loads latest open integration request in read-only mode", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "INTEGRATION_REQUIRED",
      protocolCode: "A-2026-0042",
      currentRevision: 2,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getHistoryMock.mockResolvedValue([
      {
        id: "case-open",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "WAITING_SUPPLIER_RESPONSE",
        decision: "INTEGRATION_REQUIRED",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    getLatestIntegrationMock.mockResolvedValue({
      id: "int-1",
      reviewCaseId: "case-open",
      status: "OPEN",
      dueAt: "2026-04-30T00:00:00",
      requestMessage: "Integrare documentazione.",
      requestedItemsJson: {
        items: [{ code: "ID_DOCUMENT", instruction: "Inviare documento fronte/retro." }]
      },
      updatedAt: "2026-04-16T10:00:00Z"
    });

    renderPage();
    expect(await screen.findByText(/Richiesta gia aperta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invia richiesta" })).toBeDisabled();
  });
});
