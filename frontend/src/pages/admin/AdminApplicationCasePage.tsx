import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Clock3, ExternalLink, FileText, History, Info, MessageSquare, RefreshCw, Save, XCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
    return {
      id: event.id,
      title: "Decisione registrata",
      badge: approved ? "Approvata" : "Non approvata",
      tone: approved ? "ok" : "danger",
      detail: event.reason || undefined,
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
    event.entityType === "REVAMP_APPLICATION"
    && event.entityId === applicationId
    && (key.startsWith("revamp.review.") || key.startsWith("revamp.application."))
  );
}

export function AdminApplicationCasePage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { adminRole } = useAdminGovernanceRole();
  const token = auth?.token ?? "";
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [sections, setSections] = useState<RevampSectionSnapshot[]>([]);
  const [reviewHistory, setReviewHistory] = useState<AdminReviewCaseSummary[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEventRow[]>([]);
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

      const [sectionsResult, historyResult, auditResult] = await Promise.allSettled([
        getRevampApplicationSections(appId, token),
        getAdminReviewHistory(appId, token),
        getAdminAuditEvents(token, { entityType: "REVAMP_APPLICATION", entityId: appId })
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
    const events = auditEvents
      .map(mapAuditToTimelineEvent)
      .filter((event): event is ReviewTimelineEvent => Boolean(event))
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

    if (events.length > 0) return events;

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
    return fallback;
  }, [auditEvents, reviewHistory, summary?.protocolCode, summary?.submittedAt]);
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
  const canFinalize = canFinalizeDecision(adminRole);
  const canRequestIntegration = canRequestIntegrationDecision(adminRole);
  const reviewReadOnly = auth?.role === "ADMIN" && adminRole === "VIEWER";
  const canVerify = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE";
  const isFinalized = latestCase?.status === "DECIDED" || summary?.status === "APPROVED" || summary?.status === "REJECTED";
  const hasOpenIntegrationRequest = latestIntegrationRequest?.status === "OPEN";
  const awaitingSupplierResponse = latestCase?.status === "WAITING_SUPPLIER_RESPONSE" || hasOpenIntegrationRequest;
  const notYetVerified = !latestCase?.verifiedAt;
  const notYetAssigned = latestCase?.status === "PENDING_ASSIGNMENT";
  const finalDecisionLocked = isFinalized || awaitingSupplierResponse || notYetVerified || notYetAssigned;
  const assignedToOther = Boolean(latestCase?.assignedToUserId && auth?.userId && latestCase.assignedToUserId !== auth.userId);
  const assignmentLocked = assignedToOther && adminRole !== "SUPER_ADMIN";
  const isAlboB = summary?.registryType === "ALBO_B";

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
        <Link to="/admin/candidature" className="review-back-btn">
          <ArrowLeft size={15} /> Torna alla lista
        </Link>
        <div className="review-sticky-identity">
          <span className="review-sticky-name">{candidateHeaderTitle}</span>
          <span className={`review-albo-badge ${isAlboB ? "albo-b" : "albo-a"}`}>
            {isAlboB ? "Albo Aziende" : "Albo Professionisti"}
          </span>
          <span className={`review-sticky-status tone-${statusToneOf(summary?.status)}`}>
            {statusLabelOf(summary?.status)}
          </span>
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
              {isAlboB ? "Azienda fornitrice" : "Professionista"} &nbsp;·&nbsp;
              {isAlboB ? "Albo Fornitori Aziende" : "Albo Fornitori Professionisti"}
            </p>
            <div className="review-hero-meta-grid">
              <div className="review-hero-meta-item">
                <span className="review-meta-label">Codice pratica</span>
                <span className="review-meta-value">{applicationDisplayCode(summary)}</span>
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
                <span className="review-meta-value">{latestCase?.assignedToDisplayName ?? "Non assegnata"}</span>
              </div>
              <div className="review-hero-meta-item">
                <span className="review-meta-label">Scadenza SLA</span>
                <span className="review-meta-value">{latestCase?.slaDueAt ? new Date(latestCase.slaDueAt).toLocaleDateString("it-IT") : "—"}</span>
              </div>
              {candidateMetaRows.map((row) => (
                <div key={row.label} className="review-hero-meta-item">
                  <span className="review-meta-label">{row.label}</span>
                  <span className="review-meta-value">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Verification outcome banner ── */}
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
                <h4>Decisione sulla candidatura</h4>
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
                    <CheckCircle2 size={15} /><strong>Approva iscrizione</strong>
                  </div>
                  <p className="review-decision-hint">Il fornitore verrà iscritto all'albo e potrà operare da subito.</p>
                  <label className="review-compact-label">Nota (opzionale)</label>
                  <textarea className="review-compact-textarea" rows={2} value={approveReason} maxLength={DECISION_REASON_MAX}
                    onChange={(e) => setApproveReason(e.target.value)} placeholder="Aggiungi una nota opzionale…"
                    readOnly={isFinalized || notYetAssigned || assignmentLocked} />
                  <button type="button" className="review-btn-approve"
                    onClick={() => void submitDecision("APPROVED", approveReason)}
                    disabled={!latestCase || busyAction !== null || finalDecisionLocked || assignmentLocked}>
                    {busyAction === "APPROVED" ? "Approvazione in corso…" : "✓  Approva"}
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
                    <XCircle size={15} /><strong>Rifiuta candidatura</strong>
                  </div>
                  <p className="review-decision-hint">La candidatura sarà chiusa. Il fornitore riceverà notifica del rifiuto.</p>
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
                    {busyAction === "REJECTED" ? "Chiusura in corso…" : "✕  Rifiuta candidatura"}
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

