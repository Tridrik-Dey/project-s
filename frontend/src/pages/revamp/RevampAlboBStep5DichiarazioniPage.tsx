import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CheckSquare } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { saveRevampApplicationSection } from "../../api/revampApplicationApi";
import { loadRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";

const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR = "#dc2626";
const STEPS_B = ["Dati aziendali", "Struttura", "Servizi", "Certificazioni", "Dichiarazioni"];

type CheckKey =
  | "antimafia"
  | "dlgs231"
  | "regolaritaContributiva"
  | "sicurezza81"
  | "gdpr"
  | "veridicita"
  | "privacy"
  | "codiceEtico"
  | "standardQualita"
  | "consensoAlbo";


const CHECKS_REQUIRED: { key: CheckKey; titolo: string; testo: string }[] = [
  {
    key: "antimafia",
    titolo: "Dichiarazione antimafia (art. 67 D.Lgs. 159/2011)",
    testo: "Il legale rappresentante dichiara l'insussistenza di misure di prevenzione antimafia a carico dell'azienda, degli amministratori e dei soci di maggioranza.",
  },
  {
    key: "dlgs231",
    titolo: "Dichiarazione ex D.Lgs. 231/01",
    testo: "Assenza di condanne o procedimenti penali a carico degli organi apicali per i reati previsti dal D.Lgs. 231/2001.",
  },
  {
    key: "regolaritaContributiva",
    titolo: "Regolarità contributiva e fiscale",
    testo: "Confermata dal DURC allegato e dalla piena regolarità fiscale dell'azienda alla data di iscrizione.",
  },
  {
    key: "sicurezza81",
    titolo: "Conformità D.Lgs. 81/2008 — Salute e Sicurezza",
    testo: "L'azienda adempie a tutti gli obblighi previsti in materia di salute e sicurezza dei lavoratori.",
  },
  {
    key: "gdpr",
    titolo: "Conformità GDPR e nomina DPO (se applicabile)",
    testo: "L'azienda tratta i dati personali in conformità al Regolamento UE 2016/679. Se il DPO è obbligatorio: ne è stato nominato uno e le sue informazioni sono disponibili su richiesta.",
  },
  {
    key: "veridicita",
    titolo: "Dichiarazione di veridicità delle informazioni",
    testo: "Il legale rappresentante certifica la completezza, la veridicità e l'aggiornamento di tutte le informazioni e i documenti forniti.",
  },
  {
    key: "privacy",
    titolo: "Accettazione Privacy Policy Gruppo Solco",
    testo: "Ho letto e accetto la Privacy Policy del Gruppo Solco relativa al trattamento dei dati nell'ambito dell'Albo Fornitori.",
  },
  {
    key: "codiceEtico",
    titolo: "Accettazione Codice Etico Gruppo Solco",
    testo: "Ho letto e accetto il Codice Etico del Gruppo Solco e mi impegno al suo rispetto nell'ambito di qualsiasi rapporto di collaborazione.",
  },
  {
    key: "standardQualita",
    titolo: "Accettazione standard qualità, ambiente e sicurezza",
    testo: "Prendo atto degli standard di qualità, ambientali e di sicurezza richiesti dal Gruppo Solco e mi impegno a rispettarli.",
  },
  {
    key: "consensoAlbo",
    titolo: "Consenso trattamento dati — gestione Albo",
    testo: "Presto il consenso al trattamento dei miei dati aziendali per le finalità connesse alla gestione dell'Albo Fornitori Digitale.",
  },
];

const MODELLO_231_OPTIONS = [
  { value: "adottato_aggiornato", label: "Adottato, approvato e aggiornato nell'ultimo biennio" },
  { value: "adottato_non_aggiornato", label: "Adottato ma non aggiornato nell'ultimo biennio" },
  { value: "non_adottato", label: "Non adottato" },
];

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

export function RevampAlboBStep5DichiarazioniPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [checks, setChecks] = useState<Record<CheckKey, boolean>>(
    Object.fromEntries(CHECKS_REQUIRED.map(c => [c.key, false])) as Record<CheckKey, boolean>
  );
  const [consensoCommerciale, setConsensoCommerciale] = useState(false);
  const [modello231, setModello231] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);

  function toggle(key: CheckKey) {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function allRequiredChecked() {
    return CHECKS_REQUIRED.every(c => checks[c.key]) && !!modello231;
  }

  async function handleInvia() {
    setTriedSubmit(true);
    if (!allRequiredChecked()) return;
    sessionStorage.setItem("revamp_b5_done", "true");
    const payload = {
      dichiarazioni: Object.entries(checks).filter(([, v]) => v).map(([k]) => k),
      modelloOrganizzativo231: modello231,
      consensoComunicazioniCommerciali: consensoCommerciale,
    };
    sessionStorage.setItem("revamp_b5", JSON.stringify(payload));
    if (auth?.token) {
      try {
        const appId = loadRevampApplicationIdForRegistry("ALBO_B");
        if (appId) {
          const apiPayload = {
            ...payload,
            /* Map declaration keys → backend boolean fields */
            antimafiaDeclaration:      checks.antimafia             ?? false,
            dlgs231Declaration:        checks.dlgs231               ?? false,
            fiscalContributionRegularity: checks.regolaritaContributiva ?? false,
            qualityEnvSafetyAccepted:  checks.sicurezza81            ?? false,
            gdprComplianceAndDpo:      checks.gdpr                   ?? false,
            truthfulnessDeclaration:   checks.veridicita             ?? false,
            privacyAccepted:           checks.privacy                ?? false,
            ethicalCodeAccepted:       checks.codiceEtico            ?? false,
            qualityStandardsAccepted:  checks.standardQualita        ?? false,
            alboDataProcessingConsent: checks.consensoAlbo           ?? false,
            marketingConsent:          consensoCommerciale,
            model231Adopted:           modello231 !== "non_adottato" && modello231 !== "",
            noConflictOfInterest:      true,
            noCriminalConvictions:     true,
          };
          await saveRevampApplicationSection(appId, "S5", JSON.stringify(apiPayload), true, auth.token);
        }
      } catch {
        window.alert("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    navigate("/apply/albo-b/recap");
  }

  const missingRequired = triedSubmit && !allRequiredChecked();
  const allChecked = allRequiredChecked();

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
        <div style={{ width: 120 }} />
      </div>

      <StepBar active={4} />

      <div style={{ maxWidth: 860, margin: "28px auto", padding: "0 24px 120px" }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "28px 32px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Sezione 5 — Dichiarazioni e conformità</h2>
          <p style={{ fontSize: "0.82rem", color: MUTED, margin: 0 }}>
            Tutte le dichiarazioni sono rese ai sensi del D.P.R. 445/2000 dal legale rappresentante o da un suo delegato formalmente autorizzato.
            Le dichiarazioni contrassegnate con <span style={{ color: ERR }}>*</span> sono obbligatorie.
          </p>
          <div style={{ height: 1, background: "#f3f4f6", margin: "16px 0 20px" }} />

          {/* Modello 231 */}
          <div style={{ background: "#f0fdf4", border: `1px solid ${GREEN}40`, borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b", marginBottom: 8 }}>
              Adozione Modello Organizzativo ex D.Lgs. 231/01 <span style={{ color: ERR }}>*</span>
            </div>
            <p style={{ fontSize: "0.82rem", color: MUTED, margin: "0 0 12px" }}>
              Indica lo stato di adozione del Modello di Organizzazione, Gestione e Controllo ex D.Lgs. 231/2001.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MODELLO_231_OPTIONS.map(opt => (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", borderRadius: 7, border: `1.5px solid ${modello231 === opt.value ? GREEN : "#e5e7eb"}`, background: modello231 === opt.value ? `${GREEN}0d` : "#fff" }}>
                  <input type="radio" name="modello231" value={opt.value} checked={modello231 === opt.value} onChange={() => setModello231(opt.value)} style={{ accentColor: GREEN, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.85rem", color: modello231 === opt.value ? "#1e293b" : "#4b5563", fontWeight: modello231 === opt.value ? 600 : 400 }}>{opt.label}</span>
                </label>
              ))}
            </div>
            {triedSubmit && !modello231 ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 8 }}>Seleziona un'opzione per procedere.</div> : null}
          </div>

          {/* Required checks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CHECKS_REQUIRED.map(c => {
              const checked = checks[c.key];
              return (
                <label key={c.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "14px 16px", borderRadius: 8, border: `1.5px solid ${checked ? GREEN : triedSubmit && !checked ? ERR : "#e5e7eb"}`, background: checked ? `${GREEN}06` : "#fff", transition: "border-color .15s" }}>
                  <div style={{ marginTop: 1, flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? GREEN : triedSubmit && !checked ? ERR : "#d1d5db"}`, background: checked ? GREEN : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {checked ? <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 900 }}>✓</span> : null}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", marginBottom: 3 }}>
                      {c.titolo} <span style={{ color: ERR }}>*</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 }}>{c.testo}</div>
                  </div>
                  <input type="checkbox" checked={checked} onChange={() => toggle(c.key)} style={{ display: "none" }} />
                </label>
              );
            })}
          </div>

          {/* Optional consent */}
          <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 8, border: `1px solid ${consensoCommerciale ? GREEN : "#e5e7eb"}`, background: consensoCommerciale ? `${GREEN}06` : "#fafafa" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
              <div style={{ marginTop: 1, flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: `2px solid ${consensoCommerciale ? GREEN : "#d1d5db"}`, background: consensoCommerciale ? GREEN : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {consensoCommerciale ? <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 900 }}>✓</span> : null}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", marginBottom: 2 }}>
                  Consenso trattamento dati — comunicazioni commerciali
                  <span style={{ marginLeft: 8, fontSize: "0.72rem", color: MUTED, fontWeight: 400 }}>(opzionale)</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 }}>
                  Acconsento a ricevere comunicazioni su opportunità, bandi e aggiornamenti relativi al Gruppo Solco.
                </div>
              </div>
              <input type="checkbox" checked={consensoCommerciale} onChange={() => setConsensoCommerciale(p => !p)} style={{ display: "none" }} />
            </label>
          </div>

          {/* Progress */}
          <div style={{ marginTop: 20, background: "#f9fafb", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Dichiarazioni obbligatorie</span>
              <span style={{ fontSize: "0.82rem", color: allChecked && modello231 ? GREEN : "#6b7280", fontWeight: 600 }}>
                {CHECKS_REQUIRED.filter(c => checks[c.key]).length + (modello231 ? 1 : 0)}/{CHECKS_REQUIRED.length + 1}
              </span>
            </div>
            <div style={{ height: 5, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${((CHECKS_REQUIRED.filter(c => checks[c.key]).length + (modello231 ? 1 : 0)) / (CHECKS_REQUIRED.length + 1)) * 100}%`, height: "100%", background: GREEN, borderRadius: 3, transition: "width .25s" }} />
            </div>
          </div>

          {missingRequired ? (
            <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", marginTop: 16, fontSize: "0.83rem", color: "#b91c1c" }}>
              ⚠ Accetta tutte le dichiarazioni obbligatorie e compila il campo Modello 231 per procedere.
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="wizard-bottom-nav" style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Link className="wizard-nav-button wizard-nav-button-prev" to="/apply/albo-b/step/4" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: GREEN, textDecoration: "none" }}>
          <ArrowLeft size={15} /> Sezione precedente
        </Link>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: "0.78rem", color: MUTED }}>Avanzamento: <strong>100%</strong></span>
          <div style={{ width: 200, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", background: GREEN, borderRadius: 2 }} />
          </div>
        </div>
        <button className="wizard-nav-button wizard-nav-button-next"
          type="button"
          onClick={() => void handleInvia()}
          disabled={triedSubmit && !allRequiredChecked()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 22px", background: allChecked && modello231 ? GREEN : "#9ca3af", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", transition: "background .15s" }}
        >
          <CheckSquare size={15} /> Vai al riepilogo
        </button>
      </div>
    </div>
  );
}
