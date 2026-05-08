import { FormEvent, useEffect, useState } from "react";
import { Lock, LogIn, Mail } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../../api/authApi";
import { getMyLatestRevampApplication } from "../../api/revampApplicationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/I18nContext";

function isSentApplication(status?: string | null): boolean {
  return Boolean(status && status !== "DRAFT");
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginFromResponse } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const state = location.state as { successMessage?: string } | null;
    if (state?.successMessage) {
      setToast({ message: state.successMessage, type: "success" });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  function pushToast(message: string, type: "error" | "success" = "error") {
    setToast({ message, type });
  }

  function mapLoginErrorMessage(rawMessage: string): string {
    const normalized = rawMessage.toLowerCase();
    if (normalized.includes("email not found")) return t("auth.login.emailAndPasswordWrong");
    if (normalized.includes("wrong password")) return t("auth.login.wrongPassword");
    if (normalized.includes("bad credentials")) return t("auth.login.badCredentials");
    if (normalized.includes("account deactivated") || normalized.includes("user is inactive"))
      return "Account disattivato. Contatta un Super Admin per riattivarlo.";
    return rawMessage || t("auth.login.failed");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setToast(null);
    setLoading(true);
    const normalizedEmail = email.trim();
    try {
      const response = await login({ email: normalizedEmail, password });
      loginFromResponse(response);
      if (response.role === "SUPPLIER") {
        try {
          const latest = await getMyLatestRevampApplication(response.token);
          if (isSentApplication(latest?.status)) {
            navigate("/supplier/dashboard");
            return;
          }
        } catch {
          // fall through
        }
        if (!response.emailVerified) {
          navigate("/verify-otp");
          return;
        }
        navigate("/supplier");
      } else {
        navigate("/admin/dashboard");
      }
    } catch (err) {
      if (err instanceof HttpError) {
        pushToast(mapLoginErrorMessage(err.message));
      } else {
        pushToast(t("auth.login.failed"));
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
        {/* decorative circles */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        {/* Brand */}
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

        {/* Tagline */}
        <div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#fff", lineHeight: 1.25, marginBottom: 16, fontFamily: "'Outfit', sans-serif" }}>
            La piattaforma ufficiale per i fornitori del Gruppo Solco
          </div>
          <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>
            Gestisci la tua candidatura, monitora lo stato di revisione e accedi al tuo profilo nell'Albo Fornitori.
          </div>
        </div>

        {/* Footer note */}
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
            {t("auth.login.title")}
          </h2>
          <p style={{ margin: "0 0 28px", fontSize: "0.84rem", color: "#6b7280" }}>
            Accedi con le tue credenziali per continuare.
          </p>

          <form onSubmit={onSubmit} className="grid-form auth-form" style={{ gridTemplateColumns: "1fr" }}>
            <label className={`floating-field ${email.trim() ? "has-value" : ""}`}>
              <Mail className="floating-field-icon" />
              <input
                className="floating-input auth-input"
                type="email"
                value={email}
                placeholder="nome@azienda.it"
                title={t("auth.email.invalid")}
                onInvalid={(e) => {
                  const input = e.currentTarget;
                  input.setCustomValidity(
                    input.validity.valueMissing ? t("validation.browser.required") : t("auth.email.invalid")
                  );
                }}
                onChange={(e) => { e.currentTarget.setCustomValidity(""); setEmail(e.target.value); }}
                required
              />
              <span className="floating-field-label">{t("auth.email")}</span>
            </label>

            <label className={`floating-field ${password ? "has-value" : ""}`}>
              <Lock className="floating-field-icon" />
              <input
                className="floating-input auth-input"
                type="password"
                value={password}
                placeholder=" "
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="floating-field-label">{t("auth.password")}</span>
            </label>

            <div style={{ textAlign: "right", marginTop: -8 }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: "0.8rem", color: "#1b5d96", fontWeight: 500, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {t("auth.forgotPassword")}
              </Link>
            </div>

            <button
              className={`auth-submit-btn ${loading ? "is-loading" : ""}`}
              disabled={loading}
              type="submit"
            >
              <span className="auth-submit-btn-content">
                {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : <LogIn className="h-4 w-4" />}
                <span>{loading ? t("auth.login.loading") : t("auth.login.submit")}</span>
              </span>
            </button>
          </form>

          <p style={{ margin: "20px 0 0", fontSize: "0.82rem", color: "#6b7280", textAlign: "center" }}>
            {t("auth.noAccount")}{" "}
            <Link to="/register" style={{ color: "#1b5d96", fontWeight: 600, textDecoration: "none" }}>
              {t("auth.registerSupplier")}
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
