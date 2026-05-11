import { FormEvent, useMemo, useState } from "react";
import { MailCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { sendEmailOtpChallenge, verifyEmailOtpChallenge } from "../../api/authApi";
import { HttpError } from "../../api/http";
import { createRevampApplicationDraft } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/I18nContext";
import { isRevampEmailVerified, markRevampEmailVerified } from "../../utils/revampEmailVerification";
import { clearRevampOnboardingContext, loadRevampOnboardingContext } from "../../utils/revampOnboarding";
import { saveRevampApplicationSession } from "../../utils/revampApplicationSession";
import { resolvePostRegisterPath } from "../revamp/revampFlow";

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();
  const { t } = useI18n();
  const routeState = location.state as { challengeId?: string; debugCode?: string } | null;
  const [otpCode, setOtpCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(routeState?.challengeId ?? null);
  const [debugCode, setDebugCode] = useState<string | null>(routeState?.debugCode ?? null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const alreadyVerified = useMemo(() => Boolean(auth?.emailVerified) || isRevampEmailVerified(), [auth?.emailVerified]);

  async function dispatchOtp(token: string) {
    try {
      setSending(true);
      setToast(null);
      const dispatched = await sendEmailOtpChallenge(token);
      setChallengeId(dispatched.challengeId);
      setDebugCode(dispatched.debugCode ?? null);
      setToast({
        message: "Codice OTP inviato via email.",
        type: "success"
      });
    } catch (err) {
      if (err instanceof HttpError) {
        setToast({ message: err.message, type: "error" });
      } else {
        setToast({ message: "Invio OTP non riuscito.", type: "error" });
      }
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth?.token || !challengeId) {
      setToast({ message: "Nessuna challenge OTP attiva.", type: "error" });
      return;
    }

    try {
      setLoading(true);
      setToast(null);
      const verified = await verifyEmailOtpChallenge(challengeId, otpCode.trim(), auth.token);
      if (!verified.verified) {
        setToast({ message: "Codice non valido. Riprova.", type: "error" });
        return;
      }
      markRevampEmailVerified(true);
      setToast({ message: "Email verificata con successo.", type: "success" });
      const onboarding = loadRevampOnboardingContext();
      if (!onboarding?.registryType || !onboarding.sourceChannel) {
        navigate(resolvePostRegisterPath(null, false), { replace: true });
        return;
      }
      try {
        const draft = await createRevampApplicationDraft(
          {
            registryType: onboarding.registryType,
            sourceChannel: onboarding.sourceChannel,
            inviteId: onboarding.sourceChannel === "INVITE" ? onboarding.inviteId : undefined
          },
          auth.token
        );
        saveRevampApplicationSession({
          applicationId: draft.id,
          status: draft.status,
          protocolCode: draft.protocolCode,
          updatedAt: draft.updatedAt,
          resumePath: `/application/${draft.id}/step/1`
        });
        clearRevampOnboardingContext();
        navigate(resolvePostRegisterPath(draft.id, true), { replace: true });
      } catch {
        setToast({
          message: "Email verificata. Avvio wizard non riuscito, accesso all'area fornitore.",
          type: "error"
        });
        navigate("/supplier", { replace: true });
      }
    } catch (err) {
      if (err instanceof HttpError) {
        setToast({ message: err.message, type: "error" });
      } else {
        setToast({ message: "Verifica OTP non riuscita.", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  }

  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }

  if (alreadyVerified) {
    return <Navigate to="/supplier" replace />;
  }

  return (
    <section className="panel auth-panel auth-access-panel">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="auth-toast" /> : null}
      <h2>Verifica email</h2>
      <p className="subtle">
        Abbiamo inviato un codice OTP al tuo indirizzo email. Inseriscilo per continuare.
      </p>
      <form onSubmit={onSubmit} className="grid-form auth-form">
        <label className={`floating-field auth-otp-field ${otpCode.trim() ? "has-value" : ""}`}>
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

        <button className={`auth-submit-btn ${loading ? "is-loading" : ""}`} disabled={loading || !challengeId} type="submit">
          <span className="auth-submit-btn-content">
            {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : <MailCheck className="h-4 w-4" />}
            <span>{loading ? "Verifica in corso..." : "Verifica email"}</span>
          </span>
        </button>

        <button
          type="button"
          className="auth-submit-btn secondary"
          onClick={() => auth?.token && dispatchOtp(auth.token)}
          disabled={sending}
        >
          <span className="auth-submit-btn-content">
            {sending ? <span className="auth-submit-spinner" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" />}
            <span>{sending ? "Invio in corso..." : "Reinvia OTP"}</span>
          </span>
        </button>
      </form>

      {debugCode ? (
        <p className="subtle">
          Debug OTP: <strong>{debugCode}</strong>
        </p>
      ) : null}

      <p className="subtle auth-footer">
        <Link to="/login">{t("auth.backToLogin")}</Link>
      </p>
    </section>
  );
}
