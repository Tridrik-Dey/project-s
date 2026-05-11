import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, Info, Save } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { checkRevampIdentityAvailability, createRevampApplicationDraft, deleteRevampApplicationDraft, getMyLatestRevampApplication, getRevampApplicationSections, saveRevampApplicationSection, uploadRevampAttachment } from "../../api/revampApplicationApi";
import type { AttachmentUploadResult } from "../../api/revampApplicationApi";
import { API_BASE_URL, HttpError } from "../../api/http";
import { clearRevampApplicationIdForRegistry, loadRevampApplicationIdForRegistry, saveRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";
import { DIAL_CODE_OPTIONS } from "../../utils/dialCodes";
import { loadRevampFcrEditSession } from "../../utils/revampFcrEditSession";
import { useFcrEditMode } from "../../hooks/useFcrEditMode";
import { FcrSubmitBar } from "../../components/supplier/FcrSubmitBar";
import { clearRevampIntegrationEditSession, integrationEditHasAnyCode, isRevampIntegrationEditFor } from "../../utils/revampIntegrationEditSession";
import { completeRevampIntegrationEdit } from "../../utils/revampIntegrationCompletion";
import { clearRevampDocumentRenewalEditSession, isRevampDocumentRenewalEditFor, requestRevampDocumentRenewalDrawerReopen } from "../../utils/revampDocumentRenewalEditSession";

type RegistryType = "ALBO_A" | "ALBO_B";

function toRegistryType(param?: string): RegistryType | null {
  if (!param) return null;
  const n = param.trim().toLowerCase();
  if (n === "albo-a") return "ALBO_A";
  if (n === "albo-b") return "ALBO_B";
  return null;
}

/* ─── colours ─────────────────────────────────────── */
const NAVY  = "#0f2a52";
const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR   = "#dc2626";
const WARN_BG     = "#fffbeb";
const WARN_BORDER = "#f59e0b";

const STEPS = ["Anagrafica", "Tipologia", "Competenze", "Disponibilità", "Dichiarazioni"];

const REGIMI_FISCALI = [
  { value: "ordinario",   label: "Regime ordinario" },
  { value: "forfettario", label: "Regime forfettario" },
  { value: "occasionale", label: "Regime occasionale" },
  { value: "ditta",       label: "Ditta individuale" },
  { value: "altro",       label: "Altro (specificare)" },
];

/* Regimes where PIVA is mandatory */
const PIVA_REQUIRED_REGIMES = new Set(["ordinario", "forfettario", "ditta"]);

function splitPhoneValue(value: string | undefined, fallbackCode = "+39"): { code: string; number: string } {
  const raw = (value ?? "").trim();
  const match = DIAL_CODE_OPTIONS
    .map((option) => option.value)
    .sort((a, b) => b.length - a.length)
    .find((code) => raw === code || raw.startsWith(`${code} `));
  if (!match) return { code: fallbackCode, number: raw };
  return { code: match, number: raw.slice(match.length).trim() };
}

function composePhoneValue(code: string, number: string): string {
  const trimmed = number.trim();
  return trimmed ? `${code} ${trimmed}` : "";
}

/* ─── Validation regexes ───────────────────────────── */
const CF_RE    = /^[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]$/i;
const PIVA_RE  = /^\d{11}$/;
const DATE_RE  = /^\d{2}\/\d{2}\/\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE   = /^https?:\/\/.+\..+/;

const MAX_PHOTO_BYTES  = 5 * 1024 * 1024;
const PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const parts = s.split("/").map(Number);
  const [dd, mm, yyyy] = parts;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

function isNotFutureDate(s: string): boolean {
  if (!isValidDate(s)) return false;
  const [dd, mm, yyyy] = s.split("/").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d <= today;
}

function isNotPastDate(s: string): boolean {
  if (!isValidDate(s)) return false;
  const [dd, mm, yyyy] = s.split("/").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d >= today;
}

function isoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function displayToIso(display: string): string {
  if (!DATE_RE.test(display)) return "";
  const [dd, mm, yyyy] = display.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/* ─── Shared styles ────────────────────────────────── */
type OnChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

const baseInput = (error?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 12px", fontSize: "0.88rem",
  border: `1.5px solid ${error ? ERR : "#d1d5db"}`,
  borderRadius: 6, outline: "none", boxSizing: "border-box",
  color: "#111827", background: "#fff"
});

const col: React.CSSProperties  = { display: "flex", flexDirection: "column", gap: 4 };
const lbl: React.CSSProperties  = { fontSize: "0.78rem", fontWeight: 600, color: "#374151" };
const hint: React.CSSProperties = { fontWeight: 400, color: MUTED };
const errTxt: React.CSSProperties = { fontSize: "0.74rem", color: ERR };

function UploadFieldLabel({ label, hint }: { label: string; hint: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ ...lbl }}>{label}</span>
      <span
        style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <Info size={13} style={{ color: MUTED, cursor: "help" }} />
        {show && (
          <span style={{
            position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
            transform: "translateX(-50%)", background: "#1f2937", color: "#fff",
            fontSize: "0.72rem", padding: "5px 9px", borderRadius: 4,
            whiteSpace: "nowrap", pointerEvents: "none", zIndex: 100,
          }}>{hint}</span>
        )}
      </span>
    </div>
  );
}

/* ─── Field components ─────────────────────────────── */
function Field({
  label, required, placeholder, value, onChange, onBlur, error, type = "text", hintText, tooltip, errorTooltip, disabled
}: {
  label: string; required?: boolean; placeholder?: string;
  value?: string; onChange?: OnChange; onBlur?: () => void; error?: string; type?: string; hintText?: string; tooltip?: string; errorTooltip?: boolean; disabled?: boolean;
}) {
  const [showTip, setShowTip] = useState(false);
  const [showErrorTip, setShowErrorTip] = useState(false);
  return (
    <div style={col}>
      <span style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}>
        {label}{required ? <span style={{ color: ERR }}> *</span> : null}
        {hintText ? <span style={hint}> — {hintText}</span> : null}
        {tooltip ? (
          <span
            style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <Info size={12} style={{ color: MUTED, cursor: "help" }} />
            {showTip && (
              <span style={{
                position: "absolute", bottom: "calc(100% + 4px)", left: "50%",
                transform: "translateX(-50%)", background: "#1f2937", color: "#fff",
                fontSize: "0.72rem", padding: "4px 8px", borderRadius: 4,
                whiteSpace: "nowrap", pointerEvents: "none", zIndex: 100,
              }}>{tooltip}</span>
            )}
          </span>
        ) : null}
        {error && errorTooltip ? (
          <span
            title={error}
            tabIndex={0}
            style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
            onMouseEnter={() => setShowErrorTip(true)}
            onMouseLeave={() => setShowErrorTip(false)}
            onFocus={() => setShowErrorTip(true)}
            onBlur={() => setShowErrorTip(false)}
          >
            <Info size={13} style={{ color: ERR, cursor: "help" }} />
            {showErrorTip && (
              <span style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
                transform: "translateX(-50%)", background: "#991b1b", color: "#fff",
                fontSize: "0.72rem", padding: "6px 9px", borderRadius: 5,
                whiteSpace: "nowrap", pointerEvents: "none", zIndex: 120,
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.18)"
              }}>{error}</span>
            )}
          </span>
        ) : null}
      </span>
      <input
        type={type}
        placeholder={placeholder ?? ""}
        value={value ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        style={{ ...baseInput(!!error), ...(disabled ? { background: "#f3f4f6", cursor: "not-allowed", color: "#6b7280" } : {}) }}
      />
      {error && !errorTooltip ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function PhoneField({
  label, required, value, onChange, code, onCodeChange, error
}: {
  label: string; required?: boolean; value: string; onChange: OnChange; code: string; onCodeChange: (code: string) => void; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = DIAL_CODE_OPTIONS.find((option) => option.value === code) ?? DIAL_CODE_OPTIONS.find((option) => option.value === "+39");
  return (
    <div style={col}>
      <span style={lbl}>
        {label}{required ? <span style={{ color: ERR }}> *</span> : null}
      </span>
      <div style={{ display: "flex" }}>
        <div
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setOpen(false);
            }
          }}
          style={{
            flexShrink: 0,
            position: "relative",
            width: 82,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            style={{
              alignItems: "center",
              background: "#f3f4f6",
              border: `1.5px solid ${error ? ERR : "#d1d5db"}`,
              borderRadius: "6px 0 0 6px",
              borderRight: "none",
              boxSizing: "border-box",
              color: "#374151",
              cursor: "pointer",
              display: "flex",
              font: "inherit",
              fontSize: "0.82rem",
              height: "100%",
              justifyContent: "space-between",
              minHeight: 42,
              padding: "0 8px",
              width: "100%",
            }}
          >
            <span>{selected?.value ?? "+39"}</span>
            <span aria-hidden="true" style={{ color: MUTED, fontSize: "0.72rem" }}>▾</span>
          </button>
          {open ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid #cfd8e3",
                borderRadius: 8,
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
                left: 0,
                maxHeight: 230,
                minWidth: 230,
                overflowY: "auto",
                position: "absolute",
                top: "calc(100% + 4px)",
                width: "max-content",
                zIndex: 300,
              }}
            >
              {DIAL_CODE_OPTIONS.map((option) => (
                <button
                  key={`${option.label}-${option.value}`}
                  type="button"
                  onClick={() => {
                    onCodeChange(option.value);
                    setOpen(false);
                  }}
                  style={{
                    background: option.value === code ? "#e8f3ff" : "#fff",
                    border: "none",
                    color: "#1f2937",
                    cursor: "pointer",
                    display: "block",
                    font: "inherit",
                    fontSize: "0.82rem",
                    padding: "8px 12px",
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    width: "100%",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <input
          type="tel"
          placeholder="333 1234567"
          value={value}
          onChange={onChange}
          style={{ ...baseInput(!!error), borderRadius: "0 6px 6px 0" }}
        />
      </div>
      {error ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function SelectField({
  label, required, value, onChange, options, error, placeholder, hintText
}: {
  label: string; required?: boolean; value: string; onChange: OnChange;
  options: { value: string; label: string }[]; error?: string; placeholder?: string; hintText?: string;
}) {
  return (
    <div style={col}>
      <span style={lbl}>
        {label}{required ? <span style={{ color: ERR }}> *</span> : null}
        {hintText ? <span style={hint}> — {hintText}</span> : null}
      </span>
      <select value={value} onChange={onChange} style={baseInput(!!error)}>
        <option value="">{placeholder ?? "Seleziona..."}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function SectionLabel({ label, accent, required }: { label: string; accent: string; required?: boolean }) {
  return (
    <div style={{
      fontSize: "0.72rem", fontWeight: 700, color: accent,
      letterSpacing: "0.06em", textTransform: "uppercase",
      margin: "20px 0 12px", borderLeft: `3px solid ${accent}`,
      paddingLeft: 8
    }}>
      {label}{required ? <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span> : null}
    </div>
  );
}

/* ─── Main component ───────────────────────────────── */
export function RevampRegistryStartPage() {
  const navigate  = useNavigate();
  const { registryType: registryParam } = useParams();
  const registryType = useMemo(() => toRegistryType(registryParam), [registryParam]);
  const { auth } = useAuth();
  const fcr = useFcrEditMode();
  const integrationEdit = isRevampIntegrationEditFor(registryType === "ALBO_B" ? "ALBO_B" : "ALBO_A", 1);
  const renewalEdit = isRevampDocumentRenewalEditFor(registryType === "ALBO_B" ? "ALBO_B" : "ALBO_A", 1);
  const integrationIdentityOnly = integrationEditHasAnyCode(integrationEdit, ["ID_DOCUMENT"]) || Boolean(renewalEdit?.documentType === "ID_DOCUMENT");

  const [form, setForm] = useState({
    firstName: "", lastName: "", birthDate: "", birthPlace: "",
    taxCode: "", vatNumber: "", taxRegime: "", taxRegimeOther: "",
    country: "Italia", address: "", city: "", postalCode: "", province: "",
    phoneCode: "+39", phone: "", phoneSecondaryCode: "+39", phoneSecondary: "",
    email: auth?.email ?? "", emailSecondary: "", pec: "",
    website: "", linkedin: "",
    idDocumentExpiry: ""
  });
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [duplicateErrors, setDuplicateErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);
  const [profilePhotoAttachment, setProfilePhotoAttachment] = useState<AttachmentUploadResult | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  async function getOrCreateApplicationId(type: RegistryType): Promise<string> {
    const fcrSession = loadRevampFcrEditSession();
    if (fcrSession) return fcrSession.applicationId;
    if (integrationEdit) return integrationEdit.applicationId;
    if (renewalEdit) return renewalEdit.applicationId;
    const existing = loadRevampApplicationIdForRegistry(type);
    if (existing) return existing;
    if (!auth?.token) throw new Error("Missing auth token");

    const latest = await getMyLatestRevampApplication(auth.token).catch(() => null);
    if (latest?.status === "DRAFT" && latest.registryType === type) {
      saveRevampApplicationIdForRegistry(type, latest.id);
      return latest.id;
    }

    const draft = await createRevampApplicationDraft({ registryType: type, sourceChannel: "PUBLIC" }, auth.token);
    saveRevampApplicationIdForRegistry(type, draft.id);
    return draft.id;
  }

  useEffect(() => {
    if (!auth?.token || !registryType) return;
    const otherType: RegistryType = registryType === "ALBO_A" ? "ALBO_B" : "ALBO_A";
    const idsToDelete = new Set<string>();
    const storedOtherId = loadRevampApplicationIdForRegistry(otherType);
    if (storedOtherId) idsToDelete.add(storedOtherId);

    let cancelled = false;
    getMyLatestRevampApplication(auth.token)
      .then(latest => {
        if (cancelled) return;
        if (latest?.status === "DRAFT" && latest.registryType === otherType) {
          idsToDelete.add(latest.id);
        }
        idsToDelete.forEach(id => {
          deleteRevampApplicationDraft(id, auth.token)
            .catch(() => {})
            .finally(() => clearRevampApplicationIdForRegistry(otherType));
        });
        if (idsToDelete.size === 0) {
          clearRevampApplicationIdForRegistry(otherType);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [auth?.token, registryType]);

  useEffect(() => {
    if (!auth?.token || !registryType) return;

    function applyS1(sections: { sectionKey: string; sectionVersion: number; payloadJson: string }[]) {
      const latest = sections
        .filter(s => s.sectionKey === "S1")
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const s1 = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      const primaryPhone = splitPhoneValue(s1.phone as string | undefined);
      const secondaryPhone = splitPhoneValue(s1.secondaryPhone as string | undefined);
      setForm(prev => ({
        ...prev,
        firstName:      (s1.firstName      as string) ?? prev.firstName,
        lastName:       (s1.lastName       as string) ?? prev.lastName,
        birthDate:      (s1.birthDate      as string) ?? prev.birthDate,
        birthPlace:     (s1.birthPlace     as string) ?? prev.birthPlace,
        taxCode:        (s1.taxCode        as string) ?? prev.taxCode,
        vatNumber:      (s1.vatNumber      as string) ?? prev.vatNumber,
        taxRegime:      (s1.taxRegime      as string) ?? prev.taxRegime,
        country:        (s1.country        as string) ?? prev.country,
        address:        ((s1.addressLine ?? s1.address) as string) ?? prev.address,
        city:           (s1.city           as string) ?? prev.city,
        postalCode:     (s1.postalCode     as string) ?? prev.postalCode,
        province:       (s1.province       as string) ?? prev.province,
        phoneCode:      primaryPhone.code,
        phone:          primaryPhone.number || prev.phone,
        phoneSecondaryCode: secondaryPhone.code,
        phoneSecondary: secondaryPhone.number || prev.phoneSecondary,
        email:          (s1.email          as string) ?? prev.email,
        emailSecondary: (s1.secondaryEmail as string) ?? prev.emailSecondary,
        pec:            (s1.pec            as string) ?? prev.pec,
        website:        (s1.website        as string) ?? prev.website,
        linkedin:       (s1.linkedin       as string) ?? prev.linkedin,
        idDocumentExpiry: isoToDisplay((s1.idDocumentExpiry as string) ?? "") || prev.idDocumentExpiry,
      }));
      if (s1.profilePhotoAttachment && typeof s1.profilePhotoAttachment === "object") {
        setProfilePhotoAttachment(s1.profilePhotoAttachment as AttachmentUploadResult);
      }
    }

    const expectedType = registryType === "ALBO_A" ? "ALBO_A" : "ALBO_B";
    const fcrSession = loadRevampFcrEditSession();
    const existingAppId = fcrSession?.applicationId ?? renewalEdit?.applicationId ?? integrationEdit?.applicationId ?? loadRevampApplicationIdForRegistry(expectedType);
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS1).catch(() => {});
      return;
    }

    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== expectedType) return;
      saveRevampApplicationIdForRegistry(expectedType, app.id);
      return getRevampApplicationSections(app.id, auth.token!).then(applyS1);
    }).catch(() => {});
  }, [auth?.token, registryType]);

  useEffect(() => {
    return () => { if (profilePhotoPreviewUrl) URL.revokeObjectURL(profilePhotoPreviewUrl); };
  }, [profilePhotoPreviewUrl]);

  useEffect(() => {
    if (!auth?.token || !registryType) return;
    const field = registryType === "ALBO_A" ? "taxCode" : "vatNumber";
    const value = registryType === "ALBO_A" ? form.taxCode : form.vatNumber;
    const trimmed = value.trim();
    if (!trimmed) {
      setDuplicateErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      getOrCreateApplicationId(registryType)
        .then(appId => checkRevampIdentityAvailability(appId, field, trimmed, auth.token))
        .then(result => {
          if (cancelled) return;
          const message = field === "taxCode"
            ? "Codice fiscale gia presente. Inserisci un valore diverso."
            : "Partita IVA gia presente. Inserisci un valore diverso.";
          setDuplicateErrors(prev => {
            const next = { ...prev };
            if (!result.available) next[field] = message;
            else delete next[field];
            return next;
          });
          if (!result.available) {
            setSaveError(null);
          }
          setErrors(prev => {
            const next = { ...prev };
            if (!result.available) next[field] = message;
            else if (next[field] === message) delete next[field];
            return next;
          });
        })
        .catch(() => {});
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [auth?.token, form.taxCode, form.vatNumber, registryType]);

  useEffect(() => {
    if (!profilePhotoAttachment || profilePhotoPreviewUrl || !auth?.token || !registryType || profilePhotoAttachment.mimeType === "application/pdf") return;
    const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
    if (!appId) return;
    let cancelled = false;
    fetch(
      `${API_BASE_URL}/api/v2/applications/${appId}/attachments/download?storageKey=${encodeURIComponent(profilePhotoAttachment.storageKey)}`,
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )
      .then(r => r.blob())
      .then(blob => { if (!cancelled) setProfilePhotoPreviewUrl(URL.createObjectURL(blob)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profilePhotoAttachment?.storageKey]);

  async function onProfilePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!PHOTO_MIME_TYPES.has(file.type)) {
      setPhotoError("Formato non supportato. Usa JPG, PNG, WEBP o PDF.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Dimensione massima 5 MB.");
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    if (file.type !== "application/pdf") {
      setProfilePhotoPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    }
    try {
      const appId = await getOrCreateApplicationId(registryType === "ALBO_A" ? "ALBO_A" : "ALBO_B");
      if (!appId || !auth?.token) {
        setPhotoError("Sessione scaduta. Effettua nuovamente il login.");
        return;
      }
      const result = await uploadRevampAttachment(appId, file, auth.token);
      setProfilePhotoAttachment(result);
    } catch {
      setPhotoError("Caricamento non riuscito. Riprova.");
      setProfilePhotoPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    } finally {
      setPhotoUploading(false);
    }
  }

  function onRemoveProfilePhoto() {
    setProfilePhotoPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setProfilePhotoAttachment(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  const isA        = registryType === "ALBO_A";
  const accent     = isA ? NAVY : GREEN;
  const title      = isA ? "Albo A — Professionisti" : "Albo B — Aziende";
  const pivaReq    = PIVA_REQUIRED_REGIMES.has(form.taxRegime);
  const showOtherRegime = form.taxRegime === "altro";
  const liveDisplayName = [form.firstName, form.lastName]
    .map(part => part.trim())
    .filter(Boolean)
    .join(" ");
  const identityName = liveDisplayName || auth?.email || "Utente";
  const identityInitials =
    `${form.firstName.trim().charAt(0)}${form.lastName.trim().charAt(0)}`.toUpperCase()
    || identityName.slice(0, 2).toUpperCase();

  useEffect(() => {
    sessionStorage.setItem("supplier_identity_preview", JSON.stringify({
      name: identityName,
      initials: identityInitials
    }));
    window.dispatchEvent(new CustomEvent("supplier:identity-preview", {
      detail: { name: identityName, initials: identityInitials }
    }));
  }, [identityInitials, identityName]);

  if (!registryType) return <Navigate to="/apply" replace />;

  function set(field: keyof typeof form): OnChange {
    return (e) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
      if (duplicateErrors[field]) setDuplicateErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};

    if (!profilePhotoAttachment) e.cartaIdentita = "Carica la carta d'identità per procedere.";
    if (!form.idDocumentExpiry.trim()) {
      e.idDocumentExpiry = "Campo obbligatorio.";
    } else if (!isValidDate(form.idDocumentExpiry.trim())) {
      e.idDocumentExpiry = "Data non valida. Usa il formato GG/MM/AAAA.";
    } else if (!isNotPastDate(form.idDocumentExpiry.trim())) {
      e.idDocumentExpiry = "La data di scadenza non può essere nel passato.";
    }

    if (integrationIdentityOnly) return e;

    if (!form.firstName.trim())  e.firstName  = "Campo obbligatorio.";
    if (!form.lastName.trim())   e.lastName   = "Campo obbligatorio.";

    if (!form.birthDate.trim()) {
      e.birthDate = "Campo obbligatorio.";
    } else if (!isValidDate(form.birthDate.trim())) {
      e.birthDate = "Data non valida. Usa il formato GG/MM/AAAA.";
    } else if (!isNotFutureDate(form.birthDate.trim())) {
      e.birthDate = "La data di nascita non può essere nel futuro.";
    }

    if (!form.birthPlace.trim()) e.birthPlace = "Campo obbligatorio.";

    if (!form.taxCode.trim()) {
      e.taxCode = "Campo obbligatorio.";
    } else if (!CF_RE.test(form.taxCode.trim())) {
      e.taxCode = "Formato non valido (16 caratteri: AAABBB99A99A999A).";
    }

    if (pivaReq && !form.vatNumber.trim()) {
      e.vatNumber = "Obbligatoria per il regime fiscale selezionato.";
    } else if (form.vatNumber.trim() && !PIVA_RE.test(form.vatNumber.trim())) {
      e.vatNumber = "Formato non valido: deve avere esattamente 11 cifre.";
    }

    if (!form.taxRegime)                                         e.taxRegime      = "Campo obbligatorio.";
    if (showOtherRegime && !form.taxRegimeOther.trim())          e.taxRegimeOther = "Specifica il regime fiscale.";

    if (!form.country.trim())    e.country   = "Campo obbligatorio.";
    if (!form.address.trim())    e.address   = "Campo obbligatorio.";
    if (!form.city.trim())       e.city      = "Campo obbligatorio.";
    if (!form.postalCode.trim()) e.postalCode = "Campo obbligatorio.";
    if (!form.province.trim())   e.province  = "Campo obbligatorio.";
    if (!form.phone.trim())      e.phone     = "Campo obbligatorio.";

    if (!form.email.trim()) {
      e.email = "Campo obbligatorio.";
    } else if (!EMAIL_RE.test(form.email.trim())) {
      e.email = "Inserisci un indirizzo e-mail valido.";
    }

    if (form.emailSecondary.trim() && !EMAIL_RE.test(form.emailSecondary.trim()))
      e.emailSecondary = "Indirizzo e-mail non valido.";

    if (form.pec.trim() && !EMAIL_RE.test(form.pec.trim()))
      e.pec = "Indirizzo PEC non valido.";

    if (form.website.trim() && !URL_RE.test(form.website.trim()))
      e.website = "Inserisci un URL valido (es. https://www.esempio.it).";

    return e;
  }

  function handleSave() {
    const now = new Date();
    setSavedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  }

  async function handleSaveDraft() {
    setSaveError(null);
    if (!auth?.token) {
      setSaveError("Sessione scaduta. Effettua nuovamente il login.");
      return;
    }
    try {
      const appId = await getOrCreateApplicationId(isA ? "ALBO_A" : "ALBO_B");
      const payload = JSON.stringify({
        firstName: form.firstName, lastName: form.lastName,
        birthDate: form.birthDate, birthPlace: form.birthPlace,
        taxCode: form.taxCode, vatNumber: form.vatNumber,
        taxRegime: form.taxRegime, email: form.email,
        phone: composePhoneValue(form.phoneCode, form.phone), country: form.country, address: form.address, addressLine: form.address,
        city: form.city, postalCode: form.postalCode,
        province: form.province, linkedin: form.linkedin,
        secondaryPhone: composePhoneValue(form.phoneSecondaryCode, form.phoneSecondary),
        secondaryEmail: form.emailSecondary,
        pec: form.pec,
        website: form.website,
        ...(profilePhotoAttachment ? { profilePhotoAttachment } : {}),
        ...(form.idDocumentExpiry ? { idDocumentExpiry: displayToIso(form.idDocumentExpiry) } : {}),
      });
      await saveRevampApplicationSection(appId, "S1", payload, false, auth.token);
      handleSave();
    } catch (error) {
      if (error instanceof HttpError && error.message.startsWith("validation.duplicate.")) {
        const field = isA ? "taxCode" : "vatNumber";
        const message = isA
          ? "Codice fiscale gia presente. Inserisci un valore diverso."
          : "Partita IVA gia presente. Inserisci un valore diverso.";
        setDuplicateErrors(prev => ({ ...prev, [field]: message }));
        setErrors(prev => ({ ...prev, [field]: message }));
        return;
      }
      setSaveError("Salvataggio non riuscito. Riprova.");
    }
  }

  async function saveSectionProgrammatic() {
    if (!auth?.token) throw new Error("Sessione scaduta. Effettua nuovamente il login.");
    const appId = await getOrCreateApplicationId(isA ? "ALBO_A" : "ALBO_B");
    await saveRevampApplicationSection(appId, "S1", JSON.stringify({
      firstName: form.firstName, lastName: form.lastName,
      birthDate: form.birthDate, birthPlace: form.birthPlace,
      taxCode: form.taxCode, vatNumber: form.vatNumber,
      taxRegime: form.taxRegime, taxRegimeOther: form.taxRegimeOther, email: form.email,
      phone: composePhoneValue(form.phoneCode, form.phone), country: form.country, address: form.address, addressLine: form.address,
      city: form.city, postalCode: form.postalCode,
      province: form.province, linkedin: form.linkedin,
      secondaryPhone: composePhoneValue(form.phoneSecondaryCode, form.phoneSecondary),
      secondaryEmail: form.emailSecondary,
      pec: form.pec,
      website: form.website,
      ...(profilePhotoAttachment ? { profilePhotoAttachment } : {}),
      ...(form.idDocumentExpiry ? { idDocumentExpiry: displayToIso(form.idDocumentExpiry) } : {}),
    }), true, auth.token);
  }

  async function handleNext(ev: FormEvent) {
    ev.preventDefault();
    setSaveError(null);
    const errs = validate();
    const mergedErrors = { ...errs, ...duplicateErrors };
    if (Object.keys(mergedErrors).length) { setErrors(mergedErrors); return; }
    handleSave();
    sessionStorage.setItem("revamp_s1", JSON.stringify({
      firstName: form.firstName, lastName: form.lastName,
      birthDate: form.birthDate, birthPlace: form.birthPlace,
      taxCode: form.taxCode, vatNumber: form.vatNumber,
      taxRegime: form.taxRegime, email: form.email,
      phone: composePhoneValue(form.phoneCode, form.phone), country: form.country, address: form.address, addressLine: form.address,
      city: form.city, postalCode: form.postalCode,
      province: form.province, linkedin: form.linkedin,
      secondaryPhone: composePhoneValue(form.phoneSecondaryCode, form.phoneSecondary),
      secondaryEmail: form.emailSecondary,
      pec: form.pec,
      website: form.website,
      ...(profilePhotoAttachment ? { profilePhotoAttachment } : {}),
      ...(form.idDocumentExpiry ? { idDocumentExpiry: displayToIso(form.idDocumentExpiry) } : {}),
    }));
    if (auth?.token) {
      try {
        const appId = await getOrCreateApplicationId(isA ? "ALBO_A" : "ALBO_B");
        if (!integrationIdentityOnly) {
          const identityField = isA ? "taxCode" : "vatNumber";
          const identityValue = isA ? form.taxCode : form.vatNumber;
          const availability = await checkRevampIdentityAvailability(appId, identityField, identityValue, auth.token);
          if (!availability.available) {
            const message = isA
              ? "Codice fiscale gia presente. Inserisci un valore diverso."
              : "Partita IVA gia presente. Inserisci un valore diverso.";
            setDuplicateErrors(prev => ({ ...prev, [identityField]: message }));
            setErrors(prev => ({ ...prev, [identityField]: message }));
            return;
          }
        }
        await saveRevampApplicationSection(appId, "S1", sessionStorage.getItem("revamp_s1") ?? "{}", true, auth.token);
        if (integrationEdit) {
          await completeRevampIntegrationEdit(appId, auth.token, integrationEdit);
          clearRevampIntegrationEditSession();
          navigate(integrationEdit.returnPath);
          return;
        }
        if (renewalEdit) {
          requestRevampDocumentRenewalDrawerReopen(appId, renewalEdit.batchId);
          clearRevampDocumentRenewalEditSession();
          navigate(renewalEdit.returnPath);
          return;
        }
      } catch (error) {
        if (error instanceof HttpError && error.message.startsWith("validation.duplicate.")) {
          const field = isA ? "taxCode" : "vatNumber";
          const message = isA
            ? "Codice fiscale gia presente. Inserisci un valore diverso."
            : "Partita IVA gia presente. Inserisci un valore diverso.";
          setDuplicateErrors(prev => ({ ...prev, [field]: message }));
          setErrors(prev => ({ ...prev, [field]: message }));
          return;
        }
        setSaveError("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    navigate(`/apply/${registryParam}/step/2`);
  }

  const summaryErrors = Object.fromEntries(
    Object.entries(errors).filter(([field]) => !duplicateErrors[field])
  );
  const errorCount = Object.keys(summaryErrors).length;

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>

      {/* ── Inner page header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "#f5c800", borderRadius: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          </span>
          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e" }}>
            Solco<sup style={{ color: "#f5c800", fontSize: "0.55rem", verticalAlign: "super" }}>+</sup>
          </span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>{title}</div>
          <div style={{ fontSize: "0.75rem", color: MUTED }}>Questionario di iscrizione</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button type="button" className={`wizard-save-button${savedAt ? " is-saved" : ""}`} onClick={() => void handleSaveDraft()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 6, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", color: "#374151" }}>
            {savedAt ? <CheckCircle size={14} /> : <Save size={14} />}
            {savedAt ? `Bozza salvata ${savedAt}` : "Salva bozza"}
          </button>
          {saveError ? <span style={{ fontSize: "0.72rem", color: "#dc2626" }}>{saveError}</span> : null}
        </div>
      </div>

      {/* ── Step bar ── */}
      {fcr.active || integrationEdit || renewalEdit ? (
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "12px 40px", color: "#174f82", fontSize: "0.86rem", fontWeight: 700 }}>
          {renewalEdit ? "Rinnovo documento - Aggiorna solo il documento richiesto, poi salva." : fcr.active ? "Richiesta di modifica - Aggiorna solo il gruppo sbloccato, poi salva e invia." : "Richiesta integrazione - Aggiorna solo il documento richiesto, poi salva."}
        </div>
      ) : <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 40px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
          <div style={{ position: "absolute", top: 18, left: "10%", right: "10%", height: 2, background: "#e5e7eb", zIndex: 0 }} />
          {STEPS.map((step, i) => {
            const active = i === 0;
            return (
              <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 1 }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", background: active ? accent : "#fff", border: `2px solid ${active ? accent : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: active ? "#fff" : "#9ca3af" }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: "0.72rem", color: active ? accent : "#9ca3af", fontWeight: active ? 600 : 400, textAlign: "center" }}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>}

      {/* ── Form ── */}
      <form className="revamp-registry-start-form" onSubmit={handleNext} noValidate>
        <div style={{ maxWidth: 980, margin: "28px auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "28px 32px" }}>

            {/* Card header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Sezione 1 — Dati Anagrafici
                </h2>
                <p style={{ fontSize: "0.82rem", color: MUTED, margin: "4px 0 0" }}>
                  Compila i tuoi dati personali e di contatto. I campi con <span style={{ color: ERR }}>*</span> sono obbligatori.
                </p>
              </div>
            </div>
            <div style={{ height: 1, background: "#f3f4f6", margin: "16px 0 4px" }} />

            {/* ── Documento ── */}
            <div className={fcr.active ? (fcr.isLocked("foto_profilo") ? "fcr-locked" : "fcr-active-group") : integrationIdentityOnly ? "fcr-active-group" : undefined}>
            <SectionLabel label="Documento" accent={accent} required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }}>
              {/* Col 1 — upload */}
              <div style={col}>
                <UploadFieldLabel label="Carta d'identità" hint="Formati supportati: JPG, PNG, WEBP, PDF. Dimensione massima: 5 MB." />
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={e => void onProfilePhotoChange(e)}
                  disabled={photoUploading}
                  style={{ display: "none" }}
                />
                <div
                  onClick={() => !photoUploading && photoInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${profilePhotoAttachment ? "#16a34a" : "#d1d5db"}`,
                    borderRadius: 6, padding: "10px 14px", cursor: photoUploading ? "default" : "pointer",
                    background: profilePhotoAttachment ? "#f0fdf4" : "#fafafa",
                    display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  {photoUploading ? (
                    <span style={{ fontSize: "0.82rem", color: MUTED }}>Caricamento in corso...</span>
                  ) : profilePhotoAttachment ? (
                    <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 600 }}>✓ {profilePhotoAttachment.fileName}</span>
                  ) : (
                    <span style={{ fontSize: "0.82rem", color: "#9ca3af" }}>Clicca per caricare la carta d'identità</span>
                  )}
                </div>
                {(profilePhotoPreviewUrl || profilePhotoAttachment) && !photoUploading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {profilePhotoPreviewUrl ? (
                      <img src={profilePhotoPreviewUrl} alt="Anteprima"
                        style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, border: "1px solid #d1d5db" }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 4, border: "1px solid #d1d5db", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "1rem" }}>{profilePhotoAttachment?.mimeType === "application/pdf" ? "📄" : "🖼"}</span>
                      </div>
                    )}
                    <button type="button" onClick={onRemoveProfilePhoto}
                      style={{ fontSize: "0.72rem", color: "#b91c1c", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                      ✕ Rimuovi
                    </button>
                  </div>
                )}
                {photoError ? <span style={{ ...errTxt, display: "block", marginTop: 4 }}>{photoError}</span> : null}
                {errors.cartaIdentita ? <span style={{ ...errTxt, display: "block", marginTop: 4 }}>{errors.cartaIdentita}</span> : null}
              </div>
              {/* Col 2 — expiry date */}
              <Field
                label="Data di scadenza carta d'identità" required
                value={form.idDocumentExpiry} onChange={set("idDocumentExpiry")}
                error={errors.idDocumentExpiry} placeholder="GG/MM/AAAA"
                onBlur={() => {
                  const v = form.idDocumentExpiry.trim();
                  if (!v) return;
                  if (!isValidDate(v)) {
                    setErrors(p => ({ ...p, idDocumentExpiry: "Data non valida. Usa il formato GG/MM/AAAA." }));
                  } else if (!isNotPastDate(v)) {
                    setErrors(p => ({ ...p, idDocumentExpiry: "La data di scadenza non può essere nel passato." }));
                  } else {
                    setErrors(p => { const n = { ...p }; delete n.idDocumentExpiry; return n; });
                  }
                }}
              />
            </div>
            </div>

            {/* ── Dati personali ── */}
            <fieldset disabled={integrationIdentityOnly} className={fcr.active ? (fcr.isLocked("dati_personali") ? "fcr-locked" : "fcr-active-group") : integrationIdentityOnly ? "fcr-locked" : undefined}>
            <SectionLabel label="Dati personali" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Nome" required value={form.firstName} onChange={set("firstName")} error={errors.firstName} placeholder="Mario" />
              <Field label="Cognome" required value={form.lastName} onChange={set("lastName")} error={errors.lastName} placeholder="Rossi" />
              <Field label="Data di nascita" required value={form.birthDate} onChange={set("birthDate")} error={errors.birthDate} placeholder="GG/MM/AAAA"
                onBlur={() => {
                  const v = form.birthDate.trim();
                  if (!v) return;
                  if (!isValidDate(v)) {
                    setErrors(p => ({ ...p, birthDate: "Data non valida. Usa il formato GG/MM/AAAA." }));
                  } else if (!isNotFutureDate(v)) {
                    setErrors(p => ({ ...p, birthDate: "La data di nascita non può essere nel futuro." }));
                  } else {
                    setErrors(p => { const n = { ...p }; delete n.birthDate; return n; });
                  }
                }}
              />
              <Field label="Luogo di nascita" required value={form.birthPlace} onChange={set("birthPlace")} error={errors.birthPlace} placeholder="Milano (MI)" tooltip="Comune e Paese se estero" />
            </div>
            </fieldset>

            {/* ── Dati fiscali ── */}
            <fieldset disabled={integrationIdentityOnly} className={fcr.active ? (fcr.isLocked("dati_fiscali") ? "fcr-locked" : "fcr-active-group") : integrationIdentityOnly ? "fcr-locked" : undefined}>
            <SectionLabel label="Dati fiscali" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: showOtherRegime ? 12 : 16 }}>
              <Field
                label="Codice Fiscale" required
                value={form.taxCode} onChange={set("taxCode")} error={errors.taxCode}
                placeholder="RSSMRA80C15F205X"
                errorTooltip={!!duplicateErrors.taxCode}
              />
              <SelectField
                label="Regime fiscale" required
                value={form.taxRegime} onChange={set("taxRegime")} error={errors.taxRegime}
                options={REGIMI_FISCALI}
              />
              <Field
                label="Partita IVA" required={pivaReq}
                value={form.vatNumber} onChange={set("vatNumber")} error={errors.vatNumber}
                placeholder="12345678901"
                errorTooltip={!!duplicateErrors.vatNumber}
                hintText={pivaReq ? "obbligatoria per questo regime" : "opzionale — 11 cifre"}
              />
            </div>
            {showOtherRegime ? (
              <div style={{ marginBottom: 16 }}>
                <Field
                  label="Specifica il regime fiscale" required
                  value={form.taxRegimeOther} onChange={set("taxRegimeOther")} error={errors.taxRegimeOther}
                  placeholder="Descrivi il tuo regime fiscale"
                />
              </div>
            ) : null}
            </fieldset>

            {/* ── Indirizzo ── */}
            <fieldset disabled={integrationIdentityOnly} className={fcr.active ? (fcr.isLocked("indirizzo") ? "fcr-locked" : "fcr-active-group") : integrationIdentityOnly ? "fcr-locked" : undefined}>
            <SectionLabel label="Indirizzo professionale / di residenza" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "0.9fr 2fr", gap: 16, marginBottom: 12 }}>
              <Field label="Paese" required value={form.country} onChange={set("country")} error={errors.country} placeholder="Italia" />
              <Field label="Indirizzo" required value={form.address} onChange={set("address")} error={errors.address} placeholder="Via Dante, 14" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.8fr 1.15fr", gap: 16, marginBottom: 16 }}>
              <Field label="Citta / Comune" required value={form.city} onChange={set("city")} error={errors.city} placeholder="Milano" />
              <Field label="Codice postale" required value={form.postalCode} onChange={set("postalCode")} error={errors.postalCode} placeholder="20121" />
              <Field label="Provincia / Stato / Regione" required value={form.province} onChange={set("province")} error={errors.province} placeholder="MI, Lombardia, NY..." />
            </div>
            </fieldset>

            {/* ── Contatti ── */}
            <fieldset disabled={integrationIdentityOnly} className={fcr.active ? (fcr.isLocked("contatti") ? "fcr-locked" : "fcr-active-group") : integrationIdentityOnly ? "fcr-locked" : undefined}>
            <SectionLabel label="Contatti telefonici" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <PhoneField label="Telefono principale" required code={form.phoneCode} onCodeChange={(value) => setForm((prev) => ({ ...prev, phoneCode: value }))} value={form.phone} onChange={set("phone")} error={errors.phone} />
              <PhoneField label="Telefono secondario / WhatsApp" code={form.phoneSecondaryCode} onCodeChange={(value) => setForm((prev) => ({ ...prev, phoneSecondaryCode: value }))} value={form.phoneSecondary} onChange={set("phoneSecondary")} />
            </div>

            <SectionLabel label="Contatti e-mail" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field
                label="E-mail principale" required type="email"
                value={form.email} error={errors.email}
                disabled
              />
              <Field
                label="E-mail secondaria" type="email"
                value={form.emailSecondary} onChange={set("emailSecondary")} error={errors.emailSecondary}
                placeholder="facoltativa"
              />
              <Field
                label="PEC" type="email"
                value={form.pec} onChange={set("pec")} error={errors.pec}
                placeholder="mario.rossi@pec.it"
              />
            </div>

            {/* ── Presenza online ── */}
            <SectionLabel label="Presenza online" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <Field
                label="Sito web / Portfolio online" type="url"
                value={form.website} onChange={set("website")} error={errors.website}
                placeholder="https://www.esempio.it"
              />
              <Field
                label="Profilo LinkedIn"
                value={form.linkedin} onChange={set("linkedin")} error={errors.linkedin}
                placeholder="linkedin.com/in/mario-rossi"
              />
            </div>
            </fieldset>

            {/* ── Error summary ── */}
            {errorCount > 0 ? (
              <div style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 6, padding: "12px 16px" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#92400e", marginBottom: 6 }}>
                  ⚠ {errorCount} {errorCount === 1 ? "campo richiede attenzione" : "campi richiedono attenzione"}:
                </div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {Object.entries(summaryErrors).map(([field, msg]) => (
                    <li key={field} style={{ fontSize: "0.8rem", color: "#78350f" }}>
                      <strong>{FIELD_LABELS[field] ?? field}</strong> — {msg}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Bottom navigation ── */}
        {!fcr.active && <div className="wizard-bottom-nav" style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", position: "sticky", bottom: 0 }}>
          <Link className="wizard-nav-button wizard-nav-button-prev"
            to="/apply"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${accent}`, borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: accent, textDecoration: "none" }}
          >
            <ArrowLeft size={15} /> Sezione precedente
          </Link>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: "0.78rem", color: MUTED }}>Avanzamento: <strong>20%</strong></span>
            <div style={{ width: 200, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "20%", height: "100%", background: accent, borderRadius: 2 }} />
            </div>
          </div>

          <button className="wizard-nav-button wizard-nav-button-next"
            type="submit"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: accent, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
          >
            {integrationEdit || renewalEdit ? "Salva documento" : "Sezione successiva"} <ArrowRight size={15} />
          </button>
        </div>}
      </form>
      {auth && <FcrSubmitBar fcr={fcr} token={auth.token!} onSectionSaved={saveSectionProgrammatic} />}
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "Nome", lastName: "Cognome",
  birthDate: "Data di nascita", birthPlace: "Luogo di nascita",
  taxCode: "Codice Fiscale", vatNumber: "Partita IVA",
  taxRegime: "Regime fiscale", taxRegimeOther: "Specifica regime",
  country: "Paese", address: "Indirizzo", city: "Citta / Comune",
  postalCode: "Codice postale", province: "Provincia / Stato / Regione",
  phone: "Telefono principale",
  email: "E-mail principale", emailSecondary: "E-mail secondaria", pec: "PEC",
  website: "Sito web / Portfolio", linkedin: "Profilo LinkedIn"
};
