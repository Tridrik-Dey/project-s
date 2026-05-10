import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../api/http";
import { getAdminReportKpis, type AdminReportKpis } from "../../api/adminReportApi";
import { getAdminReviewQueue, type AdminReviewCaseSummary } from "../../api/adminReviewApi";
import { getAdminAuditEvents, type AdminAuditEventRow } from "../../api/adminAuditApi";
import { listAdminProfiles, type AdminRegistryProfileRow } from "../../api/adminProfilesApi";
import { listPendingAdminFieldChangeRequests } from "../../api/fieldChangeRequestApi";
import type { AdminRole } from "../../api/adminUsersRolesApi";
import { useAuth } from "../../auth/AuthContext";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";
import {
  SuperAdminDashboardPage,
  type SuperAdminAlboMetrics,
  type SuperAdminRecentActivityItem,
  type SuperAdminMonthTrendPoint
} from "./SuperAdminDashboardPage";

const EMPTY_KPIS: AdminReportKpis = {
  totalSuppliers: 0,
  activeSuppliers: 0,
  pendingSuppliers: 0,
  submittedApplications: 0,
  pendingInvites: 0
};

const EMPTY_ALBO_METRICS: SuperAdminAlboMetrics = {
  approvalRate30d: 0,
  approved30d: 0,
  decided30d: 0,
  avgReviewCloseDays30d: 0,
  closedReviews30d: 0,
  expiringProfiles30d: 0
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type AdminDashboardCapabilities = {
  canReadKpis: boolean;
  canReadQueue: boolean;
  canReadAudit: boolean;
  canManageInvites: boolean;
  canExportReports: boolean;
  canManageFieldChanges: boolean;
};

function resolveCapabilities(adminRole: AdminRole | null): AdminDashboardCapabilities {
  return {
    canReadKpis: adminRole !== null,
    canReadQueue: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE",
    canReadAudit: adminRole !== null,
    canManageInvites: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO",
    canExportReports: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO",
    canManageFieldChanges: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO",
  };
}

export function AdminDashboardPage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole, loading: adminRoleLoading } = useAdminGovernanceRole();
  const [kpis, setKpis] = useState<AdminReportKpis>(EMPTY_KPIS);
  const [queue, setQueue] = useState<AdminReviewCaseSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<SuperAdminRecentActivityItem[]>([]);
  const [monthTrend, setMonthTrend] = useState<SuperAdminMonthTrendPoint[]>([]);
  const [alboMetrics, setAlboMetrics] = useState<SuperAdminAlboMetrics>(EMPTY_ALBO_METRICS);
  const [pendingFieldChangeCount, setPendingFieldChangeCount] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dashboardRefreshInFlightRef = useRef(false);
  const dashboardRefreshQueuedRef = useRef(false);
  const capabilities = resolveCapabilities(adminRole);

  function parseAuditMeta(raw: string | null | undefined): Record<string, string> {
    if (!raw) return {};
    try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
  }

  function formatGovernanceRole(role: string | null | undefined): string {
    if (!role) return "";
    const map: Record<string, string> = {
      SUPER_ADMIN: "Super Admin",
      RESPONSABILE_ALBO: "Responsabile Albo",
      REVISORE: "Revisore",
      VIEWER: "Viewer",
    };
    return map[role] ?? role;
  }

  function extractPrimaryRole(rawRoles: string | null | undefined): string {
    if (!rawRoles) return "VIEWER";
    const tokens = rawRoles
      .split(/[,\s|]+/)
      .map((token) => token.trim())
      .filter(Boolean);
    return tokens[0] ?? "VIEWER";
  }

  function resolveActorLabel(item: AdminAuditEventRow, meta: Record<string, string>): { actorLabel: string; actorRoleLabel: string } {
    const actorRoleLabel = formatGovernanceRole(extractPrimaryRole(item.actorRoles)) || "Viewer";
    const actorLabel =
      meta.actorName ??
      meta.actorDisplayName ??
      meta.adminName ??
      meta.performedByName ??
      meta.targetUserName ??
      meta.invitedName ??
      meta.invitedEmail ??
      meta.actorEmail ??
      meta.applicantName ??
      actorRoleLabel ??
      "Sistema";

    return {
      actorLabel,
      actorRoleLabel
    };
  }

  function inviteRecipient(meta: Record<string, string>): string {
    return meta.invitedName ?? meta.invitedEmail ?? meta.supplierName ?? meta.applicantName ?? "il fornitore";
  }

  function supplierDisplayName(meta: Record<string, string>, fallback = "il fornitore"): string {
    return (
      meta.applicantName ??
      meta.supplierName ??
      meta.invitedName ??
      meta.invitedEmail ??
      meta.targetUserName ??
      fallback
    );
  }

  function shortEntityCode(prefix: string, entityId: string | null | undefined): string {
    if (!entityId) return prefix;
    return `${prefix}-${entityId.slice(0, 6).toUpperCase()}`;
  }

  function resolveActivityTargetLabel(
    item: AdminAuditEventRow,
    meta: Record<string, string>
  ): string {
    const key = item.eventKey ?? "";

    if (key.includes(".invite.")) {
      const recipient = meta.invitedName ?? meta.invitedEmail ?? meta.supplierName ?? meta.applicantName;
      return recipient ? `Invito: ${recipient}` : shortEntityCode("Invito", item.entityId);
    }

    if (key === "revamp.supplier-evaluator.assigned" || key.includes("profile")) {
      const supplier = meta.supplierName ?? meta.applicantName ?? meta.invitedName ?? meta.invitedEmail;
      return supplier ? `Fornitore: ${supplier}` : shortEntityCode("Fornitore", item.entityId);
    }

    if (key.startsWith("revamp.review.") || key.startsWith("revamp.application.") || item.entityType === "REVAMP_APPLICATION") {
      const application = meta.applicantName ?? meta.supplierName;
      const code = shortEntityCode("APP", item.entityId);
      return application ? `Candidatura: ${application}` : `Candidatura: ${code}`;
    }

    if (key.startsWith("revamp.admin-")) {
      const user = meta.targetUserName ?? meta.targetUserEmail ?? meta.adminName ?? meta.actorEmail;
      return user ? `Utente admin: ${user}` : "Utente admin";
    }

    if (item.entityType && item.entityId) {
      return `${item.entityType}: ${item.entityId.slice(0, 8).toUpperCase()}`;
    }

    return "Dettagli attivita";
  }

  function mapAuditToRecent(items: AdminAuditEventRow[]): SuperAdminRecentActivityItem[] {
    return items
      .slice(0, 24)
      .map((item) => {
        const key = item.eventKey ?? "";
        const meta = parseAuditMeta(item.metadataJson);
        const actor = resolveActorLabel(item, meta);
        let title = "Attivita aggiornata";
        let subtitle = "";
        let activityTone: SuperAdminRecentActivityItem["activityTone"] = "neutral";
        const targetLabel = resolveActivityTargetLabel(item, meta);
        const navigateTo =
          item.entityType === "REVAMP_APPLICATION" && item.entityId
            ? `/admin/candidature/${item.entityId}/review`
            : "/admin/candidature";

        if (key === "revamp.review.opened") {
          title = "Pratica aperta";
          subtitle = meta.applicantName ? `Candidatura di ${meta.applicantName}` : "Candidatura";
          activityTone = "opened";
        } else if (key === "revamp.review.verified") {
          title = "Verifica completata";
          subtitle = meta.applicantName ? `Candidatura di ${meta.applicantName}` : "Candidatura";
          activityTone = "verified";
        } else if (key === "revamp.review.integration_requested") {
          title = "Integrazione richiesta";
          subtitle = meta.applicantName ? `Candidatura di ${meta.applicantName}` : "Candidatura";
          activityTone = "integration";
        } else if (key === "revamp.review.decided") {
          if (meta.decision === "APPROVED") {
            title = "Candidatura approvata";
            activityTone = "approved";
          } else if (meta.decision === "REJECTED") {
            title = "Candidatura rigettata";
            activityTone = "rejected";
          } else {
            title = "Decisione presa";
          }
          subtitle = meta.applicantName ? `Candidatura di ${meta.applicantName}` : "Candidatura";
        } else if (key === "revamp.application.created") {
          title = "Bozza candidatura creata";
          subtitle = meta.applicantName ? `Da ${meta.applicantName}` : "Nuova candidatura";
          activityTone = "opened";
        } else if (key === "revamp.application.submitted") {
          title = "Candidatura inviata";
          const parts = [
            meta.applicantName ? `Da ${meta.applicantName}` : null,
            meta.protocolCode ? `Prot. ${meta.protocolCode}` : null,
          ].filter(Boolean);
          subtitle = parts.join(" | ") || "Candidatura";
          activityTone = "opened";
        } else if (key === "revamp.invite.created" || key === "revamp.invite.sent") {
          title = "Invito inviato";
          subtitle = `E-mail di invito inviata a ${inviteRecipient(meta)}.`;
          activityTone = "opened";
        } else if (key === "revamp.invite.updated") {
          title = "Invito aggiornato";
          subtitle = `I dettagli dell'invito per ${inviteRecipient(meta)} sono stati modificati.`;
          activityTone = "opened";
        } else if (key === "revamp.invite.opened") {
          title = "Invito aperto";
          subtitle = `${inviteRecipient(meta)} ha aperto l'invito ricevuto.`;
          activityTone = "opened";
        } else if (key === "revamp.invite.consumed") {
          title = "Invito accettato";
          subtitle = `${inviteRecipient(meta)} ha completato l'accesso tramite invito.`;
          activityTone = "verified";
        } else if (key === "revamp.invite.expired") {
          title = "Invito scaduto";
          subtitle = `${inviteRecipient(meta)} non ha usato l'invito prima della scadenza.`;
          activityTone = "rejected";
        } else if (key === "revamp.invite.expired-admin-notification.sent") {
          title = "Notifica invito scaduto inviata";
          subtitle = `Un amministratore e stato avvisato dell'invito scaduto per ${inviteRecipient(meta)}.`;
          activityTone = "integration";
        } else if (key === "revamp.invite.renewed") {
          title = "Invito rinnovato";
          subtitle = `Nuovo link di invito generato per ${inviteRecipient(meta)}.`;
          activityTone = "opened";
        } else if (key === "revamp.supplier-evaluator.assigned") {
          title = "Valutatore assegnato";
          subtitle = `Un valutatore e stato assegnato a ${supplierDisplayName(meta)}.`;
          activityTone = "role";
        } else if (key === "revamp.admin-role.assigned") {
          title = "Ruolo assegnato";
          const roleName = formatGovernanceRole(meta.role);
          subtitle = meta.targetUserName
            ? `${meta.targetUserName}${roleName ? ` -> ${roleName}` : ""}`
            : roleName || "Amministratore";
          activityTone = "role";
        } else if (key === "revamp.admin-role.revoked") {
          title = "Ruolo revocato";
          const roleName = formatGovernanceRole(meta.role);
          subtitle = meta.targetUserName
            ? `${meta.targetUserName}${roleName ? ` - ${roleName}` : ""}`
            : roleName || "Amministratore";
          activityTone = "role";
        } else if (key.includes("profile")) {
          title = "Profilo aggiornato";
          subtitle = "Profilo fornitore";
        }

        return {
          id: item.id,
          title,
          subtitle: subtitle || "Operazione registrata nel sistema.",
          occurredAt: item.occurredAt,
          actorLabel: actor.actorLabel,
          actorRoleLabel: actor.actorRoleLabel,
          activityTone,
          targetLabel,
          navigateTo
        };
      })
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  }

  function buildMonthTrend(
    queueItems: AdminReviewCaseSummary[],
    auditItems: AdminAuditEventRow[]
  ): SuperAdminMonthTrendPoint[] {
    if (queueItems.length === 0 && auditItems.length === 0) return [];

    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const counts = new Map<string, number>(monthKeys.map((key) => [key, 0]));
    const countedApplications = new Set<string>();
    auditItems
      .filter((item) => item.eventKey === "revamp.application.submitted" && item.entityId)
      .forEach((item) => {
      if (countedApplications.has(item.entityId)) return;
      const parsed = Date.parse(item.occurredAt);
      if (!Number.isFinite(parsed)) return;
      const d = new Date(parsed);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
        countedApplications.add(item.entityId);
      }
    });
    return monthKeys.map((key) => {
      const [year, month] = key.split("-");
      const date = new Date(Number(year), Number(month) - 1, 1);
      const monthLabel = date.toLocaleDateString("it-IT", { month: "short" });
      return {
        monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        count: counts.get(key) ?? 0
      };
    });
  }

  function buildAlboMetrics(
    auditItems: AdminAuditEventRow[],
    profileRows: AdminRegistryProfileRow[]
  ): SuperAdminAlboMetrics {
    const now = Date.now();
    const cutoff = now - THIRTY_DAYS_MS;
    const decisionEvents30d = auditItems.filter((item) => {
      if (item.eventKey !== "revamp.review.decided") return false;
      const occurredAt = Date.parse(item.occurredAt);
      if (!Number.isFinite(occurredAt) || occurredAt < cutoff) return false;
      const decision = parseAuditMeta(item.metadataJson).decision;
      return decision === "APPROVED" || decision === "REJECTED";
    });
    const approved30d = decisionEvents30d.filter((item) => parseAuditMeta(item.metadataJson).decision === "APPROVED").length;
    const decided30d = decisionEvents30d.length;
    const approvalRate30d = decided30d === 0 ? 0 : Math.round((approved30d / decided30d) * 100);

    const startByApplication = new Map<string, number>();
    [...auditItems]
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
      .forEach((item) => {
        if (!item.entityId) return;
        if (item.eventKey !== "revamp.application.submitted" && item.eventKey !== "revamp.review.opened") return;
        const occurredAt = Date.parse(item.occurredAt);
        if (!Number.isFinite(occurredAt)) return;
        const existing = startByApplication.get(item.entityId);
        if (existing === undefined || occurredAt < existing) {
          startByApplication.set(item.entityId, occurredAt);
        }
      });

    const closeDurations = decisionEvents30d
      .map((item) => {
        if (!item.entityId) return null;
        const startAt = startByApplication.get(item.entityId);
        const decidedAt = Date.parse(item.occurredAt);
        if (startAt === undefined || !Number.isFinite(decidedAt) || decidedAt < startAt) return null;
        return (decidedAt - startAt) / DAY_MS;
      })
      .filter((value): value is number => value !== null);
    const avgReviewCloseDays30d = closeDurations.length === 0
      ? 0
      : Math.round(closeDurations.reduce((acc, value) => acc + value, 0) / closeDurations.length);

    const expiryLimit = now + THIRTY_DAYS_MS;
    const expiringProfiles30d = profileRows.filter((profile) => {
      if (profile.status !== "APPROVED" && profile.status !== "RENEWAL_DUE") return false;
      if (profile.pendingDocumentRenewal || (profile.expiredDocumentLabels?.length ?? 0) > 0) return true;
      if (!profile.expiresAt) return false;
      const expiresAt = Date.parse(profile.expiresAt);
      return Number.isFinite(expiresAt) && expiresAt <= expiryLimit;
    }).length;

    return {
      approvalRate30d,
      approved30d,
      decided30d,
      avgReviewCloseDays30d,
      closedReviews30d: closeDurations.length,
      expiringProfiles30d
    };
  }

  const loadRegistryProfilesForMetrics = useCallback(async (): Promise<AdminRegistryProfileRow[]> => {
    if (!capabilities.canReadKpis) return [];
    const [alboA, alboB] = await Promise.all([
      listAdminProfiles(token, { registryType: "ALBO_A", page: 0, size: 1000 }).catch(() => ({ content: [] as AdminRegistryProfileRow[] })),
      listAdminProfiles(token, { registryType: "ALBO_B", page: 0, size: 1000 }).catch(() => ({ content: [] as AdminRegistryProfileRow[] }))
    ]);
    return [...alboA.content, ...alboB.content];
  }, [capabilities.canReadKpis, token]);

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (!token || adminRoleLoading) return;
    if (!capabilities.canReadKpis && !capabilities.canReadAudit && !capabilities.canReadQueue) {
      setKpis(EMPTY_KPIS);
      setQueue([]);
      setRecentActivity([]);
      setMonthTrend([]);
      setAlboMetrics(EMPTY_ALBO_METRICS);
      setPendingFieldChangeCount(0);
      return;
    }

    if (dashboardRefreshInFlightRef.current) {
      dashboardRefreshQueuedRef.current = true;
      return;
    }

    dashboardRefreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const [kpisData, queueData, auditData, fieldChangeRows, profileRows] = await Promise.all([
        capabilities.canReadKpis ? getAdminReportKpis(token) : Promise.resolve(EMPTY_KPIS),
        capabilities.canReadQueue ? getAdminReviewQueue(token) : Promise.resolve([] as AdminReviewCaseSummary[]),
        capabilities.canReadAudit ? getAdminAuditEvents(token).catch(() => [] as AdminAuditEventRow[]) : Promise.resolve([] as AdminAuditEventRow[]),
        capabilities.canManageFieldChanges ? listPendingAdminFieldChangeRequests(token).catch(() => []) : Promise.resolve([]),
        loadRegistryProfilesForMetrics()
      ]);
      setKpis(kpisData);
      const sortedQueue = [...queueData].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      setQueue(sortedQueue);
      setRecentActivity(mapAuditToRecent(auditData));
      setMonthTrend(buildMonthTrend(sortedQueue, auditData));
      setAlboMetrics(buildAlboMetrics(auditData, profileRows));
      setPendingFieldChangeCount(fieldChangeRows.length);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "";
      if (!message.toLowerCase().includes("access denied") && !message.toLowerCase().includes("invalid governance")) {
        setKpis(EMPTY_KPIS);
        setQueue([]);
        setAlboMetrics(EMPTY_ALBO_METRICS);
      }
    } finally {
      dashboardRefreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
      if (dashboardRefreshQueuedRef.current) {
        dashboardRefreshQueuedRef.current = false;
        void loadDashboard(false);
      }
    }
  }, [
    adminRoleLoading,
    capabilities.canReadAudit,
    capabilities.canReadKpis,
    capabilities.canReadQueue,
    capabilities.canManageFieldChanges,
    loadRegistryProfilesForMetrics,
    token
  ]);

  useEffect(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  useAdminRealtimeRefresh({
    token,
    enabled: !adminRoleLoading && capabilities.canReadAudit,
    onRefresh: () => loadDashboard(false)
  });

  const canManageInvites = capabilities.canManageInvites;

  if (adminRoleLoading) {
    return (
      <AdminCandidatureShell active="dashboard">
        <div className="panel">
          <p className="subtle">Caricamento dashboard...</p>
        </div>
      </AdminCandidatureShell>
    );
  }

  return (
    <SuperAdminDashboardPage
      adminRole={adminRole ?? "VIEWER"}
      kpis={kpis}
      queue={queue}
      recentActivity={recentActivity}
      monthTrend={monthTrend}
      alboMetrics={alboMetrics}
      lastUpdatedAt={lastUpdatedAt}
      loading={loading}
      canManageInvites={canManageInvites}
      canExportReports={capabilities.canExportReports}
      canAccessQueue={capabilities.canReadQueue}
      pendingFieldChangeCount={pendingFieldChangeCount}
    />
  );
}
