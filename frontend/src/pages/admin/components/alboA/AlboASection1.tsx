import { User } from "lucide-react";
import { SectionCard } from "../shared/SectionCard";
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

export function AlboASection1({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<User className="h-5 w-5" />} title="Sezione 1 — Dati Anagrafici" accent="blue">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const hasPhoto = str(payload.profilePhotoRef) || str(payload.profilePhotoDataUrl);

  return (
    <SectionCard icon={<User className="h-5 w-5" />} title="Sezione 1 — Dati Anagrafici" accent="blue">
      {hasPhoto ? (
        <div className="profile-photo-row">
          {str(payload.profilePhotoDataUrl)
            ? <img src={str(payload.profilePhotoDataUrl)} alt="Foto profilo" className="profile-photo-thumb" />
            : <div className="profile-photo-placeholder">Foto caricata</div>}
        </div>
      ) : null}

      <FieldGrid fields={[
        { label: "Nome", value: str(payload.firstName) },
        { label: "Cognome", value: str(payload.lastName) },
        { label: "Data di nascita", value: formatDate(payload.birthDate) },
        { label: "Luogo di nascita", value: str(payload.birthPlace) },
        { label: "Codice Fiscale", value: str(payload.taxCode) },
        { label: "Partita IVA", value: str(payload.vatNumber) },
        { label: "Regime fiscale", value: str(payload.taxRegime) },
        { label: "Indirizzo", value: str(payload.addressLine) },
        { label: "Comune", value: str(payload.city) },
        { label: "CAP", value: str(payload.postalCode) },
        { label: "Provincia", value: str(payload.province) },
        { label: "Telefono", value: str(payload.phone) },
        { label: "Telefono secondario", value: str(payload.secondaryPhone) },
        { label: "E-mail", value: str(payload.email) },
        { label: "E-mail secondaria", value: str(payload.secondaryEmail) },
        { label: "PEC", value: str(payload.pec) },
        { label: "Sito web", value: str(payload.website) },
        { label: "LinkedIn", value: str(payload.linkedin) },
      ]} />
    </SectionCard>
  );
}
