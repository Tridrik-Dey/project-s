import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, Info, Lock, Save, Upload } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  createRevampApplicationDraft,
  getMyLatestRevampApplication,
  getRevampApplicationSections,
  saveRevampApplicationSection,
  uploadRevampAttachment,
  type AttachmentUploadResult
} from "../../api/revampApplicationApi";
import { loadRevampApplicationIdForRegistry, saveRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";
import { clearRevampIntegrationEditSession, integrationEditHasAnyCode, isRevampIntegrationEditFor } from "../../utils/revampIntegrationEditSession";
import { completeRevampIntegrationEdit } from "../../utils/revampIntegrationCompletion";
import { clearRevampDocumentRenewalEditSession, isRevampDocumentRenewalEditFor, requestRevampDocumentRenewalDrawerReopen } from "../../utils/revampDocumentRenewalEditSession";

const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR = "#dc2626";
const STEPS_B = ["Dati aziendali", "Struttura", "Servizi", "Certificazioni", "Dichiarazioni"];

type CertRecord = {
  presente: "si" | "no" | "";
  enteCertificatore: string;
  scadenza: string;
  fileName: string;
  attachment?: AttachmentUploadResult | null;
};
type AttachmentDocumentType = "VISURA_CAMERALE" | "DURC" | "COMPANY_PROFILE" | "CERTIFICATION";

const CERTS_ISO: { key: string; label: string; desc: string }[] = [
  { key: "iso9001",  label: "ISO 9001 — Qualità", desc: "Sistema di gestione per la qualità" },
  { key: "iso14001", label: "ISO 14001 — Ambiente", desc: "Sistema di gestione ambientale" },
  { key: "iso45001", label: "ISO 45001 / OHSAS 18001 — Salute e Sicurezza", desc: "Salute e sicurezza sul lavoro" },
  { key: "sa8000",   label: "SA8000 — Responsabilità Sociale", desc: "Responsabilità sociale d'impresa" },
  { key: "iso27001", label: "ISO 27001 — Sicurezza delle informazioni", desc: "Rilevante per fornitori di servizi IT" },
];

const MY_RE = /^(0[1-9]|1[0-2])\/\d{4}$/;

function isNotPastMonth(s: string): boolean {
  if (!MY_RE.test(s)) return false;
  const [mm, yyyy] = s.split("/").map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return yyyy > currentYear || (yyyy === currentYear && mm >= currentMonth);
}

function validateScadenzaField(val: string): string {
  if (!val.trim()) return "Inserisci la scadenza.";
  if (!MY_RE.test(val.trim())) return "Formato MM/AAAA non valido.";
  if (!isNotPastMonth(val.trim())) return "La scadenza non può essere nel passato.";
  return "";
}

const col: React.CSSProperties    = { display: "flex", flexDirection: "column", gap: 4 };
const lbl: React.CSSProperties    = { fontSize: "0.78rem", fontWeight: 600, color: "#374151" };
const errTxt: React.CSSProperties = { fontSize: "0.74rem", color: ERR };
const baseInput = (error?: boolean, disabled?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 12px", fontSize: "0.88rem",
  border: `1.5px solid ${error ? ERR : disabled ? "#cbd5e1" : "#d1d5db"}`,
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
  color: disabled ? "#64748b" : "#111827",
  background: disabled ? "#f1f5f9" : "#fff",
  cursor: disabled ? "not-allowed" : "text",
});

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: GREEN, letterSpacing: "0.06em",
      textTransform: "uppercase", margin: "20px 0 12px", borderLeft: `3px solid ${GREEN}`, paddingLeft: 8 }}>
      {label}
    </div>
  );
}

function StepBar({ active }: { active: number }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 40px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{ position: "absolute", top: 17, left: "10%", right: "10%", height: 2, background: "#e5e7eb", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 17, left: "10%", width: `${(active / (STEPS_B.length - 1)) * 80}%`, height: 2, background: GREEN, zIndex: 0, transition: "width .3s" }} />
        {STEPS_B.map((step, i) => {
          const done = i < active; const isActive = i === active;
          return (
            <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 1 }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: done || isActive ? GREEN : "#fff", border: `2px solid ${done || isActive ? GREEN : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: done || isActive ? "#fff" : "#9ca3af" }}>{i + 1}</span>
              <span style={{ fontSize: "0.72rem", color: isActive ? GREEN : done ? GREEN : "#9ca3af", fontWeight: isActive || done ? 600 : 400, textAlign: "center" }}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileInput({ label, required, fileName, onChange, hintText, tooltip, uploading, disabled }: {
  label: string; required?: boolean; fileName: string; hintText?: string; tooltip?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
  disabled?: boolean;
}) {
  const [showTip, setShowTip] = useState(false);
  const isBlocked = Boolean(disabled && !uploading);
  return (
    <div style={col}>
      <span style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}>
        {label}{required ? <span style={{ color: ERR }}> *</span> : null}
        {hintText ? <span style={{ fontWeight: 400, color: MUTED }}> — {hintText}</span> : null}
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
      </span>
      <label style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        border: `1.5px ${isBlocked ? "solid" : "dashed"} ${isBlocked ? "#cbd5e1" : fileName ? GREEN : "#d1d5db"}`,
        borderRadius: 6,
        cursor: isBlocked ? "not-allowed" : uploading ? "wait" : "pointer",
        background: isBlocked ? "#f1f5f9" : fileName ? "#f0fdf4" : "#fafafa",
        transition: "border-color .15s",
        opacity: uploading ? 0.7 : 1
      }}>
        {isBlocked ? <Lock size={14} color="#64748b" /> : <Upload size={14} color={fileName ? GREEN : "#9ca3af"} />}
        <span style={{ fontSize: "0.83rem", color: isBlocked ? "#64748b" : fileName ? GREEN : "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isBlocked ? 700 : 400 }}>
          {uploading ? "Caricamento in corso..." : isBlocked ? "Bloccato in questa richiesta" : (fileName || "Seleziona file PDF (max 5 MB)")}
        </span>
        <input type="file" accept=".pdf" onChange={onChange} disabled={uploading || disabled} style={{ display: "none" }} />
      </label>
    </div>
  );
}

export function RevampAlboBStep4CertificazioniPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const integrationEdit = isRevampIntegrationEditFor("ALBO_B", 4);
  const renewalEdit = isRevampDocumentRenewalEditFor("ALBO_B", 4);
  const lockedEdit = Boolean(integrationEdit || renewalEdit);
  const renewalDocs = (renewalEdit?.documents ?? (renewalEdit ? [renewalEdit] : []));
  const renewalHasDocumentType = (documentType: string) => renewalDocs.some(item => item.documentType === documentType);
  const requestedRenewalCertKeys = renewalDocs
    .filter(item => item.documentType === "CERTIFICATION" && item.certificationKey)
    .map(item => item.certificationKey as string);
  const allowVisura = !lockedEdit || integrationEditHasAnyCode(integrationEdit, ["VISURA_CAMERALE"]) || renewalHasDocumentType("VISURA_CAMERALE");
  const allowDurc = !lockedEdit || integrationEditHasAnyCode(integrationEdit, ["DURC"]) || renewalHasDocumentType("DURC");
  const allowCompanyProfile = !lockedEdit || integrationEditHasAnyCode(integrationEdit, ["COMPANY_PROFILE"]) || renewalHasDocumentType("COMPANY_PROFILE");
  const allowCertAttachments = !lockedEdit || integrationEditHasAnyCode(integrationEdit, [
    "CERT_ISO_9001",
    "CERT_ISO_14001",
    "CERT_ISO_45001",
    "CERT_SA8000",
    "CERTIFICATIONS_ACCREDITATIONS"
  ]) || renewalHasDocumentType("CERTIFICATION");
  const allowCertificationKey = (key: string) => {
    if (!lockedEdit) return true;
    if (integrationEdit) return allowCertAttachments;
    if (!allowCertAttachments) return false;
    return requestedRenewalCertKeys.length === 0 || requestedRenewalCertKeys.includes(key);
  };
  const allowGenericCertAttachment = !renewalEdit || requestedRenewalCertKeys.length === 0;

  const [certs, setCerts] = useState<Record<string, CertRecord>>(
    Object.fromEntries(CERTS_ISO.map(c => [c.key, { presente: "", enteCertificatore: "", scadenza: "", fileName: "" }]))
  );
  const [altreCert,    setAltreCert]    = useState("");
  const [accFormazione, setAccFormazione] = useState<"si" | "no" | "">("");
  const [accRegioni,   setAccRegioni]   = useState("");
  const [accTipo,      setAccTipo]      = useState("");
  const [accLavoro,    setAccLavoro]    = useState<"si" | "no" | "">("");

  // Allegati
  const [visura,         setVisura]         = useState("");
  const [visuraScadenza, setVisuraScadenza] = useState("");
  const [companyProf,    setCompanyProf]    = useState("");
  const [durc,           setDurc]           = useState("");
  const [durcScadenza,   setDurcScadenza]   = useState("");
  const [certAlleg,   setCertAlleg]   = useState("");
  const [visuraAttachment, setVisuraAttachment] = useState<AttachmentUploadResult | null>(null);
  const [companyProfAttachment, setCompanyProfAttachment] = useState<AttachmentUploadResult | null>(null);
  const [durcAttachment, setDurcAttachment] = useState<AttachmentUploadResult | null>(null);
  const [certAllegAttachment, setCertAllegAttachment] = useState<AttachmentUploadResult | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const [triedSubmit,   setTriedSubmit]   = useState(false);
  const [manualErrors,  setManualErrors]  = useState<Record<string, string>>({});
  const [savedAt,       setSavedAt]       = useState<string | null>(null);
  const [uploadError,   setUploadError]   = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;

    function applyS4(sections: { sectionKey: string; sectionVersion: number; payloadJson: string }[]) {
      const latest = sections
        .filter(s => s.sectionKey === "S4")
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const s4 = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      const certData = s4.certificazioni as Record<string, CertRecord> | undefined;
      if (certData) {
        setCerts(prev => {
          const n = { ...prev };
          for (const key of Object.keys(certData)) {
            if (n[key]) n[key] = { ...n[key], ...certData[key] };
          }
          return n;
        });
      }
      if (s4.altreCertificazioni !== undefined) setAltreCert(s4.altreCertificazioni as string);
      if (s4.accreditamentoFormazione)          setAccFormazione(s4.accreditamentoFormazione as "si" | "no");
      if (s4.accreditamentoRegioni)             setAccRegioni(s4.accreditamentoRegioni as string);
      if (s4.accreditamentoTipoFormazione)      setAccTipo(s4.accreditamentoTipoFormazione as string);
      if (s4.accreditamentoServiziLavoro)       setAccLavoro(s4.accreditamentoServiziLavoro as "si" | "no");
      if (Array.isArray(s4.attachments)) {
        type AttMeta = {
          documentType: string;
          fileName: string;
          storageKey: string;
          mimeType: string;
          sizeBytes: number;
          scadenza?: string;
          certificationKey?: string;
        };
        for (const att of s4.attachments as AttMeta[]) {
          if (!att.fileName || !att.storageKey || att.storageKey === "upload-pending") continue;
          const result: AttachmentUploadResult = {
            fileName: att.fileName,
            storageKey: att.storageKey,
            mimeType: att.mimeType,
            sizeBytes: att.sizeBytes
          };
          if (att.documentType === "VISURA_CAMERALE") {
            setVisura(att.fileName);
            setVisuraAttachment(result);
            if (att.scadenza) setVisuraScadenza(att.scadenza);
          } else if (att.documentType === "DURC") {
            setDurc(att.fileName);
            setDurcAttachment(result);
            if (att.scadenza) setDurcScadenza(att.scadenza);
          } else if (att.documentType === "COMPANY_PROFILE") {
            setCompanyProf(att.fileName);
            setCompanyProfAttachment(result);
          } else if (att.documentType === "CERTIFICATION") {
            if (att.certificationKey && CERTS_ISO.some(c => c.key === att.certificationKey)) {
              setCerts(prev => ({
                ...prev,
                [att.certificationKey!]: {
                  ...prev[att.certificationKey!],
                  fileName: att.fileName,
                  attachment: result
                }
              }));
            } else {
              setCertAlleg(att.fileName);
              setCertAllegAttachment(result);
            }
          }
        }
      }
    }

    const existingAppId = renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry("ALBO_B");
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS4).catch(() => {});
      return;
    }

    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== "ALBO_B") return;
      saveRevampApplicationIdForRegistry("ALBO_B", app.id);
      return getRevampApplicationSections(app.id, auth!.token!).then(applyS4);
    }).catch(() => {});
  }, [auth?.token, renewalEdit?.applicationId]);

  function updateCert(key: string, field: keyof CertRecord, value: string) {
    setCerts(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function updateCertPresence(key: string, value: "si" | "no") {
    setCerts(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        presente: value,
        ...(value === "no"
          ? { enteCertificatore: "", scadenza: "", fileName: "", attachment: null }
          : {})
      }
    }));
  }

  function updateCertAttachment(key: string, result: AttachmentUploadResult) {
    setCerts(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        fileName: result.fileName,
        attachment: result
      }
    }));
  }

  async function ensureApplicationId(): Promise<string | null> {
    if (!auth?.token) return null;
    const existing = renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry("ALBO_B");
    if (existing) return existing;
    try {
      const draft = await createRevampApplicationDraft({ registryType: "ALBO_B", sourceChannel: "PUBLIC" }, auth.token);
      saveRevampApplicationIdForRegistry("ALBO_B", draft.id);
      return draft.id;
    } catch {
      setUploadError("Impossibile avviare la domanda. Riprova.");
      return null;
    }
  }

  function handleFile(
    documentType: AttachmentDocumentType,
    setName: (name: string) => void,
    setAttachment: (result: AttachmentUploadResult) => void,
    maxMB: number
  ) {
    return async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !auth?.token) return;
      if (file.size > maxMB * 1024 * 1024) {
        setUploadError(`Il file è troppo grande. Massimo ${maxMB} MB.`);
        e.target.value = "";
        return;
      }
      const appId = await ensureApplicationId();
      if (!appId) return;
      setUploadingField(documentType);
      setUploadError(null);
      try {
        const result = await uploadRevampAttachment(appId, file, auth.token);
        setName(result.fileName || file.name);
        setAttachment(result);
      } catch {
        setUploadError("Caricamento file non riuscito. Riprova.");
        e.target.value = "";
      } finally {
        setUploadingField(null);
      }
    };
  }

  function handleCertificationFile(certKey: string) {
    return async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !auth?.token) return;
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("Il file è troppo grande. Massimo 5 MB.");
        e.target.value = "";
        return;
      }
      const appId = await ensureApplicationId();
      if (!appId) return;
      const uploadKey = `CERTIFICATION:${certKey}`;
      setUploadingField(uploadKey);
      setUploadError(null);
      try {
        const result = await uploadRevampAttachment(appId, file, auth.token);
        updateCertAttachment(certKey, result);
      } catch {
        setUploadError("Caricamento file non riuscito. Riprova.");
        e.target.value = "";
      } finally {
        setUploadingField(null);
      }
    };
  }

  function buildAttachments() {
    const attachments: Array<AttachmentUploadResult & {
      documentType: AttachmentDocumentType;
      scadenza?: string;
      certificationKey?: string;
      certificationLabel?: string;
    }> = [];
    if (visuraAttachment) attachments.push({ documentType: "VISURA_CAMERALE", scadenza: visuraScadenza || undefined, ...visuraAttachment });
    if (durcAttachment) attachments.push({ documentType: "DURC", scadenza: durcScadenza || undefined, ...durcAttachment });
    if (companyProfAttachment) attachments.push({ documentType: "COMPANY_PROFILE", ...companyProfAttachment });
    for (const cert of CERTS_ISO) {
      const certRecord = certs[cert.key];
      const attachment = certRecord?.attachment;
      if (attachment && certRecord?.presente !== "no") {
        attachments.push({
          documentType: "CERTIFICATION",
          certificationKey: cert.key,
          certificationLabel: cert.label,
          scadenza: certRecord.scadenza || undefined,
          ...attachment
        });
      }
    }
    if (certAllegAttachment) attachments.push({ documentType: "CERTIFICATION", ...certAllegAttachment });
    return attachments;
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (integrationEdit || renewalEdit) {
      if (allowVisura) {
        if (!visuraAttachment) e.visura = "La visura camerale è obbligatoria.";
        if (visuraAttachment && !visuraScadenza.trim()) e.visuraScadenza = "Inserisci la scadenza della visura.";
      }
      if (allowDurc) {
        if (!durcAttachment) e.durc = "Il DURC è obbligatorio.";
        if (durcAttachment && !durcScadenza.trim()) e.durcScadenza = "Inserisci la scadenza del DURC.";
      }
      if (allowCompanyProfile && !companyProfAttachment) e.companyProf = "Carica il company profile richiesto.";
      if (allowCertAttachments) {
        const requestedCertKeys = renewalDocs.map(item => item.certificationKey).filter((key): key is string => Boolean(key));
        if (renewalEdit && requestedCertKeys.length > 0) {
          for (const key of requestedCertKeys) {
            const rec = certs[key];
            if (!rec?.presente) {
              e[`cert_${key}`] = "Indica se vuoi mantenere questa certificazione.";
              continue;
            }
            if (rec.presente === "si") {
              if (!rec.enteCertificatore.trim()) e[`cert_${key}_ente`] = "Inserisci l'ente certificatore.";
              if (!rec.scadenza.trim()) { e[`cert_${key}_scad`] = "Inserisci la scadenza."; }
              else if (!MY_RE.test(rec.scadenza.trim())) { e[`cert_${key}_scad`] = "Formato MM/AAAA non valido."; }
              else if (!isNotPastMonth(rec.scadenza.trim())) { e[`cert_${key}_scad`] = "La scadenza non puÃ² essere nel passato."; }
              if (!rec.attachment) e[`cert_${key}_file`] = "Allega il certificato PDF.";
            }
          }
        } else {
          const hasRequestedCert = Boolean(certAllegAttachment) || CERTS_ISO.some((cert) => certs[cert.key]?.attachment);
          if (!hasRequestedCert) e.certAlleg = "Carica il certificato richiesto.";
        }
      }
      return e;
    }
    for (const c of CERTS_ISO) {
      const rec = certs[c.key];
      if (!rec.presente) e[`cert_${c.key}`] = "Indica se possiedi questa certificazione.";
      if (rec.presente === "si") {
        if (!rec.enteCertificatore.trim()) e[`cert_${c.key}_ente`] = "Inserisci l'ente certificatore.";
        if (!rec.scadenza.trim()) { e[`cert_${c.key}_scad`] = "Inserisci la scadenza."; }
        else if (!MY_RE.test(rec.scadenza.trim())) { e[`cert_${c.key}_scad`] = "Formato MM/AAAA non valido."; }
        else if (!isNotPastMonth(rec.scadenza.trim())) { e[`cert_${c.key}_scad`] = "La scadenza non può essere nel passato."; }
        if (!rec.attachment) e[`cert_${c.key}_file`] = "Allega il certificato PDF.";
      }
    }
    if (!accFormazione) e.accFormazione = "Campo obbligatorio.";
    if (!accLavoro)     e.accLavoro     = "Campo obbligatorio.";
    if (!visuraAttachment)  e.visura = "La visura camerale è obbligatoria.";
    if (visuraAttachment) {
      if (!visuraScadenza.trim()) e.visuraScadenza = "Inserisci la scadenza della visura.";
      else if (!MY_RE.test(visuraScadenza.trim())) e.visuraScadenza = "Formato MM/AAAA non valido.";
      else if (!isNotPastMonth(visuraScadenza.trim())) e.visuraScadenza = "La scadenza non può essere nel passato.";
    }
    if (!durcAttachment)    e.durc   = "Il DURC è obbligatorio.";
    if (durcAttachment) {
      if (!durcScadenza.trim()) e.durcScadenza = "Inserisci la scadenza del DURC.";
      else if (!MY_RE.test(durcScadenza.trim())) e.durcScadenza = "Formato MM/AAAA non valido.";
      else if (!isNotPastMonth(durcScadenza.trim())) e.durcScadenza = "La scadenza non può essere nel passato.";
    }
    if ((altreCert.trim().length > 0 || accFormazione === "si" || accLavoro === "si") && !certAllegAttachment) {
      e.certAlleg = "Allega i certificati o accreditamenti dichiarati.";
    }
    return e;
  }

  function handleSave() {
    const now = new Date();
    setSavedAt(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
  }

  async function handleSaveDraft() {
    if (!auth?.token) return;
    try {
      const appId = renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry("ALBO_B");
      if (!appId) return;
      await saveRevampApplicationSection(appId, "S4", JSON.stringify({
        certificazioni: Object.fromEntries(CERTS_ISO.map(c => [c.key, { ...certs[c.key] }])),
        altreCertificazioni: altreCert,
        accreditamentoFormazione: accFormazione,
        accreditamentoRegioni: accRegioni,
        accreditamentoTipoFormazione: accTipo,
        accreditamentoServiziLavoro: accLavoro,
        allegati: { visura, companyProfile: companyProf, durc, certificatiAllegati: certAlleg },
        attachments: buildAttachments(),
      }), false, auth.token);
      handleSave();
    } catch { /* best-effort */ }
  }

  async function handleNext() {
    setTriedSubmit(true);
    const errs = validate();
    if (Object.keys(errs).length) return;
    handleSave();
    const payload = {
      certificazioni: Object.fromEntries(CERTS_ISO.map(c => [c.key, { ...certs[c.key] }])),
      altreCertificazioni: altreCert,
      accreditamentoFormazione: accFormazione,
      accreditamentoRegioni: accRegioni,
      accreditamentoTipoFormazione: accTipo,
      accreditamentoServiziLavoro: accLavoro,
      allegati: { visura, companyProfile: companyProf, durc, certificatiAllegati: certAlleg },
    };
    sessionStorage.setItem("revamp_b4", JSON.stringify(payload));
    let savedAppId: string | null = null;
    if (auth?.token) {
      try {
        const appId = renewalEdit?.applicationId ?? loadRevampApplicationIdForRegistry("ALBO_B");
        if (appId) {
          savedAppId = appId;
          const hasISO9001 = certs.iso9001?.presente === "si";
          const apiPayload = {
            ...payload,
            iso9001:              hasISO9001 ? "YES" : "NO",
            accreditationSummary: accFormazione === "si" ? (accTipo || "Accreditato") : "",
            accreditationTraining: accFormazione,
            employmentServicesAccreditation: accLavoro,
            attachments: buildAttachments(),
          };
          await saveRevampApplicationSection(appId, "S4", JSON.stringify(apiPayload), true, auth.token);
        }
      } catch {
        window.alert("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    if (integrationEdit && auth?.token && savedAppId) {
      try {
        await completeRevampIntegrationEdit(savedAppId, auth.token, integrationEdit);
        clearRevampIntegrationEditSession();
      } catch {
        window.alert("Invio integrazione non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    if (renewalEdit && auth?.token && savedAppId) {
      requestRevampDocumentRenewalDrawerReopen(savedAppId, renewalEdit.batchId);
      clearRevampDocumentRenewalEditSession();
    }
    navigate(integrationEdit?.returnPath ?? renewalEdit?.returnPath ?? "/apply/albo-b/step/5");
  }

  const errors = { ...manualErrors, ...(triedSubmit ? validate() : {}) };
  const errorCount = Object.keys(errors).length;

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "#f5c800", borderRadius: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          </span>
          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e" }}>Solco<sup style={{ color: "#f5c800", fontSize: "0.55rem", verticalAlign: "super" }}>+</sup></span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Albo B — Aziende</div>
          <div style={{ fontSize: "0.75rem", color: MUTED }}>Questionario di iscrizione</div>
        </div>
        <button type="button" className={`wizard-save-button${savedAt ? " is-saved" : ""}`} onClick={() => void handleSaveDraft()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 6, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", color: "#374151" }}>
          {savedAt ? <CheckCircle size={14} /> : <Save size={14} />} {savedAt ? `Bozza salvata ${savedAt}` : "Salva bozza"}
        </button>
      </div>

      {integrationEdit || renewalEdit ? (
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "12px 40px", color: "#174f82", fontSize: "0.86rem", fontWeight: 700 }}>
          {renewalEdit ? `Rinnovo documento - Aggiorna solo ${renewalEdit.documentLabel}, poi salva e invia.` : "Integrazione richiesta - Correggi la sezione Certificazioni, salva e invia la risposta."}
        </div>
      ) : (
        <StepBar active={3} />
      )}

      <div style={{ maxWidth: 1040, margin: "28px auto", padding: "0 24px 120px" }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "28px 32px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Sezione 4 — Certificazioni, accreditamenti e allegati</h2>
          <p style={{ fontSize: "0.82rem", color: MUTED, margin: 0 }}>Per ogni certificazione indica se è presente. Se sì, fornisci i dettagli. Carica gli allegati obbligatori.</p>
          <div style={{ height: 1, background: "#f3f4f6", margin: "16px 0 4px" }} />

          <div>
          {/* Certificazioni ISO */}
          <SectionLabel label="Certificazioni" />
          {CERTS_ISO.map(c => {
            const rec = certs[c.key];
            const certAllowed = allowCertificationKey(c.key);
            const certErr = errors[`cert_${c.key}`];
            const enteErr = errors[`cert_${c.key}_ente`];
            const scadErr = errors[`cert_${c.key}_scad`];
            const fileErr = errors[`cert_${c.key}_file`];
            return (
              <div key={c.key} style={{ border: `1px solid ${!certAllowed ? "#cbd5e1" : rec.presente === "si" ? GREEN + "60" : "#e5e7eb"}`, borderRadius: 8, padding: "16px 20px", marginBottom: 12, background: certAllowed ? "#fff" : "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: certAllowed ? "#1e293b" : "#64748b" }}>{c.label}</div>
                    <div style={{ fontSize: "0.76rem", color: MUTED }}>{c.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {(["si","no"] as const).map(v => (
                      <label key={v} style={{ display: "flex", alignItems: "center", gap: 5, cursor: certAllowed ? "pointer" : "not-allowed", padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${!certAllowed ? "#cbd5e1" : rec.presente === v ? GREEN : "#e5e7eb"}`, background: !certAllowed ? "#f1f5f9" : rec.presente === v ? `${GREEN}0d` : "#fff", color: certAllowed ? "#111827" : "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
                        <input type="radio" name={`cert_${c.key}`} value={v} checked={rec.presente === v} onChange={() => updateCertPresence(c.key, v)} disabled={!certAllowed} style={{ accentColor: GREEN }} />
                        {v === "si" ? "Sì" : "No"}
                      </label>
                    ))}
                  </div>
                </div>
                {certErr ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 6 }}>{certErr}</div> : null}

                {rec.presente === "si" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
                    <div style={col}>
                      <span style={lbl}>Ente certificatore <span style={{ color: ERR }}>*</span></span>
                      <input value={rec.enteCertificatore} onChange={e => updateCert(c.key, "enteCertificatore", e.target.value)} placeholder="Es. Bureau Veritas, DNV GL..." disabled={!certAllowed} style={baseInput(!!enteErr, !certAllowed)} />
                      {enteErr ? <span style={errTxt}>{enteErr}</span> : null}
                    </div>
                    <div style={col}>
                      <span style={lbl}>Scadenza certificato <span style={{ color: ERR }}>*</span></span>
                      <input
                        value={rec.scadenza}
                        onChange={e => updateCert(c.key, "scadenza", e.target.value)}
                        onBlur={e => {
                          const msg = validateScadenzaField(e.target.value);
                          setManualErrors(prev => ({ ...prev, [`cert_${c.key}_scad`]: msg }));
                        }}
                        placeholder="MM/AAAA"
                        disabled={!certAllowed}
                        style={baseInput(!!scadErr, !certAllowed)}
                      />
                      {scadErr ? <span style={errTxt}>{scadErr}</span> : null}
                    </div>
                    <div style={col}>
                      <FileInput label="Certificato PDF" fileName={rec.fileName} onChange={handleCertificationFile(c.key)} uploading={uploadingField === `CERTIFICATION:${c.key}`} disabled={!certAllowed} hintText="PDF max 5 MB" />
                      {fileErr ? <span style={errTxt}>{fileErr}</span> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Altre certificazioni */}
          <div style={{ marginBottom: 20 }}>
            <span style={lbl}>Altre certificazioni di settore <span style={{ fontWeight: 400, color: MUTED }}>(opzionale)</span></span>
            <textarea
              value={altreCert} onChange={e => setAltreCert(e.target.value)}
              rows={2} placeholder="Nome certificazione, ente rilasciante, anno, scadenza..."
              style={{ width: "100%", padding: "10px 12px", fontSize: "0.85rem", border: "1.5px solid #d1d5db", borderRadius: 6, outline: "none", boxSizing: "border-box", resize: "vertical", color: "#111827", lineHeight: 1.5, marginTop: 4 }}
            />
          </div>

          {/* Accreditamenti */}
          <SectionLabel label="Accreditamenti" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <span style={lbl}>Accreditamento regionale per la formazione <span style={{ color: ERR }}>*</span></span>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {(["si","no"] as const).map(v => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "7px 16px", borderRadius: 6, border: `1.5px solid ${accFormazione === v ? GREEN : "#e5e7eb"}`, background: accFormazione === v ? `${GREEN}0d` : "#fff", fontSize: "0.85rem", fontWeight: 600 }}>
                    <input type="radio" name="accFormazione" value={v} checked={accFormazione === v} onChange={() => setAccFormazione(v)} style={{ accentColor: GREEN }} />
                    {v === "si" ? "Sì" : "No"}
                  </label>
                ))}
              </div>
              {errors.accFormazione ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 4 }}>{errors.accFormazione}</div> : null}
              {accFormazione === "si" ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={col}>
                    <span style={lbl}>Regioni accreditate</span>
                    <input value={accRegioni} onChange={e => setAccRegioni(e.target.value)} placeholder="Es. Lombardia, Piemonte, Veneto..." style={baseInput()} />
                  </div>
                  <div style={col}>
                    <span style={lbl}>Tipo (professionale / continua / superiore)</span>
                    <input value={accTipo} onChange={e => setAccTipo(e.target.value)} placeholder="Es. Formazione professionale, Formazione continua..." style={baseInput()} />
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              <span style={lbl}>Accreditamento servizi al lavoro (ANPAL/Regioni) <span style={{ color: ERR }}>*</span></span>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {(["si","no"] as const).map(v => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "7px 16px", borderRadius: 6, border: `1.5px solid ${accLavoro === v ? GREEN : "#e5e7eb"}`, background: accLavoro === v ? `${GREEN}0d` : "#fff", fontSize: "0.85rem", fontWeight: 600 }}>
                    <input type="radio" name="accLavoro" value={v} checked={accLavoro === v} onChange={() => setAccLavoro(v)} style={{ accentColor: GREEN }} />
                    {v === "si" ? "Sì" : "No"}
                  </label>
                ))}
              </div>
              {errors.accLavoro ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 4 }}>{errors.accLavoro}</div> : null}
              {accLavoro === "si" ? (
                <div style={{ marginTop: 12, background: "#f0fdf4", border: `1px solid ${GREEN}40`, borderRadius: 6, padding: "10px 14px", fontSize: "0.82rem", color: "#166534" }}>
                  ℹ Allega il provvedimento autorizzatorio nella sezione Allegati sottostante.
                </div>
              ) : null}
            </div>
          </div>
          </div>

          {/* Allegati aziendali */}
          <SectionLabel label="Allegati aziendali" />
          <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: "0.82rem", color: "#92400e" }}>
            ⚠ La visura camerale e il DURC sono obbligatori. Il company profile è consigliato.
          </div>
          {uploadError ? (
            <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: "0.82rem", color: "#b91c1c" }}>
              {uploadError}
            </div>
          ) : null}
          {/* TOP ROW — Visura + DURC */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={col}>
              <FileInput label="Visura camerale ordinaria" required fileName={visura} onChange={handleFile("VISURA_CAMERALE", setVisura, setVisuraAttachment, 5)} uploading={uploadingField === "VISURA_CAMERALE"} disabled={!allowVisura} hintText="PDF max 5 MB" tooltip="emissione non anteriore a 6 mesi" />
              {errors.visura ? <span style={errTxt}>{errors.visura}</span> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, maxWidth: 180 }}>
                <span style={lbl}>Scadenza <span style={{ color: ERR }}>*</span></span>
                <input
                  value={visuraScadenza}
                  onChange={e => setVisuraScadenza(e.target.value)}
                  onBlur={e => {
                    const msg = validateScadenzaField(e.target.value);
                    setManualErrors(prev => ({ ...prev, visuraScadenza: msg }));
                  }}
                  placeholder="MM/AAAA"
                  disabled={!allowVisura}
                  style={baseInput(!!errors.visuraScadenza, !allowVisura)}
                />
                {errors.visuraScadenza ? <span style={errTxt}>{errors.visuraScadenza}</span> : null}
              </div>
            </div>
            <div style={col}>
              <FileInput label="DURC — Documento Unico Regolarità Contributiva" required fileName={durc} onChange={handleFile("DURC", setDurc, setDurcAttachment, 5)} uploading={uploadingField === "DURC"} disabled={!allowDurc} hintText="PDF max 5 MB" tooltip="validità 120 giorni" />
              {errors.durc ? <span style={errTxt}>{errors.durc}</span> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, maxWidth: 180 }}>
                <span style={lbl}>Scadenza <span style={{ color: ERR }}>*</span></span>
                <input
                  value={durcScadenza}
                  onChange={e => setDurcScadenza(e.target.value)}
                  onBlur={e => {
                    const msg = validateScadenzaField(e.target.value);
                    setManualErrors(prev => ({ ...prev, durcScadenza: msg }));
                  }}
                  placeholder="MM/AAAA"
                  disabled={!allowDurc}
                  style={baseInput(!!errors.durcScadenza, !allowDurc)}
                />
                {errors.durcScadenza ? <span style={errTxt}>{errors.durcScadenza}</span> : null}
              </div>
            </div>
          </div>
          {/* BOTTOM ROW — Company profile + ISO certs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <FileInput label="Company profile / presentazione aziendale" fileName={companyProf} onChange={handleFile("COMPANY_PROFILE", setCompanyProf, setCompanyProfAttachment, 10)} uploading={uploadingField === "COMPANY_PROFILE"} disabled={!allowCompanyProfile} hintText="PDF max 10 MB — consigliato" />
            <div style={col}>
              <FileInput label="Certificati ISO e accreditamenti" fileName={certAlleg} onChange={handleFile("CERTIFICATION", setCertAlleg, setCertAllegAttachment, 10)} uploading={uploadingField === "CERTIFICATION"} disabled={!allowCertAttachments || !allowGenericCertAttachment} hintText="PDF — un file per certificato (o archivio ZIP)" />
              {errors.certAlleg ? <span style={errTxt}>{errors.certAlleg}</span> : null}
            </div>
          </div>

          {/* Error summary */}
          {errorCount > 0 ? (
            <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "12px 16px", marginTop: 20 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#b91c1c" }}>⚠ {errorCount} {errorCount === 1 ? "campo richiede attenzione" : "campi richiedono attenzione"}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="wizard-bottom-nav" style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Link className="wizard-nav-button wizard-nav-button-prev" to={integrationEdit?.returnPath ?? renewalEdit?.returnPath ?? "/apply/albo-b/step/3"} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: GREEN, textDecoration: "none" }}>
          <ArrowLeft size={15} /> {integrationEdit || renewalEdit ? "Torna alla richiesta" : "Sezione precedente"}
        </Link>
        {integrationEdit || renewalEdit ? (
          <div style={{ fontSize: "0.82rem", color: MUTED, fontWeight: 700 }}>{renewalEdit ? "Modalita rinnovo documento" : "Modalita integrazione"}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: "0.78rem", color: MUTED }}>Avanzamento: <strong>80%</strong></span>
            <div style={{ width: 200, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "80%", height: "100%", background: GREEN, borderRadius: 2 }} />
            </div>
          </div>
        )}
        <button className="wizard-nav-button wizard-nav-button-next" type="button" onClick={() => void handleNext()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: GREEN, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
          {renewalEdit ? "Salva e invia documento" : integrationEdit ? "Salva e invia integrazione" : "Sezione successiva"} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
