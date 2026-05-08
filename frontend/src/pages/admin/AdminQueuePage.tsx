import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUpDown, CalendarDays, CheckCircle2, Clock3, ClipboardList, Hand, ListChecks, RefreshCw, Search, X, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import { HttpError } from "../../api/http";
import { assignAdminReviewCase, getAdminDecidedQueue, getAdminReviewQueue, type AdminReviewCaseSummary } from "../../api/adminReviewApi";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

type QueueTab = "ALL" | "PENDING_ASSIGNMENT" | "WAITING_SUPPLIER_RESPONSE" | "IN_PROGRESS" | "READY_FOR_DECISION" | "DECIDED";
type QueueSort = "URGENCY" | "QUEUE_DAYS" | "RECEIVED_AT";

function toDaysInQueue(updatedAt: string): number {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

function urgencyLevel(daysInQueue: number): "URGENT" | "HIGH" | "MEDIUM" | "LOW" {
  if (daysInQueue > 5) return "URGENT";
  if (daysInQueue >= 4) return "HIGH";
  if (daysInQueue >= 2) return "MEDIUM";
  return "LOW";
}

function integrationDueTone(slaDueAt?: string | null): "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "NO_DUE" {
  if (!slaDueAt) return "NO_DUE";
  const dueTs = Date.parse(slaDueAt);
  if (!Number.isFinite(dueTs)) return "NO_DUE";
  const deltaDays = Math.ceil((dueTs - Date.now()) / (1000 * 60 * 60 * 24));
  if (deltaDays < 0) return "OVERDUE";
  if (deltaDays <= 2) return "DUE_SOON";
  return "ON_TRACK";
}

function daysTone(daysInQueue: number): "urgent" | "warning" | "normal" {
  if (daysInQueue > 5) return "urgent";
  if (daysInQueue >= 3) return "warning";
  return "normal";
}

function urgencyLabel(level: "URGENT" | "HIGH" | "MEDIUM" | "LOW"): string {
  if (level === "URGENT") return "ALTA";
  if (level === "HIGH") return "ALTA";
  if (level === "MEDIUM") return "MEDIA";
  return "BASSA";
}

function dueToneLabel(tone: "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "NO_DUE"): string {
  if (tone === "OVERDUE") return "SCADUTA";
  if (tone === "DUE_SOON") return "IN SCADENZA";
  if (tone === "ON_TRACK") return "IN TEMPO";
  return "N/D";
}

function statusLabel(status: string): string {
  if (status === "PENDING_ASSIGNMENT") return "In attesa";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "Integrazione";
  if (status === "IN_PROGRESS") return "Presa in carico";
  if (status === "READY_FOR_DECISION") return "Da decidere";
  if (status === "DECIDED") return "Decisa";
  return status;
}

function decisionLabel(decision?: string | null): string {
  if (decision === "APPROVED") return "Approvata";
  if (decision === "REJECTED") return "Rigettata";
  if (decision === "INTEGRATION_REQUIRED") return "Integrazione richiesta";
  return "N/A";
}

function appCode(applicationId: string): string {
  return `APP-${applicationId.slice(0, 8).toUpperCase()}`;
}

function displayAppCode(row: AdminReviewCaseSummary): string {
  return row.protocolCode?.trim() || appCode(row.applicationId);
}

function supplierResponded(row: AdminReviewCaseSummary): boolean {
  return row.latestIntegrationRequestStatus === "ANSWERED" && Boolean(row.latestIntegrationSupplierRespondedAt);
}

function shouldRefreshQueue(event: DashboardActivityEvent): boolean {
  const key = event.eventKey ?? "";
  return (
    key.startsWith("revamp.review.")
    || key.startsWith("revamp.application.")
    || key.includes("integration")
    || event.entityType === "REVAMP_APPLICATION"
  );
}


export function AdminQueuePage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole } = useAdminGovernanceRole();
  const [rows, setRows] = useState<AdminReviewCaseSummary[]>([]);
  const [activeTab, setActiveTab] = useState<QueueTab>("ALL");
  const [sortBy, setSortBy] = useState<QueueSort>("RECEIVED_AT");
  const [sortDir, setSortDir] = useState<"DESC" | "ASC">("DESC");
  const [loading, setLoading] = useState(false);
  const [busyAssignFor, setBusyAssignFor] = useState<string | null>(null);
  const [recentlyAssigned, setRecentlyAssigned] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [decidedRows, setDecidedRows] = useState<AdminReviewCaseSummary[]>([]);
  const [decidedLoading, setDecidedLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const queueRefreshInFlightRef = useRef(false);
  const queueRefreshQueuedRef = useRef(false);
  const canAssign = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE";

  const loadQueue = useCallback(async (showLoading = true) => {
    if (!token) return;
    if (queueRefreshInFlightRef.current) {
      queueRefreshQueuedRef.current = true;
      return;
    }

    queueRefreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const data = await getAdminReviewQueue(token);
      const sorted = [...data].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      setRows(sorted);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento coda review non riuscito.";
      setToast({ message, type: "error" });
      setRows([]);
    } finally {
      queueRefreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
      if (queueRefreshQueuedRef.current) {
        queueRefreshQueuedRef.current = false;
        void loadQueue(false);
      }
    }
  }, [token]);

  const loadDecided = useCallback(async () => {
    if (!token) return;
    setDecidedLoading(true);
    try {
      const data = await getAdminDecidedQueue(token);
      const sorted = [...data].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      setDecidedRows(sorted);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento pratiche decise non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setDecidedLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadQueue(true);
    void loadDecided();
  }, [loadQueue, loadDecided]);

  useEffect(() => {
    if (activeTab === "DECIDED") void loadDecided();
  }, [activeTab, loadDecided]);

  useAdminRealtimeRefresh({
    token,
    shouldRefresh: shouldRefreshQueue,
    onRefresh: () => {
      loadQueue(false);
      if (activeTab === "DECIDED") void loadDecided();
    }
  });

  const counters = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return {
      pendingReview: rows.filter((r) => r.status === "PENDING_ASSIGNMENT").length,
      integrationRequested: rows.filter((r) => r.status === "WAITING_SUPPLIER_RESPONSE").length,
      inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
      readyForDecision: rows.filter((r) => r.status === "READY_FOR_DECISION").length,
      approvedThisMonth: decidedRows.filter((r) => {
        if (r.decision !== "APPROVED") return false;
        const ts = Date.parse(r.updatedAt);
        if (!Number.isFinite(ts)) return false;
        const date = new Date(ts);
        return date.getMonth() === month && date.getFullYear() === year;
      }).length,
      rejectedThisMonth: decidedRows.filter((r) => {
        if (r.decision !== "REJECTED") return false;
        const ts = Date.parse(r.updatedAt);
        if (!Number.isFinite(ts)) return false;
        const date = new Date(ts);
        return date.getMonth() === month && date.getFullYear() === year;
      }).length
    };
  }, [rows, decidedRows]);


  const queueKpis = [
    {
      id: "pending",
      title: "In attesa revisione",
      value: counters.pendingReview,
      icon: <ClipboardList className="h-4 w-4" />,
      trend: "da assegnare",
      level: counters.pendingReview === 0 ? "ok" : counters.pendingReview > 5 ? "critical" : "attention",
      levelLabel: counters.pendingReview === 0 ? "Normale" : counters.pendingReview > 5 ? "Critico" : "Attenzione",
      tone: "attention"
    },
    {
      id: "integration",
      title: "Integrazione richiesta",
      value: counters.integrationRequested,
      icon: <AlertTriangle className="h-4 w-4" />,
      trend: "attesa fornitore",
      level: counters.integrationRequested === 0 ? "ok" : "attention",
      levelLabel: counters.integrationRequested === 0 ? "Normale" : "In corso",
      tone: "attention"
    },
    {
      id: "progress",
      title: "Prese in carico",
      value: counters.inProgress,
      icon: <RefreshCw className="h-4 w-4" />,
      trend: "in lavorazione",
      level: counters.inProgress === 0 ? "info" : counters.inProgress > 5 ? "attention" : "ok",
      levelLabel: counters.inProgress === 0 ? "Avvio" : counters.inProgress > 5 ? "Alto" : "Operativo",
      tone: "info"
    },
    {
      id: "ready",
      title: "Da decidere",
      value: counters.readyForDecision,
      icon: <ListChecks className="h-4 w-4" />,
      trend: "pronte",
      level: counters.readyForDecision === 0 ? "ok" : counters.readyForDecision > 5 ? "critical" : "attention",
      levelLabel: counters.readyForDecision === 0 ? "Normale" : counters.readyForDecision > 5 ? "Critico" : "Attenzione",
      tone: "info"
    },
    {
      id: "approved",
      title: "Approvate (mese)",
      value: counters.approvedThisMonth,
      icon: <CheckCircle2 className="h-4 w-4" />,
      trend: "nel mese",
      level: counters.approvedThisMonth > 0 ? "ok" : "info",
      levelLabel: counters.approvedThisMonth > 0 ? "Operativo" : "In attesa",
      tone: "ok"
    },
    {
      id: "rejected",
      title: "Rigettate (mese)",
      value: counters.rejectedThisMonth,
      icon: <XCircle className="h-4 w-4" />,
      trend: "nel mese",
      level: counters.rejectedThisMonth === 0 ? "ok" : counters.rejectedThisMonth > 3 ? "critical" : "attention",
      levelLabel: counters.rejectedThisMonth === 0 ? "Controllo" : counters.rejectedThisMonth > 3 ? "Critico" : "Monitorare",
      tone: "critical"
    }
  ] as const;

  const filteredRows = useMemo(() => {
    const source = activeTab === "DECIDED" ? decidedRows : activeTab === "ALL" ? [...rows, ...decidedRows] : rows;
    const byTab = activeTab === "ALL" || activeTab === "DECIDED" ? source : source.filter((r) => r.status === activeTab);
    const term = searchQ.trim().toLowerCase();
    const selected = term ? byTab.filter((r) => {
      const code = (r.protocolCode?.trim() || `APP-${r.applicationId.slice(0, 8).toUpperCase()}`).toLowerCase();
      const name = (r.applicantDisplayName ?? "").toLowerCase();
      return code.includes(term) || name.includes(term);
    }) : byTab;
    return [...selected].sort((a, b) => {
      const aDays = toDaysInQueue(a.updatedAt);
      const bDays = toDaysInQueue(b.updatedAt);
      let compare = 0;

      if (sortBy === "URGENCY") {
        const aUrgency = urgencyLevel(aDays);
        const bUrgency = urgencyLevel(bDays);
        const rank = (value: ReturnType<typeof urgencyLevel>): number => {
          if (value === "URGENT") return 4;
          if (value === "HIGH") return 3;
          if (value === "MEDIUM") return 2;
          return 1;
        };
        compare = rank(aUrgency) - rank(bUrgency);
      } else if (sortBy === "QUEUE_DAYS") {
        compare = aDays - bDays;
      } else {
        compare = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
      }

      return sortDir === "DESC" ? -compare : compare;
    });
  }, [activeTab, rows, decidedRows, sortBy, sortDir]);

  async function takeInCharge(row: AdminReviewCaseSummary) {
    if (!token || !canAssign || busyAssignFor) return;
    setBusyAssignFor(row.applicationId);
    try {
      await assignAdminReviewCase(row.applicationId, token, auth?.userId ? { assignedToUserId: auth.userId } : undefined);
      setToast({ message: "Candidatura presa in carico.", type: "success" });
      await loadQueue();
      setRecentlyAssigned(row.applicationId);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Presa in carico non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setBusyAssignFor(null);
    }
  }

  return (
    <AdminCandidatureShell active="candidature">
      <section className="stack admin-queue-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="admin-queue-head">
        <div>
          <h2 className="admin-page-title-standard"><ListChecks className="h-5 w-5" /> Candidature</h2>
          <p className="subtle">Gestisci le pratiche in revisione con priorita operative.</p>
        </div>
      </div>

      <div className="admin-queue-kpis">
        {queueKpis.map((item) => (
          <article key={item.id} className={`panel admin-queue-kpi superadmin-kpi-card tone-${item.tone}`}>
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

      <div className="panel admin-queue-filter-row">
        <div className="admin-albo-search-field admin-queue-search-pill">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder="Cerca candidatura o nominativo..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          {searchQ ? (
            <button type="button" className="admin-albo-search-clear" onClick={() => setSearchQ("")} aria-label="Cancella ricerca">
              <X size={14} />
            </button>
          ) : null}
          <div className="admin-albo-status-tabs" aria-label="Filtro stato">
            {([
              ["ALL", "Tutte"],
              ["PENDING_ASSIGNMENT", "In attesa"],
              ["WAITING_SUPPLIER_RESPONSE", "Integrazione"],
              ["IN_PROGRESS", "In carico"],
              ["READY_FOR_DECISION", "Da decidere"],
              ["DECIDED", "Decise"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className={activeTab === id ? "is-active" : ""} onClick={() => setActiveTab(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-queue-sort-segmented" role="group" aria-label="Ordina coda">
          <button type="button" className={sortBy === "RECEIVED_AT" ? "admin-queue-sort-option active" : "admin-queue-sort-option"} onClick={() => setSortBy("RECEIVED_AT")}>
            <CalendarDays className="admin-queue-sort-icon" aria-hidden="true" /><span>Data ricezione</span>
          </button>
          <button type="button" className={sortBy === "QUEUE_DAYS" ? "admin-queue-sort-option active" : "admin-queue-sort-option"} onClick={() => setSortBy("QUEUE_DAYS")}>
            <Clock3 className="admin-queue-sort-icon" aria-hidden="true" /><span>In coda</span>
          </button>
          <button type="button" className={sortBy === "URGENCY" ? "admin-queue-sort-option active" : "admin-queue-sort-option"} onClick={() => setSortBy("URGENCY")}>
            <AlertTriangle className="admin-queue-sort-icon" aria-hidden="true" /><span>Urgenza</span>
          </button>
        </div>
        <button
          type="button"
          className="queue-sort-direction-icon"
          aria-label={sortDir === "DESC" ? "Ordinamento decrescente" : "Ordinamento crescente"}
          title={sortDir === "DESC" ? "Decrescente" : "Crescente"}
          onClick={() => setSortDir((prev) => prev === "DESC" ? "ASC" : "DESC")}
        >
          <ArrowUpDown className="queue-sort-svg" aria-hidden="true" />
        </button>
      </div>

        <div className="panel">
          {(loading || (activeTab === "DECIDED" && decidedLoading)) ? <p className="subtle admin-unified-table-empty">Caricamento...</p> : null}
          {!loading && !decidedLoading && filteredRows.length === 0 ? <p className="subtle admin-unified-table-empty">Nessuna pratica per il filtro selezionato.</p> : null}
          {!loading && !decidedLoading && filteredRows.length > 0 ? (
            <div className={`admin-queue-table admin-unified-table admin-unified-table-clean admin-queue-table--revamp${activeTab === "DECIDED" ? " admin-queue-table--decided" : ""}`}>
              <div className="admin-queue-row admin-queue-row-head admin-unified-table-row admin-unified-table-row-head">
                <span>Candidatura</span>
                <span>Nominativo</span>
                <span>Ricevuta il</span>
                <span>In coda da</span>
                <span>Stato</span>
                {activeTab !== "DECIDED" ? <span>Urgenza</span> : null}
                <span>Azioni</span>
                <span>Presa in carico</span>
                {activeTab === "DECIDED" ? <span>Decisa da</span> : null}
              </div>
              {filteredRows.map((row) => {
                const days = toDaysInQueue(row.updatedAt);
                const urgency = urgencyLevel(days);
                const urgencyTone = urgency === "URGENT" ? "urgent" : urgency === "HIGH" ? "high" : urgency === "MEDIUM" ? "medium" : "low";
                const actionClass = `queue-manage-link${urgency === "URGENT" ? " queue-action-primary is-urgent" : ""}`;
                const assignedLabel = row.assignedToDisplayName?.trim() || "Non assegnata";
                const dueTone = row.status === "WAITING_SUPPLIER_RESPONSE" ? integrationDueTone(row.slaDueAt) : null;
                const dueLabel = row.slaDueAt ? new Date(row.slaDueAt).toLocaleDateString("it-IT") : "n/d";
                const isSupplierResponded = supplierResponded(row);
                const examineLockedForUser = adminRole === "REVISORE" && row.assignedToUserId !== auth?.userId;

                return (
                  <div key={row.id} className={`admin-queue-row admin-unified-table-row${recentlyAssigned === row.applicationId ? " queue-row-highlight" : ""}`}>
                    <div className="queue-main-cell">
                      <div className="queue-app-code" tabIndex={0} aria-label={`UUID: ${row.applicationId}`}>
                        <strong>{displayAppCode(row)}</strong>
                        <span className="queue-uuid-tooltip" role="tooltip">UUID: {row.applicationId}</span>
                      </div>
                    </div>
                    <span className="queue-nominativo-cell">{row.applicantDisplayName ?? "—"}</span>
                    <span>{new Date(row.updatedAt).toLocaleDateString("it-IT")}</span>
                    <span className={`queue-days-cell queue-days-${daysTone(days)}`}>
                      <Clock3 className="h-4 w-4" /> {days === 0 ? "Arrivato oggi" : `${days} giorni`}
                    </span>
                    <span className={`queue-pill status${activeTab === "DECIDED" ? (row.decision === "APPROVED" ? " decision-approved" : " decision-rejected") : ""}`}>
                      {activeTab === "DECIDED" ? decisionLabel(row.decision) : statusLabel(row.status)}
                      {activeTab !== "DECIDED" && row.status === "PENDING_ASSIGNMENT" ? <span className="queue-assign-badge">Da assegnare</span> : null}
                      {activeTab !== "DECIDED" && row.verifiedAt ? <span className="queue-verified-badge">Verificata</span> : null}
                    </span>
                    {activeTab !== "DECIDED" ? (
                      <span
                        className={`queue-pill urgency ${
                          isSupplierResponded
                            ? "response-received urgency-level"
                            : row.status === "WAITING_SUPPLIER_RESPONSE" && dueTone
                              ? dueTone.toLowerCase().replace("_", "-")
                              : `${urgencyTone} urgency-level`
                        }`}
                      >
                        {isSupplierResponded
                          ? "Risposta ricevuta"
                          : row.status === "WAITING_SUPPLIER_RESPONSE" && dueTone
                            ? `${dueToneLabel(dueTone)} (${dueLabel})`
                            : urgencyLabel(urgency)}
                      </span>
                    ) : null}
                    <div className="queue-actions">
                      {(row.status === "PENDING_ASSIGNMENT" && adminRole !== "SUPER_ADMIN") || examineLockedForUser ? (
                        <span className={`${actionClass} is-disabled`} aria-disabled="true">
                          <span className="queue-manage-link-arrow" aria-hidden="true">&#8599;</span>
                          <span className="queue-manage-link-label">Esamina</span>
                        </span>
                      ) : (
                        <Link className={actionClass} to={`/admin/candidature/${row.applicationId}/review`}>
                          <span className="queue-manage-link-arrow" aria-hidden="true">&#8599;</span>
                          <span className="queue-manage-link-label">Esamina</span>
                        </Link>
                      )}
                    </div>
                    <div className="queue-assignment-cell">
                      {row.status === "PENDING_ASSIGNMENT" ? (
                        <button
                          type="button"
                          className="queue-action-take queue-action-take-ghost"
                          disabled={!canAssign || busyAssignFor === row.applicationId}
                          onClick={() => void takeInCharge(row)}
                        >
                          <Hand className="queue-action-take-icon" />
                          {busyAssignFor === row.applicationId ? "Presa in carico..." : "Prendi in carico"}
                        </button>
                      ) : (
                        <span className="queue-assignee-name">{assignedLabel}</span>
                      )}
                    </div>
                    {activeTab === "DECIDED" ? (
                      <span className="queue-decided-by-cell">
                        {row.decidedByDisplayName?.trim() || "—"}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </AdminCandidatureShell>
  );
}
