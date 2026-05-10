import { Activity, BarChart3, Bell, Building2, ClipboardCheck, ClipboardList, Clock3, Download, LayoutDashboard, ListChecks, Mail, PieChart, Plus, Settings2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import type { AdminReportKpis } from "../../api/adminReportApi";
import type { AdminReviewCaseSummary } from "../../api/adminReviewApi";
import type { AdminRole } from "../../api/adminUsersRolesApi";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

export interface SuperAdminRecentActivityItem {
  id: string;
  title: string;
  subtitle: string;
  occurredAt: string;
  actorLabel: string;
  actorRoleLabel: string;
  activityTone: "approved" | "rejected" | "integration" | "verified" | "opened" | "role" | "neutral";
  targetLabel: string;
  navigateTo: string;
}

export interface SuperAdminMonthTrendPoint {
  monthLabel: string;
  count: number;
}

export interface SuperAdminAlboMetrics {
  approvalRate30d: number;
  approved30d: number;
  decided30d: number;
  avgReviewCloseDays30d: number;
  closedReviews30d: number;
  expiringProfiles30d: number;
}

interface SuperAdminDashboardPageProps {
  adminRole: AdminRole;
  kpis: AdminReportKpis;
  queue: AdminReviewCaseSummary[];
  recentActivity: SuperAdminRecentActivityItem[];
  monthTrend: SuperAdminMonthTrendPoint[];
  alboMetrics: SuperAdminAlboMetrics;
  lastUpdatedAt: string | null;
  loading: boolean;
  canManageInvites: boolean;
  canExportReports: boolean;
  canAccessQueue: boolean;
  pendingFieldChangeCount: number;
}

type ChartType = "bar" | "donut";
type ChartWindow = "quarterly" | "halfyearly" | "yearly";
const CHART_TYPE_STORAGE_KEY = "admin.dashboard.chart.type";
const CHART_WINDOW_STORAGE_KEY = "admin.dashboard.chart.window";

function formatStatus(status: string): string {
  if (status === "PENDING_ASSIGNMENT") return "in attesa";
  if (status === "IN_PROGRESS") return "in revisione";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "integrazione";
  if (status === "DECIDED") return "decisa";
  return status.toLowerCase();
}

function relativeLabel(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  return `${hours} h fa`;
}

function absoluteLabel(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function roleTone(roleLabel: string): "superadmin" | "responsabile" | "revisore" | "viewer" {
  const normalized = roleLabel.toUpperCase();
  if (normalized.includes("SUPER")) return "superadmin";
  if (normalized.includes("RESPONSABILE")) return "responsabile";
  if (normalized.includes("REVISORE")) return "revisore";
  return "viewer";
}

function actorBadgeLabel(actorLabel: string, actorRoleLabel: string): string {
  if (!actorLabel) return actorRoleLabel;
  if (actorLabel.toLowerCase() === actorRoleLabel.toLowerCase()) return actorRoleLabel;
  return `${actorLabel} - ${actorRoleLabel}`;
}

function applicationShortCode(applicationId: string): string {
  return `APP-${applicationId.slice(0, 6).toUpperCase()}`;
}

function statusTone(status: string): "warn" | "info" | "ok" | "neutral" {
  if (status === "PENDING_ASSIGNMENT") return "warn";
  if (status === "IN_PROGRESS") return "info";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "warn";
  if (status === "DECIDED") return "ok";
  return "neutral";
}

function formatGovernanceRole(role: AdminRole): string {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "RESPONSABILE_ALBO") return "Responsabile Albo";
  if (role === "REVISORE") return "Revisore";
  return "Viewer";
}

function formatUpdatedTime(iso: string | null): string {
  if (!iso) return "non ancora";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "non ancora";
  return new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function SuperAdminDashboardPage({
  adminRole,
  kpis,
  queue,
  recentActivity,
  monthTrend,
  alboMetrics,
  lastUpdatedAt,
  loading,
  canManageInvites,
  canExportReports,
  canAccessQueue,
  pendingFieldChangeCount
}: SuperAdminDashboardPageProps) {
  const { t } = useI18n();
  const recent = recentActivity.slice(0, 8);
  const pendingRevision = queue.filter((item) => item.status === "PENDING_ASSIGNMENT" || item.status === "IN_PROGRESS").slice(0, 6);
  const overdueCount = queue.filter((item) => item.status !== "DECIDED").length;
  const expiringProfilesCount = Math.max(0, alboMetrics.expiringProfiles30d);
  const avgReviewDays = Math.max(0, alboMetrics.avgReviewCloseDays30d);
  const approvalRate = Math.max(0, Math.min(100, alboMetrics.approvalRate30d));
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartWindow, setChartWindow] = useState<ChartWindow>("halfyearly");
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const chartSettingsRef = useRef<HTMLDivElement | null>(null);
  const previousOverdueRef = useRef<number | null>(null);

  const visibleTrend = chartWindow === "quarterly" ? monthTrend.slice(-3) : monthTrend;
  const maxTrend = Math.max(1, ...visibleTrend.map((point) => point.count));
  const sixMonthTotal = visibleTrend.reduce((acc, point) => acc + point.count, 0);
  const latestMonth = visibleTrend.length > 0 ? visibleTrend[visibleTrend.length - 1] : null;
  const previousMonth = visibleTrend.length > 1 ? visibleTrend[visibleTrend.length - 2] : null;
  const monthDelta = latestMonth && previousMonth ? latestMonth.count - previousMonth.count : 0;
  const monthDeltaPct = latestMonth && previousMonth && previousMonth.count > 0
    ? Math.round((monthDelta / previousMonth.count) * 100)
    : null;

  const approvalStatus = alboMetrics.decided30d === 0 ? "Nessun dato" : approvalRate === 0 ? "Da monitorare" : approvalRate >= 60 ? "Buono" : "Attenzione";
  const reviewStatus = alboMetrics.closedReviews30d === 0 ? "Nessuna revisione conclusa" : avgReviewDays <= 5 ? "In linea" : "Da migliorare";
  const expiryStatus = expiringProfilesCount === 0 ? "Sotto controllo" : expiringProfilesCount <= 5 ? "Attenzione" : "Priorita alta";
  const approvalMeter = alboMetrics.decided30d === 0 ? 0 : approvalRate;
  const approvalSubtitle = alboMetrics.decided30d > 0
    ? `Ultimi 30 giorni (${alboMetrics.approved30d}/${alboMetrics.decided30d})`
    : "Ultimi 30 giorni";
  const chartWindowLabel = chartWindow === "quarterly" ? "ultimi 3 mesi" : chartWindow === "halfyearly" ? "ultimi 6 mesi" : "ultimo anno";

  const trendMessage = latestMonth && previousMonth
    ? monthDelta > 0
      ? `Le iscrizioni sono aumentate rispetto a ${previousMonth.monthLabel}.`
      : monthDelta < 0
        ? `Le iscrizioni sono diminuite rispetto a ${previousMonth.monthLabel}.`
        : `Le iscrizioni sono stabili rispetto a ${previousMonth.monthLabel}.`
    : "Non ci sono ancora abbastanza dati per il confronto mensile.";
  const trendBadgeLabel = monthDeltaPct === null
    ? "Trend non disponibile"
    : `${monthDeltaPct > 0 ? "+" : monthDeltaPct < 0 ? "-" : "="}${Math.abs(monthDeltaPct)}% vs mese scorso`;
  const queueLevel = kpis.pendingSuppliers === 0 ? "ok" : kpis.pendingSuppliers <= 5 ? "attention" : "critical";
  const inviteLevel = kpis.pendingInvites === 0 ? "ok" : kpis.pendingInvites <= 20 ? "attention" : "critical";
  const alertItems = [
    {
      id: "field-change",
      label: "Modifiche dati da sbloccare",
      value: pendingFieldChangeCount,
      threshold: 0,
      route: "/admin/candidature?tab=modifiche-dati"
    },
    {
      id: "queue",
      label: t("admin.dashboard.candidature.title"),
      value: pendingRevision.length,
      threshold: 0,
      route: "/admin/candidature"
    },
    {
      id: "invites",
      label: "Inviti da seguire",
      value: kpis.pendingInvites,
      threshold: 10,
      route: "/admin/invites"
    },
    {
      id: "profiles",
      label: "Profili da controllare",
      value: expiringProfilesCount,
      threshold: 0,
      route: "/admin/albo-a"
    }
  ].filter((item) => item.value > item.threshold);
  const topKpis = [
    {
      id: "suppliers",
      title: "Fornitori attivi",
      value: kpis.totalSuppliers,
      route: "/admin/albo-a",
      icon: <Users className="h-4 w-4" />,
      trend: trendBadgeLabel,
      tone: "ok",
      levelLabel: kpis.totalSuppliers === 0 ? "Da avviare" : "Operativo",
      level: kpis.totalSuppliers === 0 ? "info" : "ok"
    },
    {
      id: "companies",
      title: "Aziende attive",
      value: kpis.activeSuppliers,
      route: "/admin/albo-b",
      icon: <Building2 className="h-4 w-4" />,
      trend: trendBadgeLabel,
      tone: "ok",
      levelLabel: kpis.activeSuppliers === 0 ? "Da avviare" : "Operativo",
      level: kpis.activeSuppliers === 0 ? "info" : "ok"
    },
    {
      id: "queue",
      title: "In attesa revisione",
      value: kpis.pendingSuppliers,
      route: "/admin/candidature",
      icon: <Clock3 className="h-4 w-4" />,
      trend: `${overdueCount} urgenze`,
      tone: "attention",
      levelLabel: queueLevel === "ok" ? "Normale" : queueLevel === "attention" ? "Attenzione" : "Critico",
      level: queueLevel
    },
    {
      id: "field-change",
      title: "Modifiche dati",
      value: pendingFieldChangeCount,
      route: "/admin/candidature?tab=modifiche-dati",
      icon: <ListChecks className="h-4 w-4" />,
      trend: pendingFieldChangeCount > 0 ? "da sbloccare" : "nessuna richiesta",
      tone: "attention",
      levelLabel: pendingFieldChangeCount > 0 ? "Richieste" : "Normale",
      level: pendingFieldChangeCount > 0 ? "attention" as const : "ok" as const
    },
    {
      id: "invites",
      title: "Inviti pendenti",
      value: kpis.pendingInvites,
      route: "/admin/invites",
      icon: <Mail className="h-4 w-4" />,
      trend: "da seguire",
      tone: "info",
      levelLabel: inviteLevel === "ok" ? "Normale" : inviteLevel === "attention" ? "Attenzione" : "Critico",
      level: inviteLevel
    },
    {
      id: "evaluations",
      title: "Valutazioni questo mese",
      value: kpis.submittedApplications,
      route: "/admin/evaluations",
      icon: <ClipboardCheck className="h-4 w-4" />,
      trend: kpis.submittedApplications > 0 ? "Attivita presente" : "Nessuna valutazione questo mese",
      tone: "ok",
      levelLabel: kpis.submittedApplications > 0 ? "Operativo" : "Da avviare",
      level: kpis.submittedApplications > 0 ? "ok" : "info"
    }
  ] as const;

  useEffect(() => {
    const saved = localStorage.getItem(CHART_TYPE_STORAGE_KEY);
    if (saved === "bar" || saved === "donut") {
      setChartType(saved);
    }
    const savedWindow = localStorage.getItem(CHART_WINDOW_STORAGE_KEY);
    if (savedWindow === "quarterly" || savedWindow === "halfyearly" || savedWindow === "yearly") {
      setChartWindow(savedWindow);
    }
  }, []);

  useEffect(() => {
    if (!chartSettingsOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (chartSettingsRef.current?.contains(target)) return;
      setChartSettingsOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setChartSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [chartSettingsOpen]);

  useEffect(() => {
    const previous = previousOverdueRef.current;
    previousOverdueRef.current = overdueCount;
    if (previous === null) return;
    if (overdueCount <= previous) return;

    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const context = new AudioCtx();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(820, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.26);
      oscillator.onended = () => {
        void context.close();
      };
    } catch {
      // Audio can be blocked by browser autoplay policies; ignore safely.
    }
  }, [overdueCount]);

  function chooseChartType(next: ChartType) {
    setChartType(next);
    localStorage.setItem(CHART_TYPE_STORAGE_KEY, next);
    setChartSettingsOpen(false);
  }
  const donutColors = ["#2f6da5", "#3f7cb3", "#5a8fbe", "#74a2ca", "#8eb5d6", "#a7c7e2"];
  const donutTotal = Math.max(0, sixMonthTotal);
  const donutLegend = visibleTrend.map((point, index) => ({
    ...point,
    color: donutColors[index % donutColors.length]
  }));
  const donutBackground = donutTotal <= 0
    ? "conic-gradient(#d8e6f4 0 100%)"
    : (() => {
      let start = 0;
      const segments = donutLegend.map((item) => {
        const span = (item.count / donutTotal) * 100;
        const end = start + span;
        const segment = `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
        start = end;
        return segment;
      });
      return `conic-gradient(${segments.join(", ")})`;
    })();

  function chooseChartWindow(next: ChartWindow) {
    setChartWindow(next);
    localStorage.setItem(CHART_WINDOW_STORAGE_KEY, next);
  }

  return (
    <AdminCandidatureShell active="dashboard">
      <header className="superadmin-top">
        <div>
          <h2 className="admin-page-title-standard"><LayoutDashboard className="h-5 w-5" /> Dashboard</h2>
          <div className="superadmin-top-meta">
            <span className="superadmin-role-pill">{formatGovernanceRole(adminRole)}</span>
            <span className="superadmin-updated-at">Aggiornato alle {formatUpdatedTime(lastUpdatedAt)}</span>
          </div>
          <p className="subtle">Stato generale di candidature, inviti e revisioni.</p>
        </div>
        <div className="superadmin-actions">
          <div className={`superadmin-alert-chip-wrap ${overdueCount > 0 ? "has-alert" : ""}`}>
            <span className="superadmin-alert-chip" tabIndex={0} aria-describedby="dashboard-bell-tooltip">
              <Bell className="h-4 w-4" /> {overdueCount}
            </span>
            <span id="dashboard-bell-tooltip" role="tooltip" className="superadmin-alert-tooltip">
              Mostra il numero di pratiche aperte da gestire.
            </span>
          </div>
          {canManageInvites ? <Link className="home-btn home-btn-primary admin-action-btn" to="/admin/invites/new"><Plus className="h-4 w-4" /> Invia invito</Link> : null}
          {canExportReports ? <Link className="home-btn home-btn-secondary admin-action-btn" to="/admin/reports"><Download className="h-4 w-4" /> Esporta</Link> : null}
        </div>
      </header>

        <div className="superadmin-kpis">
          {topKpis.map((item) => (
            <Link key={item.id} to={item.route} className={`panel superadmin-kpi-card tone-${item.tone}`}>
              <div className="superadmin-kpi-head">
                <h4>{item.title}</h4>
                <span className="superadmin-kpi-icon" aria-hidden="true">{item.icon}</span>
              </div>
              <strong>{item.value}</strong>
              <div className="superadmin-kpi-foot">
                <span className="superadmin-kpi-trend">{item.trend}</span>
                <span className={`superadmin-kpi-level level-${item.level}`}>{item.levelLabel}</span>
              </div>
            </Link>
          ))}
        </div>

        {alertItems.length > 0 ? (
          <div className="superadmin-alert-strip" role="status" aria-live="polite">
            <div className="superadmin-alert-title">
              <Bell className="h-4 w-4" />
              <span>Da controllare</span>
            </div>
            <div className="superadmin-alert-items">
              {alertItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.route}
                  className={`superadmin-alert-item tone-${item.value > item.threshold + 15 ? "critical" : "warn"}`}
                >
                  <span className="superadmin-alert-dot" aria-hidden="true" />
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="superadmin-grid">
          <section className="panel">
            <div className="superadmin-section-head">
              <div className="superadmin-panel-head">
                <div>
                  <p className="superadmin-card-kicker">CANDIDATURE</p>
                  <h3 className="superadmin-card-title"><ClipboardList className="h-4 w-4" /> {t("admin.dashboard.candidature.title")}</h3>
                </div>
                {canAccessQueue ? <Link className="home-btn home-btn-secondary admin-action-btn" to="/admin/candidature">Vedi tutte</Link> : null}
              </div>
              {pendingRevision.length > 0 ? (
                <p className="subtle superadmin-section-subtitle">Pratiche che il team deve leggere o prendere in carico.</p>
              ) : null}
            </div>
            {!canAccessQueue ? <p className="subtle">Nessun dato disponibile per il tuo ruolo.</p> : null}
            {canAccessQueue && loading ? <p className="subtle">Caricamento...</p> : null}
            {canAccessQueue && !loading && pendingRevision.length === 0 ? <p className="subtle">Nessuna candidatura reale da controllare al momento.</p> : null}
            <div className="superadmin-list">
              {canAccessQueue && pendingRevision.map((item) => (
                <div key={item.id} className="superadmin-row">
                  <div>
                    <strong>{item.protocolCode ?? applicationShortCode(item.applicationId)}</strong>
                    <p className="subtle">{formatStatus(item.status)}</p>
                  </div>
                  <span className={`superadmin-status-chip tone-${statusTone(item.status)}`}>{formatStatus(item.status)}</span>
                  {canAccessQueue ? <Link className="home-btn home-btn-secondary admin-action-btn" to={`/admin/candidature/${item.applicationId}/review`}>Esamina</Link> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="superadmin-section-head">
              <div className="superadmin-activity-head">
                <p className="superadmin-card-kicker">ATTIVITA</p>
                <h3 className="superadmin-card-title"><Activity className="h-4 w-4" /> Attivita recenti del team</h3>
              </div>
              <p className="subtle superadmin-section-subtitle">Ultime azioni fatte dal team amministrativo.</p>
            </div>
            {!loading && recent.length === 0 ? <p className="subtle">Nessuna attivita recente.</p> : null}
            <div className="superadmin-activity-timeline">
              {recent.map((item) => (
                <Link key={`recent-${item.id}`} to={item.navigateTo} className={`superadmin-activity-item tone-${item.activityTone} superadmin-activity-link`}>
                  <span className="superadmin-activity-dot" aria-hidden="true" />
                  <div className="superadmin-activity-body">
                    <div className="superadmin-activity-main">
                      <strong>{item.title}</strong>
                      <div className="superadmin-activity-who">
                        <span className={`superadmin-actor-badge tone-${roleTone(item.actorRoleLabel)}`}>
                          {actorBadgeLabel(item.actorLabel, item.actorRoleLabel)}
                        </span>
                        <span className="superadmin-activity-supplier-name">{item.targetLabel}</span>
                      </div>
                    </div>
                    <p className="subtle">{item.subtitle}</p>
                    <div className="superadmin-activity-meta">
                      <span className="subtle">{relativeLabel(item.occurredAt)}</span>
                      <span className="subtle">{absoluteLabel(item.occurredAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

      <div className="superadmin-grid superadmin-grid-bottom">
          <section className="panel superadmin-chart-placeholder">
            <div className="superadmin-bottom-title-block">
              <div className="superadmin-panel-head superadmin-panel-head-compact superadmin-chart-head">
                <div>
                  <p className="superadmin-card-kicker">TREND</p>
                  <h3 className="superadmin-card-title"><BarChart3 className="h-4 w-4" /> Nuove candidature ({chartWindowLabel})</h3>
                </div>
                <div className="superadmin-chart-head-actions">
                  {latestMonth ? <span className="superadmin-month-pill">Mese attuale: {latestMonth.monthLabel}</span> : null}
                  <div ref={chartSettingsRef} className={`superadmin-chart-settings-wrap ${chartSettingsOpen ? "is-open" : ""}`}>
                    <button
                      type="button"
                      className="superadmin-chart-settings-btn"
                      onClick={() => setChartSettingsOpen((prev) => !prev)}
                      aria-label="Cambia tipo grafico"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                    {chartSettingsOpen ? (
                      <div className="superadmin-chart-settings-popover">
                        <p className="superadmin-chart-settings-title">Periodo</p>
                        <div className="superadmin-chart-segmented">
                          <button type="button" className={`superadmin-chart-option ${chartWindow === "quarterly" ? "active" : ""}`} onClick={() => chooseChartWindow("quarterly")}>Trimestrale</button>
                          <button type="button" className={`superadmin-chart-option ${chartWindow === "halfyearly" ? "active" : ""}`} onClick={() => chooseChartWindow("halfyearly")}>Semestrale</button>
                          <button type="button" className={`superadmin-chart-option ${chartWindow === "yearly" ? "active" : ""}`} onClick={() => chooseChartWindow("yearly")}>Annuale</button>
                        </div>
                        <p className="superadmin-chart-settings-title">Tipo grafico</p>
                        <button type="button" className={`superadmin-chart-option ${chartType === "bar" ? "active" : ""}`} onClick={() => chooseChartType("bar")}>Barre (Consigliato)</button>
                        <button type="button" className={`superadmin-chart-option ${chartType === "donut" ? "active" : ""}`} onClick={() => chooseChartType("donut")}><PieChart className="h-3.5 w-3.5" /> Ciambella</button>
                        <p className="superadmin-chart-settings-help">Consigliato: Barre per confronto mese su mese.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <p className="subtle superadmin-chart-summary">
              In totale: <strong>{sixMonthTotal}</strong> nuove candidature ({chartWindowLabel}).
              {monthDeltaPct !== null ? ` (${monthDeltaPct > 0 ? "+" : ""}${monthDeltaPct}% vs mese precedente)` : ""}
            </p>
            {visibleTrend.length === 0 ? (
              <p className="subtle">Nessun dato trend disponibile.</p>
            ) : chartType === "bar" ? (
              <div className="superadmin-chart-bars">
                {visibleTrend.map((point) => (
                  <div key={`bar-${point.monthLabel}`} className="superadmin-bar-wrap">
                    <div
                      className={`superadmin-bar ${latestMonth?.monthLabel === point.monthLabel ? "is-current" : ""}`}
                      style={{ height: `${Math.max(8, Math.round((point.count / maxTrend) * 140))}px` }}
                    />
                    <span className="superadmin-bar-value">{point.count}</span>
                    <span className="superadmin-bar-label">{point.monthLabel}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="superadmin-donut-chart-wrap">
                <div className="superadmin-donut-chart" style={{ background: donutBackground }}>
                  <div className="superadmin-donut-center">
                    <strong>{donutTotal}</strong>
                    <span>Totale</span>
                  </div>
                </div>
                <div className="superadmin-donut-legend">
                  {donutLegend.map((item) => (
                    <div key={`donut-${item.monthLabel}`} className="superadmin-donut-legend-row">
                      <span className="superadmin-donut-swatch" style={{ background: item.color }} />
                      <span>{item.monthLabel}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="superadmin-chart-takeaway">
              <strong>Messaggio rapido:</strong> {trendMessage}
            </div>
          </section>
          <section className="panel superadmin-metrics">
            <div className="superadmin-bottom-title-block">
              <div>
                <p className="superadmin-card-kicker">DATI</p>
                <h3 className="superadmin-card-title superadmin-metrics-title"><BarChart3 className="h-4 w-4" /> Stato dell'albo</h3>
              </div>
            </div>
            <div className="superadmin-metric-card tone-approval">
              <div className="superadmin-metric-row">
                <div className="superadmin-metric-copy">
                  <h4>Pratiche approvate</h4>
                  <p>{approvalSubtitle}</p>
                </div>
                <div className="superadmin-metric-value-wrap">
                  <strong>{approvalRate}%</strong>
                  <span className={`superadmin-metric-state ${alboMetrics.decided30d === 0 ? "state-info" : approvalRate === 0 ? "state-warn" : approvalRate >= 60 ? "state-ok" : "state-attention"}`}>{approvalStatus}</span>
                </div>
              </div>
              <div className="superadmin-metric-progress"><span style={{ width: `${approvalMeter}%` }} /></div>
              <p className="superadmin-metric-progress-note">La linea mostra gli esiti approvati sugli esiti finali.</p>
            </div>
            <div className="superadmin-metric-card tone-review">
              <div className="superadmin-metric-row">
                <div className="superadmin-metric-copy">
                  <h4>Tempo medio per chiudere una revisione</h4>
                  <p>Decisioni concluse negli ultimi 30 giorni</p>
                </div>
                <div className="superadmin-metric-value-wrap">
                  <strong>{avgReviewDays} gg</strong>
                  <span className={`superadmin-metric-state ${alboMetrics.closedReviews30d === 0 ? "state-info" : avgReviewDays <= 5 ? "state-ok" : "state-attention"}`}>{reviewStatus}</span>
                </div>
              </div>
            </div>
            <div className="superadmin-metric-card tone-expiry">
              <div className="superadmin-metric-row">
                <div className="superadmin-metric-copy">
                  <h4>Profili da rinnovare</h4>
                  <p>Scadenza entro 30 giorni</p>
                </div>
                <div className="superadmin-metric-value-wrap">
                  <strong>{expiringProfilesCount}</strong>
                  <span className={`superadmin-metric-state ${expiringProfilesCount === 0 ? "state-ok" : expiringProfilesCount <= 5 ? "state-attention" : "state-warn"}`}>{expiryStatus}</span>
                </div>
              </div>
            </div>
          </section>
      </div>
    </AdminCandidatureShell>
  );
}
