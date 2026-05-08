import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminInvitesPage } from "./AdminInvitesPage";

const getAdminInviteMonitorMock = vi.fn();
const renewAdminInviteMock = vi.fn();
const createAdminInviteMock = vi.fn();
const resendAdminInviteMock = vi.fn();
const updateAdminInviteMock = vi.fn();

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      token: "admin-token",
      role: "ADMIN",
      email: "mario.rossi@test.it"
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

vi.mock("../../api/adminInviteApi", () => ({
  getAdminInviteMonitor: (...args: unknown[]) => getAdminInviteMonitorMock(...args),
  renewAdminInvite: (...args: unknown[]) => renewAdminInviteMock(...args),
  createAdminInvite: (...args: unknown[]) => createAdminInviteMock(...args),
  resendAdminInvite: (...args: unknown[]) => resendAdminInviteMock(...args),
  updateAdminInvite: (...args: unknown[]) => updateAdminInviteMock(...args)
}));

describe("AdminInvitesPage", () => {
  beforeEach(() => {
    getAdminInviteMonitorMock.mockReset();
    renewAdminInviteMock.mockReset();
    createAdminInviteMock.mockReset();
    resendAdminInviteMock.mockReset();
    updateAdminInviteMock.mockReset();
  });

  it("renders invite KPIs and monitor rows in manage mode", async () => {
    getAdminInviteMonitorMock.mockResolvedValue({
      totalInvites: 12,
      completedInvites: 7,
      pendingInvites: 3,
      expiredInvites: 2,
      rows: [
        {
          id: "invite-1",
          invitedName: "Bianchi Marco",
          invitedEmail: "m.bianchi@email.it",
          registryType: "ALBO_A",
          inviteStatus: "CONSUMED",
          uiStatus: "COMPLETATO",
          progressPercent: 100,
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          invitedByName: "Mario Rossi",
          applicationId: "app-1",
          profilePath: "/admin/candidature/app-1/review",
          canRenew: false,
          canOpenProfile: true
        }
      ]
    });

    render(
      <MemoryRouter>
        <AdminInvitesPage mode="manage" />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Inviti" })).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Bianchi Marco")).toBeInTheDocument();
    expect(screen.getByLabelText("Avanzamento 100%")).toBeInTheDocument();
  });

  it("renews expired invites and creates a new invite in new mode", async () => {
    getAdminInviteMonitorMock.mockResolvedValue({
      totalInvites: 1,
      completedInvites: 0,
      pendingInvites: 0,
      expiredInvites: 1,
      rows: [
        {
          id: "invite-expired",
          invitedName: "Gamma SRL",
          invitedEmail: "info@gamma.it",
          registryType: "ALBO_B",
          inviteStatus: "EXPIRED",
          uiStatus: "SCADUTO",
          progressPercent: 0,
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          invitedByName: "Mario Rossi",
          applicationId: null,
          profilePath: null,
          canRenew: true,
          canOpenProfile: false
        }
      ]
    });
    renewAdminInviteMock.mockResolvedValue({
      id: "invite-renewed",
      token: "renewed-token",
      status: "CREATED",
      registryType: "ALBO_B",
      invitedEmail: "info@gamma.it",
      expiresAt: new Date().toISOString()
    });
    createAdminInviteMock.mockResolvedValue({
      id: "invite-created",
      token: "new-token",
      status: "CREATED",
      registryType: "ALBO_A",
      invitedEmail: "viewer@example.com",
      expiresAt: new Date().toISOString()
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminInvitesPage mode="manage" />
      </MemoryRouter>
    );

    await screen.findByText("Gamma SRL");
    await user.click(screen.getByRole("button", { name: /Gamma SRL/ }));
    await user.click(await screen.findByRole("button", { name: "Rinnova invito" }));
    await waitFor(() => expect(renewAdminInviteMock).toHaveBeenCalledWith("invite-expired", "admin-token", { expiresInDays: 30 }));

    render(
      <MemoryRouter>
        <AdminInvitesPage mode="new" />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Nome *"), "Luca");
    await user.type(screen.getByLabelText("Cognome *"), "Verdi");
    await user.type(screen.getByLabelText("E-mail destinatario *"), "viewer@example.com");
    await user.click(screen.getByRole("button", { name: "Invia invito" }));

    await waitFor(() => expect(createAdminInviteMock).toHaveBeenCalled());
  });
});
