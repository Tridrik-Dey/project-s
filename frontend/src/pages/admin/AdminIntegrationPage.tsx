import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, FileWarning, LockKeyhole, Mail, Send } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import { HttpError } from "../../api/http";
import {
  assignAdminReviewCase,
  getAdminReviewHistory,
  getLatestAdminIntegrationRequest,
  requestAdminIntegration,
  type AdminIntegrationRequestSummary,
  type AdminReviewCaseSummary
} from "../../api/adminReviewApi";
import {
  getRevampApplicationSections,
  getRevampApplicationSummary,
  type RevampApplicationSummary,
  type RevampSectionSnapshot
} from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { buildRevampIntegrationItemTemplates, type RevampIntegrationItemTemplate } from "../../utils/revampIntegrationItems";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SelectedIntegrationItem {
  code: string;
  label: string;
  instruction: string;
  documentType?: string;
  certificationKey?: string;
  certificationLabel?: string;
  targetStep: number;
}

function appCode(applicationId: string): string {
  return `A-${applicationId.slice(0, 8).toUpperCase()}`;
}

function shouldRefreshIntegration(event: DashboardActivityEvent, applicationId: string): boolean {
  const key = event.eventKey ?? "";
  return (
    event.entityType === "REVAMP_APPLICATION"
    && event.entityId === applicationId
    && (key.startsWith("revamp.review.") || key.startsWith("revamp.application."))
  );
}

export function AdminIntegrationPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole } = useAdminGovernanceRole();

  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [sections, setSections] = useState<RevampSectionSnapshot[]>([]);
  const [history, setHistory] = useState<AdminReviewCaseSummary[]>([]);
  const [latestIntegrationRequest, setLatestIntegrationRequest] = useState<AdminIntegrationRequestSummary | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [integrationDueAt, setIntegrationDueAt] = useState("");
  const [integrationMessage, setIntegrationMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"open" | "send" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const integrationRefreshInFlightRef = useRef(false);
  const integrationRefreshQueuedRef = useRef(false);

  const normalizedAppId = applicationId.trim();
  const validAppId = UUID_PATTERN.test(normalizedAppId);
  const latestCase = useMemo(() => history[0] ?? null, [history]);
  const canOpenCase = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const canRequestIntegration = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE";
  const hasOpenIntegration = latestIntegrationRequest?.status === "OPEN";
  const selectedCount = selectedCodes.size;
  const itemTemplates = useMemo<RevampIntegrationItemTemplate[]>(
    () => buildRevampIntegrationItemTemplates(summary, sections),
    [sections, summary]
  );

  const selectedItems = useMemo<SelectedIntegrationItem[]>(
    () =>
      itemTemplates.filter((template) => selectedCodes.has(template.code)).map((template) => ({
        code: template.code,
        label: template.label,
        instruction: (instructions[template.code] ?? "").trim(),
        documentType: template.documentType,
        certificationKey: template.certificationKey,
        certificationLabel: template.certificationLabel,
        targetStep: template.targetStep
      })),
    [instructions, itemTemplates, selectedCodes]
  );

  const emailPreview = useMemo(() => {
    const deadline = integrationDueAt ? new Date(integrationDueAt).toLocaleDateString("it-IT") : "[data scadenza]";
    const greeting = `Gentile fornitore (${summary ? appCode(summary.id) : "candidatura"}),`;
    const baseMessage = integrationMessage.trim() || "abbiamo esaminato la candidatura e sono necessarie alcune integrazioni documentali.";
    const bulletItems = selectedItems.length === 0
      ? ["- [Nessun elemento selezionato]"]
      : selectedItems.map((item) =>
          `- ${item.label}${item.instruction ? `: ${item.instruction}` : ""}`
        );
    const body = [
      greeting,
      "",
      `${baseMessage}`,
      `Ti chiediamo di inviare i seguenti elementi entro il ${deadline}:`,
      ...bulletItems,
      "",
      "Cordiali saluti,",
      "Team Albo Fornitori"
    ].join("\n");

    return {
      subject: `Richiesta integrazione documentale - ${summary ? appCode(summary.id) : "candidatura"}`,
      body
    };
  }, [integrationDueAt, integrationMessage, selectedItems, summary]);

  const loadPage = useCallback(async (showLoading = true) => {
    if (!token || !validAppId) return;
    if (integrationRefreshInFlightRef.current) {
      integrationRefreshQueuedRef.current = true;
      return;
    }

    integrationRefreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const [summaryData, historyData, sectionsData] = await Promise.all([
        getRevampApplicationSummary(normalizedAppId, token),
        getAdminReviewHistory(normalizedAppId, token),
        getRevampApplicationSections(normalizedAppId, token)
      ]);
      setSummary(summaryData);
      setSections(sectionsData);
      const nextTemplates = buildRevampIntegrationItemTemplates(summaryData, sectionsData);
      const sortedHistory = [...historyData].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      setHistory(sortedHistory);
      const latestCaseId = sortedHistory[0]?.id;
      if (latestCaseId) {
        try {
          const latestReq = await getLatestAdminIntegrationRequest(latestCaseId, token);
          setLatestIntegrationRequest(latestReq);
          if (latestReq?.status === "OPEN") {
            setIntegrationDueAt(latestReq.dueAt.slice(0, 10));
            setIntegrationMessage(latestReq.requestMessage ?? "");
            const payload = latestReq.requestedItemsJson as { items?: Array<{ code?: string; instruction?: string }> } | null;
            const nextCodes = new Set<string>();
            const nextInstructions: Record<string, string> = {};
            (payload?.items ?? []).forEach((item) => {
              const code = typeof item.code === "string" ? item.code : "";
              if (code && nextTemplates.some((template) => template.code === code)) {
                nextCodes.add(code);
                nextInstructions[code] = (item.instruction ?? "").trim();
              }
            });
            setSelectedCodes(nextCodes);
            setInstructions(nextInstructions);
          }
        } catch {
          setLatestIntegrationRequest(null);
        }
      } else {
        setLatestIntegrationRequest(null);
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento dati integrazione non riuscito.";
      setToast({ message, type: "error" });
      setSummary(null);
      setSections([]);
      setHistory([]);
      setLatestIntegrationRequest(null);
    } finally {
      integrationRefreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
      if (integrationRefreshQueuedRef.current) {
        integrationRefreshQueuedRef.current = false;
        void loadPage(false);
      }
    }
  }, [normalizedAppId, token, validAppId]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  useAdminRealtimeRefresh({
    token,
    enabled: validAppId,
    shouldRefresh: (event) => shouldRefreshIntegration(event, normalizedAppId),
    onRefresh: () => loadPage(false)
  });

  async function onOpenCase() {
    if (!token || !validAppId || !canOpenCase || busy) return;
    setBusy(true);
    setBusyAction("open");
    try {
      await assignAdminReviewCase(normalizedAppId, token);
      setToast({ message: "Review case aperto/assegnato.", type: "success" });
      await loadPage();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Apertura review case non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  function toggleItem(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function onSubmitIntegration(event: FormEvent) {
    event.preventDefault();
    if (!token || !latestCase || busy || !canRequestIntegration || hasOpenIntegration) return;
    if (selectedItems.length === 0) {
      setToast({ message: "Seleziona almeno un elemento da integrare.", type: "error" });
      return;
    }
    if (!integrationDueAt || !integrationMessage.trim()) {
      setToast({ message: "Compila scadenza e messaggio introduttivo.", type: "error" });
      return;
    }

    setBusy(true);
    setBusyAction("send");
    try {
      const requestedItemsJson = JSON.stringify({
        items: selectedItems,
        generatedAt: new Date().toISOString()
      });
      await requestAdminIntegration(latestCase.id, token, {
        dueAt: `${integrationDueAt}T23:59:00`,
        message: integrationMessage.trim(),
        requestedItemsJson
      });
      setToast({ message: "Richiesta integrazione inviata al fornitore.", type: "success" });
      await loadPage();
      navigate(`/admin/candidature/${normalizedAppId}/review`);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Invio integrazione non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  return (
    <AdminCandidatureShell active="candidature">
      <section className="stack admin-integration-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="admin-integration-hero">
        <div className="admin-integration-title-block">
          <span className="admin-page-breadcrumb">Candidature / Integrazione</span>
          <h2 className="admin-page-title">
            <Mail className="h-5 w-5" />
            Richiesta integrazione
          </h2>
          <p className="admin-page-subtitle">Prepara una richiesta chiara al fornitore: cosa manca, entro quando, e perche serve.</p>
          {!validAppId ? <p className="error">Application ID non valido (UUID richiesto).</p> : null}
        </div>
        <Link
          className="home-btn home-btn-secondary admin-action-btn admin-integration-back-icon"
          to={`/admin/candidature/${normalizedAppId}/review`}
          aria-label="Torna alla revisione"
          title="Torna alla revisione"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      {summary ? (
        <div className="admin-integration-summary-strip">
          <article>
            <span>Candidatura</span>
            <strong>{appCode(summary.id)}</strong>
          </article>
          <article>
            <span>Registro</span>
            <strong>{summary.registryType}</strong>
          </article>
          <article>
            <span>Protocollo</span>
            <strong>{summary.protocolCode ?? "Non assegnato"}</strong>
          </article>
          <article className={hasOpenIntegration ? "is-locked" : ""}>
            <span>Stato richiesta</span>
            <strong>{hasOpenIntegration ? "Gia inviata" : "Da preparare"}</strong>
          </article>
        </div>
      ) : null}

      {!latestCase ? (
        <div className="panel admin-integration-open-case">
          <p className="subtle">Nessun review case attivo per questa candidatura.</p>
          <button type="button" className="home-btn home-btn-primary admin-action-btn btn-with-icon btn-icon-open" onClick={() => void onOpenCase()} disabled={!canOpenCase || busy || loading}>
            <Send className="h-4 w-4" />
            {busyAction === "open" ? "Apertura case..." : "Apri/Assegna review case"}
          </button>
          {!canOpenCase && auth?.role === "ADMIN" ? (
            <p className="subtle">Apertura case disponibile solo per SUPER_ADMIN o RESPONSABILE_ALBO.</p>
          ) : null}
        </div>
      ) : null}

      {latestCase ? (
        <form id="admin-integration-request-form" className="admin-integration-form" onSubmit={onSubmitIntegration}>
          <div className="admin-integration-main">
            <div className="admin-integration-section-head">
              <div>
                <h4><FileWarning className="h-4 w-4" /> Cosa deve correggere o caricare</h4>
                <p className="subtle">Seleziona solo cio che serve. Le istruzioni sotto ogni voce finiscono nella richiesta.</p>
              </div>
              <span className="admin-integration-count">{selectedCount} selezionati</span>
            </div>

            <div className="admin-integration-items">
              {itemTemplates.length === 0 ? (
                <div className="admin-unified-table-empty">
                  Nessun documento caricato disponibile per questa candidatura.
                </div>
              ) : itemTemplates.map((item) => {
                const checked = selectedCodes.has(item.code);
                return (
                  <article
                    key={item.code}
                    className={checked ? "integration-item selected" : "integration-item"}
                    role="checkbox"
                    aria-checked={checked}
                    tabIndex={hasOpenIntegration ? -1 : 0}
                    onClick={() => {
                      if (!hasOpenIntegration) toggleItem(item.code);
                    }}
                    onKeyDown={(event) => {
                      if (hasOpenIntegration) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleItem(item.code);
                      }
                    }}
                  >
                    <div className="integration-item-head">
                      <span className="integration-check-visual" aria-hidden="true">
                        {checked ? <CheckCircle2 className="h-4 w-4" /> : null}
                      </span>
                      <span>{item.label}</span>
                      <span className={checked ? "integration-select-badge selected" : "integration-select-badge"}>
                        {checked ? "Selezionato" : "Richiedi"}
                      </span>
                    </div>
                    <p className="subtle">{item.hint}</p>
                    <input
                      className="floating-input integration-item-input"
                      value={instructions[item.code] ?? ""}
                      onChange={(event) =>
                        setInstructions((prev) => ({
                          ...prev,
                          [item.code]: event.target.value
                        }))
                      }
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      placeholder="Aggiungi istruzione specifica"
                      disabled={!checked || hasOpenIntegration}
                    />
                  </article>
                );
              })}
            </div>

            <div className="admin-integration-meta-panel">
              <div className="admin-integration-section-head compact">
                <div>
                  <h4><CalendarClock className="h-4 w-4" /> Messaggio e scadenza</h4>
                  <p className="subtle">Queste informazioni aiutano il fornitore a capire tempi e priorita.</p>
                </div>
              </div>
              <div className="admin-integration-meta-grid">
                <label className="admin-integration-field">
                  <span>Scadenza risposta *</span>
                  <input
                    type="date"
                    value={integrationDueAt}
                    onChange={(event) => setIntegrationDueAt(event.target.value)}
                    disabled={hasOpenIntegration}
                  />
                </label>
                <label className="admin-integration-field">
                  <span>Messaggio introduttivo *</span>
                  <textarea
                    rows={1}
                    value={integrationMessage}
                    onChange={(event) => setIntegrationMessage(event.target.value)}
                    placeholder="Scrivi un messaggio breve e chiaro per il fornitore..."
                    disabled={hasOpenIntegration}
                  />
                </label>
              </div>
            </div>

            {!canRequestIntegration && auth?.role === "ADMIN" ? (
              <p className="subtle integration-access-note">
                Invio integrazione disponibile solo per SUPER_ADMIN, RESPONSABILE_ALBO o REVISORE.
              </p>
            ) : null}

          </div>
          {hasOpenIntegration ? (
            <div className="admin-integration-lock-note">
              <LockKeyhole className="h-4 w-4" />
              <span>Richiesta gia aperta: i dati sono in sola lettura.</span>
            </div>
          ) : null}
        </form>
      ) : null}

      {selectedItems.length > 0 ? (
        <aside className="admin-integration-compose-popover" aria-live="polite">
          <div className="admin-integration-compose-head">
            <span><Mail className="h-4 w-4" /> Bozza e-mail</span>
            <small>{selectedItems.length} voci</small>
          </div>
          <div className="admin-integration-compose-subject">
            <strong>Oggetto</strong>
            <span>{emailPreview.subject}</span>
          </div>
          <pre>{emailPreview.body}</pre>
          <div className="admin-integration-compose-foot">
            <AlertTriangle className="h-4 w-4" />
            <span>Verifica testo e scadenza prima di inviare.</span>
          </div>
          <div className="admin-integration-compose-actions">
            <button
              type="submit"
              form="admin-integration-request-form"
              className="admin-integration-send-icon"
              disabled={busy || !canRequestIntegration || hasOpenIntegration}
              aria-label="Invia richiesta"
              title={busyAction === "send" ? "Invio richiesta..." : "Invia richiesta"}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </aside>
      ) : latestCase && !hasOpenIntegration ? (
        <div className="admin-integration-compose-hint" aria-live="polite">
          <Mail className="h-4 w-4" />
          <span>Seleziona una voce per creare l'e-mail</span>
        </div>
      ) : null}
      </section>
    </AdminCandidatureShell>
  );
}
