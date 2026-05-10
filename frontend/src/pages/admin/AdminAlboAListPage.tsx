import { useCallback, useEffect, useRef, useState } from "react";
import { Award, Clock3, ExternalLink, MapPin, Search, ShieldCheck, SlidersHorizontal, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import { type AdminRegistryProfileRow, listAdminProfiles, type RegistryProfileStatus } from "../../api/adminProfilesApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";


function shouldRefreshAlboList(event: DashboardActivityEvent): boolean {
  const key = event.eventKey ?? "";
  return (
    event.entityType === "REVAMP_SUPPLIER_REGISTRY_PROFILE"
    || key.startsWith("revamp.review.")
    || key.startsWith("revamp.application.")
    || key.includes("profile")
  );
}

function statusLabel(status: RegistryProfileStatus): string {
  if (status === "APPROVED") return "Attivo";
  if (status === "SUSPENDED") return "Sospeso";
  if (status === "RENEWAL_DUE") return "In rinnovo";
  return "Archiviato";
}

function statusTone(status: RegistryProfileStatus): "ok" | "warn" | "danger" | "neutral" {
  if (status === "APPROVED") return "ok";
  if (status === "RENEWAL_DUE") return "warn";
  if (status === "SUSPENDED") return "danger";
  return "neutral";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("it-IT");
}

function documentBadge(row: AdminRegistryProfileRow): { label: string; tone: "ok" | "warn" | "danger" | "neutral"; tooltip: string } {
  if (row.expiredDocumentLabels && row.expiredDocumentLabels.length > 0) {
    return { label: "Scaduti", tone: "danger", tooltip: `Documenti scaduti: ${row.expiredDocumentLabels.join(", ")}` };
  }
  if (row.pendingDocumentRenewal) {
    const labels = row.pendingDocumentRenewalLabels && row.pendingDocumentRenewalLabels.length > 0
      ? row.pendingDocumentRenewalLabels.join(", ")
      : "documenti richiesti";
    return { label: "Rinnovo", tone: "warn", tooltip: `Rinnovo aperto per: ${labels}` };
  }
  const expiryMs = row.expiresAt ? Date.parse(row.expiresAt) : NaN;
  if (Number.isFinite(expiryMs)) {
    const days = Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000));
    const date = formatDate(row.expiresAt);
    if (days < 0) return { label: "Scaduti", tone: "danger", tooltip: `Documento piu vicino scaduto il ${date}.` };
    if (days <= 30) return { label: "In scadenza", tone: "warn", tooltip: `Documento piu vicino in scadenza il ${date}.` };
    return { label: "Validi", tone: "ok", tooltip: `Nessun documento scaduto o in scadenza. Prossima scadenza nota: ${date}.` };
  }
  return { label: "Non disp.", tone: "neutral", tooltip: "Nessuna scadenza documento disponibile nella scheda." };
}

function scoreValue(profile: AdminRegistryProfileRow): number {
  const raw = profile.aggregateScore;
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(5, raw));
}

function scoreStars(score: number): string {
  const rounded = Math.round(score);
  return `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

function initials(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  if (!normalized) return "NA";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function inferredType(summary: string | null | undefined): string {
  const value = (summary ?? "").toLowerCase();
  if (value.includes("coach")) return "Psicologo/Coach";
  if (value.includes("consulent")) return "Consulente";
  if (value.includes("docente") || value.includes("formatore")) return "Docente / Formatore";
  return "Professionista";
}

function cardValue(row: AdminRegistryProfileRow, key: string): string {
  const source = row.adminCardView ?? row.publicCardView;
  const value = source && typeof source === "object" ? source[key] : undefined;
  return typeof value === "string" ? value : "";
}

function formatTerritory(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const obj = JSON.parse(trimmed) as { regions?: string[]; provinces?: string[] };
    const regions = Array.isArray(obj.regions) ? obj.regions : [];
    if (regions.length > 0) {
      if (regions.length <= 3) return regions.join(", ");
      return `${regions.slice(0, 2).join(", ")} +${regions.length - 2} regioni`;
    }
    const provinces = Array.isArray(obj.provinces) ? obj.provinces : [];
    if (provinces.length > 0) {
      if (provinces.length <= 5) return provinces.join(", ");
      return `${provinces.slice(0, 4).join(", ")} +${provinces.length - 4}`;
    }
    return "Italia";
  } catch {
    return trimmed;
  }
}

function humanizeLabel(raw: string): string {
  if (!raw) return "";
  if (/^[A-Z][A-Z_/\s]*$/.test(raw)) {
    return raw.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return raw;
}

export function AdminAlboAListPage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const [rows, setRows] = useState<AdminRegistryProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"ALL" | RegistryProfileStatus>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [region] = useState("");
  const [serviceCategory] = useState("");
  const [ateco] = useState("");
  const [certification] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const alboRefreshInFlightRef = useRef(false);
  const alboRefreshQueuedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (showLoading = true) => {
    if (!token) return;
    if (alboRefreshInFlightRef.current) {
      alboRefreshQueuedRef.current = true;
      return;
    }

    alboRefreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const data = await listAdminProfiles(token, {
        registryType: "ALBO_A",
        status: status === "ALL" ? undefined : status,
        q: debouncedQuery,
        ateco,
        region,
        serviceCategory,
        certification,
        size: 50,
        page: 0
      });
      setRows(data.content);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento fornitori Albo A non riuscito.";
      setToast({ message, type: "error" });
      setRows([]);
    } finally {
      alboRefreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
      if (alboRefreshQueuedRef.current) {
        alboRefreshQueuedRef.current = false;
        void load(false);
      }
    }
  }, [ateco, certification, debouncedQuery, region, serviceCategory, status, token]);

  useEffect(() => {
    void load(true);
  }, [token, status, debouncedQuery, load]);

  useAdminRealtimeRefresh({
    token,
    shouldRefresh: shouldRefreshAlboList,
    onRefresh: () => load(false)
  });

  const displayedRows = rows;
  const displayedActiveCount = displayedRows.filter((r) => r.status === "APPROVED").length;
  const displayedRenewalCount = displayedRows.filter((r) => r.pendingDocumentRenewal || r.status === "RENEWAL_DUE").length;
  const scoredRows = displayedRows.filter((row) => typeof row.aggregateScore === "number" && Number.isFinite(row.aggregateScore));
  const displayedAverageScore = scoredRows.length
    ? scoredRows.reduce((sum, row) => sum + scoreValue(row), 0) / scoredRows.length
    : 0;
  return (
    <AdminCandidatureShell active="alboA">
      <section className="stack admin-albo-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}
        <div className="panel admin-albo-head admin-albo-head-modern albo-a">
          <div>
            <h2 className="admin-page-title-standard"><Users className="h-5 w-5" /> Fornitori (Albo A)</h2>
            <p className="subtle">Professionisti qualificati, stato albo e rinnovi in un unico punto di controllo.</p>
          </div>
        </div>

        <div className="admin-albo-kpi-row">
          <article className="panel admin-albo-kpi-card superadmin-kpi-card tone-ok">
            <div className="superadmin-kpi-head">
              <h4>Attivi</h4>
              <span className="superadmin-kpi-icon" aria-hidden="true"><ShieldCheck /></span>
            </div>
            <strong>{displayedActiveCount}</strong>
            <div className="superadmin-kpi-foot">
              <span className="superadmin-kpi-trend">professionisti disponibili</span>
              <span className={`superadmin-kpi-level level-${displayedActiveCount > 0 ? "ok" : "info"}`}>
                {displayedActiveCount > 0 ? "Operativo" : "Vuoto"}
              </span>
            </div>
          </article>
          <article className="panel admin-albo-kpi-card superadmin-kpi-card tone-attention">
            <div className="superadmin-kpi-head">
              <h4>Rinnovi</h4>
              <span className="superadmin-kpi-icon" aria-hidden="true"><Clock3 /></span>
            </div>
            <strong>{displayedRenewalCount}</strong>
            <div className="superadmin-kpi-foot">
              <span className="superadmin-kpi-trend">da monitorare</span>
              <span className={`superadmin-kpi-level level-${displayedRenewalCount > 0 ? "attention" : "ok"}`}>
                {displayedRenewalCount > 0 ? "Attenzione" : "Normale"}
              </span>
            </div>
          </article>
          <article className="panel admin-albo-kpi-card superadmin-kpi-card tone-ok">
            <div className="superadmin-kpi-head">
              <h4>Media albo</h4>
              <span className="superadmin-kpi-icon" aria-hidden="true"><Award /></span>
            </div>
            <strong>{displayedAverageScore.toFixed(1)}</strong>
            <div className="superadmin-kpi-foot">
              <span className="superadmin-kpi-trend">punteggio medio</span>
              <span className={`superadmin-kpi-level level-${displayedAverageScore > 0 ? "ok" : "info"}`}>
                {scoredRows.length > 0 ? `${scoredRows.length} valutati` : "Non valutato"}
              </span>
            </div>
          </article>
        </div>

        <div className="panel admin-albo-filters admin-albo-filters-modern admin-albo-filters-simple">
          <div className="admin-albo-search-field">
            <Search size={17} aria-hidden="true" />
            <input
              placeholder="Cerca nome, email, competenza, territorio, ATECO o certificazione..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? <button type="button" className="admin-albo-search-clear" onClick={() => setQuery("")} aria-label="Cancella ricerca"><X size={14} /></button> : null}
            <div className="admin-albo-status-tabs" aria-label="Filtro stato">
              {[
                ["ALL", "Tutti"],
                ["APPROVED", "Attivi"],
                ["RENEWAL_DUE", "In rinnovo"],
                ["SUSPENDED", "Sospesi"],
                ["ARCHIVED", "Archiviati"]
              ].map(([id, label]) => (
                <button key={id} type="button" className={status === id ? "is-active" : ""} onClick={() => setStatus(id as "ALL" | RegistryProfileStatus)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel admin-albo-meta-strip admin-albo-meta-strip-modern">
          <p className="subtle"><SlidersHorizontal size={15} /> {displayedRows.length} professionisti visualizzati</p>
          <p className="subtle">Ordinamento consigliato: <strong>Punteggio</strong></p>
        </div>

        <div className="panel admin-albo-list-panel">
          <div className="admin-albo-table admin-unified-table admin-unified-table-clean admin-albo-table-modern">
            <div className="admin-albo-row admin-albo-row-head admin-unified-table-row admin-unified-table-row-head albo-a">
              <span>Nome / E-mail</span>
              <span>Tipologia</span>
              <span>Ambito principale</span>
              <span>Territorio</span>
              <span>Punteggio</span>
              <span>Stato</span>
              <span>Documenti</span>
              <span>Azioni</span>
            </div>
            {loading ? <p className="subtle admin-unified-table-empty">Caricamento...</p> : null}
            {!loading && rows.length === 0 ? <p className="subtle admin-unified-table-empty">Nessun professionista trovato.</p> : null}
            {!loading && displayedRows.map((row) => {
              const score = scoreValue(row);
              const name = row.displayName || "Professionista";
              const rawType = cardValue(row, "type");
              const rawTheme = cardValue(row, "mainTheme");
              const territory = formatTerritory(cardValue(row, "territory"));
              const typeLabel = humanizeLabel(rawType || inferredType(row.publicSummary));
              const themeLabel = rawTheme && rawTheme !== rawType
                ? humanizeLabel(rawTheme)
                : (row.publicSummary || "—");
              const docBadge = documentBadge(row);
              return (
                <div key={row.id} className="admin-albo-row admin-unified-table-row albo-a admin-albo-row-modern">
                  <div className="admin-albo-main">
                    <div className="admin-albo-avatar">{initials(name)}</div>
                    <div>
                      <strong title={name}>{name}</strong>
                      {row.pendingFieldChange ? <span className="queue-assign-badge">Modifica dati in revisione</span> : null}
                      {row.expiredDocumentLabels && row.expiredDocumentLabels.length > 0 ? <span className="queue-assign-badge">Documenti scaduti</span> : null}
                      <p className="subtle" title={row.publicSummary || "—"}>{row.publicSummary || "—"}</p>
                    </div>
                  </div>
                  <span className="admin-albo-tipo" title={typeLabel}>{typeLabel}</span>
                  <span className="admin-albo-ambito" title={themeLabel}>{themeLabel}</span>
                  <span className="admin-albo-territory" title={territory || "—"}>
                    {territory ? <><MapPin size={12} />{territory}</> : <span className="subtle">—</span>}
                  </span>
                  <span className="admin-albo-score">
                    {score > 0 ? <>{scoreStars(score)} {score.toFixed(1)}</> : <span className="subtle">Non valutato</span>}
                  </span>
                  <span className={`admin-albo-status tone-${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
                  <span className={`admin-albo-doc-badge tone-${docBadge.tone}`} title={docBadge.tooltip}>{docBadge.label}</span>
                  <Link className="home-btn home-btn-secondary admin-action-btn btn-with-icon btn-icon-open" to={`/admin/albo-a/${row.id}`}>
                    Apri <ExternalLink size={13} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </AdminCandidatureShell>
  );
}
