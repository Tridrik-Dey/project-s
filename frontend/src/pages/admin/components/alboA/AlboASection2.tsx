import { Briefcase } from "lucide-react";
import { SectionCard } from "../shared/SectionCard";
import { FieldGrid } from "../shared/FieldGrid";
import { TagList } from "../shared/TagList";

type P = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  DOCENTE_FORMATORE: "Docente / Formatore",
  CONSULENTE: "Consulente",
  PSICOLOGO_COACH: "Psicologo / Coach",
  ALTRO: "Altro",
  docente: "Docente / Formatore",
  ricercatore: "Ricercatore / Valutatore",
  cdo_lavoro: "Consulente del Lavoro",
  commercialista: "Commercialista",
  avvocato: "Avvocato",
  psicologo: "Psicologo",
  finanza: "Esperto Finanza Agevolata",
  orientatore: "Orientatore Professionale",
  coach: "Coach",
  mediatore: "Mediatore del Lavoro",
  altro: "Altro professionista",
};

export function AlboASection2({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<Briefcase className="h-5 w-5" />} title="Sezione 2 — Tipologia Professionale" accent="blue">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const primaryType = str(payload.tipologia) || str(payload.professionalType);
  const secondaryValues = Array.isArray(payload.multiRuoli)
    ? payload.multiRuoli
    : Array.isArray(payload.secondaryProfessionalTypes)
      ? payload.secondaryProfessionalTypes
      : [];
  const secondaryRaw = Array.isArray(secondaryValues)
    ? (secondaryValues as string[]).map((t) => PROFESSIONAL_TYPE_LABELS[t] ?? t)
    : [];

  return (
    <SectionCard icon={<Briefcase className="h-5 w-5" />} title="Sezione 2 — Tipologia Professionale" accent="blue">
      <FieldGrid fields={[
        { label: "Tipologia principale", value: PROFESSIONAL_TYPE_LABELS[primaryType] ?? primaryType },
        { label: "Tipologia backend", value: str(payload.tipologia) ? (PROFESSIONAL_TYPE_LABELS[str(payload.professionalType)] ?? str(payload.professionalType)) : "" },
        { label: "Codice ATECO", value: str(payload.ateco) || str(payload.atecoCode) },
      ]} />
      {secondaryRaw.length > 0 ? (
        <div className="profile-subsection">
          <p className="profile-subsection-title">Tipologie secondarie</p>
          <TagList items={secondaryRaw} color="blue" />
        </div>
      ) : null}
    </SectionCard>
  );
}
