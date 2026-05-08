import { Grid3x3 } from "lucide-react";
import { SectionCard, ProfileSubsection } from "../shared/SectionCard";
import { TagList } from "../shared/TagList";

type P = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  CAT_A: "Formazione e Didattica",
  CAT_B: "HR e Organizzazione",
  CAT_C: "Tecnologia e Digitale",
  CAT_D: "Consulenza e Compliance",
  CAT_E: "Servizi Generali",
};

const SERVICE_LABELS: Record<string, string> = {
  TRAINING_DESIGN: "Progettazione percorsi formativi",
  LMS_CONTENT: "Contenuti e-learning / LMS",
  ASSESSMENT: "Assessment competenze",
  SIMULATION: "Simulatori / VR / AR",
  RECRUITING: "Ricerca e selezione",
  STAFFING: "Somministrazione lavoro",
  PAYROLL: "Payroll",
  HR_CONSULTING: "Consulenza HR",
  CUSTOM_SOFTWARE: "Sviluppo software custom",
  CYBERSECURITY: "Cybersecurity",
  BI_DASHBOARD: "Data analysis / BI",
  AI_AUTOMATION: "AI e automazione",
  LEGAL: "Consulenza legale",
  TAX_ACCOUNTING: "Consulenza fiscale / contabile",
  FUNDING: "Finanza agevolata e bandi",
  GDPR_231_ESG: "Compliance GDPR / 231 / ESG",
  EVENTS: "Organizzazione eventi",
  COMMUNICATION: "Comunicazione / grafica / video",
  LOGISTICS: "Logistica",
  FACILITY: "Facility management",
};

const CAT_COLORS: Record<string, "blue" | "green" | "teal" | "orange"> = {
  CAT_A: "blue",
  CAT_B: "teal",
  CAT_C: "orange",
  CAT_D: "green",
  CAT_E: "teal",
};

export function AlboBSection3({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<Grid3x3 className="h-5 w-5" />} title="Sezione 3 — Servizi Offerti" accent="teal">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const servicesByCategory = (payload.servicesByCategory as Record<string, string[]> | undefined) ?? {};
  const descriptionsByCategory = (payload.descriptionsByCategory as Record<string, string> | undefined) ?? {};

  const activeCategories = Object.keys(servicesByCategory).filter(
    (cat) => Array.isArray(servicesByCategory[cat]) && servicesByCategory[cat].length > 0
  );

  if (activeCategories.length === 0) {
    return (
      <SectionCard icon={<Grid3x3 className="h-5 w-5" />} title="Sezione 3 — Servizi Offerti" accent="teal">
        <p className="profile-empty">Nessun servizio selezionato.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={<Grid3x3 className="h-5 w-5" />} title="Sezione 3 — Servizi Offerti" accent="teal">
      {activeCategories.map((cat) => {
        const serviceIds = servicesByCategory[cat] ?? [];
        const serviceNames = serviceIds.map((id) => SERVICE_LABELS[id] ?? id);
        const description = str(descriptionsByCategory[cat]);
        const color = CAT_COLORS[cat] ?? "blue";
        return (
          <ProfileSubsection key={cat} title={`Cat. ${cat.replace("CAT_", "")} — ${SERVICE_CATEGORY_LABELS[cat] ?? cat}`}>
            <TagList items={serviceNames} color={color} />
            {description ? <p className="service-description">{description}</p> : null}
          </ProfileSubsection>
        );
      })}
    </SectionCard>
  );
}
