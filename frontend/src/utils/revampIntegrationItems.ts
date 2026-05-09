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

type AttachmentPayload = {
  documentType?: unknown;
  fileName?: unknown;
  storageKey?: unknown;
  certificationKey?: unknown;
  certificationLabel?: unknown;
};

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

function sectionPayload(sections: RevampSectionSnapshot[], sectionKey: string): Record<string, unknown> {
  return parsePayload(sections.find((section) => section.sectionKey === sectionKey));
}

function attachmentsFrom(payload: Record<string, unknown>): AttachmentPayload[] {
  if (!Array.isArray(payload.attachments)) return [];
  return payload.attachments
    .filter((item): item is AttachmentPayload => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .filter((item) => text(item.fileName) || text(item.storageKey));
}

function fileSuffix(attachment: AttachmentPayload): string {
  const fileName = text(attachment.fileName);
  return fileName ? ` File caricato: ${fileName}.` : "";
}

function certificationCodeForKey(certificationKey: string): string {
  const cert = ISO_CERTS.find((item) => item.key === certificationKey);
  return cert?.code ?? "CERTIFICATIONS_ACCREDITATIONS";
}

function alboAItems(sections: RevampSectionSnapshot[]): RevampIntegrationItemTemplate[] {
  const s1 = sectionPayload(sections, "S1");
  const s4 = sectionPayload(sections, "S4");
  const items: RevampIntegrationItemTemplate[] = [];
  const seen = new Set<string>();

  const idAttachment = s1.profilePhotoAttachment && typeof s1.profilePhotoAttachment === "object" && !Array.isArray(s1.profilePhotoAttachment)
    ? s1.profilePhotoAttachment as AttachmentPayload
    : null;
  if (idAttachment && (text(idAttachment.fileName) || text(idAttachment.storageKey))) {
    items.push({
      code: "ID_DOCUMENT",
      label: "Carta d'identita",
      hint: `Richiedi correzione o sostituzione della carta d'identita caricata.${fileSuffix(idAttachment)}`,
      documentType: "ID_DOCUMENT",
      targetStep: 1
    });
  }

  attachmentsFrom(s4).forEach((attachment) => {
    const documentType = text(attachment.documentType).toUpperCase();
    if (documentType === "CV" && !seen.has("CV")) {
      seen.add("CV");
      items.push({
        code: "CV",
        label: "Curriculum aggiornato",
        hint: `Richiedi un CV aggiornato e coerente con il profilo dichiarato.${fileSuffix(attachment)}`,
        documentType: "CV",
        targetStep: 4
      });
      return;
    }

    if (documentType === "CERTIFICATION" && !seen.has("PROFESSIONAL_CERTIFICATION")) {
      seen.add("PROFESSIONAL_CERTIFICATION");
      items.push({
        code: "PROFESSIONAL_CERTIFICATION",
        label: "Certificazioni e attestati",
        hint: `Richiedi correzione o sostituzione della certificazione caricata dal candidato.${fileSuffix(attachment)}`,
        documentType: "CERTIFICATION",
        targetStep: 4
      });
    }
  });

  return items;
}

function alboBItems(sections: RevampSectionSnapshot[]): RevampIntegrationItemTemplate[] {
  const s1 = sectionPayload(sections, "S1");
  const s4 = sectionPayload(sections, "S4");
  const items: RevampIntegrationItemTemplate[] = [];
  const seen = new Set<string>();

  const legalRepresentative = s1.legalRepresentative && typeof s1.legalRepresentative === "object" && !Array.isArray(s1.legalRepresentative)
    ? s1.legalRepresentative as Record<string, unknown>
    : {};
  const idAttachment = legalRepresentative.idDocumentAttachment && typeof legalRepresentative.idDocumentAttachment === "object" && !Array.isArray(legalRepresentative.idDocumentAttachment)
    ? legalRepresentative.idDocumentAttachment as AttachmentPayload
    : null;
  if (idAttachment && (text(idAttachment.fileName) || text(idAttachment.storageKey))) {
    items.push({
      code: "ID_DOCUMENT",
      label: "Carta d'identita legale rappresentante",
      hint: `Richiedi correzione o sostituzione della carta d'identita del legale rappresentante.${fileSuffix(idAttachment)}`,
      documentType: "ID_DOCUMENT",
      targetStep: 1
    });
  }

  attachmentsFrom(s4).forEach((attachment) => {
    const documentType = text(attachment.documentType).toUpperCase();
    if (documentType === "VISURA_CAMERALE" && !seen.has("VISURA_CAMERALE")) {
      seen.add("VISURA_CAMERALE");
      items.push({
        code: "VISURA_CAMERALE",
        label: "Visura camerale ordinaria",
        hint: `Richiedi una visura camerale aggiornata e leggibile.${fileSuffix(attachment)}`,
        documentType: "VISURA_CAMERALE",
        targetStep: 4
      });
      return;
    }

    if (documentType === "DURC" && !seen.has("DURC")) {
      seen.add("DURC");
      items.push({
        code: "DURC",
        label: "DURC",
        hint: `Richiedi Documento Unico di Regolarita Contributiva valido.${fileSuffix(attachment)}`,
        documentType: "DURC",
        targetStep: 4
      });
      return;
    }

    if (documentType === "COMPANY_PROFILE" && !seen.has("COMPANY_PROFILE")) {
      seen.add("COMPANY_PROFILE");
      items.push({
        code: "COMPANY_PROFILE",
        label: "Company profile",
        hint: `Richiedi correzione o sostituzione del profilo aziendale caricato.${fileSuffix(attachment)}`,
        documentType: "COMPANY_PROFILE",
        targetStep: 4
      });
      return;
    }

    if (documentType === "CERTIFICATION") {
      const certificationKey = text(attachment.certificationKey);
      const code = certificationKey ? certificationCodeForKey(certificationKey) : "CERTIFICATIONS_ACCREDITATIONS";
      if (seen.has(code)) return;
      seen.add(code);
      const certificationLabel = text(attachment.certificationLabel) || ISO_CERTS.find((cert) => cert.key === certificationKey)?.label || "Certificati ISO e accreditamenti";
      items.push({
        code,
        label: certificationLabel,
        hint: `Richiedi correzione o sostituzione del certificato caricato.${fileSuffix(attachment)}`,
        documentType: "CERTIFICATION",
        certificationKey: certificationKey || undefined,
        certificationLabel,
        targetStep: 4
      });
    }
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
