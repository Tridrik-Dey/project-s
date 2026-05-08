import { UserCheck } from "lucide-react";
import { SectionCard, ProfileSubsection } from "../shared/SectionCard";
import { FieldGrid } from "../shared/FieldGrid";
import { TagList } from "../shared/TagList";

type P = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => str(item)).filter(Boolean);
}

function firstArr(...values: unknown[]): string[] {
  for (const value of values) {
    const arr = strArr(value);
    if (arr.length > 0) return arr;
  }
  return [];
}

function csv(v: unknown): string[] {
  return str(v)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const YEARS_BAND: Record<string, string> = {
  LT_1: "Meno di 1 anno",
  Y1_3: "1-3 anni",
  Y3_5: "3-5 anni",
  Y5_10: "5-10 anni",
  Y10_15: "10-15 anni",
  GT_15: "Oltre 15 anni",
  "0_2": "0-2 anni",
  "2_5": "2-5 anni",
  "5_10": "5-10 anni",
  oltre_10: "Oltre 10 anni",
};

const TITLE_LABELS: Record<string, string> = {
  diploma: "Diploma",
  laurea_triennale: "Laurea triennale",
  laurea_magistrale: "Laurea magistrale",
  master: "Master",
  dottorato: "Dottorato",
};

export function AlboASection3B({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<UserCheck className="h-5 w-5" />} title="Sezione 3B - Altro Professionista" accent="teal">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const territory = payload.territory as P | null | undefined;
  const services = firstArr(payload.services, payload.servizi);
  const specificCerts = firstArr(payload.specificCertifications);
  const regions = firstArr(territory?.regions, csv(territory?.regionsCsv));
  const provinces = firstArr(territory?.provinces, csv(territory?.provincesCsv));
  const areas = firstArr(payload.aree);
  const consulting = firstArr(payload.consulenza);
  const teachingLanguages = firstArr(payload.lingueDocenza);
  const titleCode = str(payload.titoloB) || str(payload.highestTitle);
  const yearsCode = str(payload.anniEsp) || str(payload.experienceBand);

  return (
    <SectionCard icon={<UserCheck className="h-5 w-5" />} title="Sezione 3B - Altro Professionista" accent="teal">
      <FieldGrid fields={[
        { label: "Ordine professionale", value: str(payload.ordine) || str(payload.professionalOrder) },
        { label: "Titolo di studio", value: TITLE_LABELS[titleCode] ?? titleCode },
        { label: "Ambito di studio", value: str(payload.ambitoB) || str(payload.studyArea) },
        { label: "Altro dettaglio ambito", value: str(payload.altroServ) },
        { label: "Anni di esperienza", value: YEARS_BAND[yearsCode] ?? yearsCode },
        { label: "Tariffa oraria", value: str(payload.hourlyRateRange) },
        { label: "Docenza PA", value: str(payload.docenzaPA) },
        { label: "Lingue", value: str(payload.lingue) },
        { label: "Strumenti", value: str(payload.strumenti) },
        { label: "Reti", value: str(payload.reti) },
      ]} />

      {areas.length > 0 ? (
        <ProfileSubsection title="Aree">
          <TagList items={areas} color="teal" />
        </ProfileSubsection>
      ) : null}

      {services.length > 0 ? (
        <ProfileSubsection title="Servizi offerti">
          <TagList items={services} color="teal" />
        </ProfileSubsection>
      ) : null}

      {consulting.length > 0 ? (
        <ProfileSubsection title="Consulenza">
          <TagList items={consulting} color="blue" />
        </ProfileSubsection>
      ) : null}

      {teachingLanguages.length > 0 ? (
        <ProfileSubsection title="Lingue docenza">
          <TagList items={teachingLanguages} color="blue" />
        </ProfileSubsection>
      ) : null}

      {(regions.length > 0 || provinces.length > 0) ? (
        <ProfileSubsection title="Area territoriale">
          {regions.length > 0 ? <><p className="territory-label">Regioni</p><TagList items={regions} color="blue" /></> : null}
          {provinces.length > 0 ? <><p className="territory-label">Province</p><TagList items={provinces} color="blue" /></> : null}
        </ProfileSubsection>
      ) : null}

      {specificCerts.length > 0 ? (
        <ProfileSubsection title="Certificazioni specifiche">
          <TagList items={specificCerts} color="orange" />
        </ProfileSubsection>
      ) : null}
    </SectionCard>
  );
}
