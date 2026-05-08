import { Building2 } from "lucide-react";
import { SectionCard, ProfileSubsection } from "../shared/SectionCard";
import { FieldGrid } from "../shared/FieldGrid";

type P = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function formatDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  const parsed = Date.parse(s);
  if (!Number.isFinite(parsed)) return s;
  return new Date(parsed).toLocaleDateString("it-IT");
}

const LEGAL_FORM: Record<string, string> = {
  SRL: "S.r.l.",
  SPA: "S.p.a.",
  SNC: "S.n.c.",
  SAS: "S.a.s.",
  COOPERATIVA: "Cooperativa",
  ASSOCIAZIONE: "Associazione",
  FONDAZIONE: "Fondazione",
  ETS: "Ente del Terzo Settore",
  ALTRO: "Altro",
};

export function AlboBSection1({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<Building2 className="h-5 w-5" />} title="Sezione 1 — Dati Aziendali" accent="green">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const legalAddr = payload.legalAddress as P | null | undefined;
  const opHq = payload.operationalHeadquarter as P | null | undefined;
  const legalRep = payload.legalRepresentative as P | null | undefined;
  const opContact = payload.operationalContact as P | null | undefined;

  return (
    <SectionCard icon={<Building2 className="h-5 w-5" />} title="Sezione 1 — Dati Aziendali" accent="green">

      <ProfileSubsection title="Anagrafica aziendale">
        <FieldGrid fields={[
          { label: "Ragione sociale", value: str(payload.companyName) },
          { label: "Forma giuridica", value: LEGAL_FORM[str(payload.legalForm)] ?? str(payload.legalForm) },
          { label: "Partita IVA", value: str(payload.vatNumber) },
          { label: "Codice Fiscale (se diverso)", value: str(payload.taxCodeIfDifferent) },
          { label: "Numero REA", value: str(payload.reaNumber) },
          { label: "Provincia CCIAA", value: str(payload.cciaaProvince) },
          { label: "Data di costituzione", value: formatDate(payload.incorporationDate) },
          { label: "Sito web", value: str(payload.website) },
        ]} />
      </ProfileSubsection>

      <ProfileSubsection title="Contatti aziendali">
        <FieldGrid fields={[
          { label: "E-mail istituzionale", value: str(payload.institutionalEmail) },
          { label: "PEC", value: str(payload.pec) },
          { label: "Telefono", value: str(payload.phone) },
        ]} />
      </ProfileSubsection>

      {legalAddr ? (
        <ProfileSubsection title="Sede legale">
          <FieldGrid fields={[
            { label: "Via / N. civico", value: str(legalAddr.street) },
            { label: "Comune", value: str(legalAddr.city) },
            { label: "CAP", value: str(legalAddr.postalCode) },
            { label: "Provincia", value: str(legalAddr.province) },
          ]} />
        </ProfileSubsection>
      ) : null}

      {opHq ? (
        <ProfileSubsection title="Sede operativa principale">
          <FieldGrid fields={[
            { label: "Via / N. civico", value: str(opHq.street) },
            { label: "Comune", value: str(opHq.city) },
            { label: "CAP", value: str(opHq.postalCode) },
            { label: "Provincia", value: str(opHq.province) },
          ]} />
        </ProfileSubsection>
      ) : null}

      {legalRep ? (
        <ProfileSubsection title="Legale rappresentante">
          <FieldGrid fields={[
            { label: "Nome e cognome", value: str(legalRep.name) },
            { label: "Codice Fiscale", value: str(legalRep.taxCode) },
            { label: "Ruolo", value: str(legalRep.role) },
            { label: "Scadenza carta d'identità", value: formatDate(legalRep.idDocumentExpiry) },
            { label: "Carta d'identità", value: str((legalRep.idDocumentAttachment as P | null | undefined)?.fileName) },
          ]} />
        </ProfileSubsection>
      ) : null}

      {opContact ? (
        <ProfileSubsection title="Referente operativo">
          <FieldGrid fields={[
            { label: "Nome", value: str(opContact.name) },
            { label: "Ruolo", value: str(opContact.role) },
            { label: "E-mail", value: str(opContact.email) },
            { label: "Telefono", value: str(opContact.phone) },
          ]} />
        </ProfileSubsection>
      ) : null}

    </SectionCard>
  );
}
