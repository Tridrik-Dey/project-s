import { useState } from "react";
import { Mail, Send, X } from "lucide-react";
import { composeAdminEmail } from "../../../api/adminProfileDetailApi";
import { HttpError } from "../../../api/http";

interface Props {
  profileId: string;
  supplierEmail: string;
  supplierName: string;
  token: string;
  onClose: () => void;
  onSent: () => void;
}

const SUBJECT_MAX = 200;
const BODY_MAX = 5000;

export function ComposeEmailModal({ profileId, supplierEmail, supplierName, token, onClose, onSent }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await composeAdminEmail(profileId, { subject: subject.trim(), body: body.trim() }, token);
      onSent();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Invio non riuscito. Riprova.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel compose-email-modal" onClick={(e) => e.stopPropagation()}>

        <div className="compose-modal-header">
          <div className="compose-modal-title-row">
            <Mail className="h-5 w-5" />
            <h4>Scrivi al fornitore</h4>
          </div>
          <button type="button" className="compose-modal-close" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="compose-modal-body">

          {/* TO — read-only */}
          <div className="compose-field">
            <label className="compose-field-label">A (Destinatario)</label>
            <div className="compose-to-field">
              <span className="compose-to-name">{supplierName}</span>
              <span className="compose-to-email">&lt;{supplierEmail}&gt;</span>
              <span className="compose-to-locked" title="Il destinatario è il fornitore registrato e non può essere modificato">🔒</span>
            </div>
          </div>

          {/* Subject */}
          <div className="compose-field">
            <label className="compose-field-label" htmlFor="compose-subject">
              Oggetto <span className="compose-required">*</span>
            </label>
            <input
              id="compose-subject"
              type="text"
              className="floating-input compose-subject-input"
              value={subject}
              maxLength={SUBJECT_MAX}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Inserisci l'oggetto dell'e-mail"
              disabled={sending}
            />
            <span className="compose-char-count">{subject.length}/{SUBJECT_MAX}</span>
          </div>

          {/* Body */}
          <div className="compose-field">
            <label className="compose-field-label" htmlFor="compose-body">
              Messaggio <span className="compose-required">*</span>
            </label>
            <textarea
              id="compose-body"
              className="floating-input compose-body-input"
              rows={10}
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Scrivi qui il testo dell'e-mail..."
              disabled={sending}
            />
            <span className="compose-char-count">{body.length}/{BODY_MAX}</span>
          </div>

          {error ? <p className="compose-error">{error}</p> : null}
        </div>

        <div className="compose-modal-footer">
          <button
            type="button"
            className="home-btn home-btn-secondary admin-action-btn"
            onClick={onClose}
            disabled={sending}
          >
            Annulla
          </button>
          <button
            type="button"
            className="home-btn home-btn-primary admin-action-btn compose-send-btn"
            onClick={() => void handleSend()}
            disabled={!canSend}
          >
            <Send className="h-4 w-4" />
            {sending ? "Invio in corso..." : "Invia e-mail"}
          </button>
        </div>

      </div>
    </div>
  );
}
