import { BarChart2 } from "lucide-react";
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

function formatDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const parsed = Date.parse(s);
  if (!Number.isFinite(parsed)) return s;
  return new Date(parsed).toLocaleDateString("it-IT");
}

const EMPLOYEE_RANGE: Record<string, string> = {
  E_1_9: "1–9 dipendenti",
  E_10_49: "10–49 dipendenti",
  E_50_249: "50–249 dipendenti",
  E_250_PLUS: "Oltre 250 dipendenti",
};

const REVENUE_BAND: Record<string, string> = {
  R_LT_100K: "Sotto 100.000 €",
  R_100K_500K: "100.000 – 500.000 €",
  R_500K_2M: "500.000 – 2.000.000 €",
  R_2M_10M: "2.000.000 – 10.000.000 €",
  R_GT_10M: "Oltre 10.000.000 €",
};

export function AlboBSection2({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<BarChart2 className="h-5 w-5" />} title="Sezione 2 — Struttura e Dimensione" accent="green">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const atecoSecondary = strArr(payload.atecoSecondary);
  const operatingRegions = strArr(payload.operatingRegions);
  const accreditation = payload.regionalTrainingAccreditation as P | null | undefined;

  return (
    <SectionCard icon={<BarChart2 className="h-5 w-5" />} title="Sezione 2 — Struttura e Dimensione" accent="green">

      <FieldGrid fields={[
        { label: "Numero dipendenti", value: EMPLOYEE_RANGE[str(payload.employeeRange)] ?? str(payload.employeeRange) },
        { label: "Fatturato ultimo esercizio", value: REVENUE_BAND[str(payload.revenueBand)] ?? str(payload.revenueBand) },
        { label: "Codice ATECO principale", value: str(payload.atecoPrimary) },
        { label: "Tipo organizzazione Terzo Settore", value: str(payload.thirdSectorType) },
        { label: "Numero iscrizione RUNTS", value: str(payload.runtsNumber) },
      ]} />

      {atecoSecondary.length > 0 ? (
        <ProfileSubsection title="Codici ATECO secondari">
          <TagList items={atecoSecondary} color="green" />
        </ProfileSubsection>
      ) : null}

      {operatingRegions.length > 0 ? (
        <ProfileSubsection title="Regioni operative">
          <TagList items={operatingRegions} color="teal" />
        </ProfileSubsection>
      ) : null}

      {accreditation ? (
        <ProfileSubsection title="Accreditamento formazione regionale">
          <FieldGrid fields={[
            { label: "Accreditato", value: accreditation.accredited === true ? "Sì" : accreditation.accredited === false ? "No" : "" },
            { label: "Ente", value: str(accreditation.authority) },
            { label: "Codice", value: str(accreditation.code) },
            { label: "Scadenza", value: formatDate(accreditation.expiryDate) },
          ]} />
        </ProfileSubsection>
      ) : null}

    </SectionCard>
  );
}
