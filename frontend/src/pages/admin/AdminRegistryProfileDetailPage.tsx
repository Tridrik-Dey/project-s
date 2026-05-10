import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Building2,
  Clock,
  FileEdit,
  FileText,
  FilePlus,
  History,
  Mail,
  MessageSquare,
  RefreshCw,
  Save,
  ShieldCheck,
  Star,
  User,
  Wrench,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getAdminAuditEvents, type AdminAuditEventRow } from "../../api/adminAuditApi";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import type { AdminRegistryProfileRow, RegistryProfileStatus } from "../../api/adminProfilesApi";
import {
  getAdminProfile,
  getAdminProfileNotifications,
  getAdminProfileTimeline,
  reactivateAdminProfile,
  suspendAdminProfile,
  type AdminNotificationEvent,
  type AdminProfileTimelineEvent,
} from "../../api/adminProfileDetailApi";
import { getAdminEvaluationSummary, type AdminEvaluationAggregate } from "../../api/adminEvaluationApi";
import { API_BASE_URL, HttpError } from "../../api/http";
import {
  listFieldChangeRequests,
  adminUnlockSection,
  adminRejectChangeRequest,
  type FieldChangeRequest,
} from "../../api/fieldChangeRequestApi";
import {
  listDocumentRenewalRequests,
  type DocumentRenewalRequest,
} from "../../api/documentRenewalRequestApi";
import { getRevampApplicationSections, type RevampSectionSnapshot } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";
import { ComposeEmailModal } from "./components/ComposeEmailModal";
import { SupplierProfileView } from "./components/SupplierProfileView";

type DetailTab = "profilo" | "documenti" | "valutazioni" | "storico" | "note" | "comunicazioni";

type SectionPayload = Record<string, unknown>;

type DocumentRow = { id: string; label: string; sectionLabel: string; url: string | null };
type CommunicationRow = {
  id: string;
  title: string;
  detail: string;
  status: string;
  occurredAt: string | null;
  source: "workflow" | "email";
};
type HistoryRow = {
  id: string;
  title: string;
  detail: string;
  tone: "ok" | "warn" | "neutral";
  occurredAt: string | null;
};

function parsePayload(payloadJson?: string | null): SectionPayload | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SectionPayload;
  } catch { return null; }
  return null;
}

function scalar(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function notificationTitle(item: AdminNotificationEvent): string {
  if (item.eventKey === "admin.compose-email") return "Email manuale inviata";
  if (item.eventKey.includes("expiry") || item.eventKey.includes("reminder")) return "Promemoria inviato";
  if (item.eventKey.includes("fcr")) return "Email modifica dati";
  if (item.eventKey.includes("renewal")) return "Email rinnovo documenti";
  return "Email inviata";
}

function notificationDetail(item: AdminNotificationEvent): string {
  const parts = [`Destinatario: ${item.recipient || "n/d"}`];
  if (item.deliveryStatus) parts.push(`Stato: ${item.deliveryStatus}`);
  if (item.failureReason) parts.push(`Errore: ${item.failureReason}`);
  if (item.templateKey) {
    parts.push(`Template: ${item.templateKey}${item.templateVersion ? ` v${item.templateVersion}` : ""}`);
  }
  return parts.join(" · ");
}

function documentSectionLabel(sectionKey: string): string {
  const normalized = sectionKey.trim().toUpperCase();
  if (normalized === "S1" || normalized === "STEP_1_ANAGRAFICA") return "Anagrafica";
  if (normalized === "S2" || normalized === "STEP_2_TIPOLOGIA") return "Tipologia";
  if (normalized === "S3" || normalized === "S3A" || normalized === "S3B" || normalized === "STEP_3_COMPETENZE") return "Competenze";
  if (normalized === "S4" || normalized === "STEP_4_DOCUMENTI") return "Documenti";
  if (normalized === "S5" || normalized === "STEP_5_DICHIARAZIONI") return "Dichiarazioni";
  return sectionKey;
}

function documentDownloadUrl(storageKey: unknown, applicationId: string | null | undefined): string | null {
  const key = scalar(storageKey);
  if (!key) return null;
  if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("data:")) return key;
  if (!applicationId || key === "upload-pending") return null;
  return `/api/v2/applications/${encodeURIComponent(applicationId)}/attachments/download?storageKey=${encodeURIComponent(key)}`;
}

function isUploadedAttachment(value: Record<string, unknown> | null | undefined): value is Record<string, unknown> {
  const fileName = scalar(value?.fileName);
  const storageKey = scalar(value?.storageKey);
  return Boolean(fileName && storageKey && storageKey !== "upload-pending");
}

function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  const p = Date.parse(v);
  if (!Number.isFinite(p)) return "—";
  return new Date(p).toLocaleDateString("it-IT");
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const p = Date.parse(v);
  if (!Number.isFinite(p)) return "—";
  return new Date(p).toLocaleString("it-IT");
}

function statusLabel(s: RegistryProfileStatus): string {
  if (s === "APPROVED") return "Attiva";
  if (s === "SUSPENDED") return "Sospesa";
  if (s === "RENEWAL_DUE") return "In rinnovo";
  return "Archiviata";
}

function statusClass(s: RegistryProfileStatus): string {
  if (s === "APPROVED") return "tone-ok";
  if (s === "RENEWAL_DUE") return "tone-warn";
  if (s === "SUSPENDED") return "tone-danger";
  return "tone-neutral";
}

function fieldChangeGroupLabel(sectionKey: string | null | undefined): string {
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

function timelineEventCopy(event: AdminProfileTimelineEvent): { title: string; detail: string; tone: "ok" | "warn" | "neutral" } {
  const key = event.eventKey.toLowerCase();
  const reason = event.reason?.trim();
  if (key.includes("reactivated")) {
    return {
      title: "Profilo riattivato",
      detail: reason || "Il fornitore e tornato disponibile nell'albo.",
      tone: "ok",
    };
  }
  if (key.includes("suspended")) {
    return {
      title: "Profilo sospeso",
      detail: reason || "Il fornitore e stato fermato temporaneamente.",
      tone: "warn",
    };
  }
  return {
    title: "Aggiornamento profilo",
    detail: reason || "E stata registrata una modifica su questo profilo.",
    tone: "neutral",
  };
}

function parseDocuments(sections: RevampSectionSnapshot[], applicationId: string | null | undefined): DocumentRow[] {
  const docs: DocumentRow[] = [];
  sections.forEach((section) => {
    const payload = parsePayload(section.payloadJson);
    if (!payload) return;

    const profilePhoto = payload.profilePhotoAttachment as Record<string, unknown> | undefined;
    if (isUploadedAttachment(profilePhoto)) {
      docs.push({
        id: `${section.id}-profile-photo`,
        label: scalar(profilePhoto.fileName) || "Foto profilo",
        sectionLabel: documentSectionLabel(section.sectionKey),
        url: documentDownloadUrl(profilePhoto.storageKey, applicationId),
      });
    }

    const attachments = Array.isArray(payload.attachments)
      ? (payload.attachments as Array<Record<string, unknown>>)
      : [];
    attachments.forEach((attachment, index) => {
      if (!isUploadedAttachment(attachment)) return;
      const documentType = scalar(attachment.documentType);
      const fileName = scalar(attachment.fileName);
      docs.push({
        id: `${section.id}-attachment-${index}`,
        label: [documentType, fileName].filter(Boolean).join(" - ") || "Allegato",
        sectionLabel: documentSectionLabel(section.sectionKey),
        url: documentDownloadUrl(attachment.storageKey, applicationId),
      });
    });
  });
  return docs;
}

function parseAuditMetadata(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value)])
    );
  } catch {
    return {};
  }
}

function workflowCommunication(event: AdminAuditEventRow): CommunicationRow | null {
  const meta = parseAuditMetadata(event.metadataJson);
  const key = event.eventKey ?? "";
  if (key === "revamp.application.submitted") {
    return {
      id: event.id,
      title: "Candidatura ricevuta",
      detail: meta.protocolCode ? `Codice protocollo: ${meta.protocolCode}` : "La candidatura e stata inviata dal fornitore.",
      status: "Workflow",
      occurredAt: event.occurredAt,
      source: "workflow"
    };
  }
  if (key === "revamp.review.integration_requested") {
    return {
      id: event.id,
      title: "Richiesta integrazione inviata",
      detail: "Sono stati richiesti documenti o informazioni mancanti al fornitore.",
      status: "Integrazione",
      occurredAt: event.occurredAt,
      source: "workflow"
    };
  }
  if (key === "revamp.application.integration.answered") {
    return {
      id: event.id,
      title: "Integrazione ricevuta",
      detail: "Il fornitore ha risposto alla richiesta di integrazione.",
      status: "Ricevuta",
      occurredAt: event.occurredAt,
      source: "workflow"
    };
  }
  if (key === "revamp.review.decided") {
    const approved = meta.decision === "APPROVED";
    if (meta.reviewType === "DOCUMENT_RENEWAL") {
      return {
        id: event.id,
        title: approved ? "Rinnovo documenti approvato" : "Rinnovo documenti respinto",
        detail: meta.documents ? `Documenti: ${meta.documents}` : "Decisione registrata per rinnovo documenti.",
        status: approved ? "Approvato" : "Respinto",
        occurredAt: event.occurredAt,
        source: "workflow"
      };
    }
    if (meta.reviewType === "FIELD_CHANGE") {
      return {
        id: event.id,
        title: approved ? "Modifica dati approvata" : "Modifica dati respinta",
        detail: approved ? "La modifica dati e stata approvata." : "La modifica dati e stata respinta.",
        status: approved ? "Approvata" : "Respinta",
        occurredAt: event.occurredAt,
        source: "workflow"
      };
    }
    return {
      id: event.id,
      title: approved ? "Candidatura approvata" : "Candidatura non approvata",
      detail: approved ? "Il fornitore e stato approvato nell'albo." : "La candidatura e stata chiusa con esito negativo.",
      status: approved ? "Approvata" : "Non approvata",
      occurredAt: event.occurredAt,
      source: "workflow"
    };
  }
  return null;
}

function fieldChangeWorkflowCommunications(fcr: FieldChangeRequest): CommunicationRow[] {
  const groupLabel = fieldChangeGroupLabel(fcr.sectionKey);
  const rows: CommunicationRow[] = [{
    id: `fcr-created-${fcr.id}`,
    title: "Richiesta modifica dati inviata",
    detail: `${groupLabel}${fcr.supplierMessage ? ` - ${fcr.supplierMessage}` : ""}`,
    status: "Richiesta",
    occurredAt: fcr.createdAt,
    source: "workflow"
  }];
  if (fcr.unlockedAt) {
    rows.push({
      id: `fcr-unlocked-${fcr.id}`,
      title: "Modifica dati sbloccata",
      detail: `${groupLabel}${fcr.adminNote ? ` - Nota: ${fcr.adminNote}` : ""}`,
      status: "Sbloccata",
      occurredAt: fcr.unlockedAt,
      source: "workflow"
    });
  }
  if (fcr.submittedAt) {
    rows.push({
      id: `fcr-submitted-${fcr.id}`,
      title: "Modifica dati inviata in revisione",
      detail: groupLabel,
      status: "In revisione",
      occurredAt: fcr.submittedAt,
      source: "workflow"
    });
  }
  if (fcr.status === "REJECTED_BY_ADMIN") {
    rows.push({
      id: `fcr-rejected-admin-${fcr.id}`,
      title: "Richiesta modifica dati rifiutata",
      detail: `${groupLabel}${fcr.adminNote ? ` - Motivo: ${fcr.adminNote}` : ""}`,
      status: "Rifiutata",
      occurredAt: fcr.updatedAt,
      source: "workflow"
    });
  }
  if (fcr.status === "CANCELLED_BY_SUPPLIER") {
    rows.push({
      id: `fcr-cancelled-${fcr.id}`,
      title: "Richiesta modifica dati annullata",
      detail: `${groupLabel} - Il fornitore ha scelto di non modificare i dati.`,
      status: "Annullata",
      occurredAt: fcr.updatedAt,
      source: "workflow"
    });
  }
  return rows;
}

function documentRenewalWorkflowCommunications(request: DocumentRenewalRequest): CommunicationRow[] {
  const rows: CommunicationRow[] = [{
    id: `renewal-requested-${request.id}`,
    title: request.expiredWithoutResponse ? "Documento scaduto da rinnovare" : "Rinnovo documento richiesto",
    detail: `${request.documentLabel}${request.expiryDate ? ` - Scadenza: ${formatDate(request.expiryDate)}` : ""}`,
    status: request.expiredWithoutResponse ? "Scaduto" : "Richiesto",
    occurredAt: request.createdAt,
    source: "workflow"
  }];
  if (request.submittedAt) {
    rows.push({
      id: `renewal-submitted-${request.id}`,
      title: "Documento aggiornato dal fornitore",
      detail: request.documentLabel,
      status: "In revisione",
      occurredAt: request.submittedAt,
      source: "workflow"
    });
  }
  if (request.status === "APPROVED" || request.status === "REJECTED") {
    rows.push({
      id: `renewal-outcome-${request.id}`,
      title: request.status === "APPROVED" ? "Documento rinnovato approvato" : "Documento rinnovato respinto",
      detail: request.documentLabel,
      status: request.status === "APPROVED" ? "Approvato" : "Respinto",
      occurredAt: request.updatedAt,
      source: "workflow"
    });
  }
  return rows;
}

function documentRenewalHistoryRows(request: DocumentRenewalRequest): HistoryRow[] {
  const rows: HistoryRow[] = [{
    id: `renewal-history-requested-${request.id}`,
    title: request.expiredWithoutResponse ? "Documento scaduto da rinnovare" : "Rinnovo documento richiesto",
    detail: `${request.documentLabel}${request.expiryDate ? ` - Scadenza: ${formatDate(request.expiryDate)}` : ""}`,
    tone: "warn",
    occurredAt: request.createdAt
  }];
  if (request.submittedAt) {
    rows.push({
      id: `renewal-history-submitted-${request.id}`,
      title: "Documento aggiornato dal fornitore",
      detail: request.documentLabel,
      tone: "neutral",
      occurredAt: request.submittedAt
    });
  }
  if (request.status === "APPROVED" || request.status === "REJECTED") {
    rows.push({
      id: `renewal-history-outcome-${request.id}`,
      title: request.status === "APPROVED" ? "Documento rinnovato approvato" : "Documento rinnovato respinto",
      detail: request.documentLabel,
      tone: request.status === "APPROVED" ? "ok" : "warn",
      occurredAt: request.updatedAt
    });
  }
  return rows;
}

function applicationHistoryEvent(event: AdminAuditEventRow): HistoryRow | null {
  const meta = parseAuditMetadata(event.metadataJson);
  const key = event.eventKey ?? "";
  if (key === "revamp.application.created") {
    return {
      id: event.id,
      title: "Bozza candidatura creata",
      detail: meta.applicantName ? `Creata da ${meta.applicantName}.` : "La candidatura e stata avviata.",
      tone: "neutral",
      occurredAt: event.occurredAt
    };
  }
  if (key === "revamp.application.submitted") {
    return {
      id: event.id,
      title: "Candidatura inviata",
      detail: meta.protocolCode ? `Protocollo ${meta.protocolCode}.` : "La candidatura e stata inviata.",
      tone: "neutral",
      occurredAt: event.occurredAt
    };
  }
  if (key === "revamp.review.opened") {
    return {
      id: event.id,
      title: "Presa in carico",
      detail: meta.actorName ? `Pratica presa in carico da ${meta.actorName}.` : "La pratica e stata presa in carico.",
      tone: "neutral",
      occurredAt: event.occurredAt
    };
  }
  if (key === "revamp.review.verified") {
    return {
      id: event.id,
      title: "Verifica completata",
      detail: meta.verificationOutcome ? `Esito verifica: ${meta.verificationOutcome}.` : "La verifica amministrativa e stata completata.",
      tone: "ok",
      occurredAt: event.occurredAt
    };
  }
  if (key === "revamp.review.integration_requested") {
    return {
      id: event.id,
      title: "Integrazione richiesta",
      detail: "La pratica e stata sospesa in attesa di documenti o informazioni mancanti.",
      tone: "warn",
      occurredAt: event.occurredAt
    };
  }
  if (key === "revamp.application.integration.answered") {
    return {
      id: event.id,
      title: "Integrazione ricevuta",
      detail: "Il fornitore ha inviato le integrazioni richieste.",
      tone: "neutral",
      occurredAt: event.occurredAt
    };
  }
  if (key === "revamp.review.decided") {
    const approved = meta.decision === "APPROVED";
    if (meta.reviewType === "DOCUMENT_RENEWAL") {
      return {
        id: event.id,
        title: approved ? "Rinnovo documenti approvato" : "Rinnovo documenti respinto",
        detail: meta.documents ? `Documenti: ${meta.documents}.` : "Decisione registrata per rinnovo documenti.",
        tone: approved ? "ok" : "warn",
        occurredAt: event.occurredAt
      };
    }
    if (meta.reviewType === "FIELD_CHANGE") {
      return {
        id: event.id,
        title: approved ? "Modifica dati approvata" : "Modifica dati respinta",
        detail: approved ? "La modifica dati e stata approvata." : "La modifica dati e stata respinta.",
        tone: approved ? "ok" : "warn",
        occurredAt: event.occurredAt
      };
    }
    return {
      id: event.id,
      title: approved ? "Profilo approvato" : "Candidatura non approvata",
      detail: approved ? "La candidatura e stata approvata e proiettata nel profilo albo." : "La pratica e stata chiusa con esito negativo.",
      tone: approved ? "ok" : "warn",
      occurredAt: event.occurredAt
    };
  }
  return null;
}

function shouldRefreshProfileDetail(event: DashboardActivityEvent, profileId: string, applicationId: string | null | undefined): boolean {
  const key = event.eventKey ?? "";
  if (event.entityType === "REVAMP_SUPPLIER_REGISTRY_PROFILE" && event.entityId === profileId) return true;
  if (event.entityType === "REVAMP_APPLICATION" && applicationId && event.entityId === applicationId) return true;
  if (event.entityType === "FIELD_CHANGE_REQUEST" || key.startsWith("fcr.")) return true;
  if (event.entityType === "DOCUMENT_RENEWAL_REQUEST" || key.startsWith("document_renewal.")) return true;
  return key.includes("evaluation") && event.entityId === profileId;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function AdminRegistryProfileDetailPage() {
  const { profileId = "" } = useParams();
  const location = useLocation();
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole } = useAdminGovernanceRole();
  const isAlboB = location.pathname.startsWith("/admin/albo-b/");
  const shellActive = isAlboB ? "alboB" : "alboA";
  const returnTo = new URLSearchParams(location.search).get("returnTo");
  const safeReturnTo = returnTo?.startsWith("/admin/candidature") ? returnTo : null;
  const backPath = safeReturnTo ?? (isAlboB ? "/admin/albo-b" : "/admin/albo-a");
  const backLabel = safeReturnTo ? "Modifiche dati" : isAlboB ? "Albo B — Aziende" : "Albo A — Professionisti";

  const [tab, setTab] = useState<DetailTab>("profilo");
  const [profile, setProfile] = useState<AdminRegistryProfileRow | null>(null);
  const [sections, setSections] = useState<RevampSectionSnapshot[]>([]);
  const [timeline, setTimeline] = useState<AdminProfileTimelineEvent[]>([]);
  const [notifications, setNotifications] = useState<AdminNotificationEvent[]>([]);
  const [applicationAudit, setApplicationAudit] = useState<AdminAuditEventRow[]>([]);
  const [evaluationAggregate, setEvaluationAggregate] = useState<AdminEvaluationAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<"suspend" | "reactivate" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [notes, setNotes] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [fieldChangeRequests, setFieldChangeRequests] = useState<FieldChangeRequest[]>([]);
  const [documentRenewalRequests, setDocumentRenewalRequests] = useState<DocumentRenewalRequest[]>([]);
  const [fcrActionBusy, setFcrActionBusy] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  const canManageStatus = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const canWrite = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE";
  const canExportPdf = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";

  async function openDocument(url: string | null) {
    if (!url) return;
    let resolvedUrl = url;
    if (resolvedUrl.startsWith(API_BASE_URL)) resolvedUrl = resolvedUrl.slice(API_BASE_URL.length);
    if (!resolvedUrl.startsWith("/api/")) {
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const win = window.open("", "_blank");
    if (win) {
      win.document.body.innerHTML = "<p style=\"font-family:sans-serif;padding:24px\">Apertura documento in corso...</p>";
    }
    try {
      const res = await fetch(`${API_BASE_URL}${resolvedUrl}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      if (win) { win.location.href = objectUrl; } else { window.open(objectUrl, "_blank", "noopener,noreferrer"); }
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      win?.close();
      setToast({ message: "Documento non apribile. File non trovato o accesso non autorizzato.", type: "error" });
    }
  }

  useEffect(() => {
    try { setNotes(window.localStorage.getItem(`admin_profile_notes_${profileId}`) ?? ""); }
    catch { setNotes(""); }
  }, [profileId]);

  const loadDetail = useCallback(async (showLoading = true) => {
    if (!token || !profileId) return;
    if (refreshInFlightRef.current) { refreshQueuedRef.current = true; return; }
    refreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const profileData = await getAdminProfile(profileId, token);
      const [timelineData, notificationData] = await Promise.all([
        getAdminProfileTimeline(profileId, token).catch(() => []),
        getAdminProfileNotifications(profileId, token).catch(() => [])
      ]);
      setProfile(profileData);
      setTimeline(timelineData);
      setNotifications(notificationData);
      if (profileData.applicationId) {
        const [sectionsData, auditData, fcrs, renewals] = await Promise.all([
          getRevampApplicationSections(profileData.applicationId, token).catch(() => []),
          getAdminAuditEvents(token, { entityType: "REVAMP_APPLICATION", entityId: profileData.applicationId }).catch(() => []),
          listFieldChangeRequests(profileData.applicationId, token).catch(() => [] as FieldChangeRequest[]),
          listDocumentRenewalRequests(profileData.applicationId, token).catch(() => [] as DocumentRenewalRequest[])
        ]);
        setSections(sectionsData);
        setApplicationAudit(auditData);
        setFieldChangeRequests(fcrs);
        setDocumentRenewalRequests(renewals);
      } else {
        setSections([]);
        setApplicationAudit([]);
        setFieldChangeRequests([]);
        setDocumentRenewalRequests([]);
      }
      const aggregate = await getAdminEvaluationSummary(profileId, token).catch(() => null);
      setEvaluationAggregate(aggregate);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento scheda profilo non riuscito.";
      setToast({ message, type: "error" });
      setProfile(null); setSections([]); setTimeline([]); setNotifications([]); setApplicationAudit([]); setEvaluationAggregate(null);
      setFieldChangeRequests([]);
      setDocumentRenewalRequests([]);
    } finally {
      refreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
      if (refreshQueuedRef.current) { refreshQueuedRef.current = false; void loadDetail(false); }
    }
  }, [profileId, token]);

  useEffect(() => { void loadDetail(true); }, [loadDetail]);

  useAdminRealtimeRefresh({
    token,
    enabled: Boolean(profileId),
    shouldRefresh: (event) => shouldRefreshProfileDetail(event, profileId, profile?.applicationId),
    onRefresh: () => loadDetail(false)
  });

  async function onSuspend() {
    if (!token || !profile || actionBusy || !canManageStatus) return;
    setActionBusy("suspend");
    try {
      const updated = await suspendAdminProfile(profile.id, token);
      setProfile(updated);
      setToast({ message: "Profilo sospeso con successo.", type: "success" });
      await loadDetail();
    } catch (error) {
      setToast({ message: error instanceof HttpError ? error.message : "Sospensione non riuscita.", type: "error" });
    } finally { setActionBusy(null); }
  }

  async function onReactivate() {
    if (!token || !profile || actionBusy || !canManageStatus) return;
    setActionBusy("reactivate");
    try {
      const updated = await reactivateAdminProfile(profile.id, token);
      setProfile(updated);
      setToast({ message: "Profilo riattivato con successo.", type: "success" });
      await loadDetail();
    } catch (error) {
      setToast({ message: error instanceof HttpError ? error.message : "Riattivazione non riuscita.", type: "error" });
    } finally { setActionBusy(null); }
  }

  function saveNotes() {
    try {
      window.localStorage.setItem(`admin_profile_notes_${profileId}`, notes);
      setToast({ message: "Note salvate.", type: "success" });
    } catch {
      setToast({ message: "Salvataggio note non riuscito.", type: "error" });
    }
  }

  const canSuspend = profile?.status === "APPROVED" || profile?.status === "RENEWAL_DUE";
  const canReactivate = profile?.status === "SUSPENDED";
  const profileName = profile?.displayName || (isAlboB ? "Azienda" : "Professionista");
  const score = typeof profile?.aggregateScore === "number" ? profile.aggregateScore : 0;
  const documents = parseDocuments(sections, profile?.applicationId);
  const historyRows: HistoryRow[] = [
    ...timeline.map((event) => {
      const copy = timelineEventCopy(event);
      return {
        id: event.id,
        title: copy.title,
        detail: copy.detail,
        tone: copy.tone,
        occurredAt: event.occurredAt
      };
    }),
    ...applicationAudit
      .map(applicationHistoryEvent)
      .filter((item): item is HistoryRow => Boolean(item)),
    ...documentRenewalRequests.flatMap(documentRenewalHistoryRows),
    ...fieldChangeRequests.map((fcr): HistoryRow => {
      const tone: HistoryRow["tone"] = fcr.status === "APPROVED"
        ? "ok"
        : fcr.status === "REJECTED" || fcr.status === "REJECTED_BY_ADMIN"
          ? "warn"
          : "neutral";
      return {
        id: `fcr-${fcr.id}`,
        title: fcr.status === "APPROVED"
          ? "Modifica dati approvata"
          : fcr.status === "REJECTED"
            ? "Modifica dati respinta"
            : fcr.status === "REJECTED_BY_ADMIN"
              ? "Richiesta modifica dati rifiutata"
            : fcr.status === "CANCELLED_BY_SUPPLIER"
              ? "Richiesta modifica dati annullata"
              : fcr.status === "SUBMITTED" || fcr.status === "UNDER_REVIEW"
                ? "Modifica dati in revisione"
                : fcr.status === "UNLOCKED"
                  ? "Modifica dati sbloccata"
                  : "Richiesta modifica dati",
        detail: `${fieldChangeGroupLabel(fcr.sectionKey)}${fcr.supplierMessage ? ` - ${fcr.supplierMessage}` : ""}${fcr.status === "REJECTED_BY_ADMIN" && fcr.adminNote ? ` - Motivo: ${fcr.adminNote}` : ""}`,
        tone,
        occurredAt: fcr.submittedAt ?? fcr.updatedAt ?? fcr.createdAt
      };
    })
  ].sort((a, b) => Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""));
  const communicationRows: CommunicationRow[] = [
    ...applicationAudit
      .map(workflowCommunication)
      .filter((item): item is CommunicationRow => Boolean(item)),
    ...documentRenewalRequests.flatMap(documentRenewalWorkflowCommunications),
    ...fieldChangeRequests.flatMap(fieldChangeWorkflowCommunications),
    ...notifications.map((item) => ({
      id: item.id,
      title: notificationTitle(item),
      detail: notificationDetail(item),
      status: item.deliveryStatus,
      occurredAt: item.sentAt ?? item.createdAt,
      source: "email" as const
    }))
  ].sort((a, b) => Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""));

  const s1 = parsePayload(sections.find((s) => s.sectionKey === "S1")?.payloadJson);
  const s2 = parsePayload(sections.find((s) => s.sectionKey === "S2")?.payloadJson);

  const heroSubtitle = isAlboB
    ? [scalar(s1?.vatNumber) ? `P.IVA ${scalar(s1?.vatNumber)}` : null, scalar(s1?.cciaaProvince) ? `CCIAA ${scalar(s1?.cciaaProvince)}` : null].filter(Boolean).join("  ·  ")
    : [scalar(s1?.taxCode) ? `CF ${scalar(s1?.taxCode)}` : null, scalar(s2?.professionalType) ? scalar(s2?.professionalType) : null].filter(Boolean).join("  ·  ");

  const tabs: Array<{ key: DetailTab; label: string; icon: React.ReactNode }> = [
    { key: "profilo", label: "Profilo completo", icon: <User className="h-4 w-4" /> },
    { key: "documenti", label: `Documenti${documents.length > 0 ? ` (${documents.length})` : ""}`, icon: <FileText className="h-4 w-4" /> },
    { key: "valutazioni", label: "Valutazioni", icon: <Star className="h-4 w-4" /> },
    { key: "storico", label: "Storico", icon: <History className="h-4 w-4" /> },
    { key: "note", label: "Note interne", icon: <MessageSquare className="h-4 w-4" /> },
    { key: "comunicazioni", label: "Comunicazioni", icon: <Mail className="h-4 w-4" /> },
  ];

  return (
    <AdminCandidatureShell active={shellActive}>
      <section className="stack admin-profile-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

        {/* Page header */}
        <div className="panel admin-profile-head">
          <div>
            <p className="subtle admin-profile-breadcrumb">
              <Link to={backPath} className="breadcrumb-link">{backLabel}</Link>
              {" / "}
              <span>{profileName}</span>
            </p>
            <h2 className="admin-profile-page-title">
              {isAlboB ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
              Scheda {isAlboB ? "Azienda" : "Professionista"}
            </h2>
          </div>
          <div className="admin-profile-head-actions">
            {adminRole !== "VIEWER" ? (
              <div className="head-icon-btn-wrap">
                <button
                  type="button"
                  className="head-icon-btn head-icon-btn--compose"
                  onClick={() => setShowCompose(true)}
                  aria-label="Scrivi email al fornitore"
                >
                  <Mail className="h-5 w-5" />
                </button>
                <span className="head-icon-tooltip">Scrivi email</span>
              </div>
            ) : null}
            <div className="head-icon-btn-wrap">
              <Link
                className="head-icon-btn head-icon-btn--back"
                to={backPath}
                aria-label={`Torna a ${backLabel}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="head-icon-tooltip">Torna a {backLabel}</span>
            </div>
          </div>
        </div>

        {profile ? (
          <>
            {/* Hero card */}
            <div className={`profile-hero-card ${isAlboB ? "hero-albo-b" : "hero-albo-a"}`}>
              <div className="hero-avatar">{initials(profileName)}</div>
              <div className="hero-identity">
                <div className="hero-name-row">
                  <h3 className="hero-name">{profileName}</h3>
                  <span className={`admin-albo-status ${statusClass(profile.status)} hero-status-badge`}>
                    {statusLabel(profile.status)}
                  </span>
                  <span className={`hero-registry-badge ${isAlboB ? "badge-albo-b" : "badge-albo-a"}`}>
                    {isAlboB ? "Albo B — Azienda" : "Albo A — Professionista"}
                  </span>
                  {profile.pendingFieldChange ? (
                    <span className="comm-status-badge badge-neutral">Modifica dati in revisione</span>
                  ) : null}
                </div>
                {heroSubtitle ? <p className="hero-subtitle">{heroSubtitle}</p> : null}
                {profile.publicSummary ? <p className="hero-summary">{profile.publicSummary}</p> : null}
              </div>
              <div className="hero-kpis">
                <article className="panel superadmin-kpi-card tone-info hero-kpi-card">
                  <div className="superadmin-kpi-head">
                    <h4>Valutazione</h4>
                    <span className="superadmin-kpi-icon"><Star className="h-4 w-4" /></span>
                  </div>
                  <strong>{score.toFixed(1)}</strong>
                </article>
                <article className="panel superadmin-kpi-card tone-ok hero-kpi-card">
                  <div className="superadmin-kpi-head">
                    <h4>Approvato il</h4>
                    <span className="superadmin-kpi-icon"><Clock className="h-4 w-4" /></span>
                  </div>
                  <strong>{formatDate(profile.approvedAt)}</strong>
                </article>
                <article className="panel superadmin-kpi-card tone-attention hero-kpi-card">
                  <div className="superadmin-kpi-head">
                    <h4>Scadenza iscrizione</h4>
                    <span className="superadmin-kpi-icon"><Award className="h-4 w-4" /></span>
                  </div>
                  <strong>{formatDate(profile.expiresAt)}</strong>
                </article>
              </div>
            </div>

            {/* Tab bar */}
            <div className="panel admin-profile-tabs">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={tab === t.key ? "active" : ""}
                  onClick={() => setTab(t.key)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Profilo completo tab */}
            {tab === "profilo" ? (
              <SupplierProfileView isAlboB={isAlboB} sections={sections} />
            ) : null}

            {/* Documenti tab */}
            {tab === "documenti" ? (
              <div className="panel">
                <h4><FileText className="h-4 w-4" /> Documenti allegati</h4>
                {documents.length === 0 ? (
                  <p className="subtle">Nessun documento con URL disponibile nelle sezioni.</p>
                ) : (
                  <div className="profile-doc-list">
                    {documents.map((doc) => (
                      <div key={doc.id} className="admin-profile-doc-row">
                        <div>
                          <span className="doc-label">{doc.label}</span>
                          <span className="doc-section-tag">{doc.sectionLabel}</span>
                        </div>
                        {doc.url ? (
                          <button type="button" className="home-btn home-btn-secondary admin-action-btn btn-with-icon btn-icon-open" onClick={() => { void openDocument(doc.url); }}>
                            Apri
                          </button>
                        ) : (
                          <span className="subtle">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Valutazioni tab */}
            {tab === "valutazioni" ? (
              <div className="panel admin-profile-eval-panel">
                <div className="admin-profile-eval-head">
                  <div>
                    <span className="admin-profile-eval-icon"><Star className="h-4 w-4" /></span>
                    <div>
                      <h4>Valutazioni</h4>
                      <p className="subtle">Sintesi dei valori registrati per questo profilo.</p>
                    </div>
                  </div>
                </div>
                {evaluationAggregate ? (
                  <>
                    <div className="admin-profile-eval-grid">
                      <article className="admin-profile-eval-card tone-blue">
                        <span><FileText className="h-4 w-4" /> Valutazioni totali</span>
                        <strong>{evaluationAggregate.totalEvaluations}</strong>
                        <small>storico registrato</small>
                      </article>
                      <article className="admin-profile-eval-card tone-green">
                        <span><ShieldCheck className="h-4 w-4" /> Valutazioni attive</span>
                        <strong>{evaluationAggregate.activeEvaluations}</strong>
                        <small>valide oggi</small>
                      </article>
                      <article className="admin-profile-eval-card tone-amber">
                        <span><Award className="h-4 w-4" /> Punteggio medio</span>
                        <strong>{evaluationAggregate.averageOverallScore.toFixed(2)} <small>/ 5</small></strong>
                        <small>media complessiva</small>
                      </article>
                    </div>
                  </>
                ) : (
                  <p className="subtle">Nessuna valutazione disponibile per questo profilo.</p>
                )}
              </div>
            ) : null}

            {/* Storico tab */}
            {tab === "storico" ? (
              <div className="panel admin-profile-history-panel">
                <div className="admin-profile-history-head">
                  <span className="admin-profile-history-icon"><History className="h-4 w-4" /></span>
                  <div>
                    <h4>Storico eventi</h4>
                    <p className="subtle">Cosa e successo al profilo, in ordine cronologico.</p>
                  </div>
                </div>
                {historyRows.length === 0 ? (
                  <p className="subtle">Nessun evento storico disponibile.</p>
                ) : (
                  <div className="profile-history-list">
                    {historyRows.map((event) => (
                      <article key={event.id} className={`admin-profile-history-item tone-${event.tone}`}>
                        <span className="admin-profile-history-marker" aria-hidden="true" />
                        <div className="admin-profile-history-content">
                          <div className="history-event-header">
                            <strong className="history-event-title">{event.title}</strong>
                            <span className="history-event-date">{formatDateTime(event.occurredAt)}</span>
                          </div>
                          <p className="history-event-reason">{event.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Note interne tab */}
            {tab === "note" ? (
              <div className="panel admin-profile-notes-panel">
                <div className="admin-profile-notes-head">
                  <span className="admin-profile-notes-icon"><MessageSquare className="h-4 w-4" /></span>
                  <div>
                    <h4>Note interne</h4>
                    <p className="subtle">Promemoria privati per il team amministrativo.</p>
                  </div>
                </div>
                <label className="admin-profile-note-editor">
                  <span>Annotazione</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Scrivi una nota utile per chi gestisce questo profilo..."
                    rows={4}
                  />
                </label>
                <div className="admin-profile-notes-footer">
                  <span>Visibile solo agli amministratori</span>
                  <button type="button" className="home-btn home-btn-primary admin-action-btn" onClick={saveNotes}>
                    <Save className="h-4 w-4" />
                    Salva note
                  </button>
                </div>
              </div>
            ) : null}

            {/* Comunicazioni tab */}
            {tab === "comunicazioni" ? (
              <div className="panel">

                {/* ── Field Change Requests ── */}
                {fieldChangeRequests.length > 0 ? (
                  <>
                    <h4><FileEdit className="h-4 w-4" /> Richieste di modifica dati</h4>
                    <div className="profile-history-list" style={{ marginBottom: 24 }}>
                      {fieldChangeRequests.map((fcr) => {
                        const isPending = fcr.status === "PENDING_ADMIN_REVIEW";
                        const statusLabel: Record<string, string> = {
                          PENDING_ADMIN_REVIEW: "In attesa",
                          UNLOCKED: "Sbloccata",
                          REJECTED_BY_ADMIN: "Rifiutata",
                          SUBMITTED: "Inviata",
                          UNDER_REVIEW: "In revisione",
                          APPROVED: "Approvata",
                          REJECTED: "Respinta",
                        };
                        const busy = fcrActionBusy === fcr.id;
                        return (
                          <article key={fcr.id} className="admin-profile-history-item">
                            <div className="history-event-header">
                              <strong className="history-event-key">
                                {fieldChangeGroupLabel(fcr.sectionKey)} — Richiesta modifica
                              </strong>
                              <span className={`comm-status-badge ${fcr.status === "APPROVED" ? "badge-ok" : fcr.status === "REJECTED" || fcr.status === "REJECTED_BY_ADMIN" ? "badge-warn" : "badge-neutral"}`}>
                                {statusLabel[fcr.status] ?? fcr.status}
                              </span>
                            </div>
                            <p className="subtle">{fcr.supplierMessage}</p>
                            {fcr.adminNote ? (
                              <p className="subtle"><em>Nota admin: {fcr.adminNote}</em></p>
                            ) : null}
                            {fcr.beforeValueJson && fcr.afterValueJson ? (
                              <p className="subtle" style={{ fontSize: "0.75rem" }}>
                                Modifica registrata — prima/dopo disponibile nell&apos;audit trail.
                              </p>
                            ) : null}
                            <p className="subtle">{formatDateTime(fcr.createdAt)}</p>
                            {isPending && canManageStatus ? (
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <button
                                  type="button"
                                  className="home-btn home-btn-primary admin-action-btn"
                                  style={{ fontSize: "0.8rem" }}
                                  disabled={busy}
                                  onClick={() => {
                                    setFcrActionBusy(fcr.id);
                                    adminUnlockSection(fcr.id, {}, token)
                                      .then((updated) => setFieldChangeRequests((prev) =>
                                        prev.map((r) => r.id === updated.id ? updated : r)
                                      ))
                                      .catch(() => setToast({ message: "Sblocco non riuscito.", type: "error" }))
                                      .finally(() => setFcrActionBusy(null));
                                  }}
                                >
                                  {busy ? "..." : "Sblocca sezione"}
                                </button>
                                <button
                                  type="button"
                                  className="home-btn home-btn-danger admin-action-btn"
                                  style={{ fontSize: "0.8rem" }}
                                  disabled={busy}
                                  onClick={() => {
                                    setFcrActionBusy(fcr.id);
                                    adminRejectChangeRequest(fcr.id, {}, token)
                                      .then((updated) => setFieldChangeRequests((prev) =>
                                        prev.map((r) => r.id === updated.id ? updated : r)
                                      ))
                                      .catch(() => setToast({ message: "Rifiuto non riuscito.", type: "error" }))
                                      .finally(() => setFcrActionBusy(null));
                                  }}
                                >
                                  {busy ? "..." : "Rifiuta"}
                                </button>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {/* ── System communications ── */}
                <h4><Mail className="h-4 w-4" /> Comunicazioni inviate</h4>
                {communicationRows.length === 0 ? (
                  <p className="subtle">Nessuna comunicazione registrata per questo profilo.</p>
                ) : (
                  <div className="profile-history-list">
                    {communicationRows.map((item) => (
                      <article key={item.id} className="admin-profile-history-item">
                        <div className="history-event-header">
                          <strong className="history-event-key">{item.title}</strong>
                          <span className={`comm-status-badge ${item.status === "DELIVERED" || item.status === "Ricevuta" || item.status === "Approvata" ? "badge-ok" : "badge-neutral"}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="subtle">{item.detail}</p>
                        <p className="subtle">{item.source === "email" ? "Email" : "Workflow"}: {formatDateTime(item.occurredAt)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Sticky action bar */}
            <div className="admin-profile-action-bar">
              {canManageStatus && canSuspend ? (
                <button type="button" className="home-btn home-btn-danger admin-action-btn" onClick={() => void onSuspend()} disabled={actionBusy !== null}>
                  <Wrench className="h-4 w-4" />
                  {actionBusy === "suspend" ? "Sospensione..." : "Sospendi profilo"}
                </button>
              ) : null}
              {canManageStatus && canReactivate ? (
                <button type="button" className="home-btn home-btn-primary admin-action-btn" onClick={() => void onReactivate()} disabled={actionBusy !== null}>
                  <ShieldCheck className="h-4 w-4" />
                  {actionBusy === "reactivate" ? "Riattivazione..." : "Riattiva profilo"}
                </button>
              ) : null}
              {canWrite ? (
                <button type="button" className="home-btn home-btn-secondary admin-action-btn" onClick={() => setTab("note")}>
                  <MessageSquare className="h-4 w-4" /> Note interne
                </button>
              ) : null}
              {canWrite ? (
                <Link
                  className="home-btn home-btn-secondary admin-action-btn"
                  to={profile.applicationId ? `/admin/candidature/${profile.applicationId}/integration` : "#"}
                >
                  <FilePlus className="h-4 w-4" /> Richiedi integrazione
                </Link>
              ) : null}
              {canExportPdf ? (
                <button
                  type="button"
                  className="home-btn home-btn-secondary admin-action-btn"
                  onClick={() => setToast({ message: "Export PDF in preparazione.", type: "success" })}
                >
                  <FileText className="h-4 w-4" /> Esporta PDF
                </button>
              ) : null}
            </div>
          </>
        ) : !loading ? (
          <div className="panel">
            <p className="subtle"><AlertTriangle className="h-4 w-4" /> Profilo non trovato o non ancora disponibile.</p>
          </div>
        ) : null}

        {loading ? (
          <div className="panel profile-loading-banner">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Caricamento scheda in corso...</span>
          </div>
        ) : null}
      </section>

      {showCompose && profile ? (
        <ComposeEmailModal
          profileId={profileId}
          supplierEmail={profile.supplierEmail ?? ""}
          supplierName={profileName}
          token={token}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            setToast({ message: "Email inviata con successo.", type: "success" });
            void loadDetail(false);
            setTab("comunicazioni");
          }}
        />
      ) : null}
    </AdminCandidatureShell>
  );
}
