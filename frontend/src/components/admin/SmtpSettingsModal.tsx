import { FormEvent, useEffect, useState } from "react";
import { Mail, KeyRound, X, Save, Settings } from "lucide-react";
import { getSmtpConfig, saveSmtpConfig } from "../../api/adminSmtpConfigApi";
import { HttpError } from "../../api/http";

interface SmtpSettingsModalProps {
  token: string;
  onClose: () => void;
}

export function SmtpSettingsModal({ token, onClose }: SmtpSettingsModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getSmtpConfig(token)
      .then((cfg) => setEmail(cfg.email ?? ""))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await saveSmtpConfig(token, { email: email.trim(), password });
      setSuccess(true);
      setPassword("");
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
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nuova password (lascia vuoto per non modificare)"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "10px 12px 10px 36px",
                      border: "1px solid #d1d5db", borderRadius: 8,
                      fontSize: "0.88rem", color: "#111827", outline: "none",
                    }}
                  />
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#9ca3af" }}>
                  Lascia vuoto per mantenere la password attuale.
                </p>
              </div>

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
                  disabled={loading || !email.trim() || !password}
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
