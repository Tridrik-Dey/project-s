import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  ClipboardCheck,
  Eye,
  FileSearch,
  Filter,
  KeyRound,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X
} from "lucide-react";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import { HttpError } from "../../api/http";
import { getAdminAuditEvents, type AdminAuditEventRow } from "../../api/adminAuditApi";
import {
  assignAdminUserRole,
  archiveAdminUser,
  createAdminUserInvite,
  deactivateAdminUser,
  getAdminUsersRoles,
  getMyAdminUsersRolesProfile,
  reactivateAdminUser,
  resendAdminUserInvite,
  revokeAdminUserRole,
  type AdminRole,
  type AdminAccountStatus,
  type AdminUserRoleRow,
  type CreateAdminUserInvitePayload
} from "../../api/adminUsersRolesApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

const ADMIN_ROLES: readonly AdminRole[] = ["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"] as const;
const ACCOUNT_STATUSES: readonly Exclude<AdminAccountStatus, "ARCHIVED">[] = ["ACTIVE", "INVITE_PENDING", "INVITE_EXPIRED", "DEACTIVATED"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shouldRefreshAdminUsers(event: DashboardActivityEvent): boolean {
  const key = event.eventKey ?? "";
  return key.startsWith("revamp.admin-") || event.entityType === "REVAMP_USER_ADMIN_ROLE";
}

function roleLabel(role: AdminRole): string {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "RESPONSABILE_ALBO") return "Responsabile Albo";
  if (role === "REVISORE") return "Revisore";
  return "Viewer";
}

function roleLabelShort(role: AdminRole): string {
  if (role === "SUPER_ADMIN") return "S. Admin";
  if (role === "RESPONSABILE_ALBO") return "Resp. Albo";
  if (role === "REVISORE") return "Revisore";
  return "Viewer";
}

function formatStateJson(raw: string | null | undefined): string {
  if (!raw) return "{}";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function parseAuditRole(raw: string | null | undefined): AdminRole | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { role?: AdminRole | null };
    return parsed.role ?? null;
  } catch {
    return null;
  }
}

function auditActionLabel(eventKey: string): string {
  if (eventKey === "revamp.admin-role.assigned") return "Ruolo aggiornato";
  if (eventKey === "revamp.admin-role.revoked") return "Ruolo rimosso";
  if (eventKey === "revamp.admin-user.deactivated") return "Account disattivato";
  if (eventKey === "revamp.admin-user.reactivated") return "Account riattivato";
  if (eventKey === "revamp.admin-user.archived") return "Account archiviato";
  return "Aggiornamento permessi";
}

function auditChangeText(event: AdminAuditEventRow): string {
  const beforeRole = parseAuditRole(event.beforeStateJson);
  const afterRole = parseAuditRole(event.afterStateJson);
  if (beforeRole && afterRole && beforeRole !== afterRole) {
    return `Da ${roleLabel(beforeRole)} a ${roleLabel(afterRole)}`;
  }
  if (!beforeRole && afterRole) {
    return `Assegnato ${roleLabel(afterRole)}`;
  }
  if (beforeRole && !afterRole) {
    return `Rimosso ${roleLabel(beforeRole)}`;
  }
  if (event.eventKey === "revamp.admin-user.deactivated") return "Accesso sospeso temporaneamente";
  if (event.eventKey === "revamp.admin-user.reactivated") return "Accesso ripristinato";
  if (event.eventKey === "revamp.admin-user.archived") return "Account archiviato senza cancellare lo storico";
  return "Dettaglio modifica disponibile nel JSON";
}

function accountStatusLabel(row: AdminUserRoleRow): string {
  if (row.accountStatus === "ARCHIVED") return "ARCHIVIATO";
  if (row.accountStatus === "INVITE_PENDING") return "INVITO IN ATTESA";
  if (row.accountStatus === "INVITE_EXPIRED") return "INVITO SCADUTO";
  if (row.accountStatus === "DEACTIVATED") return "DISATTIVATO";
  return "ATTIVO";
}

function accountStatusClass(row: AdminUserRoleRow): string {
  if (row.accountStatus === "ARCHIVED") return "admin-settings-chip archived";
  if (row.accountStatus === "INVITE_PENDING") return "admin-settings-chip pending";
  if (row.accountStatus === "INVITE_EXPIRED") return "admin-settings-chip expired";
  if (row.accountStatus === "DEACTIVATED") return "admin-settings-chip inactive";
  return "admin-settings-chip active";
}

function roleToneClass(role: AdminRole): string {
  return `role-tone-${role.toLowerCase().replace(/_/g, "-")}`;
}

function roleKpiIcon(role: AdminRole) {
  if (role === "SUPER_ADMIN") return <ShieldCheck className="h-4 w-4" />;
  if (role === "RESPONSABILE_ALBO") return <ClipboardCheck className="h-4 w-4" />;
  if (role === "REVISORE") return <FileSearch className="h-4 w-4" />;
  return <Eye className="h-4 w-4" />;
}

export function AdminUsersRolesPage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole, loading: roleLoading } = useAdminGovernanceRole();
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | null>(null);
  const [statusFilter, setStatusFilter] = useState<Exclude<AdminAccountStatus, "ARCHIVED"> | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [rows, setRows] = useState<AdminUserRoleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [selectedAuditUserId, setSelectedAuditUserId] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AdminAuditEventRow[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteFormClosing, setInviteFormClosing] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<CreateAdminUserInvitePayload>({
    email: "",
    adminRole: "VIEWER",
    expiresInDays: 7
  });
  const [archivePendingRow, setArchivePendingRow] = useState<AdminUserRoleRow | null>(null);
  const [lastInvite, setLastInvite] = useState<{
    email: string;
    role: AdminRole;
    expiresAt: string;
    activationUrl: string;
  } | null>(null);
  const auditPanelRef = useRef<HTMLDivElement | null>(null);
  const usersTablePanelRef = useRef<HTMLDivElement | null>(null);
  const inviteFormRef = useRef<HTMLFormElement | null>(null);
  const inviteToggleRef = useRef<HTMLButtonElement | null>(null);
  const usersRefreshInFlightRef = useRef(false);
  const usersRefreshQueuedRef = useRef(false);

  function resetInviteDraft() {
    setInviteDraft({
      email: "",
      adminRole: "VIEWER",
      expiresInDays: 7
    });
  }

  function openInviteForm() {
    setLastInvite(null);
    setInviteFormClosing(false);
    setShowInviteForm(true);
  }

  function closeInviteForm() {
    if (!showInviteForm) return;
    setInviteFormClosing(true);
    setShowInviteForm(false);
  }

  async function loadUsers(search?: string) {
    if (!token) return;
    if (usersRefreshInFlightRef.current) {
      usersRefreshQueuedRef.current = true;
      return;
    }

    usersRefreshInFlightRef.current = true;
    setLoading(true);
    try {
      const data = await getAdminUsersRoles(token, search, includeArchived);
      let nextRows = data;
      if (!includeArchived && auth?.userId && !data.some((row) => row.userId === auth.userId)) {
        try {
          const currentAdmin = await getMyAdminUsersRolesProfile(token);
          if (
            currentAdmin.userId === auth.userId &&
            currentAdmin.adminRoles.includes("SUPER_ADMIN") &&
            !currentAdmin.archived
          ) {
            nextRows = [currentAdmin, ...data];
          }
        } catch {
          // Keep the filtered list if the current admin profile cannot be loaded.
        }
      }
      setRows(nextRows);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento utenti/ruoli non riuscito.";
      setToast({ message, type: "error" });
      setRows([]);
    } finally {
      usersRefreshInFlightRef.current = false;
      setLoading(false);
      if (usersRefreshQueuedRef.current) {
        usersRefreshQueuedRef.current = false;
        void loadUsers(search ?? activeQuery);
      }
    }
  }

  useEffect(() => {
    void loadUsers(activeQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeQuery, includeArchived]);

  useEffect(() => {
    const nextQuery = queryInput.trim();
    const handle = window.setTimeout(() => {
      setActiveQuery(nextQuery);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [queryInput]);

  useAdminRealtimeRefresh({
    token,
    enabled: adminRole === "SUPER_ADMIN",
    shouldRefresh: shouldRefreshAdminUsers,
    onRefresh: async () => {
      await loadUsers(activeQuery);
      if (selectedAuditUserId) {
        await loadAuditForUser(selectedAuditUserId);
      }
    }
  });

  useEffect(() => {
    if (!showInviteForm) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (inviteFormRef.current?.contains(target)) return;
      if (inviteToggleRef.current?.contains(target)) return;
      closeInviteForm();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showInviteForm]);

  useEffect(() => {
    if (!selectedAuditUserId) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (usersTablePanelRef.current?.contains(target)) return;
      if (auditPanelRef.current?.contains(target)) return;
      setSelectedAuditUserId(null);
      setAuditRows([]);
      setAuditLoading(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selectedAuditUserId]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const roleMatches = roleFilter ? row.adminRoles.includes(roleFilter) : true;
      const statusMatches = statusFilter ? row.accountStatus === statusFilter : true;
      return roleMatches && statusMatches;
    });
  }, [roleFilter, rows, statusFilter]);

  const displayRows = useMemo(() => {
    const currentUserId = auth?.userId;
    if (!currentUserId) return filteredRows;
    const ownRow = rows.find((row) => row.userId === currentUserId);
    if (!ownRow || ownRow.archived || includeArchived) return filteredRows;
    return [ownRow, ...filteredRows.filter((row) => row.userId !== currentUserId)];
  }, [auth?.userId, filteredRows, includeArchived, rows]);

  const stats = useMemo(() => {
    const total = displayRows.length;
    const active = displayRows.filter((r) => r.active).length;
    const withRoles = displayRows.filter((r) => r.adminRoles.length > 0).length;
    return { total, active, withRoles };
  }, [displayRows]);

  const roleStats = useMemo(() =>
    ADMIN_ROLES.map((role) => ({
      role,
      count: displayRows.filter((r) => r.adminRoles.includes(role)).length
    })),
  [displayRows]);

  const settingsKpis = useMemo(() => {
    const activeLevel = stats.total === 0 ? "info" : stats.active === stats.total ? "ok" : "attention";
    const roleLevel = stats.withRoles === 0 ? "attention" : "ok";

    return [
      {
        id: "total",
        title: "Utenti trovati",
        value: stats.total,
        icon: <Users className="h-4 w-4" />,
        trend: activeQuery || roleFilter || statusFilter ? "filtro attivo" : "totale lista",
        tone: "info",
        level: "info",
        levelLabel: stats.total === 0 ? "Vuoto" : "Operativo"
      },
      {
        id: "active",
        title: "Utenti attivi",
        value: stats.active,
        icon: <UserCheck className="h-4 w-4" />,
        trend: "abilitati",
        tone: "ok",
        level: activeLevel,
        levelLabel: stats.total === 0 ? "Vuoto" : stats.active === stats.total ? "Completo" : "Verificare"
      },
      {
        id: "with-roles",
        title: "Con ruoli",
        value: stats.withRoles,
        icon: <KeyRound className="h-4 w-4" />,
        trend: "governance",
        tone: "info",
        level: roleLevel,
        levelLabel: stats.withRoles === 0 ? "Da assegnare" : "Presente"
      },
      ...roleStats.map((item) => ({
        id: item.role,
        title: roleLabel(item.role),
        value: item.count,
        icon: roleKpiIcon(item.role),
        trend: "ruolo",
        tone: "ok",
        level: item.count > 0 ? "ok" : "info",
        levelLabel: item.count > 0 ? "Assegnato" : "Vuoto"
      }))
    ] as const;
  }, [activeQuery, roleFilter, roleStats, stats, statusFilter]);

  const filterLabel = useMemo(() => {
    if (!roleFilter && !statusFilter) return "Tutti";
    return [roleFilter ? roleLabelShort(roleFilter) : null, statusFilter ? accountStatusLabel({ accountStatus: statusFilter } as AdminUserRoleRow) : null]
      .filter(Boolean)
      .join(" + ");
  }, [roleFilter, statusFilter]);

  const selectedAuditUser = useMemo(
    () => rows.find((r) => r.userId === selectedAuditUserId) ?? null,
    [rows, selectedAuditUserId]
  );

  async function onToggleRole(row: AdminUserRoleRow, role: AdminRole) {
    if (!token || busyKey) return;
    if (!UUID_PATTERN.test(row.userId)) {
      setToast({ message: "User ID non valido, impossibile aggiornare il ruolo.", type: "error" });
      return;
    }
    const hasRole = row.adminRoles.includes(role);
    const key = `${row.userId}:${role}`;
    setBusyKey(key);
    try {
      const payload = { targetUserId: row.userId, adminRole: role };
      const updated = hasRole
        ? await revokeAdminUserRole(token, payload)
        : await assignAdminUserRole(token, payload);
      setRows((prev) => prev.map((item) => (item.userId === updated.userId ? updated : item)));
      setToast({
        message: hasRole ? `Ruolo ${roleLabel(role)} revocato.` : `Ruolo ${roleLabel(role)} assegnato.`,
        type: "success"
      });
      if (selectedAuditUserId === updated.userId) {
        await loadAuditForUser(updated.userId);
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Aggiornamento ruolo non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  async function onLifecycleAction(row: AdminUserRoleRow, action: "deactivate" | "reactivate" | "archive") {
    if (!token) return;
    const key = `${row.userId}:lifecycle:${action}`;
    setBusyKey(key);
    try {
      if (action === "deactivate") {
        await deactivateAdminUser(token, row.userId);
        setToast({ message: "Account admin disattivato.", type: "success" });
      } else if (action === "reactivate") {
        await reactivateAdminUser(token, row.userId);
        setToast({ message: "Account admin riattivato.", type: "success" });
      } else {
        await archiveAdminUser(token, row.userId);
        setToast({ message: "Account admin archiviato. I log restano disponibili.", type: "success" });
      }
      await loadUsers(activeQuery);
      if (selectedAuditUserId === row.userId) {
        await loadAuditForUser(row.userId);
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Aggiornamento stato account non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  async function onResendInvite(row: AdminUserRoleRow) {
    if (!token) return;
    const key = `${row.userId}:invite:resend`;
    setBusyKey(key);
    try {
      const response = await resendAdminUserInvite(token, row.userId);
      const activationUrl = response.activationUrl?.trim()
        ? response.activationUrl
        : `${window.location.origin}/activate-account?token=<inviato-via-email>`;
      setLastInvite({
        email: response.email,
        role: response.adminRole,
        expiresAt: response.inviteExpiresAt,
        activationUrl
      });
      setToast({
        message: response.mailSent === false
          ? "Invito aggiornato, ma invio e-mail non riuscito. Usa il link di attivazione sotto."
          : "Invito admin reinviato via e-mail.",
        type: response.mailSent === false ? "error" : "success"
      });
      await loadUsers(activeQuery);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Reinvio invito admin non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  async function loadAuditForUser(userId: string) {
    if (!token || !UUID_PATTERN.test(userId)) return;
    setSelectedAuditUserId(userId);
    window.setTimeout(() => auditPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    setAuditLoading(true);
    try {
      const data = await getAdminAuditEvents(token, {
        entityType: "REVAMP_USER_ADMIN_ROLE",
        entityId: userId
      });
      setAuditRows([...data].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)));
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento audit non riuscito.";
      setToast({ message, type: "error" });
      setAuditRows([]);
    } finally {
      setAuditLoading(false);
    }
  }

  async function onCreateInvite(event: FormEvent) {
    event.preventDefault();
    if (!token || inviteBusy) return;
    const normalizedEmail = inviteDraft.email.trim().toLowerCase();
    if (!normalizedEmail) {
      setToast({ message: "Compila l'email.", type: "error" });
      return;
    }
    setInviteBusy(true);
    try {
      const response = await createAdminUserInvite(token, {
        ...inviteDraft,
        email: normalizedEmail
      });
      const activationUrl = response.activationUrl?.trim()
        ? response.activationUrl
        : `${window.location.origin}/activate-account?token=<inviato-via-email>`;
      setLastInvite({
        email: response.email,
        role: response.adminRole,
        expiresAt: response.inviteExpiresAt,
        activationUrl
      });
      setToast({
        message: response.mailSent === false
          ? "Invito creato, ma invio e-mail non riuscito. Usa il link di attivazione sotto."
          : "Invito admin creato e inviato via e-mail.",
        type: response.mailSent === false ? "error" : "success"
      });
      await loadUsers(activeQuery);
      resetInviteDraft();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Creazione invito admin non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setInviteBusy(false);
    }
  }

  if (auth?.role === "ADMIN" && !roleLoading && adminRole !== "SUPER_ADMIN") {
    return (
      <AdminCandidatureShell active="impostazioni">
        <section className="stack">
          {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}
          <div className="panel">
            <h2><UserCog size={20} /> Utenti e ruoli amministrativi</h2>
            <p className="subtle">Accesso riservato al profilo SUPER_ADMIN.</p>
          </div>
        </section>
      </AdminCandidatureShell>
    );
  }

  return (
    <AdminCandidatureShell active="impostazioni">
      <section className="stack admin-settings-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

        {/* Page header */}
        <div className="admin-page-header">
          <div className="admin-page-header-left">
            <span className="admin-page-breadcrumb">Impostazioni</span>
            <h2 className="admin-page-title">
              <UserCog size={22} />
              Utenti e ruoli amministrativi
            </h2>
            <p className="admin-page-subtitle">
              Gestisci ruoli amministrativi per utenti con ruolo base ADMIN.
            </p>
          </div>
        </div>

        {/* Invite form — collapsible */}
        {(showInviteForm || inviteFormClosing) && (
          <form
            className={`panel admin-settings-card admin-settings-invite-form${inviteFormClosing ? " is-closing" : ""}`}
            ref={inviteFormRef}
            onSubmit={onCreateInvite}
            onAnimationEnd={() => {
              if (inviteFormClosing) {
                setInviteFormClosing(false);
              }
            }}
          >
            <div className="invite-form-header">
              <span className="invite-form-header-icon" aria-hidden="true">
                <UserPlus size={18} />
              </span>
              <div>
                <h4>Crea utente admin (invito email)</h4>
                <p className="subtle">Invita un nuovo utente interno e assegna il ruolo governance iniziale.</p>
              </div>
            </div>

            <div className="invite-form-fields">
              <label className={`floating-field invite-floating-behavior ${inviteDraft.email ? "has-value" : ""}`}>
                <input
                  className="floating-input invite-floating-input"
                  type="email"
                  value={inviteDraft.email}
                  onChange={(e) => setInviteDraft((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  placeholder="Email *"
                />
                <span className="floating-field-label">Email *</span>
              </label>
            </div>

            <div className="invite-form-bottom-row">
              <div className="invite-form-role-col">
                <span className="invite-form-section-label">Ruolo governance *</span>
                <div className="invite-role-pills">
                  {ADMIN_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`invite-role-pill ${roleToneClass(role)} ${inviteDraft.adminRole === role ? "invite-role-pill-selected" : ""}`}
                      onClick={() => setInviteDraft((prev) => ({ ...prev, adminRole: role }))}
                    >
                      {roleLabel(role)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="invite-form-expiry-col">
                <span className="invite-form-section-label">Validità invito</span>
                <div className="invite-expiry-input-wrap">
                  <input
                    className="invite-expiry-input"
                    type="number"
                    min={1}
                    max={30}
                    value={inviteDraft.expiresInDays ?? 7}
                    onChange={(e) => setInviteDraft((prev) => ({ ...prev, expiresInDays: Number(e.target.value) }))}
                    required
                  />
                  <span className="invite-expiry-suffix">giorni</span>
                </div>
              </div>
              <div className="invite-form-actions-col">
                <button type="submit" className="home-btn admin-action-btn settings-invite-toggle invite-create-submit-button btn-with-icon btn-icon-send" disabled={inviteBusy}>
                  <span className="settings-invite-icon-wrap" aria-hidden="true">
                    <UserPlus size={14} />
                  </span>
                  <span>{inviteBusy ? "Invio..." : "Crea invito"}</span>
                </button>
                <span className="invite-reset-tooltip-wrap">
                  <button
                    type="button"
                    className="home-btn home-btn-secondary admin-action-btn invite-reset-icon-button"
                    onClick={resetInviteDraft}
                    disabled={inviteBusy}
                    aria-label="Reset form invito"
                    aria-describedby="invite-reset-tooltip"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <span id="invite-reset-tooltip" className="invite-reset-tooltip" role="tooltip">Reset</span>
                </span>
              </div>
            </div>

            {lastInvite && (
              <div className="invite-success-banner">
                <strong>{lastInvite.email}</strong> — {roleLabel(lastInvite.role)} · scade {new Date(lastInvite.expiresAt).toLocaleString("it-IT")}
                <p className="subtle" style={{ marginTop: "0.3rem", wordBreak: "break-all" }}>
                  Link: <code>{lastInvite.activationUrl}</code>
                </p>
              </div>
            )}
          </form>
        )}

        {/* Unified KPI grid */}
        <div className="admin-kpi-grid">
          {settingsKpis.map((item) => (
            <article key={item.id} className={`panel admin-settings-kpi superadmin-kpi-card tone-${item.tone}`}>
              <div className="superadmin-kpi-head">
                <h4>{item.title}</h4>
                <span className="superadmin-kpi-icon" aria-hidden="true">{item.icon}</span>
              </div>
              <strong>{item.value}</strong>
              <div className="superadmin-kpi-foot">
                <span className="superadmin-kpi-trend">{item.trend}</span>
                <span className={`superadmin-kpi-level level-${item.level}`}>{item.levelLabel}</span>
              </div>
            </article>
          ))}
        </div>

        {/* Search bar */}
        <div className="admin-search-bar">
          <div className="admin-search-bar-form">
            <div className="admin-search-input-wrap">
              <Search size={16} className="admin-search-icon" />
              <input
                className="admin-search-input"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder={queryInput.trim() ? `Filtro: ${queryInput.trim()}` : "Cerca per nome o email..."}
              />
              <div className="admin-search-filter-menu">
                <button
                  type="button"
                  className={`admin-search-filter-button${roleFilter || statusFilter ? " is-active" : ""}`}
                  onClick={() => setFilterMenuOpen((open) => !open)}
                  aria-expanded={filterMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Filtra per ruolo e stato"
                >
                  <Filter size={13} />
                  <span>{filterLabel}</span>
                  <ChevronDown size={13} />
                </button>
                {filterMenuOpen && (
                  <div className="admin-search-filter-popover" role="menu">
                    <button
                      type="button"
                      className={`admin-search-filter-option admin-search-filter-all${!roleFilter && !statusFilter ? " is-selected" : ""}`}
                      onClick={() => {
                        setRoleFilter(null);
                        setStatusFilter(null);
                        setFilterMenuOpen(false);
                      }}
                    >
                      <span>Tutti</span>
                      {!roleFilter && !statusFilter ? <Check size={13} /> : null}
                    </button>
                    <div className="admin-search-filter-section">
                      <span className="admin-search-filter-title">Ruolo</span>
                      {ADMIN_ROLES.map((role) => (
                        <button
                          key={role}
                          type="button"
                          className={`admin-search-filter-option${roleFilter === role ? " is-selected" : ""}`}
                          onClick={() => setRoleFilter((current) => current === role ? null : role)}
                        >
                          <span>{roleLabel(role)}</span>
                          {roleFilter === role ? <Check size={13} /> : null}
                        </button>
                      ))}
                    </div>
                    <div className="admin-search-filter-section">
                      <span className="admin-search-filter-title">Stato</span>
                      {ACCOUNT_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`admin-search-filter-option${statusFilter === status ? " is-selected" : ""}`}
                          onClick={() => setStatusFilter((current) => current === status ? null : status)}
                        >
                          <span>{accountStatusLabel({ accountStatus: status } as AdminUserRoleRow)}</span>
                          {statusFilter === status ? <Check size={13} /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {queryInput && (
                <button type="button" className="admin-search-clear" onClick={() => setQueryInput("")}>×</button>
              )}
            </div>
            <span className="admin-icon-tooltip-wrap">
              <button
                type="button"
                className={`home-btn home-btn-secondary admin-action-btn btn-with-icon btn-icon-refresh admin-refresh-icon-button${loading ? " is-loading" : ""}`}
                onClick={() => void loadUsers(activeQuery)}
                disabled={loading}
                aria-label={loading ? "Aggiornamento elenco in corso" : "Aggiorna elenco"}
                aria-describedby="settings-refresh-tooltip"
              >
                <RefreshCw size={17} aria-hidden="true" />
              </button>
              <span id="settings-refresh-tooltip" className="admin-icon-tooltip" role="tooltip">
                {loading ? "Aggiornamento in corso" : "Aggiorna elenco"}
              </span>
            </span>
            <label className="settings-archived-toggle">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                aria-label={includeArchived ? "Nascondi profili archiviati" : "Mostra profili archiviati"}
              />
              <Archive className="settings-archived-icon" size={14} aria-hidden="true" />
              <span className="settings-archived-tooltip" role="tooltip">
                {includeArchived ? "Nascondi archiviati" : "Mostra archiviati"}
              </span>
            </label>
            <button
              type="button"
              ref={inviteToggleRef}
              className="home-btn admin-action-btn settings-invite-toggle btn-with-icon btn-icon-send"
              onClick={() => {
                if (showInviteForm) {
                  closeInviteForm();
                } else {
                  openInviteForm();
                }
              }}
              aria-expanded={showInviteForm}
            >
              <span className="settings-invite-icon-wrap" aria-hidden="true">
                {showInviteForm ? <X size={15} /> : <Send size={14} />}
              </span>
              <span>{showInviteForm ? "Chiudi invito" : "Invia invito admin"}</span>
            </button>
          </div>
        </div>

        {/* Role matrix */}
        <div className="panel admin-settings-card" ref={usersTablePanelRef}>
          <div className="admin-settings-users-table admin-unified-table admin-unified-table-clean">
            <div className="admin-settings-users-row admin-settings-users-row-head admin-unified-table-row admin-unified-table-row-head">
              <span>Utente</span>
              <span>Stato</span>
              <span>Ruoli correnti</span>
              <span>Azioni ruolo</span>
            </div>
            {loading ? <p className="subtle admin-unified-table-empty">Caricamento utenti...</p> : null}
            {!loading && displayRows.length === 0 ? (
              <p className="subtle admin-unified-table-empty">
                {includeArchived ? "Nessun utente archiviato disponibile." : "Nessun utente disponibile."}
              </p>
            ) : null}
            {!loading && displayRows.map((row) => (
              <div
                key={row.userId}
                className={`admin-settings-users-row admin-unified-table-row settings-audit-row${auth?.userId === row.userId ? " is-current-admin-row" : ""}${selectedAuditUserId === row.userId ? " is-selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`Apri audit ruolo per ${row.email}`}
                onClick={() => void loadAuditForUser(row.userId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void loadAuditForUser(row.userId);
                  }
                }}
              >
                <div className="settings-user-cell">
                  <strong title={row.email}>{row.email}</strong>
                </div>
                {(() => {
                  const isOwnRow = auth?.userId === row.userId;
                  const isCurrentSuperAdmin = row.adminRoles.includes("SUPER_ADMIN");
                  const isPendingInvite = row.accountStatus === "INVITE_PENDING" || row.accountStatus === "INVITE_EXPIRED";
                  const canDeactivate = row.accountStatus === "ACTIVE";
                  const canReactivate = row.accountStatus === "DEACTIVATED";
                  const canUseLifecycle = !row.archived && !isOwnRow && !isCurrentSuperAdmin && !busyKey;
                  const canArchive = canUseLifecycle;
                  const lifecycleKey = `${row.userId}:lifecycle`;
                  const hasStatusActions = (isPendingInvite && !row.archived && !busyKey) || (canDeactivate && canUseLifecycle) || (canReactivate && canUseLifecycle) || canArchive;
                  return (
                    <div
                      className={`settings-status-menu${hasStatusActions ? " has-actions" : " no-actions"}`}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <button type="button" className={accountStatusClass(row)} disabled={!hasStatusActions}>
                        {accountStatusLabel(row)}
                      </button>
                      {hasStatusActions ? (
                      <div className="settings-status-popover" role="menu" aria-label={`Azioni stato per ${row.email}`}>
                        {isPendingInvite ? (
                          <button
                            type="button"
                            className="settings-lifecycle-btn tone-info"
                            title="Reinvia email con un nuovo link di attivazione"
                            onClick={() => void onResendInvite(row)}
                          >
                            {busyKey === `${row.userId}:invite:resend` ? "..." : <Send size={13} />}
                            Reinvia
                          </button>
                        ) : null}
                        {canDeactivate ? (
                          <button
                            type="button"
                            className="settings-lifecycle-btn tone-warn"
                            title="Disattiva temporaneamente account"
                            onClick={() => void onLifecycleAction(row, "deactivate")}
                          >
                            {busyKey === `${lifecycleKey}:deactivate` ? "..." : <Power size={13} />}
                            Disattiva
                          </button>
                        ) : null}
                        {canReactivate ? (
                          <button
                            type="button"
                            className="settings-lifecycle-btn tone-ok"
                            title="Riattiva account"
                            onClick={() => void onLifecycleAction(row, "reactivate")}
                          >
                            {busyKey === `${lifecycleKey}:reactivate` ? "..." : <RotateCcw size={13} />}
                            Riattiva
                          </button>
                        ) : null}
                        {canArchive ? (
                          <button
                            type="button"
                            className="settings-lifecycle-btn tone-danger"
                            title="Archivia account senza cancellare i log"
                            onClick={() => setArchivePendingRow(row)}
                          >
                            {busyKey === `${lifecycleKey}:archive` ? "..." : <Archive size={13} />}
                            Archivia
                          </button>
                        ) : null}
                      </div>
                      ) : null}
                    </div>
                  );
                })()}
                <span className="settings-roles-current">
                  {row.adminRoles.length === 0 ? "Nessuno" : row.adminRoles.map((role) => (
                    <span key={role} className={`settings-current-role-pill ${roleToneClass(role)}`}>
                      {roleLabel(role)}
                    </span>
                  ))}
                </span>
                <div className="admin-role-pills">
                  {ADMIN_ROLES.map((role) => {
                    const hasRole = row.adminRoles.includes(role);
                    const key = `${row.userId}:${role}`;
                    const isOwnRow = auth?.userId === row.userId;
                    const wouldRemoveOwnSuperAdmin = isOwnRow && row.adminRoles.includes("SUPER_ADMIN") && role !== "SUPER_ADMIN";
                    const wouldRevokeOwnSuperAdmin = isOwnRow && role === "SUPER_ADMIN" && hasRole;
                    const blocksOwnSuperAdminLockout = wouldRemoveOwnSuperAdmin || wouldRevokeOwnSuperAdmin;
                    return (
                      <button
                        key={role}
                        type="button"
                        className={`admin-role-pill ${hasRole ? "admin-role-pill-active" : "admin-role-pill-inactive"}`}
                        disabled={row.archived || blocksOwnSuperAdminLockout || busyKey === key || !!busyKey}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onToggleRole(row, role);
                        }}
                        title={
                          row.archived
                            ? "Account archiviato."
                            : blocksOwnSuperAdminLockout
                              ? "Non puoi rimuovere il ruolo Super Admin dal tuo account."
                              : hasRole ? `Revoca ${roleLabel(role)}` : `Assegna ${roleLabel(role)}`
                        }
                      >
                        {busyKey === key
                          ? "..."
                          : hasRole
                            ? <ShieldMinus size={12} />
                            : <ShieldPlus size={12} />}
                        {roleLabelShort(role)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit timeline */}
        <div className="panel admin-settings-card" ref={auditPanelRef}>
          <h4>Audit ruolo amministrativo</h4>
          {!selectedAuditUserId && (
            <p className="subtle">Seleziona un utente per vedere lo storico assegnazioni/revoche.</p>
          )}
          {selectedAuditUser && (
            <p className="subtle">{selectedAuditUser.email}</p>
          )}
          {selectedAuditUserId && auditLoading && <p className="subtle">Caricamento audit...</p>}
          {selectedAuditUserId && !auditLoading && auditRows.length === 0 && (
            <p className="subtle">Nessun evento audit disponibile.</p>
          )}
          {selectedAuditUserId && !auditLoading && auditRows.length > 0 && (
            <div className="admin-audit-timeline">
              {auditRows.map((event) => {
                const isAssign = event.eventKey?.toLowerCase().includes("assign");
                return (
                  <div key={event.id} className={`admin-audit-event ${isAssign ? "assigned" : "revoked"}`}>
                    <div className="admin-audit-event-header">
                      <strong>{auditActionLabel(event.eventKey)}</strong>
                      <span className="admin-audit-event-date">
                        {new Date(event.occurredAt).toLocaleString("it-IT")}
                      </span>
                    </div>
                    <p className="admin-audit-change-text">{auditChangeText(event)}</p>
                    <div className="admin-audit-readable-grid">
                      <span>
                        <small>Azione</small>
                        <strong>{isAssign ? "Assegnazione ruolo" : "Rimozione ruolo"}</strong>
                      </span>
                      <span>
                        <small>Eseguito da</small>
                        <strong>{event.actorRoles ? "Amministratore" : "Sistema"}</strong>
                      </span>
                      <span>
                        <small>Motivo</small>
                        <strong>{event.reason === "assign admin role" ? "Aggiornamento ruolo" : event.reason === "revoke admin role" ? "Revoca ruolo" : event.reason || "Non specificato"}</strong>
                      </span>
                    </div>
                    <p className="admin-audit-event-meta">
                      Attore: {event.actorUserId ?? "n/d"} · Ruoli: {event.actorRoles ?? "n/d"} · Req: {event.requestId ?? "n/d"}
                    </p>
                    {event.reason && (
                      <p className="admin-audit-event-meta">Motivo: {event.reason}</p>
                    )}
                    <details className="admin-audit-event-details">
                      <summary>Dettagli JSON</summary>
                      <div className="admin-audit-event-json">
                        <p className="admin-audit-event-json-label">Before</p>
                        <pre>{formatStateJson(event.beforeStateJson)}</pre>
                        <p className="admin-audit-event-json-label">After</p>
                        <pre>{formatStateJson(event.afterStateJson)}</pre>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Archive confirm modal ── */}
      {archivePendingRow ? (
        <div className="modal-overlay" onClick={() => setArchivePendingRow(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h4 className="verify-modal-title">Archivia account</h4>
            <p className="subtle">
              Stai per archiviare l'account di <strong>{archivePendingRow.email}</strong>.
              L'utente non potrà più accedere, ma audit e storico resteranno disponibili.
              Questa azione non può essere annullata.
            </p>
            <div className="modal-actions">
              <button type="button" className="home-btn home-btn-secondary" onClick={() => setArchivePendingRow(null)}>
                Annulla
              </button>
              <button
                type="button"
                className="settings-lifecycle-btn tone-danger"
                onClick={() => {
                  const row = archivePendingRow;
                  setArchivePendingRow(null);
                  void onLifecycleAction(row, "archive");
                }}
              >
                Conferma archiviazione
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminCandidatureShell>
  );
}
