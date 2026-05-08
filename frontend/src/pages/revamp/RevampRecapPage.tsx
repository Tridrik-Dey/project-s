import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Copy, Edit2, Info, Mail, Send } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getRevampApplicationSections, submitRevampApplication } from "../../api/revampApplicationApi";
import { getMissingRequiredSections } from "./revampFlow";
import { loadRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";

const NAVY  = "#0f2a52";
const GREEN = "#1a5c3a";
const MUTED = "#6b7280";

const STEPS = ["Anagrafica", "Tipologia", "Competenze", "Disponibilità", "Dichiarazioni"];

/* ─── label maps ─────────────────────────────────── */
const TIPOLOGIA_LABELS: Record<string, string> = {
  docente:        "Docente / Formatore",
  ricercatore:    "Ricercatore / Valutatore",
  cdo_lavoro:     "Consulente del Lavoro",
  commercialista: "Commercialista",
  avvocato:       "Avvocato",
  psicologo:      "Psicologo",
  finanza:        "Esperto di Finanza Agevolata",
  orientatore:    "Orientatore Professionale",
  coach:          "Coach",
  mediatore:      "Mediatore del Lavoro",
  altro:          "Altro professionista",
};

const TITOLO_LABELS: Record<string, string> = {
  licenza_media:     "Licenza media",
  diploma:           "Diploma di scuola secondaria superiore",
  laurea_triennale:  "Laurea triennale (L)",
  laurea_magistrale: "Laurea magistrale / specialistica (LM/LS)",
  master_1:          "Master universitario di I livello",
  master_2:          "Master universitario di II livello",
  dottorato:         "Dottorato di Ricerca",
  equipollente:      "Titolo equipollente estero",
};

const ANNI_PROF_LABELS: Record<string, string> = {
  meno2:   "meno di 2 anni",
  "2_5":   "2–5 anni",
  "5_10":  "5–10 anni",
  "10_20": "10–20 anni",
  oltre20: "oltre 20 anni",
};

const DISPONIBILITA_LABELS: Record<string, string> = {
  si:        "Sì, senza limitazioni",
  si_aree:   "Sì, solo in aree specifiche",
  lunga_dur: "Solo per progetti di lunga durata (>5 giornate)",
  no:        "No",
};

const TAX_REGIME_LABELS: Record<string, string> = {
  ordinario:    "Regime ordinario",
  forfettario:  "Regime forfettario",
  ditta:        "Ditta individuale",
  societa:      "Società (SRL / SNC / SAS / …)",
  associazione: "Associazione / Ente del Terzo Settore",
  altro:        "Altro",
};

const DOCENZA_PA_LABELS: Record<string, string> = {
  si_centrale: "Sì — PA centrale",
  si_locale:   "Sì — PA locale",
  si_entrambe: "Sì — entrambe",
  no:          "No",
};

/* ─── components ─────────────────────────────────── */
function SolcoLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, background: "#f5c800", borderRadius: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
      </span>
      <span style={{ fontWeight: 800, fontSize: "1rem", color: "#1a1a2e" }}>Solco<sup style={{ color: "#f5c800", fontSize: "0.5rem", verticalAlign: "super" }}>+</sup></span>
    </div>
  );
}

function PageHeader({ title, accent }: { title: string; accent: string }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 30px" }}>
      <SolcoLogo />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>{title}</div>
        <div style={{ fontSize: "0.73rem", color: MUTED }}>Riepilogo candidatura</div>
      </div>
      <span style={{ fontSize: "0.77rem", fontWeight: 700, color: accent, background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 20, padding: "4px 12px" }}>
        Ultimo step
      </span>
    </div>
  );
}

function StepBar({ accent }: { accent: string }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 40px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{ position: "absolute", top: 17, left: "10%", right: "10%", height: 2, background: accent, zIndex: 0 }} />
        {STEPS.map((step) => (
          <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, zIndex: 1 }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: accent, border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>✓</span>
            <span style={{ fontSize: "0.7rem", color: accent, fontWeight: 600, textAlign: "center" }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, editPath, accent, children }: { title: string; editPath: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: accent }}>{title}</div>
        <Link to={editPath} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "#fff", border: `1.5px solid ${accent}`, borderRadius: 6, fontSize: "0.77rem", fontWeight: 600, color: accent, textDecoration: "none" }}>
          <Edit2 size={11} /> Modifica
        </Link>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: "0.83rem" }}>
      <span style={{ color: MUTED, minWidth: 160, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#1e293b", fontWeight: 500, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #f1f5f9", margin: "12px 0" }} />;
}

/* ─── declaration badges ─────────────────────────── */
const DECL_BADGES = [
  "Ass. condanne penali",
  "Ass. conflitti interesse",
  "Veridicità informazioni",
  "Privacy Policy GDPR",
  "Codice Etico Solco",
];

const REQUIRED_SECTION_LABELS: Record<string, string> = {
  S1: "Anagrafica",
  S2: "Tipologia",
  S3: "Competenze",
  S3A: "Competenze docente/formatore",
  S3B: "Competenze professionista",
  S4: "Disponibilita e allegati",
  S5: "Dichiarazioni",
};

/* ─── main component ─────────────────────────────── */
type S1  = Record<string, string>;
type S3  = Record<string, unknown>;
type S4  = Record<string, unknown>;

export function RevampRecapPage() {
  const { registryType: registryParam } = useParams();
  const { auth } = useAuth();
  const isA = registryParam === "albo-a";
  const isB = registryParam === "albo-b";
  if (!isA && !isB) return <Navigate to="/apply" replace />;

  const accent = isA ? NAVY : GREEN;
  const title  = isA ? "Albo A — Professionisti" : "Albo B — Aziende";
  const registryType = isA ? "ALBO_A" : "ALBO_B";

  const [s1, setS1] = useState<S1>(() => JSON.parse(sessionStorage.getItem("revamp_s1") ?? "{}"));
  const [tipologia, setTipologia] = useState(() => sessionStorage.getItem("revamp_tipologia") ?? "");
  const [s3, setS3] = useState<S3>(() => JSON.parse(sessionStorage.getItem("revamp_s3") ?? "{}"));
  const [s4, setS4] = useState<S4>(() => JSON.parse(sessionStorage.getItem("revamp_s4") ?? "{}"));
  const isDocente  = isA && tipologia === "docente";

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [protocolCode, setProtocolCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;
    const appId = loadRevampApplicationIdForRegistry(registryType);
    if (!appId) return;
    getRevampApplicationSections(appId, auth.token).then(sections => {
      setMissingSections(getMissingRequiredSections(isA ? "ALBO_A" : "ALBO_B", sections));
      const latest = (...keys: string[]) => sections
        .filter(sec => keys.includes(sec.sectionKey))
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];

      const s1sec = latest("S1");
      if (s1sec) {
        const data = JSON.parse(s1sec.payloadJson) as S1;
        setS1(data);
        sessionStorage.setItem("revamp_s1", s1sec.payloadJson);
      }

      const s2sec = latest("S2");
      if (s2sec) {
        const s2data = JSON.parse(s2sec.payloadJson) as Record<string, unknown>;
        const tip = (s2data.tipologia as string) ?? "";
        setTipologia(tip);
        sessionStorage.setItem("revamp_tipologia", tip);
      }

      const s3sec = latest("S3", "S3A", "S3B");
      if (s3sec) {
        const data = JSON.parse(s3sec.payloadJson) as S3;
        setS3(data);
        sessionStorage.setItem("revamp_s3", s3sec.payloadJson);
      }

      const s4sec = latest("S4");
      if (s4sec) {
        const data = JSON.parse(s4sec.payloadJson) as S4;
        setS4(data);
        sessionStorage.setItem("revamp_s4", s4sec.payloadJson);
      }
    }).catch(() => {
      setSubmitError("Impossibile verificare il salvataggio sul server. Riprova.");
    });
  }, [auth?.token, isA, isB, registryType]);

  async function handleInvia() {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const appId = loadRevampApplicationIdForRegistry(registryType);
      if (!appId || !auth?.token) {
        setSubmitError("Sessione non valida. Rientra nell'area fornitore e riprova.");
        setSubmitting(false);
        return;
      }
      const sections = await getRevampApplicationSections(appId, auth.token);
      const missing = getMissingRequiredSections(isA ? "ALBO_A" : "ALBO_B", sections);
      setMissingSections(missing);
      if (missing.length > 0) {
        setSubmitError("Completa e salva sul server tutte le sezioni obbligatorie prima di inviare.");
        setSubmitting(false);
        return;
      }
      const submittedSummary = await submitRevampApplication(appId, auth.token);
      setProtocolCode(submittedSummary.protocolCode ?? "");
      sessionStorage.setItem("revamp_proto", submittedSummary.protocolCode ?? "");
    } catch {
      setSubmitError("Invio non riuscito. Riprova.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setSubmitted(true);
  }

  function handleCopy() {
    navigator.clipboard.writeText(protocolCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (submitted) {
    const userEmail = s1.email || "la tua e-mail";
    return (
      <div style={{ margin: "-1rem", background: "#fff", minHeight: "100%", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px", borderBottom: "1px solid #e5e7eb" }}>
          <SolcoLogo />
          <span style={{ fontSize: "0.82rem", color: MUTED }}>{userEmail}</span>
        </div>

        {/* Hero */}
        <div style={{ background: "#f0fdf4", padding: "52px 24px 40px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <CheckCircle2 size={36} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", margin: "0 0 10px" }}>
            Candidatura inviata con successo!
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#16a34a", margin: 0 }}>
            Il tuo profilo è ora in attesa di revisione da parte del Gruppo Solco.
          </p>
        </div>

        {/* Protocol card */}
        <div style={{ display: "flex", justifyContent: "center", padding: "32px 24px 0" }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "24px 40px", textAlign: "center", minWidth: 320, boxShadow: "0 2px 12px #0001" }}>
            <div style={{ fontSize: "0.75rem", color: MUTED, marginBottom: 10, letterSpacing: "0.04em" }}>Codice di protocollo</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.08em", border: "2px solid #0f2a52", borderRadius: 8, padding: "10px 28px", marginBottom: 14, fontFamily: "monospace" }}>
              {protocolCode}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: "0.82rem", fontWeight: 600, color: copied ? "#16a34a" : "#374151", cursor: "pointer" }}
            >
              <Copy size={13} /> {copied ? "Copiato!" : "Copia codice"}
            </button>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "12px 0 0", lineHeight: 1.5 }}>
              Conserva questo codice per ogni comunicazione con il Gruppo Solco.
            </p>
          </div>
        </div>

        {/* Three info cards */}
        <div style={{ maxWidth: 900, margin: "32px auto 0", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, width: "100%" }}>
          {[
            {
              icon: <Mail size={16} color="#15803d" />,
              title: "E-mail di conferma",
              text: `Riceverai una e-mail a ${userEmail} con il riepilogo completo della candidatura.`,
            },
            {
              icon: <Clock size={16} color="#15803d" />,
              title: "Tempi di revisione",
              text: "Il tuo profilo sarà esaminato entro 10 giorni lavorativi. Riceverai una notifica via e-mail sull'esito.",
            },
            {
              icon: <Info size={16} color="#15803d" />,
              title: "Cosa succede ora",
              text: "Se la documentazione fosse incompleta, riceverai una richiesta di integrazione via e-mail.",
            },
          ].map(card => (
            <div key={card.title} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                {card.icon}
                <span style={{ fontWeight: 700, fontSize: "0.87rem", color: "#1e293b" }}>{card.title}</span>
              </div>
              <p style={{ fontSize: "0.81rem", color: MUTED, margin: 0, lineHeight: 1.6 }}>{card.text}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "36px 24px 12px" }}>
          <Link
            to={`/apply/${registryParam}/my-profile`}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 32px", background: "#0f2a52", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}
          >
            Accedi alla tua area riservata →
          </Link>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "16px 24px 32px" }}>
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: "0 0 4px" }}>
            Troverai la tua area personale sempre accessibile da solco.it/albo-fornitori
          </p>
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: 0 }}>
            © {new Date().getFullYear()} Gruppo Solco
          </p>
        </div>
      </div>
    );
  }

  /* ── derived display values ── */
  const fullName   = [s1.firstName, s1.lastName].filter(Boolean).join(" ") || "—";
  const indirizzo  = [s1.address, s1.postalCode, s1.city, s1.province].filter(Boolean).join(", ") || undefined;
  const taxRegimeLabel = TAX_REGIME_LABELS[s1.taxRegime] ?? s1.taxRegime ?? undefined;
  const tipologiaLabel = (TIPOLOGIA_LABELS[tipologia] ?? tipologia) || "—";

  const areeIds  = (s3.aree as string[] | undefined) ?? [];
  const espCount = (s4.espCount as number | undefined) ?? 0;
  const committenti = (s4.committenti as string[] | undefined) ?? [];
  const periodi = (s4.periodi as string[] | undefined) ?? [];

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>
      <PageHeader title={title} accent={accent} />
      <StepBar accent={accent} />

      {/* Green banner */}
      <div style={{ background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", padding: "14px 36px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: "1.2rem" }}>✓</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#15803d" }}>Tutto pronto! Rivedi il riepilogo prima di inviare.</div>
          <div style={{ fontSize: "0.8rem", color: "#16a34a" }}>Puoi modificare ogni sezione cliccando su "Modifica". Quando sei soddisfatto, clicca su "Invia candidatura ufficialmente".</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ maxWidth: 1080, margin: "24px auto", padding: "0 24px 110px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* LEFT — Dati Personali */}
        <Card title="Dati Personali" editPath={`/apply/${registryParam}`} accent={accent}>
          <FieldRow label="Nome e Cognome" value={fullName} />
          <FieldRow label="Codice Fiscale" value={s1.taxCode} />
          {s1.vatNumber && <FieldRow label="Partita IVA" value={s1.vatNumber} />}
          {taxRegimeLabel && <FieldRow label="Regime fiscale" value={taxRegimeLabel} />}
          <Divider />
          <FieldRow label="E-mail principale" value={s1.email} />
          <FieldRow label="Telefono" value={s1.phone ? `+39 ${s1.phone}` : undefined} />
          <Divider />
          <FieldRow label="Indirizzo" value={indirizzo} />
          {s1.linkedin && <><Divider /><FieldRow label="LinkedIn" value={s1.linkedin} /></>}
        </Card>

        {/* RIGHT column */}
        <div>
          {/* Tipologia e Competenze */}
          <Card title="Tipologia e Competenze" editPath={`/apply/${registryParam}/step/2`} accent={accent}>
            <FieldRow label="Tipologia principale" value={tipologiaLabel} />
            <Divider />
            {isDocente ? (
              <>
                <FieldRow label="Titolo di studio" value={TITOLO_LABELS[s3.titoloStudio as string] ?? (s3.titoloStudio as string | undefined)} />
                <FieldRow label="Anno conseguimento" value={s3.annoConseg as string | undefined} />
                <FieldRow label="Ambito di studio" value={s3.ambitoStudio as string | undefined} />
                {areeIds.length > 0 && (
                  <FieldRow label="Aree tematiche" value={`${areeIds.length} aree selezionate`} />
                )}
                {s3.docenzaPA && (
                  <FieldRow label="Docenza PA" value={DOCENZA_PA_LABELS[s3.docenzaPA as string] ?? (s3.docenzaPA as string | undefined)} />
                )}
                <FieldRow label="Area territoriale" value={s3.areaTerritoriale as string | undefined} />
                {s3.lingue && <FieldRow label="Lingue parlate" value={s3.lingue as string} />}
              </>
            ) : (
              <>
                <FieldRow label="Titolo di studio" value={TITOLO_LABELS[s3.titoloB as string] ?? (s3.titoloB as string | undefined)} />
                <FieldRow label="Anni di esperienza" value={ANNI_PROF_LABELS[s3.anniEsp as string] ?? (s3.anniEsp as string | undefined)} />
                {s3.ordine && <FieldRow label="Ordine professionale" value={s3.ordine as string} />}
                <FieldRow label="Ambito di studio" value={s3.ambitoB as string | undefined} />
              </>
            )}
          </Card>

          {/* Disponibilità */}
          <Card title="Disponibilità e Allegati" editPath={`/apply/${registryParam}/step/4`} accent={accent}>
            {isDocente ? (
              <>
                <FieldRow label="Trasferte" value={DISPONIBILITA_LABELS[s4.disponibilita as string] ?? (s4.disponibilita as string | undefined)} />
                {s4.tariffaGiorn && <FieldRow label="Tariffa giornaliera" value={s4.tariffaGiorn as string} />}
                {s4.tariffaOra   && <FieldRow label="Tariffa oraria" value={s4.tariffaOra as string} />}
                {espCount > 0 && (
                  <>
                    <Divider />
                    <FieldRow label="Esperienze inserite" value={`${espCount} esperienza/e`} />
                    {committenti.slice(0, 3).map((c, i) => (
                      <FieldRow key={i} label={`  · Committente ${i + 1}`} value={`${c}${periodi[i] ? ` (${periodi[i]})` : ""}`} />
                    ))}
                  </>
                )}
                {(s4.cvName as string | null) && <><Divider /><FieldRow label="CV allegato" value={s4.cvName as string} /></>}
                {(s4.certName as string | null) && <FieldRow label="Certificazioni" value={s4.certName as string} />}
              </>
            ) : (
              <>
                <FieldRow label="Area territoriale" value={s4.areaTerrB as string | undefined} />
                {s4.tariffaOraB && <FieldRow label="Tariffa oraria" value={s4.tariffaOraB as string} />}
                {(s4.cvName as string | null) && <><Divider /><FieldRow label="CV allegato" value={s4.cvName as string} /></>}
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10, padding: "10px 30px" }}>
        {/* Declaration badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {DECL_BADGES.map(b => (
            <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, fontSize: "0.72rem", color: "#15803d", fontWeight: 600 }}>
              ✓ {b}
            </span>
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            to={`/apply/${registryParam}/step/5`}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "#fff", border: `1.5px solid ${accent}`, borderRadius: 6, fontWeight: 600, fontSize: "0.84rem", color: accent, textDecoration: "none" }}
          >
            <ArrowLeft size={14} /> Torna indietro
          </Link>

          <button
            type="button"
            onClick={() => void handleInvia()}
            disabled={submitting || missingSections.length > 0}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 26px", background: missingSections.length > 0 ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: "0.9rem", cursor: submitting || missingSections.length > 0 ? "not-allowed" : "pointer", boxShadow: missingSections.length > 0 ? "none" : "0 2px 8px #16a34a40", opacity: submitting ? 0.7 : 1 }}
          >
            <Send size={15} /> {submitting ? "Invio in corso..." : "Invia candidatura ufficialmente"}
          </button>
        </div>
        {(missingSections.length > 0 || submitError) ? (
          <div style={{ marginTop: 8, textAlign: "center", fontSize: "0.78rem", color: "#b91c1c" }}>
            {submitError ?? `Sezioni non salvate sul server: ${missingSections.map((key) => REQUIRED_SECTION_LABELS[key] ?? key).join(", ")}`}
          </div>
        ) : null}
      </div>
    </div>
  );
}
