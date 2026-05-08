import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppRouter } from "./AppRouter";

type GovernanceRole = "SUPER_ADMIN" | "RESPONSABILE_ALBO" | "REVISORE" | "VIEWER" | null;

let currentGovernanceRole: GovernanceRole = "SUPER_ADMIN";
let governanceLoading = false;

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      token: "rbac-token",
      userId: "admin-id",
      email: "rbac@test.com",
      role: "ADMIN"
    },
    isAuthenticated: true
  })
}));

vi.mock("../hooks/useAdminGovernanceRole", () => ({
  useAdminGovernanceRole: () => ({
    adminRole: currentGovernanceRole,
    loading: governanceLoading,
    resolved: !governanceLoading
  })
}));

vi.mock("../components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock("../pages/admin/AdminDashboardPage", () => ({
  AdminDashboardPage: () => <div>AdminDashboardPage</div>
}));
vi.mock("../pages/admin/AdminUsersRolesPage", () => ({
  AdminUsersRolesPage: () => <div>AdminUsersRolesPage</div>
}));
vi.mock("../pages/admin/AdminInvitesPage", () => ({
  AdminInvitesPage: () => <div>AdminInvitesPage</div>
}));
vi.mock("../pages/admin/AdminQueuePage", () => ({
  AdminQueuePage: () => <div>AdminQueuePage</div>
}));
vi.mock("../pages/admin/AdminReportsPage", () => ({
  AdminReportsPage: () => <div>AdminReportsPage</div>
}));
vi.mock("../pages/admin/AdminEvaluationsPage", () => ({
  AdminEvaluationsPage: () => <div>AdminEvaluationsPage</div>
}));
vi.mock("../pages/admin/AdminApplicationCasePage", () => ({
  AdminApplicationCasePage: () => <div>AdminApplicationCasePage</div>
}));
vi.mock("../pages/admin/AdminIntegrationPage", () => ({
  AdminIntegrationPage: () => <div>AdminIntegrationPage</div>
}));
vi.mock("../pages/admin/AdminApprovalEmailTemplatePage", () => ({
  AdminApprovalEmailTemplatePage: () => <div>AdminApprovalEmailTemplatePage</div>
}));

vi.mock("../pages/auth/LoginPage", () => ({
  LoginPage: () => <div>LoginPage</div>
}));
vi.mock("../pages/auth/RegisterPage", () => ({
  RegisterPage: () => <div>RegisterPage</div>
}));
vi.mock("../pages/auth/VerifyOtpPage", () => ({
  VerifyOtpPage: () => <div>VerifyOtpPage</div>
}));
vi.mock("../pages/auth/AcceptAdminInvitePage", () => ({
  AcceptAdminInvitePage: () => <div>AcceptAdminInvitePage</div>
}));
vi.mock("../pages/home/HomePage", () => ({
  HomePage: () => <div>HomePage</div>
}));
vi.mock("../pages/legal/PrivacyPolicyPage", () => ({
  PrivacyPolicyPage: () => <div>PrivacyPolicyPage</div>
}));
vi.mock("../pages/revamp/RevampApplicationStep1Page", () => ({
  RevampApplicationStep1Page: () => <div>RevampApplicationStep1Page</div>
}));
vi.mock("../pages/revamp/RevampApplicationStep2Page", () => ({
  RevampApplicationStep2Page: () => <div>RevampApplicationStep2Page</div>
}));
vi.mock("../pages/revamp/RevampApplicationStep3Page", () => ({
  RevampApplicationStep3Page: () => <div>RevampApplicationStep3Page</div>
}));
vi.mock("../pages/revamp/RevampApplicationStep4Page", () => ({
  RevampApplicationStep4Page: () => <div>RevampApplicationStep4Page</div>
}));
vi.mock("../pages/revamp/RevampApplicationStep5Page", () => ({
  RevampApplicationStep5Page: () => <div>RevampApplicationStep5Page</div>
}));
vi.mock("../pages/revamp/RevampApplicationRecapPage", () => ({
  RevampApplicationRecapPage: () => <div>RevampApplicationRecapPage</div>
}));
vi.mock("../pages/revamp/RevampApplicationSubmittedPage", () => ({
  RevampApplicationSubmittedPage: () => <div>RevampApplicationSubmittedPage</div>
}));
vi.mock("../pages/revamp/RevampEntryPage", () => ({
  RevampEntryPage: () => <div>RevampEntryPage</div>
}));
vi.mock("../pages/revamp/RevampRegistryStartPage", () => ({
  RevampRegistryStartPage: () => <div>RevampRegistryStartPage</div>
}));
vi.mock("../pages/revamp/RevampInviteEntryPage", () => ({
  RevampInviteEntryPage: () => <div>RevampInviteEntryPage</div>
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>
  );
}

describe("AppRouter RBAC guards", () => {
  beforeEach(() => {
    currentGovernanceRole = "SUPER_ADMIN";
    governanceLoading = false;
  });

  it("allows SUPER_ADMIN to access users-roles", async () => {
    currentGovernanceRole = "SUPER_ADMIN";
    renderAt("/admin/users-roles");
    expect(await screen.findByText("AdminUsersRolesPage")).toBeInTheDocument();
  });

  it("denies RESPONSABILE_ALBO from users-roles and redirects to dashboard", async () => {
    currentGovernanceRole = "RESPONSABILE_ALBO";
    renderAt("/admin/users-roles");
    expect(await screen.findByText("AdminDashboardPage")).toBeInTheDocument();
    expect(screen.queryByText("AdminUsersRolesPage")).not.toBeInTheDocument();
  });

  it("allows RESPONSABILE_ALBO to invites", async () => {
    currentGovernanceRole = "RESPONSABILE_ALBO";
    renderAt("/admin/invites");
    expect(await screen.findByText("AdminInvitesPage")).toBeInTheDocument();
  });

  it("allows RESPONSABILE_ALBO to queue", async () => {
    currentGovernanceRole = "RESPONSABILE_ALBO";
    renderAt("/admin/queue");
    expect(await screen.findByText("AdminQueuePage")).toBeInTheDocument();
  });

  it("allows RESPONSABILE_ALBO to candidature alias route", async () => {
    currentGovernanceRole = "RESPONSABILE_ALBO";
    renderAt("/admin/candidature");
    expect(await screen.findByText("AdminQueuePage")).toBeInTheDocument();
  });

  it("denies REVISORE from invites", async () => {
    currentGovernanceRole = "REVISORE";
    renderAt("/admin/invites");
    expect(await screen.findByText("AdminDashboardPage")).toBeInTheDocument();
    expect(screen.queryByText("AdminInvitesPage")).not.toBeInTheDocument();
  });

  it("allows REVISORE to queue", async () => {
    currentGovernanceRole = "REVISORE";
    renderAt("/admin/queue");
    expect(await screen.findByText("AdminQueuePage")).toBeInTheDocument();
  });

  it("allows REVISORE to candidature review route", async () => {
    currentGovernanceRole = "REVISORE";
    renderAt("/admin/candidature/5f778f66-86a5-4f20-af9f-8610ae47656f/review");
    expect(await screen.findByText("AdminApplicationCasePage")).toBeInTheDocument();
  });

  it("allows REVISORE to candidature integration route", async () => {
    currentGovernanceRole = "REVISORE";
    renderAt("/admin/candidature/5f778f66-86a5-4f20-af9f-8610ae47656f/integration");
    expect(await screen.findByText("AdminIntegrationPage")).toBeInTheDocument();
  });

  it("denies VIEWER from queue", async () => {
    currentGovernanceRole = "VIEWER";
    renderAt("/admin/queue");
    expect(await screen.findByText("AdminDashboardPage")).toBeInTheDocument();
    expect(screen.queryByText("AdminQueuePage")).not.toBeInTheDocument();
  });

  it("denies VIEWER from users-roles", async () => {
    currentGovernanceRole = "VIEWER";
    renderAt("/admin/users-roles");
    expect(await screen.findByText("AdminDashboardPage")).toBeInTheDocument();
    expect(screen.queryByText("AdminUsersRolesPage")).not.toBeInTheDocument();
  });

  it("allows VIEWER to reports", async () => {
    currentGovernanceRole = "VIEWER";
    renderAt("/admin/reports");
    expect(await screen.findByText("AdminReportsPage")).toBeInTheDocument();
  });
});
