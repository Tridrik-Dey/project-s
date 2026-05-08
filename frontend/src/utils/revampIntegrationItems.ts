import type { RevampApplicationSummary, RevampSectionSnapshot } from "../api/revampApplicationApi";

export interface RevampIntegrationItemTemplate {
  code: string;
  label: string;
  hint: string;
  documentType?: string;
  certificationKey?: string;
  certificationLabel?: string;
  targetStep: number;
}

const ISO_CERTS = [
  { key: "iso9001", code: "CERT_ISO_9001", label: "ISO 9001 - Qualita" },
  { key: "iso14001", code: "CERT_ISO_14001", label: "ISO 14001 - Ambiente" },
  { key: "iso45001", code: "CERT_ISO_45001", label: "ISO 45001 / OHSAS 18001 - Salute e Sicurezza" },
  { key: "sa8000", code: "CERT_SA8000", label: "SA8000 - Responsabilita Sociale" }
];

function parsePayload(section?: RevampSectionSnapshot): Record<string, unknown> {
  if (!section?.payloadJson) return {};
  try {
    const parsed = JSON.parse(section.payloadJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isYes(value: unknown): boolean {
  const normalized = text(value).toLowerCase();
  return normalized === "si" || normalized === "sì" || normalized === "yes" || normalized === "true";
}

function sectionPayload(sections: RevampSectionSnapshot[], sectionKey: string): Record<string, unknown> {
  return parsePayload(sections.find((section) => section.sectionKey === sectionKey));
}

function alboAItems(sections: RevampSectionSnapshot[]): RevampIntegrationItemTemplate[] {
  const s3a = sectionPayload(sections, "S3A");
  const s3b = sectionPayload(sections, "S3B");
  const professionalOrder = text(s3b.professionalOrder) || text(s3b.ordine);
  const hasProfessionalCerts = Boolean(text(s3a.certifications) || text(s3b.certifications) || text(s3b.certificazioni));

  const items: RevampIntegrationItemTemplate[] = [
    {
      code: "CV",
      label: "Curriculum aggiornato",
      hint: "Richiedi un CV aggiornato e coerente con il profilo dichiarato.",
      documentType: "CV",
      targetStep: 4
    },
    {
      code: "PROFESSIONAL_CERTIFICATION",
      label: "Certificazioni professionali",
      hint: hasProfessionalCerts
        ? "Richiedi evidenza delle certificazioni professionali dichiarate."
        : "Richiedi eventuali certificazioni professionali a supporto del profilo.",
      documentType: "CERTIFICATION",
      targetStep: 4
    },
    {
      code: "THEMATIC_SPECIFICATION",
      label: "Specifica delle tematiche",
      hint: "Richiedi maggior dettaglio su competenze, ambiti o tematiche dichiarate.",
      targetStep: 3
    },
    {
      code: "EXPERIENCE_CONSISTENCY",
      label: "Anni di esperienza coerenti",
      hint: "Richiedi correzione o chiarimento sugli anni di esperienza dichiarati.",
      targetStep: 3
    }
  ];

  if (professionalOrder) {
    items.splice(2, 0, {
      code: "PROFESSIONAL_REGISTER",
      label: "Iscrizione albo / ordine professionale",
      hint: "Richiedi evidenza dell'iscrizione all'albo o ordine professionale dichiarato.",
      documentType: "CERTIFICATION",
      targetStep: 4
    });
  }

  items.push({
    code: "OTHER",
    label: "Altro documento / chiarimento",
    hint: "Usa questa voce per richieste non coperte dalle opzioni disponibili.",
    documentType: "OTHER",
    targetStep: 1
  });
  return items;
}

function alboBItems(sections: RevampSectionSnapshot[]): RevampIntegrationItemTemplate[] {
  const s4 = sectionPayload(sections, "S4");
  const certs = s4.certificazioni && typeof s4.certificazioni === "object" && !Array.isArray(s4.certificazioni)
    ? s4.certificazioni as Record<string, Record<string, unknown>>
    : {};

  const items: RevampIntegrationItemTemplate[] = [
    {
      code: "VISURA_CAMERALE",
      label: "Visura camerale ordinaria",
      hint: "Richiedi una visura camerale aggiornata e leggibile.",
      documentType: "VISURA_CAMERALE",
      targetStep: 4
    },
    {
      code: "DURC",
      label: "DURC",
      hint: "Richiedi Documento Unico di Regolarita Contributiva valido.",
      documentType: "DURC",
      targetStep: 4
    },
    {
      code: "COMPANY_PROFILE",
      label: "Company profile",
      hint: "Richiedi il profilo aziendale aggiornato, se utile alla verifica.",
      documentType: "COMPANY_PROFILE",
      targetStep: 4
    }
  ];

  ISO_CERTS.forEach((cert) => {
    const declared = certs[cert.key]?.presente;
    if (!isYes(declared)) return;
    items.push({
      code: cert.code,
      label: cert.label,
      hint: `Richiedi il certificato ${cert.label} dichiarato dal fornitore.`,
      documentType: "CERTIFICATION",
      certificationKey: cert.key,
      certificationLabel: cert.label,
      targetStep: 4
    });
  });

  if (
    text(s4.altreCertificazioni)
    || isYes(s4.accreditamentoFormazione)
    || isYes(s4.accreditamentoServiziLavoro)
    || isYes(s4.accreditationTraining)
    || isYes(s4.employmentServicesAccreditation)
  ) {
    items.push({
      code: "CERTIFICATIONS_ACCREDITATIONS",
      label: "Certificati ISO e accreditamenti",
      hint: "Richiedi documentazione per certificazioni o accreditamenti dichiarati.",
      documentType: "CERTIFICATION",
      targetStep: 4
    });
  }

  items.push({
    code: "OTHER",
    label: "Altro documento / chiarimento",
    hint: "Usa questa voce per richieste non coperte dalle opzioni disponibili.",
    documentType: "OTHER",
    targetStep: 1
  });
  return items;
}

export function buildRevampIntegrationItemTemplates(
  summary: RevampApplicationSummary | null,
  sections: RevampSectionSnapshot[]
): RevampIntegrationItemTemplate[] {
  if (summary?.registryType === "ALBO_B") return alboBItems(sections);
  return alboAItems(sections);
}
