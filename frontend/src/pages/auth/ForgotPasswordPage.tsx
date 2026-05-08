import { FormEvent, useState } from "react";
import { Mail, KeyRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { requestPasswordReset } from "../../api/authApi";
import { HttpError } from "../../api/http";
import { AppToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/I18nContext";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setToast(null);
    setLoading(true);
    try {
      const result = await requestPasswordReset(email.trim());
      navigate("/forgot-password/verify", {
        state: { challengeId: result.challengeId, maskedEmail: result.targetEmailMasked, email: email.trim(), debugCode: result.debugCode ?? null }
      });
    } catch (err) {
      if (err instanceof HttpError) {
        setToast({ message: err.message, type: "error" });
      } else {
        setToast({ message: "Richiesta non riuscita. Riprova.", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "inherit" }}>
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="auth-toast" /> : null}

      {/* ── Left panel ── */}
      <div style={{
        flex: "0 0 42%",
        background: "linear-gradient(160deg, #0b3f73 0%, #1b5d96 55%, #0c467f 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 52px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, background: "#f5c800", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: "1.6rem", color: "#fff", letterSpacing: "-0.02em", fontFamily: "'Outfit', sans-serif" }}>
              Solco<sup style={{ fontSize: "0.5em", color: "#f5c800", verticalAlign: "super" }}>+</sup>
            </span>
          </div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.12em", textTransform: "uppercase", marginLeft: 46 }}>
            Albo Fornitori Digitale
          </div>
        </div>

        <div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#fff", lineHeight: 1.25, marginBottom: 16, fontFamily: "'Outfit', sans-serif" }}>
            Reimposta la tua password
          </div>
          <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>
            Inserisci l'indirizzo email associato al tuo account. Ti invieremo un codice OTP per reimpostare la password.
          </div>
        </div>

        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>
          © {new Date().getFullYear()} Gruppo Solco. Tutti i diritti riservati.
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        flex: 1,
        background: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 40px",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 18,
          border: "1px solid #e5e7eb",
          boxShadow: "0 20px 40px -24px rgba(15,42,82,0.18)",
          padding: "36px 36px 28px",
        }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.65rem", fontWeight: 800, color: "#0f2a52", fontFamily: "'Outfit', sans-serif" }}>
            Password dimenticata?
          </h2>
          <p style={{ margin: "0 0 28px", fontSize: "0.84rem", color: "#6b7280" }}>
            Inserisci la tua email per ricevere il codice OTP.
          </p>
          <form onSubmit={onSubmit} className="grid-form auth-form" style={{ gridTemplateColumns: "1fr" }}>
            <label className={`floating-field ${email.trim() ? "has-value" : ""}`}>
              <Mail className="floating-field-icon" />
              <input
                className="floating-input auth-input"
                type="email"
                value={email}
                placeholder="nome@azienda.it"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="floating-field-label">{t("auth.email")}</span>
            </label>

            <button
              className={`auth-submit-btn ${loading ? "is-loading" : ""}`}
              disabled={loading}
              type="submit"
            >
              <span className="auth-submit-btn-content">
                {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : <KeyRound className="h-4 w-4" />}
                <span>{loading ? "Invio in corso..." : "Invia codice OTP"}</span>
              </span>
            </button>
          </form>

          <p style={{ margin: "20px 0 0", fontSize: "0.82rem", color: "#6b7280", textAlign: "center" }}>
            <Link to="/login" style={{ color: "#1b5d96", fontWeight: 600, textDecoration: "none" }}>
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
