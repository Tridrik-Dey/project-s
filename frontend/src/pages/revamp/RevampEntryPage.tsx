import { ArrowRight, ClipboardList, Clock, Shield, Star } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { saveRevampOnboardingContext } from "../../utils/revampOnboarding";

const NAVY = "#0f2a52";
const GREEN = "#1a5c3a";
const BORDER_BLUE = "#d0d9e6";
const BORDER_GREEN = "#c3ddd0";
const TEXT_MUTED = "#5a6a7a";


export function RevampEntryPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token")?.trim();
  const inviteRegistry = searchParams.get("registryType")?.trim().toUpperCase();

  if (inviteToken && (inviteRegistry === "ALBO_A" || inviteRegistry === "ALBO_B")) {
    saveRevampOnboardingContext({
      registryType: inviteRegistry as "ALBO_A" | "ALBO_B",
      sourceChannel: "INVITE",
      inviteToken
    });
  }

  return (
    <div style={{ margin: "-1rem", overflow: "hidden" }}>

      {/* ── Hero ── */}
      <section style={{ background: NAVY, color: "#fff", textAlign: "center", padding: "60px 24px 52px" }}>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 800, margin: "0 0 14px", letterSpacing: "-0.02em" }}>
          Albo Fornitori Digitale
        </h1>
        <p style={{ fontSize: "1.05rem", margin: "0 0 8px", opacity: 0.88, fontWeight: 500 }}>
          Registrati come fornitore qualificato del Gruppo Solco
        </p>
        <p style={{ fontSize: "0.92rem", opacity: 0.65, margin: "0 0 44px" }}>
          Compila il questionario, carica i tuoi documenti e accedi a nuove opportunità di collaborazione.
        </p>

        {/* Step indicators */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 56 }}>
          {[
            { key: "R", label: "Registrazione" },
            { key: "C", label: "Compilazione" },
            { key: "A", label: "Approvazione" }
          ].map((step) => (
            <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "rgba(255,255,255,0.12)",
                border: "2px solid rgba(255,255,255,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: "1rem"
              }}>
                {step.key}
              </span>
              <span style={{ fontSize: "0.78rem", opacity: 0.75, letterSpacing: "0.02em" }}>{step.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Card selection ── */}
      <section style={{ background: "#eef2f7", padding: "52px 24px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "1.45rem", fontWeight: 700, color: NAVY, margin: "0 0 8px" }}>
            Come vuoi iscriverti all'Albo?
          </h2>
          <p style={{ textAlign: "center", color: TEXT_MUTED, margin: "0 0 36px", fontSize: "0.95rem" }}>
            Seleziona la tipologia che ti riguarda per accedere al questionario dedicato
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

            {/* Card A — Professionisti */}
            <div style={{ background: "#fff", border: `2px solid ${BORDER_BLUE}`, borderRadius: 12, padding: "28px 28px 24px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <span style={{
                  width: 40, height: 40, background: NAVY, color: "#fff",
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "1.15rem", flexShrink: 0
                }}>
                  A
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: NAVY }}>Albo A — Professionisti</div>
                  <div style={{ fontSize: "0.82rem", color: TEXT_MUTED }}>Persone fisiche e autonomi</div>
                </div>
              </div>
              <Link
                to="/apply/albo-a"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 16px", background: NAVY, color: "#fff",
                  borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: "0.92rem"
                }}
              >
                Iscriviti come Professionista <ArrowRight size={16} />
              </Link>
            </div>

            {/* Card B — Aziende */}
            <div style={{ background: "#f5fbf7", border: `2px solid ${BORDER_GREEN}`, borderRadius: 12, padding: "28px 28px 24px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <span style={{
                  width: 40, height: 40, background: GREEN, color: "#fff",
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "1.15rem", flexShrink: 0
                }}>
                  B
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: GREEN }}>Albo B — Aziende</div>
                  <div style={{ fontSize: "0.82rem", color: TEXT_MUTED }}>Persone giuridiche e organizzazioni</div>
                </div>
              </div>
              <Link
                to="/apply/albo-b"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 16px", background: GREEN, color: "#fff",
                  borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: "0.92rem"
                }}
              >
                Iscriviti come Azienda <ArrowRight size={16} />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ background: "#fff", padding: "44px 24px 36px", borderTop: "1px solid #e5e7eb" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[
            { Icon: ClipboardList, title: "Questionario guidato", desc: "Compilazione semplice e intuitiva" },
            { Icon: Shield, title: "Sicuro e conforme GDPR", desc: "I tuoi dati sono protetti" },
            { Icon: Clock, title: "Risposta in 10 giorni", desc: "Approvazione rapida e trasparente" },
            { Icon: Star, title: "Valutazioni e feedback", desc: "Traccia il tuo storico collaborazioni" }
          ].map(({ Icon, title, desc }) => (
            <div key={title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ color: NAVY, marginBottom: 2 }}><Icon size={26} /></span>
              <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#1e293b" }}>{title}</div>
              <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Secondary links ── */}
      <div style={{ textAlign: "center", padding: "14px 24px", borderTop: "1px solid #e5e7eb", background: "#fff" }}>
        <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>Hai domande? </span>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: "0.82rem", color: NAVY, textDecoration: "underline" }}>
          Consulta le FAQ sull'iscrizione
        </a>
        <span style={{ fontSize: "0.82rem", color: "#9ca3af", margin: "0 6px" }}>|</span>
        <Link to="/privacy" style={{ fontSize: "0.82rem", color: NAVY, textDecoration: "underline" }}>Privacy Policy</Link>
        <span style={{ fontSize: "0.82rem", color: "#9ca3af", margin: "0 6px" }}>|</span>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: "0.82rem", color: NAVY, textDecoration: "underline" }}>Contattaci</a>
      </div>

    </div>
  );
}
