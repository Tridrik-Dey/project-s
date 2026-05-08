import { useState } from "react";
import { FileEdit, Send, X } from "lucide-react";
import { createFieldChangeRequest } from "../../api/fieldChangeRequestApi";
import { HttpError } from "../../api/http";

const SECTION_OPTIONS = [
  { key: "S1", label: "S1 – Dati Anagrafici" },
  { key: "S2", label: "S2 – Dati Aziendali" },
  { key: "S3", label: "S3 – Capacità Tecnica" },
  { key: "S4", label: "S4 – Referenze" },
  { key: "S5", label: "S5 – Documenti" },
];

const MESSAGE_MAX = 2000;

interface Props {
  applicationId: string;
  token: string;
  onClose: () => void;
  onSent: () => void;
}

export function FieldChangeRequestModal({ applicationId, token, onClose, onSent }: Props) {
  const [sectionKey, setSectionKey] = useState("");
  const [supplierMessage, setSupplierMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = sectionKey !== "" && supplierMessage.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await createFieldChangeRequest(
        applicationId,
        { sectionKey, supplierMessage: supplierMessage.trim() },
        token
      );
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
            <FileEdit className="h-5 w-5" />
            <h4>Richiesta Modifica Dati</h4>
          </div>
          <button type="button" className="compose-modal-close" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="compose-modal-body">

          <div className="compose-field">
            <label className="compose-field-label" htmlFor="fcr-section">
              Sezione da modificare <span className="compose-required">*</span>
            </label>
            <select
              id="fcr-section"
              className="floating-input"
              value={sectionKey}
              onChange={(e) => setSectionKey(e.target.value)}
              disabled={sending}
            >
              <option value="">Seleziona una sezione...</option>
              {SECTION_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="compose-field">
            <label className="compose-field-label" htmlFor="fcr-message">
              Motivo della richiesta <span className="compose-required">*</span>
            </label>
            <textarea
              id="fcr-message"
              className="floating-input compose-body-input"
              rows={6}
              value={supplierMessage}
              maxLength={MESSAGE_MAX}
              onChange={(e) => setSupplierMessage(e.target.value)}
              placeholder="Descrivi cosa vuoi modificare e perché..."
              disabled={sending}
            />
            <span className="compose-char-count">{supplierMessage.length}/{MESSAGE_MAX}</span>
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
            {sending ? "Invio in corso..." : "Invia Richiesta"}
          </button>
        </div>

      </div>
    </div>
  );
}
