import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, Save } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getMyLatestRevampApplication, getRevampApplicationSections, saveRevampApplicationSection } from "../../api/revampApplicationApi";
import { loadRevampApplicationIdForRegistry, saveRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";
import { clearRevampIntegrationEditSession, isRevampIntegrationEditFor } from "../../utils/revampIntegrationEditSession";
import { completeRevampIntegrationEdit } from "../../utils/revampIntegrationCompletion";

const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR = "#dc2626";
const STEPS_B = ["Dati aziendali", "Struttura", "Servizi", "Certificazioni", "Dichiarazioni"];

type CatKey = "A" | "B" | "C" | "D" | "E";

const CATEGORIE: { key: CatKey; titolo: string; tag: string; voci: string[] }[] = [
  {
    key: "A", titolo: "Formazione, didattica e contenuti", tag: "Categoria A",
    voci: [
      "Progettazione didattica / Instructional Design",
      "Erogazione formazione in aula (in presenza)",
      "Formazione online sincrona (webinar, videoconferenza)",
      "Produzione contenuti e-learning (SCORM, video, H5P)",
      "Sviluppo, implementazione e gestione piattaforme LMS",
      "Progettazione e gestione corsi finanziati (FSE, fondi interprofessionali)",
      "Formazione per disoccupati / politiche attive del lavoro",
      "Assessment e testing delle competenze",
      "Simulatori, realtà virtuale e aumentata per training",
      "Traduzione e localizzazione di contenuti formativi",
    ],
  },
  {
    key: "B", titolo: "HR, Lavoro e Organizzazione", tag: "Categoria B",
    voci: [
      "Ricerca e selezione del personale",
      "Somministrazione di lavoro (APL autorizzata)",
      "Outplacement e ricollocazione professionale",
      "Payroll e amministrazione del personale",
      "Welfare aziendale — piattaforme e servizi",
      "Consulenza organizzativa HR / change management",
      "Sviluppo organizzativo e talent management",
      "Coaching e sviluppo manageriale (strutturato)",
    ],
  },
  {
    key: "C", titolo: "Tecnologia e digitale", tag: "Categoria C",
    voci: [
      "Sviluppo software / applicazioni custom",
      "Sistemi informativi HR (HRIS, ATS, LMS, TMS)",
      "Digital marketing, SEO, comunicazione digitale",
      "Cybersecurity e protezione dei dati",
      "UX/UI design, prototipazione e ricerca utente",
      "Analisi dati, business intelligence e dashboard",
      "Infrastrutture cloud, IT managed services, help desk",
      "Intelligenza artificiale applicata e automazione",
    ],
  },
  {
    key: "D", titolo: "Consulenza, professioni e compliance", tag: "Categoria D",
    voci: [
      "Consulenza del lavoro (studio associato o srl)",
      "Consulenza fiscale, tributaria e contabile",
      "Consulenza legale e studio legale",
      "Finanza agevolata, bandi e contributi pubblici",
      "Consulenza di direzione e sviluppo strategico",
      "Audit, revisione e sistemi di gestione qualità",
      "Compliance (D.Lgs. 231/01, GDPR, ESG, B Corp)",
      "Servizi per il Terzo Settore (governance, rendicontazione, bilancio sociale)",
      "Ricerca sociale, valutazione di impatto, monitoraggio",
    ],
  },
  {
    key: "E", titolo: "Servizi generali e operativi", tag: "Categoria E",
    voci: [
      "Fornitura materiali didattici, editoriali e tipografici",
      "Comunicazione, grafica, produzione video e foto",
      "Organizzazione eventi, congressi e fiere",
      "Logistica, trasferte e travel management",
      "Gestione sedi e facility management",
      "Catering, ristorazione e hospitality",
      "Noleggio attrezzature (audio/video, allestimenti)",
      "Servizi di segreteria, reception e back office",
      "Traduzioni e interpretariato",
    ],
  },
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

export function RevampAlboBStep3ServiziPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const integrationEdit = isRevampIntegrationEditFor("ALBO_B", 3);

  const [vociSelezionate, setVociSelezionate] = useState<Record<CatKey, Set<string>>>({
    A: new Set(), B: new Set(), C: new Set(), D: new Set(), E: new Set(),
  });
  const [descrizioni, setDescrizioni] = useState<Record<CatKey, string>>({
    A: "", B: "", C: "", D: "", E: "",
  });
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;

    function applyS3(sections: { sectionKey: string; sectionVersion: number; payloadJson: string }[]) {
      const latest = sections
        .filter(s => s.sectionKey === "S3")
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const s3 = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      const cats = s3.categorie as Record<string, { voci: string[]; descrizione: string }> | undefined;
      if (!cats) return;
      setVociSelezionate(prev => {
        const n = { ...prev };
        for (const key of Object.keys(cats) as CatKey[]) {
          if (Array.isArray(cats[key]?.voci)) n[key] = new Set(cats[key].voci);
        }
        return n;
      });
      setDescrizioni(prev => {
        const n = { ...prev };
        for (const key of Object.keys(cats) as CatKey[]) {
          if (typeof cats[key]?.descrizione === "string") n[key] = cats[key].descrizione;
        }
        return n;
      });
    }

    const existingAppId = loadRevampApplicationIdForRegistry("ALBO_B");
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS3).catch(() => {});
      return;
    }

    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== "ALBO_B") return;
      saveRevampApplicationIdForRegistry("ALBO_B", app.id);
      return getRevampApplicationSections(app.id, auth!.token!).then(applyS3);
    }).catch(() => {});
  }, [auth?.token]);

  function toggleVoce(cat: CatKey, voce: string) {
    setVociSelezionate(prev => {
      const n = { ...prev, [cat]: new Set(prev[cat]) };
      n[cat].has(voce) ? n[cat].delete(voce) : n[cat].add(voce);
      return n;
    });
  }

  function setDesc(cat: CatKey, val: string) {
    setDescrizioni(prev => ({ ...prev, [cat]: val }));
  }

  const totalSelezionate = Object.values(vociSelezionate).reduce((s, v) => s + v.size, 0);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (totalSelezionate === 0) e.global = "Seleziona almeno una voce di servizio per completare questa sezione.";
    for (const cat of CATEGORIE) {
      if (vociSelezionate[cat.key].size > 0 && !descrizioni[cat.key].trim()) {
        e[`desc_${cat.key}`] = "Descrizione obbligatoria se almeno una voce è selezionata.";
      }
      if (descrizioni[cat.key].length > 400) {
        e[`desc_${cat.key}`] = "Massimo 400 caratteri.";
      }
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
      const appId = loadRevampApplicationIdForRegistry("ALBO_B");
      if (!appId) return;
      const categorieData = Object.fromEntries(
        CATEGORIE.map(c => [c.key, { voci: Array.from(vociSelezionate[c.key]), descrizione: descrizioni[c.key] }])
      );
      await saveRevampApplicationSection(appId, "S3", JSON.stringify({ categorie: categorieData }), false, auth.token);
      handleSave();
    } catch { /* best-effort */ }
  }

  async function handleNext() {
    setTriedSubmit(true);
    const errs = validate();
    if (Object.keys(errs).length) return;
    handleSave();
    const categorieData = Object.fromEntries(
      CATEGORIE.map(c => [c.key, { voci: Array.from(vociSelezionate[c.key]), descrizione: descrizioni[c.key] }])
    );
    const payload = { categorie: categorieData };
    sessionStorage.setItem("revamp_b3", JSON.stringify(payload));
    let savedAppId: string | null = null;
    if (auth?.token) {
      try {
        const appId = loadRevampApplicationIdForRegistry("ALBO_B");
        if (appId) {
          savedAppId = appId;
          /* Map frontend category keys (A,B,C,D,E) → backend (CAT_A,CAT_B,...) */
          const servicesByCategory: Record<string, string[]> = {};
          const descriptionsByCategory: Record<string, string> = {};
          for (const cat of CATEGORIE) {
            const voci = Array.from(vociSelezionate[cat.key]);
            if (voci.length > 0) {
              const backendKey = `CAT_${cat.key}`;
              servicesByCategory[backendKey] = voci;
              descriptionsByCategory[backendKey] = descrizioni[cat.key];
            }
          }
          const apiPayload = { ...payload, servicesByCategory, descriptionsByCategory };
          await saveRevampApplicationSection(appId, "S3", JSON.stringify(apiPayload), true, auth.token);
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
    navigate(integrationEdit?.returnPath ?? "/apply/albo-b/step/4");
  }

  const errors = triedSubmit ? validate() : {};

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

      {integrationEdit ? (
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "12px 40px", color: "#174f82", fontSize: "0.86rem", fontWeight: 700 }}>
          Integrazione richiesta - Correggi questa sezione, salva e invia la risposta.
        </div>
      ) : (
        <StepBar active={2} />
      )}

      <div style={{ maxWidth: 1040, margin: "28px auto", padding: "0 24px 120px" }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "28px 32px", marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Sezione 3 — Tipologia e servizi offerti</h2>
          <p style={{ fontSize: "0.82rem", color: MUTED, margin: 0 }}>
            Seleziona le categorie di servizi che la tua organizzazione è in grado di erogare. <strong>Almeno una voce è obbligatoria.</strong>
            {" "}Per ogni categoria selezionata aggiungi una descrizione sintetica (max 400 caratteri).
          </p>

          {errors.global ? (
            <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", marginTop: 16, fontSize: "0.83rem", color: "#b91c1c" }}>⚠ {errors.global}</div>
          ) : null}

          {totalSelezionate > 0 ? (
            <div style={{ background: "#f0fdf4", border: `1px solid ${GREEN}40`, borderRadius: 6, padding: "8px 14px", marginTop: 16, fontSize: "0.82rem", color: GREEN, fontWeight: 600 }}>
              ✓ {totalSelezionate} {totalSelezionate === 1 ? "servizio selezionato" : "servizi selezionati"}
            </div>
          ) : null}
        </div>

        {CATEGORIE.map(cat => {
          const selezionate = vociSelezionate[cat.key];
          const hasSelection = selezionate.size > 0;
          const descError = errors[`desc_${cat.key}`];
          return (
            <div key={cat.key} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${hasSelection ? GREEN + "60" : "#e5e7eb"}`, padding: "24px 28px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ width: 28, height: 28, background: hasSelection ? GREEN : "#e5e7eb", color: hasSelection ? "#fff" : "#9ca3af", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.85rem", flexShrink: 0 }}>{cat.key}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>{cat.titolo}</div>
                  <div style={{ fontSize: "0.73rem", color: MUTED }}>{cat.tag}</div>
                </div>
                {hasSelection ? <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: GREEN, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "2px 8px", fontWeight: 600 }}>{selezionate.size} selezionat{selezionate.size === 1 ? "a" : "e"}</span> : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: hasSelection ? 16 : 0 }}>
                {cat.voci.map(voce => {
                  const checked = selezionate.has(voce);
                  return (
                    <label key={voce} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", padding: "8px 10px", borderRadius: 6, background: checked ? `${GREEN}08` : "#f9fafb", border: `1px solid ${checked ? GREEN : "#e5e7eb"}`, transition: "background .12s" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleVoce(cat.key, voce)} style={{ marginTop: 2, accentColor: GREEN, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.82rem", color: checked ? "#1e293b" : "#4b5563", lineHeight: 1.4 }}>{voce}</span>
                    </label>
                  );
                })}
              </div>

              {hasSelection ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>
                      Descrizione sintetica <span style={{ color: ERR }}>*</span>
                      <span style={{ fontWeight: 400, color: MUTED }}> — max 400 caratteri</span>
                    </span>
                    <span style={{ fontSize: "0.72rem", color: descrizioni[cat.key].length > 380 ? ERR : MUTED }}>{descrizioni[cat.key].length}/400</span>
                  </div>
                  <textarea
                    value={descrizioni[cat.key]}
                    onChange={e => setDesc(cat.key, e.target.value)}
                    maxLength={400}
                    rows={3}
                    placeholder="Descrivi brevemente i servizi offerti in questa categoria, la metodologia e l'esperienza maturata..."
                    style={{ width: "100%", padding: "10px 12px", fontSize: "0.85rem", border: `1.5px solid ${descError ? ERR : "#d1d5db"}`, borderRadius: 6, outline: "none", boxSizing: "border-box", resize: "vertical", color: "#111827", lineHeight: 1.5 }}
                  />
                  {descError ? <span style={{ fontSize: "0.74rem", color: ERR }}>{descError}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Bottom nav */}
      <div className="wizard-bottom-nav" style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Link className="wizard-nav-button wizard-nav-button-prev" to={integrationEdit?.returnPath ?? "/apply/albo-b/step/2"} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: GREEN, textDecoration: "none" }}>
          <ArrowLeft size={15} /> {integrationEdit ? "Torna alla richiesta" : "Sezione precedente"}
        </Link>
        {integrationEdit ? (
          <div style={{ fontSize: "0.82rem", color: MUTED, fontWeight: 700 }}>Modalita integrazione</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: "0.78rem", color: MUTED }}>Avanzamento: <strong>60%</strong></span>
            <div style={{ width: 200, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "60%", height: "100%", background: GREEN, borderRadius: 2 }} />
            </div>
          </div>
        )}
        <button className="wizard-nav-button wizard-nav-button-next" type="button" onClick={() => void handleNext()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: GREEN, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
          {integrationEdit ? "Salva e invia integrazione" : "Sezione successiva"} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
