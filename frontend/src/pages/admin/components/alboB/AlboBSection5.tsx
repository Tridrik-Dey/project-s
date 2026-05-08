import { ShieldCheck } from "lucide-react";
import { SectionCard } from "../shared/SectionCard";
import { BooleanChecklist } from "../shared/BooleanBadge";

type P = Record<string, unknown>;

function asBool(v: unknown): boolean | null {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return null;
}

export function AlboBSection5({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<ShieldCheck className="h-5 w-5" />} title="Sezione 5 — Dichiarazioni e Conformità" accent="orange" layout="wide">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  return (
    <SectionCard icon={<ShieldCheck className="h-5 w-5" />} title="Sezione 5 — Dichiarazioni e Conformità" accent="orange" layout="wide">
      <BooleanChecklist items={[
        { label: "Dichiarazione antimafia", value: asBool(payload.antimafiaDeclaration) },
        { label: "Dichiarazione D.Lgs. 231/01", value: asBool(payload.dlgs231Declaration) },
        { label: "Adozione Modello Organizzativo 231", value: asBool(payload.model231Adopted) },
        { label: "Regolarità contributiva e fiscale", value: asBool(payload.fiscalContributionRegularity) },
        { label: "Conformità GDPR e presenza DPO", value: asBool(payload.gdprComplianceAndDpo) },
        { label: "Veridicità delle informazioni dichiarate", value: asBool(payload.truthfulnessDeclaration) },
        { label: "Accettazione Privacy Policy", value: asBool(payload.privacyAccepted) },
        { label: "Accettazione Codice Etico", value: asBool(payload.ethicalCodeAccepted) },
        { label: "Accettazione standard qualità / ambiente / sicurezza", value: asBool(payload.qualityEnvSafetyAccepted) },
        { label: "Consenso trattamento dati per gestione Albo", value: asBool(payload.alboDataProcessingConsent) },
        { label: "Consenso comunicazioni commerciali", value: asBool(payload.marketingConsent), optional: true },
      ]} />
    </SectionCard>
  );
}
