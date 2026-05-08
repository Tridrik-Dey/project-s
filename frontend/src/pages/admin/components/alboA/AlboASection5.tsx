import { ShieldCheck } from "lucide-react";
import { SectionCard } from "../shared/SectionCard";
import { BooleanChecklist } from "../shared/BooleanBadge";

type P = Record<string, unknown>;

function asBool(v: unknown): boolean | null {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return null;
}

function firstBool(...values: unknown[]): boolean | null {
  for (const value of values) {
    const parsed = asBool(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function AlboASection5({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<ShieldCheck className="h-5 w-5" />} title="Sezione 5 - Dichiarazioni e Consensi" accent="orange" layout="wide">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  return (
    <SectionCard icon={<ShieldCheck className="h-5 w-5" />} title="Sezione 5 - Dichiarazioni e Consensi" accent="orange" layout="wide">
      <BooleanChecklist items={[
        { label: "Assenza condanne penali ostative", value: firstBool(payload.noCriminalConvictions, payload.declarationNoCriminalConvictions) },
        { label: "Assenza conflitti di interesse", value: firstBool(payload.noConflictOfInterest, payload.declarationNoConflict) },
        { label: "Veridicita delle informazioni dichiarate", value: firstBool(payload.truthfulnessDeclaration, payload.declarationTruthful) },
        { label: "Accettazione Privacy Policy", value: asBool(payload.privacyAccepted) },
        { label: "Accettazione Codice Etico", value: asBool(payload.ethicalCodeAccepted) },
        { label: "Accettazione standard qualita / ambiente / sicurezza", value: firstBool(payload.qualityEnvSafetyAccepted, payload.qualityStandardsAccepted) },
        { label: "Consenso trattamento dati per gestione Albo", value: firstBool(payload.alboDataProcessingConsent, payload.dataProcessingConsent) },
        { label: "Conformita D.Lgs. 81/2008 (attivita in presenza)", value: asBool(payload.dlgs81ComplianceWhenInPresence) },
        { label: "Consenso comunicazioni commerciali", value: asBool(payload.marketingConsent), optional: true },
      ]} />
    </SectionCard>
  );
}
