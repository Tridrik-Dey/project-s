import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckSquare } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getRevampApplicationSections, saveRevampApplicationSection } from "../../api/revampApplicationApi";
import { loadRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";
import { loadRevampFcrEditSession } from "../../utils/revampFcrEditSession";
import { useFcrEditMode } from "../../hooks/useFcrEditMode";
import { FcrSubmitBar } from "../../components/supplier/FcrSubmitBar";

const NAVY  = "#0f2a52";
const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR   = "#dc2626";

const STEPS = ["Anagrafica", "Tipologia", "Competenze", "Disponibilità", "Dichiarazioni"];

/* ─── declaration definitions ────────────────────── */
type Decl = {
  id: string;
  title: string;
  text: string;
  required: boolean | "docente";
  link?: { label: string };
};

const DECLARATIONS: Decl[] = [
  /* ── DICHIARAZIONI LEGALI ── */
  {
    id: "condannePenali",
    title: "Dichiarazione assenza condanne penali ostative",
    text: "Dichiaro, ai sensi del D.P.R. 445/2000, di non aver riportato condanne penali passate in giudicato per reati che costituirebbero causa ostativa all'esercizio dell'attività professionale o alla collaborazione con il Gruppo Solco e le sue società.",
    required: true,
  },
  {
    id: "conflittiInteresse",
    title: "Dichiarazione assenza conflitti di interesse",
    text: "Dichiaro l'assenza di rapporti di lavoro, parentela, interessi economici o qualsiasi altra relazione che possa configurare un conflitto di interesse con le società del Gruppo Solco al momento della presente iscrizione all'Albo Fornitori.",
    required: true,
  },
  {
    id: "veridicitaInfo",
    title: "Dichiarazione veridicità delle informazioni",
    text: "Dichiaro che tutte le informazioni, i documenti e le dichiarazioni fornite nel presente questionario sono veritieri, aggiornati e completi. Mi impegno a notificare al Gruppo Solco qualsiasi variazione rilevante entro 30 giorni dall'evento.",
    required: true,
  },
  /* ── PRIVACY E CONSENSI — GDPR ── */
  {
    id: "privacyPolicy",
    title: "Accettazione Privacy Policy — Informativa ex art. 13 GDPR",
    text: "Presa visione e accettazione dell'informativa sul trattamento dei dati personali del Gruppo Solco ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR). I dati saranno trattati per le finalità indicate nell'informativa.",
    required: true,
    link: { label: "Leggi l'informativa completa →" },
  },
  {
    id: "consensoAlbo",
    title: "Consenso al trattamento per gestione Albo Fornitori",
    text: "Acconsento al trattamento dei miei dati personali per le finalità di selezione, gestione e contrattualizzazione dei fornitori, inclusa la comunicazione dei dati tra le società del Gruppo Solco.",
    required: true,
  },
  {
    id: "consensoMarketing",
    title: "Consenso per comunicazioni commerciali",
    text: "Acconsento all'invio di newsletter, aggiornamenti su opportunità di collaborazione e comunicazioni promozionali del Gruppo Solco. Il consenso è facoltativo e revocabile in qualsiasi momento.",
    required: false,
  },
  /* ── CODICE ETICO E STANDARD GRUPPO SOLCO ── */
  {
    id: "codiceEtico",
    title: "Accettazione Codice Etico Gruppo Solco",
    text: "Principi di correttezza, trasparenza, non discriminazione e responsabilità sociale. Mi impegno al rispetto dei principi etici, comportamentali e deontologici descritti nel Codice Etico del Gruppo Solco per tutta la durata del rapporto.",
    required: true,
    link: { label: "Leggi il Codice Etico →" },
  },
  {
    id: "standardQualita",
    title: "Accettazione standard qualità, ambiente e sicurezza",
    text: "Conformità agli standard del Gruppo in materia di gestione della qualità (ISO 9001), ambiente (ISO 14001) e salute e sicurezza (D.Lgs. 81/2008), nei limiti applicabili all'attività professionale svolta.",
    required: true,
    link: { label: "Leggi gli standard →" },
  },
  {
    id: "dlgs81",
    title: "Conformità D.Lgs. 81/2008 — Salute e Sicurezza",
    text: "Dichiaro di essere a conoscenza degli obblighi previsti dal D.Lgs. 81/2008 in materia di salute e sicurezza nei luoghi di lavoro e di adempiervi per quanto di competenza nella propria attività professionale.",
    required: "docente",
  },
];

const SECTION_LABELS: Record<string, string> = {
  condannePenali: "DICHIARAZIONI LEGALI",
  privacyPolicy:  "PRIVACY E CONSENSI — GDPR",
  codiceEtico:    "CODICE ETICO E STANDARD GRUPPO SOLCO",
};

/* ─── helpers ────────────────────────────────────── */
function StepBar({ active, accent }: { active: number; accent: string }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 40px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{ position: "absolute", top: 17, left: "10%", right: "10%", height: 2, background: "#e5e7eb", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 17, left: "10%", width: "80%", height: 2, background: accent, zIndex: 0 }} />
        {STEPS.map((step, i) => {
          const done = i < active; const cur = i === active;
          return (
            <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, zIndex: 1 }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: done || cur ? accent : "#fff", border: `2px solid ${done || cur ? accent : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.82rem", color: done || cur ? "#fff" : "#9ca3af" }}>
                {done ? "✓" : i + 1}
              </span>
              <span style={{ fontSize: "0.7rem", color: cur ? accent : done ? accent : "#9ca3af", fontWeight: cur || done ? 600 : 400, textAlign: "center" }}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── main component ─────────────────────────────── */
type Checks = Record<string, boolean>;

export function RevampStep5DichiarazioniPage() {
  const navigate = useNavigate();
  const { registryType: registryParam } = useParams();
  const { auth } = useAuth();
  const isA = registryParam === "albo-a";
  const isB = registryParam === "albo-b";
  if (!isA && !isB) return <Navigate to="/apply" replace />;

  const tipologia = sessionStorage.getItem("revamp_tipologia") ?? "";
  const isDocente = isA && tipologia === "docente";
  const accent    = isA ? NAVY : GREEN;
  const title     = isA ? "Albo A — Professionisti" : "Albo B — Aziende";
  const registryType = isA ? "ALBO_A" : "ALBO_B";
  const fcr = useFcrEditMode();

  const [checks,       setChecks]       = useState<Checks>(() =>
    Object.fromEntries(DECLARATIONS.map(d => [d.id, false]))
  );
  const [triedSubmit, setTriedSubmit] = useState(false);

  useEffect(() => {
    if (!auth?.token) return;
    const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
    if (!appId) return;
    getRevampApplicationSections(appId, auth.token).then(sections => {
      const latest = sections.filter(s => s.sectionKey === "S5").sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const payload = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      const declarations = Array.isArray(payload.declarations) ? payload.declarations as string[] : [];
      setChecks(prev => {
        const next = { ...prev };
        for (const id of declarations) next[id] = true;
        if (typeof payload.noCriminalConvictions === "boolean") next.condannePenali = payload.noCriminalConvictions;
        if (typeof payload.noConflictOfInterest === "boolean") next.conflittiInteresse = payload.noConflictOfInterest;
        if (typeof payload.truthfulnessDeclaration === "boolean") next.veridicitaInfo = payload.truthfulnessDeclaration;
        if (typeof payload.privacyAccepted === "boolean") next.privacyPolicy = payload.privacyAccepted;
        if (typeof payload.alboDataProcessingConsent === "boolean") next.consensoAlbo = payload.alboDataProcessingConsent;
        if (typeof payload.marketingConsent === "boolean") next.consensoMarketing = payload.marketingConsent;
        if (typeof payload.ethicalCodeAccepted === "boolean") next.codiceEtico = payload.ethicalCodeAccepted;
        if (typeof payload.qualityEnvSafetyAccepted === "boolean") next.standardQualita = payload.qualityEnvSafetyAccepted;
        if (typeof payload.dlgs81ComplianceWhenInPresence === "boolean") next.dlgs81 = payload.dlgs81ComplianceWhenInPresence;
        return next;
      });
    }).catch(() => {});
  }, [auth?.token, registryType]);

  function toggle(id: string) {
    setChecks(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function isRequired(d: Decl): boolean {
    if (d.required === "docente") return isDocente;
    return d.required;
  }

  function allRequiredChecked(): boolean {
    return DECLARATIONS.filter(isRequired).every(d => checks[d.id]);
  }

  async function handleInvia() {
    setTriedSubmit(true);
    if (!allRequiredChecked()) return;
    sessionStorage.setItem("revamp_s5_done", "true");
    if (auth?.token) {
      try {
        const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
        if (appId) {
          const frontendPayload = { declarations: Object.entries(checks).filter(([, v]) => v).map(([k]) => k) };
          let apiPayload: Record<string, unknown> = { ...frontendPayload };
          if (isA) {
            /* Map declaration IDs to backend boolean field names */
            apiPayload = {
              ...frontendPayload,
              noCriminalConvictions:         checks.condannePenali      ?? false,
              noConflictOfInterest:          checks.conflittiInteresse  ?? false,
              truthfulnessDeclaration:       checks.veridicitaInfo      ?? false,
              privacyAccepted:               checks.privacyPolicy       ?? false,
              alboDataProcessingConsent:     checks.consensoAlbo        ?? false,
              marketingConsent:              checks.consensoMarketing    ?? false,
              ethicalCodeAccepted:           checks.codiceEtico         ?? false,
              qualityEnvSafetyAccepted:      checks.standardQualita     ?? false,
              dlgs81ComplianceWhenInPresence: checks.dlgs81             ?? false,
            };
          }
          await saveRevampApplicationSection(appId, "S5", JSON.stringify(apiPayload), true, auth.token);
        }
      } catch {
        window.alert("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    navigate(`/apply/${registryParam}/recap`);
  }

  async function saveSectionProgrammatic() {
    if (!auth?.token) throw new Error("Sessione scaduta. Effettua nuovamente il login.");
    const appId = loadRevampFcrEditSession()?.applicationId ?? loadRevampApplicationIdForRegistry(registryType);
    if (!appId) throw new Error("Candidatura non trovata.");
    const frontendPayload = { declarations: Object.entries(checks).filter(([, v]) => v).map(([k]) => k) };
    await saveRevampApplicationSection(appId, "S5", JSON.stringify({
      ...frontendPayload,
      noCriminalConvictions:         checks.condannePenali      ?? false,
      noConflictOfInterest:          checks.conflittiInteresse  ?? false,
      truthfulnessDeclaration:       checks.veridicitaInfo      ?? false,
      privacyAccepted:               checks.privacyPolicy       ?? false,
      alboDataProcessingConsent:     checks.consensoAlbo        ?? false,
      marketingConsent:              checks.consensoMarketing    ?? false,
      ethicalCodeAccepted:           checks.codiceEtico         ?? false,
      qualityEnvSafetyAccepted:      checks.standardQualita     ?? false,
      dlgs81ComplianceWhenInPresence: checks.dlgs81             ?? false,
    }), true, auth.token);
  }

  const checkedRequired = DECLARATIONS.filter(isRequired).filter(d => checks[d.id]).length;
  const totalRequired   = DECLARATIONS.filter(isRequired).length;
  const allDone         = checkedRequired === totalRequired;

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>

      {/* ── Inner header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, background: "#f5c800", borderRadius: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          </span>
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "#1a1a2e" }}>Solco<sup style={{ color: "#f5c800", fontSize: "0.5rem", verticalAlign: "super" }}>+</sup></span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>{title}</div>
          <div style={{ fontSize: "0.73rem", color: MUTED }}>Sezione 5 di 5 · Dichiarazioni e Consensi</div>
        </div>
        <span style={{ fontSize: "0.77rem", fontWeight: 700, color: accent, background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 20, padding: "4px 12px" }}>
          Sezione 5 di 5
        </span>
      </div>

      {fcr.active ? (
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "12px 40px", color: "#174f82", fontSize: "0.86rem", fontWeight: 700 }}>
          Richiesta di modifica - Aggiorna solo il gruppo sbloccato, poi salva e invia.
        </div>
      ) : <StepBar active={4} accent={accent} />}

      {/* ── Main content ── */}
      <div style={{ maxWidth: 900, margin: "24px auto", padding: "0 24px 110px" }}>

        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1e293b", margin: "0 0 6px" }}>
          Sezione 5 — Dichiarazioni e Consensi
        </h2>
        <p style={{ fontSize: "0.85rem", color: MUTED, margin: "0 0 24px", lineHeight: 1.5 }}>
          Leggi attentamente ogni dichiarazione. Le voci obbligatorie (<span style={{ color: ERR }}>*</span>) devono essere accettate per completare l'iscrizione.
        </p>

        {/* Declarations */}
        <div className={fcr.active ? (fcr.isLocked("dichiarazioni") ? "fcr-locked" : "fcr-active-group") : undefined} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          {DECLARATIONS.map((decl, idx) => {
            const req          = isRequired(decl);
            const checked      = checks[decl.id];
            const hasErr       = triedSubmit && req && !checked;
            const sectionLabel = SECTION_LABELS[decl.id];

            return (
              <div key={decl.id}>
                {sectionLabel && (
                  <div style={{ background: "#f8fafc", borderTop: idx > 0 ? "1px solid #e5e7eb" : "none", borderBottom: "1px solid #e5e7eb", padding: "10px 24px" }}>
                    <span style={{ fontSize: "0.69rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {sectionLabel}
                    </span>
                  </div>
                )}

                <div
                  onClick={() => toggle(decl.id)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "16px 24px", cursor: "pointer",
                    background: checked ? `${accent}04` : hasErr ? "#fff5f5" : "#fff",
                    borderBottom: idx < DECLARATIONS.length - 1 ? "1px solid #f1f5f9" : "none",
                    transition: "background .12s",
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    background: checked ? accent : "#fff",
                    border: `2px solid ${checked ? accent : hasErr ? ERR : "#d1d5db"}`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    transition: "background .12s, border-color .12s",
                  }}>
                    {checked && <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </span>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: checked ? accent : hasErr ? ERR : "#1e293b", marginBottom: 4, lineHeight: 1.3 }}>
                      {decl.title}
                      {req ? <span style={{ color: ERR }}> *</span> : <span style={{ fontWeight: 400, color: MUTED, fontSize: "0.78rem" }}> (facoltativo)</span>}
                    </div>
                    <p style={{ fontSize: "0.81rem", color: "#4b5563", margin: 0, lineHeight: 1.55 }}>
                      {decl.text}
                    </p>
                    {decl.link && (
                      <a href="#" onClick={e => e.stopPropagation()} style={{ display: "inline-block", marginTop: 6, fontSize: "0.79rem", color: accent, textDecoration: "underline" }}>
                        {decl.link.label}
                      </a>
                    )}
                    {hasErr && (
                      <div style={{ marginTop: 5, fontSize: "0.75rem", color: ERR, fontWeight: 600 }}>
                        ⚠ Questa dichiarazione è obbligatoria.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(checkedRequired / totalRequired) * 100}%`, height: "100%", background: allDone ? "#16a34a" : accent, borderRadius: 3, transition: "width .3s" }} />
          </div>
          <span style={{ fontSize: "0.78rem", color: allDone ? "#16a34a" : MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>
            {checkedRequired} / {totalRequired} dichiarazioni obbligatorie accettate
          </span>
        </div>
      </div>

      {/* ── Bottom nav ── */}
      {!fcr.active && <div className="wizard-bottom-nav" style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 36px", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Link className="wizard-nav-button wizard-nav-button-prev"
          to={`/apply/${registryParam}/step/4`}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${accent}`, borderRadius: 6, fontWeight: 600, fontSize: "0.84rem", color: accent, textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Sezione precedente
        </Link>

        <div style={{ flex: 1, textAlign: "center", padding: "0 24px" }}>
          {!allDone && triedSubmit ? (
            <span style={{ fontSize: "0.78rem", color: ERR, fontWeight: 500 }}>
              ⚠ Verifica che tutte le dichiarazioni obbligatorie siano accettate prima di procedere.
            </span>
          ) : !allDone ? (
            <span style={{ fontSize: "0.78rem", color: MUTED }}>
              Accetta tutte le dichiarazioni obbligatorie per continuare.
            </span>
          ) : (
            <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: 600 }}>
              ✓ Tutte le dichiarazioni obbligatorie sono accettate.
            </span>
          )}
        </div>

        <button className="wizard-nav-button wizard-nav-button-next"
          type="button"
          onClick={handleInvia}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "10px 22px",
            background: allDone ? "#16a34a" : "#9ca3af",
            color: "#fff", border: "none", borderRadius: 6,
            fontWeight: 700, fontSize: "0.88rem",
            cursor: allDone ? "pointer" : "not-allowed",
            transition: "background .2s",
          }}
        >
          <CheckSquare size={16} /> Vai al riepilogo
        </button>
      </div>}
      {auth && <FcrSubmitBar fcr={fcr} token={auth.token!} onSectionSaved={saveSectionProgrammatic} />}
    </div>
  );
}
