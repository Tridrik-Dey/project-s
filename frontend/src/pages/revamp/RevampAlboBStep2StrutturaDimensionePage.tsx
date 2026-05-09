import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, Info, Save } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getMyLatestRevampApplication, getRevampApplicationSections, saveRevampApplicationSection } from "../../api/revampApplicationApi";
import { loadRevampApplicationIdForRegistry, saveRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";
import { clearRevampIntegrationEditSession, isRevampIntegrationEditFor } from "../../utils/revampIntegrationEditSession";
import { completeRevampIntegrationEdit } from "../../utils/revampIntegrationCompletion";
import { ATECO_FORMAT_ERROR, isValidAtecoCode, normalizeAtecoCode } from "../../utils/atecoValidation";
import { loadRevampFcrEditSession } from "../../utils/revampFcrEditSession";
import { useFcrEditMode } from "../../hooks/useFcrEditMode";
import { FcrSubmitBar } from "../../components/supplier/FcrSubmitBar";

const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR = "#dc2626";
const STEPS_B = ["Dati aziendali", "Struttura", "Servizi", "Certificazioni", "Dichiarazioni"];

const FASCE_DIPENDENTI = [
  { value: "solo_titolare", label: "Solo il titolare (ditta individuale)" },
  { value: "2_5",    label: "2 – 5 dipendenti" },
  { value: "6_15",   label: "6 – 15 dipendenti" },
  { value: "16_50",  label: "16 – 50 dipendenti" },
  { value: "51_250", label: "51 – 250 dipendenti" },
  { value: "oltre_250", label: "Oltre 250 dipendenti" },
];

const FASCE_FATTURATO = [
  { value: "sotto_100k",   label: "Sotto 100.000 €" },
  { value: "100k_500k",   label: "100.000 – 500.000 €" },
  { value: "500k_2m",     label: "500.000 – 2.000.000 €" },
  { value: "2m_10m",      label: "2.000.000 – 10.000.000 €" },
  { value: "oltre_10m",   label: "Oltre 10.000.000 €" },
  { value: "non_indicato",label: "Preferisco non indicarlo" },
];

const TIPI_TERZO_SETTORE = [
  { value: "onlus",         label: "ONLUS (regime transitorio)" },
  { value: "aps",           label: "APS — Associazione di Promozione Sociale" },
  { value: "odv",           label: "ODV — Organizzazione di Volontariato" },
  { value: "impresa_sociale",label: "Impresa Sociale" },
  { value: "coop_a",        label: "Cooperativa Sociale Tipo A" },
  { value: "coop_b",        label: "Cooperativa Sociale Tipo B" },
  { value: "coop_ab",       label: "Cooperativa Sociale Tipo A+B" },
  { value: "ente_filantropico", label: "Ente Filantropico" },
  { value: "rete_associativa",  label: "Rete Associativa" },
  { value: "altro_ets",     label: "Altro ETS" },
];

const TIPI_ACCREDITAMENTO = [
  { value: "formazione_professionale", label: "Formazione professionale" },
  { value: "formazione_continua",      label: "Formazione continua" },
  { value: "formazione_superiore",     label: "Formazione superiore" },
  { value: "servizi_al_lavoro",        label: "Servizi al lavoro" },
];

const REGIONI_IT = [
  "Abruzzo","Basilicata","Calabria","Campania","Emilia-Romagna",
  "Friuli-Venezia Giulia","Lazio","Liguria","Lombardia","Marche",
  "Molise","Piemonte","Puglia","Sardegna","Sicilia","Toscana",
  "Trentino-Alto Adige","Umbria","Valle d'Aosta","Veneto",
];

type OnChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

const col: React.CSSProperties   = { display: "flex", flexDirection: "column", gap: 4 };
const lbl: React.CSSProperties   = { fontSize: "0.78rem", fontWeight: 600, color: "#374151" };
const errTxt: React.CSSProperties = { fontSize: "0.74rem", color: ERR };
const baseInput = (error?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 12px", fontSize: "0.88rem",
  border: `1.5px solid ${error ? ERR : "#d1d5db"}`,
  borderRadius: 6, outline: "none", boxSizing: "border-box", color: "#111827", background: "#fff",
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

function SelectField({ label, required, value, onChange, options, error, disabled }: {
  label: string; required?: boolean; value: string; onChange: OnChange;
  options: { value: string; label: string }[]; error?: string; disabled?: boolean;
}) {
  return (
    <div style={col}>
      <span style={lbl}>{label}{required ? <span style={{ color: ERR }}> *</span> : null}</span>
      <select value={value} onChange={onChange} style={baseInput(!!error)} disabled={disabled}>
        <option value="">Seleziona...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function ErrorTooltip({ message }: { message: string }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onFocus={() => setShowTip(true)}
      onBlur={() => setShowTip(false)}
      tabIndex={0}
    >
      <Info size={13} style={{ color: ERR, cursor: "help" }} />
      {showTip ? (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", background: "#991b1b", color: "#fff",
          fontSize: "0.72rem", padding: "5px 8px", borderRadius: 4,
          whiteSpace: "nowrap", pointerEvents: "none", zIndex: 100,
          boxShadow: "0 8px 20px rgba(153, 27, 27, 0.22)"
        }}>{message}</span>
      ) : null}
    </span>
  );
}

export function RevampAlboBStep2StrutturaDimensionePage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const fcr = useFcrEditMode();
  const integrationEdit = isRevampIntegrationEditFor("ALBO_B", 2);

  const [dipendenti,     setDipendenti]     = useState("");
  const [fatturato,      setFatturato]      = useState("");
  const [atecoMain,      setAtecoMain]      = useState("");
  const [atecoSec,       setAtecoSec]       = useState(["", "", ""]);
  const [tuttaItalia,    setTuttaItalia]    = useState(false);
  const [regioni,        setRegioni]        = useState<Set<string>>(new Set());
  const [accreditato,    setAccreditato]    = useState<"si" | "no" | "">("");
  const [accRegioni,     setAccRegioni]     = useState<Set<string>>(new Set());
  const [accTipi,        setAccTipi]        = useState<Set<string>>(new Set());
  const [isTerzoSettore, setIsTerzoSettore] = useState<"si" | "no" | "">("");
  const [tipoEts,        setTipoEts]        = useState("");
  const [runts,          setRunts]          = useState("");
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [savedAt,        setSavedAt]        = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;

    function applyS2(sections: { sectionKey: string; sectionVersion: number; payloadJson: string }[]) {
      const latest = sections
        .filter(s => s.sectionKey === "S2")
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const s2 = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      if (s2.dipendenti)             setDipendenti(s2.dipendenti as string);
      if (s2.fatturato)              setFatturato(s2.fatturato as string);
      if (s2.atecoMain)              setAtecoMain(s2.atecoMain as string);
      if (Array.isArray(s2.atecoSecondari) && s2.atecoSecondari.length) {
        setAtecoSec(prev => {
          const n = [...prev];
          (s2.atecoSecondari as string[]).forEach((v, i) => { if (i < 3) n[i] = v; });
          return n;
        });
      }
      if (s2.tuttaItalia === true) {
        setTuttaItalia(true);
      } else if (Array.isArray(s2.regioni)) {
        const r = s2.regioni as string[];
        if (r.includes("Italia")) { setTuttaItalia(true); }
        else { setRegioni(new Set(r)); }
      }
      if (s2.accreditatoFormazione)               setAccreditato(s2.accreditatoFormazione as "si" | "no");
      if (Array.isArray(s2.accreditamentoRegioni)) setAccRegioni(new Set(s2.accreditamentoRegioni as string[]));
      if (Array.isArray(s2.accreditamentoTipi))    setAccTipi(new Set(s2.accreditamentoTipi as string[]));
      if (s2.isTerzoSettore)                      setIsTerzoSettore(s2.isTerzoSettore as "si" | "no");
      if (s2.tipoEts)                             setTipoEts(s2.tipoEts as string);
      if (s2.runts)                               setRunts(s2.runts as string);
    }

    const fcrSession = loadRevampFcrEditSession();
    const existingAppId = fcrSession?.applicationId ?? loadRevampApplicationIdForRegistry("ALBO_B");
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS2).catch(() => {});
      return;
    }

    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== "ALBO_B") return;
      saveRevampApplicationIdForRegistry("ALBO_B", app.id);
      return getRevampApplicationSections(app.id, auth!.token!).then(applyS2);
    }).catch(() => {});
  }, [auth?.token]);

  function toggleRegione(r: string) {
    setRegioni(prev => { const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n; });
    if (errors.regioni) setErrors(prev => { const n = { ...prev }; delete n.regioni; return n; });
  }
  function toggleAccRegione(r: string) {
    setAccRegioni(prev => { const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n; });
  }
  function toggleAccTipo(t: string) {
    setAccTipi(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  }
  function setAtecoSecItem(idx: number, val: string) {
    setAtecoSec(prev => { const n = [...prev]; n[idx] = val; return n; });
    const key = `atecoSec_${idx}`;
    setErrors(prev => {
      const n = { ...prev };
      if (val.trim() && !isValidAtecoCode(val)) n[key] = ATECO_FORMAT_ERROR;
      else delete n[key];
      return n;
    });
  }

  function readOnlyGroup(key: string) {
    return fcr.active && fcr.isLocked(key);
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!dipendenti) e.dipendenti = "Campo obbligatorio.";
    if (!atecoMain.trim()) e.atecoMain = "Campo obbligatorio.";
    else if (!isValidAtecoCode(atecoMain)) e.atecoMain = ATECO_FORMAT_ERROR;
    atecoSec.forEach((value, index) => {
      if (value.trim() && !isValidAtecoCode(value)) e[`atecoSec_${index}`] = ATECO_FORMAT_ERROR;
    });
    if (!tuttaItalia && regioni.size === 0) e.regioni = "Seleziona almeno una regione di operatività.";
    if (!accreditato) e.accreditato = "Campo obbligatorio.";
    if (accreditato === "si" && accRegioni.size === 0) e.accRegioni = "Seleziona almeno una regione di accreditamento.";
    if (accreditato === "si" && accTipi.size === 0) e.accTipi = "Seleziona almeno un tipo di accreditamento.";
    if (!isTerzoSettore) e.isTerzoSettore = "Campo obbligatorio.";
    if (isTerzoSettore === "si" && !tipoEts) e.tipoEts = "Seleziona il tipo di organizzazione del Terzo Settore.";
    return e;
  }

  function handleSave() {
    const now = new Date();
    setSavedAt(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
  }

  function buildApiPayload() {
    const payload = {
      dipendenti, fatturato, atecoMain: normalizeAtecoCode(atecoMain),
      atecoSecondari: atecoSec.map(normalizeAtecoCode).filter(Boolean),
      regioni: Array.from(regioni),
      accreditatoFormazione: accreditato,
      accreditamentoRegioni: Array.from(accRegioni),
      accreditamentoTipi: Array.from(accTipi),
      isTerzoSettore, tipoEts, runts,
    };
    const EMP_MAP: Record<string, string> = {
      solo_titolare: "E_1_9", "2_5": "E_1_9",
      "6_15": "E_10_49", "16_50": "E_10_49",
      "51_250": "E_50_249", oltre_250: "E_250_PLUS",
    };
    return {
      ...payload,
      employeeRange:    EMP_MAP[dipendenti] ?? dipendenti,
      atecoPrimary:     normalizeAtecoCode(atecoMain),
      atecoSecondary:   atecoSec.map(normalizeAtecoCode).filter(Boolean),
      revenueBand:      fatturato,
      operatingRegions: tuttaItalia ? [{ region: "Italia" }] : Array.from(regioni).map(r => ({ region: r })),
      tuttaItalia: tuttaItalia || undefined,
      thirdSectorType:  isTerzoSettore === "si" ? tipoEts : undefined,
      runtsNumber:      isTerzoSettore === "si" ? runts : undefined,
    };
  }

  async function handleSaveDraft() {
    if (!auth?.token) return;
    try {
      const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry("ALBO_B");
      if (!appId) return;
      await saveRevampApplicationSection(appId, "S2", JSON.stringify(buildApiPayload()), false, auth.token);
      handleSave();
    } catch { /* best-effort */ }
  }

  async function saveSectionProgrammatic() {
    if (!auth?.token) return;
    const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry("ALBO_B");
    if (!appId) return;
    await saveRevampApplicationSection(appId, "S2", JSON.stringify(buildApiPayload()), true, auth.token);
    handleSave();
  }

  async function handleNext() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    handleSave();
    const payload = {
      dipendenti, fatturato, atecoMain: normalizeAtecoCode(atecoMain),
      atecoSecondari: atecoSec.map(normalizeAtecoCode).filter(Boolean),
      regioni: Array.from(regioni),
      accreditatoFormazione: accreditato,
      accreditamentoRegioni: Array.from(accRegioni),
      accreditamentoTipi: Array.from(accTipi),
      isTerzoSettore, tipoEts, runts,
    };
    sessionStorage.setItem("revamp_b2", JSON.stringify(payload));
    let savedAppId: string | null = null;
    if (auth?.token) {
      try {
          const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry("ALBO_B");
          if (appId) {
            savedAppId = appId;
          await saveRevampApplicationSection(appId, "S2", JSON.stringify(buildApiPayload()), true, auth.token);
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
    navigate(integrationEdit?.returnPath ?? "/apply/albo-b/step/3");
  }

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

      {integrationEdit || fcr.active ? (
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "12px 40px", color: "#174f82", fontSize: "0.86rem", fontWeight: 700 }}>
          {fcr.active ? "Richiesta di modifica - Aggiorna solo il gruppo sbloccato, poi salva e invia." : "Integrazione richiesta - Correggi questa sezione, salva e invia la risposta."}
        </div>
      ) : (
        <StepBar active={1} />
      )}

      <div style={{ maxWidth: 1040, margin: "28px auto", padding: "0 24px 120px" }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "28px 32px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Sezione 2 — Struttura, dimensione e settore</h2>
          <p style={{ fontSize: "0.82rem", color: MUTED, margin: "0 0 4px" }}>I campi con <span style={{ color: ERR }}>*</span> sono obbligatori.</p>
          <div style={{ height: 1, background: "#f3f4f6", margin: "16px 0 4px" }} />

          {/* Dimensione */}
          <SectionLabel label="Dimensione aziendale" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <SelectField label="Numero dipendenti (attuale)" required value={dipendenti} disabled={readOnlyGroup("dimensione")} onChange={e => { setDipendenti(e.target.value); if (errors.dipendenti) setErrors(p => { const n={...p}; delete n.dipendenti; return n; }); }} options={FASCE_DIPENDENTI} error={errors.dipendenti} />
            <SelectField label="Fatturato ultimo esercizio chiuso" value={fatturato} disabled={readOnlyGroup("dimensione")} onChange={e => setFatturato(e.target.value)} options={FASCE_FATTURATO} />
          </div>

          {/* ATECO */}
          <SectionLabel label="Codici ATECO" />
          <div style={{ marginBottom: 12 }}>
            <span style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}>
              Codice ATECO principale <span style={{ color: ERR }}>*</span>
              {errors.atecoMain === ATECO_FORMAT_ERROR ? <ErrorTooltip message={errors.atecoMain} /> : null}
            </span>
            <input
              value={atecoMain} onChange={e => {
                const value = e.target.value;
                setAtecoMain(value);
                setErrors(p => {
                  const n = { ...p };
                  if (value.trim() && !isValidAtecoCode(value)) n.atecoMain = ATECO_FORMAT_ERROR;
                  else delete n.atecoMain;
                  return n;
                });
              }}
              placeholder="Es. 85.59 — Altre attività di istruzione n.c.a."
              disabled={readOnlyGroup("ateco_b")}
              style={{ ...baseInput(!!errors.atecoMain), marginTop: 4 }}
            />
            {errors.atecoMain && errors.atecoMain !== ATECO_FORMAT_ERROR ? <span style={errTxt}>{errors.atecoMain}</span> : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[0,1,2].map(i => (
              <div key={i} style={col}>
                <span style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}>
                  ATECO secondario {i+1} <span style={{ fontWeight: 400, color: MUTED }}>(opzionale)</span>
                  {errors[`atecoSec_${i}`] === ATECO_FORMAT_ERROR ? <ErrorTooltip message={errors[`atecoSec_${i}`]} /> : null}
                </span>
                <input value={atecoSec[i]} onChange={e => setAtecoSecItem(i, e.target.value)} disabled={readOnlyGroup("ateco_b")} placeholder={`Codice ATECO secondario ${i+1}`} style={baseInput(!!errors[`atecoSec_${i}`])} />
              </div>
            ))}
          </div>

          {/* Regioni */}
          <SectionLabel label="Regioni di operatività" />
          <p style={{ fontSize: "0.82rem", color: MUTED, marginBottom: 10 }}>Seleziona tutte le regioni in cui l'azienda opera in modo stabile. <span style={{ color: ERR }}>*</span></p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", padding: "7px 16px", borderRadius: 6, background: tuttaItalia ? GREEN : "#f0fdf4", border: `1.5px solid ${tuttaItalia ? GREEN : "#86efac"}`, fontWeight: 700, fontSize: "0.84rem", color: tuttaItalia ? "#fff" : GREEN, transition: "background .15s, color .15s", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={tuttaItalia}
              disabled={readOnlyGroup("regioni_op")}
              onChange={() => {
                setTuttaItalia(v => !v);
                if (!tuttaItalia) setRegioni(new Set());
                if (errors.regioni) setErrors(prev => { const n = { ...prev }; delete n.regioni; return n; });
              }}
              style={{ accentColor: "#fff", width: 15, height: 15 }}
            />
            Tutta Italia
          </label>
          {!tuttaItalia && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 8 }}>
                {REGIONI_IT.map(r => (
                  <label key={r} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", cursor: "pointer", padding: "6px 8px", borderRadius: 6, background: regioni.has(r) ? `${GREEN}0d` : "#f9fafb", border: `1px solid ${regioni.has(r) ? GREEN : "#e5e7eb"}`, transition: "background .12s" }}>
                    <input type="checkbox" checked={regioni.has(r)} disabled={readOnlyGroup("regioni_op")} onChange={() => toggleRegione(r)} style={{ accentColor: GREEN }} /> {r}
                  </label>
                ))}
              </div>
              {regioni.size > 0 ? <div style={{ fontSize: "0.78rem", color: "#16a34a", marginBottom: 4 }}>✓ {regioni.size} {regioni.size === 1 ? "regione selezionata" : "regioni selezionate"}</div> : null}
            </>
          )}
          {errors.regioni ? <div style={{ fontSize: "0.74rem", color: ERR, marginBottom: 12 }}>{errors.regioni}</div> : null}

          {/* Accreditamento formazione */}
          <SectionLabel label="Accreditamento per la formazione (Regionale)" />
          <div style={{ marginBottom: 12 }}>
            <span style={lbl}>Ente accreditato per la formazione? <span style={{ color: ERR }}>*</span></span>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {(["si","no"] as const).map(v => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 16px", borderRadius: 6, border: `1.5px solid ${accreditato === v ? GREEN : "#e5e7eb"}`, background: accreditato === v ? `${GREEN}0d` : "#fff" }}>
                  <input type="radio" name="accreditato" value={v} checked={accreditato === v} disabled={readOnlyGroup("acc_formazione")} onChange={() => { setAccreditato(v); if (errors.accreditato) setErrors(p => { const n={...p}; delete n.accreditato; return n; }); }} style={{ accentColor: GREEN }} />
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: accreditato === v ? GREEN : "#374151" }}>{v === "si" ? "Sì" : "No"}</span>
                </label>
              ))}
            </div>
            {errors.accreditato ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 4 }}>{errors.accreditato}</div> : null}
          </div>
          {accreditato === "si" ? (
            <div style={{ background: "#f0fdf4", border: `1px solid ${GREEN}40`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
              <p style={{ fontSize: "0.82rem", color: MUTED, marginBottom: 12 }}>Seleziona le regioni e il tipo di accreditamento. Allega il provvedimento nella sezione documenti.</p>
              <div style={{ marginBottom: 12 }}>
                <span style={lbl}>Regioni di accreditamento <span style={{ color: ERR }}>*</span></span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 6 }}>
                  {REGIONI_IT.map(r => (
                    <label key={r} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", cursor: "pointer", padding: "4px 6px", borderRadius: 5, background: accRegioni.has(r) ? `${GREEN}0d` : "#fff", border: `1px solid ${accRegioni.has(r) ? GREEN : "#e5e7eb"}` }}>
                      <input type="checkbox" checked={accRegioni.has(r)} disabled={readOnlyGroup("acc_formazione")} onChange={() => toggleAccRegione(r)} style={{ accentColor: GREEN }} /> {r}
                    </label>
                  ))}
                </div>
                {errors.accRegioni ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 4 }}>{errors.accRegioni}</div> : null}
              </div>
              <div>
                <span style={lbl}>Tipo di accreditamento <span style={{ color: ERR }}>*</span></span>
                <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  {TIPI_ACCREDITAMENTO.map(t => (
                    <label key={t.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", cursor: "pointer", padding: "6px 12px", borderRadius: 6, border: `1px solid ${accTipi.has(t.value) ? GREEN : "#e5e7eb"}`, background: accTipi.has(t.value) ? `${GREEN}0d` : "#fff" }}>
                      <input type="checkbox" checked={accTipi.has(t.value)} disabled={readOnlyGroup("acc_formazione")} onChange={() => toggleAccTipo(t.value)} style={{ accentColor: GREEN }} /> {t.label}
                    </label>
                  ))}
                </div>
                {errors.accTipi ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 4 }}>{errors.accTipi}</div> : null}
              </div>
            </div>
          ) : null}

          {/* Terzo Settore */}
          <SectionLabel label="Terzo Settore" />
          <div style={{ marginBottom: 12 }}>
            <span style={lbl}>L'organizzazione appartiene al Terzo Settore? <span style={{ color: ERR }}>*</span></span>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {(["si","no"] as const).map(v => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 16px", borderRadius: 6, border: `1.5px solid ${isTerzoSettore === v ? GREEN : "#e5e7eb"}`, background: isTerzoSettore === v ? `${GREEN}0d` : "#fff" }}>
                  <input type="radio" name="terzoSettore" value={v} checked={isTerzoSettore === v} disabled={readOnlyGroup("terzo_settore")} onChange={() => { setIsTerzoSettore(v); if (errors.isTerzoSettore) setErrors(p => { const n={...p}; delete n.isTerzoSettore; return n; }); }} style={{ accentColor: GREEN }} />
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: isTerzoSettore === v ? GREEN : "#374151" }}>{v === "si" ? "Sì" : "No"}</span>
                </label>
              ))}
            </div>
            {errors.isTerzoSettore ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 4 }}>{errors.isTerzoSettore}</div> : null}
          </div>
          {isTerzoSettore === "si" ? (
            <div style={{ background: "#f0fdf4", border: `1px solid ${GREEN}40`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={col}>
                  <span style={lbl}>Tipo di organizzazione ETS <span style={{ color: ERR }}>*</span></span>
                  <select value={tipoEts} disabled={readOnlyGroup("terzo_settore")} onChange={e => { setTipoEts(e.target.value); if (errors.tipoEts) setErrors(p => { const n={...p}; delete n.tipoEts; return n; }); }} style={baseInput(!!errors.tipoEts)}>
                    <option value="">Seleziona...</option>
                    {TIPI_TERZO_SETTORE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {errors.tipoEts ? <span style={errTxt}>{errors.tipoEts}</span> : null}
                </div>
                <div style={col}>
                  <span style={lbl}>N. iscrizione RUNTS <span style={{ fontWeight: 400, color: MUTED }}>(opzionale)</span></span>
                  <input value={runts} disabled={readOnlyGroup("terzo_settore")} onChange={e => setRunts(e.target.value)} placeholder="Numero e sezione di iscrizione al RUNTS" style={baseInput()} />
                </div>
              </div>
            </div>
          ) : null}

          {/* Error summary */}
          {errorCount > 0 ? (
            <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 6, padding: "12px 16px", marginTop: 8 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#92400e" }}>⚠ {errorCount} {errorCount === 1 ? "campo richiede attenzione" : "campi richiedono attenzione"}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom nav */}
      {!fcr.active && <div className="wizard-bottom-nav" style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Link className="wizard-nav-button wizard-nav-button-prev" to={integrationEdit?.returnPath ?? "/apply/albo-b"} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: GREEN, textDecoration: "none" }}>
          <ArrowLeft size={15} /> {integrationEdit ? "Torna alla richiesta" : "Sezione precedente"}
        </Link>
        {integrationEdit ? (
          <div style={{ fontSize: "0.82rem", color: MUTED, fontWeight: 700 }}>Modalita integrazione</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: "0.78rem", color: MUTED }}>Avanzamento: <strong>40%</strong></span>
            <div style={{ width: 200, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "40%", height: "100%", background: GREEN, borderRadius: 2 }} />
            </div>
          </div>
        )}
        <button className="wizard-nav-button wizard-nav-button-next" type="button" onClick={() => void handleNext()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: GREEN, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
          {integrationEdit ? "Salva e invia integrazione" : "Sezione successiva"} <ArrowRight size={15} />
        </button>
      </div>}
      {auth && <FcrSubmitBar fcr={fcr} token={auth.token!} onSectionSaved={saveSectionProgrammatic} />}
    </div>
  );
}
