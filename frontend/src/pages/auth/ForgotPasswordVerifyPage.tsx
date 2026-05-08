import { FormEvent, useState } from "react";
import { Eye, EyeOff, RotateCcw, ShieldCheck } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { requestPasswordReset, resetPassword } from "../../api/authApi";
import { HttpError } from "../../api/http";
import { AppToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/I18nContext";

interface LocationState {
  challengeId: string;
  maskedEmail?: string;
  email: string;
  debugCode?: string | null;
}

export function ForgotPasswordVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const state = location.state as LocationState | null;

  const [challengeId, setChallengeId] = useState(state?.challengeId ?? "");
  const [debugCode, setDebugCode] = useState<string | null>(state?.debugCode ?? null);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  if (!state?.challengeId || !state?.email) {
    return <Navigate to="/forgot-password" replace />;
  }

  async function onResend() {
    setResending(true);
    setToast(null);
    try {
      const result = await requestPasswordReset(state!.email);
      setChallengeId(result.challengeId);
      setDebugCode(result.debugCode ?? null);
      setOtpCode("");
      setToast({ message: "Nuovo codice OTP inviato.", type: "success" });
    } catch (err) {
      if (err instanceof HttpError) {
        setToast({ message: err.message, type: "error" });
      } else {
        setToast({ message: "Reinvio non riuscito. Riprova.", type: "error" });
      }
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setToast(null);

    if (newPassword !== confirmPassword) {
      setToast({ message: "Le password non coincidono.", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ message: "La password deve contenere almeno 8 caratteri.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      await resetPassword(challengeId, otpCode.trim(), newPassword);
      navigate("/login", { state: { successMessage: "Password reimpostata con successo. Accedi con la nuova password." } });
    } catch (err) {
      if (err instanceof HttpError) {
        const msg = err.message.toLowerCase();
        if (msg.includes("invalid otp") || msg.includes("codice")) {
          setToast({ message: "Codice OTP non valido. Riprova.", type: "error" });
        } else if (msg.includes("expired")) {
          setToast({ message: "Il codice OTP è scaduto. Richiedine uno nuovo.", type: "error" });
        } else if (msg.includes("locked")) {
          setToast({ message: "Troppi tentativi. Richiedi un nuovo codice OTP.", type: "error" });
        } else {
          setToast({ message: err.message, type: "error" });
        }
      } else {
        setToast({ message: "Reset non riuscito. Riprova.", type: "error" });
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
            {state.maskedEmail
              ? `Abbiamo inviato un codice OTP a ${state.maskedEmail}. Inseriscilo e scegli la nuova password.`
              : "Inserisci il codice OTP ricevuto via email e scegli la nuova password."}
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
            Reimposta password
          </h2>
          <p style={{ margin: "0 0 28px", fontSize: "0.84rem", color: "#6b7280" }}>
            Inserisci il codice OTP ricevuto e scegli la nuova password.
          </p>
          <form onSubmit={onSubmit} className="grid-form auth-form" style={{ gridTemplateColumns: "1fr" }}>
            <label className={`floating-field ${otpCode.trim() ? "has-value" : ""}`}>
              <ShieldCheck className="floating-field-icon" />
              <input
                className="floating-input auth-input"
                value={otpCode}
                inputMode="numeric"
                maxLength={6}
                placeholder=" "
                onChange={(e) => setOtpCode(e.target.value)}
                required
              />
              <span className="floating-field-label">Codice OTP</span>
            </label>

            <label className={`floating-field ${newPassword ? "has-value" : ""}`} style={{ position: "relative" }}>
              <input
                className="floating-input auth-input"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                placeholder=" "
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ paddingRight: 40 }}
                required
              />
              <span className="floating-field-label">Nuova password</span>
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2 }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </label>

            <label className={`floating-field ${confirmPassword ? "has-value" : ""}`}>
              <input
                className="floating-input auth-input"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                placeholder=" "
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <span className="floating-field-label">Conferma password</span>
            </label>

            <button
              className={`auth-submit-btn ${loading ? "is-loading" : ""}`}
              disabled={loading}
              type="submit"
            >
              <span className="auth-submit-btn-content">
                {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" />}
                <span>{loading ? "Salvataggio..." : "Reimposta password"}</span>
              </span>
            </button>

            <button
              type="button"
              className="auth-submit-btn secondary"
              onClick={() => void onResend()}
              disabled={resending}
            >
              <span className="auth-submit-btn-content">
                {resending ? <span className="auth-submit-spinner" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" />}
                <span>{resending ? "Invio in corso..." : "Reinvia OTP"}</span>
              </span>
            </button>
          </form>

          {debugCode ? (
            <p style={{ margin: "16px 0 0", fontSize: "0.82rem", color: "#6b7280" }}>
              Debug OTP: <strong>{debugCode}</strong>
            </p>
          ) : null}

          <p style={{ margin: "16px 0 0", fontSize: "0.82rem", color: "#6b7280", textAlign: "center" }}>
            <Link to="/login" style={{ color: "#1b5d96", fontWeight: 600, textDecoration: "none" }}>
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
