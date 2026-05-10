import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Clock3, ExternalLink, FileText, History, Info, MessageSquare, RefreshCw, Save, XCircle } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getAdminAuditEvents, type AdminAuditEventRow } from "../../api/adminAuditApi";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import { type AdminRole } from "../../api/adminUsersRolesApi";
import { API_BASE_URL, HttpError } from "../../api/http";
import { getRevampApplicationSections, getRevampApplicationSummary, type RevampApplicationSummary, type RevampSectionSnapshot } from "../../api/revampApplicationApi";
import {
  getAdminReviewHistory,
  getLatestAdminIntegrationRequest,
  saveAdminReviewDecision,
  verifyAdminReviewCase,
  type AdminIntegrationRequestSummary,
  type AdminReviewCaseSummary
} from "../../api/adminReviewApi";
import type { DocumentRenewalRequest } from "../../api/documentRenewalRequestApi";
import { listFieldChangeRequests, type FieldChangeRequest } from "../../api/fieldChangeRequestApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";
import { SupplierProfileView } from "./components/SupplierProfileView";

type DecisionAction = "APPROVED" | "REJECTED";
type VerificationOutcome = "COMPLIANT" | "COMPLIANT_WITH_RESERVATIONS" | "INCOMPLETE" | "NON_COMPLIANT";
type SectionPayload = Record<string, unknown>;
type DocumentRow = { id: string; label: string; sectionLabel: string; url: string | null; hasLink: boolean };
type RenewalReviewRow = {
  id: string;
  label: string;
  sectionLabel: string;
  statusLabel: string;
  tone: "ok" | "warn" | "danger" | "neutral";
  submittedAt: string | null;
  oldValue: string;
  newValue: string;
  expiry: string;
};
type ReviewTimelineEvent = {
  id: string;
  title: string;
  badge: string;
  tone: "ok" | "warn" | "danger" | "neutral";
  detail?: string;
  occurredAt: string;
  decision?: "approve" | "reject";
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISION_REASON_MAX = 500;
const HISTORY_SNAKE_ROW_SIZE = 3;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
}

function sectionLabel(sectionKey: string): string {
  const normalized = sectionKey.trim().toUpperCase();
  if (normalized === "S1") return "Anagrafica";
  if (normalized === "S2") return "Tipologia";
  if (normalized === "S3" || normalized === "S3A" || normalized === "S3B") return "Competenze";
  if (normalized === "S4") return "Documenti";
  if (normalized === "S5") return "Dichiarazioni";
  if (normalized === "STEP_1_ANAGRAFICA") return "Anagrafica";
  if (normalized === "STEP_2_TIPOLOGIA") return "Tipologia";
  if (normalized === "STEP_3_COMPETENZE") return "Competenze";
  if (normalized === "STEP_4_DOCUMENTI") return "Documenti";
  if (normalized === "STEP_5_DICHIARAZIONI") return "Dichiarazioni";
  return sectionKey;
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
  return labels[normalized] ?? sectionLabel(sectionKey ?? "Modifica dati");
}

function appShortCode(applicationId: string): string {
  return `A-${applicationId.slice(0, 8).toUpperCase()}`;
}

function applicationDisplayCode(summary: RevampApplicationSummary | null): string {
  if (!summary) return "—";
  return summary.protocolCode?.trim() || appShortCode(summary.id);
}

function parsePayload(payloadJson?: string): SectionPayload | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SectionPayload;
  } catch {
    return null;
  }
  return null;
}

function getSectionPayload(sections: RevampSectionSnapshot[], ...keys: string[]): SectionPayload | null {
  for (const key of keys) {
    const section = sections.find((item) => item.sectionKey === key);
    const payload = parsePayload(section?.payloadJson);
    if (payload) return payload;
  }
  return null;
}

function toScalar(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function comparisonValue(payload: SectionPayload | null, key: string): string {
  if (!payload) return "";
  const value = payload[key];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") {
        const objectValue = item as Record<string, unknown>;
        return toScalar(objectValue.code) || toScalar(objectValue.region) || toScalar(objectValue.value);
      }
      return "";
    }).filter(Boolean).join(", ");
  }
  return toScalar(value);
}

function comparisonValueAny(payload: SectionPayload | null, keys: string[]): string {
  for (const key of keys) {
    const direct = comparisonValue(payload, key);
    if (direct) return direct;
  }
  return "";
}

function fieldChangeComparisonRows(fcr: AdminReviewCaseSummary | null): Array<{ label: string; before: string; after: string }> {
  if (!fcr || fcr.reviewType !== "FIELD_CHANGE") return [];
  const before = parsePayload(fcr.fieldChangeBeforeValueJson ?? undefined);
  const after = parsePayload(fcr.fieldChangeAfterValueJson ?? undefined);
  const normalized = (fcr.fieldChangeSectionKey ?? "").toLowerCase();
  const keysByGroup: Record<string, Array<{ keys: string[]; label: string }>> = {
    ateco_b: [
      { keys: ["atecoPrimary", "atecoMain", "ateco", "atecoCode"], label: "ATECO principale" },
      { keys: ["atecoSecondary", "atecoSecondari"], label: "ATECO secondari" }
    ],
    ateco: [
      { keys: ["atecoPrimary", "atecoMain", "ateco", "atecoCode"], label: "ATECO principale" },
      { keys: ["atecoSecondary", "atecoSecondari"], label: "ATECO secondari" }
    ],
    dimensione: [
      { keys: ["employeeRange", "dipendenti"], label: "Numero dipendenti" },
      { keys: ["revenueBand", "fatturato"], label: "Fatturato" }
    ],
    regioni_op: [
      { keys: ["operatingRegions"], label: "Regioni operative" }
    ],
    tipo_prof: [
      { keys: ["professionalType"], label: "Tipologia professionale" }
    ]
  };
  const keys = keysByGroup[normalized] ?? Object.keys(after ?? before ?? {}).map((key) => ({ keys: [key], label: key }));
  return keys
    .map(({ keys, label }) => ({
      label,
      before: comparisonValueAny(before, keys) || "n/d",
      after: comparisonValueAny(after, keys) || "n/d"
    }))
    .filter((row) => row.before !== row.after);
}

function formatItalianDate(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed) && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return new Date(parsed).toLocaleDateString("it-IT");
  }
  return raw;
}

function readNestedScalar(payload: SectionPayload | null, path: string[]): string {
  let current: unknown = payload;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return toScalar(current);
}

function attachmentFileName(payload: SectionPayload | null): string {
  return toScalar(payload?.fileName) || toScalar(payload?.name) || toScalar(payload?.originalFileName);
}

function renewalRequestStatusLabel(status: string | null | undefined): string {
  if (status === "UNDER_REVIEW") return "In revisione";
  if (status === "APPROVED") return "Approvato";
  if (status === "REJECTED") return "Respinto";
  if (status === "SUBMITTED") return "Inviato";
  return "Da verificare";
}

function renewalRequestTone(status: string | null | undefined): RenewalReviewRow["tone"] {
  if (status === "APPROVED") return "ok";
  if (status === "REJECTED") return "danger";
  if (status === "SUBMITTED" || status === "UNDER_REVIEW") return "warn";
  return "neutral";
}

function renewalCurrentExpiry(item: DocumentRenewalRequest, newPayload: SectionPayload | null, s1Payload: SectionPayload | null, s4Payload: SectionPayload | null): string {
  const direct = formatItalianDate(toScalar(newPayload?.scadenza) || toScalar(newPayload?.expiryDate) || item.expiryDate);
  if (direct) return direct;
  if (item.documentType === "ID_DOCUMENT") {
    return formatItalianDate(
      readNestedScalar(s1Payload, ["legalRepresentative", "idDocumentExpiry"])
        || comparisonValue(s1Payload, "lrIdDocumentExpiry")
        || comparisonValue(s1Payload, "idDocumentExpiry")
    );
  }
  if (item.documentType === "CERTIFICATION" && item.certificationKey) {
    const certs = s4Payload?.certificazioni;
    if (certs && typeof certs === "object") {
      const cert = (certs as Record<string, unknown>)[item.certificationKey];
      if (cert && typeof cert === "object") {
        return formatItalianDate(toScalar((cert as Record<string, unknown>).scadenza));
      }
    }
  }
  return "n/d";
}

function renewalReviewRows(
  latestCase: AdminReviewCaseSummary | null,
  s1Payload: SectionPayload | null,
  s4Payload: SectionPayload | null
): RenewalReviewRow[] {
  if (latestCase?.reviewType !== "DOCUMENT_RENEWAL") return [];
  const requests = latestCase.activeDocumentRenewalRequests?.length
    ? latestCase.activeDocumentRenewalRequests
    : latestCase.documentRenewalRequestId
      ? [{
          id: latestCase.documentRenewalRequestId,
          applicationId: latestCase.applicationId,
          reviewCaseId: latestCase.id,
          sectionKey: latestCase.documentRenewalSectionKey ?? "",
          batchId: "",
          documentType: latestCase.documentRenewalDocumentType ?? "",
          documentLabel: latestCase.documentRenewalDocumentLabel ?? "Documento",
          integrationItemCode: "",
          certificationKey: null,
          expiryDate: null,
          status: (latestCase.documentRenewalStatus ?? "SUBMITTED") as DocumentRenewalRequest["status"],
          oldAttachmentJson: latestCase.documentRenewalOldAttachmentJson ?? null,
          newAttachmentJson: latestCase.documentRenewalNewAttachmentJson ?? null,
          submittedAt: null,
          createdAt: latestCase.updatedAt,
          updatedAt: latestCase.updatedAt,
          expiredWithoutResponse: false
        } satisfies DocumentRenewalRequest]
      : [];
  return requests
    .filter((item) => ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"].includes(item.status))
    .map((item) => {
      const oldPayload = parsePayload(item.oldAttachmentJson ?? undefined);
      const newPayload = parsePayload(item.newAttachmentJson ?? undefined);
      const declined = item.documentType === "CERTIFICATION" && toScalar(newPayload?.presente).toLowerCase() === "no";
      const oldFile = attachmentFileName(oldPayload);
      const newFile = declined ? "Dichiarata non presente" : attachmentFileName(newPayload);
      return {
        id: item.id,
        label: item.documentLabel || documentTypeLabel(item.documentType) || "Documento",
        sectionLabel: sectionLabel(item.sectionKey || "S4"),
        statusLabel: renewalRequestStatusLabel(item.status),
        tone: renewalRequestTone(item.status),
        submittedAt: item.submittedAt ?? item.updatedAt ?? item.createdAt ?? null,
        oldValue: oldFile || "Valore precedente non disponibile",
        newValue: newFile || "Aggiornamento salvato",
        expiry: renewalCurrentExpiry(item, newPayload, s1Payload, s4Payload)
      };
    });
}

function findUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) return trimmed;
  return null;
}

function findDocumentUrl(value: unknown, applicationId: string): string | null {
  const directUrl = findUrl(value);
  if (directUrl) return directUrl;
  if (typeof value !== "string") return null;
  const storageKey = value.trim();
  if (!storageKey || !applicationId) return null;
  return `/api/v2/applications/${encodeURIComponent(applicationId)}/attachments/download?storageKey=${encodeURIComponent(storageKey)}`;
}

function isUploadedAttachment(value: Record<string, unknown> | null | undefined): value is Record<string, unknown> {
  const fileName = toScalar(value?.fileName);
  const storageKey = toScalar(value?.storageKey);
  return Boolean(fileName && storageKey && storageKey !== "upload-pending");
}

function documentTypeLabel(value: unknown): string {
  const type = toScalar(value).toUpperCase();
  if (type === "VISURA_CAMERALE") return "Visura camerale";
  if (type === "DURC") return "DURC";
  if (type === "COMPANY_PROFILE") return "Company profile";
  if (type === "CERTIFICATION") return "Certificato";
  if (type === "CV") return "Curriculum Vitae";
  return toScalar(value);
}

function canFinalizeDecision(role: AdminRole | null): boolean {
  return role === "SUPER_ADMIN" || role === "RESPONSABILE_ALBO";
}

function canRequestIntegrationDecision(role: AdminRole | null): boolean {
  return role === "SUPER_ADMIN" || role === "RESPONSABILE_ALBO";
}

function statusLabelOf(status: string | null | undefined): string {
  if (status === "SUBMITTED") return "In attesa di revisione";
  if (status === "IN_REVIEW") return "In revisione";
  if (status === "APPROVED") return "Approvata";
  if (status === "REJECTED") return "Non approvata";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "In attesa del fornitore";
  return "—";
}

function statusToneOf(status: string | null | undefined): "ok" | "warn" | "danger" | "neutral" {
  if (status === "APPROVED") return "ok";
  if (status === "REJECTED") return "danger";
  return "warn";
}

function renewalHeaderStatusLabel(reviewCase: AdminReviewCaseSummary | null): string {
  if (reviewCase?.status === "DECIDED") {
    if (reviewCase.decision === "APPROVED") return "Rinnovo documenti approvato";
    if (reviewCase.decision === "REJECTED") return "Rinnovo documenti respinto";
    return "Rinnovo documenti deciso";
  }
  if (reviewCase?.status === "READY_FOR_DECISION") return "Rinnovo documenti da decidere";
  if (reviewCase?.status === "WAITING_SUPPLIER_RESPONSE") return "Rinnovo documenti in attesa fornitore";
  if (reviewCase?.status === "PENDING_ASSIGNMENT") return "Rinnovo documenti da assegnare";
  return "Rinnovo documenti in revisione";
}

function renewalHeaderStatusTone(reviewCase: AdminReviewCaseSummary | null): "ok" | "warn" | "danger" | "neutral" {
  if (reviewCase?.status === "DECIDED") {
    if (reviewCase.decision === "APPROVED") return "ok";
    if (reviewCase.decision === "REJECTED") return "danger";
    return "neutral";
  }
  return "warn";
}

function historyStatusLabel(status: string): string {
  if (status === "OPEN") return "Aperta";
  if (status === "IN_PROGRESS") return "In revisione";
  if (status === "READY_FOR_DECISION") return "Pronta per decisione";
  if (status === "DECIDED") return "Decisione registrata";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "In attesa del fornitore";
  return status;
}

function historyStatusTone(status: string): "ok" | "warn" | "neutral" {
  if (status === "DECIDED") return "ok";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "warn";
  return "neutral";
}

function parseAuditRecord(raw: string | null | undefined): Record<string, string> {
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

function verificationOutcomeLabel(outcome: string | null | undefined): string {
  if (outcome === "COMPLIANT") return "Conforme";
  if (outcome === "COMPLIANT_WITH_RESERVATIONS") return "Conforme con riserve";
  if (outcome === "INCOMPLETE") return "Incompleta";
  if (outcome === "NON_COMPLIANT") return "Non conforme";
  return "Verificata";
}

function mapAuditToTimelineEvent(event: AdminAuditEventRow): ReviewTimelineEvent | null {
  const key = event.eventKey ?? "";
  const meta = parseAuditRecord(event.metadataJson);
  const before = parseAuditRecord(event.beforeStateJson);
  const actor = meta.actorName || meta.applicantName || meta.adminName || "";

  if (key === "revamp.application.submitted") {
    const wasIntegration = before.status === "INTEGRATION_REQUIRED";
    return {
      id: event.id,
      title: wasIntegration ? "Risposta fornitore ricevuta" : "Candidatura inviata",
      badge: wasIntegration ? "Integrazione ricevuta" : "Invio",
      tone: "neutral",
      detail: wasIntegration
        ? "Il fornitore ha inviato le informazioni richieste."
        : (meta.protocolCode ? `Protocollo ${meta.protocolCode}` : undefined),
      occurredAt: event.occurredAt
    };
  }

  if (key === "revamp.review.opened") {
    return {
      id: event.id,
      title: "Presa in carico",
      badge: "In revisione",
      tone: "neutral",
      detail: actor ? `Da ${actor}` : undefined,
      occurredAt: event.occurredAt
    };
  }

  if (key === "revamp.review.verified") {
    return {
      id: event.id,
      title: "Verifica completata",
      badge: verificationOutcomeLabel(meta.verificationOutcome),
      tone: meta.verificationOutcome === "COMPLIANT" ? "ok" : "warn",
      detail: event.reason || undefined,
      occurredAt: event.occurredAt
    };
  }

  if (key === "revamp.review.integration_requested") {
    return {
      id: event.id,
      title: "Integrazione richiesta",
      badge: "Richiesta",
      tone: "warn",
      detail: event.reason || undefined,
      occurredAt: event.occurredAt
    };
  }

  if (key === "revamp.review.decided") {
    const approved = meta.decision === "APPROVED";
    const isRenewal = meta.reviewType === "DOCUMENT_RENEWAL";
    return {
      id: event.id,
      title: isRenewal ? "Decisione rinnovo documenti" : "Decisione registrata",
      badge: isRenewal
        ? (approved ? "Rinnovo approvato" : "Rinnovo respinto")
        : (approved ? "Approvata" : "Non approvata"),
      tone: approved ? "ok" : "danger",
      detail: isRenewal && meta.documents
        ? meta.documents
        : event.reason || undefined,
      occurredAt: event.occurredAt
    };
  }

  return null;
}

function mapFcrAuditToTimelineEvent(event: AdminAuditEventRow): ReviewTimelineEvent | null {
  const key = event.eventKey ?? "";
  const meta = parseAuditRecord(event.metadataJson);
  const sectionLabelValue = fieldChangeGroupLabel(meta.sectionKey);
  const reason = event.reason || meta.reason || "";
  const detailParts = [sectionLabelValue];

  if (key === "fcr.created") {
    if (meta.message) detailParts.push(meta.message);
    return {
      id: event.id,
      title: "Richiesta modifica dati",
      badge: "In attesa sblocco",
      tone: "warn",
      detail: detailParts.filter(Boolean).join(" - "),
      occurredAt: event.occurredAt
    };
  }
  if (key === "fcr.unlocked") {
    if (reason) detailParts.push(reason);
    return {
      id: event.id,
      title: "Modifica dati sbloccata",
      badge: "Sbloccata",
      tone: "neutral",
      detail: detailParts.filter(Boolean).join(" - "),
      occurredAt: event.occurredAt
    };
  }
  if (key === "fcr.rejected_by_admin") {
    if (reason) detailParts.push(reason);
    return {
      id: event.id,
      title: "Richiesta modifica rifiutata",
      badge: "Rifiutata",
      tone: "danger",
      detail: detailParts.filter(Boolean).join(" - "),
      occurredAt: event.occurredAt
    };
  }
  if (key === "fcr.cancelled_by_supplier") {
    return {
      id: event.id,
      title: "Richiesta modifica annullata",
      badge: "Annullata",
      tone: "neutral",
      detail: detailParts.filter(Boolean).join(" - "),
      occurredAt: event.occurredAt
    };
  }
  if (key === "fcr.submitted") {
    return {
      id: event.id,
      title: "Modifica inviata dal fornitore",
      badge: "In revisione",
      tone: "warn",
      detail: detailParts.filter(Boolean).join(" - "),
      occurredAt: event.occurredAt
    };
  }
  if (key === "fcr.approved") {
    if (reason) detailParts.push(reason);
    return {
      id: event.id,
      title: "Modifica dati approvata",
      badge: "Approvata",
      tone: "ok",
      detail: detailParts.filter(Boolean).join(" - "),
      occurredAt: event.occurredAt
    };
  }
  if (key === "fcr.rejected") {
    if (reason) detailParts.push(reason);
    detailParts.push("Valore precedente mantenuto");
    return {
      id: event.id,
      title: "Modifica dati respinta",
      badge: "Respinta",
      tone: "danger",
      detail: detailParts.filter(Boolean).join(" - "),
      occurredAt: event.occurredAt
    };
  }
  return null;
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function shouldRefreshApplicationCase(event: DashboardActivityEvent, applicationId: string): boolean {
  const key = event.eventKey ?? "";
  return (
    (
      event.entityType === "REVAMP_APPLICATION"
      && event.entityId === applicationId
      && (key.startsWith("revamp.review.") || key.startsWith("revamp.application."))
    )
    || key.startsWith("fcr.")
  );
}

export function AdminApplicationCasePage() {
  const { applicationId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { adminRole } = useAdminGovernanceRole();
  const token = auth?.token ?? "";
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [sections, setSections] = useState<RevampSectionSnapshot[]>([]);
  const [reviewHistory, setReviewHistory] = useState<AdminReviewCaseSummary[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEventRow[]>([]);
  const [fieldChangeAuditEvents, setFieldChangeAuditEvents] = useState<AdminAuditEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<DecisionAction | null>(null);
  const [latestIntegrationRequest, setLatestIntegrationRequest] = useState<AdminIntegrationRequestSummary | null>(null);

  const [approveReason, setApproveReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyOutcome, setVerifyOutcome] = useState<VerificationOutcome>("COMPLIANT");
  const [verifyNote, setVerifyNote] = useState("");
  const [busyVerify, setBusyVerify] = useState(false);
  const [showRejectConfirmModal, setShowRejectConfirmModal] = useState(false);
  const caseRefreshInFlightRef = useRef(false);
  const caseRefreshQueuedRef = useRef(false);

  const appId = applicationId.trim();
  const validAppId = UUID_PATTERN.test(appId);
  const notesStorageKey = `admin_case_notes_${appId}`;
  const returnToParam = searchParams.get("returnTo");
  const backTo = returnToParam?.startsWith("/admin/candidature") ? returnToParam : "/admin/candidature";

  useEffect(() => {
    if (!validAppId) return;
    try {
      const saved = window.localStorage.getItem(notesStorageKey);
      setInternalNotes(saved ?? "");
    } catch {
      setInternalNotes("");
    }
  }, [notesStorageKey, validAppId]);

  const loadCase = useCallback(async (showLoading = true) => {
    if (!token || !validAppId) return;
    if (caseRefreshInFlightRef.current) {
      caseRefreshQueuedRef.current = true;
      return;
    }

    caseRefreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const summaryData = await getRevampApplicationSummary(appId, token);
      setSummary(summaryData);

      const [sectionsResult, historyResult, auditResult, fieldChangesResult] = await Promise.allSettled([
        getRevampApplicationSections(appId, token),
        getAdminReviewHistory(appId, token),
        getAdminAuditEvents(token, { entityType: "REVAMP_APPLICATION", entityId: appId }),
        listFieldChangeRequests(appId, token)
      ]);

      if (sectionsResult.status === "fulfilled") {
        setSections(sectionsResult.value);
      } else {
        setSections([]);
      }

      if (historyResult.status === "fulfilled") {
        const sortedHistory = [...historyResult.value].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        setReviewHistory(sortedHistory);
        const latestCaseId = sortedHistory[0]?.id;
        if (latestCaseId) {
          try {
            const latestIntegration = await getLatestAdminIntegrationRequest(latestCaseId, token);
            setLatestIntegrationRequest(latestIntegration);
          } catch {
            setLatestIntegrationRequest(null);
          }
        } else {
          setLatestIntegrationRequest(null);
        }
      } else {
        setReviewHistory([]);
        setLatestIntegrationRequest(null);
      }

      if (auditResult.status === "fulfilled") {
        setAuditEvents(auditResult.value);
      } else {
        setAuditEvents([]);
      }

      if (fieldChangesResult.status === "fulfilled") {
        const audits = await Promise.all(
          fieldChangesResult.value.map((fcr: FieldChangeRequest) =>
            getAdminAuditEvents(token, { entityType: "FIELD_CHANGE_REQUEST", entityId: fcr.id }).catch(() => [] as AdminAuditEventRow[])
          )
        );
        setFieldChangeAuditEvents(audits.flat());
      } else {
        setFieldChangeAuditEvents([]);
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento pratica non riuscito.";
      setToast({ message, type: "error" });
      setSummary(null);
      setSections([]);
      setReviewHistory([]);
      setAuditEvents([]);
      setLatestIntegrationRequest(null);
    } finally {
      caseRefreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
      if (caseRefreshQueuedRef.current) {
        caseRefreshQueuedRef.current = false;
        void loadCase(false);
      }
    }
  }, [appId, token, validAppId]);

  useEffect(() => {
    void loadCase(true);
  }, [loadCase]);

  useAdminRealtimeRefresh({
    token,
    enabled: validAppId,
    shouldRefresh: (event) => shouldRefreshApplicationCase(event, appId),
    onRefresh: () => loadCase(false)
  });

  const latestCase = useMemo(() => reviewHistory[0] ?? null, [reviewHistory]);
  const timelineEvents = useMemo<ReviewTimelineEvent[]>(() => {
    const decidedReviewCaseIds = new Set(
      auditEvents
        .filter((event) => event.eventKey === "revamp.review.decided")
        .map((event) => parseAuditRecord(event.metadataJson).reviewCaseId)
        .filter(Boolean)
    );
    const events = auditEvents
      .filter((event) => {
        if (event.eventKey !== "revamp.review.opened") return true;
        const reviewCaseId = parseAuditRecord(event.metadataJson).reviewCaseId;
        return !reviewCaseId || !decidedReviewCaseIds.has(reviewCaseId);
      })
      .map(mapAuditToTimelineEvent)
      .filter((event): event is ReviewTimelineEvent => Boolean(event))
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const fcrAuditEvents = fieldChangeAuditEvents
      .map(mapFcrAuditToTimelineEvent)
      .filter((event): event is ReviewTimelineEvent => Boolean(event))
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const auditedFcrIds = new Set(fieldChangeAuditEvents.map((event) => event.entityId));
    const fieldChangeEvents = reviewHistory
      .filter((item) => item.reviewType === "FIELD_CHANGE")
      .filter((item) => !item.fieldChangeRequestId || !auditedFcrIds.has(item.fieldChangeRequestId))
      .map((item) => ({
        id: `fcr-${item.id}`,
        title: item.decision
          ? "Decisione modifica dati"
          : item.status === "PENDING_ASSIGNMENT"
            ? "Modifica inviata dal fornitore"
            : "Revisione modifica dati",
        badge: item.decision === "APPROVED"
          ? "Modifica approvata"
          : item.decision === "REJECTED"
            ? "Modifica respinta"
            : "Modifica dati",
        tone: item.decision === "REJECTED" ? "danger" : item.decision === "APPROVED" ? "ok" : "warn",
        detail: fieldChangeGroupLabel(item.fieldChangeSectionKey),
        occurredAt: item.updatedAt
      }) satisfies ReviewTimelineEvent);
    const renewalEvents = reviewHistory
      .filter((item) => item.reviewType === "DOCUMENT_RENEWAL")
      .flatMap((item) => (item.activeDocumentRenewalRequests ?? [])
        .filter((request) => request.status === "APPROVED" || request.status === "REJECTED")
        .map((request) => ({
          id: `renewal-${request.id}-${request.status}`,
          title: request.status === "APPROVED" ? "Documento rinnovato approvato" : "Documento rinnovato respinto",
          badge: request.status === "APPROVED" ? "Approvato" : "Respinto",
          tone: request.status === "APPROVED" ? "ok" : "danger",
          detail: request.documentLabel,
          occurredAt: request.updatedAt ?? item.updatedAt
        }) satisfies ReviewTimelineEvent));

    if (events.length > 0) {
      return [...events, ...fcrAuditEvents, ...fieldChangeEvents, ...renewalEvents].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    }

    const fallback: ReviewTimelineEvent[] = [];
    if (summary?.submittedAt) {
      fallback.push({
        id: "application-submitted",
        title: "Candidatura inviata",
        badge: "Invio",
        tone: "neutral",
        detail: summary.protocolCode ? `Protocollo ${summary.protocolCode}` : undefined,
        occurredAt: summary.submittedAt
      });
    }
    reviewHistory
      .slice()
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
      .forEach((item) => {
        fallback.push({
          id: item.id,
          title: historyStatusLabel(item.status),
          badge: item.decision === "APPROVED" ? "Approvata" : item.decision === "REJECTED" ? "Non approvata" : historyStatusLabel(item.status),
          tone: item.decision === "REJECTED" ? "danger" : historyStatusTone(item.status),
          detail: item.slaDueAt ? `Scadenza: ${new Date(item.slaDueAt).toLocaleDateString("it-IT")}` : undefined,
          occurredAt: item.updatedAt
        });
      });
    return [...fallback, ...fcrAuditEvents, ...fieldChangeEvents, ...renewalEvents].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  }, [auditEvents, fieldChangeAuditEvents, reviewHistory, summary?.protocolCode, summary?.submittedAt]);
  const historyRows = useMemo(() => {
    const rows: ReviewTimelineEvent[][] = [];
    for (let index = 0; index < timelineEvents.length; index += HISTORY_SNAKE_ROW_SIZE) {
      rows.push(timelineEvents.slice(index, index + HISTORY_SNAKE_ROW_SIZE));
    }
    return rows;
  }, [timelineEvents]);
  const submittedDays = useMemo(() => daysSince(summary?.submittedAt ?? null), [summary?.submittedAt]);
  const isUrgent = (submittedDays ?? 0) >= 5 && summary?.status !== "APPROVED";
  const completedSections = useMemo(() => sections.filter((section) => section.completed), [sections]);
  const s1Payload = useMemo(() => getSectionPayload(sections, "S1"), [sections]);
  const s2Payload = useMemo(() => getSectionPayload(sections, "S2"), [sections]);
  const s4Payload = useMemo(() => getSectionPayload(sections, "S4"), [sections]);
  const isFieldChangeReview = latestCase?.reviewType === "FIELD_CHANGE";
  const isDocumentRenewalReview = latestCase?.reviewType === "DOCUMENT_RENEWAL";
  const stickyStatusLabel = isDocumentRenewalReview
    ? renewalHeaderStatusLabel(latestCase)
    : isFieldChangeReview
      ? "Modifica dati in revisione"
      : statusLabelOf(summary?.status);
  const stickyStatusTone = isDocumentRenewalReview
    ? renewalHeaderStatusTone(latestCase)
    : statusToneOf(summary?.status);
  const canFinalize = canFinalizeDecision(adminRole);
  const canRequestIntegration = !isFieldChangeReview && !isDocumentRenewalReview && canRequestIntegrationDecision(adminRole);
  const reviewReadOnly = auth?.role === "ADMIN" && adminRole === "VIEWER";
  const canVerify = !isFieldChangeReview && (adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE");
  const isFinalized = latestCase?.status === "DECIDED"
    || (!isDocumentRenewalReview && (summary?.status === "APPROVED" || summary?.status === "REJECTED"));
  const hasOpenIntegrationRequest = latestIntegrationRequest?.status === "OPEN";
  const awaitingSupplierResponse = latestCase?.status === "WAITING_SUPPLIER_RESPONSE" || hasOpenIntegrationRequest;
  const notYetVerified = !latestCase?.verifiedAt;
  const notYetAssigned = latestCase?.status === "PENDING_ASSIGNMENT";
  const finalDecisionLocked = isFinalized || awaitingSupplierResponse || (!isFieldChangeReview && notYetVerified) || notYetAssigned;
  const assignedToOther = Boolean(latestCase?.assignedToUserId && auth?.userId && latestCase.assignedToUserId !== auth.userId);
  const assignmentLocked = assignedToOther && adminRole !== "SUPER_ADMIN";
  const isAlboB = summary?.registryType === "ALBO_B";
  const fieldChangeLabel = fieldChangeGroupLabel(latestCase?.fieldChangeSectionKey);
  const fieldChangeRows = useMemo(() => fieldChangeComparisonRows(latestCase), [latestCase]);
  const documentRenewalRows = useMemo(
    () => renewalReviewRows(latestCase, s1Payload, s4Payload),
    [latestCase, s1Payload, s4Payload]
  );

  const candidateHeaderTitle = useMemo(() => {
    if (!summary) return "Candidatura";
    if (summary.registryType === "ALBO_B") {
      const companyName = toScalar(s1Payload?.companyName);
      if (companyName) return companyName;
    }
    const repName = toScalar(s1Payload?.legalRepresentativeName);
    if (repName) return repName;
    return applicationDisplayCode(summary);
  }, [s1Payload, summary]);

  const candidateMetaRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    if (summary?.registryType === "ALBO_A") {
      rows.push({ label: "Codice fiscale", value: toScalar(s1Payload?.taxCode) || "n/d" });
      rows.push({ label: "Telefono", value: toScalar(s1Payload?.phone) || "n/d" });
      rows.push({
        label: "Localita",
        value: [toScalar(s1Payload?.city), toScalar(s1Payload?.province)].filter(Boolean).join(" - ") || "n/d"
      });
      rows.push({ label: "CAP", value: toScalar(s1Payload?.postalCode) || "n/d" });
      rows.push({ label: "Tipologia professionale", value: toScalar(s2Payload?.tipologia) || toScalar(s2Payload?.professionalType) || "n/d" });
    } else {
      rows.push({ label: "Partita IVA", value: toScalar(s1Payload?.vatNumber) || "n/d" });
      rows.push({ label: "REA", value: toScalar(s1Payload?.reaNumber) || "n/d" });
      rows.push({ label: "Rappresentante legale", value: toScalar(s1Payload?.legalRepresentativeName) || "n/d" });
      rows.push({ label: "Email operativo", value: toScalar(s1Payload?.operationalContactEmail) || "n/d" });
      rows.push({ label: "Fascia dipendenti", value: toScalar(s2Payload?.employeeRange) || "n/d" });
    }
    return rows;
  }, [s1Payload, s2Payload, summary?.registryType]);

  const documentRows = useMemo<DocumentRow[]>(() => {
    const rows: DocumentRow[] = [];
    const s1Photo = (s1Payload?.profilePhotoAttachment as Record<string, unknown> | undefined) ?? null;
    const s1PhotoUrl = findDocumentUrl(s1Photo?.storageKey, appId);
    if (isUploadedAttachment(s1Photo)) {
      rows.push({
        id: "profile-photo",
        label: toScalar(s1Photo.fileName) || "Foto profilo",
        sectionLabel: "Anagrafica",
        url: s1PhotoUrl,
        hasLink: Boolean(s1PhotoUrl)
      });
    }

    const s4Attachments = Array.isArray(s4Payload?.attachments)
      ? (s4Payload.attachments as Array<Record<string, unknown>>)
      : [];
    s4Attachments.forEach((attachment, index) => {
      if (!isUploadedAttachment(attachment)) return;
      const certificationLabel = toScalar(attachment.certificationLabel);
      const typeLabel = certificationLabel || documentTypeLabel(attachment.documentType);
      const labelParts = [typeLabel, toScalar(attachment.fileName)].filter(Boolean);
      const expired = Boolean(attachment.expired);
      const expiringSoon = Boolean(attachment.expiringSoon);
      const stateLabel = expired ? "Scaduto" : (expiringSoon ? "In scadenza" : "");
      const url = findDocumentUrl(attachment.storageKey, appId);
      rows.push({
        id: `S4-attachment-${index}`,
        label: `${labelParts.join(" - ")}${stateLabel ? ` (${stateLabel})` : ""}` || "Allegato",
        sectionLabel: "Documenti",
        url,
        hasLink: Boolean(url)
      });
    });
    return rows;
  }, [appId, s1Payload, s4Payload]);

  const checklistRows = useMemo(
    () => [
      { label: "Protocollo assegnato", done: Boolean(summary?.protocolCode) },
      { label: "Questionario inviato", done: Boolean(summary?.submittedAt) },
      { label: "Sezioni completate", done: completedSections.length === sections.length && sections.length > 0 },
      { label: "Review case attivo", done: Boolean(latestCase) },
      { label: "Documenti con link apribile", done: documentRows.some((row) => row.hasLink) }
    ],
    [completedSections.length, documentRows, latestCase, sections.length, summary?.protocolCode, summary?.submittedAt]
  );

  async function submitDecision(decision: DecisionAction, reason: string) {
    const actionAllowed = canFinalize;
    const trimmedReason = reason.trim();
    const requiresReason = decision !== "APPROVED";
    if (assignmentLocked) {
      setToast({ message: "Pratica assegnata a un altro revisore: azione non consentita.", type: "error" });
      return;
    }
    if (isFinalized) {
      setToast({ message: "Pratica già finalizzata: azione non consentita.", type: "error" });
      return;
    }
    if (awaitingSupplierResponse) {
      setToast({ message: "Decisione bloccata: il fornitore deve prima rispondere alla richiesta di integrazione.", type: "error" });
      return;
    }
    if (!actionAllowed) {
      setToast({ message: "Ruolo non autorizzato ad approvare/rigettare candidature.", type: "error" });
      return;
    }
    if (!token || !latestCase || (requiresReason && !trimmedReason)) {
      setToast({ message: "Inserisci una motivazione prima di inviare l'azione.", type: "error" });
      return;
    }

    setBusyAction(decision);
    try {
      await saveAdminReviewDecision(latestCase.id, token, {
        decision,
        reason: trimmedReason || undefined
      });
      setToast({ message: "Decisione salvata correttamente.", type: "success" });
      await loadCase();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Salvataggio decisione non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusyAction(null);
    }
  }

  function goToIntegrationPage() {
    if (!canRequestIntegration) return;
    navigate(`/admin/candidature/${appId}/integration`);
  }

  async function submitVerify() {
    if (!latestCase || !token) return;
    setBusyVerify(true);
    try {
      await verifyAdminReviewCase(latestCase.id, token, {
        verificationNote: verifyNote.trim() || undefined,
        verificationOutcome: verifyOutcome
      });
      setShowVerifyModal(false);
      const outcome = verifyOutcome;
      setVerifyNote("");
      setVerifyOutcome("COMPLIANT");
      if (outcome === "INCOMPLETE") {
        setToast({ message: "Verifica salvata. Compila e invia la richiesta al fornitore nel modulo seguente.", type: "success" });
        await loadCase();
        navigate(`/admin/candidature/${appId}/integration`);
      } else {
        setToast({ message: "Verifica completata correttamente.", type: "success" });
        await loadCase();
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Salvataggio verifica non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusyVerify(false);
    }
  }

  async function openDocument(url: string | null) {
    if (!url) return;
    if (!url.startsWith("/api/")) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const targetWindow = window.open("", "_blank");
    if (targetWindow) {
      targetWindow.document.body.innerHTML = "<p style=\"font-family:sans-serif;padding:24px\">Apertura documento in corso...</p>";
    }
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      if (targetWindow) {
        targetWindow.location.href = objectUrl;
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      targetWindow?.close();
      setToast({ message: "Documento non apribile. File non trovato o accesso non autorizzato.", type: "error" });
    }
  }

  function saveInternalNotes() {
    try {
      window.localStorage.setItem(notesStorageKey, internalNotes);
      setToast({ message: "Note interne salvate in locale.", type: "success" });
    } catch {
      setToast({ message: "Salvataggio note non riuscito.", type: "error" });
    }
  }

  const heroInitials = makeInitials(candidateHeaderTitle);

  return (
    <AdminCandidatureShell active="candidature">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      {/* ── Sticky top bar ── */}
      <div className="review-sticky-bar">
        <Link to={backTo} className="review-back-btn">
          <ArrowLeft size={15} /> Torna alla lista
        </Link>
        <div className="review-sticky-identity">
          <span className="review-sticky-name">{candidateHeaderTitle}</span>
          <span className={`review-albo-badge ${isAlboB ? "albo-b" : "albo-a"}`}>
            {isAlboB ? "Albo Aziende" : "Albo Professionisti"}
          </span>
          <span className={`review-sticky-status tone-${stickyStatusTone}`}>
            {stickyStatusLabel}
          </span>
          {isFieldChangeReview ? <span className="queue-pill urgency response-received">Modifica dati</span> : null}
          {isDocumentRenewalReview ? <span className="queue-pill urgency response-received">Rinnovo documenti</span> : null}
        </div>
        {isUrgent ? <span className="review-urgent-pill"><AlertTriangle size={13} /> Urgente</span> : null}
        <button type="button" className="review-refresh-btn" onClick={() => void loadCase()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      </div>

      <section className="stack review-case-shell">

        {/* ── Hero card ── */}
        <div className="panel review-hero-card">
          <div className="review-hero-avatar">{heroInitials}</div>
          <div className="review-hero-body">
            <h3 className="review-hero-name">{candidateHeaderTitle}</h3>
            <p className="review-hero-type">
              {isFieldChangeReview ? `Richiesta modifica dati - ${fieldChangeLabel}` : (isAlboB ? "Azienda fornitrice" : "Professionista")} &nbsp;·&nbsp;
              {isAlboB ? "Albo Fornitori Aziende" : "Albo Fornitori Professionisti"}
            </p>
            <div className="review-hero-meta-grid">
              <div className="review-hero-meta-item">
                <span className="review-meta-label">Codice pratica</span>
                <span className="review-meta-value" title={applicationDisplayCode(summary)}>{applicationDisplayCode(summary)}</span>
              </div>
              <div className="review-hero-meta-item">
                <span className="review-meta-label">Data invio</span>
                <span className="review-meta-value">{summary?.submittedAt ? new Date(summary.submittedAt).toLocaleDateString("it-IT") : "—"}</span>
              </div>
              <div className="review-hero-meta-item">
                <span className="review-meta-label">Giorni in attesa</span>
                <span className={`review-meta-value${(submittedDays ?? 0) >= 5 ? " val-warn" : ""}`}>{submittedDays ?? "—"} gg</span>
              </div>
              <div className="review-hero-meta-item">
                <span className="review-meta-label">Assegnata a</span>
                <span className="review-meta-value" title={latestCase?.assignedToDisplayName ?? "Non assegnata"}>{latestCase?.assignedToDisplayName ?? "Non assegnata"}</span>
              </div>
              <div className="review-hero-meta-item">
                <span className="review-meta-label">Scadenza SLA</span>
                <span className="review-meta-value">{latestCase?.slaDueAt ? new Date(latestCase.slaDueAt).toLocaleDateString("it-IT") : "—"}</span>
              </div>
              {candidateMetaRows.map((row) => (
                <div key={row.label} className="review-hero-meta-item">
                  <span className="review-meta-label">{row.label}</span>
                  <span className="review-meta-value" title={row.value}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Verification outcome banner ── */}
        {isDocumentRenewalReview ? (
          <div className="panel review-renewal-summary-panel">
            <div className="review-side-panel-head">
              <h4><ClipboardList size={15} /> Documenti rinnovati dal fornitore</h4>
              <span className="review-side-count">{documentRenewalRows.length} aggiornamenti</span>
            </div>
            <p className="subtle">
              Riepilogo dei documenti inviati per questa revisione. Se il fornitore invia altri documenti prima della decisione, vengono aggiunti qui.
            </p>
            {documentRenewalRows.length > 0 ? (
              <div className="review-renewal-summary-list">
                {documentRenewalRows.map((row) => (
                  <article key={row.id} className="review-renewal-summary-item">
                    <div className="review-renewal-summary-title">
                      <FileText size={16} />
                      <div>
                        <strong>{row.label}</strong>
                        <span>{row.sectionLabel}</span>
                      </div>
                    </div>
                    <div className="review-renewal-summary-details">
                      <div>
                        <span className="review-meta-label">Prima</span>
                        <strong title={row.oldValue}>{row.oldValue}</strong>
                      </div>
                      <div>
                        <span className="review-meta-label">Aggiornato</span>
                        <strong title={row.newValue}>{row.newValue}</strong>
                      </div>
                      <div>
                        <span className="review-meta-label">Scadenza</span>
                        <strong>{row.expiry}</strong>
                      </div>
                      <div>
                        <span className="review-meta-label">Inviato</span>
                        <strong>{row.submittedAt ? new Date(row.submittedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "n/d"}</strong>
                      </div>
                    </div>
                    <span className={`review-history-status tone-${row.tone}`}>{row.statusLabel}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="review-doc-empty">Nessun dettaglio di rinnovo disponibile per questa revisione.</div>
            )}
          </div>
        ) : null}

        {latestCase?.verifiedAt ? (
          <>
            <div className={`review-outcome-banner outcome-${(latestCase.verificationOutcome ?? "COMPLIANT").toLowerCase()}`}>
              <span className="review-outcome-icon">
                {latestCase.verificationOutcome === "COMPLIANT" ? "✅" :
                 latestCase.verificationOutcome === "COMPLIANT_WITH_RESERVATIONS" ? "⚠️" :
                 latestCase.verificationOutcome === "INCOMPLETE" ? "📋" : "❌"}
              </span>
              <div className="review-outcome-body">
                <strong className="review-outcome-title">
                  {latestCase.verificationOutcome === "COMPLIANT" ? "Tutto conforme" :
                   latestCase.verificationOutcome === "COMPLIANT_WITH_RESERVATIONS" ? "Conforme con riserve" :
                   latestCase.verificationOutcome === "INCOMPLETE" ? "Documenti mancanti" : "Non conforme"}
                </strong>
                <span className="review-outcome-meta">
                  Verificato da <strong>{latestCase.verifiedByDisplayName ?? "un revisore"}</strong> il {new Date(latestCase.verifiedAt).toLocaleDateString("it-IT")}
                </span>
                {latestCase.verificationNote ? (
                  <p className="review-outcome-note">&ldquo;{latestCase.verificationNote}&rdquo;</p>
                ) : null}
              </div>
            </div>
            {latestCase.verificationOutcome === "INCOMPLETE" && !latestIntegrationRequest ? (
              <div className="review-state-banner state-warn">
                <AlertTriangle size={14} />
                <span>Richiesta integrazione non ancora inviata — il fornitore non è stato notificato. <button type="button" className="review-inline-link" onClick={goToIntegrationPage}>Invia ora</button></span>
              </div>
            ) : null}
          </>
        ) : null}

        {/* ── Main two-column layout ── */}
        <div className="review-content-grid">

          {/* LEFT: Full profile sections */}
          <div className="review-main-col">
            {loading ? (
              <div className="panel review-loading-panel"><p className="subtle">Caricamento profilo in corso…</p></div>
            ) : (
              <>
                {isFieldChangeReview ? (
                  <div className="panel review-docs-panel">
                    <div className="review-side-panel-head">
                      <h4><Info size={15} /> Modifica dati richiesta</h4>
                      <span className="review-side-count">{fieldChangeLabel}</span>
                    </div>
                    <p className="subtle">Il profilo Albo continua a mostrare i valori approvati. Questi sono i valori proposti dal fornitore per la revisione.</p>
                    {fieldChangeRows.length > 0 ? (
                      <div className="profile-history-list">
                        {fieldChangeRows.map((row) => (
                          <article key={row.label} className="admin-profile-history-item">
                            <div className="history-event-header">
                              <strong className="history-event-key">{row.label}</strong>
                              <span className="comm-status-badge badge-neutral">Prima / Dopo</span>
                            </div>
                            <p className="subtle">Prima: <strong>{row.before}</strong></p>
                            <p className="subtle">Proposto: <strong>{row.after}</strong></p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="subtle">Confronto disponibile nei dati tecnici della richiesta di modifica.</p>
                    )}
                  </div>
                ) : null}
                <SupplierProfileView isAlboB={isAlboB} sections={sections} />
                <div className="panel review-docs-panel">
                  <div className="review-side-panel-head">
                    <h4><FileText size={15} /> Documenti allegati</h4>
                    <span className="review-side-count">{documentRows.length} file</span>
                  </div>
                  {documentRows.length > 0 ? (
                    <div className="review-doc-list">
                      {documentRows.map((row) => (
                        <div key={row.id} className="review-doc-row">
                          <div className="review-doc-icon">
                            <FileText size={16} />
                          </div>
                          <div className="review-doc-info">
                            <span className="review-doc-name">{row.label}</span>
                            <span className="review-doc-section">{row.sectionLabel}</span>
                          </div>
                          <button type="button" className="review-doc-open-btn" disabled={!row.hasLink}
                            onClick={() => void openDocument(row.url)}>
                            <ExternalLink size={13} /> Apri
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="review-doc-empty">
                      Nessun documento scaricabile trovato. Il fornitore deve caricare file reali nella sezione documenti prima della verifica.
                    </div>
                  )}
                </div>
                {timelineEvents.length > 0 ? (
                  <div className="panel review-history-panel">
                    <div className="review-side-panel-head">
                      <h4><History size={15} /> Cronologia revisioni</h4>
                      <span className="review-side-count">{timelineEvents.length} eventi</span>
                    </div>
                    <div className="review-history-snake" aria-label="Cronologia revisioni">
                      {historyRows.map((row, rowIndex) => (
                        <div
                          key={`history-row-${rowIndex}`}
                          className={`review-history-snake-row${rowIndex % 2 === 1 ? " is-reverse" : ""}`}
                        >
                          {row.map((item, itemIndex) => {
                            const timelineIndex = rowIndex * HISTORY_SNAKE_ROW_SIZE + itemIndex;
                            const isLastEvent = timelineIndex === timelineEvents.length - 1;
                            return (
                              <div
                                key={item.id}
                                className={[
                                  "review-history-node",
                                  isLastEvent ? "item-latest" : ""
                                ].filter(Boolean).join(" ")}
                              >
                                <div className="review-history-node-dot">{timelineIndex + 1}</div>
                                <div className="review-history-node-content">
                                  <strong className="review-history-node-title">{item.title}</strong>
                                  <div className="review-history-node-top">
                                    <span className={`review-history-status tone-${item.tone}`}>
                                      {item.badge}
                                    </span>
                                    {item.decision ? (
                                      <span className={`review-history-decision ${item.decision === "approve" ? "dec-approve" : "dec-reject"}`}>
                                        {item.decision === "approve" ? "Approvata" : "Non approvata"}
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="review-history-date">{new Date(item.occurredAt).toLocaleString("it-IT")}</span>
                                  {item.detail ? (
                                    <p className="review-history-detail">{item.detail}</p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* RIGHT: Sticky sidebar */}
          <div className="review-sidebar">

            {/* Decision panel */}
            <div className="panel review-decision-panel">
              <div className="review-decision-header">
                <ClipboardList size={16} />
                <h4>{isFieldChangeReview ? "Decisione sulla modifica" : "Decisione sulla candidatura"}</h4>
                {reviewReadOnly ? <span className="review-viewer-badge">Solo lettura</span> : null}
              </div>

              {/* Assignment context banners */}
              {!isFinalized && assignedToOther && adminRole === "RESPONSABILE_ALBO" ? (
                <div className="review-state-banner state-info">
                  <Info size={14} />
                  <span>Assegnata a <strong>{latestCase?.assignedToDisplayName ?? "un revisore"}</strong>. Puoi verificare e decidere tu stesso.</span>
                </div>
              ) : !isFinalized && assignedToOther && adminRole === "SUPER_ADMIN" ? (
                <div className="review-state-banner state-readonly">
                  <Info size={14} />
                  <span>Assegnata a <strong>{latestCase?.assignedToDisplayName ?? "un revisore"}</strong>. Accesso in sola lettura.</span>
                </div>
              ) : null}

              {/* State banners */}
              {isFinalized ? (
                <div className="review-state-banner state-finalized">
                  <CheckCircle2 size={14} />
                  <span>Decisione già registrata per questa candidatura.</span>
                </div>
              ) : awaitingSupplierResponse ? (
                <div className="review-state-banner state-waiting">
                  <Clock3 size={14} />
                  <span>In attesa della risposta del fornitore. Le azioni sono temporaneamente bloccate.</span>
                </div>
              ) : latestIntegrationRequest?.status === "ANSWERED" && !latestCase?.verifiedAt ? (
                <div className="review-state-banner state-warn">
                  <AlertTriangle size={14} />
                  <span>Il fornitore ha risposto alla richiesta di integrazione. Esamina i nuovi documenti e verifica il profilo prima di procedere.</span>
                </div>
              ) : !latestCase?.verifiedAt && canVerify ? (
                <div className="review-state-banner state-warn">
                  <AlertTriangle size={14} />
                  <span>Il profilo non è ancora stato verificato.</span>
                </div>
              ) : null}

              {/* Completeness checklist */}
              {!isFieldChangeReview ? (
                <div className="review-checklist-mini">
                  {checklistRows.map((row) => (
                    <div key={row.label} className={`review-check-row ${row.done ? "check-done" : "check-missing"}`}>
                      {row.done ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      <span>{row.label}</span>
                    </div>
                  ))}
                  <div className="review-section-tags">
                    {sections.map((s) => (
                      <span key={s.id} className={s.completed ? "section-chip done" : "section-chip pending"}>
                        {sectionLabel(s.sectionKey)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Verify action */}
              {!isFinalized && !awaitingSupplierResponse && !notYetAssigned && !assignmentLocked && canVerify && latestCase && !latestCase.verifiedAt ? (
                <button type="button" className="review-verify-btn" onClick={() => setShowVerifyModal(true)}>
                  <CheckCircle2 size={14} /> Esamina e segna l'esito
                </button>
              ) : null}

              <div className="review-decision-divider" />

              {/* APPROVE */}
              {canFinalize ? (
                <div className="review-decision-block review-approve-block">
                  <div className="review-decision-block-head">
                    <CheckCircle2 size={15} /><strong>{isFieldChangeReview ? "Approva modifica" : "Approva iscrizione"}</strong>
                  </div>
                  <p className="review-decision-hint">{isFieldChangeReview ? "La modifica diventerà il nuovo valore approvato del profilo Albo." : "Il fornitore verrà iscritto all'albo e potrà operare da subito."}</p>
                  <label className="review-compact-label">Nota (opzionale)</label>
                  <textarea className="review-compact-textarea" rows={2} value={approveReason} maxLength={DECISION_REASON_MAX}
                    onChange={(e) => setApproveReason(e.target.value)} placeholder="Aggiungi una nota opzionale…"
                    readOnly={isFinalized || notYetAssigned || assignmentLocked} />
                  <button type="button" className="review-btn-approve"
                    onClick={() => void submitDecision("APPROVED", approveReason)}
                    disabled={!latestCase || busyAction !== null || finalDecisionLocked || assignmentLocked}>
                    {busyAction === "APPROVED" ? "Approvazione in corso..." : (isFieldChangeReview ? "Approva modifica" : "Approva")}
                  </button>
                </div>
              ) : null}

              {/* INTEGRATION */}
              {canRequestIntegration ? (
                <div className="review-decision-block review-integration-block">
                  <div className="review-decision-block-head">
                    <ClipboardList size={15} /><strong>Richiedi documenti mancanti</strong>
                  </div>
                  <p className="review-decision-hint">Segnala al fornitore cosa deve completare prima dell'approvazione.</p>
                  <button type="button" className="review-btn-integration" onClick={goToIntegrationPage}
                    disabled={finalDecisionLocked || assignmentLocked}>
                    Invia richiesta al fornitore
                  </button>
                  {awaitingSupplierResponse ? (
                    <p className="review-decision-hint-warn">Già in attesa di risposta dal fornitore.</p>
                  ) : null}
                </div>
              ) : null}

              {/* REJECT */}
              {canFinalize ? (
                <div className="review-decision-block review-reject-block">
                  <div className="review-decision-block-head">
                    <XCircle size={15} /><strong>{isFieldChangeReview ? "Respingi modifica" : "Rifiuta candidatura"}</strong>
                  </div>
                  <p className="review-decision-hint">{isFieldChangeReview ? "Il valore precedente resterà attivo sul profilo Albo." : "La candidatura sarà chiusa. Il fornitore riceverà notifica del rifiuto."}</p>
                  <label className="review-compact-label">Motivo del rifiuto <span className="review-required-star">*</span></label>
                  <textarea className="review-compact-textarea" rows={2} value={rejectReason} maxLength={DECISION_REASON_MAX}
                    onChange={(e) => setRejectReason(e.target.value)} placeholder="Descrivi il motivo del rifiuto…"
                    readOnly={isFinalized || notYetAssigned || assignmentLocked} />
                  {!rejectReason.trim() ? (
                    <p className="review-field-hint">Scrivi un motivo per abilitare il pulsante.</p>
                  ) : null}
                  <button type="button" className="review-btn-reject"
                    onClick={() => setShowRejectConfirmModal(true)}
                    disabled={!latestCase || busyAction !== null || finalDecisionLocked || assignmentLocked || !rejectReason.trim()}>
                    {busyAction === "REJECTED" ? "Chiusura in corso..." : (isFieldChangeReview ? "Respingi modifica" : "Rifiuta candidatura")}
                  </button>
                </div>
              ) : null}

              {!canFinalize && !canRequestIntegration ? (
                <p className="subtle review-no-action-hint">Non hai i permessi per agire su questa candidatura.</p>
              ) : null}
            </div>

            {/* Integration request status */}
            {latestIntegrationRequest ? (
              <div className="panel review-integration-status-panel">
                <h4>Ultima richiesta al fornitore</h4>
                <div className="review-integration-info">
                  <div>
                    <span className="review-meta-label">Stato</span>
                    <span className={`review-integ-status-badge ${latestIntegrationRequest.status === "OPEN" ? "status-open" : "status-closed"}`}>
                      {latestIntegrationRequest.status === "OPEN"
                        ? "In attesa di risposta"
                        : latestIntegrationRequest.status === "ANSWERED"
                          ? "Risposta ricevuta"
                          : latestIntegrationRequest.status === "OVERDUE"
                            ? "Scaduta"
                            : "Chiusa"}
                    </span>
                  </div>
                  <div>
                    <span className="review-meta-label">Scadenza</span>
                    <span className="review-meta-value">{new Date(latestIntegrationRequest.dueAt).toLocaleDateString("it-IT")}</span>
                  </div>
                  {latestIntegrationRequest.requestMessage ? (
                    <div>
                      <span className="review-meta-label">Messaggio inviato</span>
                      <p className="review-integration-message">{latestIntegrationRequest.requestMessage}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Internal notes */}
            <div className="panel review-notes-panel">
              <div className="review-side-panel-head">
                <h4><MessageSquare size={15} /> Note interne</h4>
                <span className="review-admin-only-pill">Solo admin</span>
              </div>
              <p className="subtle review-notes-hint">Visibili solo agli amministratori, non al fornitore.</p>
              <textarea className="review-compact-textarea" rows={4} value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)} placeholder="Scrivi annotazioni interne…" />
              <button type="button" className="review-save-notes-btn" onClick={saveInternalNotes}>
                <Save size={14} /> Salva nota
              </button>
            </div>

          </div>{/* end sidebar */}
        </div>{/* end review-content-grid */}

      </section>

      {/* ── Verify modal ── */}
      {showVerifyModal ? (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal-panel verify-modal-panel" onClick={(e) => e.stopPropagation()}>
            <h4 className="verify-modal-title">Esito della verifica documentale</h4>
            <p className="subtle verify-modal-subtitle">Seleziona il risultato del tuo esame dei documenti presentati.</p>

            <div className="verify-outcome-options">
              {([
                {
                  value: "COMPLIANT" as VerificationOutcome,
                  icon: "✅",
                  label: "Tutto conforme",
                  desc: "Documenti completi e corretti. Si può procedere con l'approvazione.",
                  noteLabel: null
                },
                {
                  value: "COMPLIANT_WITH_RESERVATIONS" as VerificationOutcome,
                  icon: "⚠️",
                  label: "Conforme con riserve",
                  desc: "Documenti presenti ma con alcune osservazioni da segnalare.",
                  noteLabel: "Descrivi le osservazioni (obbligatorio)"
                },
                {
                  value: "INCOMPLETE" as VerificationOutcome,
                  icon: "📋",
                  label: "Documenti mancanti",
                  desc: "Mancano documenti richiesti. Dovrai compilare e inviare la richiesta nel passaggio successivo.",
                  noteLabel: "Indica cosa manca (obbligatorio)"
                },
                {
                  value: "NON_COMPLIANT" as VerificationOutcome,
                  icon: "❌",
                  label: "Non conforme",
                  desc: "I documenti non soddisfano i requisiti. Si consiglia il rifiuto.",
                  noteLabel: "Motiva la non conformità (obbligatorio)"
                }
              ] as const).map((opt) => (
                <label key={opt.value} className={`verify-outcome-card ${verifyOutcome === opt.value ? "is-selected" : ""}`}>
                  <input type="radio" name="verifyOutcome" value={opt.value}
                    checked={verifyOutcome === opt.value} onChange={() => setVerifyOutcome(opt.value)} />
                  <span className="verify-outcome-card-icon">{opt.icon}</span>
                  <span className="verify-outcome-card-body">
                    <strong>{opt.label}</strong>
                    <span>{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {(() => {
              const noteRequired = verifyOutcome !== "COMPLIANT";
              const currentOpt = verifyOutcome === "COMPLIANT_WITH_RESERVATIONS"
                ? "Descrivi le osservazioni (obbligatorio)"
                : verifyOutcome === "INCOMPLETE"
                ? "Indica cosa manca (obbligatorio)"
                : verifyOutcome === "NON_COMPLIANT"
                ? "Motiva la non conformità (obbligatorio)"
                : "Note aggiuntive (opzionale)";
              return (
                <div className="verify-note-block">
                  <label className="review-compact-label">
                    {currentOpt}
                    {noteRequired && !verifyNote.trim() ? <span className="review-required-star"> *</span> : null}
                  </label>
                  <textarea className="review-compact-textarea" rows={3} value={verifyNote} maxLength={1000}
                    onChange={(e) => setVerifyNote(e.target.value)}
                    placeholder={noteRequired ? "Scrivi qui le tue osservazioni…" : "Aggiungi una nota opzionale…"} />
                  {noteRequired && !verifyNote.trim() ? (
                    <p className="review-field-hint">Richiesto per questo esito.</p>
                  ) : null}
                </div>
              );
            })()}

            {verifyOutcome === "INCOMPLETE" ? (
              <p className="verify-incomplete-hint">
                📋 Dopo la conferma potrai compilare e inviare la richiesta al fornitore. La richiesta non viene inviata automaticamente: dovrai completare il modulo nel passaggio successivo.
              </p>
            ) : null}

            <div className="modal-actions">
              <button type="button" className="home-btn home-btn-secondary" onClick={() => setShowVerifyModal(false)} disabled={busyVerify}>
                Annulla
              </button>
              <button type="button" className="home-btn home-btn-primary"
                onClick={() => void submitVerify()}
                disabled={busyVerify || (verifyOutcome !== "COMPLIANT" && !verifyNote.trim())}>
                {busyVerify ? "Salvataggio…" : verifyOutcome === "INCOMPLETE" ? "Conferma e apri integrazione" : "Conferma verifica"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Reject confirm modal ── */}
      {showRejectConfirmModal ? (
        <div className="modal-overlay" onClick={() => setShowRejectConfirmModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h4 className="verify-modal-title">Conferma rifiuto candidatura</h4>
            <p className="subtle">Stai per rifiutare definitivamente questa candidatura. Il fornitore riceverà una notifica con il motivo indicato. Questa azione non può essere annullata.</p>
            <div className="modal-actions">
              <button type="button" className="home-btn home-btn-secondary" onClick={() => setShowRejectConfirmModal(false)}>
                Annulla
              </button>
              <button type="button" className="review-btn-reject"
                onClick={() => {
                  setShowRejectConfirmModal(false);
                  void submitDecision("REJECTED", rejectReason);
                }}>
                Conferma rifiuto
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminCandidatureShell>
  );
}
