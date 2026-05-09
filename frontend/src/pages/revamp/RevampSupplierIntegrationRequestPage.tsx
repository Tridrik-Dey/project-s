import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, FileUp, MessageSquare, Send, Wrench } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  answerRevampIntegrationRequest,
  completeRevampIntegrationItem,
  getOpenRevampIntegrationRequest,
  getRevampApplicationSections,
  getRevampApplicationSummary,
  saveRevampApplicationSection,
  uploadRevampAttachment,
  type RevampApplicationSummary,
  type RevampIntegrationRequestSummary,
  type RevampSectionSnapshot
} from "../../api/revampApplicationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { saveRevampApplicationIdForRegistry, saveRevampApplicationSession } from "../../utils/revampApplicationSession";
import { clearRevampIntegrationEditSession, saveRevampIntegrationEditSession } from "../../utils/revampIntegrationEditSession";
import { completedIntegrationCodes } from "../../utils/revampIntegrationCompletion";

type RequestedItem = {
  code: string;
  label: string;
  instruction: string;
  documentType?: string;
  certificationKey?: string;
  certificationLabel?: string;
  targetStep?: number;
};

function parseRequestedItems(payload: unknown): RequestedItem[] {
  if (!payload || typeof payload !== "object") return [];
  const rawItems = Array.isArray((payload as { items?: unknown }).items)
    ? (payload as { items: unknown[] }).items
    : [];

  return rawItems
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const parsed: RequestedItem = {
        code: typeof value.code === "string" ? value.code : "OTHER",
        label: typeof value.label === "string" ? value.label : "Elemento richiesto",
        instruction: typeof value.instruction === "string" ? value.instruction : ""
      };
      if (typeof value.documentType === "string") parsed.documentType = value.documentType;
      if (typeof value.certificationKey === "string") parsed.certificationKey = value.certificationKey;
      if (typeof value.certificationLabel === "string") parsed.certificationLabel = value.certificationLabel;
      if (typeof value.targetStep === "number") parsed.targetStep = value.targetStep;
      return parsed;
    })
    .filter((item): item is RequestedItem => Boolean(item));
}

function targetStepForItem(item: RequestedItem): number {
  if (item.targetStep && item.targetStep >= 1 && item.targetStep <= 5) return item.targetStep;
  if (item.code === "THEMATIC_SPECIFICATION" || item.code === "EXPERIENCE_CONSISTENCY") return 3;
  if (item.documentType || item.code === "CV" || item.code === "PROFESSIONAL_REGISTER" || item.code.startsWith("CERT_")) return 4;
  return 1;
}

function registryPath(registryType?: string | null): string {
  if (registryType === "ALBO_B") return "albo-b";
  return "albo-a";
}

function wizardStepPath(application: RevampApplicationSummary | null, step: number): string {
  const registry = registryPath(application?.registryType);
  const normalizedStep = Math.max(1, Math.min(step, 5));
  return normalizedStep <= 1 ? `/apply/${registry}` : `/apply/${registry}/step/${normalizedStep}`;
}

function parseSectionPayload(snapshot?: RevampSectionSnapshot): Record<string, unknown> {
  if (!snapshot?.payloadJson) return {};
  try {
    const parsed = JSON.parse(snapshot.payloadJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function integrationDocumentType(item: RequestedItem): string {
  if (item.documentType) return item.documentType;
  if (item.code === "CV") return "CV";
  if (item.code === "VISURA_CAMERALE") return "VISURA_CAMERALE";
  if (item.code === "DURC") return "DURC";
  if (item.code === "COMPANY_PROFILE") return "COMPANY_PROFILE";
  if (item.code === "PROFESSIONAL_REGISTER" || item.code === "PROFESSIONAL_CERTIFICATION" || item.code.startsWith("CERT_")) return "CERTIFICATION";
  return "OTHER";
}

function integrationDocumentLabel(item: RequestedItem): string {
  if (item.certificationLabel) return item.certificationLabel;
  return item.label || "Documento integrazione";
}

export function RevampSupplierIntegrationRequestPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const token = auth?.token ?? "";

  const [application, setApplication] = useState<RevampApplicationSummary | null>(null);
  const [request, setRequest] = useState<RevampIntegrationRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filesByKey, setFilesByKey] = useState<Record<string, File | null>>({});
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!token || !applicationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [summary, openRequest] = await Promise.all([
          getRevampApplicationSummary(applicationId, token),
          getOpenRevampIntegrationRequest(applicationId, token)
        ]);
        if (cancelled) return;
        setApplication(summary);
        setRequest(openRequest);
        saveRevampApplicationIdForRegistry(summary.registryType, summary.id);
        saveRevampApplicationSession({
          applicationId: summary.id,
          registryType: summary.registryType,
          status: summary.status,
          protocolCode: summary.protocolCode,
          updatedAt: summary.updatedAt,
          resumePath: `/application/${summary.id}/integration-request`
        });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof HttpError ? error.message : "Caricamento richiesta integrazione non riuscito.";
          setToast({ message, type: "error" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [applicationId, token]);

  const requestedItems = useMemo(() => parseRequestedItems(request?.requestedItemsJson), [request]);
  const completedCodes = useMemo(() => completedIntegrationCodes(request?.supplierResponseJson), [request?.supplierResponseJson]);
  const uploadItems = requestedItems.length > 0
    ? requestedItems
    : [{ code: "GENERAL_DOCUMENT", label: "Documento richiesto", instruction: "" }];
  const dueDateLabel = request?.dueAt ? new Date(request.dueAt).toLocaleDateString("it-IT") : "Non indicata";
  const profilePath = application ? `/apply/${registryPath(application.registryType)}/my-profile` : "/supplier/dashboard";

  async function sendIntegrationResponse() {
    if (!token || !application || busy) return;
    setBusy(true);
    try {
      const selectedEntries = Object.entries(filesByKey).filter((entry): entry is [string, File] => Boolean(entry[1]));
      if (selectedEntries.length > 0) {
        const sections = await getRevampApplicationSections(application.id, token);
        const s4 = sections.find((section) => section.sectionKey === "S4");
        const existingPayload = parseSectionPayload(s4);
        const existingAttachments = Array.isArray(existingPayload.attachments)
          ? existingPayload.attachments.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
          : [];
        const uploadedAttachments = [];

        for (const [key, file] of selectedEntries) {
          const item = uploadItems.find((candidate) => `${candidate.code}-${candidate.label}` === key)
            ?? { code: "GENERAL_DOCUMENT", label: "Documento integrazione", instruction: "" };
          const uploaded = await uploadRevampAttachment(application.id, file, token);
          uploadedAttachments.push({
            documentType: integrationDocumentType(item),
            fileName: uploaded.fileName,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
            storageKey: uploaded.storageKey,
            certificationLabel: integrationDocumentLabel(item),
            certificationKey: item.certificationKey,
            integrationRequestId: request?.id ?? null,
            integrationItemCode: item.code,
            uploadedForIntegration: true
          });
        }

        await saveRevampApplicationSection(
          application.id,
          "S4",
          JSON.stringify({
            ...existingPayload,
            attachments: [...existingAttachments, ...uploadedAttachments]
          }),
          Boolean(s4?.completed),
          token
        );
      }
      if (requestedItems.length > 0 && selectedEntries.length > 0) {
        const completedUploadCodes = new Set<string>();
        for (const [key] of selectedEntries) {
          const item = uploadItems.find((candidate) => `${candidate.code}-${candidate.label}` === key);
          if (item?.code) completedUploadCodes.add(item.code.trim().toUpperCase());
        }
        for (const code of completedUploadCodes) {
          await completeRevampIntegrationItem(application.id, code, token);
        }
      } else {
        await answerRevampIntegrationRequest(application.id, token);
      }
      clearRevampIntegrationEditSession();
      setToast({ message: "Integrazione inviata correttamente.", type: "success" });
      window.setTimeout(() => navigate(profilePath), 600);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Invio integrazione non riuscito. Controlla i dati e riprova.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!auth) return <Navigate to="/login" replace />;

  function rememberIntegrationEdit(step: number, selectedItem?: RequestedItem) {
    if (!application) return;
    const itemsForSession = selectedItem
      ? [selectedItem]
      : requestedItems.filter((item) => targetStepForItem(item) === step);
    saveRevampApplicationIdForRegistry(application.registryType, application.id);
    saveRevampIntegrationEditSession({
      applicationId: application.id,
      registryType: application.registryType,
      targetStep: step,
      returnPath: `/application/${application.id}/integration-request`,
      requestedItems: itemsForSession
        .map((item) => ({
          code: item.code,
          label: item.label,
          documentType: item.documentType,
          certificationKey: item.certificationKey,
          targetStep: targetStepForItem(item)
        }))
    });
  }

  return (
    <section className="supplier-integration-page">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} /> : null}

      <div className="supplier-integration-shell">
        <Link to={profilePath} className="supplier-integration-back">
          <ArrowLeft size={15} /> Torna al profilo
        </Link>

        <div className="supplier-integration-hero">
          <div className="supplier-integration-hero-icon">
            <FileUp size={24} />
          </div>
          <div>
            <h1>Richiesta integrazione</h1>
            <p>Completa le informazioni richieste dal Gruppo Solco e invia di nuovo la candidatura.</p>
          </div>
          <span className="supplier-integration-due">
            <Clock3 size={14} /> Scadenza: {dueDateLabel}
          </span>
        </div>

        {loading ? (
          <div className="supplier-integration-card">
            <p className="subtle">Caricamento richiesta...</p>
          </div>
        ) : !request ? (
          <div className="supplier-integration-empty">
            <CheckCircle2 size={24} />
            <div>
              <h2>Nessuna integrazione aperta</h2>
              <p>Non risultano richieste di documenti o informazioni mancanti per questa candidatura.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="supplier-integration-card">
              <div className="supplier-integration-card-head">
                <MessageSquare size={18} />
                <h2>Messaggio ricevuto</h2>
              </div>
              <p className="supplier-integration-message">{request.requestMessage}</p>
            </div>

            <div className="supplier-integration-items">
              {requestedItems.length === 0 ? (
                <div className="supplier-integration-item">
                  <div className="supplier-integration-item-icon"><AlertTriangle size={18} /></div>
                  <div>
                    <h3>Richiesta generale</h3>
                    <p>Controlla la candidatura e aggiorna le informazioni indicate nel messaggio.</p>
                  </div>
                  <Link className="supplier-integration-edit" to={wizardStepPath(application, 1)} onClick={() => rememberIntegrationEdit(1)}>
                    Modifica candidatura
                  </Link>
                </div>
              ) : requestedItems.map((item) => {
                const step = targetStepForItem(item);
                const uploadKey = `${item.code}-${item.label}`;
                const isCompleted = completedCodes.has(item.code.trim().toUpperCase());
                return (
                  <div key={`${item.code}-${item.label}`} className={`supplier-integration-item${isCompleted ? " is-completed" : ""}`}>
                    <div className="supplier-integration-item-icon"><Wrench size={18} /></div>
                    <div>
                      <h3>{item.label}</h3>
                      <p>{item.instruction || "Aggiorna questa parte della candidatura."}</p>
                      <label className="supplier-integration-upload">
                        <span>Allega nuovo documento</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          disabled={isCompleted}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] ?? null;
                            setFilesByKey((prev) => ({ ...prev, [uploadKey]: file }));
                          }}
                        />
                      </label>
                      {filesByKey[uploadKey] ? (
                        <span className="supplier-integration-file-name">{filesByKey[uploadKey]?.name}</span>
                      ) : null}
                    </div>
                    {isCompleted ? (
                      <span className="supplier-integration-edit is-disabled">Completato</span>
                    ) : (
                      <Link className="supplier-integration-edit" to={wizardStepPath(application, step)} onClick={() => rememberIntegrationEdit(step, item)}>
                        Modifica sezione {step}
                      </Link>
                    )}
                  </div>
                );
              })}
              {requestedItems.length === 0 ? (
                <div className="supplier-integration-item">
                  <div className="supplier-integration-item-icon"><FileUp size={18} /></div>
                  <div>
                    <h3>Carica documento</h3>
                    <p>Allega il file richiesto nel messaggio ricevuto.</p>
                    <label className="supplier-integration-upload">
                      <span>Allega nuovo documento</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0] ?? null;
                          setFilesByKey((prev) => ({ ...prev, "GENERAL_DOCUMENT-Documento richiesto": file }));
                        }}
                      />
                    </label>
                    {filesByKey["GENERAL_DOCUMENT-Documento richiesto"] ? (
                      <span className="supplier-integration-file-name">{filesByKey["GENERAL_DOCUMENT-Documento richiesto"]?.name}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {requestedItems.length === 0 ? (
              <div className="supplier-integration-submit-card">
                <div>
                  <h2>Quando hai completato le modifiche</h2>
                  <p>Invia l'integrazione: la pratica tornera al Gruppo Solco per una nuova verifica.</p>
                </div>
                <button type="button" className="supplier-integration-submit" onClick={sendIntegrationResponse} disabled={busy}>
                  <Send size={16} /> {busy ? "Invio..." : "Invia integrazione"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
