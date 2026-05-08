import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminApplicationCasePage } from "./AdminApplicationCasePage";

const getSummaryMock = vi.fn();
const getSectionsMock = vi.fn();
const getHistoryMock = vi.fn();
const getLatestIntegrationMock = vi.fn();
const saveDecisionMock = vi.fn();
const verifyCaseMock = vi.fn();
let mockedAdminRole: "SUPER_ADMIN" | "RESPONSABILE_ALBO" | "REVISORE" | "VIEWER" | null = "SUPER_ADMIN";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      token: "admin-token",
      userId: "current-admin-user",
      role: "ADMIN"
    }
  })
}));

vi.mock("../../api/revampApplicationApi", () => ({
  getRevampApplicationSummary: (...args: unknown[]) => getSummaryMock(...args),
  getRevampApplicationSections: (...args: unknown[]) => getSectionsMock(...args)
}));

vi.mock("../../api/adminReviewApi", () => ({
  getAdminReviewHistory: (...args: unknown[]) => getHistoryMock(...args),
  getLatestAdminIntegrationRequest: (...args: unknown[]) => getLatestIntegrationMock(...args),
  saveAdminReviewDecision: (...args: unknown[]) => saveDecisionMock(...args),
  verifyAdminReviewCase: (...args: unknown[]) => verifyCaseMock(...args)
}));

vi.mock("../../hooks/useAdminGovernanceRole", () => ({
  useAdminGovernanceRole: () => ({
    adminRole: mockedAdminRole,
    loading: false,
    resolved: true
  })
}));

vi.mock("../../hooks/useAdminRealtimeRefresh", () => ({
  useAdminRealtimeRefresh: () => undefined
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/candidature/9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6/review"]}>
      <Routes>
        <Route path="/admin/candidature/:applicationId/review" element={<AdminApplicationCasePage />} />
        <Route path="/admin/candidature/:applicationId/integration" element={<div>Integration destination</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminApplicationCasePage", () => {
  beforeEach(() => {
    getSummaryMock.mockReset();
    getSectionsMock.mockReset();
    getHistoryMock.mockReset();
    getLatestIntegrationMock.mockReset();
    saveDecisionMock.mockReset();
    verifyCaseMock.mockReset();
    mockedAdminRole = "SUPER_ADMIN";
    getLatestIntegrationMock.mockResolvedValue(null);
  });

  it("renders urgency pill and all three decision blocks", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-01T10:00:00Z",
      updatedAt: "2026-04-10T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([
      {
        id: "sec-1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        sectionKey: "STEP_1_ANAGRAFICA",
        sectionVersion: 1,
        completed: true,
        payloadJson: "{}",
        updatedAt: "2026-04-10T10:00:00Z"
      }
    ]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-10T10:00:00Z"
      }
    ]);

    renderPage();

    expect(await screen.findByText(/urgente/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approva$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invia richiesta al fornitore/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /non approvare/i })).toBeInTheDocument();
  });

  it("submits approve decision with reason", async () => {
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
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-approve",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        verifiedAt: "2026-04-15T08:00:00Z",
        verifiedByDisplayName: "Revisore Test",
        verificationOutcome: "COMPLIANT",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    saveDecisionMock.mockResolvedValue({
      id: "case-approve",
      applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      status: "DECIDED",
      decision: "APPROVED",
      updatedAt: "2026-04-16T10:00:00Z"
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    await user.type(screen.getByPlaceholderText("Aggiungi una nota opzionale…"), "Documentazione completa.");
    await user.click(screen.getByRole("button", { name: /approva$/i }));

    await waitFor(() => {
      expect(saveDecisionMock).toHaveBeenCalledWith("case-approve", "admin-token", {
        decision: "APPROVED",
        reason: "Documentazione completa."
      });
    });
  });

  it("allows approve decision without motivation text", async () => {
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
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-approve-empty",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        verifiedAt: "2026-04-15T08:00:00Z",
        verifiedByDisplayName: "Revisore Test",
        verificationOutcome: "COMPLIANT",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    saveDecisionMock.mockResolvedValue({
      id: "case-approve-empty",
      applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      status: "DECIDED",
      decision: "APPROVED",
      updatedAt: "2026-04-16T10:00:00Z"
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    await user.click(screen.getByRole("button", { name: /approva$/i }));

    await waitFor(() => {
      expect(saveDecisionMock).toHaveBeenCalledWith("case-approve-empty", "admin-token", {
        decision: "APPROVED",
        reason: undefined
      });
    });
  });

  it("navigates to integration page from decision action", async () => {
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
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-integration",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        verifiedAt: "2026-04-15T08:00:00Z",
        verifiedByDisplayName: "Revisore Test",
        verificationOutcome: "INCOMPLETE",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    await user.click(screen.getByRole("button", { name: /invia richiesta al fornitore/i }));

    expect(saveDecisionMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Integration destination")).toBeInTheDocument();
  });

  it("renders payload-backed candidate title and keeps viewer in read-only mode", async () => {
    mockedAdminRole = "VIEWER";
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_B",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([
      {
        id: "sec-s1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        sectionKey: "S1",
        sectionVersion: 1,
        completed: true,
        payloadJson: JSON.stringify({
          companyName: "Alpha Form SRL",
          vatNumber: "IT123",
          operationalContactEmail: "ops@alpha.test"
        }),
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-viewer",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Alpha Form SRL" })).toBeInTheDocument();
    expect(screen.getByText(/solo lettura/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approva$/i })).not.toBeInTheDocument();
  });

  it("shows latest integration-request details when available", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "INTEGRATION_REQUIRED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "WAITING_SUPPLIER_RESPONSE",
        decision: "INTEGRATION_REQUIRED",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    getLatestIntegrationMock.mockResolvedValue({
      id: "int-1",
      reviewCaseId: "case-1",
      status: "OPEN",
      dueAt: "2026-04-30T00:00:00",
      requestMessage: "Caricare i file mancanti",
      requestedItemsJson: { items: [{ code: "ID_DOCUMENT" }] },
      updatedAt: "2026-04-16T10:00:00Z"
    });

    renderPage();

    expect(await screen.findByText("Ultima richiesta al fornitore")).toBeInTheDocument();
    expect(screen.getByText(/in attesa della risposta del fornitore/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approva$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /non approvare/i })).toBeDisabled();
    expect(screen.getByText(/Caricare i file mancanti/i)).toBeInTheDocument();
  });

  it("keeps revisore limited to verify action only — no approve, reject or integration blocks", async () => {
    mockedAdminRole = "REVISORE";
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "UNDER_REVIEW",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-rev",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);

    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    expect(screen.queryByRole("button", { name: /approva$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /non approvare/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /invia richiesta al fornitore/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /segna come verificata/i })).toBeInTheDocument();
  });

  it("submits verify with COMPLIANT_WITH_RESERVATIONS outcome and required note", async () => {
    mockedAdminRole = "REVISORE";
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "UNDER_REVIEW",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-verify",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    verifyCaseMock.mockResolvedValue({
      id: "case-verify",
      applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      status: "READY_FOR_DECISION",
      decision: null,
      verifiedAt: "2026-04-16T10:00:00Z",
      verificationOutcome: "COMPLIANT_WITH_RESERVATIONS",
      updatedAt: "2026-04-16T10:00:00Z"
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    await user.click(screen.getByRole("button", { name: /segna come verificata/i }));
    await user.click(screen.getByRole("radio", { name: /conforme con riserve/i }));
    await user.type(screen.getByPlaceholderText(/scrivi qui le tue osservazioni/i), "Controllo concluso.");
    await user.click(screen.getByRole("button", { name: /conferma verifica/i }));

    await waitFor(() => {
      expect(verifyCaseMock).toHaveBeenCalledWith("case-verify", "admin-token", {
        verificationNote: "Controllo concluso.",
        verificationOutcome: "COMPLIANT_WITH_RESERVATIONS"
      });
    });
  });

  it("renders finalized case with all decision buttons disabled", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "APPROVED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-final",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "DECIDED",
        decision: "APPROVED",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);

    renderPage();

    expect(await screen.findByText(/decisione già registrata/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approva$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /invia richiesta al fornitore/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /non approvare/i })).toBeDisabled();
  });

  it("allows responsabile albo to approve even when case is assigned to another revisore", async () => {
    mockedAdminRole = "RESPONSABILE_ALBO";
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "UNDER_REVIEW",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-assigned-other",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "READY_FOR_DECISION",
        decision: null,
        assignedToUserId: "other-revisore-user",
        assignedToDisplayName: "Revisore 1",
        verifiedAt: "2026-04-15T08:00:00Z",
        verifiedByDisplayName: "Revisore 1",
        verificationOutcome: "COMPLIANT",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    saveDecisionMock.mockResolvedValue({
      id: "case-assigned-other",
      applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      status: "DECIDED",
      decision: "APPROVED",
      updatedAt: "2026-04-16T10:00:00Z"
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    await user.type(screen.getByPlaceholderText("Aggiungi una nota opzionale…"), "Verifica conclusa positivamente.");
    await user.click(screen.getByRole("button", { name: /approva$/i }));

    await waitFor(() => {
      expect(saveDecisionMock).toHaveBeenCalledWith("case-assigned-other", "admin-token", {
        decision: "APPROVED",
        reason: "Verifica conclusa positivamente."
      });
    });
  });
});
