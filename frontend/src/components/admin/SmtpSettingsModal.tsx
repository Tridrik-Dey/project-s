import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Mail, KeyRound, X, Save, Settings } from "lucide-react";
import { getSmtpConfig, saveSmtpConfig } from "../../api/adminSmtpConfigApi";
import { HttpError } from "../../api/http";

interface SmtpSettingsModalProps {
  token: string;
  onClose: () => void;
}

export function SmtpSettingsModal({ token, onClose }: SmtpSettingsModalProps) {
  const PASSWORD_MASK = "********";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [debugOtpEnabled, setDebugOtpEnabled] = useState(false);

  useEffect(() => {
    getSmtpConfig(token)
      .then((cfg) => {
        setEmail(cfg.email ?? "");
        setPasswordConfigured(Boolean(cfg.passwordConfigured));
        setPassword(cfg.passwordConfigured ? PASSWORD_MASK : "");
        setDebugOtpEnabled(Boolean(cfg.debugOtpEnabled));
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const passwordToSave = passwordConfigured && password === PASSWORD_MASK ? "" : password;
      await saveSmtpConfig(token, { email: email.trim(), password: passwordToSave, debugOtpEnabled });
      setSuccess(true);
      setPasswordConfigured(true);
      setPassword(PASSWORD_MASK);
      setShowPassword(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Salvataggio non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440,
        boxShadow: "0 24px 48px -12px rgba(15,42,82,0.22)",
        border: "1px solid #e5e7eb", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px 16px", borderBottom: "1px solid #f0f0f0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Settings size={18} style={{ color: "#1b5d96" }} />
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "#0f2a52" }}>Impostazioni SMTP</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4, borderRadius: 6 }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ padding: "24px" }}>
          {fetching ? (
            <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>Caricamento configurazione...</p>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Email SMTP
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@gmail.com"
                    required
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "10px 12px 10px 36px",
                      border: "1px solid #d1d5db", borderRadius: 8,
                      fontSize: "0.88rem", color: "#111827", outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  App Password
                </label>
                <div style={{ position: "relative" }}>
                  <KeyRound size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
                  <input
                    className="smtp-password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordConfigured && e.target.value !== PASSWORD_MASK) {
                        setSuccess(false);
                      }
                    }}
                    onFocus={() => {
                      if (passwordConfigured && password === PASSWORD_MASK) {
                        setPassword("");
                      }
                    }}
                    onBlur={() => {
                      if (passwordConfigured && !password.trim()) {
                        setPassword(PASSWORD_MASK);
                      }
                    }}
                    placeholder="Nuova password (lascia vuoto per non modificare)"
                    autoComplete="new-password"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "10px 44px 10px 36px",
                      border: "1px solid #d1d5db", borderRadius: 8,
                      fontSize: "0.88rem", color: "#111827", outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Nascondi app password" : "Mostra app password"}
                    title={showPassword ? "Nascondi app password" : "Mostra app password"}
                    style={{
                      alignItems: "center",
                      background: "transparent",
                      border: 0,
                      borderRadius: 6,
                      color: "#64748b",
                      cursor: "pointer",
                      display: "inline-flex",
                      height: 30,
                      justifyContent: "center",
                      padding: 0,
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 30,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#9ca3af" }}>
                  Lascia vuoto per mantenere la password attuale.
                </p>
              </div>

              <label
                style={{
                  alignItems: "center",
                  background: debugOtpEnabled ? "#eff6ff" : "#f8fafc",
                  border: `1px solid ${debugOtpEnabled ? "#93c5fd" : "#dbe5ef"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  display: "flex",
                  gap: 12,
                  justifyContent: "space-between",
                  marginBottom: 20,
                  padding: "12px 14px",
                }}
              >
                <span>
                  <span style={{ color: "#0f2a52", display: "block", fontSize: "0.84rem", fontWeight: 700 }}>
                    Mostra OTP debug
                  </span>
                  <span style={{ color: "#64748b", display: "block", fontSize: "0.74rem", marginTop: 2 }}>
                    Usa il codice a schermo invece dell'invio email per i test.
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    background: debugOtpEnabled ? "#1b5d96" : "#cbd5e1",
                    borderRadius: 999,
                    flex: "0 0 auto",
                    height: 24,
                    padding: 2,
                    transition: "background 0.18s ease",
                    width: 44,
                  }}
                >
                  <span
                    style={{
                      background: "#fff",
                      borderRadius: "50%",
                      boxShadow: "0 1px 4px rgba(15, 42, 82, 0.22)",
                      display: "block",
                      height: 20,
                      transform: debugOtpEnabled ? "translateX(20px)" : "translateX(0)",
                      transition: "transform 0.18s ease",
                      width: 20,
                    }}
                  />
                </span>
                <input
                  checked={debugOtpEnabled}
                  onChange={(e) => {
                    setDebugOtpEnabled(e.target.checked);
                    setSuccess(false);
                  }}
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                  type="checkbox"
                />
              </label>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: "0.83rem", color: "#b91c1c" }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: "0.83rem", color: "#15803d" }}>
                  Configurazione SMTP salvata con successo.
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: "9px 18px", borderRadius: 8, border: "1px solid #d1d5db",
                    background: "#fff", color: "#374151", fontWeight: 600,
                    fontSize: "0.85rem", cursor: "pointer",
                  }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  style={{
                    padding: "9px 18px", borderRadius: 8, border: "none",
                    background: loading ? "#93c5fd" : "#1b5d96", color: "#fff",
                    fontWeight: 600, fontSize: "0.85rem", cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 7,
                  }}
                >
                  <Save size={14} />
                  {loading ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
