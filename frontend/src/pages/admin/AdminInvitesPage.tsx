import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Filter,
  Mail,
  MailPlus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import {
  createAdminInvite,
  getAdminInviteMonitor,
  renewAdminInvite,
  resendAdminInvite,
  updateAdminInvite,
  type CreateAdminInvitePayload
} from "../../api/adminInviteApi";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import type {
  AdminInviteMonitorResponse,
  AdminInviteMonitorRow,
  AdminInviteResponse,
  AdminInviteUiStatus
} from "../../types/api";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

interface AdminInvitesPageProps {
  mode: "manage" | "new";
}

type InviteDraft = {
  registryType: "ALBO_A" | "ALBO_B";
  firstName: string;
  lastName: string;
  invitedEmail: string;
  roleExpectation: string;
  expiresInDays: string;
  priority: "BASSA" | "MEDIA" | "ALTA";
  note: string;
};

const EMPTY_DRAFT: InviteDraft = {
  registryType: "ALBO_A",
  firstName: "",
  lastName: "",
  invitedEmail: "",
  roleExpectation: "",
  expiresInDays: "30",
  priority: "MEDIA",
  note: ""
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_MONITOR: AdminInviteMonitorResponse = {
  totalInvites: 0,
  completedInvites: 0,
  pendingInvites: 0,
  expiredInvites: 0,
  rows: []
};

const UI_STATUS_LABEL: Record<AdminInviteUiStatus, string> = {
  COMPLETATO: "Completato",
  IN_ATTESA: "In attesa",
  IN_COMPILAZIONE: "In compilazione",
  SCADUTO: "Scaduto",
  RIFIUTATO: "Rifiutato"
};

const INVITE_STATUSES = Object.keys(UI_STATUS_LABEL) as AdminInviteUiStatus[];
const INVITE_REGISTRIES: Array<"ALBO_A" | "ALBO_B"> = ["ALBO_A", "ALBO_B"];

function shouldRefreshInvites(event: DashboardActivityEvent): boolean {
  const key = event.eventKey ?? "";
  return key.startsWith("revamp.invite.") || event.entityType === "REVAMP_INVITE";
}

function registryLabel(value: "ALBO_A" | "ALBO_B"): string {
  return value === "ALBO_A" ? "Albo A" : "Albo B";
}

function toDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("it-IT");
}

function inviteStatusTone(row: AdminInviteMonitorRow): "ok" | "warn" | "info" | "danger" | "neutral" {
  if (row.uiStatus === "COMPLETATO") return "ok";
  if (row.uiStatus === "IN_ATTESA") return "info";
  if (row.uiStatus === "IN_COMPILAZIONE") return "info";
  if (row.uiStatus === "SCADUTO") return "warn";
  if (row.uiStatus === "RIFIUTATO") return "danger";
  return "neutral";
}

function splitInviteName(value: string | null | undefined): Pick<InviteDraft, "firstName" | "lastName"> {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] ?? "" };
}

function extractNoteValue(note: string | null | undefined, key: string): string {
  const prefix = `${key}:`;
  return (note ?? "")
    .split("|")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(prefix.toLowerCase()))
    ?.slice(prefix.length)
    .trim() ?? "";
}

function draftFromInviteRow(row: AdminInviteMonitorRow): InviteDraft {
  const name = splitInviteName(row.invitedName);
  const expiryMs = Date.parse(row.expiresAt);
  const days = Number.isFinite(expiryMs) && expiryMs > Date.now()
    ? Math.max(1, Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000)))
    : 30;
  const priority = extractNoteValue(row.note, "Priorita") as InviteDraft["priority"];
  return {
    registryType: row.registryType,
    firstName: name.firstName,
    lastName: name.lastName,
    invitedEmail: row.invitedEmail,
    roleExpectation: extractNoteValue(row.note, "Tipologia attesa"),
    expiresInDays: String(days),
    priority: priority === "BASSA" || priority === "ALTA" ? priority : "MEDIA",
    note: extractNoteValue(row.note, "Messaggio")
  };
}

function inviteDraftPayload(draft: InviteDraft): CreateAdminInvitePayload {
  const noteParts = [
    draft.roleExpectation.trim() ? `Tipologia attesa: ${draft.roleExpectation.trim()}` : "",
    draft.note.trim() ? `Messaggio: ${draft.note.trim()}` : "",
    `Priorita: ${draft.priority}`
  ].filter(Boolean);

  return {
    registryType: draft.registryType,
    invitedEmail: draft.invitedEmail.trim().toLowerCase(),
    invitedName: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim() || undefined,
    expiresInDays: Number.parseInt(draft.expiresInDays, 10),
    note: noteParts.join(" | ")
  };
}

interface InviteManagePanelProps {
  row: AdminInviteMonitorRow;
  busyKey: string | null;
  inviteLink: (tokenValue: string) => string;
  canManage: boolean;
  onUpdate: (row: AdminInviteMonitorRow, draft: InviteDraft) => void;
  onResend: (row: AdminInviteMonitorRow) => void;
  onRenew: (row: AdminInviteMonitorRow, draft: InviteDraft) => void;
}

function InviteManagePanel({
  row,
  busyKey,
  inviteLink,
  canManage,
  onUpdate,
  onResend,
  onRenew
}: InviteManagePanelProps) {
  const [draft, setDraft] = useState<InviteDraft>(() => draftFromInviteRow(row));

  useEffect(() => {
    setDraft(draftFromInviteRow(row));
  }, [row]);

  const normalizedEmail = draft.invitedEmail.trim().toLowerCase();
  const expires = Number.parseInt(draft.expiresInDays, 10);
  const emailValid = EMAIL_PATTERN.test(normalizedEmail);
  const expiresValid = Number.isFinite(expires) && expires >= 1 && expires <= 365;
  const hasName = draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0;
  const canSubmit = emailValid && expiresValid && hasName;
  const canUpdate = ["CREATED", "SENT", "OPENED"].includes(row.inviteStatus);
  const canResend = ["CREATED", "SENT", "OPENED"].includes(row.inviteStatus);
  const canRenew = row.inviteStatus === "EXPIRED" || row.uiStatus === "SCADUTO";
  const readonly = !canManage || (!canUpdate && !canRenew && !canResend);
  const previewRegistry = draft.registryType === "ALBO_A" ? "Albo A - Professionisti" : "Albo B - Aziende";
  const statusText = canRenew
    ? "Invito scaduto: rinnova per generare un nuovo link."
    : canResend
      ? "Invito ancora aperto: puoi aggiornare i dettagli e reinviare il link."
      : "Invito completato o chiuso: dettagli in sola lettura.";

  return (
    <div className="invite-row-manage-card admin-invites-new-grid admin-invites-row-manage-grid">
      <form
        className="panel admin-invites-create-form invite-row-manage-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || readonly) return;
          if (canRenew) onRenew(row, draft);
          else if (canUpdate) onUpdate(row, draft);
        }}
      >
        <div className="invite-form-header admin-invites-card-header">
          <span className="invite-form-header-icon" aria-hidden="true">
            <MailPlus size={18} />
          </span>
          <div>
            <h4>Gestisci invito fornitore</h4>
            <p className="subtle">{statusText}</p>
          </div>
        </div>

        <div className="admin-invites-setup-strip">
          <label className="floating-field has-value">
            <select
              className="floating-input"
              value={draft.registryType}
              disabled={readonly || canRenew}
              onChange={(e) => setDraft((prev) => ({ ...prev, registryType: e.target.value as "ALBO_A" | "ALBO_B" }))}
            >
              <option value="ALBO_A">Albo A - Professionisti</option>
              <option value="ALBO_B">Albo B - Aziende</option>
            </select>
            <span className="floating-field-label">Tipo Albo *</span>
          </label>

          <label className="floating-field has-value">
            <select
              className="floating-input"
              value={draft.expiresInDays}
              disabled={readonly}
              onChange={(e) => setDraft((prev) => ({ ...prev, expiresInDays: e.target.value }))}
            >
              <option value="7">7 giorni</option>
              <option value="15">15 giorni</option>
              <option value="30">30 giorni</option>
              <option value="60">60 giorni</option>
            </select>
            <span className="floating-field-label">{canRenew ? "Nuova validita *" : "Scadenza link *"}</span>
          </label>

          <label className="floating-field has-value">
            <select
              className="floating-input"
              value={draft.priority}
              disabled={readonly || canRenew}
              onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value as "BASSA" | "MEDIA" | "ALTA" }))}
            >
              <option value="BASSA">Bassa</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
            </select>
            <span className="floating-field-label">Priorita</span>
          </label>
        </div>

        <div className="admin-invites-recipient-panel">
          <h4>Destinatario</h4>
          <div className="admin-invites-grid-2">
            <label className={`floating-field ${draft.firstName ? "has-value" : ""}`}>
              <input className="floating-input" value={draft.firstName} disabled={readonly || canRenew} onChange={(e) => setDraft((prev) => ({ ...prev, firstName: e.target.value }))} placeholder=" " />
              <span className="floating-field-label">Nome *</span>
            </label>
            <label className={`floating-field ${draft.lastName ? "has-value" : ""}`}>
              <input className="floating-input" value={draft.lastName} disabled={readonly || canRenew} onChange={(e) => setDraft((prev) => ({ ...prev, lastName: e.target.value }))} placeholder=" " />
              <span className="floating-field-label">Cognome *</span>
            </label>
          </div>
          <label className={`floating-field ${draft.invitedEmail ? "has-value" : ""}`}>
            <input className="floating-input" type="email" value={draft.invitedEmail} disabled={readonly || canRenew} onChange={(e) => setDraft((prev) => ({ ...prev, invitedEmail: e.target.value }))} placeholder=" " />
            <span className="floating-field-label">E-mail destinatario *</span>
          </label>
          <label className={`floating-field ${draft.roleExpectation ? "has-value" : ""}`}>
            <input className="floating-input" value={draft.roleExpectation} disabled={readonly || canRenew} onChange={(e) => setDraft((prev) => ({ ...prev, roleExpectation: e.target.value }))} placeholder=" " />
            <span className="floating-field-label">Ruolo / Tipologia attesa</span>
          </label>
        </div>

        <div className="admin-invites-message-panel">
          <h4>Messaggio</h4>
          <label className={`floating-field ${draft.note ? "has-value" : ""}`}>
            <textarea className="floating-input" rows={3} value={draft.note} disabled={readonly || canRenew} onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))} placeholder=" " />
            <span className="floating-field-label">Messaggio personalizzato</span>
          </label>
        </div>

        <div className="admin-invites-form-actions invite-row-manage-actions">
          {canUpdate ? (
            <span className="invite-row-action-tooltip-wrap">
              <button
                type="submit"
                className={`home-btn home-btn-secondary admin-action-btn invite-row-icon-action invite-row-save-action${busyKey === `${row.id}:update` ? " is-saving" : ""}`}
                disabled={!canManage || !canSubmit || busyKey === `${row.id}:update`}
                aria-label="Salva dettagli invito"
                aria-describedby={`save-invite-tooltip-${row.id}`}
              >
                <Check size={16} />
              </button>
              <span id={`save-invite-tooltip-${row.id}`} className="invite-row-action-tooltip" role="tooltip">
                Salva i dettagli senza inviare una nuova e-mail
              </span>
            </span>
          ) : null}
          {canResend ? (
            <button
                type="button"
              className={`home-btn admin-action-btn settings-invite-toggle btn-with-icon btn-icon-send invite-row-resend-full-action${busyKey === `${row.id}:resend` ? " is-sending" : ""}`}
                disabled={!canManage || busyKey === `${row.id}:resend`}
                onClick={() => onResend(row)}
              >
                <Send size={16} />
              <span>{busyKey === `${row.id}:resend` ? "Reinvio..." : "Reinvia"}</span>
            </button>
          ) : null}
          {canRenew ? (
            <button type="submit" className="home-btn admin-action-btn settings-invite-toggle btn-with-icon btn-icon-send" disabled={!canManage || !expiresValid || busyKey === `${row.id}:renew`}>
              <RefreshCw size={15} />
              <span>{busyKey === `${row.id}:renew` ? "Rinnovo..." : "Rinnova invito"}</span>
            </button>
          ) : null}
        </div>
      </form>

      <aside className="panel admin-invites-preview invite-row-manage-preview">
        <div className="invite-form-header admin-invites-card-header">
          <span className="invite-form-header-icon admin-invites-preview-icon" aria-hidden="true">
            <Mail size={18} />
          </span>
          <div>
            <h4>Riepilogo invito</h4>
            <p className="subtle">{UI_STATUS_LABEL[row.uiStatus]} - {toDisplayDate(row.expiresAt)}</p>
          </div>
        </div>
        <article className="invite-email-card">
          <div className="invite-email-body invite-email-body-friendly">
            <div className="invite-preview-target">
              <span>Invito per</span>
              <strong>{previewRegistry}</strong>
              {draft.roleExpectation.trim() ? <small className="invite-preview-role-chip">Tipologia attesa: {draft.roleExpectation.trim()}</small> : null}
            </div>
            <div className="invite-preview-message">
              <span>Destinatario</span>
              <p>{`${draft.firstName.trim()} ${draft.lastName.trim()}`.trim() || row.invitedName || row.invitedEmail}</p>
              <p className="subtle">{draft.invitedEmail}</p>
              {draft.note.trim() ? <blockquote className="invite-preview-custom-message">{draft.note.trim()}</blockquote> : null}
            </div>
            <div className="invite-preview-validity">
              <span className="invite-preview-chip"><Clock3 size={13} /> {expiresValid ? `${expires} giorni` : "Durata non valida"}</span>
              <span className="invite-preview-chip"><CalendarDays size={13} /> Scade il {toDisplayDate(row.expiresAt)}</span>
            </div>
          </div>
          <footer className="invite-email-footer">
            <p className="subtle">Creato da: {row.invitedByName || "n/d"}</p>
            <p className="subtle">Link attuale: <code>{inviteLink("<token>")}</code></p>
          </footer>
        </article>
      </aside>
    </div>
  );
}

export function AdminInvitesPage({ mode }: AdminInvitesPageProps) {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole } = useAdminGovernanceRole();
  const invitesShellRef = useRef<HTMLElement | null>(null);
  const inviteComposerRef = useRef<HTMLDivElement | null>(null);
  const inviteComposerToggleRef = useRef<HTMLButtonElement | null>(null);
  const [monitor, setMonitor] = useState<AdminInviteMonitorResponse>(EMPTY_MONITOR);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [draft, setDraft] = useState<InviteDraft>(EMPTY_DRAFT);
  const [createBusy, setCreateBusy] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<AdminInviteResponse | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminInviteUiStatus>("ALL");
  const [registryFilter, setRegistryFilter] = useState<"ALL" | "ALBO_A" | "ALBO_B">("ALL");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [expandedInviteId, setExpandedInviteId] = useState<string | null>(null);
  const [closingInviteId, setClosingInviteId] = useState<string | null>(null);
  const [manageBusyKey, setManageBusyKey] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(mode === "new");
  const [inviteComposerClosing, setInviteComposerClosing] = useState(false);
  const monitorRefreshInFlightRef = useRef(false);
  const monitorRefreshQueuedRef = useRef(false);

  const canCreateInvite = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const normalizedEmail = draft.invitedEmail.trim().toLowerCase();
  const expires = Number.parseInt(draft.expiresInDays, 10);
  const emailValid = EMAIL_PATTERN.test(normalizedEmail);
  const expiresValid = Number.isFinite(expires) && expires >= 1 && expires <= 365;
  const canSubmitInvite = emailValid && expiresValid && draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0;

  function closeExpandedInviteRow() {
    setExpandedInviteId((current) => {
      if (current) {
        setClosingInviteId(current);
      }
      return null;
    });
  }

  function inviteLink(tokenValue: string): string {
    const base = typeof window === "undefined" ? "" : window.location.origin;
    return `${base}/invite/${tokenValue}`;
  }

  async function copyInviteLink(tokenValue: string) {
    const value = inviteLink(tokenValue);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setToast({ message: "Link invito copiato.", type: "success" });
      } else {
        setToast({ message: value, type: "success" });
      }
    } catch {
      setToast({ message: value, type: "success" });
    }
  }

  const loadMonitor = useCallback(async (showLoading = true) => {
    if (!token || !canCreateInvite) return;
    if (monitorRefreshInFlightRef.current) {
      monitorRefreshQueuedRef.current = true;
      return;
    }

    monitorRefreshInFlightRef.current = true;
    if (showLoading) setLoadingMonitor(true);
    try {
      const data = await getAdminInviteMonitor(token);
      setMonitor(data);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento monitor inviti non riuscito.";
      setToast({ message, type: "error" });
      setMonitor(EMPTY_MONITOR);
    } finally {
      monitorRefreshInFlightRef.current = false;
      if (showLoading) setLoadingMonitor(false);
      if (monitorRefreshQueuedRef.current) {
        monitorRefreshQueuedRef.current = false;
        void loadMonitor(false);
      }
    }
  }, [canCreateInvite, token]);

  useEffect(() => {
    void loadMonitor();
  }, [loadMonitor, mode]);

  useAdminRealtimeRefresh({
    token,
    enabled: canCreateInvite,
    shouldRefresh: shouldRefreshInvites,
    onRefresh: () => loadMonitor(false)
  });

  useEffect(() => {
    if (mode === "new") {
      setShowInviteForm(true);
      setInviteComposerClosing(false);
    }
  }, [mode]);

  useEffect(() => {
    const nextQuery = queryInput.trim();
    const handle = window.setTimeout(() => {
      setActiveQuery(nextQuery);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [queryInput]);

  useEffect(() => {
    if (!expandedInviteId) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const shell = invitesShellRef.current;
      const openRow = shell?.querySelector(`[data-invite-row-id="${expandedInviteId}"]`);
      if (openRow?.contains(target)) return;
      closeExpandedInviteRow();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expandedInviteId]);

  useEffect(() => {
    if (!showInviteForm) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (inviteComposerRef.current?.contains(target)) return;
      if (inviteComposerToggleRef.current?.contains(target)) return;
      closeInviteComposer();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showInviteForm]);

  const filteredRows = useMemo(() => {
    const term = activeQuery.trim().toLowerCase();
    return monitor.rows.filter((row) => {
      if (statusFilter !== "ALL" && row.uiStatus !== statusFilter) return false;
      if (registryFilter !== "ALL" && row.registryType !== registryFilter) return false;
      if (!term) return true;
      const corpus = [row.invitedName ?? "", row.invitedEmail, row.invitedByName ?? ""].join(" ").toLowerCase();
      return corpus.includes(term);
    });
  }, [activeQuery, monitor.rows, registryFilter, statusFilter]);

  const filterLabel = useMemo(() => {
    if (statusFilter === "ALL" && registryFilter === "ALL") return "Tutti";
    return [
      statusFilter === "ALL" ? null : UI_STATUS_LABEL[statusFilter],
      registryFilter === "ALL" ? null : registryLabel(registryFilter)
    ].filter(Boolean).join(" + ");
  }, [registryFilter, statusFilter]);

  async function onCreateInvite(event: FormEvent) {
    event.preventDefault();
    if (!token || !canCreateInvite || createBusy || !canSubmitInvite) return;

    const payload = inviteDraftPayload(draft);

    setCreateBusy(true);
    try {
      const response = await createAdminInvite(payload, token);
      setCreatedInvite(response);
      await loadMonitor();
      if (response.mailSent === false) {
        setToast({ message: "Invito creato, ma l'e-mail non e partita. Usa il link generato o riprova.", type: "error" });
      } else {
        setToast({ message: "Invito inviato via e-mail con successo.", type: "success" });
        setDraft((prev) => ({ ...EMPTY_DRAFT, registryType: prev.registryType }));
        closeInviteComposer();
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Invio invito non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setCreateBusy(false);
    }
  }

  const previewName = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim() || "Fornitore";
  const previewRegistry = draft.registryType === "ALBO_A" ? "Albo A - Professionisti" : "Albo B - Aziende";
  const previewRoleExpectation = draft.roleExpectation.trim();
  const previewCustomMessage = draft.note.trim();
  const previewExpiry = Number.isFinite(expires)
    ? new Date(Date.now() + expires * 24 * 60 * 60 * 1000).toLocaleDateString("it-IT")
    : "-";

  function openInviteComposer() {
    setCreatedInvite(null);
    setInviteComposerClosing(false);
    setShowInviteForm(true);
  }

  async function updateManagedInvite(row: AdminInviteMonitorRow, nextDraft: InviteDraft) {
    if (!token || !canCreateInvite) return;
    setManageBusyKey(`${row.id}:update`);
    try {
      await updateAdminInvite(row.id, token, inviteDraftPayload(nextDraft));
      await loadMonitor();
      setToast({ message: "Dettagli invito aggiornati.", type: "success" });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Aggiornamento invito non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setManageBusyKey(null);
    }
  }

  async function resendManagedInvite(row: AdminInviteMonitorRow) {
    if (!token || !canCreateInvite) return;
    setManageBusyKey(`${row.id}:resend`);
    try {
      const response = await resendAdminInvite(row.id, token);
      await loadMonitor();
      setToast({
        message: response.mailSent === false ? "Reinvio non riuscito. Usa il link o riprova." : "Invito reinviato via e-mail.",
        type: response.mailSent === false ? "error" : "success"
      });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Reinvio invito non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setManageBusyKey(null);
    }
  }

  async function renewManagedInvite(row: AdminInviteMonitorRow, nextDraft: InviteDraft) {
    if (!token || !canCreateInvite) return;
    const nextExpires = Number.parseInt(nextDraft.expiresInDays, 10);
    setManageBusyKey(`${row.id}:renew`);
    try {
      const response = await renewAdminInvite(row.id, token, {
        expiresInDays: Number.isFinite(nextExpires) ? nextExpires : 30
      });
      await loadMonitor();
      setExpandedInviteId(null);
      setToast({
        message: response.mailSent === false ? "Invito rinnovato, ma e-mail non partita." : "Invito rinnovato e reinviato.",
        type: response.mailSent === false ? "error" : "success"
      });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Rinnovo invito non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setManageBusyKey(null);
    }
  }

  function closeInviteComposer() {
    if (!showInviteForm) return;
    setInviteComposerClosing(true);
    setShowInviteForm(false);
  }

  const inviteKpis = [
    {
      id: "total",
      title: "Inviti inviati (totale)",
      value: monitor.totalInvites,
      icon: <MailPlus className="h-4 w-4" />,
      trend: "storico",
      tone: "info",
      level: monitor.totalInvites > 0 ? "info" : "ok",
      levelLabel: monitor.totalInvites > 0 ? "Operativo" : "Vuoto"
    },
    {
      id: "completed",
      title: "Completati",
      value: monitor.completedInvites,
      icon: <CheckCircle2 className="h-4 w-4" />,
      trend: "convertiti",
      tone: "ok",
      level: monitor.completedInvites > 0 ? "ok" : "info",
      levelLabel: monitor.completedInvites > 0 ? "Buono" : "In attesa"
    },
    {
      id: "pending",
      title: "In attesa",
      value: monitor.pendingInvites,
      icon: <Clock3 className="h-4 w-4" />,
      trend: "link aperti",
      tone: "attention",
      level: monitor.pendingInvites === 0 ? "ok" : monitor.pendingInvites > 20 ? "critical" : "attention",
      levelLabel: monitor.pendingInvites === 0 ? "Normale" : monitor.pendingInvites > 20 ? "Critico" : "Attenzione"
    },
    {
      id: "expired",
      title: "Scaduti senza utilizzo",
      value: monitor.expiredInvites,
      icon: <AlertTriangle className="h-4 w-4" />,
      trend: "da rinnovare",
      tone: "critical",
      level: monitor.expiredInvites === 0 ? "ok" : monitor.expiredInvites > 10 ? "critical" : "attention",
      levelLabel: monitor.expiredInvites === 0 ? "Controllo" : monitor.expiredInvites > 10 ? "Critico" : "Monitorare"
    }
  ] as const;

  const inviteCreatePanel = (
      <div
        className={`admin-invites-new-grid admin-invites-new-grid-inline${inviteComposerClosing ? " is-closing" : ""}`}
        ref={inviteComposerRef}
        onAnimationEnd={() => {
        if (inviteComposerClosing) {
          setInviteComposerClosing(false);
        }
      }}
    >
      <form className="panel admin-invites-create-form" onSubmit={onCreateInvite}>
        <div className="invite-form-header admin-invites-card-header">
          <span className="invite-form-header-icon" aria-hidden="true">
            <MailPlus size={18} />
          </span>
          <div>
            <h4>Crea nuovo invito fornitore</h4>
            <p className="subtle">Invia un accesso guidato e collega il fornitore all&apos;Albo corretto.</p>
          </div>
        </div>

        <div className="admin-invites-setup-strip">
          <label className="floating-field has-value">
            <select
              className="floating-input"
              value={draft.registryType}
              onChange={(e) => setDraft((prev) => ({ ...prev, registryType: e.target.value as "ALBO_A" | "ALBO_B" }))}
            >
              <option value="ALBO_A">Albo A - Professionisti</option>
              <option value="ALBO_B">Albo B - Aziende</option>
            </select>
            <span className="floating-field-label">Tipo Albo *</span>
          </label>

          <label className="floating-field has-value">
            <select
              className="floating-input"
              value={draft.expiresInDays}
              onChange={(e) => setDraft((prev) => ({ ...prev, expiresInDays: e.target.value }))}
            >
              <option value="7">7 giorni</option>
              <option value="15">15 giorni</option>
              <option value="30">30 giorni</option>
              <option value="60">60 giorni</option>
            </select>
            <span className="floating-field-label">Scadenza link *</span>
          </label>

          <label className="floating-field has-value">
            <select
              className="floating-input"
              value={draft.priority}
              onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value as "BASSA" | "MEDIA" | "ALTA" }))}
            >
              <option value="BASSA">Bassa</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
            </select>
            <span className="floating-field-label">Priorita</span>
          </label>
        </div>

        <div className="admin-invites-recipient-panel">
          <h4>Destinatario</h4>
          <div className="admin-invites-grid-2">
            <label className={`floating-field ${draft.firstName ? "has-value" : ""}`}>
              <input
                className="floating-input"
                value={draft.firstName}
                onChange={(e) => setDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder=" "
              />
              <span className="floating-field-label">Nome *</span>
            </label>
            <label className={`floating-field ${draft.lastName ? "has-value" : ""}`}>
              <input
                className="floating-input"
                value={draft.lastName}
                onChange={(e) => setDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder=" "
              />
              <span className="floating-field-label">Cognome *</span>
            </label>
          </div>

          <label className={`floating-field ${draft.invitedEmail ? "has-value" : ""}`}>
            <input
              className="floating-input"
              type="email"
              value={draft.invitedEmail}
              onChange={(e) => setDraft((prev) => ({ ...prev, invitedEmail: e.target.value }))}
              placeholder=" "
            />
            <span className="floating-field-label">E-mail destinatario *</span>
          </label>

          <label className={`floating-field ${draft.roleExpectation ? "has-value" : ""}`}>
            <input
              className="floating-input"
              value={draft.roleExpectation}
              onChange={(e) => setDraft((prev) => ({ ...prev, roleExpectation: e.target.value }))}
              placeholder=" "
            />
            <span className="floating-field-label">Ruolo / Tipologia attesa</span>
          </label>
        </div>

        <div className="admin-invites-message-panel">
          <h4>Messaggio</h4>
          <label className={`floating-field ${draft.note ? "has-value" : ""}`}>
            <textarea
              className="floating-input"
              rows={3}
              value={draft.note}
              onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
              placeholder=" "
            />
            <span className="floating-field-label">Messaggio personalizzato</span>
          </label>
        </div>

        {!canCreateInvite && auth?.role === "ADMIN" ? (
          <p className="subtle">Invio inviti disponibile solo per SUPER_ADMIN o RESPONSABILE_ALBO.</p>
        ) : null}

        <div className="admin-invites-form-actions">
          <span className="invite-reset-tooltip-wrap">
            <button
              type="button"
              className="home-btn home-btn-secondary admin-action-btn invite-reset-icon-button"
              onClick={() => setDraft(EMPTY_DRAFT)}
              disabled={createBusy}
              aria-label="Reset form invito"
              aria-describedby="supplier-invite-reset-tooltip"
            >
              <RotateCcw size={16} />
            </button>
            <span id="supplier-invite-reset-tooltip" className="invite-reset-tooltip" role="tooltip">Reset</span>
          </span>
          <button
            type="submit"
            className={`home-btn admin-action-btn settings-invite-toggle invite-create-submit-button btn-with-icon btn-icon-send${createBusy ? " is-sending" : ""}`}
            disabled={!canCreateInvite || !canSubmitInvite || createBusy}
          >
            <span className="settings-invite-icon-wrap" aria-hidden="true">
              <Send size={14} className="invite-send-icon" />
            </span>
            <span>{createBusy ? "Invio..." : "Invia invito"}</span>
          </button>
        </div>
      </form>

      <aside className="panel admin-invites-preview">
        <div className="invite-form-header admin-invites-card-header">
          <span className="invite-form-header-icon admin-invites-preview-icon" aria-hidden="true">
            <Mail size={18} />
          </span>
          <div>
            <h4>Anteprima per il fornitore</h4>
            <p className="subtle">Questo e il messaggio che ricevera via email.</p>
          </div>
        </div>
        <article className="invite-email-card">
          <div className="invite-email-body invite-email-body-friendly">
            <div className="invite-preview-target">
              <span>Invito per</span>
              <strong>{previewRegistry}</strong>
              {previewRoleExpectation ? (
                <small className="invite-preview-role-chip">Tipologia attesa: {previewRoleExpectation}</small>
              ) : null}
            </div>

            <div className="invite-preview-message">
              <span>Il fornitore vedra</span>
              <p>Gentile {previewName},</p>
              <p>sei stato invitato a completare l&apos;iscrizione a <strong>{previewRegistry}</strong>.</p>
              {previewCustomMessage ? (
                <blockquote className="invite-preview-custom-message">
                  {previewCustomMessage}
                </blockquote>
              ) : null}
            </div>

            <button type="button" className="home-btn home-btn-primary invite-email-action" disabled>
              Accedi al questionario
            </button>

            <div className="invite-preview-validity">
              <span className="invite-preview-chip">
                <Clock3 size={13} />
                {expiresValid ? `${expires} giorni` : "Durata non valida"}
              </span>
              <span className="invite-preview-chip">
                <CalendarDays size={13} />
                Scade il {previewExpiry}
              </span>
            </div>
          </div>
          <footer className="invite-email-footer">
            <p className="subtle">Invitato da: {auth?.email || "Admin"}</p>
            <details className="invite-preview-tech-details">
              <summary>Dettagli tecnici</summary>
              <p className="subtle">Il link reale verra generato dopo l&apos;invio.</p>
              <p className="subtle">Anteprima link: <code>{inviteLink("<token>")}</code></p>
            </details>
          </footer>
        </article>

        {createdInvite && createdInvite.mailSent === false ? (
          <div className="admin-invites-created-box">
            <p><strong>Invito inviato a:</strong> {createdInvite.invitedEmail}</p>
            <div className="admin-invites-created-actions">
              <a className="home-inline-link home-inline-link-admin" href={inviteLink(createdInvite.token)} target="_blank" rel="noreferrer">
                <span>Apri link invito</span>
              </a>
              <button type="button" className="home-btn home-btn-secondary admin-action-btn" onClick={() => void copyInviteLink(createdInvite.token)}>
                <Copy className="h-4 w-4" /> Copia link
              </button>
            </div>
          </div>
        ) : null}

        <div className="invite-preview-bottom-note">
          <strong>Pronto per l&apos;invio</strong>
          <p>L&apos;invito usera {previewRegistry} e restera valido per {expiresValid ? `${expires} giorni` : "la durata selezionata"}.</p>
        </div>
      </aside>
    </div>
  );

  const manageBody = (
    <section className="stack admin-invites-shell" ref={invitesShellRef}>
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="panel admin-invites-head">
        <div>
          <h2 className="admin-page-title-standard"><MailPlus className="h-5 w-5" /> Inviti</h2>
          <p className="subtle">Monitora invii, stato compilazione e azioni rapide.</p>
        </div>
      </div>

      <div className="admin-invites-kpis">
        {inviteKpis.map((item) => (
          <article key={item.id} className={`panel admin-invites-kpi superadmin-kpi-card tone-${item.tone}`}>
            <div className="superadmin-kpi-head">
              <h4>{item.title}</h4>
              <span className="superadmin-kpi-icon" aria-hidden="true">{item.icon}</span>
            </div>
            <strong>{item.value}</strong>
            <div className="superadmin-kpi-foot">
              <span className="superadmin-kpi-trend">{item.trend}</span>
              <span className={`superadmin-kpi-level level-${item.level}`}>{item.levelLabel}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="admin-search-bar admin-invites-search-bar">
        <div className="admin-search-bar-form">
          <div className="admin-search-input-wrap">
            <Search size={16} className="admin-search-icon" />
            <input
              className="admin-search-input"
              placeholder={queryInput.trim() ? `Filtro: ${queryInput.trim()}` : "Cerca per nome o e-mail..."}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
            <div className="admin-search-filter-menu admin-invites-filter-menu">
              <button
                type="button"
                className={`admin-search-filter-button${statusFilter !== "ALL" || registryFilter !== "ALL" ? " is-active" : ""}`}
                onClick={() => setFilterMenuOpen((open) => !open)}
                aria-expanded={filterMenuOpen}
                aria-haspopup="menu"
                aria-label="Filtra inviti per stato e albo"
              >
                <Filter size={13} />
                <span>{filterLabel}</span>
                <ChevronDown size={13} />
              </button>
              {filterMenuOpen ? (
                <div className="admin-search-filter-popover" role="menu">
                  <button
                    type="button"
                    className={`admin-search-filter-option admin-search-filter-all${statusFilter === "ALL" && registryFilter === "ALL" ? " is-selected" : ""}`}
                    onClick={() => {
                      setStatusFilter("ALL");
                      setRegistryFilter("ALL");
                      setFilterMenuOpen(false);
                    }}
                  >
                    <span>Tutti</span>
                    {statusFilter === "ALL" && registryFilter === "ALL" ? <Check size={13} /> : null}
                  </button>
                  <div className="admin-search-filter-section">
                    <span className="admin-search-filter-title">Stato</span>
                    {INVITE_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`admin-search-filter-option${statusFilter === status ? " is-selected" : ""}`}
                        onClick={() => setStatusFilter((current) => current === status ? "ALL" : status)}
                      >
                        <span>{UI_STATUS_LABEL[status]}</span>
                        {statusFilter === status ? <Check size={13} /> : null}
                      </button>
                    ))}
                  </div>
                  <div className="admin-search-filter-section">
                    <span className="admin-search-filter-title">Albo</span>
                    {INVITE_REGISTRIES.map((registry) => (
                      <button
                        key={registry}
                        type="button"
                        className={`admin-search-filter-option${registryFilter === registry ? " is-selected" : ""}`}
                        onClick={() => setRegistryFilter((current) => current === registry ? "ALL" : registry)}
                      >
                        <span>{registryLabel(registry)}</span>
                        {registryFilter === registry ? <Check size={13} /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {queryInput ? (
              <button type="button" className="admin-search-clear" onClick={() => setQueryInput("")}>×</button>
            ) : null}
          </div>
          <span className="admin-icon-tooltip-wrap">
            <button
              type="button"
              className={`home-btn home-btn-secondary admin-action-btn btn-with-icon btn-icon-refresh admin-refresh-icon-button${loadingMonitor ? " is-loading" : ""}`}
              onClick={() => void loadMonitor()}
              disabled={loadingMonitor}
              aria-label={loadingMonitor ? "Aggiornamento inviti in corso" : "Aggiorna inviti"}
              aria-describedby="invites-refresh-tooltip"
            >
              <RefreshCw size={17} aria-hidden="true" />
            </button>
            <span id="invites-refresh-tooltip" className="admin-icon-tooltip" role="tooltip">
              {loadingMonitor ? "Aggiornamento in corso" : "Aggiorna inviti"}
            </span>
          </span>
          <button
            type="button"
            ref={inviteComposerToggleRef}
            className="home-btn admin-action-btn settings-invite-toggle invite-head-btn btn-with-icon btn-icon-send"
            onClick={() => {
              if (showInviteForm) {
                closeInviteComposer();
              } else {
                openInviteComposer();
              }
            }}
            aria-expanded={showInviteForm}
          >
            <span className="settings-invite-icon-wrap" aria-hidden="true">
              {showInviteForm ? <X size={14} /> : <Plus size={14} />}
            </span>
            <span>{showInviteForm ? "Chiudi invito" : "Nuovo invito"}</span>
          </button>
        </div>
      </div>

      {showInviteForm || inviteComposerClosing ? inviteCreatePanel : null}

      <div className="panel">
        <div className={`admin-invites-table admin-unified-table admin-unified-table-clean${expandedInviteId ? " has-open-row" : ""}`}>
          <div className="admin-invites-row admin-invites-row-head admin-unified-table-row admin-unified-table-row-head">
            <span>Nome</span>
            <span>Albo</span>
            <span>Stato</span>
            <span>Scadenza</span>
            <span>Da</span>
            <span>Avanzamento</span>
          </div>
          {loadingMonitor ? <p className="subtle admin-unified-table-empty">Caricamento inviti...</p> : null}
          {!loadingMonitor && filteredRows.length === 0 ? <p className="subtle admin-unified-table-empty">Nessun invito trovato per i filtri selezionati.</p> : null}
          {!loadingMonitor && filteredRows.map((row) => {
            const tone = inviteStatusTone(row);
            const isExpanded = expandedInviteId === row.id;
            const progress = Number.isFinite(row.progressPercent) ? Math.max(0, Math.min(100, row.progressPercent)) : 0;
            const isClosing = closingInviteId === row.id;

            const toggleExpand = () => {
              setExpandedInviteId((prev) => {
                if (prev === row.id) {
                  setClosingInviteId(row.id);
                  return null;
                }
                setClosingInviteId(null);
                return row.id;
              });
            };

            return (
              <div
                key={row.id}
                className={`invite-row-wrap${isExpanded ? " is-expanded" : ""}`}
                data-invite-row-id={row.id}
              >
                <div
                  className={`admin-invites-row admin-unified-table-row invite-main-row${isExpanded ? " is-expanded" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={toggleExpand}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleExpand();
                    }
                  }}
                >
                  <div className="invite-user-cell">
                    <strong title={row.invitedName?.trim() || row.invitedEmail.split("@")[0]}>{row.invitedName?.trim() || row.invitedEmail.split("@")[0]}</strong>
                    <p className="subtle" title={row.invitedEmail}>{row.invitedEmail}</p>
                  </div>
                  <span className={`invite-registry-pill ${row.registryType === "ALBO_A" ? "albo-a" : "albo-b"}`}>{registryLabel(row.registryType)}</span>
                  <span className={`invite-status-pill tone-${tone}`}>
                    {row.uiStatus === "COMPLETATO" ? <CheckCircle2 className="h-4 w-4" /> : null}
                    {row.uiStatus === "IN_ATTESA" ? <Clock3 className="h-4 w-4" /> : null}
                    {row.uiStatus === "IN_COMPILAZIONE" ? <UserRound className="h-4 w-4" /> : null}
                    {row.uiStatus === "SCADUTO" ? <AlertTriangle className="h-4 w-4" /> : null}
                    {row.uiStatus === "RIFIUTATO" ? <XCircle className="h-4 w-4" /> : null}
                    {UI_STATUS_LABEL[row.uiStatus]}
                  </span>
                  <span>{toDisplayDate(row.expiresAt)}</span>
                  <span title={row.invitedByName || "n/d"}>{row.invitedByName || "n/d"}</span>
                  <div className="invite-progress-cell">
                    <div className="invite-progress-summary" aria-label={`Avanzamento ${progress}%`}>
                      <span className="invite-progress-track" aria-hidden="true">
                        <span className="invite-progress-fill" style={{ width: `${progress}%` }} />
                      </span>
                      <strong>{progress}%</strong>
                    </div>
                    <ChevronDown className={`invite-row-chevron${isExpanded ? " is-open" : ""}`} size={16} aria-hidden="true" />
                  </div>
                </div>

                {isExpanded || isClosing ? (
                  <div
                    className={`invite-row-details${isClosing ? " is-closing" : ""}`}
                    onAnimationEnd={() => {
                      if (isClosing) {
                        setClosingInviteId((current) => current === row.id ? null : current);
                      }
                    }}
                  >
                    <InviteManagePanel
                      row={row}
                      busyKey={manageBusyKey}
                      canManage={canCreateInvite}
                      inviteLink={inviteLink}
                      onUpdate={(targetRow, nextDraft) => void updateManagedInvite(targetRow, nextDraft)}
                      onResend={(targetRow) => void resendManagedInvite(targetRow)}
                      onRenew={(targetRow, nextDraft) => void renewManagedInvite(targetRow, nextDraft)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );

  return (
    <AdminCandidatureShell active="inviti">
      {manageBody}
    </AdminCandidatureShell>
  );
}
