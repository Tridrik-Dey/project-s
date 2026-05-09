import { ChangeEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, Info, Save } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getMyLatestRevampApplication, getRevampApplicationSections, saveRevampApplicationSection, type RevampSectionSnapshot } from "../../api/revampApplicationApi";
import { loadRevampApplicationIdForRegistry, saveRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";
import { clearRevampIntegrationEditSession, integrationEditHasAnyCode, isRevampIntegrationEditFor, loadRevampIntegrationEditSession } from "../../utils/revampIntegrationEditSession";
import { completeRevampIntegrationEdit } from "../../utils/revampIntegrationCompletion";
import { loadRevampFcrEditSession } from "../../utils/revampFcrEditSession";
import { useFcrEditMode } from "../../hooks/useFcrEditMode";
import { FcrSubmitBar } from "../../components/supplier/FcrSubmitBar";

const NAVY  = "#0f2a52";
const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR   = "#dc2626";
const WARN_BG     = "#fffbeb";
const WARN_BORDER = "#f59e0b";

const STEPS = ["Anagrafica", "Tipologia", "Competenze", "Disponibilità", "Dichiarazioni"];

/* ─── shared options ─────────────────────────────── */
const TITOLI_STUDIO = [
  { value: "licenza_media",    label: "Licenza media" },
  { value: "diploma",          label: "Diploma di scuola secondaria superiore" },
  { value: "laurea_triennale", label: "Laurea triennale (L)" },
  { value: "laurea_magistrale",label: "Laurea magistrale / specialistica (LM/LS)" },
  { value: "master_1",         label: "Master universitario di I livello" },
  { value: "master_2",         label: "Master universitario di II livello" },
  { value: "dottorato",        label: "Dottorato di Ricerca" },
  { value: "equipollente",     label: "Titolo equipollente estero" },
];

const ANNI_DOC = [
  { value: "meno1",   label: "meno di 1 anno" },
  { value: "1_5",     label: "1–5 anni" },
  { value: "5_10",    label: "5–10 anni" },
  { value: "10_15",   label: "10–15 anni" },
  { value: "oltre15", label: "oltre 15 anni" },
];

const ANNI_PROF = [
  { value: "meno2",   label: "meno di 2 anni" },
  { value: "2_5",     label: "2–5 anni" },
  { value: "5_10",    label: "5–10 anni" },
  { value: "10_20",   label: "10–20 anni" },
  { value: "oltre20", label: "oltre 20 anni" },
];

/* ─── 3A: aree tematiche ─────────────────────────── */
type AreaItem = { id: string; label: string };
export const AREE_TEMATICHE: AreaItem[] = [
  { id: "digitale_base",  label: "Competenze digitali di base" },
  { id: "digitale_adv",   label: "Competenze digitali avanzate e specialistiche" },
  { id: "lingue",         label: "Lingue straniere / Italiano per stranieri" },
  { id: "soft_skills",    label: "Soft skills e life skills" },
  { id: "outdoor",        label: "Formazione outdoor / esperienziale" },
  { id: "hr",             label: "Human Resources" },
  { id: "manageriale",    label: "Formazione manageriale" },
  { id: "sistemi",        label: "Sistemi di gestione (ISO 9001, SA8000, ecc.)" },
  { id: "comunicazione",  label: "Comunicazione, marketing e social media" },
  { id: "grafica",        label: "Grafica e design" },
  { id: "ssl_ob",         label: "Salute e Sicurezza sul lavoro — obbligatoria" },
  { id: "ssl_nob",        label: "Salute e Sicurezza sul lavoro — non obbligatoria" },
  { id: "giuridico",      label: "Giuridico" },
  { id: "fondi_eu",       label: "Gestione Fondi Strutturali EU" },
  { id: "economico",      label: "Economico / finanziario" },
  { id: "commercio",      label: "Commercio e vendita" },
  { id: "pm",             label: "Project Management" },
  { id: "green",          label: "Green economy / sostenibilità ambientale" },
  { id: "sanita",         label: "Sanità / socio-assistenziale" },
  { id: "logistica",      label: "Logistica e trasporti" },
  { id: "agricoltura",    label: "Agricoltura" },
  { id: "turismo",        label: "Turismo ed enogastronomia" },
  { id: "tecnico_prof",   label: "Formazione tecnico-professionale" },
  { id: "audiovisivo",    label: "Audiovisivo e spettacolo" },
  { id: "cultura",        label: "Cultura e beni culturali" },
  { id: "scolastico",     label: "Formazione in contesti scolastici" },
  { id: "altro_area",     label: "Altro (specificare ambito e tematiche)" },
];

const AMBITI_CONSULENZA = [
  "Orientamento professionale", "Accompagnamento al lavoro", "Coaching",
  "Assistenza tecnica ai programmi comunitari e nazionali", "Business Plan e creazione d'impresa",
  "Change management", "Consulenza aziendale e di direzione", "Gestione risorse umane",
  "Direzione e coordinamento", "Monitoraggio e valutazione", "Progettazione fondi EU",
  "Progettazione formativa", "Rendicontazione", "Ricerca sociale e di mercato", "Tutoraggio",
];

/* ─── 3B: servizi per tipologia ─────────────────── */
const SERVIZI_MAP: Record<string, string[]> = {
  cdo_lavoro:     ["Payroll e amministrazione", "Gestione contratti e rapporti di lavoro", "Contenzioso e controversie", "Welfare aziendale", "Applicazione CCNL", "Somministrazione"],
  commercialista: ["Contabilità e bilancio", "Fiscalità d'impresa", "Finanza agevolata e crediti d'imposta", "Valutazione d'azienda"],
  avvocato:       ["Diritto del lavoro", "Contrattualistica commerciale", "Privacy e GDPR", "Terzo settore", "Diritto societario", "Contenziosi"],
  psicologo:      ["Assessment individuale e di gruppo", "Outplacement", "Sviluppo leadership", "Counseling"],
  finanza:        ["Bandi regionali e nazionali", "Fondi strutturali europei", "Credito d'imposta R&S e formazione", "Finanza alternativa"],
  orientatore:    ["Bilancio di competenze", "Counseling di carriera", "Orientamento e Accompagnamento al lavoro"],
};

/* ─── types ──────────────────────────────────────── */
type AreaState = { checked: boolean; specifica: string; anni: string };
type AreasMap  = Record<string, AreaState>;

function initAree(): AreasMap {
  return Object.fromEntries(AREE_TEMATICHE.map(a => [a.id, { checked: false, specifica: "", anni: "" }]));
}

/* ─── shared ui helpers ──────────────────────────── */
type OC  = (e: ChangeEvent<HTMLInputElement>)    => void;
type OCT = (e: ChangeEvent<HTMLTextAreaElement>) => void;
type OCS = (e: ChangeEvent<HTMLSelectElement>)   => void;

const s_input = (err?: boolean): React.CSSProperties => ({
  width: "100%", padding: "9px 11px", fontSize: "0.86rem",
  border: `1.5px solid ${err ? ERR : "#d1d5db"}`, borderRadius: 6,
  outline: "none", boxSizing: "border-box", color: "#111827", background: "#fff",
});
const s_textarea = (err?: boolean): React.CSSProperties => ({
  ...s_input(err), resize: "vertical" as const, minHeight: 68, fontFamily: "inherit",
});
const COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const LBL: React.CSSProperties = { fontSize: "0.77rem", fontWeight: 600, color: "#374151" };
const HINT: React.CSSProperties = { fontWeight: 400, color: MUTED };
const ERRTXT: React.CSSProperties = { fontSize: "0.73rem", color: ERR };

function Field({ label, required, value, onChange, error, placeholder, type = "text", hint, tooltip }: {
  label: string; required?: boolean; value: string; onChange: OC;
  error?: string; placeholder?: string; type?: string; hint?: string; tooltip?: string;
}) {
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
      <input type={type} placeholder={placeholder ?? ""} value={value} onChange={onChange} style={s_input(!!error)} />
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
      <textarea placeholder={placeholder ?? ""} value={value} onChange={onChange} rows={rows} style={s_textarea(!!error)} />
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
      <select value={value} onChange={onChange} style={s_input(!!error)}>
        <option value="">Seleziona...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span style={ERRTXT}>{error}</span>}
    </div>
  );
}

function SubLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <div style={{ fontSize: "0.71rem", fontWeight: 700, color: accent, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "20px 0 10px", borderLeft: `3px solid ${accent}`, paddingLeft: 8 }}>
      {label}
    </div>
  );
}

function SectionCard({ title, desc, accent, className, children }: { title: string; desc?: string; accent: string; className?: string; children: React.ReactNode }) {
  const fcrSession = loadRevampFcrEditSession();
  const integrationSession = loadRevampIntegrationEditSession();
  const automaticGroups = title.includes("Istruzione")
    ? ["istruzione"]
    : title.includes("Aree Tematiche")
      ? ["competenze", "territorio", "lingue"]
      : title.includes("Profilo Professionale")
        ? ["istruzione", "servizi_offerti", "cert_specifiche"]
        : [];
  const integrationActive = integrationSession && automaticGroups.length
    ? (
        title.includes("Aree Tematiche")
          ? integrationEditHasAnyCode(integrationSession, ["THEMATIC_SPECIFICATION"])
          : title.includes("Profilo Professionale")
            ? integrationEditHasAnyCode(integrationSession, ["THEMATIC_SPECIFICATION", "EXPERIENCE_CONSISTENCY"])
            : false
      )
    : false;
  const effectiveClassName = className ?? (integrationSession && automaticGroups.length
    ? integrationActive ? "fcr-active-group" : "fcr-locked"
    : fcrSession && automaticGroups.length
    ? automaticGroups.includes(fcrSession.sectionKey) ? "fcr-active-group" : "fcr-locked"
    : undefined);
  return (
    <div className={effectiveClassName} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "22px 26px", marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: "1rem", color: accent, marginBottom: desc ? 4 : 14 }}>{title}</div>
      {desc && <p style={{ fontSize: "0.82rem", color: MUTED, margin: "0 0 16px", lineHeight: 1.5 }}>{desc}</p>}
      {children}
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
export function RevampStep3CompetenzePage() {
  const navigate = useNavigate();
  const { registryType: registryParam } = useParams();
  const { auth } = useAuth();
  const isA = registryParam === "albo-a";
  const isB = registryParam === "albo-b";
  if (!isA && !isB) return <Navigate to="/apply" replace />;

  const tipologia = sessionStorage.getItem("revamp_tipologia") ?? "";
  const isDocente = isA && tipologia === "docente";
  const accent = isA ? NAVY : GREEN;
  const title = isA ? "Albo A — Professionisti" : "Albo B — Aziende";
  const registryType = isA ? "ALBO_A" : "ALBO_B";
  const integrationEdit = isRevampIntegrationEditFor(registryType, 3);
  const fcr = useFcrEditMode();
  const subtitle = isDocente
    ? "Sezione 3A · Scheda Docente / Formatore"
    : "Sezione 3 · Profilo Professionale";

  /* ── 3A state ──────────────────────────────────── */
  const [titoloStudio,     setTitoloStudio]    = useState("");
  const [ambitoStudio,     setAmbitoStudio]    = useState("");
  const [annoConseg,       setAnnoConseg]       = useState("");
  const [certAbitazioni,   setCertAbitazioni]  = useState("");
  const [aree,             setAree]            = useState<AreasMap>(initAree);
  const [docenzaPA,        setDocenzaPA]       = useState("");
  const [consulenza,       setConsulenza]      = useState<Set<string>>(new Set());
  const [areaTerritoriale, setAreaTerritoriale]= useState("");
  const [lingue,           setLingue]          = useState("");
  const [lingueDocenza,    setLingueDocenza]   = useState("");
  const [strumenti,        setStrumenti]       = useState("");
  const [reti,             setReti]            = useState("");

  /* ── 3B state ──────────────────────────────────── */
  const [ordine,       setOrdine]       = useState("");
  const [titoloB,      setTitoloB]      = useState("");
  const [ambitoB,      setAmbitoB]      = useState("");
  const [anniEsp,      setAnniEsp]      = useState("");
  const [servizi,      setServizi]      = useState<Set<string>>(new Set());
  const [altroServ,    setAltroServ]    = useState("");
  const [certB,        setCertB]        = useState("");

  /* ── shared ────────────────────────────────────── */
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [sectionWasCompleted, setSectionWasCompleted] = useState(false);

  useEffect(() => {
    if (!auth?.token) return;

    function applyS3(sections: RevampSectionSnapshot[]) {
      const latest = sections
        .filter(s => ["S3", "S3A", "S3B"].includes(s.sectionKey))
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      if (latest.completed) setSectionWasCompleted(true);
      const s3 = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      if (s3.titoloStudio)      setTitoloStudio(s3.titoloStudio as string);
      if (s3.ambitoStudio)      setAmbitoStudio(s3.ambitoStudio as string);
      if (s3.annoConseg)        setAnnoConseg(s3.annoConseg as string);
      if (s3.certAbitazioni)    setCertAbitazioni(s3.certAbitazioni as string);
      if (Array.isArray(s3.aree) && s3.aree.length) {
        setAree(prev => {
          const n = { ...prev };
          (s3.aree as string[]).forEach(id => { if (n[id]) n[id] = { ...n[id], checked: true }; });
          return n;
        });
      }
      if (s3.docenzaPA)         setDocenzaPA(s3.docenzaPA as string);
      if (Array.isArray(s3.consulenza)) setConsulenza(new Set(s3.consulenza as string[]));
      if (s3.areaTerritoriale)  setAreaTerritoriale(s3.areaTerritoriale as string);
      if (s3.lingue)            setLingue(s3.lingue as string);
      if (s3.lingueDocenza)     setLingueDocenza(s3.lingueDocenza as string);
      if (s3.strumenti)         setStrumenti(s3.strumenti as string);
      if (s3.reti)              setReti(s3.reti as string);
      if (s3.ordine)            setOrdine(s3.ordine as string);
      if (s3.titoloB)           setTitoloB(s3.titoloB as string);
      if (s3.ambitoB)           setAmbitoB(s3.ambitoB as string);
      if (s3.anniEsp)           setAnniEsp(s3.anniEsp as string);
      if (Array.isArray(s3.servizi)) setServizi(new Set(s3.servizi as string[]));
      if (s3.altroServ)         setAltroServ(s3.altroServ as string);
      if (s3.certB)             setCertB(s3.certB as string);
    }

    const existingAppId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS3).catch(() => {});
      return;
    }

    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== registryType) return;
      saveRevampApplicationIdForRegistry(registryType, app.id);
      return getRevampApplicationSections(app.id, auth!.token!).then(applyS3);
    }).catch(() => {});
  }, [auth?.token, registryType]);

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
      const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
      if (!appId) return;
      const areeChecked = AREE_TEMATICHE.filter(a => aree[a.id].checked).map(a => a.id);
      const draftPayload = JSON.stringify({
        titoloStudio, ambitoStudio, annoConseg, certAbitazioni,
        aree: areeChecked, areaTerritoriale, lingue, lingueDocenza, strumenti, reti,
        docenzaPA, consulenza: Array.from(consulenza),
        titoloB, ambitoB, anniEsp, ordine, certB,
        servizi: Array.from(servizi), altroServ,
      });
      const sectionKey = isA && isDocente ? "S3A" : isA ? "S3B" : "S3";
      await saveRevampApplicationSection(appId, sectionKey, draftPayload, sectionWasCompleted, auth.token);
      handleSave();
    } catch { /* best-effort */ }
  }

  function toggleArea(id: string) {
    setAree(prev => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }));
    clearErr("aree");
  }
  function setAreaField(id: string, f: "specifica" | "anni", v: string) {
    setAree(prev => ({ ...prev, [id]: { ...prev[id], [f]: v } }));
    clearErr(`specifica_${id}`);
    clearErr(`anni_${id}`);
  }
  function toggleConsulenza(v: string) {
    setConsulenza(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
  }
  function toggleServizio(v: string) {
    setServizi(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
    clearErr("servizi");
  }

  async function saveSectionProgrammatic() {
    if (!auth?.token) throw new Error("Sessione scaduta. Effettua nuovamente il login.");
    const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
    if (!appId) throw new Error("Candidatura non trovata.");
    const areeChecked = AREE_TEMATICHE.filter(a => aree[a.id].checked).map(a => a.id);
    const frontendPayload = {
      titoloStudio, ambitoStudio, annoConseg, certAbitazioni,
      aree: areeChecked,
      areaTerritoriale, lingue, lingueDocenza, strumenti, reti,
      docenzaPA, consulenza: Array.from(consulenza),
      titoloB, ambitoB, anniEsp, ordine, certB,
      servizi: Array.from(servizi), altroServ,
    };
    if (isA && isDocente) {
      await saveRevampApplicationSection(appId, "S3A", JSON.stringify({
        ...frontendPayload,
        thematicAreasCsv: areeChecked.join(","),
        education: { highestTitle: titoloStudio, studyArea: ambitoStudio, graduationYear: annoConseg },
        presentation: areaTerritoriale,
      }), true, auth.token);
      return;
    }
    if (isA) {
      await saveRevampApplicationSection(appId, "S3B", JSON.stringify({
        ...frontendPayload,
        professionalOrder: ordine,
        highestTitle: titoloB,
        studyArea: ambitoB,
        experienceBand: anniEsp,
        services: Array.from(servizi),
        hourlyRateRange: "",
        territory: { regionsCsv: "", provincesCsv: "" },
      }), sectionWasCompleted, auth.token);
      return;
    }
    await saveRevampApplicationSection(appId, "S3", JSON.stringify(frontendPayload), true, auth.token);
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (integrationEdit) return e;
    if (isDocente) {
      if (!titoloStudio) e.titoloStudio = "Campo obbligatorio.";
      if (!ambitoStudio.trim()) e.ambitoStudio = "Campo obbligatorio.";
      if (!annoConseg.trim()) {
        e.annoConseg = "Campo obbligatorio.";
      } else if (!/^\d{4}$/.test(annoConseg.trim()) || +annoConseg < 1940 || +annoConseg > new Date().getFullYear()) {
        e.annoConseg = "Inserisci un anno valido (AAAA).";
      }
      const nChecked = AREE_TEMATICHE.filter(a => aree[a.id].checked).length;
      if (nChecked === 0) e.aree = "Seleziona almeno un ambito tematico.";
      for (const area of AREE_TEMATICHE) {
        const st = aree[area.id];
        if (st.checked) {
          if (!st.specifica.trim()) e[`specifica_${area.id}`] = "Obbligatorio.";
          if (!st.anni)             e[`anni_${area.id}`]      = "Obbligatorio.";
        }
      }
      if (!docenzaPA) e.docenzaPA = "Campo obbligatorio.";
      if (!areaTerritoriale.trim()) e.areaTerritoriale = "Campo obbligatorio.";
    } else {
      if (!titoloB)          e.titoloB   = "Campo obbligatorio.";
      if (!ambitoB.trim())   e.ambitoB   = "Campo obbligatorio.";
      if (!anniEsp)          e.anniEsp   = "Campo obbligatorio.";
      if (servizi.size === 0 && !altroServ.trim()) e.servizi = "Indica almeno un servizio offerto.";
    }
    return e;
  }

  async function handleNext() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    handleSave();
    const areeChecked = AREE_TEMATICHE.filter(a => aree[a.id].checked).map(a => a.id);
    const frontendPayload = {
      titoloStudio, ambitoStudio, annoConseg, certAbitazioni,
      aree: areeChecked,
      areaTerritoriale, lingue, lingueDocenza, strumenti, reti,
      docenzaPA, consulenza: Array.from(consulenza),
      titoloB, ambitoB, anniEsp, ordine, certB,
      servizi: Array.from(servizi), altroServ,
    };
    sessionStorage.setItem("revamp_s3", JSON.stringify(frontendPayload));
    let savedAppId: string | null = null;
    if (auth?.token) {
      try {
        const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
        if (appId) {
          savedAppId = appId;
          if (isA && isDocente) {
            /* S3A — Docente / Formatore */
            const s3aPayload = {
              ...frontendPayload,
              thematicAreasCsv: areeChecked.join(","),
              education: { highestTitle: titoloStudio, studyArea: ambitoStudio, graduationYear: annoConseg },
              presentation: areaTerritoriale,
            };
            await saveRevampApplicationSection(appId, "S3A", JSON.stringify(s3aPayload), true, auth.token);
          } else if (isA && !isDocente) {
            /* S3B — Altri professionisti (incomplete: hourlyRateRange comes from Step4) */
            const s3bPayload = {
              ...frontendPayload,
              professionalOrder: ordine,
              highestTitle: titoloB,
              studyArea: ambitoB,
              experienceBand: anniEsp,
              services: Array.from(servizi),
              hourlyRateRange: "",
              territory: { regionsCsv: "", provincesCsv: "" },
            };
            await saveRevampApplicationSection(appId, "S3B", JSON.stringify(s3bPayload), false, auth.token);
          } else {
            /* Albo B — unchanged */
            await saveRevampApplicationSection(appId, "S3", JSON.stringify(frontendPayload), true, auth.token);
          }
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
    navigate(integrationEdit?.returnPath ?? `/apply/${registryParam}/step/4`);
  }

  const checkedAree  = AREE_TEMATICHE.filter(a => aree[a.id].checked).length;
  const serviziList  = SERVIZI_MAP[tipologia] ?? [];
  const errorCount   = Object.keys(errors).length;
  const areaErrors   = Object.keys(errors).filter(k => k.startsWith("specifica_") || k.startsWith("anni_")).length;
  const mainErrors   = errorCount - areaErrors;

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>
      <PageHeader title={title} subtitle={subtitle} savedAt={savedAt} onSave={() => void handleSaveDraft()} />
      {integrationEdit || fcr.active ? (
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "12px 40px", color: "#174f82", fontSize: "0.86rem", fontWeight: 700 }}>
          {fcr.active ? "Richiesta di modifica - Aggiorna solo il gruppo sbloccato, poi salva e invia." : "Integrazione richiesta - Correggi la sezione Competenze, salva e invia la risposta."}
        </div>
      ) : (
        <StepBar active={2} accent={accent} />
      )}

      <div style={{ maxWidth: 980, margin: "20px auto", padding: "0 20px 100px" }}>

        {/* ══════════════════════════════════════════
            SEZIONE 3A — SCHEDA DOCENTE / FORMATORE
        ══════════════════════════════════════════ */}
        {isDocente && (
          <>
            {/* ── A — Istruzione e Abilitazioni ── */}
            <SectionCard title="A — Istruzione e Abilitazioni" accent={accent}
              desc="Inserisci il tuo titolo di studio più elevato, l'indirizzo e l'anno di conseguimento.">
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
                <Select label="Titolo di studio più elevato" required value={titoloStudio}
                  onChange={e => { setTitoloStudio(e.target.value); clearErr("titoloStudio"); }}
                  options={TITOLI_STUDIO} error={errors.titoloStudio} />
                <Field label="Anno di conseguimento" required value={annoConseg}
                  onChange={e => { setAnnoConseg(e.target.value); clearErr("annoConseg"); }}
                  placeholder="AAAA" error={errors.annoConseg} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Textarea label="Ambito / Indirizzo di studio" required value={ambitoStudio}
                  onChange={e => { setAmbitoStudio(e.target.value); clearErr("ambitoStudio"); }}
                  placeholder="Es. Laurea Magistrale in Psicologia del lavoro e delle organizzazioni; Master in Instructional Design e E-Learning"
                  error={errors.ambitoStudio} rows={2} />
              </div>
              <Textarea label="Certificazioni e abilitazioni" hint="opzionale" value={certAbitazioni}
                onChange={e => setCertAbitazioni(e.target.value)}
                placeholder="Es. certificazioni linguistiche, ICT, Project Management, qualifica docente SSL, iscrizioni ad albi professionali..." rows={2} />
            </SectionCard>

            {/* ── B — Aree Tematiche ── */}
            <SectionCard title="B — Aree Tematiche di Competenza" accent={accent}
              desc="Seleziona tutti gli ambiti in cui sei in grado di erogare docenza o formazione. Per ogni ambito selezionato specifica i sottotemi trattati e la tua fascia di esperienza.">

              {/* counter / error */}
              {errors.aree ? (
                <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "9px 12px", marginBottom: 12, fontSize: "0.82rem", color: "#b91c1c" }}>⚠ {errors.aree}</div>
              ) : checkedAree > 0 ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: "0.78rem", color: "#16a34a" }}>
                  ✓ {checkedAree} {checkedAree === 1 ? "ambito selezionato" : "ambiti selezionati"}
                </div>
              ) : (
                <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: "0.78rem", color: "#1d4ed8" }}>
                  ℹ Seleziona almeno un ambito. Per ogni voce selezionata compila i campi obbligatori.
                </div>
              )}

              {/* area list */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                {AREE_TEMATICHE.map((area, idx) => {
                  const st = aree[area.id];
                  const hasFieldErr = !!(errors[`specifica_${area.id}`] || errors[`anni_${area.id}`]);
                  return (
                    <div key={area.id} style={{ borderBottom: idx < AREE_TEMATICHE.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <div onClick={() => toggleArea(area.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: st.checked ? `${accent}05` : (hasFieldErr ? "#fff5f5" : "transparent") }}>
                        <span style={{ width: 18, height: 18, border: `2px solid ${st.checked ? accent : "#d1d5db"}`, borderRadius: 3, background: st.checked ? accent : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {st.checked && <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 900 }}>✓</span>}
                        </span>
                        <span style={{ fontSize: "0.85rem", fontWeight: st.checked ? 600 : 400, color: st.checked ? accent : "#374151", flex: 1 }}>{area.label}</span>
                        {hasFieldErr && <span style={{ fontSize: "0.7rem", color: ERR }}>● compila i campi</span>}
                      </div>
                      {st.checked && (
                        <div style={{ padding: "0 14px 14px 42px", display: "grid", gridTemplateColumns: "1fr 170px", gap: 10 }}>
                          <div style={COL}>
                            <span style={LBL}>Specifica tematiche <span style={{ color: ERR }}>*</span></span>
                            <textarea value={st.specifica}
                              onChange={e => setAreaField(area.id, "specifica", e.target.value)}
                              placeholder="Indica i sottotemi specifici trattati..."
                              rows={2}
                              style={{ ...s_textarea(!!errors[`specifica_${area.id}`]), minHeight: 52 }} />
                            {errors[`specifica_${area.id}`] && <span style={ERRTXT}>{errors[`specifica_${area.id}`]}</span>}
                          </div>
                          <div style={COL}>
                            <span style={LBL}>Anni di esperienza <span style={{ color: ERR }}>*</span></span>
                            <select value={st.anni} onChange={e => setAreaField(area.id, "anni", e.target.value)} style={s_input(!!errors[`anni_${area.id}`])}>
                              <option value="">Seleziona...</option>
                              {ANNI_DOC.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {errors[`anni_${area.id}`] && <span style={ERRTXT}>{errors[`anni_${area.id}`]}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Docenza PA */}
              <SubLabel label="Docenza per la Pubblica Amministrazione" accent={accent} />
              <div style={{ maxWidth: 400 }}>
                <Select label="Hai esperienza di docenza per la PA?" required value={docenzaPA}
                  onChange={e => { setDocenzaPA(e.target.value); clearErr("docenzaPA"); }}
                  options={[
                    { value: "si_centrale",  label: "Sì — PA centrale (Ministeri, Agenzie)" },
                    { value: "si_locale",    label: "Sì — PA locale (Comuni, Regioni, ASL, ecc.)" },
                    { value: "si_entrambe",  label: "Sì — entrambe" },
                    { value: "no",           label: "No" },
                  ]}
                  error={errors.docenzaPA} />
              </div>

              {/* Ambiti di consulenza */}
              <SubLabel label="Ambiti di consulenza offerti" accent={accent} />
              <p style={{ fontSize: "0.81rem", color: MUTED, margin: "0 0 10px", lineHeight: 1.5 }}>
                Oltre alla docenza, indica le tematiche su cui offri anche servizi di consulenza. <em>Opzionale.</em>
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 6 }}>
                {AMBITI_CONSULENZA.map(amb => (
                  <label key={amb} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: "0.81rem", color: consulenza.has(amb) ? accent : "#374151", fontWeight: consulenza.has(amb) ? 600 : 400 }}>
                    <input type="checkbox" checked={consulenza.has(amb)} onChange={() => toggleConsulenza(amb)} style={{ accentColor: accent }} />
                    {amb}
                  </label>
                ))}
              </div>

              {/* Area territoriale */}
              <SubLabel label="Area territoriale di attività in presenza" accent={accent} />
              <Textarea label="Regioni e/o Province in cui sei disponibile a operare in presenza" required
                value={areaTerritoriale} onChange={e => { setAreaTerritoriale(e.target.value); clearErr("areaTerritoriale"); }}
                placeholder="Es. MI, TO, GE — oppure: Lombardia, Piemonte, tutta Italia"
                error={errors.areaTerritoriale} rows={2} />

              {/* Lingue e strumenti */}
              <SubLabel label="Lingue, strumenti digitali e reti professionali" accent={accent} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <Textarea label="Lingue parlate (oltre all'italiano) e livello QCER" hint="opzionale"
                  value={lingue} onChange={e => setLingue(e.target.value)}
                  placeholder="Es. Inglese B2, Francese B1, Spagnolo A1..." rows={2} />
                <Textarea label="Lingue straniere in cui può erogare docenza" hint="opzionale"
                  value={lingueDocenza} onChange={e => setLingueDocenza(e.target.value)}
                  placeholder="Es. Inglese, Francese..." rows={2} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Textarea label="Strumenti digitali rilevanti" hint="opzionale"
                  value={strumenti} onChange={e => setStrumenti(e.target.value)}
                  placeholder="Es. Mural, Mentimeter, MS Teams, Zoom, Power BI, Canva..." rows={2} />
                <Textarea label="Partecipazione a reti professionali o associazioni" hint="opzionale"
                  value={reti} onChange={e => setReti(e.target.value)}
                  placeholder="Es. AIF, AIDP, AIFOS, Federmanager..." rows={2} />
              </div>
            </SectionCard>
          </>
        )}

        {/* ══════════════════════════════════════════
            SEZIONE 3B — ALTRI PROFESSIONISTI
        ══════════════════════════════════════════ */}
        {!isDocente && (
          <SectionCard title="Profilo Professionale" accent={accent}
            desc="Compila i dati relativi alle tue qualifiche, ai servizi che offri al Gruppo Solco e alle certificazioni rilevanti.">

            {/* Istruzione e ordine */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Select label="Titolo di studio più elevato" required value={titoloB}
                onChange={e => { setTitoloB(e.target.value); clearErr("titoloB"); }}
                options={TITOLI_STUDIO} error={errors.titoloB} />
              <Select label="Anni di esperienza professionale complessiva" required value={anniEsp}
                onChange={e => { setAnniEsp(e.target.value); clearErr("anniEsp"); }}
                options={ANNI_PROF} error={errors.anniEsp} />
              <Field label="Ordine professionale di appartenenza" tooltip="se iscritto"
                value={ordine} onChange={e => setOrdine(e.target.value)}
                placeholder="Es. CPO, CNF, ODCEC, Ordine Psicologi..." />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Textarea label="Ambito / Indirizzo di studio" required value={ambitoB}
                onChange={e => { setAmbitoB(e.target.value); clearErr("ambitoB"); }}
                placeholder="Es. Laurea Magistrale in Giurisprudenza, specializzazione in Diritto del Lavoro"
                error={errors.ambitoB} rows={2} />
            </div>

            {/* Servizi offerti */}
            <SubLabel label="Servizi offerti al Gruppo Solco" accent={accent} />
            {errors.servizi && (
              <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "9px 12px", marginBottom: 10, fontSize: "0.81rem", color: "#b91c1c" }}>
                ⚠ {errors.servizi}
              </div>
            )}
            {serviziList.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 7, marginBottom: 12 }}>
                {serviziList.map(s => (
                  <label key={s} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: "0.82rem", color: servizi.has(s) ? accent : "#374151", fontWeight: servizi.has(s) ? 600 : 400 }}>
                    <input type="checkbox" checked={servizi.has(s)} onChange={() => toggleServizio(s)} style={{ accentColor: accent }} />
                    {s}
                  </label>
                ))}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <Textarea
                label={serviziList.length > 0 ? "Altro / campo libero" : "Descrivi i servizi offerti"}
                required={serviziList.length === 0}
                value={altroServ} onChange={e => { setAltroServ(e.target.value); clearErr("servizi"); }}
                placeholder="Descrivi i servizi che offri al Gruppo Solco..."
                error={serviziList.length === 0 ? errors.servizi : undefined} rows={2} />
            </div>

            {/* Certificazioni */}
            <SubLabel label="Certificazioni e abilitazioni specifiche" accent={accent} />
            <Textarea label="Abilitazioni, specializzazioni post-laurea, master rilevanti" hint="opzionale"
              value={certB} onChange={e => setCertB(e.target.value)}
              placeholder="Es. abilitazione professionale, certificazione internazionale, master rilevante..." rows={2} />
          </SectionCard>
        )}

        {/* ── Error summary ── */}
        {errorCount > 0 && (
          <div style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 6, padding: "12px 16px" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#92400e" }}>
              ⚠ {mainErrors > 0 ? `${mainErrors} ${mainErrors === 1 ? "campo richiede" : "campi richiedono"} attenzione` : ""}
              {areaErrors > 0 ? `${mainErrors > 0 ? "; " : ""}${areaErrors} ${areaErrors === 1 ? "campo non completato nelle aree tematiche" : "campi non completati nelle aree tematiche"}` : ""}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      {!fcr.active && <div className="wizard-bottom-nav" style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 36px", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Link className="wizard-nav-button wizard-nav-button-prev" to={integrationEdit?.returnPath ?? `/apply/${registryParam}/step/2`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${accent}`, borderRadius: 6, fontWeight: 600, fontSize: "0.84rem", color: accent, textDecoration: "none" }}>
          <ArrowLeft size={14} /> {integrationEdit ? "Torna alla richiesta" : "Sezione precedente"}
        </Link>
        {integrationEdit ? (
          <div style={{ fontSize: "0.77rem", color: MUTED, fontWeight: 700 }}>Modalita integrazione</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: "0.77rem", color: MUTED }}>Avanzamento: <strong>60%</strong></span>
            <div style={{ width: 180, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "60%", height: "100%", background: accent, borderRadius: 2 }} />
            </div>
          </div>
        )}
        <button className="wizard-nav-button wizard-nav-button-next" type="button" onClick={handleNext} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: accent, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.84rem", cursor: "pointer" }}>
          {integrationEdit ? "Salva e invia integrazione" : "Sezione successiva"} <ArrowRight size={14} />
        </button>
      </div>}
      {auth && <FcrSubmitBar fcr={fcr} token={auth.token!} onSectionSaved={saveSectionProgrammatic} />}
    </div>
  );
}
