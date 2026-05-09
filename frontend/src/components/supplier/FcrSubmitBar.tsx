import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import { supplierSubmitChange } from "../../api/fieldChangeRequestApi";
import { clearRevampFcrEditSession } from "../../utils/revampFcrEditSession";
import type { FcrEditMode } from "../../hooks/useFcrEditMode";

interface Props {
  fcr: FcrEditMode;
  token: string;
  /** Called after the section has already been saved — bar triggers the FCR submit */
  onSectionSaved: () => Promise<void>;
}

export function FcrSubmitBar({ fcr, token, onSectionSaved }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!fcr.active || !fcr.fcrId) return null;

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await onSectionSaved();
      await supplierSubmitChange(fcr.fcrId!, token);
      clearRevampFcrEditSession();
      navigate("/supplier/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'invio.");
      setBusy(false);
    }
  }

  return (
    <div className="fcr-submit-bar">
      <div className="fcr-submit-bar-inner">
        <span className="fcr-submit-bar-label">
          Stai modificando la sezione in modalità <strong>Richiesta di Modifica</strong>. Salva e invia per avviare la revisione.
        </span>
        {error && <span className="fcr-submit-bar-error">{error}</span>}
        <button
          type="button"
          className="fcr-submit-bar-btn"
          disabled={busy}
          onClick={() => void handleSubmit()}
        >
          <Send size={15} />
          {busy ? "Invio in corso…" : "Salva e Invia Modifiche"}
        </button>
      </div>
    </div>
  );
}
