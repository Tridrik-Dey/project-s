import { Award } from "lucide-react";
import { SectionCard, ProfileSubsection } from "../shared/SectionCard";

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

function isExpiredOrSoon(expiryRaw: unknown): "expired" | "soon" | "ok" | null {
  const s = str(expiryRaw);
  if (!s) return null;
  const expiry = Date.parse(s);
  if (!Number.isFinite(expiry)) return null;
  const now = Date.now();
  const days = (expiry - now) / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days < 60) return "soon";
  return "ok";
}

const ACCREDITATION_TYPE: Record<string, string> = {
  REGIONAL_TRAINING: "Formazione regionale",
  LABOR_SERVICES: "Servizi al lavoro",
  OTHER: "Altro",
};

interface IsoCertProps {
  label: string;
  data: P | null | undefined;
}

function IsoCertRow({ label, data }: IsoCertProps) {
  if (!data) return null;
  const declared = data.declared === true;
  if (!declared) {
    return (
      <div className="cert-iso-row cert-not-declared">
        <span className="cert-iso-name">{label}</span>
        <span className="cert-status-badge badge-neutral">Non dichiarata</span>
      </div>
    );
  }
  const expiry = str(data.expiryDate);
  const expiryState = isExpiredOrSoon(data.expiryDate);
  return (
    <div className="cert-iso-row cert-declared">
      <span className="cert-iso-name">{label}</span>
      <span className="cert-status-badge badge-ok">Dichiarata</span>
      {str(data.issuer) ? <span className="cert-issuer">{str(data.issuer)}</span> : null}
      {expiry ? (
        <span className={`cert-expiry ${expiryState === "expired" ? "expiry-danger" : expiryState === "soon" ? "expiry-warn" : "expiry-ok"}`}>
          Scadenza: {formatDate(data.expiryDate)}
          {expiryState === "expired" ? " ⚠ Scaduta" : expiryState === "soon" ? " ⚠ In scadenza" : ""}
        </span>
      ) : null}
    </div>
  );
}

export function AlboBSection4({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<Award className="h-5 w-5" />} title="Sezione 4 — Certificazioni e Accreditamenti" accent="orange">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const additionalCerts = Array.isArray(payload.additionalCertifications)
    ? (payload.additionalCertifications as P[])
    : [];
  const accreditations = Array.isArray(payload.accreditations)
    ? (payload.accreditations as P[])
    : [];

  return (
    <SectionCard icon={<Award className="h-5 w-5" />} title="Sezione 4 — Certificazioni e Accreditamenti" accent="orange">

      <ProfileSubsection title="Certificazioni ISO">
        <div className="cert-iso-grid">
          <IsoCertRow label="ISO 9001:2015" data={payload.iso9001 as P | undefined} />
          <IsoCertRow label="ISO 14001" data={payload.iso14001 as P | undefined} />
          <IsoCertRow label="ISO 45001 / OHSAS" data={payload.iso45001 as P | undefined} />
          <IsoCertRow label="SA8000" data={payload.sa8000 as P | undefined} />
          <IsoCertRow label="ISO 27001" data={payload.iso27001 as P | undefined} />
        </div>
      </ProfileSubsection>

      {additionalCerts.length > 0 ? (
        <ProfileSubsection title="Altre certificazioni">
          <div className="profile-cert-list">
            {additionalCerts.map((cert, i) => {
              const expiryState = isExpiredOrSoon(cert.expiryDate);
              return (
                <div key={i} className="profile-cert-row">
                  <strong>{str(cert.name) || "—"}</strong>
                  {str(cert.issuer) ? <span> · {str(cert.issuer)}</span> : null}
                  {str(cert.expiryDate) ? (
                    <span className={`cert-expiry ${expiryState === "expired" ? "expiry-danger" : expiryState === "soon" ? "expiry-warn" : "expiry-ok"}`}>
                      Scadenza: {formatDate(cert.expiryDate)}
                      {expiryState === "expired" ? " ⚠" : expiryState === "soon" ? " ⚠" : ""}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ProfileSubsection>
      ) : null}

      {accreditations.length > 0 ? (
        <ProfileSubsection title="Accreditamenti">
          <div className="profile-cert-list">
            {accreditations.map((acc, i) => (
              <div key={i} className="profile-cert-row">
                <strong>{ACCREDITATION_TYPE[str(acc.type)] ?? str(acc.type)}</strong>
                {str(acc.authority) ? <span> · {str(acc.authority)}</span> : null}
                {str(acc.code) ? <span className="cert-code"> [{str(acc.code)}]</span> : null}
                {str(acc.expiryDate) ? (
                  <span className={`cert-expiry ${isExpiredOrSoon(acc.expiryDate) === "expired" ? "expiry-danger" : isExpiredOrSoon(acc.expiryDate) === "soon" ? "expiry-warn" : "expiry-ok"}`}>
                    Scadenza: {formatDate(acc.expiryDate)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </ProfileSubsection>
      ) : null}

    </SectionCard>
  );
}
