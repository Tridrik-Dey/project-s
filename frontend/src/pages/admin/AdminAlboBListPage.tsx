import { useCallback, useEffect, useRef, useState } from "react";
import { Award, Building2, Clock3, ExternalLink, MapPin, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
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
  if (status === "APPROVED") return "Attiva";
  if (status === "SUSPENDED") return "Sospesa";
  if (status === "RENEWAL_DUE") return "In rinnovo";
  return "Archiviata";
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

function scoreValue(profile: AdminRegistryProfileRow): number {
  const raw = profile.aggregateScore;
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(5, raw));
}

function initials(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  if (!normalized) return "NA";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function cardValue(row: AdminRegistryProfileRow, key: string): string {
  const source = row.adminCardView ?? row.publicCardView;
  const value = source && typeof source === "object" ? source[key] : undefined;
  return typeof value === "string" ? value : "";
}

function scoreStars(score: number): string {
  const rounded = Math.round(score);
  return `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
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

export function AdminAlboBListPage() {
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
        registryType: "ALBO_B",
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
      const message = error instanceof HttpError ? error.message : "Caricamento aziende Albo B non riuscito.";
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
  const displayedRenewalCount = displayedRows.filter((r) => r.status === "RENEWAL_DUE").length;
  const displayedAverageScore = displayedRows.length
    ? displayedRows.reduce((sum, row) => sum + scoreValue(row), 0) / displayedRows.length
    : 0;
  return (
    <AdminCandidatureShell active="alboB">
      <section className="stack admin-albo-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}
        <div className="panel admin-albo-head admin-albo-head-modern albo-b">
          <div>
            <h2 className="admin-page-title-standard"><Building2 className="h-5 w-5" /> Aziende (Albo B)</h2>
            <p className="subtle">Aziende qualificate, copertura territoriale e rinnovi in un unico punto di controllo.</p>
          </div>
        </div>

        <div className="admin-albo-kpi-row">
          <article className="panel admin-albo-kpi-card tone-blue">
            <span><ShieldCheck size={15} /> Attive</span>
            <strong>{displayedActiveCount}</strong>
            <small>aziende disponibili</small>
          </article>
          <article className="panel admin-albo-kpi-card tone-amber">
            <span><Clock3 size={15} /> Rinnovi</span>
            <strong>{displayedRenewalCount}</strong>
            <small>da monitorare</small>
          </article>
          <article className="panel admin-albo-kpi-card tone-green">
            <span><Award size={15} /> Media albo</span>
            <strong>{displayedAverageScore.toFixed(1)}</strong>
            <small>punteggio medio</small>
          </article>
        </div>

        <div className="panel admin-albo-filters admin-albo-filters-modern admin-albo-filters-simple">
          <div className="admin-albo-search-field">
            <Search size={17} aria-hidden="true" />
            <input
              placeholder="Cerca azienda, email, settore, territorio, ATECO o certificazione..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? <button type="button" className="admin-albo-search-clear" onClick={() => setQuery("")} aria-label="Cancella ricerca"><X size={14} /></button> : null}
            <div className="admin-albo-status-tabs" aria-label="Filtro stato">
              {[
                ["ALL", "Tutte"],
                ["APPROVED", "Attive"],
                ["RENEWAL_DUE", "In rinnovo"],
                ["SUSPENDED", "Sospese"],
                ["ARCHIVED", "Archiviate"]
              ].map(([id, label]) => (
                <button key={id} type="button" className={status === id ? "is-active" : ""} onClick={() => setStatus(id as "ALL" | RegistryProfileStatus)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel admin-albo-meta-strip admin-albo-meta-strip-modern">
          <p className="subtle"><SlidersHorizontal size={15} /> {displayedRows.length} aziende visualizzate</p>
          <p className="subtle">Ordinamento consigliato: <strong>Aggiornamento</strong></p>
        </div>

        <div className="panel admin-albo-list-panel">
          <div className="admin-albo-table admin-unified-table admin-unified-table-clean admin-albo-table-modern">
            <div className="admin-albo-row admin-albo-row-head admin-unified-table-row admin-unified-table-row-head albo-b">
              <span>Azienda</span>
              <span>Settore / Sintesi</span>
              <span>Valutazione</span>
              <span>Stato</span>
              <span>Scadenza</span>
              <span>Aggiornata</span>
              <span>Azioni</span>
            </div>
            {loading ? <p className="subtle admin-unified-table-empty">Caricamento...</p> : null}
            {!loading && rows.length === 0 ? <p className="subtle admin-unified-table-empty">Nessuna azienda trovata.</p> : null}
            {!loading && displayedRows.map((row) => {
              const score = scoreValue(row);
              const name = row.displayName || "Azienda";
              const ateco = cardValue(row, "atecoPrimary");
              const territory = formatTerritory(cardValue(row, "territory"));
              const settore = [
                ateco ? `ATECO ${ateco}` : "",
                territory
              ].filter(Boolean).join(" · ") || row.publicSummary || "—";
              return (
                <div key={row.id} className="admin-albo-row admin-unified-table-row albo-b admin-albo-row-modern">
                  <div className="admin-albo-main">
                    <div className="admin-albo-avatar">{initials(name)}</div>
                    <div>
                      <strong>{name}</strong>
                      {row.pendingFieldChange ? <span className="queue-assign-badge">Modifica dati in revisione</span> : null}
                      {row.pendingDocumentRenewal ? <span className="queue-assign-badge">Rinnovo documenti</span> : null}
                      {row.expiredDocumentLabels && row.expiredDocumentLabels.length > 0 ? <span className="queue-assign-badge">Documenti scaduti</span> : null}
                      <p className="subtle">{row.publicSummary || "—"}</p>
                    </div>
                  </div>
                  <span className="admin-albo-settore">
                    {ateco ? <span className="albo-ateco-badge">{ateco}</span> : null}
                    {territory ? <><MapPin size={12} />{territory}</> : null}
                    {!ateco && !territory ? <span>{settore}</span> : null}
                  </span>
                  <span className="admin-albo-score">
                    {score > 0 ? <>{scoreStars(score)} {score.toFixed(1)}</> : <span className="subtle">—</span>}
                  </span>
                  <span className={`admin-albo-status tone-${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
                  <span>{formatDate(row.expiresAt)}</span>
                  <span>{formatDate(row.updatedAt)}</span>
                  <Link className="home-btn home-btn-secondary admin-action-btn btn-with-icon btn-icon-open" to={`/admin/albo-b/${row.id}`}>
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
