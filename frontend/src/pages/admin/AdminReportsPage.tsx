import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Building2, CalendarDays, Check, ChevronDown, ClipboardCheck, Clock3, FileSpreadsheet, Filter, PieChart, Printer, RefreshCw, Settings2, TrendingUp, Trophy, UserPlus, Users } from "lucide-react";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import { HttpError } from "../../api/http";
import {
  exportAdminKpisReport,
  exportAdminReportExcel,
  exportAdminQuickReport,
  getAdminReportAnalytics,
  type AdminReportFilters,
  type AdminReportAnalytics,
  type AdminReportKpis,
  type QuickExportType
} from "../../api/adminReportApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

const EMPTY_KPIS: AdminReportKpis = {
  totalSuppliers: 0,
  activeSuppliers: 0,
  pendingSuppliers: 0,
  submittedApplications: 0,
  pendingInvites: 0
};

const EMPTY_ANALYTICS: AdminReportAnalytics = {
  kpis: EMPTY_KPIS,
  alboAActive: 0,
  alboBActive: 0,
  newRegistrationsYtd: 0,
  evaluationsYtd: 0,
  approvalRatePct: 0,
  monthlyPoints: [],
  thematicRanking: [],
  distribution: [],
  topSuppliers: []
};

function shouldRefreshReports(event: DashboardActivityEvent): boolean {
  const key = event.eventKey ?? "";
  return (
    key.startsWith("revamp.invite.")
    || key.startsWith("revamp.application.")
    || key.startsWith("revamp.review.")
    || key.includes("evaluation")
    || key.includes("profile")
    || event.entityType === "REVAMP_SUPPLIER_REGISTRY_PROFILE"
  );
}


type QuickExportPreset = "albo" | "queue" | "eval" | "annual";
type ReportChartType = "bar" | "pie";
type ReportChartWindow = "6m" | "12m";
type TopicLimit = 5 | 10;
type ReportYearFilter = "ALL" | number;
const REPORT_START_YEAR = 2024;

type ReportSelectOption<T extends string | number> = {
  value: T;
  label: string;
};

type ReportFilterSelectProps<T extends string | number> = {
  label: string;
  value: T;
  options: ReportSelectOption<T>[];
  onChange: (value: T) => void;
};

function ReportFilterSelect<T extends string | number>({ label, value, options, onChange }: ReportFilterSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target || rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`admin-report-select-field ${open ? "is-open" : ""}`}>
      <span className="admin-report-select-label">{label}</span>
      <button
        type="button"
        className="admin-report-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? ""}</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="admin-report-select-menu" role="listbox" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              className={`admin-report-select-option ${active ? "is-selected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="option"
              aria-selected={active}
            >
              <span>{option.label}</span>
              {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function stars(score: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(score)));
  return `${"*".repeat(rounded)}${"-".repeat(5 - rounded)}`;
}

function initialsFromName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "NA";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function inferRegistryTag(subtitle: string): string {
  const lower = subtitle.toLowerCase();
  if (lower.includes("albo a")) return "Albo A";
  if (lower.includes("albo b")) return "Albo B";
  return "Albo";
}

function optionLabel<T extends string | number>(options: ReportSelectOption<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

async function triggerDownload(blob: Blob, filename: string): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function AdminReportsPage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const [analytics, setAnalytics] = useState<AdminReportAnalytics>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"excel" | "csv" | QuickExportPreset | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [year, setYear] = useState<ReportYearFilter>(new Date().getFullYear());
  const [registryType, setRegistryType] = useState<"ALL" | "ALBO_A" | "ALBO_B">("ALL");
  const [category, setCategory] = useState<string>("ALL");

  useEffect(() => { setCategory("ALL"); }, [registryType]);
  const [chartType, setChartType] = useState<ReportChartType>("bar");
  const [chartWindow, setChartWindow] = useState<ReportChartWindow>("12m");
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const [topicLimit, setTopicLimit] = useState<TopicLimit>(5);
  const chartSettingsRef = useRef<HTMLDivElement | null>(null);
  const reportRefreshInFlightRef = useRef(false);
  const reportRefreshQueuedRef = useRef(false);
  const { adminRole } = useAdminGovernanceRole();

  const kpis = analytics.kpis;
  const canExport = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const yearOptions = useMemo<ReportSelectOption<ReportYearFilter>[]>(() => {
    const currentYear = new Date().getFullYear();
    const lastYear = Math.max(REPORT_START_YEAR, currentYear);
    const years = Array.from({ length: lastYear - REPORT_START_YEAR + 1 }, (_, index) => {
      const value = REPORT_START_YEAR + index;
      return { value, label: String(value) };
    });
    return [{ value: "ALL", label: "Tutti" }, ...years];
  }, []);
  const registryOptions: ReportSelectOption<"ALL" | "ALBO_A" | "ALBO_B">[] = [
    { value: "ALL", label: "Tutti" },
    { value: "ALBO_A", label: "Albo A" },
    { value: "ALBO_B", label: "Albo B" }
  ];
  const ALBO_A_CATEGORIES: ReportSelectOption<string>[] = [
    { value: "ALL", label: "Tutte" },
    { value: "DOCENTE", label: "Docente / Formatore" },
    { value: "CONSULENTE_HR", label: "Consulente HR / Sviluppo Organizzativo" },
    { value: "CDO_LAVORO", label: "Consulente del Lavoro" },
    { value: "COMMERCIALISTA", label: "Commercialista / Dottore Commercialista" },
    { value: "AVVOCATO", label: "Avvocato / Consulente Legale" },
    { value: "DIGITAL", label: "Consulente Digital & E-Learning" },
    { value: "FINANZA", label: "Consulente Finanza Agevolata e Bandi" },
    { value: "PSICOLOGO", label: "Psicologo del Lavoro / Career Coach" },
    { value: "ORIENTATORE", label: "Orientatore professionale" },
    { value: "RICERCATORE", label: "Ricercatore / Valutatore" },
    { value: "ALTRO", label: "Altro professionista (specificare)" }
  ];
  const ALBO_B_CATEGORIES: ReportSelectOption<string>[] = [
    { value: "ALL", label: "Tutte" },
    { value: "CAT_A", label: "Cat. A – Formazione, didattica e contenuti" },
    { value: "CAT_B", label: "Cat. B – HR, lavoro e organizzazione" },
    { value: "CAT_C", label: "Cat. C – Tecnologia e digitale" },
    { value: "CAT_D", label: "Cat. D – Consulenza e compliance" },
    { value: "CAT_E", label: "Cat. E – Servizi generali e operativi" }
  ];
  const categoryOptions: ReportSelectOption<string>[] =
    registryType === "ALBO_A" ? ALBO_A_CATEGORIES :
    registryType === "ALBO_B" ? ALBO_B_CATEGORIES :
    [{ value: "ALL", label: "Tutte" }];
  const activeRatio = kpis.totalSuppliers > 0 ? (kpis.activeSuppliers / kpis.totalSuppliers) * 100 : 0;
  const approvalRatio = analytics.approvalRatePct;
  const hasApprovalData = analytics.evaluationsYtd > 0 || analytics.newRegistrationsYtd > 0;
  const monthlyData = analytics.monthlyPoints;
  const selectedYearLabel = optionLabel(yearOptions, year);
  const reportFilters: AdminReportFilters = useMemo(() => ({
    year: year === "ALL" ? undefined : year,
    registryType: registryType === "ALL" ? undefined : registryType,
    category: category === "ALL" ? undefined : category
  }), [year, registryType, category]);

  const visibleMonthlyData = useMemo(() => {
    if (chartWindow === "6m") return monthlyData.slice(-6);
    return monthlyData.slice(-12);
  }, [monthlyData, chartWindow]);
  const maxMonthly = useMemo(
    () => Math.max(1, ...visibleMonthlyData.map((row) => Math.max(row.alboA, row.alboB))),
    [visibleMonthlyData]
  );
  const monthlyTotals = useMemo(() => visibleMonthlyData.map((row) => row.alboA + row.alboB), [visibleMonthlyData]);
  const totalA = useMemo(() => visibleMonthlyData.reduce((sum, row) => sum + row.alboA, 0), [visibleMonthlyData]);
  const totalB = useMemo(() => visibleMonthlyData.reduce((sum, row) => sum + row.alboB, 0), [visibleMonthlyData]);
  const totalAll = totalA + totalB;
  const totalAPct = totalAll > 0 ? Math.round((totalA / totalAll) * 100) : 0;
  const totalBPct = totalAll > 0 ? 100 - totalAPct : 0;
  const bestMonth = useMemo(() => {
    if (visibleMonthlyData.length === 0) return null;
    return visibleMonthlyData.reduce((best, row) =>
      row.alboA + row.alboB > best.alboA + best.alboB ? row : best
    );
  }, [visibleMonthlyData]);
  const lastMonthDeltaPct = useMemo(() => {
    if (monthlyTotals.length < 2) return null;
    const latest = monthlyTotals[monthlyTotals.length - 1];
    const prev = monthlyTotals[monthlyTotals.length - 2];
    if (prev <= 0) return null;
    return Math.round(((latest - prev) / prev) * 100);
  }, [monthlyTotals]);
  const sparseData = useMemo(() => visibleMonthlyData.filter((row) => row.alboA + row.alboB > 0).length <= 1, [visibleMonthlyData]);
  const lastExportLabel = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString("it-IT") : "n/d";
  const sourceThematicRanking = analytics.thematicRanking;
  const thematicRows = useMemo(
    () => [...sourceThematicRanking].sort((a, b) => b.value - a.value).slice(0, topicLimit),
    [sourceThematicRanking, topicLimit]
  );
  const thematicTotal = useMemo(
    () => sourceThematicRanking.reduce((sum, row) => sum + row.value, 0),
    [sourceThematicRanking]
  );
  const thematicBase = Math.max(1, ...sourceThematicRanking.map((row) => row.value));
  const thematicRowsWithPercent = useMemo(
    () => thematicRows.map((row) => ({
      ...row,
      percentage: row.percentage > 0 ? row.percentage : (row.value / thematicBase) * 100
    })),
    [thematicRows, thematicBase]
  );
  const sourceTopSuppliers = analytics.topSuppliers;
  const topSuppliersRows = useMemo(
    () => [...sourceTopSuppliers].sort((a, b) => b.averageScore - a.averageScore).slice(0, 5),
    [sourceTopSuppliers]
  );
  const topSuppliersAverage = useMemo(() => {
    if (topSuppliersRows.length === 0) return 0;
    const total = topSuppliersRows.reduce((sum, row) => sum + row.averageScore, 0);
    return total / topSuppliersRows.length;
  }, [topSuppliersRows]);

  const distribution = analytics.distribution.map((row) => {
    const tone =
      row.label === "Attivi" ? "ok" :
      row.label === "Sospesi" ? "warn" :
      row.label === "In attesa" ? "info" :
      row.label === "Rigettati" ? "danger" :
      "neutral";
    const displayLabel = row.label === "In comp." ? "In compilazione" : row.label;
    return { ...row, tone, displayLabel };
  });
  const distributionTotal = distribution.reduce((sum, row) => sum + row.value, 0);
  const quickExportCards = [
    {
      id: "albo",
      title: "Albo completo (.xlsx)",
      subtitle: "I profili attivi con dati completi",
      tone: "info",
      chips: ["Excel", "Profili attivi"],
      format: "XLSX",
      eta: "~10 sec",
      filter: "Tutti gli attivi",
      icon: <Users className="h-4 w-4" />,
      preset: "albo" as QuickExportPreset
    },
    {
      id: "queue",
      title: "Candidature pendenti",
      subtitle: "Lista con giorni in attesa",
      tone: "attention",
      chips: ["Operativo", "Code revisione"],
      format: "CSV",
      eta: "~8 sec",
      filter: "Stato: pending",
      icon: <Clock3 className="h-4 w-4" />,
      preset: "queue" as QuickExportPreset
    },
    {
      id: "eval",
      title: "Report valutazioni",
      subtitle: "Analisi per fornitore e periodo",
      tone: "ok",
      chips: ["Valutazioni", "Performance"],
      format: "CSV",
      eta: "~12 sec",
      filter: "Stato: approved",
      icon: <ClipboardCheck className="h-4 w-4" />,
      preset: "eval" as QuickExportPreset
    },
    {
      id: "annual",
      title: "Statistiche annuali",
      subtitle: "Trend iscrizioni e approvazioni",
      tone: "role",
      chips: ["Annuale", "Trend"],
      format: "CSV",
      eta: "~9 sec",
      filter: `Periodo: ${selectedYearLabel}`,
      icon: <BarChart3 className="h-4 w-4" />,
      preset: "annual" as QuickExportPreset
    }
  ] as const;

  const kpiTiles = [
    {
      key: "total",
      label: "Fornitori attivi (tot.)",
      value: kpis.totalSuppliers,
      icon: <Users className="h-4 w-4" />,
      trend: kpis.totalSuppliers > 0 ? `${activeRatio.toFixed(0)}% attivi` : "Nessun dato",
      tone: "info",
      level: "info",
      levelLabel: kpis.totalSuppliers > 0 ? "Operativo" : "Vuoto"
    },
    {
      key: "a",
      label: "Di cui Albo A",
      value: analytics.alboAActive,
      icon: <Users className="h-4 w-4" />,
      trend: analytics.alboAActive > 0 ? `${analytics.alboAActive} profili` : "Nessun dato",
      tone: "info",
      level: "info",
      levelLabel: analytics.alboAActive > 0 ? "Attivo" : "Vuoto"
    },
    {
      key: "b",
      label: "Di cui Albo B",
      value: analytics.alboBActive,
      icon: <Building2 className="h-4 w-4" />,
      trend: analytics.alboBActive > 0 ? `${analytics.alboBActive} profili` : "Nessun dato",
      tone: "ok",
      level: "ok",
      levelLabel: analytics.alboBActive > 0 ? "Attivo" : "Vuoto"
    },
    {
      key: "new",
      label: "Nuove iscrizioni (YTD)",
      value: analytics.newRegistrationsYtd,
      icon: <UserPlus className="h-4 w-4" />,
      trend: analytics.newRegistrationsYtd > 0 ? `Periodo ${selectedYearLabel}` : "Nessun dato",
      tone: "attention",
      level: "attention",
      levelLabel: analytics.newRegistrationsYtd > 0 ? "Presente" : "Vuoto"
    },
    {
      key: "eval",
      label: "Valutazioni (YTD)",
      value: analytics.evaluationsYtd,
      icon: <ClipboardCheck className="h-4 w-4" />,
      trend: analytics.evaluationsYtd > 0 ? `${analytics.evaluationsYtd} valutazioni` : "Nessun dato",
      tone: "attention",
      level: "attention",
      levelLabel: analytics.evaluationsYtd > 0 ? "Attivo" : "Nessuna"
    },
    {
      key: "approval",
      label: "Tasso approvazione",
      value: `${approvalRatio.toFixed(0)}%`,
      icon: <TrendingUp className="h-4 w-4" />,
      trend: hasApprovalData ? "Dato reale" : "Nessun dato",
      tone: "ok",
      level: !hasApprovalData ? "info" : approvalRatio >= 85 ? "ok" : approvalRatio >= 70 ? "attention" : "critical",
      levelLabel: !hasApprovalData ? "Vuoto" : approvalRatio >= 85 ? "In target" : approvalRatio >= 70 ? "Attenzione" : "Critico"
    }
  ] as const;

  useEffect(() => {
    if (!chartSettingsOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (chartSettingsRef.current?.contains(target)) return;
      setChartSettingsOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setChartSettingsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [chartSettingsOpen]);

  const loadKpis = useCallback(async (showLoading = true) => {
    if (!token) return;
    if (reportRefreshInFlightRef.current) {
      reportRefreshQueuedRef.current = true;
      return;
    }

    reportRefreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const next = await getAdminReportAnalytics(token, reportFilters);
      setAnalytics(next);
      setLastUpdatedAt(Date.now());
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento KPI non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      reportRefreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
      if (reportRefreshQueuedRef.current) {
        reportRefreshQueuedRef.current = false;
        void loadKpis(false);
      }
    }
  }, [reportFilters, token]);

  useEffect(() => {
    void loadKpis(true);
  }, [loadKpis]);

  useAdminRealtimeRefresh({
    token,
    shouldRefresh: shouldRefreshReports,
    onRefresh: () => loadKpis(false)
  });

  async function onExportCsv() {
    if (!token || busy || !canExport) return;
    setBusy("csv");
    try {
      const { blob, filename } = await exportAdminKpisReport(token);
      await triggerDownload(blob, filename);
      setToast({ message: `Export completato: ${filename}`, type: "success" });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Export KPI non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function onExportExcel() {
    if (!token || busy || !canExport) return;
    setBusy("excel");
    try {
      const { blob, filename } = await exportAdminReportExcel(token, reportFilters);
      await triggerDownload(blob, filename);
      setToast({ message: `Export Excel completato: ${filename}`, type: "success" });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Export Excel non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function onQuickExport(preset: QuickExportPreset) {
    if (!token || busy || !canExport) return;
    setBusy(preset);
    try {
      const exportYear = year !== "ALL" ? (year as number) : undefined;
      const { blob, filename } = await exportAdminQuickReport(token, preset as QuickExportType, exportYear);
      await triggerDownload(blob, filename);
      setToast({ message: `Esportazione completata: ${filename}`, type: "success" });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Esportazione non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminCandidatureShell active="report">
      <section className="stack admin-reports-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

        <div className="panel admin-reports-head">
          <div>
            <h2 className="admin-page-title-standard"><BarChart3 className="h-5 w-5" /> Report</h2>
            <p className="subtle">Analisi e monitoraggio dell&apos;Albo Fornitori</p>
          </div>
        </div>

        <div className="admin-reports-kpis">
          {kpiTiles.map((tile) => (
            <article key={tile.key} className={`panel admin-reports-kpi superadmin-kpi-card tone-${tile.tone}`}>
              <div className="superadmin-kpi-head">
                <h4>{tile.label}</h4>
                <span className="superadmin-kpi-icon" aria-hidden="true">{tile.icon}</span>
              </div>
              <strong>{tile.value}</strong>
              <div className="superadmin-kpi-foot">
                <span className="superadmin-kpi-trend">{tile.trend}</span>
                <span className={`superadmin-kpi-level level-${tile.level}`}>{tile.levelLabel}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="panel admin-reports-filters">
          <div className="admin-reports-print-filters" aria-hidden="true">
            <span><strong>Periodo</strong>{selectedYearLabel}</span>
            <span><strong>Tipo Albo</strong>{optionLabel(registryOptions, registryType)}</span>
            <span><strong>Categoria</strong>{optionLabel(categoryOptions, category)}</span>
          </div>
          <ReportFilterSelect
            label="Periodo"
            value={year}
            onChange={setYear}
            options={yearOptions}
          />
          <ReportFilterSelect
            label="Tipo Albo"
            value={registryType}
            onChange={setRegistryType}
            options={registryOptions}
          />
          <ReportFilterSelect
            label="Categoria"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
          <div className="admin-reports-filter-actions">
            <span className="admin-icon-tooltip-wrap reports-head-tooltip-wrap">
              <button
                type="button"
                className={`home-btn home-btn-secondary admin-action-btn reports-action-icon btn-icon-refresh${loading ? " is-loading" : ""}`}
                onClick={() => void loadKpis()}
                disabled={loading}
                aria-label={loading ? "Aggiornamento report in corso" : "Aggiorna report"}
                aria-describedby="reports-refresh-tooltip"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <span id="reports-refresh-tooltip" className="admin-icon-tooltip" role="tooltip">
                {loading ? "Aggiornamento in corso" : "Aggiorna"}
              </span>
            </span>
            <span className="admin-icon-tooltip-wrap reports-head-tooltip-wrap">
              <button
                type="button"
                className="home-btn home-btn-secondary admin-action-btn reports-action-icon btn-icon-print"
                onClick={() => window.print()}
                aria-label="Stampa report"
                aria-describedby="reports-print-tooltip"
              >
                <Printer className="h-4 w-4" />
              </button>
              <span id="reports-print-tooltip" className="admin-icon-tooltip" role="tooltip">Stampa</span>
            </span>
            <button type="button" className="home-btn home-btn-secondary admin-action-btn btn-excel reports-action-excel" onClick={() => void onExportExcel()} disabled={Boolean(busy) || !canExport}>
              <FileSpreadsheet className="h-4 w-4" />
              <span>{busy === "excel" ? "Export..." : "Esporta Excel"}</span>
            </button>
          </div>
        </div>

        <div className="admin-reports-grid-top">
          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <p className="superadmin-card-kicker">TREND</p>
              <div className="admin-reports-trend-head-row">
                <h3><BarChart3 className="h-4 w-4" /> Iscrizioni {year === "ALL" ? "- Tutti gli anni" : `mensili - Anno ${year}`}</h3>
                <div ref={chartSettingsRef} className={`admin-reports-chart-settings-wrap ${chartSettingsOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="admin-reports-chart-settings-btn"
                    onClick={() => setChartSettingsOpen((prev) => !prev)}
                    aria-label="Configura grafico"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                  {chartSettingsOpen ? (
                    <div className="admin-reports-chart-settings-popover">
                      <p className="admin-reports-chart-settings-title">Periodo</p>
                      <div className="admin-reports-chart-segmented">
                        <button type="button" className={`admin-reports-chart-option ${chartWindow === "6m" ? "active" : ""}`} onClick={() => setChartWindow("6m")}>6 mesi</button>
                        <button type="button" className={`admin-reports-chart-option ${chartWindow === "12m" ? "active" : ""}`} onClick={() => setChartWindow("12m")}>12 mesi</button>
                      </div>
                      <p className="admin-reports-chart-settings-title">Tipo grafico</p>
                      <button type="button" className={`admin-reports-chart-option ${chartType === "bar" ? "active" : ""}`} onClick={() => setChartType("bar")}>Barre (Consigliato)</button>
                      <button type="button" className={`admin-reports-chart-option ${chartType === "pie" ? "active" : ""}`} onClick={() => setChartType("pie")}>Torta</button>
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="subtle">Confronto Albo A vs Albo B</p>
            </div>
            <div className="admin-reports-trend-summary">
              <span>Totale: <strong>{totalAll}</strong></span>
              <span>Mese migliore: <strong>{bestMonth ? bestMonth.monthLabel : "n/d"}</strong></span>
              <span>Variazione: <strong>{lastMonthDeltaPct === null ? "n/d" : `${lastMonthDeltaPct > 0 ? "+" : ""}${lastMonthDeltaPct}%`}</strong></span>
            </div>
            <div className="admin-reports-chart-legend">
              <span><i className="legend-a" /> Albo A</span>
              <span><i className="legend-b" /> Albo B</span>
            </div>
            {chartType === "bar" ? (
              <div className="admin-reports-monthly-chart">
                {visibleMonthlyData.map((row) => (
                  <div key={`bar-${row.monthLabel}`} className="monthly-bar-group">
                    <div className="bar-stack">
                      <span className="bar a" style={{ height: `${(row.alboA / maxMonthly) * 120}px` }} title={`Albo A: ${row.alboA}`} />
                      <span className="bar b" style={{ height: `${(row.alboB / maxMonthly) * 120}px` }} title={`Albo B: ${row.alboB}`} />
                    </div>
                    <small>{row.monthLabel}</small>
                  </div>
                ))}
              </div>
            ) : null}
            {chartType === "pie" ? (
              <div className="admin-reports-trend-pie-wrap">
                <div
                  className="admin-reports-trend-pie"
                  style={{ background: totalAll > 0 ? `conic-gradient(#1f4f88 0 ${totalAPct}%, #d4e2ef ${totalAPct}% 100%)` : undefined }}
                  aria-label={`Albo A ${totalA}, Albo B ${totalB}`}
                >
                  <span>{totalAll}</span>
                  <small>totale</small>
                </div>
                <div className="admin-reports-trend-pie-stats">
                  <span><i className="legend-a" /> Albo A <strong>{totalA}</strong> <small>{totalAPct}%</small></span>
                  <span><i className="legend-b" /> Albo B <strong>{totalB}</strong> <small>{totalBPct}%</small></span>
                </div>
              </div>
            ) : null}
            {sparseData ? <p className="admin-reports-trend-empty-note">Dati limitati nel periodo selezionato.</p> : null}
          </article>

          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <p className="superadmin-card-kicker">ANALISI</p>
              <div className="admin-reports-inline-head">
                <h3><ClipboardCheck className="h-4 w-4" /> Top ambiti tematici - Albo A</h3>
                <div className="admin-reports-inline-controls" role="group" aria-label="Numero ambiti da mostrare">
                  <button type="button" className={topicLimit === 5 ? "active" : ""} onClick={() => setTopicLimit(5)}>Top 5</button>
                  <button type="button" className={topicLimit === 10 ? "active" : ""} onClick={() => setTopicLimit(10)}>Top 10</button>
                </div>
              </div>
              <p className="subtle">Aree con piu profili nel periodo. Totale profili in classifica: {thematicTotal}</p>
            </div>
            <div className="admin-reports-topics">
              {thematicRowsWithPercent.length === 0 ? <p className="distribution-empty-note">Nessun ambito disponibile per i filtri selezionati.</p> : null}
              {thematicRowsWithPercent.map((row, idx) => (
                <div key={row.label} className="topic-row">
                  <div className="topic-main">
                    <span className="topic-rank">{idx + 1}</span>
                    <div className="topic-text">
                      <span>{row.label}</span>
                      <small>{row.value} profili • {Math.round(row.percentage)}%</small>
                    </div>
                  </div>
                  <div className="topic-bar-wrap" aria-hidden="true">
                    <div className="topic-bar" style={{ width: `${row.percentage}%` }} />
                  </div>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="admin-reports-grid-bottom">
          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <p className="superadmin-card-kicker">DISTRIBUZIONE</p>
              <h3><PieChart className="h-4 w-4" /> Distribuzione stato profili</h3>
              <p className="subtle">Totale profili: {distributionTotal}</p>
            </div>
            <div className="admin-reports-distribution">
              {distribution.map((row) => {
                const pct = kpis.totalSuppliers > 0 ? Math.round((row.value / kpis.totalSuppliers) * 100) : 0;
                const barWidth = row.value > 0 ? Math.max(8, pct) : 0;
                return (
                  <div key={row.label} className={`distribution-row tone-${row.tone}`}>
                    <div className="distribution-main">
                      <span className={`dot tone-${row.tone}`} />
                      <span className="distribution-label">{row.displayLabel}</span>
                    </div>
                    <div className="distribution-metrics">
                      <strong>{row.value}</strong>
                      <small>{pct}%</small>
                    </div>
                    <div className="distribution-progress" aria-hidden="true">
                      <span style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                );
              })}
              {distributionTotal === 0 ? (
                <p className="distribution-empty-note">Nessun profilo nel periodo selezionato.</p>
              ) : null}
            </div>
          </article>

          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <p className="superadmin-card-kicker">TOP</p>
              <h3><Trophy className="h-4 w-4" /> Top 5 fornitori - valutazione piu alta</h3>
              <p className="subtle">Media Top 5: <strong>{topSuppliersAverage.toFixed(1)} / 5.0</strong></p>
            </div>
            <div className="admin-reports-top5">
              {topSuppliersRows.length === 0 ? <p className="distribution-empty-note">Nessun fornitore con valutazioni per il periodo selezionato.</p> : null}
              {topSuppliersRows.map((row, idx) => (
                <div key={`${row.name}-${idx}`} className={`top5-row rank-${idx + 1}`}>
                  <span className="rank">{idx + 1}</span>
                  <span className="avatar" aria-hidden="true">{initialsFromName(row.name)}</span>
                  <div className="main">
                    <strong>{row.name}</strong>
                    <small>{row.subtitle}</small>
                    <div className="row-tags">
                      <span>{inferRegistryTag(row.subtitle)}</span>
                      <span>{row.evaluationsCount >= 3 ? "Campione robusto" : "Poche valutazioni"}</span>
                    </div>
                  </div>
                  <div className="score-main">
                    <strong>{row.averageScore.toFixed(1)} / 5.0</strong>
                    <span className="score-stars">{stars(row.averageScore)}</span>
                    <small>{row.evaluationsCount} valutazioni</small>
                    <div className="score-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min(100, row.averageScore * 20))}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <article className="panel admin-reports-card">
          <div className="admin-reports-card-head">
            <p className="superadmin-card-kicker">EXPORT</p>
            <h3><FileSpreadsheet className="h-4 w-4" /> Esportazioni rapide</h3>
            <p className="subtle">Scarica report pronti in un click.</p>
          </div>
          <div className="admin-reports-quick-exports">
            {quickExportCards.map((card) => (
              <div key={card.id} className={`quick-export-card tone-${card.tone}`}>
                <div className="quick-export-head">
                  <span className="quick-export-icon" aria-hidden="true">{card.icon}</span>
                  <div>
                    <p><strong>{card.title}</strong></p>
                    <small>{card.subtitle}</small>
                  </div>
                </div>
                <div className="quick-export-chips">
                  {card.chips.map((chip) => <span key={`${card.id}-${chip}`}>{chip}</span>)}
                </div>
                <div className="quick-export-meta">
                  <span><FileSpreadsheet className="h-3.5 w-3.5" /> {card.format}</span>
                  <span><Filter className="h-3.5 w-3.5" /> {card.filter}</span>
                  <span><Clock3 className="h-3.5 w-3.5" /> {card.eta}</span>
                  <span><CalendarDays className="h-3.5 w-3.5" /> {lastExportLabel}</span>
                </div>
                <div className="quick-export-cta">
                  <p>Pronto per esportazione</p>
                  <button type="button" className="home-btn home-btn-secondary admin-action-btn btn-with-icon btn-icon-export" onClick={() => void onQuickExport(card.preset)} disabled={Boolean(busy) || !canExport}>
                    {busy === card.preset ? "Esporta..." : "Esporta"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="admin-reports-foot-actions">
            <button type="button" className="home-btn home-btn-primary admin-action-btn btn-excel" onClick={() => void onExportCsv()} disabled={Boolean(busy) || !canExport}>
              <FileSpreadsheet className="h-4 w-4" />
              {busy === "csv" ? "Export..." : "Esporta KPI CSV"}
            </button>
            <span className="admin-reports-updated-badge">Ultimo aggiornamento: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString("it-IT") : "n/d"}</span>
            {!canExport && auth?.role === "ADMIN" ? <p className="subtle">Export disponibile solo per SUPER_ADMIN o RESPONSABILE_ALBO.</p> : null}
          </div>
        </article>

      </section>
    </AdminCandidatureShell>
  );
}
