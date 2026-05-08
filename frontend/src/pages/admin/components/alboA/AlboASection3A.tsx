import { BookOpen, MapPin, Star } from "lucide-react";
import { SectionCard, ProfileSubsection } from "../shared/SectionCard";
import { FieldGrid } from "../shared/FieldGrid";
import { TagList } from "../shared/TagList";

type P = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => str(item)).filter(Boolean);
}

const YEARS_BAND: Record<string, string> = {
  LT_1: "Meno di 1 anno",
  Y1_3: "1–3 anni",
  Y3_5: "3–5 anni",
  Y5_10: "5–10 anni",
  Y10_15: "10–15 anni",
  GT_15: "Oltre 15 anni",
};

const QCER: Record<string, string> = {
  A1: "A1 – Base",
  A2: "A2 – Elementare",
  B1: "B1 – Pre-intermedio",
  B2: "B2 – Intermedio",
  C1: "C1 – Avanzato",
  C2: "C2 – Padronanza",
  NATIVE: "Madrelingua",
};

const DELIVERY_MODE: Record<string, string> = {
  IN_PRESENCE: "In presenza",
  ONLINE: "Online",
  BLENDED: "Misto (presenza + online)",
};

export function AlboASection3A({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<BookOpen className="h-5 w-5" />} title="Sezione 3A — Docente / Formatore" accent="teal">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const edu = payload.education as P | null | undefined;
  const certifications = Array.isArray(payload.certifications)
    ? (payload.certifications as P[])
    : [];
  const competencies = Array.isArray(payload.competencies)
    ? (payload.competencies as P[])
    : [];
  const territory = payload.territory as P | null | undefined;
  const regions = strArr(territory?.regions);
  const provinces = strArr(territory?.provinces);
  const languages = Array.isArray(payload.languages)
    ? (payload.languages as P[])
    : [];
  const teachingLangs = strArr(payload.teachingLanguages);
  const digitalTools = strArr(payload.digitalTools);
  const networks = strArr(payload.professionalNetworks);
  const consultingAreas = strArr(payload.consultingAreas);
  const availability = payload.availability as P | null | undefined;
  const experiences = Array.isArray(payload.experiences)
    ? (payload.experiences as P[])
    : [];

  return (
    <SectionCard icon={<BookOpen className="h-5 w-5" />} title="Sezione 3A — Docente / Formatore" accent="teal">

      {edu ? (
        <ProfileSubsection title="Titolo di studio">
          <FieldGrid fields={[
            { label: "Titolo più elevato", value: str(edu.highestTitle) },
            { label: "Ambito di studio", value: str(edu.studyArea) },
            { label: "Anno di conseguimento", value: str(edu.graduationYear) },
          ]} />
        </ProfileSubsection>
      ) : null}

      {certifications.length > 0 ? (
        <ProfileSubsection title="Certificazioni e abilitazioni">
          <div className="profile-cert-list">
            {certifications.map((cert, i) => (
              <div key={i} className="profile-cert-row">
                <strong>{str(cert.name) || "—"}</strong>
                {str(cert.issuer) ? <span> · {str(cert.issuer)}</span> : null}
                {str(cert.year) ? <span className="cert-year">{str(cert.year)}</span> : null}
              </div>
            ))}
          </div>
        </ProfileSubsection>
      ) : null}

      {competencies.length > 0 ? (
        <ProfileSubsection title="Aree di competenza">
          <div className="profile-competency-list">
            {competencies.map((c, i) => (
              <div key={i} className="profile-competency-card">
                <div className="competency-header">
                  <Star className="h-4 w-4" />
                  <strong>{str(c.theme) || "—"}</strong>
                  <span className="competency-band">{YEARS_BAND[str(c.yearsBand)] ?? str(c.yearsBand)}</span>
                </div>
                {str(c.details) ? <p className="competency-detail">{str(c.details)}</p> : null}
              </div>
            ))}
          </div>
        </ProfileSubsection>
      ) : null}

      {consultingAreas.length > 0 ? (
        <ProfileSubsection title="Ambiti di consulenza offerti">
          <TagList items={consultingAreas} color="teal" />
        </ProfileSubsection>
      ) : null}

      {str(payload.paTeachingExperience) ? (
        <ProfileSubsection title="Esperienza docenza PA">
          <span className={`profile-tag ${payload.paTeachingExperience === true || payload.paTeachingExperience === "true" ? "tag-green" : "tag-orange"}`}>
            {payload.paTeachingExperience === true || payload.paTeachingExperience === "true" ? "Sì, ha esperienza con la PA" : "Nessuna esperienza con la PA"}
          </span>
        </ProfileSubsection>
      ) : null}

      {(regions.length > 0 || provinces.length > 0) ? (
        <ProfileSubsection title="Area territoriale">
          <div className="profile-territory-block">
            {regions.length > 0 ? <><p className="territory-label"><MapPin className="h-3 w-3" /> Regioni</p><TagList items={regions} color="blue" /></> : null}
            {provinces.length > 0 ? <><p className="territory-label">Province</p><TagList items={provinces} color="blue" /></> : null}
          </div>
        </ProfileSubsection>
      ) : null}

      {languages.length > 0 ? (
        <ProfileSubsection title="Lingue parlate">
          <div className="profile-lang-list">
            {languages.map((l, i) => (
              <span key={i} className="profile-lang-item">
                {str(l.language)} <span className="lang-level">{QCER[str(l.qcerLevel)] ?? str(l.qcerLevel)}</span>
              </span>
            ))}
          </div>
        </ProfileSubsection>
      ) : null}

      {teachingLangs.length > 0 ? (
        <ProfileSubsection title="Lingue di docenza">
          <TagList items={teachingLangs} color="teal" />
        </ProfileSubsection>
      ) : null}

      {digitalTools.length > 0 ? (
        <ProfileSubsection title="Strumenti digitali">
          <TagList items={digitalTools} color="blue" />
        </ProfileSubsection>
      ) : null}

      {networks.length > 0 ? (
        <ProfileSubsection title="Reti e associazioni professionali">
          <TagList items={networks} color="teal" />
        </ProfileSubsection>
      ) : null}

      {availability ? (
        <ProfileSubsection title="Disponibilità e tariffe">
          <FieldGrid fields={[
            { label: "Disponibile a trasferte", value: availability.travelAvailable === true ? "Sì" : availability.travelAvailable === false ? "No" : "" },
            { label: "Tariffa giornaliera", value: str(availability.dailyRateRange) },
            { label: "Tariffa oraria", value: str(availability.hourlyRateRange) },
          ]} />
        </ProfileSubsection>
      ) : null}

      {experiences.length > 0 ? (
        <ProfileSubsection title={`Esperienze formative (${experiences.length})`}>
          <div className="profile-experience-list">
            {experiences.map((exp, i) => (
              <div key={i} className="profile-experience-card">
                <div className="exp-header">
                  <strong>{str(exp.clientName) || "Cliente non specificato"}</strong>
                  <span className="exp-sector">{str(exp.clientSector)}</span>
                </div>
                <FieldGrid cols={3} fields={[
                  { label: "Tipo intervento", value: str(exp.interventionType) },
                  { label: "Ambito tematico", value: str(exp.mainTheme) },
                  { label: "Modalità", value: DELIVERY_MODE[str(exp.deliveryMode)] ?? str(exp.deliveryMode) },
                  { label: "Periodo", value: [str(exp.periodFrom), str(exp.periodTo)].filter(Boolean).join(" → ") },
                  { label: "Durata (ore)", value: str(exp.durationHours) },
                  { label: "N. partecipanti", value: str(exp.participantsCount) },
                  { label: "Intervento finanziato", value: exp.fundedIntervention === true ? `Sì${str(exp.fundName) ? ` – ${str(exp.fundName)}` : ""}` : exp.fundedIntervention === false ? "No" : "" },
                ]} />
              </div>
            ))}
          </div>
        </ProfileSubsection>
      ) : null}

    </SectionCard>
  );
}
