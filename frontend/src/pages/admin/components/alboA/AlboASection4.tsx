import { Users } from "lucide-react";
import { SectionCard } from "../shared/SectionCard";
import { FieldGrid } from "../shared/FieldGrid";

type P = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

export function AlboASection4({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<Users className="h-5 w-5" />} title="Sezione 4 — Referenze" accent="purple">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const references = Array.isArray(payload.references)
    ? (payload.references as P[])
    : [];

  if (references.length === 0) {
    return (
      <SectionCard icon={<Users className="h-5 w-5" />} title="Sezione 4 — Referenze" accent="purple">
        <p className="profile-empty">Nessuna referenza fornita.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={<Users className="h-5 w-5" />} title="Sezione 4 — Referenze" accent="purple">
      <div className="profile-reference-list">
        {references.map((ref, i) => (
          <div key={i} className="profile-reference-card">
            <p className="reference-name">{str(ref.fullName) || "Referente"}</p>
            <FieldGrid fields={[
              { label: "Ruolo / Organizzazione", value: str(ref.organizationRole) },
              { label: "E-mail", value: str(ref.email) },
              { label: "Telefono", value: str(ref.phone) },
            ]} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
