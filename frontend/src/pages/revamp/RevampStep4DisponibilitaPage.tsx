import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, Info, Plus, Save, Trash2, Upload } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { createRevampApplicationDraft, getMyLatestRevampApplication, getRevampApplicationSections, saveRevampApplicationSection, uploadRevampAttachment } from "../../api/revampApplicationApi";
import type { AttachmentUploadResult } from "../../api/revampApplicationApi";
import { loadRevampApplicationIdForRegistry, saveRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";
import { clearRevampIntegrationEditSession, integrationEditHasAnyCode, isRevampIntegrationEditFor, loadRevampIntegrationEditSession } from "../../utils/revampIntegrationEditSession";
import { completeRevampIntegrationEdit } from "../../utils/revampIntegrationCompletion";
import { clearRevampDocumentRenewalEditSession, isRevampDocumentRenewalEditFor, requestRevampDocumentRenewalDrawerReopen } from "../../utils/revampDocumentRenewalEditSession";
import { loadRevampFcrEditSession } from "../../utils/revampFcrEditSession";
import { useFcrEditMode } from "../../hooks/useFcrEditMode";
import { FcrSubmitBar } from "../../components/supplier/FcrSubmitBar";
import { AREE_TEMATICHE } from "./RevampStep3CompetenzePage";

const NAVY  = "#0f2a52";
const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR   = "#dc2626";
const WARN_BG     = "#fffbeb";
const WARN_BORDER = "#f59e0b";

const STEPS = ["Anagrafica", "Tipologia", "Competenze", "Disponibilità", "Dichiarazioni"];

/* ─── 3A options ─────────────────────────────────── */
const TIPO_INTERVENTO = [
  { value: "aula",      label: "Corso in aula" },
  { value: "fad",       label: "FAD / E-learning" },
  { value: "blended",   label: "Blended" },
  { value: "coaching",  label: "Coaching" },
  { value: "workshop",  label: "Workshop / Laboratorio" },
  { value: "altro",     label: "Altro" },
];

const MODALITA_EROGAZIONE = [
  { value: "presenza",  label: "In presenza" },
  { value: "online_s",  label: "Online sincrona" },
  { value: "online_a",  label: "Online asincrona" },
  { value: "blended",   label: "Blended" },
];

const SETTORI_COMMITTENTE = [
  { value: "pa",             label: "Pubblica Amministrazione" },
  { value: "manifatturiero", label: "Manifatturiero" },
  { value: "terziario",      label: "Terziario" },
  { value: "no_profit",      label: "No Profit / Terzo Settore" },
  { value: "formazione",     label: "Formazione" },
  { value: "sanita",         label: "Sanità" },
  { value: "altro",          label: "Altro" },
];

/* ─── types ──────────────────────────────────────── */
type Esperienza = {
  committente: string; settore: string;
  tipoIntervento: string; tipoIntTesto: string;
  ambitoTematico: string;
  periodoFrom: string; periodoTo: string;
  durata: string; nPartecipanti: string;
  modalita: string;
  finanziata: string; fondoProgramma: string;
};

type Referenza = { nome: string; ruolo: string; contatto: string };

function mkEsp(): Esperienza {
  return { committente: "", settore: "", tipoIntervento: "", tipoIntTesto: "", ambitoTematico: "", periodoFrom: "", periodoTo: "", durata: "", nPartecipanti: "", modalita: "", finanziata: "", fondoProgramma: "" };
}
function mkRef(): Referenza { return { nome: "", ruolo: "", contatto: "" }; }

/* ─── shared ui ──────────────────────────────────── */
type OC  = (e: ChangeEvent<HTMLInputElement>)    => void;
type OCT = (e: ChangeEvent<HTMLTextAreaElement>) => void;
type OCS = (e: ChangeEvent<HTMLSelectElement>)   => void;

const s_in = (err?: boolean): React.CSSProperties => ({
  width: "100%", padding: "9px 11px", fontSize: "0.86rem",
  border: `1.5px solid ${err ? ERR : "#d1d5db"}`, borderRadius: 6,
  outline: "none", boxSizing: "border-box", color: "#111827", background: "#fff",
});
const s_ta = (err?: boolean): React.CSSProperties => ({
  ...s_in(err), resize: "vertical" as const, minHeight: 64, fontFamily: "inherit",
});
const COL: React.CSSProperties  = { display: "flex", flexDirection: "column", gap: 4 };
const LBL: React.CSSProperties  = { fontSize: "0.77rem", fontWeight: 600, color: "#374151" };
const HINT: React.CSSProperties = { fontWeight: 400, color: MUTED };
const ERRTXT: React.CSSProperties = { fontSize: "0.73rem", color: ERR };

function Field({ label, required, value, onChange, error, placeholder, type = "text", hint }: {
  label: string; required?: boolean; value: string; onChange: OC;
  error?: string; placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div style={COL}>
      <span style={LBL}>{label}{required && <span style={{ color: ERR }}> *</span>}{hint && <span style={HINT}> — {hint}</span>}</span>
      <input type={type} placeholder={placeholder ?? ""} value={value} onChange={onChange} style={s_in(!!error)} />
      {error && <span style={ERRTXT}>{error}</span>}
    </div>
  );
}
function Textarea({ label, required, value, onChange, error, placeholder, hint, rows = 3 }: {
  label: string; required?: boolean; value: string; onChange: OCT;
  error?: string; placeholder?: string; hint?: string; rows?: number;
}) {
  return (
    <div style={COL}>
      <span style={LBL}>{label}{required && <span style={{ color: ERR }}> *</span>}{hint && <span style={HINT}> — {hint}</span>}</span>
      <textarea placeholder={placeholder ?? ""} value={value} onChange={onChange} rows={rows} style={s_ta(!!error)} />
      {error && <span style={ERRTXT}>{error}</span>}
    </div>
  );
}
function Select({ label, required, value, onChange, options, error, hint }: {
  label: string; required?: boolean; value: string; onChange: OCS;
  options: { value: string; label: string }[]; error?: string; hint?: string;
}) {
  return (
    <div style={COL}>
      <span style={LBL}>{label}{required && <span style={{ color: ERR }}> *</span>}{hint && <span style={HINT}> — {hint}</span>}</span>
      <select value={value} onChange={onChange} style={s_in(!!error)}>
        <option value="">Seleziona...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span style={ERRTXT}>{error}</span>}
    </div>
  );
}

function SectionCard({ title, desc, accent, badge, children }: { title: string; desc?: string; accent: string; badge?: string; children: React.ReactNode }) {
  const fcrSession = loadRevampFcrEditSession();
  const integrationSession = loadRevampIntegrationEditSession();
  const automaticGroups = title.includes("Disponibilit") || title.includes("Territorio")
    ? ["cap_operativa", "tariffe", "territorio"]
    : title.includes("Esperienze")
      ? ["esperienze"]
      : title.includes("Referenze")
        ? ["referenze"]
        : title.includes("Allegati") || title.includes("Curriculum")
          ? ["allegati"]
          : [];
  const integrationActive = integrationSession && automaticGroups.length
    ? (
        title.includes("Esperienze")
          ? integrationEditHasAnyCode(integrationSession, ["EXPERIENCE_CONSISTENCY"])
          : title.includes("Allegati") || title.includes("Curriculum")
            ? integrationEditHasAnyCode(integrationSession, ["CV", "PROFESSIONAL_CERTIFICATION", "PROFESSIONAL_REGISTER"])
            : false
      )
    : false;
  const className = integrationSession && automaticGroups.length
    ? integrationActive ? "fcr-active-group" : "fcr-locked"
    : fcrSession && automaticGroups.length
    ? automaticGroups.includes(fcrSession.sectionKey) ? "fcr-active-group" : "fcr-locked"
    : undefined;
  return (
    <div className={className} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "22px 26px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: desc ? 4 : 14 }}>
        <div style={{ fontWeight: 700, fontSize: "1rem", color: accent }}>{title}</div>
        {badge && <span style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 400 }}>{badge}</span>}
      </div>
      {desc && <p style={{ fontSize: "0.82rem", color: MUTED, margin: "0 0 16px", lineHeight: 1.5 }}>{desc}</p>}
      {children}
    </div>
  );
}

function FileUpload({ label, required, hint, tooltip, accept = ".pdf", maxMB = 5, uploading = false, disabled = false, result = null, onSelect }: {
  label: string; required?: boolean; hint?: string; tooltip?: string; accept?: string; maxMB?: number;
  uploading?: boolean; disabled?: boolean; result?: AttachmentUploadResult | null;
  onSelect: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [showTip, setShowTip] = useState(false);
  return (
    <div style={COL}>
      <span style={{ ...LBL, display: "flex", alignItems: "center", gap: 4 }}>
        {label}{required && <span style={{ color: ERR }}> *</span>}
        {hint && <span style={HINT}> — {hint}</span>}
        {tooltip && (
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
        )}
      </span>
      <div
        onClick={() => !uploading && !disabled && ref.current?.click()}
        style={{ border: "1.5px dashed #d1d5db", borderRadius: 6, padding: "14px 16px", cursor: uploading || disabled ? "default" : "pointer", background: result ? "#f0fdf4" : "#fafafa", display: "flex", alignItems: "center", gap: 10, opacity: disabled ? 0.65 : 1 }}
      >
        <Upload size={16} color={result ? "#16a34a" : "#9ca3af"} />
        {uploading
          ? <span style={{ fontSize: "0.82rem", color: MUTED }}>Caricamento in corso...</span>
          : result
            ? <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 600 }}>✓ {result.fileName}</span>
            : <span style={{ fontSize: "0.82rem", color: "#9ca3af" }}>Clicca per caricare — PDF max {maxMB} MB</span>}
      </div>
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }} disabled={uploading || disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); }} />
    </div>
  );
}

function StepBar({ active, accent }: { active: number; accent: string }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 40px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{ position: "absolute", top: 17, left: "10%", right: "10%", height: 2, background: "#e5e7eb", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 17, left: "10%", width: `${(active / (STEPS.length - 1)) * 80}%`, height: 2, background: accent, zIndex: 0, transition: "width .3s" }} />
        {STEPS.map((step, i) => {
          const done = i < active; const cur = i === active;
          return (
            <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, zIndex: 1 }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: done || cur ? accent : "#fff", border: `2px solid ${done || cur ? accent : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.82rem", color: done || cur ? "#fff" : "#9ca3af" }}>{i + 1}</span>
              <span style={{ fontSize: "0.7rem", color: cur ? accent : done ? accent : "#9ca3af", fontWeight: cur || done ? 600 : 400, textAlign: "center" }}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle, savedAt, onSave }: { title: string; subtitle: string; savedAt: string | null; onSave: () => void }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, background: "#f5c800", borderRadius: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
        </span>
        <span style={{ fontWeight: 800, fontSize: "1rem", color: "#1a1a2e" }}>Solco<sup style={{ color: "#f5c800", fontSize: "0.5rem", verticalAlign: "super" }}>+</sup></span>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>{title}</div>
        <div style={{ fontSize: "0.73rem", color: MUTED }}>{subtitle}</div>
      </div>
      <button type="button" className={`wizard-save-button${savedAt ? " is-saved" : ""}`} onClick={onSave} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 6, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", color: "#374151" }}>
        {savedAt ? <CheckCircle size={13} /> : <Save size={13} />} {savedAt ? `Bozza salvata ${savedAt}` : "Salva bozza"}
      </button>
    </div>
  );
}

/* ─── main component ─────────────────────────────── */
export function RevampStep4DisponibilitaPage() {
  const navigate = useNavigate();
  const { registryType: registryParam } = useParams();
  const { auth } = useAuth();
  const isA = registryParam === "albo-a";
  const isB = registryParam === "albo-b";
  if (!isA && !isB) return <Navigate to="/apply" replace />;

  const tipologia  = sessionStorage.getItem("revamp_tipologia") ?? "";
  const isDocente  = isA && tipologia === "docente";
  const accent     = isA ? NAVY : GREEN;
  const title      = isA ? "Albo A — Professionisti" : "Albo B — Aziende";
  const registryType = isA ? "ALBO_A" : "ALBO_B";
  const integrationEdit = isRevampIntegrationEditFor(registryType, 4);
  const renewalEdit = isRevampDocumentRenewalEditFor(registryType, 4);
  const renewalDocs = (renewalEdit?.documents ?? (renewalEdit ? [renewalEdit] : []));
  const renewalHasDocumentType = (documentType: string) => renewalDocs.some(item => item.documentType === documentType);
  const fcr = useFcrEditMode();
  const subtitle   = isDocente ? "Sezione 4 · Disponibilità, Esperienze e Allegati" : "Sezione 4 · Disponibilità e Allegati";

  /* ── 3A C — Disponibilità ── */
  const [disponibilita, setDisponibilita] = useState("");
  const [areeSpecifiche, setAreeSpecifiche] = useState("");
  const [tariffaGiorn, setTariffaGiorn] = useState("");
  const [tariffaOra, setTariffaOra] = useState("");

  /* ── 3A D — Esperienze ── */
  const [esperienze, setEsperienze] = useState<Esperienza[]>([mkEsp()]);

  function updateEsp(idx: number, field: keyof Esperienza, val: string) {
    setEsperienze(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
    clearErr(`esp_${idx}_${field}`);
  }
  function addEsp() { if (esperienze.length < 5) setEsperienze(prev => [...prev, mkEsp()]); }
  function removeEsp(idx: number) { setEsperienze(prev => prev.filter((_, i) => i !== idx)); }

  /* ── 3A E — Referenze ── */
  const [referenze, setReferenze] = useState<Referenza[]>([]);

  function updateRef(idx: number, field: keyof Referenza, val: string) {
    setReferenze(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }
  function addRef() { if (referenze.length < 2) setReferenze(prev => [...prev, mkRef()]); }
  function removeRef(idx: number) { setReferenze(prev => prev.filter((_, i) => i !== idx)); }

  /* ── 3A F — Allegati ── */
  const [cvAttachment, setCvAttachment] = useState<AttachmentUploadResult | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [certAttachment, setCertAttachment] = useState<AttachmentUploadResult | null>(null);
  const [certUploading, setCertUploading] = useState(false);

  /* ── 3B — Disponibilità e CV ── */
  const [areaTerrB, setAreaTerrB] = useState("");
  const [tariffaOraB, setTariffaOraB] = useState("");
  const [cvAttachmentB, setCvAttachmentB] = useState<AttachmentUploadResult | null>(null);
  const [cvUploadingB, setCvUploadingB] = useState(false);

  /* ── shared ── */
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;

    function applyS4(sections: { sectionKey: string; sectionVersion: number; payloadJson: string }[]) {
      const latest = sections
        .filter(s => s.sectionKey === "S4")
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const s4 = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      if (s4.disponibilita)  setDisponibilita(s4.disponibilita as string);
      if (s4.areeSpecifiche) setAreeSpecifiche(s4.areeSpecifiche as string);
      if (s4.tariffaGiorn)   setTariffaGiorn(s4.tariffaGiorn as string);
      if (s4.tariffaOra)     setTariffaOra(s4.tariffaOra as string);
      if (s4.areaTerrB)      setAreaTerrB(s4.areaTerrB as string);
      if (s4.tariffaOraB)    setTariffaOraB(s4.tariffaOraB as string);
      if (Array.isArray(s4.attachments)) {
        type AttMeta = { documentType: string; fileName: string; storageKey: string; mimeType: string; sizeBytes: number };
        for (const att of s4.attachments as AttMeta[]) {
          if (!att.fileName || !att.storageKey) continue;
          const result: AttachmentUploadResult = { fileName: att.fileName, storageKey: att.storageKey, mimeType: att.mimeType, sizeBytes: att.sizeBytes };
          if (att.documentType === "CV") {
            if (isDocente) setCvAttachment(result); else setCvAttachmentB(result);
          } else if (att.documentType === "CERTIFICATION") {
            setCertAttachment(result);
          }
        }
      }
    }

    const existingAppId = loadRevampFcrEditSession()?.applicationId ?? renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS4).catch(() => {});
      return;
    }

    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== registryType) return;
      saveRevampApplicationIdForRegistry(registryType, app.id);
      return getRevampApplicationSections(app.id, auth!.token!).then(applyS4);
    }).catch(() => {});
  }, [auth?.token, registryType, renewalEdit?.applicationId]);

  function clearErr(key: string) {
    setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  }
  function handleSave() {
    const now = new Date();
    setSavedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  }

  async function handleSaveDraft() {
    if (!auth?.token) return;
    try {
      const appId = loadRevampFcrEditSession()?.applicationId ?? renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
      if (!appId) return;
      await saveRevampApplicationSection(appId, "S4", JSON.stringify({
        disponibilita, areeSpecifiche, tariffaGiorn, tariffaOra,
        areaTerrB, tariffaOraB,
        espCount: esperienze.length,
        committenti: esperienze.map(e => e.committente),
      }), false, auth.token);
      handleSave();
    } catch { /* best-effort */ }
  }

  function showToast(msg: string) {
    setUploadToast(msg);
    setTimeout(() => setUploadToast(null), 4000);
  }

  async function handleFileUpload(
    file: File,
    maxMB: number,
    setUploading: (v: boolean) => void,
    setResult: (v: AttachmentUploadResult) => void,
    clearErrKey?: string
  ) {
    if (!auth?.token) return;
    if (file.size > maxMB * 1024 * 1024) {
      showToast(`Il file è troppo grande. Massimo ${maxMB} MB.`);
      return;
    }
    let appId = loadRevampFcrEditSession()?.applicationId ?? renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
    if (!appId) {
      try {
        const draft = await createRevampApplicationDraft({ registryType, sourceChannel: "PUBLIC" }, auth.token);
        appId = draft.id;
        saveRevampApplicationIdForRegistry(registryType, appId);
      } catch {
        showToast("Impossibile avviare la domanda. Riprova.");
        return;
      }
    }
    setUploading(true);
    try {
      const result = await uploadRevampAttachment(appId, file, auth.token);
      setResult(result);
      if (clearErrKey) clearErr(clearErrKey);
    } catch {
      showToast("Caricamento file non riuscito. Riprova.");
    } finally {
      setUploading(false);
    }
  }

  function buildS4Payload() {
    const activeCv = cvAttachment ?? cvAttachmentB;
    const attachments = [];
    if (activeCv) attachments.push({ documentType: "CV", fileName: activeCv.fileName, storageKey: activeCv.storageKey, mimeType: activeCv.mimeType, sizeBytes: activeCv.sizeBytes });
    if (certAttachment) attachments.push({ documentType: "CERTIFICATION", fileName: certAttachment.fileName, storageKey: certAttachment.storageKey, mimeType: certAttachment.mimeType, sizeBytes: certAttachment.sizeBytes });
    return {
      disponibilita, areeSpecifiche, tariffaGiorn, tariffaOra,
      areaTerrB, tariffaOraB,
      espCount: esperienze.length,
      committenti: esperienze.map(e => e.committente),
      tipiIntervento: esperienze.map(e => e.tipoIntervento),
      periodi: esperienze.map(e => `${e.periodoFrom}-${e.periodoTo}`),
      cvName: activeCv?.fileName ?? null,
      certName: certAttachment?.fileName ?? null,
      operationalCapacity: isDocente ? (disponibilita || "disponibile") : (areaTerrB || "disponibile"),
      references: referenze,
      referenze,
      attachments,
    };
  }

  async function saveSectionProgrammatic() {
    if (!auth?.token) throw new Error("Sessione scaduta. Effettua nuovamente il login.");
    const appId = loadRevampFcrEditSession()?.applicationId ?? renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
    if (!appId) throw new Error("Candidatura non trovata.");
    await saveRevampApplicationSection(appId, "S4", JSON.stringify(buildS4Payload()), true, auth.token);
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (integrationEdit || renewalEdit) {
      if (renewalHasDocumentType("CV") && !(cvAttachment ?? cvAttachmentB)) e.cv = "Il Curriculum Vitae aggiornato e obbligatorio.";
      if (renewalHasDocumentType("CERTIFICATION") && !certAttachment) e.cert = "Il certificato aggiornato e obbligatorio.";
      return e;
    }
    if (isDocente) {
      if (!disponibilita) e.disponibilita = "Campo obbligatorio.";
      if (disponibilita === "si_aree" && !areeSpecifiche.trim()) e.areeSpecifiche = "Indica le aree specifiche.";
      for (let i = 0; i < esperienze.length; i++) {
        const esp = esperienze[i];
        if (!esp.committente.trim()) e[`esp_${i}_committente`]   = "Obbligatorio.";
        if (!esp.tipoIntervento)    e[`esp_${i}_tipoIntervento`] = "Obbligatorio.";
        if (!esp.ambitoTematico)    e[`esp_${i}_ambitoTematico`] = "Obbligatorio.";
        if (!esp.periodoFrom.trim())e[`esp_${i}_periodoFrom`]    = "Obbligatorio.";
        if (!esp.periodoTo.trim())  e[`esp_${i}_periodoTo`]      = "Obbligatorio.";
        if (!esp.durata.trim())     e[`esp_${i}_durata`]         = "Obbligatorio.";
        if (!esp.modalita)          e[`esp_${i}_modalita`]       = "Obbligatorio.";
        if (esp.finanziata === "si" && !esp.fondoProgramma.trim()) e[`esp_${i}_fondoProgramma`] = "Indica il fondo o il programma.";
      }
      if (!cvAttachment) e.cv = "Il Curriculum Vitae è obbligatorio.";
    } else {
      if (!areaTerrB.trim()) e.areaTerrB = "Campo obbligatorio.";
      if (!cvAttachmentB) e.cv = "Il Curriculum Vitae è obbligatorio.";
    }
    return e;
  }

  async function handleNext() {
    setSaveError(null);
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    handleSave();
    const activeCv = cvAttachment ?? cvAttachmentB;
    sessionStorage.setItem("revamp_s4", JSON.stringify({
      disponibilita, areeSpecifiche, tariffaGiorn, tariffaOra,
      areaTerrB, tariffaOraB,
      espCount: esperienze.length,
      committenti: esperienze.map(e => e.committente),
      tipiIntervento: esperienze.map(e => e.tipoIntervento),
      periodi: esperienze.map(e => `${e.periodoFrom}–${e.periodoTo}`),
      cvName: activeCv?.fileName ?? null,
      certName: certAttachment?.fileName ?? null,
    }));
    let savedAppId: string | null = null;
    if (auth?.token && isA) {
      try {
          const appId = loadRevampFcrEditSession()?.applicationId ?? renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
        if (appId) {
          savedAppId = appId;
          if (!isDocente) {
            const s3Raw = JSON.parse(sessionStorage.getItem("revamp_s3") ?? "{}") as Record<string, unknown>;
            const rawServizi = Array.isArray(s3Raw.servizi) ? (s3Raw.servizi as string[]) : [];
            const altroServ = typeof s3Raw.altroServ === "string" ? s3Raw.altroServ.trim() : "";
            const services = rawServizi.length > 0 ? rawServizi : (altroServ ? [altroServ] : []);
            const s3bPayload = {
              ...s3Raw,
              professionalOrder: s3Raw.ordine ?? "",
              highestTitle: s3Raw.titoloB ?? "",
              studyArea: s3Raw.ambitoB ?? "",
              experienceBand: s3Raw.anniEsp ?? "",
              services,
              hourlyRateRange: tariffaOraB || "Non indicata",
              territory: { regionsCsv: "", provincesCsv: areaTerrB },
            };
            await saveRevampApplicationSection(appId, "S3B", JSON.stringify(s3bPayload), true, auth.token);
          }
          const attachments = [];
          if (activeCv) attachments.push({ documentType: "CV", fileName: activeCv.fileName, storageKey: activeCv.storageKey, mimeType: activeCv.mimeType, sizeBytes: activeCv.sizeBytes });
          if (certAttachment) attachments.push({ documentType: "CERTIFICATION", fileName: certAttachment.fileName, storageKey: certAttachment.storageKey, mimeType: certAttachment.mimeType, sizeBytes: certAttachment.sizeBytes });
          const s4Payload = {
            ...JSON.parse(sessionStorage.getItem("revamp_s4") ?? "{}"),
            operationalCapacity: isDocente ? (disponibilita || "disponibile") : (areaTerrB || "disponibile"),
            attachments,
          };
          await saveRevampApplicationSection(appId, "S4", JSON.stringify(s4Payload), true, auth.token);
        }
      } catch {
        setSaveError("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    } else if (auth?.token && !isA) {
      try {
        const appId = loadRevampFcrEditSession()?.applicationId ?? renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
        if (appId) {
          savedAppId = appId;
          await saveRevampApplicationSection(appId, "S4", sessionStorage.getItem("revamp_s4") ?? "{}", true, auth.token);
        }
      } catch {
        setSaveError("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    if (integrationEdit && auth?.token && savedAppId) {
      try {
        await completeRevampIntegrationEdit(savedAppId, auth.token, integrationEdit);
        clearRevampIntegrationEditSession();
      } catch {
        setSaveError("Invio integrazione non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    if (renewalEdit && auth?.token && savedAppId) {
      requestRevampDocumentRenewalDrawerReopen(savedAppId, renewalEdit.batchId);
      clearRevampDocumentRenewalEditSession();
    }
    navigate(integrationEdit?.returnPath ?? renewalEdit?.returnPath ?? `/apply/${registryParam}/step/5`);
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>
      {uploadToast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: "#1f2937", color: "#fff", padding: "10px 16px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", maxWidth: 320 }}>
          {uploadToast}
        </div>
      )}
      <PageHeader title={title} subtitle={subtitle} savedAt={savedAt} onSave={() => void handleSaveDraft()} />
      {integrationEdit || renewalEdit || fcr.active ? (
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "12px 40px", color: "#174f82", fontSize: "0.86rem", fontWeight: 700 }}>
          {renewalEdit ? `Rinnovo documento - Aggiorna solo ${renewalEdit.documentLabel}, poi salva e invia.` : fcr.active ? "Richiesta di modifica - Aggiorna solo il gruppo sbloccato, poi salva e invia." : "Integrazione richiesta - Correggi questa sezione, salva e invia la risposta."}
        </div>
      ) : (
        <StepBar active={3} accent={accent} />
      )}

      <div style={{ maxWidth: 980, margin: "20px auto", padding: "0 20px 100px" }}>

        {/* ══════════════════════════════════════════
            SEZIONE 3A: C + D + E + F
        ══════════════════════════════════════════ */}
        {isDocente && (
          <>
            {/* C — Disponibilità, Territorio e Condizioni Operative */}
            <SectionCard title="C — Disponibilità, Territorio e Condizioni Operative" accent={accent}>
              <div style={{ maxWidth: 480, marginBottom: 14 }}>
                <Select label="Disponibilità a trasferte fuori area" required value={disponibilita}
                  onChange={e => { setDisponibilita(e.target.value); clearErr("disponibilita"); }}
                  options={[
                    { value: "si",          label: "Sì, senza limitazioni (con rimborso spese concordato)" },
                    { value: "si_aree",     label: "Sì, solo in aree specifiche (indicare)" },
                    { value: "lunga_dur",   label: "Solo per progetti di lunga durata (>5 giornate)" },
                    { value: "no",          label: "No" },
                  ]}
                  error={errors.disponibilita} />
              </div>
              {disponibilita === "si_aree" && (
                <div style={{ marginBottom: 14 }}>
                  <Field label="Aree geografiche disponibili" required value={areeSpecifiche}
                    onChange={e => { setAreeSpecifiche(e.target.value); clearErr("areeSpecifiche"); }}
                    placeholder="Es. Lombardia, Piemonte, Liguria..." error={errors.areeSpecifiche} />
                </div>
              )}
              <p style={{ fontSize: "0.8rem", color: MUTED, margin: "0 0 12px" }}>
                Le tariffe sono riservate e visibili solo agli operatori back-end con accesso completo. Non vengono pubblicate nel profilo pubblico.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Tariffa giornaliera (8h) indicativa" hint="opzionale"
                  value={tariffaGiorn} onChange={e => setTariffaGiorn(e.target.value)}
                  placeholder="Es. 300–400 €/giornata" />
                <Field label="Tariffa oraria indicativa" hint="opzionale"
                  value={tariffaOra} onChange={e => setTariffaOra(e.target.value)}
                  placeholder="Es. 50–70 €/ora" />
              </div>
            </SectionCard>

            {/* D — Esperienze formative */}
            <SectionCard title="D — Esperienze formative" accent={accent}
              badge="fino a 5 esperienze, ultimi 5 anni"
              desc="Inserisci le principali esperienze di docenza e formazione degli ultimi 5 anni. Inizia con la più recente.">
              {esperienze.map((esp, idx) => (
                <div key={idx} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "18px 20px", marginBottom: 14, background: "#fafafa", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: accent }}>Esperienza {idx + 1}</div>
                    {esperienze.length > 1 && (
                      <button type="button" onClick={() => removeEsp(idx)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid #fca5a5", background: "#fff5f5", borderRadius: 5, fontSize: "0.75rem", color: "#b91c1c", cursor: "pointer", fontWeight: 600 }}>
                        <Trash2 size={12} /> Rimuovi
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <Field label="Committente / Organizzazione" required value={esp.committente}
                      onChange={e => updateEsp(idx, "committente", e.target.value)}
                      placeholder="Es. Regione Lombardia, FIAT S.p.A."
                      error={errors[`esp_${idx}_committente`]} />
                    <Select label="Settore del committente" hint="opzionale" value={esp.settore}
                      onChange={e => updateEsp(idx, "settore", e.target.value)}
                      options={SETTORI_COMMITTENTE} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <Select label="Tipo di intervento" required value={esp.tipoIntervento}
                      onChange={e => updateEsp(idx, "tipoIntervento", e.target.value)}
                      options={TIPO_INTERVENTO}
                      error={errors[`esp_${idx}_tipoIntervento`]} />
                    <Field label="Titolo / descrizione del corso o intervento" hint="opzionale" value={esp.tipoIntTesto}
                      onChange={e => updateEsp(idx, "tipoIntTesto", e.target.value)}
                      placeholder="Es. Corso Excel avanzato per HR" />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Select label="Ambito tematico principale" required value={esp.ambitoTematico}
                      onChange={e => updateEsp(idx, "ambitoTematico", e.target.value)}
                      options={AREE_TEMATICHE.map(a => ({ value: a.id, label: a.label }))}
                      error={errors[`esp_${idx}_ambitoTematico`]} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <Field label="Periodo — da (MM/AAAA)" required value={esp.periodoFrom}
                      onChange={e => updateEsp(idx, "periodoFrom", e.target.value)}
                      placeholder="01/2023" error={errors[`esp_${idx}_periodoFrom`]} />
                    <Field label="Periodo — a (MM/AAAA)" required value={esp.periodoTo}
                      onChange={e => updateEsp(idx, "periodoTo", e.target.value)}
                      placeholder="06/2023" error={errors[`esp_${idx}_periodoTo`]} />
                    <Field label="Durata totale" required value={esp.durata}
                      onChange={e => updateEsp(idx, "durata", e.target.value)}
                      placeholder="Es. 24 ore / 3 giornate" error={errors[`esp_${idx}_durata`]} />
                    <Field label="N. partecipanti (indicativo)" hint="opz." value={esp.nPartecipanti}
                      onChange={e => updateEsp(idx, "nPartecipanti", e.target.value)}
                      placeholder="Es. 15" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <Select label="Modalità di erogazione" required value={esp.modalita}
                      onChange={e => updateEsp(idx, "modalita", e.target.value)}
                      options={MODALITA_EROGAZIONE}
                      error={errors[`esp_${idx}_modalita`]} />
                    <Select label="Finanziata (FSE, fondi, ecc.)" hint="opzionale" value={esp.finanziata}
                      onChange={e => updateEsp(idx, "finanziata", e.target.value)}
                      options={[{ value: "si", label: "Sì" }, { value: "no", label: "No" }]} />
                    {esp.finanziata === "si" && (
                      <Field label="Fondo o programma" required value={esp.fondoProgramma}
                        onChange={e => updateEsp(idx, "fondoProgramma", e.target.value)}
                        placeholder="Es. FSE+ 2021–27, FON.TER"
                        error={errors[`esp_${idx}_fondoProgramma`]} />
                    )}
                  </div>
                </div>
              ))}

              {esperienze.length < 5 && (
                <button type="button" onClick={addEsp} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#fff", border: `1.5px dashed ${accent}`, borderRadius: 6, color: accent, fontSize: "0.83rem", fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> Aggiungi un'altra esperienza ({esperienze.length}/5)
                </button>
              )}
            </SectionCard>

            {/* E — Referenze */}
            <SectionCard title="E — Referenze" accent={accent}
              badge="fino a 2 — opzionale"
              desc="Indica persone che possono attestare la tua collaborazione. Le informazioni di contatto sono riservate.">
              {referenze.map((ref, idx) => (
                <div key={idx} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 18px", marginBottom: 12, background: "#fafafa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: accent }}>Referente {idx + 1}</div>
                    <button type="button" onClick={() => removeRef(idx)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid #fca5a5", background: "#fff5f5", borderRadius: 5, fontSize: "0.75rem", color: "#b91c1c", cursor: "pointer", fontWeight: 600 }}>
                      <Trash2 size={12} /> Rimuovi
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <Field label="Nome e Cognome" value={ref.nome}
                      onChange={e => updateRef(idx, "nome", e.target.value)} placeholder="Mario Bianchi" />
                    <Field label="Ruolo e Organizzazione" value={ref.ruolo}
                      onChange={e => updateRef(idx, "ruolo", e.target.value)} placeholder="Responsabile HR, Azienda XYZ" />
                    <Field label="E-mail o telefono" value={ref.contatto}
                      onChange={e => updateRef(idx, "contatto", e.target.value)} placeholder="m.bianchi@azienda.it" />
                  </div>
                </div>
              ))}
              {referenze.length < 2 && (
                <button type="button" onClick={addRef} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#fff", border: `1.5px dashed ${accent}`, borderRadius: 6, color: accent, fontSize: "0.83rem", fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> Aggiungi un referente ({referenze.length}/2)
                </button>
              )}
            </SectionCard>

            {/* F — Allegati */}
            <SectionCard title="F — Allegati" accent={accent}
              desc="Carica il tuo Curriculum Vitae aggiornato (obbligatorio) e, se disponibili, le certificazioni rilevanti.">
              {errors.cv && (
                <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "9px 12px", marginBottom: 12, fontSize: "0.82rem", color: "#b91c1c" }}>⚠ {errors.cv}</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <FileUpload label="Curriculum Vitae aggiornato" required hint="PDF max 5 MB" tooltip="deve includere le principali esperienze di docenza"
                  uploading={cvUploading} result={cvAttachment}
                  disabled={Boolean(renewalEdit && !renewalHasDocumentType("CV"))}
                  onSelect={f => void handleFileUpload(f, 5, setCvUploading, setCvAttachment, "cv")} />
                <FileUpload label="Certificazioni e attestati" hint="opzionale — PDF max 5 MB"
                  uploading={certUploading} result={certAttachment}
                  disabled={Boolean(renewalEdit && !renewalHasDocumentType("CERTIFICATION"))}
                  onSelect={f => void handleFileUpload(f, 5, setCertUploading, setCertAttachment)} />
              </div>
            </SectionCard>
          </>
        )}

        {/* ══════════════════════════════════════════
            SEZIONE 3B: DISPONIBILITÀ E CV
        ══════════════════════════════════════════ */}
        {!isDocente && (
          <>
            <SectionCard title="Disponibilità e Territorio" accent={accent}
              desc="Indica le province o le aree geografiche in cui operi abitualmente e quelle in cui sei disponibile a operare.">
              <div style={{ marginBottom: 14 }}>
                <Textarea label="Area territoriale di attività (province)" required
                  value={areaTerrB} onChange={e => { setAreaTerrB(e.target.value); clearErr("areaTerrB"); }}
                  placeholder="Es. MI, TO, GE — oppure: Lombardia, Piemonte, Liguria, tutta Italia"
                  error={errors.areaTerrB} rows={2} />
              </div>
              <div style={{ maxWidth: 280 }}>
                <Field label="Tariffa oraria indicativa (€)" hint="riservata — opzionale"
                  value={tariffaOraB} onChange={e => setTariffaOraB(e.target.value)}
                  placeholder="Es. 80–100 €/ora" />
              </div>
            </SectionCard>

            <SectionCard title="Curriculum Vitae" accent={accent}>
              {errors.cv && (
                <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "9px 12px", marginBottom: 12, fontSize: "0.82rem", color: "#b91c1c" }}>⚠ {errors.cv}</div>
              )}
              <FileUpload label="Curriculum Vitae aggiornato" required hint="PDF max 5 MB"
                uploading={cvUploadingB} result={cvAttachmentB}
                disabled={Boolean(renewalEdit && !renewalHasDocumentType("CV"))}
                onSelect={f => void handleFileUpload(f, 5, setCvUploadingB, setCvAttachmentB, "cv")} />
            </SectionCard>
          </>
        )}

        {/* ── Error summary ── */}
        {errorCount > 0 && (
          <div style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 6, padding: "12px 16px" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#92400e" }}>
              ⚠ {errorCount} {errorCount === 1 ? "campo richiede attenzione" : "campi richiedono attenzione"}
            </div>
          </div>
        )}
        {saveError ? (
          <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "12px 16px", fontSize: "0.82rem", color: "#b91c1c" }}>
            {saveError}
          </div>
        ) : null}
      </div>

      {/* ── Bottom nav ── */}
      {!fcr.active && <div className="wizard-bottom-nav" style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 36px", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Link className="wizard-nav-button wizard-nav-button-prev" to={integrationEdit?.returnPath ?? renewalEdit?.returnPath ?? `/apply/${registryParam}/step/3`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${accent}`, borderRadius: 6, fontWeight: 600, fontSize: "0.84rem", color: accent, textDecoration: "none" }}>
          <ArrowLeft size={14} /> {integrationEdit || renewalEdit ? "Torna alla richiesta" : "Sezione precedente"}
        </Link>
        {integrationEdit || renewalEdit ? (
          <div style={{ fontSize: "0.82rem", color: MUTED, fontWeight: 700 }}>{renewalEdit ? "Modalita rinnovo documento" : "Modalita integrazione"}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: "0.77rem", color: MUTED }}>Avanzamento: <strong>80%</strong></span>
            <div style={{ width: 180, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "80%", height: "100%", background: accent, borderRadius: 2 }} />
            </div>
          </div>
        )}
        <button className="wizard-nav-button wizard-nav-button-next" type="button" onClick={handleNext} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: accent, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.84rem", cursor: "pointer" }}>
          {renewalEdit ? "Salva e invia documento" : integrationEdit ? "Salva e invia integrazione" : "Sezione successiva"} <ArrowRight size={14} />
        </button>
      </div>}
      {auth && <FcrSubmitBar fcr={fcr} token={auth.token!} onSectionSaved={saveSectionProgrammatic} />}
    </div>
  );
}
