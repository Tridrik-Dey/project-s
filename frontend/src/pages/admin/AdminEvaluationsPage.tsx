import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, BarChart2, ClipboardList, Eye, Search, Star, Trash2, UserCheck, X } from "lucide-react";
import { useParams } from "react-router-dom";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import {
  deleteAdminEvaluation,
  getAdminEvaluationAnalytics,
  getAdminEvaluationAssignments,
  getAdminEvaluationList,
  getAdminEvaluationOverview,
  selfAssignSupplier,
  submitEvaluation,
  type AdminEvaluationAnalytics,
  type AdminEvaluationAssignmentRow,
  type AdminEvaluationOverview,
  type AdminEvaluationOverviewFilters,
  type AdminEvaluationOverviewRow,
  type AdminEvaluationSummary,
  type SubmitEvaluationPayload,
} from "../../api/adminEvaluationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

type MainTab = "OVERVIEW" | "MY_ASSIGNMENTS";
type ScoreFilter = "ALL" | "HIGH" | "MID" | "LOW";

type EvalForm = {
  overallScore: number;
  dimensions: Record<string, number>;
  collaborationType: string;
  collaborationPeriod: string;
  referenceCode: string;
  comment: string;
};

const EMPTY_OVERVIEW: AdminEvaluationOverview = {
  totalEvaluations: 0,
  averageOverallScore: 0,
  currentMonthEvaluations: 0,
  evaluatedSuppliers: 0,
  rows: []
};

const EMPTY_ANALYTICS: AdminEvaluationAnalytics = {
  supplierRegistryProfileId: "",
  supplierName: null,
  supplierType: null,
  totalEvaluations: 0,
  averageOverallScore: 0,
  dimensionAverages: {},
  scoreDistribution: {},
  history: []
};

const EMPTY_FORM: EvalForm = {
  overallScore: 0,
  dimensions: {},
  collaborationType: "",
  collaborationPeriod: "",
  referenceCode: "",
  comment: ""
};

const DIMENSIONS = [
  { key: "quality", label: "Qualità tecnica" },
  { key: "timeliness", label: "Rispetto tempi" },
  { key: "communication", label: "Comunicazione" },
  { key: "flexibility", label: "Flessibilità" },
  { key: "value", label: "Qualità/Prezzo" }
];

function shouldRefreshEvaluations(event: DashboardActivityEvent): boolean {
  const key = event.eventKey ?? "";
  return key.includes("evaluation") || (event.entityType ?? "").includes("EVALUATION");
}

function typeLabel(value: string | null | undefined): string {
  if (value === "ALBO_A") return "Albo A";
  if (value === "ALBO_B") return "Albo B";
  return "-";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("it-IT");
}

function stars(value: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function initials(value: string | null | undefined): string {
  const parts = (value || "Fornitore").split(" ").filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "F";
}

function scoreTone(score: number): string {
  if (score >= 4.5) return "tone-excellent";
  if (score >= 4.0) return "tone-good";
  if (score >= 3.0) return "tone-watch";
  return "tone-risk";
}

function scoreLabel(score: number): string {
  if (score >= 4.5) return "Eccellente";
  if (score >= 4.0) return "Molto buono";
  if (score >= 3.0) return "Adeguato";
  if (score >= 2.0) return "Sufficiente";
  return "Insufficiente";
}

function dimBarStyle(value: number): string {
  if (value >= 4.5) return "linear-gradient(90deg,#2f9a62,#1f8050)";
  if (value >= 4.0) return "linear-gradient(90deg,#52b983,#2f9a62)";
  if (value >= 3.0) return "linear-gradient(90deg,#d8962e,#bb7920)";
  return "linear-gradient(90deg,#e06040,#c04828)";
}

const DIM_LABEL: Record<string, string> = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.label]));

function StarInput({ value, onChange, disabled = false }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="eval-star-input" role="group" aria-label="Valutazione a stelle">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" className={star <= value ? "on" : ""} onClick={() => onChange(star)} disabled={disabled}>
          {star <= value ? "★" : "☆"}
        </button>
      ))}
      <strong>{value > 0 ? `${value}/5` : "Da compilare"}</strong>
    </div>
  );
}

function ReadOnlyStars({ value }: { value: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="eval-readonly-stars" aria-label={`${value.toFixed(1)} su 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rounded ? "is-on" : ""}>{s <= rounded ? "★" : "☆"}</span>
      ))}
      <strong>{value.toFixed(1)}</strong>
    </span>
  );
}

export function AdminEvaluationsPage(_props: { mode?: string }) {
  const { supplierId: routeSupplierId } = useParams();
  const { auth } = useAuth();
  const { adminRole } = useAdminGovernanceRole();
  const token = auth?.token ?? "";
  const isViewer = adminRole === "VIEWER";
  const isSuperAdmin = adminRole === "SUPER_ADMIN";

  const [tab, setTab] = useState<MainTab>("OVERVIEW");
  const [overview, setOverview] = useState<AdminEvaluationOverview>(EMPTY_OVERVIEW);
  const [assignments, setAssignments] = useState<AdminEvaluationAssignmentRow[]>([]);
  const [selectedOverviewRow, setSelectedOverviewRow] = useState<AdminEvaluationOverviewRow | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(routeSupplierId ?? null);
  const [analytics, setAnalytics] = useState<AdminEvaluationAnalytics>(EMPTY_ANALYTICS);
  const [supplierEvaluations, setSupplierEvaluations] = useState<AdminEvaluationSummary[]>([]);
  const [evalForm, setEvalForm] = useState<EvalForm>(EMPTY_FORM);
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [overviewFilters] = useState<AdminEvaluationOverviewFilters>({ limit: 200 });
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "ALBO_A" | "ALBO_B">("ALL");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("ALL");

  const myAssignment = useMemo(() => {
    if (!isViewer || !selectedSupplierId) return null;
    return assignments.find((a) => a.supplierRegistryProfileId === selectedSupplierId) ?? null;
  }, [assignments, isViewer, selectedSupplierId]);

  const isAssignedToMe = Boolean(myAssignment?.assignmentId);
  const hasMyEvaluation = Boolean(myAssignment?.evaluationId);

  const evaluatedRows = useMemo(() =>
    overview.rows.filter(r => r.evaluationId !== null),
  [overview.rows]);

  const unevaluatedRows = useMemo(() =>
    overview.rows.filter(r => r.evaluationId === null),
  [overview.rows]);

  const myOpenAssignmentsCount = useMemo(() =>
    assignments.filter(a => a.assignmentId && !a.evaluationId).length,
  [assignments]);

  const computedOverallScore = useMemo(() => {
    const vals = DIMENSIONS.map((d) => evalForm.dimensions[d.key] ?? 0).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [evalForm.dimensions]);

  const visibleEvaluatedRows = useMemo(() => {
    const term = searchQ.trim().toLowerCase();
    return evaluatedRows
      .filter(row => {
        if (typeFilter !== "ALL" && row.supplierType !== typeFilter) return false;
        if (scoreFilter === "HIGH" && row.averageScore < 4) return false;
        if (scoreFilter === "MID" && (row.averageScore < 3 || row.averageScore >= 4)) return false;
        if (scoreFilter === "LOW" && row.averageScore >= 3) return false;
        return !term || (row.supplierName ?? "").toLowerCase().includes(term);
      })
      .slice(0, 200);
  }, [evaluatedRows, searchQ, typeFilter, scoreFilter]);

  const visibleUnevaluatedRows = useMemo(() => {
    const term = searchQ.trim().toLowerCase();
    return unevaluatedRows
      .filter(row => {
        if (typeFilter !== "ALL" && row.supplierType !== typeFilter) return false;
        return !term || (row.supplierName ?? "").toLowerCase().includes(term);
      })
      .slice(0, 200);
  }, [unevaluatedRows, searchQ, typeFilter]);

  const visibleAssignments = useMemo(() => {
    const term = searchQ.trim().toLowerCase();
    return assignments.filter((row) =>
      !term || (row.supplierName ?? "").toLowerCase().includes(term) || (row.assignedEvaluatorEmail ?? "").toLowerCase().includes(term)
    );
  }, [assignments, searchQ]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    const data = await getAdminEvaluationOverview(token, overviewFilters);
    setOverview(data);
  }, [overviewFilters, token]);

  const loadAssignments = useCallback(async () => {
    if (!token) return;
    const rows = await getAdminEvaluationAssignments(token);
    setAssignments(rows);
  }, [token]);

  const loadPage = useCallback(async (showLoader = true) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    try {
      await Promise.all([loadOverview(), loadAssignments().catch(() => {})]);
    } catch (error) {
      setToast({ message: error instanceof HttpError ? error.message : "Caricamento non riuscito.", type: "error" });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [loadAssignments, loadOverview, token]);

  useEffect(() => { void loadPage(true); }, [loadPage]);

  useAdminRealtimeRefresh({ token, shouldRefresh: shouldRefreshEvaluations, onRefresh: () => loadPage(false) });

  const loadSupplierDetail = useCallback(async (supplierId: string) => {
    if (!token) return;
    try {
      const [analyticsData, evals] = await Promise.all([
        getAdminEvaluationAnalytics(supplierId, token),
        getAdminEvaluationList(supplierId, token)
      ]);
      setAnalytics(analyticsData);
      setSupplierEvaluations(evals);
    } catch {
      setToast({ message: "Errore nel caricamento dei dettagli.", type: "error" });
    }
  }, [token]);

  useEffect(() => {
    if (selectedSupplierId) {
      void loadSupplierDetail(selectedSupplierId);
    } else {
      setAnalytics(EMPTY_ANALYTICS);
      setSupplierEvaluations([]);
      setShowEvalForm(false);
    }
  }, [loadSupplierDetail, selectedSupplierId]);

  function openEvalForm() {
    setEvalForm(EMPTY_FORM);
    setShowEvalForm(true);
  }

  async function handleSelfAssign() {
    if (!selectedSupplierId || busy) return;
    setBusy("assign");
    try {
      await selfAssignSupplier(selectedSupplierId, token);
      setToast({ message: "Fornitore preso in carico.", type: "success" });
      await loadAssignments();
    } catch (error) {
      setToast({ message: error instanceof HttpError ? error.message : "Errore nell'assegnazione.", type: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmitEval(e: FormEvent) {
    e.preventDefault();
    if (!selectedSupplierId || busy) return;
    if (computedOverallScore < 1) {
      setToast({ message: "Inserisci almeno un punteggio per categoria.", type: "error" });
      return;
    }
    if (!evalForm.collaborationType.trim()) {
      setToast({ message: "Inserisci il tipo di collaborazione.", type: "error" });
      return;
    }
    if (!evalForm.collaborationPeriod.trim()) {
      setToast({ message: "Inserisci il periodo di collaborazione.", type: "error" });
      return;
    }
    setBusy("submit");
    try {
      const payload: SubmitEvaluationPayload = {
        collaborationType: evalForm.collaborationType,
        collaborationPeriod: evalForm.collaborationPeriod,
        referenceCode: evalForm.referenceCode || undefined,
        overallScore: computedOverallScore,
        comment: evalForm.comment || undefined,
        dimensions: Object.keys(evalForm.dimensions).length > 0 ? evalForm.dimensions : undefined
      };
      await submitEvaluation(selectedSupplierId, payload, token);
      setToast({ message: "Valutazione salvata.", type: "success" });
      setShowEvalForm(false);
      await Promise.all([loadPage(false), loadSupplierDetail(selectedSupplierId)]);
    } catch (error) {
      setToast({ message: error instanceof HttpError ? error.message : "Errore nell'invio.", type: "error" });
    } finally {
      setBusy(null);
    }
  }

  function handleDeleteEval(evaluationId: string) {
    if (!isSuperAdmin || busy) return;
    setPendingDelete(evaluationId);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || !isSuperAdmin) return;
    const evaluationId = pendingDelete;
    setPendingDelete(null);
    setBusy(`del-${evaluationId}`);
    try {
      await deleteAdminEvaluation(evaluationId, token);
      setToast({ message: "Valutazione eliminata.", type: "success" });
      if (selectedSupplierId) await loadSupplierDetail(selectedSupplierId);
      await loadPage(false);
    } catch (error) {
      setToast({ message: error instanceof HttpError ? error.message : "Errore nell'eliminazione.", type: "error" });
    } finally {
      setBusy(null);
    }
  }

  function selectSupplier(supplierId: string, overviewRow?: AdminEvaluationOverviewRow) {
    setSelectedSupplierId(supplierId);
    setSelectedOverviewRow(overviewRow ?? null);
    setShowEvalForm(false);
  }

  const selectedSupplierName = useMemo(() => {
    if (!selectedSupplierId) return null;
    if (selectedOverviewRow) return selectedOverviewRow.supplierName;
    const row = assignments.find((a) => a.supplierRegistryProfileId === selectedSupplierId);
    if (row) return row.supplierName;
    return analytics.supplierName;
  }, [analytics.supplierName, assignments, selectedOverviewRow, selectedSupplierId]);

  return (
    <AdminCandidatureShell active="valutazioni">
      {toast && <AppToast toast={toast} onClose={() => setToast(null)} />}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="modal-overlay eval-delete-overlay" onClick={() => setPendingDelete(null)}>
          <div className="modal-panel eval-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eval-delete-modal-warning">
              <AlertTriangle size={22} />
              <h4>Elimina valutazione</h4>
            </div>
            <p className="subtle">Questa azione è irreversibile. La valutazione verrà eliminata definitivamente.</p>
            <div className="modal-actions">
              <button className="eval-btn-secondary" onClick={() => setPendingDelete(null)}>Annulla</button>
              <button className="eval-delete-btn" onClick={() => void handleConfirmDelete()}>
                <Trash2 size={14} /> Conferma eliminazione
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header — always visible */}
      <header className="superadmin-top eval-page-top">
        <div>
          <h2 className="admin-page-title-standard"><Star className="h-5 w-5" /> Valutazioni</h2>
          <p className="subtle">Valori ufficiali separati dalle assegnazioni da completare.</p>
        </div>
        <div className="eval-view-toggle">
          <button
            className={`eval-view-btn ${tab === "OVERVIEW" ? "is-active" : ""}`}
            onClick={() => setTab("OVERVIEW")}
          >
            <span className="eval-view-btn-icon"><Star size={15} /></span>
            <span className="eval-view-btn-text">
              <span>Valutati</span>
              <small>valori registrati</small>
            </span>
          </button>
          <button
            className={`eval-view-btn ${tab === "MY_ASSIGNMENTS" ? "is-active" : ""}`}
            onClick={() => setTab("MY_ASSIGNMENTS")}
          >
            <span className="eval-view-btn-icon"><ClipboardList size={15} /></span>
            <span className="eval-view-btn-text">
              <span>Da valutare</span>
              <small>lavori aperti</small>
            </span>
          </button>
        </div>
      </header>

      {/* KPI cards */}
      <div className="admin-evaluations-kpis">
          <article className="panel superadmin-kpi-card tone-ok">
            <div className="superadmin-kpi-head">
              <h4>Valutati</h4>
              <span className="superadmin-kpi-icon" aria-hidden="true"><Star size={13} /></span>
            </div>
            <strong>{overview.evaluatedSuppliers}</strong>
            <div className="superadmin-kpi-foot">
              <span className="superadmin-kpi-trend">fornitori con valore</span>
              <span className="superadmin-kpi-level level-ok">Media {overview.averageOverallScore > 0 ? overview.averageOverallScore.toFixed(1) : "—"}</span>
            </div>
          </article>

          <article className="panel superadmin-kpi-card tone-attention">
            <div className="superadmin-kpi-head">
              <h4>Mie assegnazioni</h4>
              <span className="superadmin-kpi-icon" aria-hidden="true"><UserCheck size={13} /></span>
            </div>
            <strong>{myOpenAssignmentsCount}</strong>
            <div className="superadmin-kpi-foot">
              <span className="superadmin-kpi-trend">da seguire</span>
              <span className="superadmin-kpi-level level-attention">0 scadute</span>
            </div>
          </article>

          <article className="panel superadmin-kpi-card tone-info">
            <div className="superadmin-kpi-head">
              <h4>Da assegnare</h4>
              <span className="superadmin-kpi-icon" aria-hidden="true"><ClipboardList size={13} /></span>
            </div>
            <strong>{unevaluatedRows.length}</strong>
            <div className="superadmin-kpi-foot">
              <span className="superadmin-kpi-trend">senza valutatore</span>
              <span className="superadmin-kpi-level level-info">0 in scadenza</span>
            </div>
          </article>

          <article className="panel superadmin-kpi-card tone-progress">
            <div className="superadmin-kpi-head">
              <h4>In rivalutazione</h4>
              <span className="superadmin-kpi-icon" aria-hidden="true"><BarChart2 size={13} /></span>
            </div>
            <strong>0</strong>
            <div className="superadmin-kpi-foot">
              <span className="superadmin-kpi-trend">nuovi cicli aperti</span>
              <span className="superadmin-kpi-level level-info">aggiornamento live</span>
            </div>
          </article>
        </div>

      {/* Filter bar — single row white card */}
      <div className="eval-filter-card">
        <div className="eval-search-wrap">
          <Search size={15} className="eval-search-icon" />
          <input
            type="search"
            placeholder="Cerca fornitore valutato..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="eval-search-input"
          />
        </div>
        <div className="eval-filter-section">
          <span className="eval-filter-label">ALBO</span>
          <div className="eval-type-tabs">
            <button className={`eval-type-tab ${typeFilter === "ALL" ? "is-active" : ""}`} onClick={() => setTypeFilter("ALL")}>Tutti</button>
            <button className={`eval-type-tab ${typeFilter === "ALBO_A" ? "is-active" : ""}`} onClick={() => setTypeFilter("ALBO_A")}>Albo A</button>
            <button className={`eval-type-tab ${typeFilter === "ALBO_B" ? "is-active" : ""}`} onClick={() => setTypeFilter("ALBO_B")}>Albo B</button>
          </div>
        </div>
        {tab === "OVERVIEW" && (
          <div className="eval-filter-section">
            <span className="eval-filter-label">PUNTEGGIO</span>
            <div className="eval-type-tabs">
              <button className={`eval-type-tab ${scoreFilter === "ALL" ? "is-active" : ""}`} onClick={() => setScoreFilter("ALL")}>Tutti</button>
              <button className={`eval-type-tab ${scoreFilter === "HIGH" ? "is-active" : ""}`} onClick={() => setScoreFilter("HIGH")}>4+</button>
              <button className={`eval-type-tab ${scoreFilter === "MID" ? "is-active" : ""}`} onClick={() => setScoreFilter("MID")}>3-4</button>
              <button className={`eval-type-tab ${scoreFilter === "LOW" ? "is-active" : ""}`} onClick={() => setScoreFilter("LOW")}>Sotto 3</button>
            </div>
          </div>
        )}
        <button className="eval-sort-btn"><ArrowUpDown size={14} /> Recenti</button>
      </div>

      {/* Main list */}
      {loading ? (
        <div className="eval-loading">Caricamento...</div>
      ) : tab === "OVERVIEW" ? (
        visibleEvaluatedRows.length === 0 ? (
          <div className="eval-empty">Nessuna valutazione trovata.</div>
        ) : (
          <EvalTable
            rows={visibleEvaluatedRows}
            onSelect={(row) => selectSupplier(row.supplierRegistryProfileId, row)}
          />
        )
      ) : isViewer ? (
        <div className="eval-list">
          {visibleAssignments.length === 0 ? (
            <div className="eval-empty">Nessun fornitore trovato. Vai alla sezione Valutati per prendere in carico un fornitore.</div>
          ) : (
            visibleAssignments.map((row) => (
              <button
                key={row.supplierRegistryProfileId}
                className={`eval-row ${row.evaluationId ? "evaluated" : row.assignmentId ? "assigned" : "unassigned"}`}
                onClick={() => selectSupplier(row.supplierRegistryProfileId)}
              >
                <span className="eval-row-avatar">{initials(row.supplierName)}</span>
                <span className="eval-row-info">
                  <strong title={row.supplierName ?? row.supplierRegistryProfileId}>{row.supplierName ?? row.supplierRegistryProfileId}</strong>
                  <span className="eval-row-type" title={typeLabel(row.supplierType)}>{typeLabel(row.supplierType)}</span>
                </span>
                <span className="eval-row-status">
                  {row.evaluationId ? (
                    <span className="eval-badge done">{stars(row.evaluationScore ?? 0)} Valutato</span>
                  ) : row.assignmentId ? (
                    <span className="eval-badge in-progress">In carico — da valutare</span>
                  ) : (
                    <span className="eval-badge unassigned">Non preso in carico</span>
                  )}
                </span>
                {row.evaluatedAt && <span className="eval-row-date">{formatDate(row.evaluatedAt)}</span>}
              </button>
            ))
          )}
        </div>
      ) : (
        visibleUnevaluatedRows.length === 0 ? (
          <div className="eval-empty">Nessun fornitore da valutare.</div>
        ) : (
          <EvalTable
            rows={visibleUnevaluatedRows}
            onSelect={(row) => selectSupplier(row.supplierRegistryProfileId, row)}
            unevaluated
          />
        )
      )}

      {/* Detail modal */}
      {selectedSupplierId && (
        <div className="modal-overlay eval-detail-overlay" onClick={() => { setSelectedSupplierId(null); setSelectedOverviewRow(null); }}>
          <div className="eval-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eval-detail-modal-head">
              <div className="eval-detail-modal-head-left">
                <span className="eval-detail-modal-breadcrumb">Fornitore</span>
                <span className="eval-detail-modal-title">{selectedSupplierName ?? "Dettaglio"}</span>
              </div>
              <button
                className="eval-detail-modal-close"
                onClick={() => { setSelectedSupplierId(null); setSelectedOverviewRow(null); }}
                aria-label="Chiudi"
              >
                <X size={18} />
              </button>
            </div>
            <div className="eval-detail-modal-body">
              <SupplierDetail
                supplierId={selectedSupplierId}
                supplierName={selectedSupplierName}
                analytics={analytics}
                evaluations={supplierEvaluations}
                isViewer={isViewer}
                isSuperAdmin={isSuperAdmin}
                isAssignedToMe={isAssignedToMe}
                hasMyEvaluation={hasMyEvaluation}
                myAssignmentRow={myAssignment}
                showEvalForm={showEvalForm}
                evalForm={evalForm}
                computedOverallScore={computedOverallScore}
                busy={busy}
                onSelfAssign={handleSelfAssign}
                onOpenForm={openEvalForm}
                onCloseForm={() => setShowEvalForm(false)}
                onFormChange={(field, value) => setEvalForm((prev) => ({ ...prev, [field]: value }))}
                onDimensionChange={(key, value) =>
                  setEvalForm((prev) => ({ ...prev, dimensions: { ...prev.dimensions, [key]: value } }))
                }
                onSubmitEval={handleSubmitEval}
                onDeleteEval={handleDeleteEval}
              />
            </div>
          </div>
        </div>
      )}
    </AdminCandidatureShell>
  );
}

/* ========================= EVAL TABLE ========================= */

function EvalTable({
  rows,
  onSelect,
  canEvaluate = false,
  unevaluated = false,
}: {
  rows: AdminEvaluationOverviewRow[];
  onSelect: (row: AdminEvaluationOverviewRow) => void;
  canEvaluate?: boolean;
  unevaluated?: boolean;
}) {
  return (
    <div className="eval-table-wrap">
      <div className="eval-table-head">
        <div>CANDIDATURA</div>
        <div>FORNITORE</div>
        <div>ALBO</div>
        <div>ESITO</div>
        <div>VALUTATORE</div>
        <div>DATA</div>
        <div>AZIONI</div>
      </div>
      {rows.map((row, index) => {
        const canEvaluateRow = unevaluated && canEvaluate;
        const actionLabel = canEvaluateRow ? "Valuta" : unevaluated ? "Dettagli" : "Apri dettagli";
        const ActionIcon = canEvaluateRow ? ClipboardList : Eye;
        return (
        <div
          key={row.evaluationId ?? `${row.supplierRegistryProfileId}-${index}`}
          className="eval-table-row"
          onClick={() => onSelect(row)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect(row)}
        >
          <div className="eval-col-candidatura">
            <span>{row.protocolCode ?? "-"}</span>
          </div>
          <div className="eval-col-supplier">
            <div className="eval-row-avatar">{initials(row.supplierName)}</div>
            <div className="eval-supplier-info">
              <strong>{row.supplierName ?? row.supplierRegistryProfileId}</strong>
            </div>
          </div>
          <div className="eval-col-albo">
            <span className="eval-type-tag">{typeLabel(row.supplierType)}</span>
          </div>
          <div className="eval-col-esito">
            {unevaluated ? (
              <span className="eval-pending-badge">Da valutare</span>
            ) : (
              <>
                <div className={`eval-score-ring ${scoreTone(row.averageScore)}`}>{row.averageScore.toFixed(1)}</div>
                <div className="eval-esito-info">
                  <strong>{scoreLabel(row.averageScore)}</strong>
                  {row.evaluationCount && row.evaluationCount > 1 ? (
                    <small>{row.evaluationCount} valutazioni</small>
                  ) : null}
                  <span className="eval-stars-sm">{stars(row.averageScore)}</span>
                </div>
              </>
            )}
          </div>
          <div className="eval-col-evaluator">
            <span>{row.evaluatorDisplay ?? "—"}</span>
            <small>{unevaluated ? "Non assegnato" : row.evaluationCount && row.evaluationCount > 1 ? "Aggregato" : "Valutatore"}</small>
          </div>
          <div className="eval-col-date">
            <span>{unevaluated ? "—" : formatDate(row.createdAt)}</span>
            <small>{unevaluated ? "Nessuna valutazione" : "Ultima valutazione"}</small>
          </div>
          <div className="eval-col-actions">
              <button
                className={`eval-open-link${canEvaluateRow ? " eval-open-link-evaluate" : ""}`}
                onClick={(e) => { e.stopPropagation(); onSelect(row); }}
              >
              <ActionIcon className="eval-open-link-icon" aria-hidden="true" />
              <span>{actionLabel}</span>
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

/* ========================= SUPPLIER DETAIL PANEL ========================= */

interface SupplierDetailProps {
  supplierId: string;
  supplierName: string | null;
  analytics: AdminEvaluationAnalytics;
  evaluations: AdminEvaluationSummary[];
  isViewer: boolean;
  isSuperAdmin: boolean;
  isAssignedToMe: boolean;
  hasMyEvaluation: boolean;
  myAssignmentRow: AdminEvaluationAssignmentRow | null;
  showEvalForm: boolean;
  evalForm: EvalForm;
  computedOverallScore: number;
  busy: string | null;
  onSelfAssign: () => void;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onFormChange: (field: keyof EvalForm, value: unknown) => void;
  onDimensionChange: (key: string, value: number) => void;
  onSubmitEval: (e: FormEvent) => void;
  onDeleteEval: (evaluationId: string) => void;
}

function SupplierDetail({
  supplierId,
  supplierName,
  analytics,
  evaluations,
  isViewer,
  isSuperAdmin,
  isAssignedToMe,
  hasMyEvaluation,
  myAssignmentRow,
  showEvalForm,
  evalForm,
  computedOverallScore,
  busy,
  onSelfAssign,
  onOpenForm,
  onCloseForm,
  onFormChange,
  onDimensionChange,
  onSubmitEval,
  onDeleteEval
}: SupplierDetailProps) {
  return (
    <div className="eval-detail">
      {/* Hero banner: avatar + name + score ring + action button */}
      <div className="eval-hero">
        <div className="eval-hero-avatar">{initials(supplierName)}</div>
        <div className="eval-hero-info">
          <h2 className="eval-hero-name">{supplierName ?? supplierId}</h2>
          {analytics.supplierType && <span className="eval-detail-type">{typeLabel(analytics.supplierType)}</span>}
        </div>
        <div className="eval-hero-right">
          {analytics.totalEvaluations > 0 && (
            <>
              <div className={`eval-score-ring eval-hero-ring ${scoreTone(analytics.averageOverallScore)}`}>
                {analytics.averageOverallScore.toFixed(1)}
              </div>
              <span className="eval-hero-count">
                {analytics.totalEvaluations} valutazion{analytics.totalEvaluations === 1 ? "e" : "i"}
              </span>
            </>
          )}
          {isViewer && !showEvalForm && (
            !isAssignedToMe ? (
              <button className="eval-btn-hero" onClick={onSelfAssign} disabled={busy === "assign"}>
                <UserCheck size={15} />
                {busy === "assign" ? "Assegnazione..." : "Prendi in carico"}
              </button>
            ) : (
              <button className="eval-btn-hero" onClick={onOpenForm}>
                <Star size={15} />
                {hasMyEvaluation ? "Ri-valuta" : "Valuta fornitore"}
              </button>
            )
          )}
        </div>
      </div>

      {isViewer && myAssignmentRow?.evaluationId && !showEvalForm && (
        <div className="eval-my-evaluation">
          <div className="eval-my-eval-left">
            <h3>La mia valutazione</h3>
            <ReadOnlyStars value={myAssignmentRow.evaluationScore ?? 0} />
          </div>
          <div className="eval-my-eval-right">
            <span className="eval-date">Aggiornato il {formatDate(myAssignmentRow.evaluatedAt)}</span>
          </div>
        </div>
      )}

      {isViewer && showEvalForm && (
        <form className="eval-form" onSubmit={onSubmitEval}>
          {/* Header with icon */}
          <div className="eval-form-head">
            <div className="eval-form-head-icon"><Star size={16} /></div>
            <div>
              <h3>{hasMyEvaluation ? "Aggiorna valutazione" : "Nuova valutazione"}</h3>
              <span className="eval-form-head-sub">I campi con * sono obbligatori</span>
            </div>
          </div>

          {/* Overall score — read-only, auto-computed from dimensions */}
          <div className="eval-form-score-card">
            <label className="eval-form-score-label">Punteggio complessivo</label>
            <div className="eval-form-score-display">
              <span className="eval-form-score-value">
                {computedOverallScore > 0 ? computedOverallScore.toFixed(1) : "—"}
              </span>
              <span className="eval-form-score-stars">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={s <= Math.round(computedOverallScore) ? "is-on" : ""}>
                    {s <= Math.round(computedOverallScore) ? "★" : "☆"}
                  </span>
                ))}
              </span>
              <span className="eval-form-score-hint">Media automatica delle categorie</span>
            </div>
          </div>

          {/* Dimension rows — compact horizontal list */}
          <div className="eval-form-dims">
            <p className="eval-form-group-title">Valutazione per categoria</p>
            {DIMENSIONS.map((dim) => (
              <div key={dim.key} className="eval-form-dim-row">
                <span className="eval-form-dim-label">{dim.label}</span>
                <StarInput
                  value={evalForm.dimensions[dim.key] ?? 0}
                  onChange={(v) => onDimensionChange(dim.key, v)}
                />
              </div>
            ))}
          </div>

          {/* Collaboration details — grouped card */}
          <div className="eval-form-meta">
            <p className="eval-form-group-title">Dettagli collaborazione</p>
            <div className="eval-form-section">
              <label className="eval-label">Tipo collaborazione *</label>
              <input type="text" className="eval-input" placeholder="es. Fornitura materiali, Consulenza..." value={evalForm.collaborationType} onChange={(e) => onFormChange("collaborationType", e.target.value)} required />
            </div>
            <div className="eval-form-section">
              <label className="eval-label">Periodo collaborazione *</label>
              <input type="text" className="eval-input" placeholder="es. 2024-Q3, Gen-Mar 2025..." value={evalForm.collaborationPeriod} onChange={(e) => onFormChange("collaborationPeriod", e.target.value)} required />
            </div>
            <div className="eval-form-section">
              <label className="eval-label">Codice riferimento</label>
              <input type="text" className="eval-input" placeholder="Numero contratto, ordine..." value={evalForm.referenceCode} onChange={(e) => onFormChange("referenceCode", e.target.value)} />
            </div>
            <div className="eval-form-section">
              <label className="eval-label">Note</label>
              <textarea className="eval-textarea" placeholder="Osservazioni, commenti..." value={evalForm.comment} onChange={(e) => onFormChange("comment", e.target.value)} rows={3} />
            </div>
          </div>

          <div className="eval-form-actions">
            <button type="button" className="eval-btn-secondary" onClick={onCloseForm} disabled={Boolean(busy)}>Annulla</button>
            <button type="submit" className="eval-btn-primary" disabled={Boolean(busy)}>
              {busy === "submit" ? "Invio..." : hasMyEvaluation ? "Aggiorna" : "Invia valutazione"}
            </button>
          </div>
        </form>
      )}

      {analytics.totalEvaluations > 0 && !showEvalForm && Object.keys(analytics.dimensionAverages).length > 0 && (
        <div className="eval-dimensions">
          <p className="eval-section-title">Medie per categoria</p>
          {Object.entries(analytics.dimensionAverages).map(([key, value]) => (
            <div key={key} className="eval-dimension-row">
              <span className="eval-dimension-label">{DIM_LABEL[key] ?? key}</span>
              <div className="eval-dimension-bar">
                <div className="eval-dimension-fill" style={{ width: `${(value / 5) * 100}%`, background: dimBarStyle(value) }} />
              </div>
              <span className="eval-dimension-score">{value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {analytics.totalEvaluations > 0 && !showEvalForm && Object.keys(analytics.scoreDistribution).length > 0 && (
        <div className="eval-score-dist">
          <p className="eval-section-title">Distribuzione punteggi</p>
          {([5, 4, 3, 2, 1] as const).map((score) => {
            const count = analytics.scoreDistribution[String(score)] ?? 0;
            const pct = analytics.totalEvaluations > 0 ? (count / analytics.totalEvaluations) * 100 : 0;
            return (
              <div key={score} className="eval-dist-row">
                <span className="eval-dist-label">{"★".repeat(score)}</span>
                <div className="eval-dist-bar-track">
                  <div className={`eval-dist-bar-fill score-${score}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="eval-dist-count">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {analytics.history.length > 0 && !showEvalForm && (() => {
        const emailByEvalId = new Map(evaluations.map((e) => [e.id, e.evaluatorEmail]));
        return (
          <div className="eval-evaluations-list">
            <p className="eval-section-title">Valutazioni ({analytics.history.length})</p>
            {analytics.history.map((item) => {
              const email = emailByEvalId.get(item.evaluationId);
              const isDeleting = busy === `del-${item.evaluationId}`;
              return (
                <div key={item.evaluationId} className="eval-evaluation-item">
                  <div className="eval-evaluation-header">
                    <ReadOnlyStars value={item.averageScore} />
                    <span className="eval-evaluation-date">{formatDate(item.createdAt)}</span>
                    {isSuperAdmin && email && (
                      <span className="eval-evaluation-evaluator">{email}</span>
                    )}
                    {isSuperAdmin && (
                      <button
                        className="eval-delete-btn"
                        onClick={() => onDeleteEval(item.evaluationId)}
                        disabled={isDeleting}
                        aria-label="Elimina valutazione"
                        style={{ marginLeft: "auto" }}
                      >
                        <Trash2 size={14} />
                        {isDeleting ? "..." : "Elimina"}
                      </button>
                    )}
                  </div>
                  {(item.collaborationType || item.collaborationPeriod || item.referenceCode) && (
                    <div className="eval-evaluation-meta">
                      {item.collaborationType && <span className="eval-collab-type">{item.collaborationType}</span>}
                      {item.collaborationPeriod && <span className="eval-collab-period">{item.collaborationPeriod}</span>}
                      {item.referenceCode && <span className="eval-ref-code">Rif. {item.referenceCode}</span>}
                    </div>
                  )}
                  {item.comment && <p className="eval-evaluation-comment">{item.comment}</p>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {evaluations.length === 0 && !showEvalForm && (
        <div className="eval-empty-detail">
          <Star size={32} className="eval-empty-icon" />
          <p>Nessuna valutazione ancora per questo fornitore.</p>
          {isViewer && isAssignedToMe && (
            <button className="eval-btn-primary" onClick={() => onOpenForm()}>
              <Star size={16} /> Valuta ora
            </button>
          )}
          {isViewer && !isAssignedToMe && (
            <button className="eval-btn-primary" onClick={onSelfAssign} disabled={busy === "assign"}>
              <UserCheck size={16} /> {busy === "assign" ? "..." : "Prendi in carico"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
