import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUpDown, CalendarDays, CheckCircle2, Clock3, ClipboardList, Eye, Hand, ListChecks, RefreshCw, Search, X, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import { HttpError } from "../../api/http";
import { assignAdminReviewCase, getAdminDecidedQueue, getAdminReviewQueue, type AdminReviewCaseSummary } from "../../api/adminReviewApi";
import {
  adminRejectChangeRequest,
  adminUnlockSection,
  listPendingAdminFieldChangeRequests,
  type AdminPendingFieldChangeRequest
} from "../../api/fieldChangeRequestApi";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { AdminCandidatureShell } from "./AdminCandidatureShell";
import { getFcrGroup } from "../../config/fcrFieldGroups";
import {
  getUnseenAdminAttentionIds,
  markAdminAttentionSeen
} from "../../utils/adminCandidatureAttention";

type QueueTab = "ALL" | "PENDING_ASSIGNMENT" | "WAITING_SUPPLIER_RESPONSE" | "IN_PROGRESS" | "READY_FOR_DECISION" | "DECIDED" | "FIELD_CHANGE_REQUESTS";
type QueueSort = "URGENCY" | "QUEUE_DAYS" | "RECEIVED_AT";
type FieldChangeQueueItem =
  | { kind: "pending"; id: string; pending: AdminPendingFieldChangeRequest }
  | { kind: "review"; id: string; review: AdminReviewCaseSummary };

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
  if (decision === "REJECTED") return "Rifiutata";
  if (decision === "INTEGRATION_REQUIRED") return "Integrazione richiesta";
  return "N/A";
}

function decisionToneClass(decision?: string | null): string {
  if (decision === "APPROVED") return " decision-approved";
  if (decision === "REJECTED") return " decision-rejected";
  return "";
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
    || key.startsWith("fcr.")
    || key.startsWith("document_renewal.")
    || key.includes("integration")
    || event.entityType === "REVAMP_APPLICATION"
    || event.entityType === "FIELD_CHANGE_REQUEST"
    || event.entityType === "DOCUMENT_RENEWAL_REQUEST"
  );
}

function fieldChangeGroupLabel(sectionKey: string | null | undefined): string {
  const configured = sectionKey ? getFcrGroup(sectionKey) : undefined;
  if (configured) return configured.label;
  const normalized = (sectionKey ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    ateco_b: "Codici ATECO",
    ateco: "Codici ATECO",
    dimensione: "Dimensione aziendale",
    regioni_op: "Regioni operative",
    acc_formazione: "Accreditamento formazione",
    terzo_settore: "Terzo settore",
    tipo_prof: "Tipologia professionale",
    comp_secondarie: "Competenze secondarie",
    dati_personali: "Dati personali",
    dati_fiscali: "Dati fiscali",
    indirizzo: "Indirizzo",
    contatti: "Contatti",
    foto_profilo: "Foto profilo"
  };
  return labels[normalized] ?? (sectionKey || "Modifica dati");
}

function fieldChangeRequestedGroupLabel(sectionKey: string | null | undefined): string {
  const configured = sectionKey ? getFcrGroup(sectionKey) : undefined;
  return configured ? `Sezione ${configured.step}` : "Sezione n/d";
}

function isNewApplicationAttention(row: AdminReviewCaseSummary): boolean {
  return row.status === "PENDING_ASSIGNMENT" && row.reviewType !== "FIELD_CHANGE";
}

function isFieldChangeReview(row: AdminReviewCaseSummary): boolean {
  return row.reviewType === "FIELD_CHANGE" || Boolean(row.fieldChangeRequestId);
}

function fieldChangeAttentionId(row: AdminReviewCaseSummary): string {
  return row.fieldChangeRequestId?.trim() || row.id;
}

function renewalProgressTooltip(row: AdminReviewCaseSummary): string | undefined {
  if (row.reviewType !== "DOCUMENT_RENEWAL") return undefined;
  const submitted = row.documentRenewalSubmittedCount ?? 0;
  const pending = row.documentRenewalPendingSupplierCount ?? 0;
  if (submitted === 0 && pending === 0) return "Rinnovo documenti in gestione.";
  const submittedText = `${submitted} ${submitted === 1 ? "documento inviato" : "documenti inviati"} in revisione`;
  const pendingText = `${pending} ${pending === 1 ? "documento ancora da aggiornare" : "documenti ancora da aggiornare"} dal fornitore`;
  if (submitted > 0 && pending > 0) return `Rinnovo documenti: ${submittedText}, ${pendingText}.`;
  if (submitted > 0) return `Rinnovo documenti: ${submittedText}.`;
  return `Rinnovo documenti: ${pendingText}.`;
}

function collapseAllTabRows(rows: AdminReviewCaseSummary[]): AdminReviewCaseSummary[] {
  const byApplication = new Map<string, AdminReviewCaseSummary>();
  rows.forEach((row) => {
    const previous = byApplication.get(row.applicationId);
    if (!previous) {
      byApplication.set(row.applicationId, row);
      return;
    }
    if (previous.status === "DECIDED" && row.status !== "DECIDED") {
      byApplication.set(row.applicationId, row);
      return;
    }
    if (previous.status !== "DECIDED" && row.status === "DECIDED") {
      return;
    }
    if (Date.parse(row.updatedAt) > Date.parse(previous.updatedAt)) {
      byApplication.set(row.applicationId, row);
    }
  });
  return Array.from(byApplication.values());
}

export function AdminQueuePage() {
  const { auth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [pendingFieldChanges, setPendingFieldChanges] = useState<AdminPendingFieldChangeRequest[]>([]);
  const [decidedLoading, setDecidedLoading] = useState(false);
  const [fieldChangesLoading, setFieldChangesLoading] = useState(false);
  const [busyFcrFor, setBusyFcrFor] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [highlightedFieldChangeIds, setHighlightedFieldChangeIds] = useState<Set<string>>(() => new Set());
  const [highlightedNewCandidatureIds, setHighlightedNewCandidatureIds] = useState<Set<string>>(() => new Set());
  const [attentionRevision, setAttentionRevision] = useState(0);
  const queueRefreshInFlightRef = useRef(false);
  const queueRefreshQueuedRef = useRef(false);
  const canAssign = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE";
  const canManageFcr = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const queueReturnPath = activeTab === "FIELD_CHANGE_REQUESTS"
    ? "/admin/candidature?tab=modifiche-dati"
    : activeTab === "PENDING_ASSIGNMENT"
      ? "/admin/candidature?tab=nuove-candidature"
      : `/admin/candidature${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  function reviewHref(applicationId: string): string {
    return `/admin/candidature/${applicationId}/review?returnTo=${encodeURIComponent(queueReturnPath)}`;
  }

  function fieldChangeProfileHref(item: AdminPendingFieldChangeRequest): string {
    if (!item.profileId) return reviewHref(item.applicationId);
    const basePath = item.registryType === "ALBO_B" ? "/admin/albo-b" : "/admin/albo-a";
    return `${basePath}/${item.profileId}?returnTo=${encodeURIComponent("/admin/candidature?tab=modifiche-dati")}`;
  }

  useEffect(() => {
    if (searchParams.get("tab") === "modifiche-dati") {
      setActiveTab(canManageFcr ? "FIELD_CHANGE_REQUESTS" : "ALL");
    } else if (searchParams.get("tab") === "nuove-candidature") {
      setActiveTab("PENDING_ASSIGNMENT");
    }
  }, [canManageFcr, searchParams]);

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

  const loadPendingFieldChanges = useCallback(async () => {
    if (!token || !canManageFcr) {
      setPendingFieldChanges([]);
      return;
    }
    setFieldChangesLoading(true);
    try {
      const data = await listPendingAdminFieldChangeRequests(token);
      setPendingFieldChanges([...data].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento richieste modifica dati non riuscito.";
      setToast({ message, type: "error" });
      setPendingFieldChanges([]);
    } finally {
      setFieldChangesLoading(false);
    }
  }, [canManageFcr, token]);

  useEffect(() => {
    void loadQueue(true);
    void loadDecided();
    if (canManageFcr) void loadPendingFieldChanges();
  }, [canManageFcr, loadQueue, loadDecided, loadPendingFieldChanges]);

  useEffect(() => {
    if (activeTab === "DECIDED") void loadDecided();
    if (activeTab === "FIELD_CHANGE_REQUESTS" && canManageFcr) void loadPendingFieldChanges();
    if (activeTab === "FIELD_CHANGE_REQUESTS" && !canManageFcr) setActiveTab("ALL");
  }, [activeTab, canManageFcr, loadDecided, loadPendingFieldChanges]);

  useAdminRealtimeRefresh({
    token,
    shouldRefresh: shouldRefreshQueue,
    onRefresh: () => {
      loadQueue(false);
      if (activeTab === "DECIDED") void loadDecided();
      if (canManageFcr) void loadPendingFieldChanges();
    }
  });

  const counters = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const regularRows = rows.filter((row) => !isFieldChangeReview(row));

    return {
      pendingReview: regularRows.filter((r) => r.status === "PENDING_ASSIGNMENT").length,
      integrationRequested: regularRows.filter((r) => r.status === "WAITING_SUPPLIER_RESPONSE").length,
      inProgress: regularRows.filter((r) => r.status === "IN_PROGRESS").length,
      readyForDecision: regularRows.filter((r) => r.status === "READY_FOR_DECISION").length,
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
      }).length,
      pendingFieldChanges: pendingFieldChanges.length
    };
  }, [rows, decidedRows, pendingFieldChanges]);


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
    ...(canManageFcr ? [{
      id: "field-change",
      title: "Modifiche dati",
      value: counters.pendingFieldChanges,
      icon: <ListChecks className="h-4 w-4" />,
      trend: counters.pendingFieldChanges > 0 ? "da sbloccare" : "nessuna richiesta",
      level: counters.pendingFieldChanges === 0 ? "ok" : "attention",
      levelLabel: counters.pendingFieldChanges === 0 ? "Normale" : "Richieste",
      tone: counters.pendingFieldChanges === 0 ? "ok" : "attention"
    }] : []),
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
    const regularRows = rows.filter((row) => !isFieldChangeReview(row));
    const regularDecidedRows = decidedRows.filter((row) => !isFieldChangeReview(row));
    const source = activeTab === "DECIDED"
      ? regularDecidedRows
      : activeTab === "ALL"
        ? collapseAllTabRows([...regularRows, ...regularDecidedRows])
        : regularRows;
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
  }, [activeTab, rows, decidedRows, sortBy, sortDir, searchQ]);

  const filteredFieldChanges = useMemo(() => {
    const term = searchQ.trim().toLowerCase();
    const pendingIds = new Set(pendingFieldChanges.map((item) => item.id));
    const reviewItems = rows
      .filter((row) => isFieldChangeReview(row) && row.status !== "DECIDED")
      .filter((row) => !row.fieldChangeRequestId || !pendingIds.has(row.fieldChangeRequestId))
      .map((review) => ({ kind: "review" as const, id: fieldChangeAttentionId(review), review }));
    const pendingItems = pendingFieldChanges.map((pending) => ({ kind: "pending" as const, id: pending.id, pending }));
    const allItems: FieldChangeQueueItem[] = [...pendingItems, ...reviewItems];
    const selected = term ? allItems.filter((item) => {
      if (item.kind === "pending") {
        const code = (item.pending.protocolCode?.trim() || `APP-${item.pending.applicationId.slice(0, 8).toUpperCase()}`).toLowerCase();
        const name = (item.pending.supplierDisplayName ?? "").toLowerCase();
        const email = (item.pending.supplierEmail ?? "").toLowerCase();
        const group = fieldChangeGroupLabel(item.pending.sectionKey).toLowerCase();
        return code.includes(term) || name.includes(term) || email.includes(term) || group.includes(term);
      }
      const code = displayAppCode(item.review).toLowerCase();
      const name = (item.review.applicantDisplayName ?? "").toLowerCase();
      const group = fieldChangeGroupLabel(item.review.fieldChangeSectionKey).toLowerCase();
      return code.includes(term) || name.includes(term) || group.includes(term);
    }) : allItems;
    return [...selected].sort((a, b) => {
      const aDate = a.kind === "pending" ? a.pending.createdAt : a.review.updatedAt;
      const bDate = b.kind === "pending" ? b.pending.createdAt : b.review.updatedAt;
      const compare = Date.parse(aDate) - Date.parse(bDate);
      return sortDir === "DESC" ? -compare : compare;
    });
  }, [pendingFieldChanges, rows, searchQ, sortDir]);

  const unseenTabCounts = useMemo(() => {
    const fieldChangeIds = filteredFieldChanges.map((item) => item.id);
    const newCandidatureIds = rows.filter(isNewApplicationAttention).map((row) => row.id);
    return {
      fieldChanges: getUnseenAdminAttentionIds("fieldChanges", fieldChangeIds, auth?.userId, auth?.email).length,
      newCandidatures: getUnseenAdminAttentionIds("newCandidatures", newCandidatureIds, auth?.userId, auth?.email).length
    };
  }, [attentionRevision, auth?.email, auth?.userId, pendingFieldChanges, rows]);

  useEffect(() => {
    if (activeTab !== "FIELD_CHANGE_REQUESTS" || fieldChangesLoading) return;
    const visibleIds = filteredFieldChanges.map((item) => item.id);
    const unseenIds = getUnseenAdminAttentionIds("fieldChanges", visibleIds, auth?.userId, auth?.email);
    if (unseenIds.length === 0) return;
    setHighlightedFieldChangeIds(new Set(unseenIds));
    markAdminAttentionSeen("fieldChanges", unseenIds, auth?.userId, auth?.email);
    setAttentionRevision((value) => value + 1);
  }, [activeTab, auth?.email, auth?.userId, fieldChangesLoading, filteredFieldChanges]);

  useEffect(() => {
    if (activeTab !== "ALL" && activeTab !== "PENDING_ASSIGNMENT") return;
    if (loading || decidedLoading) return;
    const visibleIds = filteredRows.filter(isNewApplicationAttention).map((row) => row.id);
    const unseenIds = getUnseenAdminAttentionIds("newCandidatures", visibleIds, auth?.userId, auth?.email);
    if (unseenIds.length === 0) return;
    setHighlightedNewCandidatureIds(new Set(unseenIds));
    markAdminAttentionSeen("newCandidatures", unseenIds, auth?.userId, auth?.email);
    setAttentionRevision((value) => value + 1);
  }, [activeTab, auth?.email, auth?.userId, decidedLoading, filteredRows, loading]);

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

  async function handleFcrAction(fcrId: string, action: "unlock" | "reject") {
    if (!token || !canManageFcr || busyFcrFor) return;
    setBusyFcrFor(fcrId);
    try {
      if (action === "unlock") {
        await adminUnlockSection(fcrId, {}, token);
        setToast({ message: "Sezione sbloccata per il fornitore.", type: "success" });
      } else {
        await adminRejectChangeRequest(fcrId, {}, token);
        setToast({ message: "Richiesta modifica dati rifiutata.", type: "success" });
      }
      await loadPendingFieldChanges();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Azione sulla richiesta modifica non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setBusyFcrFor(null);
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
              ["ALL", "Tutte", 0],
              ["PENDING_ASSIGNMENT", "In attesa", unseenTabCounts.newCandidatures],
              ["WAITING_SUPPLIER_RESPONSE", "Integrazione", 0],
              ["IN_PROGRESS", "In carico", 0],
              ["READY_FOR_DECISION", "Da decidere", 0],
              ...(canManageFcr ? [["FIELD_CHANGE_REQUESTS", "Modifiche dati", unseenTabCounts.fieldChanges] as const] : []),
              ["DECIDED", "Decise", 0],
            ] as const).map(([id, label, unseenCount]) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? "is-active" : ""}
                onClick={() => {
                  setActiveTab(id);
                  if (id === "FIELD_CHANGE_REQUESTS") {
                    setSearchParams({ tab: "modifiche-dati" });
                  } else if (id === "PENDING_ASSIGNMENT") {
                    setSearchParams({ tab: "nuove-candidature" });
                  } else if (searchParams.has("tab")) {
                    setSearchParams({});
                  }
                }}
              >
                <span>{label}</span>
                {unseenCount > 0 ? <span className="admin-status-tab-unseen">{unseenCount}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-queue-sort-segmented" role="group" aria-label="Ordina coda">
          <button type="button" className={sortBy === "RECEIVED_AT" ? "admin-queue-sort-option active" : "admin-queue-sort-option"} onClick={() => setSortBy("RECEIVED_AT")}>
            <CalendarDays className="admin-queue-sort-icon" aria-hidden="true" /><span>Data ricezione</span>
          </button>
          <button type="button" className={sortBy === "QUEUE_DAYS" ? "admin-queue-sort-option active" : "admin-queue-sort-option"} onClick={() => setSortBy("QUEUE_DAYS")}>
            <Clock3 className="admin-queue-sort-icon" aria-hidden="true" /><span>Coda</span>
          </button>
          <button type="button" className={sortBy === "URGENCY" ? "admin-queue-sort-option active" : "admin-queue-sort-option"} onClick={() => setSortBy("URGENCY")}>
            <AlertTriangle className="admin-queue-sort-icon" aria-hidden="true" /><span>Priorita</span>
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
          {activeTab === "FIELD_CHANGE_REQUESTS" ? (
            <>
              {fieldChangesLoading ? <p className="subtle admin-unified-table-empty">Caricamento...</p> : null}
              {!fieldChangesLoading && filteredFieldChanges.length === 0 ? <p className="subtle admin-unified-table-empty">Nessuna richiesta modifica dati in attesa.</p> : null}
              {!fieldChangesLoading && filteredFieldChanges.length > 0 ? (
                <div className="admin-queue-table admin-unified-table admin-unified-table-clean admin-queue-table--revamp admin-queue-table--field-changes">
                  <div className="admin-queue-row admin-queue-row-head admin-unified-table-row admin-unified-table-row-head">
                    <span>Pratica</span>
                    <span>Fornitore</span>
                    <span>Albo</span>
                    <span>Gruppo richiesto</span>
                    <span>Campo da modificare</span>
                    <span>Richiesta il</span>
                    <span>Stato</span>
                    <span>Messaggio</span>
                    <span>Apri</span>
                    <span>Azioni</span>
                  </div>
                  {filteredFieldChanges.map((item) => {
                    if (item.kind === "review") {
                      const row = item.review;
                      const busy = busyAssignFor === row.applicationId;
                      const isHighlighted = highlightedFieldChangeIds.has(item.id);
                      const assignedLabel = row.assignedToDisplayName?.trim() || "Non assegnata";
                      const canAssignRow = canAssign && canManageFcr;
                      return (
                        <div key={`review-${item.id}`} className={`admin-queue-row admin-unified-table-row${isHighlighted ? " queue-row-highlight" : ""}`}>
                          <div className="queue-main-cell">
                            <div className="queue-app-code" tabIndex={0} aria-label={`UUID: ${row.applicationId}`}>
                              <strong>{displayAppCode(row)}</strong>
                              <span className="queue-uuid-tooltip" role="tooltip">UUID: {row.applicationId}</span>
                            </div>
                          </div>
                          <span className="queue-nominativo-cell" title={row.applicantDisplayName || "—"}>{row.applicantDisplayName || "—"}</span>
                          <span>{row.registryType === "ALBO_B" ? "Albo B" : row.registryType === "ALBO_A" ? "Albo A" : "—"}</span>
                          <span className="queue-pill status">{fieldChangeRequestedGroupLabel(row.fieldChangeSectionKey)}</span>
                          <span className="queue-pill status">{fieldChangeGroupLabel(row.fieldChangeSectionKey)}</span>
                          <span>{new Date(row.updatedAt).toLocaleDateString("it-IT")}</span>
                          <span className="queue-pill status">
                            {statusLabel(row.status)}
                            {row.status === "PENDING_ASSIGNMENT" ? <span className="queue-assign-badge">Da assegnare</span> : null}
                            {!row.verifiedAt ? null : <span className="queue-verified-badge">Verificata</span>}
                            <span className="queue-assign-badge">Modifica dati</span>
                          </span>
                          <span className="subtle queue-message-cell">Aggiornamento inviato dal fornitore.</span>
                          <div className="queue-open-cell">
                            <Link className="queue-manage-link" to={reviewHref(row.applicationId)}>
                              <ClipboardList className="queue-manage-icon queue-manage-icon-examine" aria-hidden="true" />
                              <span className="queue-manage-link-label">Esamina</span>
                            </Link>
                          </div>
                          <div className="queue-actions" style={{ gap: 8 }}>
                            {row.status === "PENDING_ASSIGNMENT" ? (
                              <button
                                type="button"
                                className="queue-action-take queue-action-take-ghost"
                                disabled={!canAssignRow || busy}
                                onClick={() => void takeInCharge(row)}
                              >
                                <Hand className="queue-action-take-icon" />
                                {busy ? "Presa in carico..." : "Prendi in carico"}
                              </button>
                            ) : (
                              <span className="queue-assignee-name" title={assignedLabel}>{assignedLabel}</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    const pending = item.pending;
                    const code = pending.protocolCode?.trim() || `APP-${pending.applicationId.slice(0, 8).toUpperCase()}`;
                    const busy = busyFcrFor === pending.id;
                    const isHighlighted = highlightedFieldChangeIds.has(item.id);
                    return (
                      <div key={item.id} className={`admin-queue-row admin-unified-table-row${isHighlighted ? " queue-row-highlight" : ""}`}>
                        <div className="queue-main-cell">
                          <div className="queue-app-code" tabIndex={0} aria-label={`UUID: ${pending.applicationId}`}>
                            <strong>{code}</strong>
                            <span className="queue-uuid-tooltip" role="tooltip">UUID: {pending.applicationId}</span>
                          </div>
                        </div>
                        <span className="queue-nominativo-cell" title={pending.supplierDisplayName || pending.supplierEmail || "—"}>{pending.supplierDisplayName || pending.supplierEmail || "—"}</span>
                        <span>{pending.registryType === "ALBO_B" ? "Albo B" : pending.registryType === "ALBO_A" ? "Albo A" : "—"}</span>
                        <span className="queue-pill status">{fieldChangeRequestedGroupLabel(pending.sectionKey)}</span>
                        <span className="queue-pill status">{fieldChangeGroupLabel(pending.sectionKey)}</span>
                        <span>{new Date(pending.createdAt).toLocaleDateString("it-IT")}</span>
                        <span className="queue-pill status">
                          In attesa sblocco
                          <span className="queue-assign-badge">Modifica dati</span>
                        </span>
                        <span className="subtle queue-message-cell" title={pending.supplierMessage || "—"}>{pending.supplierMessage || "—"}</span>
                        <div className="queue-open-cell">
                          <Link className="queue-manage-link" to={fieldChangeProfileHref(pending)}>
                            <span className="queue-manage-link-arrow" aria-hidden="true">&#8599;</span>
                            <span className="queue-manage-link-label">Apri</span>
                          </Link>
                        </div>
                        <div className="queue-actions" style={{ gap: 8 }}>
                          <button
                            type="button"
                            className="queue-action-take queue-action-take-ghost queue-action-take-unlock"
                            disabled={!canManageFcr || busy}
                            onClick={() => void handleFcrAction(pending.id, "unlock")}
                          >
                            <CheckCircle2 className="queue-action-take-icon" aria-hidden="true" />
                            <span>{busy ? "..." : "Sblocca"}</span>
                          </button>
                          <button
                            type="button"
                            className="queue-action-take queue-action-take-ghost queue-action-take-reject"
                            disabled={!canManageFcr || busy}
                            onClick={() => void handleFcrAction(pending.id, "reject")}
                          >
                            <XCircle className="queue-action-take-icon" aria-hidden="true" />
                            <span>Rifiuta</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : null}
          {activeTab !== "FIELD_CHANGE_REQUESTS" && (loading || (activeTab === "DECIDED" && decidedLoading)) ? <p className="subtle admin-unified-table-empty">Caricamento...</p> : null}
          {activeTab !== "FIELD_CHANGE_REQUESTS" && !loading && !decidedLoading && filteredRows.length === 0 ? <p className="subtle admin-unified-table-empty">Nessuna pratica per il filtro selezionato.</p> : null}
          {activeTab !== "FIELD_CHANGE_REQUESTS" && !loading && !decidedLoading && filteredRows.length > 0 ? (
            <div className={`admin-queue-table admin-unified-table admin-unified-table-clean admin-queue-table--revamp${activeTab === "DECIDED" ? " admin-queue-table--decided" : ""}`}>
              <div className="admin-queue-row admin-queue-row-head admin-unified-table-row admin-unified-table-row-head">
                <span>Candidatura</span>
                <span>Nominativo</span>
                <span>Ricevuta il</span>
                <span>In coda da</span>
                <span>Stato</span>
                {activeTab !== "DECIDED" ? <span>Priorita / esito</span> : null}
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
                const fieldChangeReview = isFieldChangeReview(row);
                const isDocumentRenewalReview = row.reviewType === "DOCUMENT_RENEWAL";
                const canAssignRow = canAssign && !(fieldChangeReview && adminRole === "REVISORE");
                const isAttentionHighlighted = highlightedNewCandidatureIds.has(row.id);
                const isDecidedRow = row.status === "DECIDED";
                const actionLabel = isDecidedRow ? "Dettagli" : "Esamina";
                const renewalTooltip = renewalProgressTooltip(row);
                const actionIcon = isDecidedRow
                  ? <Eye className="queue-manage-icon queue-manage-icon-details" aria-hidden="true" />
                  : <ClipboardList className="queue-manage-icon queue-manage-icon-examine" aria-hidden="true" />;

                return (
                  <div key={row.id} className={`admin-queue-row admin-unified-table-row${recentlyAssigned === row.applicationId || isAttentionHighlighted ? " queue-row-highlight" : ""}`}>
                    <div className="queue-main-cell">
                      <div className="queue-app-code" tabIndex={0} aria-label={`UUID: ${row.applicationId}`}>
                        <strong>{displayAppCode(row)}</strong>
                        <span className="queue-uuid-tooltip" role="tooltip">UUID: {row.applicationId}</span>
                      </div>
                    </div>
                    <span className="queue-nominativo-cell" title={row.applicantDisplayName ?? "—"}>{row.applicantDisplayName ?? "—"}</span>
                    <span>{new Date(row.updatedAt).toLocaleDateString("it-IT")}</span>
                    <span className={`queue-days-cell queue-days-${daysTone(days)}`}>
                      <Clock3 className="h-4 w-4" /> {days === 0 ? "Arrivato oggi" : `${days} giorni`}
                    </span>
                    <span className={`queue-pill status${isDecidedRow ? decisionToneClass(row.decision) : ""}`}>
                      {statusLabel(row.status)}
                      {activeTab !== "DECIDED" && row.status === "PENDING_ASSIGNMENT" ? <span className="queue-assign-badge">Da assegnare</span> : null}
                      {fieldChangeReview && activeTab !== "DECIDED" && row.status !== "DECIDED" ? <span className="queue-assign-badge">Modifica dati</span> : null}
                      {isDecidedRow ? <span className="queue-decision-badge">{decisionLabel(row.decision)}</span> : null}
                      {!isDecidedRow && row.verifiedAt ? <span className="queue-verified-badge">Verificata</span> : null}
                      {!isDecidedRow && activeTab !== "DECIDED" && isDocumentRenewalReview ? <span className="queue-assign-badge" title={renewalTooltip}>Rinnovo doc.</span> : null}
                    </span>
                    {activeTab !== "DECIDED" ? (
                      row.status === "DECIDED" ? (
                        <span className="queue-pill urgency no-due urgency-level">Chiusa</span>
                      ) : (
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
                      )
                    ) : null}
                    <div className="queue-actions">
                      {(row.status === "PENDING_ASSIGNMENT" && adminRole !== "SUPER_ADMIN") || examineLockedForUser ? (
                        <span className={`${actionClass} is-disabled`} aria-disabled="true">
                          {actionIcon}
                          <span className="queue-manage-link-label">{actionLabel}</span>
                        </span>
                      ) : (
                        <Link className={actionClass} to={reviewHref(row.applicationId)}>
                          {actionIcon}
                          <span className="queue-manage-link-label">{actionLabel}</span>
                        </Link>
                      )}
                    </div>
                    <div className="queue-assignment-cell">
                      {row.status === "PENDING_ASSIGNMENT" ? (
                        <button
                          type="button"
                          className="queue-action-take queue-action-take-ghost"
                          disabled={!canAssignRow || busyAssignFor === row.applicationId}
                          onClick={() => void takeInCharge(row)}
                          title={!canAssignRow && fieldChangeReview ? "Disponibile solo per Super Admin o Responsabile Albo" : undefined}
                        >
                          <Hand className="queue-action-take-icon" />
                          {busyAssignFor === row.applicationId ? "Presa in carico..." : "Prendi in carico"}
                        </button>
                      ) : (
                        <span className="queue-assignee-name" title={assignedLabel}>{assignedLabel}</span>
                      )}
                    </div>
                    {activeTab === "DECIDED" ? (
                      <span className="queue-decided-by-cell" title={row.decidedByDisplayName?.trim() || "—"}>
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
