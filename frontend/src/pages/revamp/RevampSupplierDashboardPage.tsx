import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Download, FileEdit, FileText, Globe, Handshake, Image, LayoutGrid, MapPin, MessageSquare, Star, User, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { API_BASE_URL } from "../../api/http";
import {
  getMyLatestRevampApplication,
  getRevampApplicationSections,
  getRevampApplicationCommunications,
  getOpenRevampIntegrationRequest,
  getMyEvaluationAggregate,
  type RevampApplicationSummary,
  type RevampSectionSnapshot,
  type RevampApplicationCommunication,
  type RevampIntegrationRequestSummary,
  type MyEvaluationAggregate,
} from "../../api/revampApplicationApi";
import { saveRevampApplicationIdForRegistry } from "../../utils/revampApplicationSession";
import { saveRevampIntegrationEditSession } from "../../utils/revampIntegrationEditSession";
import {
  listFieldChangeRequests,
  type FieldChangeRequest,
} from "../../api/fieldChangeRequestApi";
import { FieldChangeRequestModal } from "../../components/supplier/FieldChangeRequestModal";

const NAVY  = "#0f2a52";
const GREEN = "#1a5c3a";
const MUTED = "#6b7280";

/* ─── lookup maps ───────────────────────────────────── */
const FORMA_MAP: Record<string, string> = {
  srl: "S.r.l.", srls: "S.r.l.s.", spa: "S.p.A.", sas: "S.a.s.", snc: "S.n.c.", ss: "S.S.",
  coop_sociale: "Cooperativa Sociale", coop_nonsociale: "Cooperativa non Sociale",
  consorzio: "Consorzio", fondazione: "Fondazione", associazione: "Associazione",
  aps: "APS", odv: "ODV", impresa_sociale: "Impresa Sociale",
  studio_associato: "Studio Associato", ditta_individuale: "Ditta Individuale", altro: "Altro",
};

const AREA_LABELS: Record<string, string> = {
  digitale_base: "Digitale Base", digitale_adv: "Digitale Avanzato",
  lingue: "Lingue", soft_skills: "Soft Skills", outdoor: "Outdoor",
  hr: "HR", manageriale: "Manageriale", sistemi: "Sistemi Gestione",
  comunicazione: "Comunicazione", grafica: "Grafica",
  ssl_ob: "SSL Obbligatoria", ssl_nob: "SSL Non obbl.",
  giuridico: "Giuridico", fondi_eu: "Fondi EU", economico: "Economico",
  commercio: "Commercio", pm: "Project Management", green: "Green Economy",
  sanita: "Sanità", logistica: "Logistica", agricoltura: "Agricoltura",
  turismo: "Turismo", tecnico_prof: "Tecnico-Prof.", audiovisivo: "Audiovisivo",
  cultura: "Cultura", scolastico: "Scolastico", altro_area: "Altro",
};

const TIPOLOGIA_LABELS: Record<string, string> = {
  docente: "Docente / Formatore", ricercatore: "Ricercatore / Valutatore",
  cdo_lavoro: "Consulente del Lavoro", commercialista: "Commercialista",
  avvocato: "Avvocato", psicologo: "Psicologo",
  finanza: "Esperto Finanza Agevolata", orientatore: "Orientatore Professionale",
  coach: "Coach", mediatore: "Mediatore del Lavoro", altro: "Altro professionista",
};

const CAT_NAMES: Record<string, string> = {
  A: "Formazione, didattica e contenuti", B: "HR, Lavoro e Organizzazione",
  C: "Tecnologia e digitale", D: "Consulenza, professioni e compliance",
  E: "Servizi generali e operativi",
};

const TAX_REGIME_LABELS: Record<string, string> = {
  ordinario: "Regime ordinario", forfettario: "Regime forfettario",
  occasionale: "Regime occasionale", ditta: "Ditta individuale", altro: "Altro",
};

const DISPONIBILITA_LABELS: Record<string, string> = {
  si: "Sì, senza limitazioni", si_aree: "Solo in aree specifiche",
  lunga_dur: "Solo per progetti di lunga durata", no: "No",
};

const DIPENDENTI_LABELS: Record<string, string> = {
  solo_titolare: "Solo titolare / 1", "2_5": "2–5", "6_15": "6–15",
  "16_50": "16–50", "51_250": "51–250", oltre_250: "Oltre 250",
};

const FATTURATO_LABELS: Record<string, string> = {
  sotto_100k: "Sotto 100.000 €", "100k_500k": "100.000–500.000 €",
  "500k_2m": "500.000–2.000.000 €", "2m_10m": "2–10 milioni €",
  oltre_10m: "Oltre 10 milioni €", non_indicato: "Non indicato",
};

const MODELLO231_LABELS: Record<string, string> = {
  adottato_aggiornato: "Adottato e aggiornato",
  adottato_non_aggiornato: "Adottato ma non aggiornato",
  non_adottato: "Non adottato",
};

const EVALUATION_CATEGORY_LABELS: Record<string, string> = {
  quality: "Qualita tecnica",
  timeliness: "Rispetto tempi",
  communication: "Comunicazione",
  flexibility: "Flessibilita",
  value: "Qualita/Prezzo"
};

const DOCENZA_PA_LABELS: Record<string, string> = {
  si_centrale: "Sì, PA centrale", si_locale: "Sì, PA locale",
  si_entrambe: "Sì, PA centrale e locale", no: "No",
};

const TIPO_INTERVENTO_LABELS: Record<string, string> = {
  aula: "Corso in aula", fad: "FAD / E-learning", blended: "Blended",
  coaching: "Coaching", workshop: "Workshop / Laboratorio", altro: "Altro",
};

const ISO_NAMES: Record<string, string> = {
  iso9001: "ISO 9001 (Qualità)", iso14001: "ISO 14001 (Ambiente)",
  iso45001: "ISO 45001 (Sicurezza)", sa8000: "SA8000 (Responsabilità sociale)",
  iso27001: "ISO 27001 (Sicurezza informazioni)",
};

const STATUS_CFG: Record<string, { label: string; icon: string; bg: string; border: string; color: string; sub: string }> = {
  DRAFT:        { label: "Bozza in compilazione", icon: "✏", bg: "#fffbeb", border: "#fde68a", color: "#92400e", sub: "Completa e invia la candidatura per entrare nell'Albo Fornitori." },
  SUBMITTED:    { label: "In revisione",          icon: "⏳", bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", sub: "La candidatura è in revisione da parte del Gruppo Solco." },
  UNDER_REVIEW: { label: "In revisione",          icon: "⏳", bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", sub: "La candidatura è in revisione da parte del Gruppo Solco." },
  APPROVED:     { label: "Profilo ATTIVO",        icon: "✓", bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d", sub: "Il tuo profilo è visibile nell'Albo e ricercabile dai responsabili del Gruppo Solco." },
  REJECTED:     { label: "Non approvata",         icon: "✕", bg: "#fef2f2", border: "#fecaca", color: "#dc2626", sub: "La candidatura non è stata approvata. Contatta il team Solco per maggiori informazioni." },
};

STATUS_CFG.INTEGRATION_REQUIRED = {
  label: "Richiesta integrazione inviata",
  icon: "!",
  bg: "#fff7ed",
  border: "#fdba74",
  color: "#9a3412",
  sub: "Il Gruppo Solco richiede alcune integrazioni prima di completare la verifica."
};
STATUS_CFG.WAITING_SUPPLIER_RESPONSE = STATUS_CFG.INTEGRATION_REQUIRED;

type Tab = "profilo" | "documenti" | "valutazioni" | "comunicazioni";
type RequestedItem = {
  code: string;
  label: string;
  instruction: string;
  documentType?: string;
  certificationKey?: string;
  certificationLabel?: string;
  targetStep?: number;
};

/* ─── module-level helpers ──────────────────────────── */
function parseSection(sections: Record<string, RevampSectionSnapshot>, key: string): Record<string, unknown> {
  return sections[key] ? (JSON.parse(sections[key].payloadJson) as Record<string, unknown>) : {};
}

function parseRequestedItems(payload: unknown): RequestedItem[] {
  if (!payload || typeof payload !== "object") return [];
  const rawItems = Array.isArray((payload as { items?: unknown }).items)
    ? (payload as { items: unknown[] }).items
    : [];
  return rawItems
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const parsed: RequestedItem = {
        code: typeof value.code === "string" ? value.code : "OTHER",
        label: typeof value.label === "string" ? value.label : "Elemento richiesto",
        instruction: typeof value.instruction === "string" ? value.instruction : ""
      };
      if (typeof value.documentType === "string") parsed.documentType = value.documentType;
      if (typeof value.certificationKey === "string") parsed.certificationKey = value.certificationKey;
      if (typeof value.certificationLabel === "string") parsed.certificationLabel = value.certificationLabel;
      if (typeof value.targetStep === "number") parsed.targetStep = value.targetStep;
      return parsed;
    })
    .filter((item): item is RequestedItem => Boolean(item));
}

function targetStepForItem(item: RequestedItem): number {
  if (item.targetStep && item.targetStep >= 1 && item.targetStep <= 5) return item.targetStep;
  if (item.code === "THEMATIC_SPECIFICATION" || item.code === "EXPERIENCE_CONSISTENCY") return 3;
  if (item.documentType || item.code === "CV" || item.code === "PROFESSIONAL_REGISTER" || item.code.startsWith("CERT_")) return 4;
  return 1;
}

function wizardStepPath(registryParam: string, step: number): string {
  const normalizedStep = Math.max(1, Math.min(step, 5));
  return normalizedStep <= 1 ? `/apply/${registryParam}` : `/apply/${registryParam}/step/${normalizedStep}`;
}

function sectionNameForStep(registryType: string, step: number): string {
  if (registryType === "ALBO_B") {
    const names: Record<number, string> = {
      1: "Dati aziendali",
      2: "Struttura",
      3: "Servizi",
      4: "Certificazioni",
      5: "Dichiarazioni"
    };
    return names[step] ?? `Sezione ${step}`;
  }
  const names: Record<number, string> = {
    1: "Anagrafica",
    2: "Tipologia",
    3: "Competenze",
    4: "Disponibilita",
    5: "Dichiarazioni"
  };
  return names[step] ?? `Sezione ${step}`;
}

function s(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "string") return val;
  if (typeof val === "boolean") return val ? "Sì" : "No";
  if (typeof val === "number") return String(val);
  return "";
}

function a(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return (val as unknown[]).filter(v => typeof v === "string" && (v as string).trim()) as string[];
}

/* ─── UI helpers ────────────────────────────────────── */

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={13} fill={n <= Math.round(rating) ? "#f59e0b" : "none"} color="#f59e0b" strokeWidth={1.5} />
      ))}
    </span>
  );
}

function Badge({ text, color }: { text: string; color: "green" | "yellow" | "navy" | "blue" | "red" | "gray" }) {
  const map = {
    green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
    yellow: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    navy:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    red:    { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
    gray:   { bg: "#f9fafb", border: "#e5e7eb", text: "#374151" },
  };
  const c = map[color];
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, fontSize: "0.73rem", fontWeight: 600, color: c.text }}>
      {text}
    </span>
  );
}

function StatCard({ label, value, sub, tone, icon, pill }: { label: string; value: string; sub: string; tone: "tone-ok" | "tone-info" | "tone-attention" | "tone-progress" | "tone-critical"; icon: React.ReactNode; pill?: { text: string; level: "ok" | "info" | "attention" | "critical" } }) {
  return (
    <article className={`panel superadmin-kpi-card ${tone}`} style={{ flex: 1, minWidth: 0, padding: "0.6rem 0.85rem", borderRadius: 12, gap: "0.08rem" }}>
      <div className="superadmin-kpi-head">
        <h4 style={{ margin: 0 }}>{label}</h4>
        <span className="superadmin-kpi-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="superadmin-kpi-foot">
        <p style={{ margin: 0 }}>{sub}</p>
        {pill && <span className={`superadmin-kpi-level level-${pill.level}`}>{pill.text}</span>}
      </div>
    </article>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.82rem" }}>
      <span style={{ color: "#9ca3af", marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: MUTED, minWidth: 72, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "#1e293b", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="supplier-profile-data-row">
      <span style={{ color: MUTED, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#1e293b" }}>{value}</span>
    </div>
  );
}

function SubHead({ title }: { title: string }) {
  return (
    <div className="supplier-profile-subhead">
      {title}
    </div>
  );
}

function TagPill({ text }: { text: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: "0.73rem", color: "#374151", marginRight: 4, marginBottom: 4 }}>
      {text}
    </span>
  );
}

const SECTION_ACCENT: Record<number, string> = { 1: "blue", 2: "green", 3: "teal", 4: "orange", 5: "purple" };

function SectionCard({ n, title, done, children }: {
  n: number; title: string; done: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const accent = SECTION_ACCENT[n] ?? "blue";
  return (
    <article className={`panel profile-section-card accent-${accent}`} style={{ padding: 0, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" as const }}
      >
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: done ? "#16a34a" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", color: done ? "#fff" : "#6b7280", fontWeight: 700, flexShrink: 0 }}>
          {done ? "✓" : n}
        </span>
        <span className="profile-section-title" style={{ flex: 1 }}>
          Sezione {n} — {title}
        </span>
        {done && <span className="superadmin-kpi-level level-ok" style={{ marginRight: 6 }}>Completata</span>}
        {open ? <ChevronUp size={14} color={MUTED} /> : <ChevronDown size={14} color={MUTED} />}
      </button>
      {open && (
        <>
          <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />
          <div className="profile-section-body supplier-dashboard-section-body">
            {children}
          </div>
        </>
      )}
    </article>
  );
}

/* ─── main component ─────────────────────────────────── */
export function RevampSupplierDashboardPage() {
  const { registryType: registryParam } = useParams();
  const { auth, logout } = useAuth();

  const [loading, setLoading]         = useState(true);
  const [application, setApplication] = useState<RevampApplicationSummary | null>(null);
  const [sections, setSections]       = useState<Record<string, RevampSectionSnapshot>>({});
  const [activeTab, setActiveTab]     = useState<Tab>("profilo");
  const [showModal, setShowModal]     = useState(false);
  const [evalAggregate, setEvalAggregate] = useState<MyEvaluationAggregate | null>(null);
  const [communications, setCommunications] = useState<RevampApplicationCommunication[]>([]);
  const [openIntegrationRequest, setOpenIntegrationRequest] = useState<RevampIntegrationRequestSummary | null>(null);
  const [integrationDrawerOpen, setIntegrationDrawerOpen] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [fieldChangeRequests, setFieldChangeRequests] = useState<FieldChangeRequest[]>([]);
  const [showFcrModal, setShowFcrModal] = useState(false);

  const isA    = registryParam === "albo-a";
  const isB    = registryParam === "albo-b";
  const accent = isA ? NAVY : GREEN;

  useEffect(() => {
    if (!auth?.token) { setLoading(false); return; }
    let cancelled = false;
    getMyLatestRevampApplication(auth.token)
      .then(async app => {
        if (cancelled || !app) { setLoading(false); return; }
        const expectedType = isA ? "ALBO_A" : "ALBO_B";
        if (app.registryType !== expectedType) { setLoading(false); return; }
        setApplication(app);
        const [allSecs, timeline, integrationRequest, fcrs] = await Promise.all([
          getRevampApplicationSections(app.id, auth.token!),
          getRevampApplicationCommunications(app.id, auth.token!).catch(() => [] as RevampApplicationCommunication[]),
          getOpenRevampIntegrationRequest(app.id, auth.token!).catch(() => null),
          listFieldChangeRequests(app.id, auth.token!).catch(() => [] as FieldChangeRequest[])
        ]);
        if (cancelled) return;
        const byKey: Record<string, RevampSectionSnapshot> = {};
        allSecs.forEach(sec => {
          if (!byKey[sec.sectionKey] || sec.sectionVersion > byKey[sec.sectionKey].sectionVersion)
            byKey[sec.sectionKey] = sec;
        });
        setSections(byKey);
        setCommunications(timeline);
        setOpenIntegrationRequest(integrationRequest);
        setFieldChangeRequests(fcrs);
        setLoading(false);
        getMyEvaluationAggregate(auth.token!).then(setEvalAggregate).catch(() => {});
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth?.token, isA]);

  if (!isA && !isB) return <Navigate to="/apply" replace />;

  /* ── parse all section payloads ── */
  const s1  = parseSection(sections, "S1");
  const s2  = parseSection(sections, "S2");
  const s3  = parseSection(sections, "S3");   // Albo B services
  const s3a = parseSection(sections, "S3A");  // Albo A docente
  const s3b = parseSection(sections, "S3B");  // Albo A non-docente
  const s4  = parseSection(sections, "S4");
  const s5  = parseSection(sections, "S5");

  /* ── sessionStorage fallbacks ── */
  const ss1A = JSON.parse(sessionStorage.getItem("revamp_s1")        ?? "{}") as Record<string, unknown>;
  const ss3A = JSON.parse(sessionStorage.getItem("revamp_s3")        ?? "{}") as Record<string, unknown>;
  const ss4A = JSON.parse(sessionStorage.getItem("revamp_s4")        ?? "{}") as Record<string, unknown>;
  const ss1B = JSON.parse(sessionStorage.getItem("revamp_b1")        ?? "{}") as Record<string, unknown>;
  const ss2B = JSON.parse(sessionStorage.getItem("revamp_b2")        ?? "{}") as Record<string, unknown>;
  const ss3B = JSON.parse(sessionStorage.getItem("revamp_b3")        ?? "{}") as Record<string, unknown>;
  const ss4B = JSON.parse(sessionStorage.getItem("revamp_b4")        ?? "{}") as Record<string, unknown>;
  const ss5B = JSON.parse(sessionStorage.getItem("revamp_b5")        ?? "{}") as Record<string, unknown>;
  const tipologiaSS = sessionStorage.getItem("revamp_tipologia") ?? "";

  /* ── per-section field getters ── */
  const g1  = (k: string) => s(s1[k]  ?? ss1A[k]);
  const g2  = (k: string) => s(s2[k]);
  const g4  = (k: string) => s(s4[k]  ?? ss4A[k]);
  const gb1 = (k: string) => s(s1[k]  ?? ss1B[k]);
  const gb2 = (k: string) => s(s2[k]  ?? ss2B[k]);
  const gb4 = (k: string) => s(s4[k]  ?? ss4B[k]);
  const gb5 = (k: string) => s(s5[k]  ?? ss5B[k]);
  const ga4 = (k: string) => a(s4[k]  ?? ss4A[k]);
  const gab2 = (k: string) => a(s2[k] ?? ss2B[k]);

  /* ── Albo A: pick correct S3 source based on tipologia ── */
  const tipologia = g2("tipologia") || tipologiaSS;
  const isDocente = isA && tipologia === "docente";
  const s3act  = isDocente ? s3a : s3b;
  const g3  = (k: string) => s(s3act[k] ?? ss3A[k]);
  const ga3 = (k: string) => a(s3act[k] ?? ss3A[k]);

  /* ── Albo A: experiences from S4 ── */
  const espCommittenti = ga4("committenti");
  const espTipi        = ga4("tipiIntervento");
  const espPeriodi     = ga4("periodi");
  const espCount       = espCommittenti.length;

  /* ── Albo B: S3 categories ── */
  type CatData = { voci: string[]; descrizione: string };
  const bCat = ((s3.categorie ?? ss3B.categorie) ?? {}) as Record<string, CatData>;

  /* ── Albo B: S4 ISO certs + allegati ── */
  type CertEntry = { presente: string; enteCertificatore: string; scadenza: string };
  const certData = ((s4.certificazioni ?? ss4B.certificazioni) ?? {}) as Record<string, CertEntry>;
  const allegati = ((s4.allegati ?? ss4B.allegati) ?? {}) as Record<string, string>;

  /* ── profile card derived values ── */
  const firstName    = g1("firstName");
  const lastName     = g1("lastName");
  const areeIds      = ga3("aree");
  const tagsA        = areeIds.slice(0, 6).map(id => AREA_LABELS[id] ?? id);
  const ragioneSociale  = gb1("ragioneSociale");
  const formaGiuridica  = FORMA_MAP[gb1("formaGiuridica")] ?? gb1("formaGiuridica");
  const bCatTags = Object.entries(bCat).filter(([, c]) => c.voci?.length > 0).map(([k]) => CAT_NAMES[k] ?? k);

  const displayName = isA
    ? [firstName, lastName].filter(Boolean).join(" ") || auth?.email || "Utente"
    : ragioneSociale || "Azienda";
  const initials = isA
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U"
    : ragioneSociale.substring(0, 2).toUpperCase() || "AZ";
  const roleOrType = isA
    ? (TIPOLOGIA_LABELS[tipologia] ?? tipologia) || "Professionista"
    : formaGiuridica || "Azienda";
  const locationA = [g1("city"), g1("province")].filter(Boolean).join(" (") + (g1("province") ? ")" : "");
  const locationB = [gb1("comuneLegale"), gb1("provinciaLegale")].filter(Boolean).join(" (") + (gb1("provinciaLegale") ? ")" : "");
  const location  = isA ? locationA : locationB;
  const tags      = isA ? tagsA : bCatTags;

  /* ── status ── */
  const status     = application?.status ?? "DRAFT";
  const statusCfg  = STATUS_CFG[status] ?? STATUS_CFG.DRAFT;
  const alboLabel  = isA ? "Albo A — Professionisti" : "Albo B — Aziende";
  const proto      = application?.protocolCode ?? sessionStorage.getItem(isA ? "revamp_proto" : "revamp_proto_b") ?? "—";
  const submittedAt = application?.submittedAt
    ? new Date(application.submittedAt).toLocaleDateString("it-IT") : null;
  const isApproved = status === "APPROVED";
  const isDraft    = status === "DRAFT";
  const hasOpenIntegration = (status === "INTEGRATION_REQUIRED" || status === "WAITING_SUPPLIER_RESPONSE") && Boolean(openIntegrationRequest);
  const integrationDueLabel = openIntegrationRequest?.dueAt
    ? new Date(openIntegrationRequest.dueAt).toLocaleDateString("it-IT")
    : null;
  const requestedItems = parseRequestedItems(openIntegrationRequest?.requestedItemsJson);
  const uploadItems = requestedItems.length > 0
    ? requestedItems
    : [{ code: "GENERAL_DOCUMENT", label: "Documento richiesto", instruction: "" }];
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const wizardStart   = `/apply/${registryParam}`;
  const modifySubject = encodeURIComponent(`Richiesta modifica profilo — ${alboLabel} — ${displayName}`);
  const modifyBody    = encodeURIComponent(`Gentile team Solco,\n\nRichiedo la modifica del mio profilo sull'Albo Fornitori.\n\nCodice candidatura: ${proto}\nNome/Ragione sociale: ${displayName}\n\nModifiche richieste:\n[descrivere qui le modifiche]`);

  const communicationRows = [
    ...communications.map(item => ({
      date: new Date(item.occurredAt).toLocaleDateString("it-IT"),
      text: item.eventKey === "revamp.application.submitted"
        ? `${item.message} - Codice protocollo: ${proto}`
        : item.message
    })),
    { date: new Date().toLocaleDateString("it-IT"), text: `Accesso all'area riservata - ${alboLabel}` }
  ];
  const openIntegrationRowIndex = hasOpenIntegration
    ? communicationRows.findIndex(row => row.text.toLowerCase().includes("richiesta integrazione"))
    : -1;
  const communicationCount = communicationRows.length;

  const tabItems: { id: Tab; label: string }[] = [
    { id: "profilo",       label: "Il mio profilo" },
    { id: "documenti",     label: "Documenti" },
    { id: "valutazioni",   label: "Valutazioni" },
    { id: "comunicazioni", label: "Comunicazioni" },
  ];

  /* ── print handler ── */
  function handlePrint() { window.print(); }

  /* ── download handler ── */
  async function handleDownload(fileName: string, storageKey: string) {
    if (!auth?.token || !application?.id) return;
    setDownloadingKey(storageKey);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/v2/applications/${application.id}/attachments/download?storageKey=${encodeURIComponent(storageKey)}`,
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    } finally {
      setDownloadingKey(null);
    }
  }

  /* ── document list from section payloads ── */
  type DocEntry = { label: string; subLabel: string; fileName: string; storageKey: string; mimeType: string; sizeBytes: number };
  const docsList: DocEntry[] = [];

  if (isA && s1.profilePhotoAttachment && typeof s1.profilePhotoAttachment === "object") {
    const p = s1.profilePhotoAttachment as { fileName?: string; storageKey?: string; mimeType?: string; sizeBytes?: number };
    if (p.fileName && p.storageKey) {
      docsList.push({ label: "Foto profilo", subLabel: "Sezione 1", fileName: p.fileName, storageKey: p.storageKey, mimeType: p.mimeType ?? "image/*", sizeBytes: p.sizeBytes ?? 0 });
    }
  }

  const s4Attachments = Array.isArray(s4.attachments)
    ? (s4.attachments as Array<{ documentType?: string; fileName?: string; storageKey?: string; mimeType?: string; sizeBytes?: number }>)
    : [];
  for (const att of s4Attachments) {
    if (!att.fileName || !att.storageKey) continue;
    const typeLabel = att.documentType === "CV" ? "Curriculum Vitae" : att.documentType === "CERTIFICATION" ? "Certificazione" : att.documentType ?? "Documento";
    docsList.push({ label: typeLabel, subLabel: "Sezione 4", fileName: att.fileName, storageKey: att.storageKey, mimeType: att.mimeType ?? "application/octet-stream", sizeBytes: att.sizeBytes ?? 0 });
  }

  function openIntegrationDrawer() {
    if (!hasOpenIntegration) return;
    setIntegrationDrawerOpen(true);
  }

  function rememberIntegrationEdit(step: number) {
    if (!application) return;
    saveRevampApplicationIdForRegistry(application.registryType, application.id);
    saveRevampIntegrationEditSession({
      applicationId: application.id,
      registryType: application.registryType,
      targetStep: step,
      returnPath: `/apply/${registryParam}/my-profile`
    });
    setIntegrationDrawerOpen(false);
  }

  function formatDocSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function documentTone(doc: DocEntry): "image" | "pdf" | "file" {
    const mime = doc.mimeType.toLowerCase();
    const name = doc.fileName.toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
    return "file";
  }

  /* ── completed section count ── */
  const completedCount = isA
    ? [sections.S1, sections.S2, sections.S3A ?? sections.S3B ?? sections.S3, sections.S4, sections.S5].filter(sec => sec?.completed).length
    : [sections.S1, sections.S2, sections.S3, sections.S4, sections.S5].filter(sec => sec?.completed).length;

  if (loading) {
    return (
      <div style={{ margin: "-1rem", background: "#f8fafc", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: "0.88rem", color: MUTED }}>Caricamento profilo in corso...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: 0, background: "#f8fafc", minHeight: "100vh", fontFamily: "inherit", display: "flex", flexDirection: "column" }}>

      {/* ── Modifica modal ── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "32px 36px", maxWidth: 440, width: "90%", boxShadow: "0 8px 40px #0002", position: "relative" }}>
            <button type="button" onClick={() => setShowModal(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: MUTED }}>
              <X size={18} />
            </button>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1e293b", marginBottom: 8 }}>
              {isDraft ? "Continua la compilazione" : "Richiedi modifica profilo"}
            </div>
            {isDraft ? (
              <>
                <p style={{ fontSize: "0.85rem", color: MUTED, marginBottom: 20, lineHeight: 1.6 }}>
                  La tua candidatura è ancora in bozza. Puoi tornare al modulo per continuare la compilazione.
                </p>
                <a
                  href={wizardStart}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", background: accent, color: "#fff", borderRadius: 7, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}
                  onClick={() => setShowModal(false)}
                >
                  Continua la candidatura →
                </a>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.85rem", color: MUTED, marginBottom: 8, lineHeight: 1.6 }}>
                  Per richiedere una modifica contatta il team Solco via e-mail.
                </p>
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: "0.8rem", color: "#374151" }}>
                  <div><strong>A:</strong> fornitori@grupposolco.it</div>
                  <div><strong>Oggetto:</strong> Richiesta modifica profilo — {alboLabel}</div>
                  <div><strong>Codice:</strong> {proto}</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <a
                    href={`mailto:fornitori@grupposolco.it?subject=${modifySubject}&body=${modifyBody}`}
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", background: accent, color: "#fff", borderRadius: 7, fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}
                  >
                    Apri e-mail
                  </a>
                  <button type="button" onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: "10px 0", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 7, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", color: "#374151" }}>
                    Annulla
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {integrationDrawerOpen && hasOpenIntegration && application && openIntegrationRequest ? (
        <div className="supplier-integration-drawer-overlay" onClick={() => setIntegrationDrawerOpen(false)}>
          <aside className="supplier-integration-drawer" onClick={event => event.stopPropagation()}>
            <div className="supplier-integration-drawer-head">
              <div>
                <span className="supplier-integration-drawer-kicker">Comunicazioni</span>
                <h2>Rispondi all'integrazione</h2>
                <p>{integrationDueLabel ? `Scadenza: ${integrationDueLabel}` : "Scadenza non indicata"}</p>
                <div className="supplier-integration-drawer-intro">
                  Apri le sezioni indicate, correggi e salva i dati richiesti, poi invia la risposta al Gruppo Solco dalla stessa pagina.
                </div>
              </div>
              <button type="button" className="supplier-integration-drawer-close" onClick={() => setIntegrationDrawerOpen(false)} aria-label="Chiudi">
                <X size={18} />
              </button>
            </div>

            <div className="supplier-integration-drawer-body">
              <section className="supplier-integration-drawer-section">
                <h3>Messaggio del Gruppo Solco</h3>
                <p>{openIntegrationRequest.requestMessage || "Completa le informazioni richieste e invia di nuovo la candidatura."}</p>
              </section>

              <section className="supplier-integration-drawer-section">
                <h3>Elementi richiesti</h3>
                <div className="supplier-integration-drawer-items">
                  {uploadItems.map(item => {
                    const step = targetStepForItem(item);
                    const sectionName = sectionNameForStep(application.registryType, step);
                    return (
                      <div key={`${item.code}-${item.label}`} className="supplier-integration-drawer-item">
                        <div className="supplier-integration-drawer-item-main">
                          <span className="supplier-integration-drawer-item-label">Elemento richiesto</span>
                          <strong>{item.label}</strong>
                          <p>{item.instruction || "Aggiorna questa parte della candidatura."}</p>
                        </div>
                        <Link
                          className="supplier-integration-drawer-edit"
                          to={wizardStepPath(registryParam, step)}
                          onClick={() => rememberIntegrationEdit(step)}
                        >
                          Apri sezione {step} - {sectionName}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="supplier-integration-drawer-foot">
              <div className="supplier-integration-drawer-foot-note">
                Dopo aver salvato le correzioni nella sezione indicata, potrai inviare la risposta da quella pagina.
              </div>
              <button type="button" className="supplier-integration-drawer-secondary" onClick={() => setIntegrationDrawerOpen(false)}>
                Chiudi
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* ── Top bar ── */}
      <div style={{ background: "linear-gradient(120deg, #0b3f73 0%, #1b5d96 52%, #0c467f 100%)", borderBottom: "1px solid rgba(206,226,248,0.24)", display: "flex", alignItems: "center", padding: "0 32px", minHeight: 64 }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, background: "#f5c800", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontWeight: 900, fontSize: "1.35rem", color: "#fff", letterSpacing: "-0.02em", fontFamily: "'Outfit', sans-serif" }}>
              Solco<sup style={{ fontSize: "0.45em", color: "#f5c800", verticalAlign: "super" }}>+</sup>
            </span>
            <span style={{ fontWeight: 500, fontSize: "0.66rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              Albo Fornitori Digitale
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, marginLeft: 40, height: 64 }}>
          {tabItems.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              style={{ padding: "0 20px", height: "100%", background: "none", border: "none", borderBottom: activeTab === t.id ? "2.5px solid #f5c800" : "2.5px solid transparent", fontWeight: activeTab === t.id ? 700 : 500, fontSize: "0.87rem", color: activeTab === t.id ? "#fff" : "rgba(255,255,255,0.65)", cursor: "pointer", position: "relative" }}>
              <span className="supplier-profile-tab-label">
                {t.label}
                {t.id === "comunicazioni" && hasOpenIntegration ? <span className="supplier-profile-nav-badge">1</span> : null}
              </span>
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowUserMenu(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 4px 4px", background: showUserMenu ? "rgba(255,255,255,0.15)" : "none", border: "1.5px solid transparent", borderRadius: 8, cursor: "pointer", transition: "background .15s" }}
          >
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", color: "#fff", flexShrink: 0 }}>
              {initials}
            </div>
            <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#fff" }}>{displayName}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "rgba(255,255,255,0.7)", transition: "transform .2s", transform: showUserMenu ? "rotate(180deg)" : "rotate(0deg)" }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {showUserMenu && (
            <>
              {/* backdrop to close on outside click */}
              <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setShowUserMenu(false)} />
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.09)", width: "max-content", minWidth: 0, zIndex: 50, overflow: "hidden" }}>
                {/* user info */}
                <div style={{ padding: "11px 14px 10px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.87rem", color: "#1e293b", whiteSpace: "nowrap" }}>{displayName}</div>
                  {auth?.email && <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 1, whiteSpace: "nowrap" }}>{auth.email}</div>}
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontSize: "0.69rem", fontWeight: 600, padding: "2px 7px", background: isA ? "#eff6ff" : "#f0fdf4", color: isA ? "#1d4ed8" : "#15803d", borderRadius: 10, whiteSpace: "nowrap" }}>
                      {alboLabel}
                    </span>
                  </div>
                </div>
                {/* logout */}
                <button
                  type="button"
                  onClick={() => { setShowUserMenu(false); logout(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: "0.83rem", fontWeight: 600, color: "#dc2626", textAlign: "left" as const, whiteSpace: "nowrap" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fef2f2")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Esci
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Status banner ── */}
      <div style={{ background: statusCfg.bg, borderBottom: `1px solid ${statusCfg.border}`, padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: statusCfg.color }}>
            {statusCfg.icon} {statusCfg.label} — {alboLabel}
          </div>
          <div style={{ fontSize: "0.78rem", color: statusCfg.color, marginTop: 2, opacity: 0.85 }}>{statusCfg.sub}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: "0.78rem" }}>
          {proto !== "—" && <div style={{ color: statusCfg.color, fontWeight: 600, marginBottom: 4 }}>Codice: {proto}</div>}
          {submittedAt && <div style={{ color: statusCfg.color, opacity: 0.8 }}>Inviata il: {submittedAt}</div>}
          {hasOpenIntegration && application && activeTab !== "comunicazioni" ? (
            <button type="button" className="supplier-status-integration-btn" onClick={openIntegrationDrawer}>
              Rispondi all'integrazione
            </button>
          ) : null}
          {isApproved && (
            <>
              <div style={{ fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
                Scadenza: {expiryDate.toLocaleDateString("it-IT")}
              </div>
              <div style={{ width: 200, height: 6, background: "#bbf7d0", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: "100%", height: "100%", background: "#16a34a", borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: "0.72rem", color: "#16a34a", marginTop: 2 }}>Rinnovo annuale</div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          Tab: Il mio profilo
      ══════════════════════════════════════════ */}
      {activeTab === "profilo" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px" }}>

          {/* Stats */}
          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            <StatCard
              label="Punteggio medio"
              value={evalAggregate && evalAggregate.activeEvaluations > 0 ? evalAggregate.averageOverallScore.toFixed(1) : "—"}
              sub={evalAggregate && evalAggregate.activeEvaluations > 0 ? `su ${evalAggregate.activeEvaluations} valutazion${evalAggregate.activeEvaluations === 1 ? "e" : "i"}` : "nessuna valutazione ancora"}
              tone="tone-attention"
              icon={<Star size={14} />}
              pill={evalAggregate && evalAggregate.activeEvaluations > 0 ? {
                text: evalAggregate.averageOverallScore >= 4.5 ? "Eccellente" : evalAggregate.averageOverallScore >= 3.5 ? "Buono" : evalAggregate.averageOverallScore >= 2.5 ? "Nella media" : "Da migliorare",
                level: evalAggregate.averageOverallScore >= 4.5 ? "ok" : evalAggregate.averageOverallScore >= 3.5 ? "info" : "attention"
              } : undefined}
            />
            <StatCard
              label="Collaborazioni"
              value={evalAggregate ? String(evalAggregate.activeEvaluations) : "0"}
              sub={evalAggregate && evalAggregate.activeEvaluations > 0 ? "valutazioni ricevute" : "da avviare"}
              tone="tone-info"
              icon={<Handshake size={14} />}
              pill={evalAggregate && evalAggregate.activeEvaluations > 0 ? { text: "Attivo", level: "ok" } : { text: "Nessuna", level: "info" }}
            />
            <StatCard
              label="Stato candidatura"
              value={statusCfg.label}
              sub={submittedAt ? `Inviata ${submittedAt}` : "—"}
              tone={status === "APPROVED" ? "tone-ok" : status === "REJECTED" ? "tone-critical" : status === "DRAFT" ? "tone-attention" : "tone-info"}
              icon={<FileText size={14} />}
              pill={{
                text: status === "APPROVED" ? "Attivo" : status === "REJECTED" ? "Respinta" : status === "DRAFT" ? "Bozza" : "In revisione",
                level: status === "APPROVED" ? "ok" : status === "REJECTED" ? "critical" : status === "DRAFT" ? "attention" : "info"
              }}
            />
            <StatCard
              label="Sezioni completate"
              value={`${completedCount}/5`}
              sub="sezioni del wizard"
              tone="tone-progress"
              icon={<LayoutGrid size={14} />}
              pill={{
                text: completedCount === 5 ? "Completo" : completedCount >= 3 ? "In corso" : "Da completare",
                level: completedCount === 5 ? "ok" : completedCount >= 3 ? "attention" : "info"
              }}
            />
          </div>

          {/* Two-column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

            {/* ── LEFT: compact identity card ── */}
            <div className="supplier-identity-card">
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div className="supplier-identity-avatar" style={{ background: accent }}>
                  {initials}
                </div>
                <div className="supplier-identity-name">{displayName}</div>
                <div className="supplier-identity-meta">
                  {roleOrType}{location ? ` — ${location}` : ""}
                </div>
                {isA && (
                  <div className="supplier-identity-rating">
                    <Stars rating={evalAggregate?.averageOverallScore ?? 0} />
                    <span>
                      {evalAggregate && evalAggregate.activeEvaluations > 0
                        ? `${evalAggregate.averageOverallScore.toFixed(1)} / 5`
                        : "nessuna valutazione"}
                    </span>
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <Badge
                    text={statusCfg.label}
                    color={status === "APPROVED" ? "green" : status === "REJECTED" ? "red" : status === "DRAFT" ? "yellow" : "blue"}
                  />
                </div>
              </div>

              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14, justifyContent: "center" }}>
                  {tags.slice(0, 6).map(t => (
                    <span key={t} style={{ padding: "2px 8px", border: "1.5px solid #d1d5db", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600, color: "#374151" }}>{t}</span>
                  ))}
                </div>
              )}

              <div className="supplier-identity-details">
                {isA ? (
                  <>
                    {locationA     && <InfoRow icon={<MapPin size={12} />} label="Sede"       value={locationA} />}
                    {g1("email")   && <InfoRow icon={<User size={12} />}   label="E-mail"     value={g1("email")} />}
                    {g1("phone")   && <InfoRow icon={<MapPin size={12} />} label="Telefono"   value={g1("phone")} />}
                    {g3("areaTerritoriale") && <InfoRow icon={<Globe size={12} />} label="Territorio" value={g3("areaTerritoriale")} />}
                  </>
                ) : (
                  <>
                    {locationB        && <InfoRow icon={<MapPin size={12} />} label="Sede legale" value={locationB} />}
                    {gb1("email")     && <InfoRow icon={<User size={12} />}   label="E-mail"      value={gb1("email")} />}
                    {gb1("telefono")  && <InfoRow icon={<MapPin size={12} />} label="Telefono"    value={gb1("telefono")} />}
                    {gb1("sitoWeb")   && <InfoRow icon={<Globe size={12} />}  label="Sito web"    value={gb1("sitoWeb")} />}
                  </>
                )}
              </div>

              <div className="supplier-identity-actions">
                <button type="button" onClick={() => setShowModal(true)}
                  className="supplier-identity-action is-primary">
                  <MessageSquare size={12} /> {isDraft ? "Continua" : "Modifica"}
                </button>
                <button type="button" onClick={handlePrint}
                  className="supplier-identity-action is-secondary">
                  <Download size={12} /> Scarica PDF
                </button>
              </div>
            </div>

            {/* ── RIGHT: section data cards ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {isA ? (
                /* ═══════ ALBO A ═══════ */
                <>
                  {/* S1 — Dati Anagrafici */}
                  <SectionCard n={1} title="Dati Anagrafici" done={!!sections.S1?.completed}>
                    <SubHead title="Dati personali" />
                    <DataRow label="Nome e cognome"   value={[g1("firstName"), g1("lastName")].filter(Boolean).join(" ")} />
                    <DataRow label="Codice Fiscale"   value={g1("taxCode")} />
                    <DataRow label="Partita IVA"      value={g1("vatNumber")} />
                    <DataRow label="Regime fiscale"   value={TAX_REGIME_LABELS[g1("taxRegime")] ?? g1("taxRegime")} />

                    <SubHead title="Indirizzo professionale / residenza" />
                    <DataRow label="Via e civico"     value={g1("address")} />
                    <DataRow label="Comune"           value={[g1("city"), g1("postalCode") ? `– ${g1("postalCode")}` : "", g1("province") ? `(${g1("province")})` : ""].filter(Boolean).join(" ")} />

                    <SubHead title="Contatti" />
                    <DataRow label="Telefono"         value={g1("phone")} />
                    <DataRow label="E-mail"           value={g1("email")} />
                    <DataRow label="LinkedIn"         value={g1("linkedin")} />
                  </SectionCard>

                  {/* S2 — Tipologia */}
                  <SectionCard n={2} title="Tipologia Professionale" done={!!sections.S2?.completed}>
                    <DataRow label="Tipologia"        value={TIPOLOGIA_LABELS[tipologia] ?? tipologia} />
                    <DataRow label="Codice ATECO"     value={g2("ateco")} />
                    {a(s2.multiRuoli).length > 0 && (
                      <>
                        <SubHead title="Ruoli aggiuntivi" />
                        <div>{a(s2.multiRuoli).map(r => <TagPill key={r} text={TIPOLOGIA_LABELS[r] ?? r} />)}</div>
                      </>
                    )}
                  </SectionCard>

                  {/* S3A — Competenze (Docente) */}
                  {isDocente && (
                    <SectionCard n={3} title="Competenze — Docente / Formatore" done={!!sections.S3A?.completed}>
                      <SubHead title="Istruzione e abilitazioni" />
                      <DataRow label="Titolo di studio"    value={g3("titoloStudio")} />
                      <DataRow label="Anno conseguimento"  value={g3("annoConseg")} />
                      <DataRow label="Ambito di studio"    value={g3("ambitoStudio")} />
                      <DataRow label="Certificazioni"      value={g3("certAbitazioni")} />

                      <SubHead title="Aree tematiche" />
                      {ga3("aree").length > 0
                        ? <div>{ga3("aree").map(id => <TagPill key={id} text={AREA_LABELS[id] ?? id} />)}</div>
                        : <span style={{ fontSize: "0.8rem", color: MUTED }}>—</span>}

                      <SubHead title="Operatività e contesto" />
                      <DataRow label="Docenza PA"          value={DOCENZA_PA_LABELS[g3("docenzaPA")] ?? g3("docenzaPA")} />
                      <DataRow label="Area territoriale"   value={g3("areaTerritoriale")} />
                      <DataRow label="Lingue parlate"      value={g3("lingue")} />
                      <DataRow label="Lingue docenza"      value={g3("lingueDocenza")} />
                      <DataRow label="Strumenti digitali"  value={g3("strumenti")} />
                      <DataRow label="Reti / associazioni" value={g3("reti")} />
                      {a(s3act.consulenza ?? ss3A.consulenza).length > 0 && (
                        <>
                          <SubHead title="Ambiti di consulenza" />
                          <div>{a(s3act.consulenza ?? ss3A.consulenza).map(c => <TagPill key={c} text={c} />)}</div>
                        </>
                      )}
                    </SectionCard>
                  )}

                  {/* S3B — Competenze (Non-Docente) */}
                  {!isDocente && (
                    <SectionCard n={3} title="Competenze — Profilo Professionale" done={!!sections.S3B?.completed}>
                      <SubHead title="Formazione e profilo" />
                      <DataRow label="Titolo di studio"      value={g3("titoloB")} />
                      <DataRow label="Ambito di studio"      value={g3("ambitoB")} />
                      <DataRow label="Anni di esperienza"    value={g3("anniEsp")} />
                      <DataRow label="Ordine professionale"  value={g3("ordine")} />
                      <DataRow label="Certificazioni"        value={g3("certB")} />

                      {ga3("servizi").length > 0 && (
                        <>
                          <SubHead title="Servizi offerti" />
                          <div>{ga3("servizi").map(sv => <TagPill key={sv} text={sv} />)}</div>
                        </>
                      )}
                      <DataRow label="Altro / note servizi"  value={g3("altroServ")} />
                    </SectionCard>
                  )}

                  {/* S4 — Disponibilità */}
                  <SectionCard n={4} title={isDocente ? "Disponibilità, Esperienze e Allegati" : "Disponibilità e Allegati"} done={!!sections.S4?.completed}>
                    {isDocente ? (
                      <>
                        <SubHead title="Disponibilità e tariffe" />
                        <DataRow label="Trasferte"           value={DISPONIBILITA_LABELS[g4("disponibilita")] ?? g4("disponibilita")} />
                        <DataRow label="Aree geografiche"    value={g4("areeSpecifiche")} />
                        <DataRow label="Tariffa giornaliera" value={g4("tariffaGiorn")} />
                        <DataRow label="Tariffa oraria"      value={g4("tariffaOra")} />

                        {espCount > 0 && (
                          <>
                            <SubHead title={`Esperienze formative (${espCount})`} />
                            {espCommittenti.map((c, i) => (
                              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px", gap: 8, padding: "5px 0", borderBottom: "1px solid #f8fafc", fontSize: "0.82rem" }}>
                                <span style={{ color: "#1e293b", fontWeight: 500 }}>{c}</span>
                                <span style={{ color: MUTED }}>{TIPO_INTERVENTO_LABELS[espTipi[i]] ?? espTipi[i]}</span>
                                <span style={{ color: MUTED }}>{espPeriodi[i]}</span>
                              </div>
                            ))}
                          </>
                        )}

                        <SubHead title="Allegati" />
                        <DataRow label="Curriculum Vitae"    value={g4("cvName")} />
                        <DataRow label="Certificazioni"      value={g4("certName")} />
                      </>
                    ) : (
                      <>
                        <DataRow label="Area territoriale"   value={g4("areaTerrB")} />
                        <DataRow label="Tariffa oraria"      value={g4("tariffaOraB")} />
                        <DataRow label="Curriculum Vitae"    value={g4("cvName")} />
                      </>
                    )}
                  </SectionCard>

                  {/* S5 — Dichiarazioni */}
                  <SectionCard n={5} title="Dichiarazioni e Consensi" done={!!sections.S5?.completed}>
                    {sections.S5?.completed ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                          <span style={{ color: "#16a34a", fontSize: "1.1rem" }}>✓</span>
                          <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1e293b" }}>Tutte le dichiarazioni obbligatorie accettate</span>
                        </div>
                        <DataRow label="Consenso commerciale" value={s5.marketingConsent ? "Sì" : s5.marketingConsent === false ? "No" : ""} />
                      </>
                    ) : (
                      <span style={{ fontSize: "0.82rem", color: MUTED }}>Sezione non ancora completata.</span>
                    )}
                  </SectionCard>
                </>
              ) : (
                /* ═══════ ALBO B ═══════ */
                <>
                  {/* S1 — Dati Aziendali */}
                  <SectionCard n={1} title="Dati Aziendali" done={!!sections.S1?.completed}>
                    <SubHead title="Anagrafica aziendale" />
                    <DataRow label="Ragione sociale"    value={gb1("ragioneSociale")} />
                    <DataRow label="Forma giuridica"    value={FORMA_MAP[gb1("formaGiuridica")] ?? gb1("formaGiuridica")} />
                    <DataRow label="Partita IVA"        value={gb1("piva")} />
                    <DataRow label="Codice Fiscale"     value={gb1("codiceFiscale")} />
                    <DataRow label="Numero REA"         value={gb1("rea")} />
                    <DataRow label="CCIAA"              value={gb1("cciaa")} />
                    <DataRow label="Data costituzione"  value={gb1("dataCostituzione")} />

                    <SubHead title="Sede legale" />
                    <DataRow label="Via e civico"       value={gb1("indirizzoLegale")} />
                    <DataRow label="Comune"             value={[gb1("comuneLegale"), gb1("capLegale") ? `– ${gb1("capLegale")}` : "", gb1("provinciaLegale") ? `(${gb1("provinciaLegale")})` : ""].filter(Boolean).join(" ")} />
                    <DataRow label="Sede operativa"     value={gb1("sedeOperativa")} />

                    <SubHead title="Contatti istituzionali" />
                    <DataRow label="E-mail"             value={gb1("email")} />
                    <DataRow label="PEC"                value={gb1("pec")} />
                    <DataRow label="Telefono"           value={gb1("telefono")} />
                    <DataRow label="Sito web"           value={gb1("sitoWeb")} />

                    <SubHead title="Legale rappresentante" />
                    <DataRow label="Nome e cognome"     value={gb1("lrNomeCognome")} />
                    <DataRow label="Codice Fiscale"     value={gb1("lrCodiceFiscale")} />
                    <DataRow label="Ruolo / carica"     value={gb1("lrRuolo")} />

                    <SubHead title="Referente operativo" />
                    <DataRow label="Nome e cognome"     value={gb1("refNome")} />
                    <DataRow label="Ruolo"              value={gb1("refRuolo")} />
                    <DataRow label="E-mail"             value={gb1("refEmail")} />
                    <DataRow label="Telefono"           value={gb1("refTelefono")} />
                  </SectionCard>

                  {/* S2 — Struttura e Dimensione */}
                  <SectionCard n={2} title="Struttura e Dimensione" done={!!sections.S2?.completed}>
                    <DataRow label="N. dipendenti"     value={DIPENDENTI_LABELS[gb2("dipendenti")] ?? gb2("dipendenti")} />
                    <DataRow label="Fatturato"         value={FATTURATO_LABELS[gb2("fatturato")] ?? gb2("fatturato")} />
                    <DataRow label="ATECO principale"  value={gb2("atecoMain")} />
                    {gab2("atecoSecondari").length > 0 && (
                      <DataRow label="ATECO secondari" value={gab2("atecoSecondari").join(", ")} />
                    )}

                    {gab2("regioni").length > 0 && (
                      <>
                        <SubHead title="Regioni di operatività" />
                        <div>{gab2("regioni").map(r => <TagPill key={r} text={r} />)}</div>
                      </>
                    )}

                    <SubHead title="Accreditamento formazione" />
                    <DataRow label="Accreditato"       value={gb2("accreditatoFormazione") === "si" ? "Sì" : gb2("accreditatoFormazione") === "no" ? "No" : gb2("accreditatoFormazione")} />
                    {gb2("accreditatoFormazione") === "si" && (
                      <>
                        <DataRow label="Regioni acc."  value={gab2("accreditamentoRegioni").join(", ")} />
                        <DataRow label="Tipi acc."     value={gab2("accreditamentoTipi").join(", ")} />
                      </>
                    )}

                    <SubHead title="Terzo Settore" />
                    <DataRow label="Terzo Settore"     value={gb2("isTerzoSettore") === "si" ? "Sì" : gb2("isTerzoSettore") === "no" ? "No" : gb2("isTerzoSettore")} />
                    {gb2("isTerzoSettore") === "si" && (
                      <>
                        <DataRow label="Tipo ETS"      value={gb2("tipoEts")} />
                        <DataRow label="N. RUNTS"      value={gb2("runts")} />
                      </>
                    )}
                  </SectionCard>

                  {/* S3 — Servizi Offerti */}
                  <SectionCard n={3} title="Servizi Offerti" done={!!sections.S3?.completed}>
                    {Object.entries(bCat).filter(([, c]) => c.voci?.length > 0).length === 0 ? (
                      <span style={{ fontSize: "0.82rem", color: MUTED }}>Nessun servizio inserito.</span>
                    ) : (
                      Object.entries(bCat).filter(([, c]) => c.voci?.length > 0).map(([key, cat]) => (
                        <div key={key} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: accent, marginBottom: 5 }}>
                            Categoria {key} — {CAT_NAMES[key] ?? key}
                          </div>
                          <div style={{ marginBottom: cat.descrizione ? 4 : 0 }}>
                            {cat.voci.map(v => <TagPill key={v} text={v} />)}
                          </div>
                          {cat.descrizione && (
                            <div style={{ fontSize: "0.8rem", color: MUTED, fontStyle: "italic", marginTop: 4, lineHeight: 1.5 }}>
                              {cat.descrizione}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </SectionCard>

                  {/* S4 — Certificazioni e Allegati */}
                  <SectionCard n={4} title="Certificazioni e Allegati" done={!!sections.S4?.completed}>
                    <SubHead title="Certificazioni ISO" />
                    {Object.entries(certData).filter(([, c]) => c?.presente === "si").length === 0 ? (
                      <span style={{ fontSize: "0.8rem", color: MUTED }}>Nessuna certificazione presente.</span>
                    ) : (
                      Object.entries(certData).filter(([, c]) => c?.presente === "si").map(([key, c]) => (
                        <div key={key} style={{ padding: "5px 0", borderBottom: "1px solid #f8fafc" }}>
                          <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "#1e293b" }}>{ISO_NAMES[key] ?? key}</div>
                          {(c.enteCertificatore || c.scadenza) && (
                            <div style={{ fontSize: "0.78rem", color: MUTED }}>
                              {c.enteCertificatore && `Ente: ${c.enteCertificatore}`}
                              {c.enteCertificatore && c.scadenza && " — "}
                              {c.scadenza && `Scadenza: ${c.scadenza}`}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <DataRow label="Altre certificazioni"   value={gb4("altreCertificazioni")} />

                    <SubHead title="Accreditamenti" />
                    <DataRow label="Acc. formazione"         value={gb4("accreditamentoFormazione") === "si" ? "Sì" : gb4("accreditamentoFormazione") === "no" ? "No" : gb4("accreditamentoFormazione")} />
                    {gb4("accreditamentoFormazione") === "si" && (
                      <>
                        <DataRow label="Regioni"             value={gb4("accreditamentoRegioni")} />
                        <DataRow label="Tipo"                value={gb4("accreditamentoTipoFormazione")} />
                      </>
                    )}
                    <DataRow label="Acc. servizi al lavoro"  value={gb4("accreditamentoServiziLavoro") === "si" ? "Sì" : gb4("accreditamentoServiziLavoro") === "no" ? "No" : gb4("accreditamentoServiziLavoro")} />

                    <SubHead title="Documenti allegati" />
                    <DataRow label="Visura camerale"         value={allegati.visura} />
                    <DataRow label="DURC"                    value={allegati.durc} />
                    <DataRow label="Company profile"         value={allegati.companyProfile} />
                    <DataRow label="Certificati ISO / acc."  value={allegati.certificatiAllegati} />
                  </SectionCard>

                  {/* S5 — Dichiarazioni */}
                  <SectionCard n={5} title="Dichiarazioni e Compliance" done={!!sections.S5?.completed}>
                    {sections.S5?.completed ? (
                      <>
                        <DataRow label="Modello 231" value={MODELLO231_LABELS[gb5("modelloOrganizzativo231")] ?? gb5("modelloOrganizzativo231")} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                          <span style={{ color: "#16a34a", fontSize: "1.1rem" }}>✓</span>
                          <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1e293b" }}>Tutte le dichiarazioni obbligatorie accettate</span>
                        </div>
                        <DataRow label="Consenso commerciale" value={
                          s5.consensoComunicazioniCommerciali === true || ss5B.consensoComunicazioniCommerciali === true ? "Sì" :
                          s5.consensoComunicazioniCommerciali === false || ss5B.consensoComunicazioniCommerciali === false ? "No" : ""
                        } />
                      </>
                    ) : (
                      <span style={{ fontSize: "0.82rem", color: MUTED }}>Sezione non ancora completata.</span>
                    )}
                  </SectionCard>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Documenti ── */}
      {activeTab === "documenti" && (
        <div style={{ maxWidth: 1080, margin: "24px auto 32px", padding: "0 24px", width: "100%" }}>
          <div className="supplier-documents-head">
            <h3>Documenti caricati</h3>
            <span className="supplier-documents-count">{docsList.length} file</span>
          </div>
          {docsList.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "40px 32px", textAlign: "center" }}>
              <FileText size={40} color="#d1d5db" style={{ margin: "0 auto 16px", display: "block" }} />
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#6b7280", marginBottom: 8 }}>Nessun documento caricato</div>
              <div style={{ fontSize: "0.84rem", color: MUTED }}>I documenti allegati durante la compilazione appariranno qui.</div>
            </div>
          ) : (
            <div className="supplier-documents-list">
              {docsList.map((doc) => {
                const tone = documentTone(doc);
                const Icon = tone === "image" ? Image : FileText;
                return (
                  <div key={doc.storageKey} className="supplier-document-card">
                    <div className={`supplier-document-icon is-${tone}`}>
                      <Icon size={19} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="supplier-document-title">{doc.label}</div>
                      <div className="supplier-document-file">{doc.fileName}</div>
                      <div className="supplier-document-meta">
                        <span className="supplier-document-chip is-section">{doc.subLabel}</span>
                        <span className="supplier-document-chip">{formatDocSize(doc.sizeBytes)}</span>
                        {tone === "pdf" ? <span className="supplier-document-chip">PDF</span> : null}
                        {tone === "image" ? <span className="supplier-document-chip">Immagine</span> : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="supplier-document-download"
                      onClick={() => handleDownload(doc.fileName, doc.storageKey)}
                      disabled={downloadingKey === doc.storageKey || !application?.id}
                    >
                      <Download size={13} />
                      {downloadingKey === doc.storageKey ? "..." : "Scarica"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* ── Tab: Valutazioni ── */}
      {activeTab === "valutazioni" && (
        <div style={{ maxWidth: 1080, margin: "24px auto 32px", padding: "0 24px", width: "100%" }}>
          <div className="supplier-documents-head">
            <h3>Valutazioni ricevute</h3>
            <span className="supplier-documents-count">{evalAggregate?.activeEvaluations ?? 0} valutazioni</span>
          </div>
          {evalAggregate && evalAggregate.activeEvaluations > 0 ? (
            <div className="supplier-evaluation-grid">
              {/* Score summary card */}
              <div className="supplier-evaluation-card supplier-evaluation-summary">
                <div className="supplier-evaluation-score">
                  <div className="supplier-evaluation-number">
                    {evalAggregate.averageOverallScore.toFixed(1)}
                  </div>
                  <div className="supplier-evaluation-stars">
                    <Stars rating={evalAggregate.averageOverallScore} />
                  </div>
                </div>
                <div className="supplier-evaluation-copy">
                  <div className="supplier-evaluation-title">Punteggio medio</div>
                  <div className="supplier-evaluation-kpi">
                    <span>{evalAggregate.activeEvaluations}</span>
                    <strong>valutazion{evalAggregate.activeEvaluations === 1 ? "e" : "i"} ricevut{evalAggregate.activeEvaluations === 1 ? "a" : "e"}</strong>
                  </div>
                  {evalAggregate.totalEvaluations > evalAggregate.activeEvaluations && (
                    <div className="supplier-evaluation-note">
                      {evalAggregate.totalEvaluations - evalAggregate.activeEvaluations} annullat{evalAggregate.totalEvaluations - evalAggregate.activeEvaluations === 1 ? "a" : "e"}
                    </div>
                  )}
                  <div className="supplier-evaluation-note">
                    Le valutazioni sono assegnate dai responsabili del Gruppo Solco dopo ogni collaborazione.
                  </div>
                </div>
              </div>

              {/* Category averages */}
              <div className="supplier-evaluation-card supplier-evaluation-categories">
                <div className="supplier-evaluation-title">Medie per categoria</div>
                {Object.keys(evalAggregate.dimensionAverages ?? {}).length > 0 ? (
                  <div className="supplier-category-list">
                    {Object.entries(evalAggregate.dimensionAverages).map(([key, value]) => (
                      <div key={key} className="supplier-category-row">
                        <span>{EVALUATION_CATEGORY_LABELS[key] ?? key}</span>
                        <div className="supplier-category-track">
                          <div style={{ width: `${Math.max(0, Math.min(100, (value / 5) * 100))}%` }} />
                        </div>
                        <strong>{value.toFixed(1)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="supplier-evaluation-note">Le medie per categoria saranno disponibili con le prossime valutazioni dettagliate.</div>
                )}
              </div>

              {/* Score bar visual */}
              <div className="supplier-evaluation-card supplier-evaluation-distribution">
                <div className="supplier-evaluation-title">Distribuzione punteggio</div>
                {[5, 4, 3, 2, 1].map(star => {
                  const distribution = evalAggregate.scoreDistribution ?? {};
                  const maxCount = Math.max(1, ...[1, 2, 3, 4, 5].map(score => distribution[String(score)] ?? 0));
                  const count = distribution[String(star)] ?? 0;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={star} className="supplier-score-row">
                      <span>{star}</span>
                      <Star size={11} fill="#f59e0b" color="#f59e0b" />
                      <div className="supplier-score-track">
                        <div style={{ width: `${pct}%` }} />
                      </div>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="supplier-empty-state-card">
              <div className="supplier-empty-state-icon is-rating">
                <Star size={22} />
              </div>
              <div>
                <div className="supplier-empty-state-title">Nessuna valutazione ancora</div>
                <div className="supplier-empty-state-text">Le valutazioni appariranno qui dopo le prime collaborazioni con il Gruppo Solco.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Comunicazioni ── */}
      {activeTab === "comunicazioni" && (
        <div style={{ maxWidth: 1080, margin: "24px auto 32px", padding: "0 24px", width: "100%" }}>
          <div className="supplier-documents-head">
            <h3>Comunicazioni</h3>
            <span className="supplier-documents-count">{communicationCount} aggiornamenti</span>
            {isApproved && (
              <button
                type="button"
                className="home-btn home-btn-primary admin-action-btn"
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}
                onClick={() => setShowFcrModal(true)}
              >
                <FileEdit size={15} />
                Richiesta Modifica Dati
              </button>
            )}
          </div>

          {/* ── FCR list — appears above system communications ── */}
          {fieldChangeRequests.length > 0 && (
            <div className="supplier-communications-card" style={{ marginBottom: 16 }}>
              <div className="supplier-communications-top">
                <div>
                  <div className="supplier-communications-title">Richieste di modifica</div>
                  <div className="supplier-communications-subtitle">Storico delle tue richieste di aggiornamento dati.</div>
                </div>
                <div className="supplier-communications-icon"><FileEdit size={19} /></div>
              </div>
              {fieldChangeRequests.map((fcr) => {
                const statusLabels: Record<string, string> = {
                  PENDING_ADMIN_REVIEW: "In attesa di risposta",
                  UNLOCKED: "Sezione sbloccata — aggiorna i tuoi dati",
                  REJECTED_BY_ADMIN: "Richiesta rifiutata",
                  SUBMITTED: "Inviata — in revisione",
                  UNDER_REVIEW: "In revisione",
                  APPROVED: "Modifica approvata",
                  REJECTED: "Modifica respinta",
                };
                const isUnlocked = fcr.status === "UNLOCKED";
                return (
                  <div key={fcr.id} className={`supplier-communication-row${isUnlocked ? " is-actionable" : ""}`}>
                    <div className="supplier-communication-marker" />
                    <span className="supplier-communication-date">
                      {new Date(fcr.createdAt).toLocaleDateString("it-IT")}
                    </span>
                    <span className="supplier-communication-text">
                      <span>
                        <strong>Sezione {fcr.sectionKey}</strong> — {fcr.supplierMessage}
                      </span>
                      <span style={{ display: "block", fontSize: "0.78rem", marginTop: 2, opacity: 0.75 }}>
                        {statusLabels[fcr.status] ?? fcr.status}
                        {fcr.adminNote ? ` — Nota admin: ${fcr.adminNote}` : ""}
                      </span>
                      {isUnlocked && application && (
                        <span className="supplier-communication-action-meta">
                          <button
                            type="button"
                            className="supplier-communication-row-btn"
                            onClick={() => {
                              const step = { S1: 1, S2: 2, S3: 3, S4: 4, S5: 5 }[fcr.sectionKey] ?? 1;
                              window.location.href = `/revamp/${application.registryType === "ALBO_B" ? "albo-b" : "albo-a"}/step-${step}`;
                            }}
                          >
                            Aggiorna Sezione {fcr.sectionKey}
                          </button>
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="supplier-communications-card">
            <div className="supplier-communications-top">
              <div>
                <div className="supplier-communications-title">Storico comunicazioni</div>
                <div className="supplier-communications-subtitle">Aggiornamenti relativi alla tua candidatura.</div>
              </div>
              <div className="supplier-communications-icon">
                <MessageSquare size={19} />
              </div>
            </div>
            {communicationRows.map((msg, i) => {
              const isOpenIntegrationRow = hasOpenIntegration && application && i === openIntegrationRowIndex;
              return (
              <div key={i} className={`supplier-communication-row${isOpenIntegrationRow ? " is-actionable" : ""}`}>
                <div className="supplier-communication-marker" />
                <span className="supplier-communication-date">{msg.date}</span>
                <span className="supplier-communication-text">
                  <span>{msg.text}</span>
                  {isOpenIntegrationRow ? (
                    <span className="supplier-communication-action-meta">
                      {integrationDueLabel ? <span>Scadenza: {integrationDueLabel}</span> : null}
                      <button type="button" className="supplier-communication-row-btn" onClick={openIntegrationDrawer}>
                        Rispondi
                      </button>
                    </span>
                  ) : null}
                </span>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FCR Modal ── */}
      {showFcrModal && application && (
        <FieldChangeRequestModal
          applicationId={application.id}
          token={auth.token!}
          onClose={() => setShowFcrModal(false)}
          onSent={() => {
            setShowFcrModal(false);
            listFieldChangeRequests(application.id, auth.token!).then(setFieldChangeRequests).catch(() => {});
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════
          PRINT-ONLY AREA — hidden on screen, visible on print
      ═══════════════════════════════════════════════════ */}
      <style>{`
        @media screen { .revamp-pdf { display: none !important; } }
        @media print {
          body * { visibility: hidden; }
          .revamp-pdf, .revamp-pdf * { visibility: visible; }
          .revamp-pdf { position: absolute; top: 0; left: 0; width: 100%; padding: 40px 48px; box-sizing: border-box; font-family: Arial, sans-serif; }
          .revamp-pdf-row { display: flex; gap: 24px; margin-bottom: 6px; }
          .revamp-pdf-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; min-width: 160px; }
          .revamp-pdf-value { font-size: 11px; color: #111827; }
          .revamp-pdf-section { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
          .revamp-pdf-section-title { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
          .revamp-pdf-tag { display: inline-block; padding: 2px 7px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 9px; margin: 2px 3px 2px 0; color: #374151; }
        }
      `}</style>

      <div className="revamp-pdf">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, borderBottom: "2px solid #0f2a52", paddingBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f2a52", letterSpacing: "-0.5px" }}>Solco<sup style={{ fontSize: 10, color: "#f5c800" }}>+</sup></div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Albo Fornitori Digitale — {alboLabel}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Codice candidatura</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{proto}</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Stampato il {new Date().toLocaleDateString("it-IT")}</div>
          </div>
        </div>

        {/* Status banner */}
        <div style={{ background: statusCfg.bg, border: `1.5px solid ${statusCfg.border}`, borderRadius: 8, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{statusCfg.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: statusCfg.color }}>{statusCfg.label}</div>
            <div style={{ fontSize: 10, color: statusCfg.color, marginTop: 2 }}>{statusCfg.sub}</div>
          </div>
        </div>

        {/* Identity */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{displayName}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{roleOrType}{location ? ` — ${location}` : ""}</div>
        </div>

        {isA ? (
          <>
            {/* S1 — Dati personali */}
            <div className="revamp-pdf-section">
              <div className="revamp-pdf-section-title">Sezione 1 — Dati Anagrafici</div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Data di nascita</span><span className="revamp-pdf-value">{g1("birthDate") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Codice fiscale</span><span className="revamp-pdf-value">{g1("taxCode") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Partita IVA</span><span className="revamp-pdf-value">{g1("vatNumber") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Regime fiscale</span><span className="revamp-pdf-value">{TAX_REGIME_LABELS[g1("taxRegime")] || g1("taxRegime") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">E-mail</span><span className="revamp-pdf-value">{g1("email") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Telefono</span><span className="revamp-pdf-value">{g1("phone") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Indirizzo</span><span className="revamp-pdf-value">{[g1("address"), g1("city"), g1("postalCode"), g1("province")].filter(Boolean).join(", ") || "—"}</span></div>
            </div>

            {/* S2 — Tipologia */}
            <div className="revamp-pdf-section">
              <div className="revamp-pdf-section-title">Sezione 2 — Tipologia Professionale</div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Tipologia</span><span className="revamp-pdf-value">{TIPOLOGIA_LABELS[g2("tipologia")] || g2("tipologia") || "—"}</span></div>
              {g2("atecoCode") && <div className="revamp-pdf-row"><span className="revamp-pdf-label">Codice ATECO</span><span className="revamp-pdf-value">{g2("atecoCode")}</span></div>}
            </div>

            {/* S3 — Competenze */}
            <div className="revamp-pdf-section">
              <div className="revamp-pdf-section-title">Sezione 3 — Competenze</div>
              {isDocente ? (
                <>
                  <div className="revamp-pdf-row"><span className="revamp-pdf-label">Anni di docenza</span><span className="revamp-pdf-value">{g3("yearsExperience") || "—"}</span></div>
                  <div className="revamp-pdf-row"><span className="revamp-pdf-label">Titolo di studio</span><span className="revamp-pdf-value">{g3("highestTitle") || g3("titoloStudio") || "—"}</span></div>
                  {tagsA.length > 0 && (
                    <div className="revamp-pdf-row">
                      <span className="revamp-pdf-label">Aree tematiche</span>
                      <span className="revamp-pdf-value">{tagsA.map(t => <span key={t} className="revamp-pdf-tag">{t}</span>)}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="revamp-pdf-row"><span className="revamp-pdf-label">Titolo di studio</span><span className="revamp-pdf-value">{g3("highestTitle") || g3("titoloB") || "—"}</span></div>
                  <div className="revamp-pdf-row"><span className="revamp-pdf-label">Anni di esperienza</span><span className="revamp-pdf-value">{g3("experienceBand") || g3("anniEsp") || "—"}</span></div>
                  <div className="revamp-pdf-row"><span className="revamp-pdf-label">Ambito di studio</span><span className="revamp-pdf-value">{g3("studyArea") || g3("ambitoB") || "—"}</span></div>
                </>
              )}
            </div>

            {/* S4 — Disponibilità */}
            <div className="revamp-pdf-section">
              <div className="revamp-pdf-section-title">Sezione 4 — Disponibilità e Allegati</div>
              {isDocente ? (
                <>
                  <div className="revamp-pdf-row"><span className="revamp-pdf-label">Disponibilità trasferte</span><span className="revamp-pdf-value">{DISPONIBILITA_LABELS[g4("disponibilita")] || g4("disponibilita") || "—"}</span></div>
                  {espCount > 0 && <div className="revamp-pdf-row"><span className="revamp-pdf-label">Esperienze dichiarate</span><span className="revamp-pdf-value">{espCount}</span></div>}
                </>
              ) : (
                <div className="revamp-pdf-row"><span className="revamp-pdf-label">Area territoriale</span><span className="revamp-pdf-value">{g4("areaTerrB") || "—"}</span></div>
              )}
              {g4("cvName") && <div className="revamp-pdf-row"><span className="revamp-pdf-label">CV allegato</span><span className="revamp-pdf-value">{g4("cvName")}</span></div>}
            </div>

            {/* S5 — Dichiarazioni */}
            <div className="revamp-pdf-section">
              <div className="revamp-pdf-section-title">Sezione 5 — Dichiarazioni e Consensi</div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Completata</span><span className="revamp-pdf-value">{sections.S5?.completed ? "Sì" : "No"}</span></div>
              {submittedAt && <div className="revamp-pdf-row"><span className="revamp-pdf-label">Data invio candidatura</span><span className="revamp-pdf-value">{submittedAt}</span></div>}
            </div>
          </>
        ) : (
          <>
            {/* Albo B — S1 */}
            <div className="revamp-pdf-section">
              <div className="revamp-pdf-section-title">Sezione 1 — Dati Aziendali</div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Forma giuridica</span><span className="revamp-pdf-value">{formaGiuridica || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Partita IVA</span><span className="revamp-pdf-value">{gb1("partitaIva") || gb1("vatNumber") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">E-mail istituzionale</span><span className="revamp-pdf-value">{gb1("emailIstituzionale") || gb1("institutionalEmail") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Telefono</span><span className="revamp-pdf-value">{gb1("telefono") || gb1("phone") || "—"}</span></div>
            </div>

            {/* Albo B — S2 */}
            <div className="revamp-pdf-section">
              <div className="revamp-pdf-section-title">Sezione 2 — Struttura e Dimensione</div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Dipendenti</span><span className="revamp-pdf-value">{DIPENDENTI_LABELS[gb2("dipendenti")] || gb2("employeeRange") || "—"}</span></div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Fatturato</span><span className="revamp-pdf-value">{FATTURATO_LABELS[gb2("fatturato")] || gb2("revenueBand") || "—"}</span></div>
            </div>

            {/* Albo B — S3 categories */}
            {bCatTags.length > 0 && (
              <div className="revamp-pdf-section">
                <div className="revamp-pdf-section-title">Sezione 3 — Servizi Offerti</div>
                <div className="revamp-pdf-row">
                  <span className="revamp-pdf-label">Categorie</span>
                  <span className="revamp-pdf-value">{bCatTags.map(t => <span key={t} className="revamp-pdf-tag">{t}</span>)}</span>
                </div>
              </div>
            )}

            {/* Albo B — S5 */}
            <div className="revamp-pdf-section">
              <div className="revamp-pdf-section-title">Sezione 5 — Dichiarazioni e Compliance</div>
              <div className="revamp-pdf-row"><span className="revamp-pdf-label">Completata</span><span className="revamp-pdf-value">{sections.S5?.completed ? "Sì" : "No"}</span></div>
              {submittedAt && <div className="revamp-pdf-row"><span className="revamp-pdf-label">Data invio candidatura</span><span className="revamp-pdf-value">{submittedAt}</span></div>}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, borderTop: "1px solid #e5e7eb", paddingTop: 12, fontSize: 9, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
          <span>Solco+ — Albo Fornitori Digitale</span>
          <span>Documento generato il {new Date().toLocaleDateString("it-IT")} — {new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <div className="app-footer-left">© {new Date().getFullYear()} Albo Fornitori Digitale. Tutti i diritti riservati.</div>
        <div className="app-footer-right">
          <a href="/privacy" style={{ color: "#2d5478", textDecoration: "none" }}>Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
