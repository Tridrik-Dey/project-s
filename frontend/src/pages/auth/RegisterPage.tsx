import { FormEvent, useEffect, useRef, useState } from "react";
import { Lock, Mail, UserPlus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { register, sendEmailOtpChallenge } from "../../api/authApi";
import { HttpError } from "../../api/http";
import type { RevampRegistryType, RevampSourceChannel } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/I18nContext";
import { clearRevampOnboardingContext, saveRevampOnboardingContext } from "../../utils/revampOnboarding";
import { markRevampEmailVerified } from "../../utils/revampEmailVerification";
import { hasValidEmailDomainSuffix } from "../../validation/rules";

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginFromResponse } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const inviteTokenFromQuery = searchParams.get("inviteToken")?.trim();
  const inviteIdFromQuery = searchParams.get("inviteId")?.trim();
  const invitedNameFromQuery = searchParams.get("invitedName")?.trim();
  const invitedEmailFromQuery = searchParams.get("invitedEmail")?.trim();
  const sourceChannelFromQuery = searchParams.get("sourceChannel")?.trim().toUpperCase();
  const registryTypeFromQuery = searchParams.get("registryType")?.trim().toUpperCase();
  const inviteEmailLocked = sourceChannelFromQuery === "INVITE" && Boolean(invitedEmailFromQuery);

  function parseRegistryType(value?: string | null): RevampRegistryType | undefined {
    if (value === "ALBO_A" || value === "ALBO_B") return value;
    return undefined;
  }

  function parseSourceChannel(value?: string | null): RevampSourceChannel | undefined {
    if (value === "PUBLIC" || value === "INVITE") return value;
    return undefined;
  }

  useEffect(() => {
    const registryType = parseRegistryType(registryTypeFromQuery);
    const sourceChannel = parseSourceChannel(sourceChannelFromQuery);
    if (!registryType || !sourceChannel) { clearRevampOnboardingContext(); return; }
    saveRevampOnboardingContext({
      registryType, sourceChannel,
      inviteToken: inviteTokenFromQuery || undefined,
      inviteId: inviteIdFromQuery || undefined,
      invitedName: invitedNameFromQuery || undefined,
      invitedEmail: invitedEmailFromQuery || undefined
    });
  }, [inviteIdFromQuery, inviteTokenFromQuery, invitedEmailFromQuery, invitedNameFromQuery, registryTypeFromQuery, sourceChannelFromQuery]);

  useEffect(() => {
    if (!inviteEmailLocked || !invitedEmailFromQuery) return;
    setEmail(invitedEmailFromQuery);
  }, [inviteEmailLocked, invitedEmailFromQuery]);

  function mapRegisterErrorMessage(rawMessage: string): string | null {
    const message = rawMessage.toLowerCase();
    if (message.includes("duplicate_email")) return t("validation.duplicate.email");
    if (message.includes("users_email_key") || message.includes("key (email)")) return t("validation.duplicate.email");
    if (message.includes("email already") || message.includes("email exists")) return t("validation.duplicate.email");
    return null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setToast(null);
    const trimmedEmail = inviteEmailLocked && invitedEmailFromQuery ? invitedEmailFromQuery : email.trim();
    if (emailInputRef.current) {
      emailInputRef.current.setCustomValidity("");
      if (!emailInputRef.current.checkValidity()) { emailInputRef.current.reportValidity(); return; }
      if (!hasValidEmailDomainSuffix(trimmedEmail)) {
        emailInputRef.current.setCustomValidity(t("auth.email.invalid"));
        emailInputRef.current.reportValidity();
        return;
      }
    }
    setLoading(true);
    try {
      const response = await register({ email: trimmedEmail, password });
      loginFromResponse(response);
      markRevampEmailVerified(false);
      let otpState: { challengeId: string; debugCode?: string } | undefined;
      try {
        const dispatched = await sendEmailOtpChallenge(response.token);
        otpState = { challengeId: dispatched.challengeId, debugCode: dispatched.debugCode ?? undefined };
      } catch {
        // OTP send failed — VerifyOtpPage will show a resend button
      }
      navigate("/verify-otp", { state: otpState });
    } catch (err) {
      if (err instanceof HttpError) {
        const normalized = err.message.toLowerCase();
        if (normalized.includes("domain suffix") || (normalized.includes("email") && normalized.includes("valid")) || normalized.includes("email must")) {
          const message = t("auth.email.invalid");
          emailInputRef.current?.setCustomValidity(message);
          emailInputRef.current?.reportValidity();
          return;
        }
        const mapped = mapRegisterErrorMessage(err.message);
        if (mapped) { setError(mapped); setToast({ message: mapped, type: "error" }); return; }
        setError(err.message);
        setToast({ message: err.message, type: "error" });
      } else setError(t("auth.register.failed"));
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
            Registrati come fornitore del Gruppo Solco
          </div>
          <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>
            Crea il tuo profilo e candidati all'Albo Fornitori Digitale per collaborare con il Gruppo Solco.
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
            {t("auth.register.title")}
          </h2>
          <p style={{ margin: "0 0 28px", fontSize: "0.84rem", color: "#6b7280" }}>
            Compila i campi per creare il tuo account.
          </p>

          <form onSubmit={onSubmit} className="grid-form auth-form" style={{ gridTemplateColumns: "1fr" }}>
            <label className={`floating-field ${email.trim() ? "has-value" : ""}`}>
              <Mail className="floating-field-icon" />
              <input
                className="floating-input auth-input"
                ref={emailInputRef}
                type="email"
                value={email}
                placeholder="nome@azienda.it"
                disabled={inviteEmailLocked}
                onInvalid={(e) => {
                  const input = e.currentTarget;
                  input.setCustomValidity(input.validity.valueMissing ? t("validation.browser.required") : t("auth.email.invalid"));
                }}
                onChange={(e) => { if (inviteEmailLocked) return; e.currentTarget.setCustomValidity(""); setEmail(e.target.value); }}
                pattern="^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$"
                title={t("auth.email.invalid")}
                required
              />
              <span className="floating-field-label">{t("auth.email")}</span>
            </label>

            <label className={`floating-field ${password ? "has-value" : ""}`}>
              <Lock className="floating-field-icon" />
              <input className="floating-input auth-input" type="password" value={password} placeholder=" " onChange={(e) => setPassword(e.target.value)} required />
              <span className="floating-field-label">{t("auth.password")}</span>
            </label>

            {error ? <p className="error register-error">{error}</p> : null}

            <button className={`auth-submit-btn ${loading ? "is-loading" : ""}`} disabled={loading} type="submit">
              <span className="auth-submit-btn-content">
                {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : <UserPlus className="h-4 w-4" />}
                <span>{loading ? t("auth.register.loading") : t("auth.register.submit")}</span>
              </span>
            </button>
          </form>

          <p style={{ margin: "20px 0 0", fontSize: "0.82rem", color: "#6b7280", textAlign: "center" }}>
            {t("auth.alreadyRegistered")}{" "}
            <Link to="/login" style={{ color: "#1b5d96", fontWeight: 600, textDecoration: "none" }}>
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
