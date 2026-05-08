import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { acceptInvite } from "../../api/authApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";

export function AcceptAdminInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginFromResponse } = useAuth();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  const passwordRules = [
    { id: "length", label: "Minimo 8 caratteri", valid: password.length >= 8 },
    { id: "match", label: "Le password coincidono", valid: !!confirmPassword && password === confirmPassword }
  ];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (busy) return;
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }
    setBusy(true);
    try {
      const response = await acceptInvite(token, password);
      loginFromResponse(response);
      navigate(response.role === "SUPPLIER" ? "/supplier/dashboard" : "/admin/dashboard", { replace: true });
    } catch (err) {
      const message = err instanceof HttpError ? err.message : "Attivazione invito non riuscita.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <AppToast toast={{ message: error, type: "error" }} onClose={() => setError(null)} className="auth-toast" /> : null}
      <section className="panel auth-panel auth-access-panel activate-account-panel">
        <div className="activate-account-heading">
          <div className="activate-account-icon" aria-hidden="true">
            <ShieldCheck size={22} />
          </div>
          <h2>Attiva il tuo account</h2>
        </div>
        <p className="subtle activate-account-subtitle">
          Crea una password sicura per completare l&apos;accesso amministrativo.
        </p>
        <form className="grid-form auth-form activate-account-form" onSubmit={onSubmit}>
          <label className={`floating-field auth-password-field ${password ? "has-value" : ""}`}>
            <Lock className="floating-field-icon" />
            <input
              className="floating-input auth-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
              required
            />
            <span className="floating-field-label">Nuova password</span>
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </label>
          <label className={`floating-field auth-password-field ${confirmPassword ? "has-value" : ""}`}>
            <Lock className="floating-field-icon" />
            <input
              className="floating-input auth-input"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder=" "
              required
            />
            <span className="floating-field-label">Conferma password</span>
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? "Nascondi conferma password" : "Mostra conferma password"}
            >
              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </label>
          <div className="activate-password-rules" aria-label="Requisiti password">
            {passwordRules.map((rule) => (
              <span key={rule.id} className={rule.valid ? "is-valid" : ""}>
                <CheckCircle2 size={14} />
                {rule.label}
              </span>
            ))}
          </div>
          <button className={`auth-submit-btn ${busy ? "is-loading" : ""}`} type="submit" disabled={busy}>
            <span className="auth-submit-btn-content">
              {busy ? <span className="auth-submit-spinner" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" />}
              <span>{busy ? "Attivazione..." : "Attiva account"}</span>
            </span>
          </button>
        </form>
        <p className="subtle auth-footer">
          <Link to="/login">Torna al login</Link>
        </p>
      </section>
    </>
  );
}
