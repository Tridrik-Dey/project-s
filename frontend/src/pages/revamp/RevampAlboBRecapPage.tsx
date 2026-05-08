import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Copy, Edit2, Info, Mail, Send } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getRevampApplicationSections, submitRevampApplication } from "../../api/revampApplicationApi";
import { getMissingRequiredSections } from "./revampFlow";
import { loadRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";

const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const STEPS_B = ["Dati aziendali", "Struttura", "Servizi", "Certificazioni", "Dichiarazioni"];

const FORMA_MAP: Record<string, string> = {
  srl: "S.r.l.", srls: "S.r.l.s.", spa: "S.p.A.", sas: "S.a.s.", snc: "S.n.c.", ss: "S.S.",
  coop_sociale: "Cooperativa Sociale", coop_nonsociale: "Cooperativa non Sociale",
  consorzio: "Consorzio", fondazione: "Fondazione", associazione: "Associazione",
  aps: "APS", odv: "ODV", impresa_sociale: "Impresa Sociale",
  studio_associato: "Studio Associato", ditta_individuale: "Ditta Individuale", altro: "Altro",
};
const DIP_MAP: Record<string, string> = {
  solo_titolare: "Solo il titolare", "2_5": "2–5 dipendenti", "6_15": "6–15 dipendenti",
  "16_50": "16–50 dipendenti", "51_250": "51–250 dipendenti", oltre_250: "Oltre 250 dipendenti",
};
const FATT_MAP: Record<string, string> = {
  sotto_100k: "< 100.000 €", "100k_500k": "100.000 – 500.000 €",
  "500k_2m": "500.000 – 2.000.000 €", "2m_10m": "2.000.000 – 10.000.000 €",
  oltre_10m: "Oltre 10.000.000 €", non_indicato: "Non indicato",
};
const CAT_NAMES: Record<string, string> = {
  A: "Formazione, didattica e contenuti", B: "HR, Lavoro e Organizzazione",
  C: "Tecnologia e digitale", D: "Consulenza, professioni e compliance",
  E: "Servizi generali e operativi",
};
const CERT_LABELS: Record<string, string> = {
  iso9001: "ISO 9001 — Qualità", iso14001: "ISO 14001 — Ambiente",
  iso45001: "ISO 45001 — Salute e Sicurezza", sa8000: "SA8000 — Resp. Sociale",
  iso27001: "ISO 27001 — Sicurezza Informazioni",
};
const MOD231_MAP: Record<string, string> = {
  adottato_aggiornato: "Adottato e aggiornato nell'ultimo biennio",
  adottato_non_aggiornato: "Adottato ma non aggiornato nell'ultimo biennio",
  non_adottato: "Non adottato",
};
const DECL_BADGES = [
  "Antimafia", "D.Lgs. 231/01", "Regolarità contributiva", "Sicurezza D.Lgs. 81/08",
  "GDPR", "Veridicità", "Privacy Policy", "Codice Etico", "Standard qualità", "Consenso Albo",
];

const REQUIRED_SECTION_LABELS: Record<string, string> = {
  S1: "Dati aziendali",
  S2: "Struttura",
  S3: "Servizi",
  S4: "Certificazioni e allegati",
  S5: "Dichiarazioni",
};

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

function StepBar() {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 40px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{ position: "absolute", top: 17, left: "10%", right: "10%", height: 2, background: GREEN, zIndex: 0 }} />
        {STEPS_B.map((step) => (
          <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, zIndex: 1 }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: GREEN, border: `2px solid ${GREEN}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>✓</span>
            <span style={{ fontSize: "0.7rem", color: GREEN, fontWeight: 600, textAlign: "center" }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, editPath, children }: { title: string; editPath: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: GREEN }}>{title}</div>
        <Link to={editPath} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 6, fontSize: "0.77rem", fontWeight: 600, color: GREEN, textDecoration: "none" }}>
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
    <div style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: "0.82rem" }}>
      <span style={{ color: MUTED, minWidth: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#1e293b", fontWeight: 500, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function Tags({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
      {items.map(item => (
        <span key={item} style={{ fontSize: "0.73rem", background: `${GREEN}0d`, color: GREEN, border: `1px solid ${GREEN}30`, borderRadius: 20, padding: "2px 9px", fontWeight: 500 }}>
          {item}
        </span>
      ))}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #f1f5f9", margin: "10px 0" }} />;
}

export function RevampAlboBRecapPage() {
  const { auth } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [protocolCode, setProtocolCode] = useState("");
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [b1, setB1] = useState<Record<string, string>>(() => JSON.parse(sessionStorage.getItem("revamp_b1") ?? "{}"));
  const [b2, setB2] = useState<Record<string, unknown>>(() => JSON.parse(sessionStorage.getItem("revamp_b2") ?? "{}"));
  const [b3, setB3] = useState<{ categorie?: Record<string, { voci: string[]; descrizione: string }> }>(() => JSON.parse(sessionStorage.getItem("revamp_b3") ?? "{}"));
  const [b4, setB4] = useState<Record<string, unknown>>(() => JSON.parse(sessionStorage.getItem("revamp_b4") ?? "{}"));
  const [b5, setB5] = useState<Record<string, unknown>>(() => JSON.parse(sessionStorage.getItem("revamp_b5") ?? "{}"));
  const [b5done, setB5done] = useState(() => sessionStorage.getItem("revamp_b5_done") === "true");

  useEffect(() => {
    if (!auth?.token) return;
    const appId = loadRevampApplicationIdForRegistry("ALBO_B");
    if (!appId) return;
    getRevampApplicationSections(appId, auth.token).then(sections => {
      setMissingSections(getMissingRequiredSections("ALBO_B", sections));
      const latest = (...keys: string[]) => sections
        .filter(sec => keys.includes(sec.sectionKey))
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];

      const s1sec = latest("S1");
      if (s1sec) {
        const data = JSON.parse(s1sec.payloadJson) as Record<string, string>;
        setB1(data);
        sessionStorage.setItem("revamp_b1", s1sec.payloadJson);
      }

      const s2sec = latest("S2");
      if (s2sec) {
        const data = JSON.parse(s2sec.payloadJson) as Record<string, unknown>;
        setB2(data);
        sessionStorage.setItem("revamp_b2", s2sec.payloadJson);
      }

      const s3sec = latest("S3");
      if (s3sec) {
        const data = JSON.parse(s3sec.payloadJson) as { categorie?: Record<string, { voci: string[]; descrizione: string }> };
        setB3(data);
        sessionStorage.setItem("revamp_b3", s3sec.payloadJson);
      }

      const s4sec = latest("S4");
      if (s4sec) {
        const data = JSON.parse(s4sec.payloadJson) as Record<string, unknown>;
        setB4(data);
        sessionStorage.setItem("revamp_b4", s4sec.payloadJson);
      }

      const s5sec = latest("S5");
      if (s5sec) {
        const data = JSON.parse(s5sec.payloadJson) as Record<string, unknown>;
        setB5(data);
        sessionStorage.setItem("revamp_b5", s5sec.payloadJson);
        setB5done(s5sec.completed);
        sessionStorage.setItem("revamp_b5_done", String(s5sec.completed));
      }
    }).catch(() => {
      setSubmitError("Impossibile verificare il salvataggio sul server. Riprova.");
    });
  }, [auth?.token]);

  const categorie3 = b3.categorie ?? {};
  const totalServizi = Object.values(categorie3).reduce((s, c) => s + (c.voci?.length ?? 0), 0);
  const certs4 = (b4.certificazioni ?? {}) as Record<string, { presente: string; enteCertificatore: string; scadenza: string }>;
  const certsPresenti = Object.entries(certs4).filter(([, v]) => v.presente === "si");
  const allegati4 = (b4.allegati ?? {}) as Record<string, string>;
  const dichiarazioni5 = (b5.dichiarazioni ?? []) as string[];
  const modello231 = b5.modelloOrganizzativo231 as string | undefined;

  async function handleSubmit() {
    if (submitting || !b5done || missingSections.length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const appId = loadRevampApplicationIdForRegistry("ALBO_B");
      if (!appId || !auth?.token) {
        setSubmitError("Sessione non valida. Rientra nell'area fornitore e riprova.");
        setSubmitting(false);
        return;
      }
      const sections = await getRevampApplicationSections(appId, auth.token);
      const missing = getMissingRequiredSections("ALBO_B", sections);
      setMissingSections(missing);
      if (missing.length > 0) {
        setSubmitError("Completa e salva sul server tutte le sezioni obbligatorie prima di inviare.");
        setSubmitting(false);
        return;
      }
      const submittedSummary = await submitRevampApplication(appId, auth.token);
      setProtocolCode(submittedSummary.protocolCode ?? "");
      sessionStorage.setItem("revamp_proto_b", submittedSummary.protocolCode ?? "");
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
    return (
      <div style={{ margin: "-1rem", background: "#fff", minHeight: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px", borderBottom: "1px solid #e5e7eb" }}>
          <SolcoLogo />
          <span style={{ fontSize: "0.82rem", color: MUTED }}>{b1.email || ""}</span>
        </div>

        <div style={{ background: "#f0fdf4", padding: "52px 24px 40px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <CheckCircle2 size={36} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", margin: "0 0 10px" }}>
            Candidatura inviata con successo!
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#16a34a", margin: 0 }}>
            Il profilo di <strong>{b1.ragioneSociale}</strong> è ora in attesa di revisione da parte del Gruppo Solco.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", padding: "32px 24px 0" }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "24px 40px", textAlign: "center", minWidth: 320, boxShadow: "0 2px 12px #0001" }}>
            <div style={{ fontSize: "0.75rem", color: MUTED, marginBottom: 10, letterSpacing: "0.04em" }}>Codice di protocollo</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.08em", border: `2px solid ${GREEN}`, borderRadius: 8, padding: "10px 28px", marginBottom: 14, fontFamily: "monospace" }}>
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

        <div style={{ maxWidth: 900, margin: "32px auto 0", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, width: "100%" }}>
          {[
            { icon: <Mail size={16} color="#15803d" />, title: "E-mail di conferma", text: `Riceverai una e-mail a ${b1.email || "la tua e-mail"} con il riepilogo completo della candidatura.` },
            { icon: <Clock size={16} color="#15803d" />, title: "Tempi di revisione", text: "Il profilo sarà esaminato entro 10 giorni lavorativi. Riceverai una notifica via e-mail sull'esito." },
            { icon: <Info size={16} color="#15803d" />, title: "Cosa succede ora", text: "Se la documentazione fosse incompleta, riceverai una richiesta di integrazione via e-mail." },
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

        <div style={{ textAlign: "center", padding: "36px 24px 12px" }}>
          <Link
            to="/apply/albo-b/my-profile"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 32px", background: GREEN, color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}
          >
            Accedi alla tua area riservata →
          </Link>
        </div>

        <div style={{ textAlign: "center", padding: "16px 24px 32px" }}>
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: 0 }}>
            © {new Date().getFullYear()} Gruppo Solco
          </p>
        </div>
      </div>
    );
  }

  const sedeLegale = [b1.indirizzoLegale, b1.comuneLegale, b1.capLegale, b1.provinciaLegale].filter(Boolean).join(", ");

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 30px" }}>
        <SolcoLogo />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>Albo B — Aziende</div>
          <div style={{ fontSize: "0.73rem", color: MUTED }}>Riepilogo candidatura</div>
        </div>
        <span style={{ fontSize: "0.77rem", fontWeight: 700, color: GREEN, background: `${GREEN}10`, border: `1px solid ${GREEN}30`, borderRadius: 20, padding: "4px 12px" }}>
          Ultimo step
        </span>
      </div>

      <StepBar />

      {/* Banner */}
      <div style={{ background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", padding: "14px 36px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: "1.2rem" }}>✓</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#15803d" }}>Tutto pronto! Rivedi il riepilogo prima di inviare.</div>
          <div style={{ fontSize: "0.8rem", color: "#16a34a" }}>Puoi modificare ogni sezione cliccando su "Modifica". Quando sei soddisfatto, clicca su "Invia candidatura".</div>
        </div>
      </div>

      {/* Two-column cards */}
      <div style={{ maxWidth: 1080, margin: "24px auto", padding: "0 24px 130px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* LEFT */}
        <div>
          <Card title="Sezione 1 — Dati Aziendali" editPath="/apply/albo-b">
            <FieldRow label="Ragione sociale" value={b1.ragioneSociale} />
            <FieldRow label="Forma giuridica" value={FORMA_MAP[b1.formaGiuridica] ?? b1.formaGiuridica} />
            <FieldRow label="Partita IVA" value={b1.piva} />
            {b1.codiceFiscale ? <FieldRow label="Codice Fiscale" value={b1.codiceFiscale} /> : null}
            <FieldRow label="Numero REA" value={b1.rea} />
            <FieldRow label="CCIAA" value={b1.cciaa} />
            <FieldRow label="Data costituzione" value={b1.dataCostituzione} />
            <Divider />
            <FieldRow label="Sede legale" value={sedeLegale || undefined} />
            {b1.sedeOperativa ? <FieldRow label="Sede operativa" value={b1.sedeOperativa} /> : null}
            <Divider />
            <FieldRow label="E-mail" value={b1.email} />
            <FieldRow label="PEC" value={b1.pec} />
            <FieldRow label="Telefono" value={b1.telefono} />
            {b1.sitoWeb ? <FieldRow label="Sito web" value={b1.sitoWeb} /> : null}
            <Divider />
            <FieldRow label="Legale Rappresentante" value={b1.lrNomeCognome ? `${b1.lrNomeCognome} — ${b1.lrRuolo}` : undefined} />
            <FieldRow label="Referente operativo" value={b1.refNome ? `${b1.refNome} (${b1.refRuolo})` : undefined} />
            <FieldRow label="E-mail referente" value={b1.refEmail} />
            <FieldRow label="Tel. referente" value={b1.refTelefono} />
          </Card>

          <Card title="Sezione 2 — Struttura e Settore" editPath="/apply/albo-b/step/2">
            <FieldRow label="Dipendenti" value={DIP_MAP[b2.dipendenti as string] ?? b2.dipendenti as string} />
            {b2.fatturato ? <FieldRow label="Fatturato" value={FATT_MAP[b2.fatturato as string] ?? b2.fatturato as string} /> : null}
            <FieldRow label="ATECO principale" value={b2.atecoMain as string} />
            {(b2.atecoSecondari as string[] | undefined)?.filter(Boolean).map((a, i) => (
              <FieldRow key={i} label={`ATECO sec. ${i + 1}`} value={a} />
            ))}
            <Divider />
            {(b2.regioni as string[] | undefined)?.length ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 4 }}>Regioni di operatività</div>
                <Tags items={b2.regioni as string[]} />
              </div>
            ) : null}
            <FieldRow label="Accr. formazione" value={(b2.accreditatoFormazione as string) === "si" ? "Sì" : (b2.accreditatoFormazione as string) === "no" ? "No" : undefined} />
            {(b2.accreditatoFormazione as string) === "si" && (b2.accreditamentoRegioni as string[] | undefined)?.length ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 4 }}>Regioni accreditate</div>
                <Tags items={b2.accreditamentoRegioni as string[]} />
              </div>
            ) : null}
            {(b2.accreditatoFormazione as string) === "si" && (b2.accreditamentoTipi as string[] | undefined)?.length ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 4 }}>Tipi di accreditamento</div>
                <Tags items={b2.accreditamentoTipi as string[]} />
              </div>
            ) : null}
            <Divider />
            <FieldRow label="Terzo Settore" value={(b2.isTerzoSettore as string) === "si" ? "Sì" : (b2.isTerzoSettore as string) === "no" ? "No" : undefined} />
            {(b2.isTerzoSettore as string) === "si" ? <FieldRow label="Tipo ETS" value={b2.tipoEts as string} /> : null}
            {(b2.isTerzoSettore as string) === "si" && b2.runts ? <FieldRow label="N. RUNTS" value={b2.runts as string} /> : null}
          </Card>
        </div>

        {/* RIGHT */}
        <div>
          <Card title="Sezione 3 — Servizi Offerti" editPath="/apply/albo-b/step/3">
            <div style={{ fontSize: "0.8rem", color: MUTED, marginBottom: 10, fontWeight: 500 }}>
              {totalServizi} {totalServizi === 1 ? "servizio selezionato" : "servizi selezionati"} in totale
            </div>
            {Object.entries(categorie3)
              .filter(([, cat]) => (cat.voci?.length ?? 0) > 0)
              .map(([key, cat]) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: GREEN, marginBottom: 5 }}>
                    {CAT_NAMES[key] ?? key} <span style={{ fontWeight: 400, color: MUTED }}>({cat.voci.length})</span>
                  </div>
                  <Tags items={cat.voci} />
                  {cat.descrizione ? (
                    <p style={{ fontSize: "0.77rem", color: "#374151", marginTop: 6, background: "#f9fafb", borderRadius: 5, padding: "6px 10px", lineHeight: 1.55, margin: "6px 0 0" }}>
                      {cat.descrizione}
                    </p>
                  ) : null}
                </div>
              ))}
            {totalServizi === 0 ? (
              <span style={{ fontSize: "0.82rem", color: "#ef4444" }}>Nessun servizio selezionato — torna allo step 3.</span>
            ) : null}
          </Card>

          <Card title="Sezione 4 — Certificazioni e Allegati" editPath="/apply/albo-b/step/4">
            {certsPresenti.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: 8 }}>Certificazioni presenti</div>
                {certsPresenti.map(([key, cert]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.79rem", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #f3f4f6" }}>
                    <span style={{ color: "#1e293b", fontWeight: 500 }}>{CERT_LABELS[key] ?? key}</span>
                    <span style={{ color: MUTED, flexShrink: 0, marginLeft: 8 }}>{cert.enteCertificatore} · {cert.scadenza}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.82rem", color: MUTED, marginBottom: 10 }}>Nessuna certificazione ISO dichiarata.</div>
            )}
            <Divider />
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>Allegati</div>
            <FieldRow label="Visura camerale" value={allegati4.visura || undefined} />
            <FieldRow label="Company profile" value={allegati4.companyProfile || undefined} />
            <FieldRow label="DURC" value={allegati4.durc || undefined} />
            <FieldRow label="Certificati allegati" value={allegati4.certificatiAllegati || undefined} />
            <Divider />
            <FieldRow label="Accr. formazione" value={(b4.accreditamentoFormazione as string) === "si" ? "Sì" : (b4.accreditamentoFormazione as string) === "no" ? "No" : undefined} />
            {(b4.accreditamentoFormazione as string) === "si" && b4.accreditamentoRegioni ? (
              <FieldRow label="Regioni accreditate" value={b4.accreditamentoRegioni as string} />
            ) : null}
            {(b4.accreditamentoFormazione as string) === "si" && b4.accreditamentoTipoFormazione ? (
              <FieldRow label="Tipo formazione" value={b4.accreditamentoTipoFormazione as string} />
            ) : null}
            <FieldRow label="Accr. servizi lavoro" value={(b4.accreditamentoServiziLavoro as string) === "si" ? "Sì" : (b4.accreditamentoServiziLavoro as string) === "no" ? "No" : undefined} />
            {b4.altreCertificazioni ? <><Divider /><FieldRow label="Altre certificazioni" value={b4.altreCertificazioni as string} /></> : null}
          </Card>

          <Card title="Sezione 5 — Dichiarazioni" editPath="/apply/albo-b/step/5">
            {b5done ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "10px 14px", marginBottom: 10 }}>
                  <span style={{ fontSize: "1rem", color: "#16a34a" }}>✓</span>
                  <span style={{ fontSize: "0.83rem", color: "#15803d", fontWeight: 600 }}>
                    {dichiarazioni5.length || 10} dichiarazioni obbligatorie accettate
                  </span>
                </div>
                {modello231 ? <FieldRow label="Modello 231" value={MOD231_MAP[modello231] ?? modello231} /> : null}
                {(b5.consensoComunicazioniCommerciali as boolean | undefined) ? (
                  <div style={{ fontSize: "0.78rem", color: GREEN, marginTop: 6 }}>✓ Consenso comunicazioni commerciali</div>
                ) : null}
              </>
            ) : (
              <div style={{ fontSize: "0.82rem", color: "#ef4444" }}>
                ⚠ Sezione non completata — torna allo step 5 per accettare le dichiarazioni.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Fixed bottom nav */}
      <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10, padding: "10px 30px" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
          {DECL_BADGES.map(b => (
            <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", background: b5done ? "#f0fdf4" : "#f9fafb", border: `1px solid ${b5done ? "#bbf7d0" : "#e5e7eb"}`, borderRadius: 20, fontSize: "0.69rem", color: b5done ? "#15803d" : "#9ca3af", fontWeight: 600 }}>
              {b5done ? "✓" : "○"} {b}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            to="/apply/albo-b/step/5"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 6, fontWeight: 600, fontSize: "0.84rem", color: GREEN, textDecoration: "none" }}
          >
            <ArrowLeft size={14} /> Torna indietro
          </Link>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!b5done || submitting || missingSections.length > 0}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 26px", background: b5done && missingSections.length === 0 ? "#16a34a" : "#9ca3af", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: "0.9rem", cursor: b5done && !submitting && missingSections.length === 0 ? "pointer" : "not-allowed", boxShadow: b5done && missingSections.length === 0 ? "0 2px 8px #16a34a40" : "none", transition: "background .15s" }}
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
