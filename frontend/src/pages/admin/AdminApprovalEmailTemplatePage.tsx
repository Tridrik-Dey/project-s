import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";

export function AdminApprovalEmailTemplatePage() {
  return (
    <section className="stack">
      <div className="panel">
        <h2><Mail className="h-5 w-5" /> Template e-mail approvazione iscrizione</h2>
        <p className="subtle">
          Anteprima del template inviato al fornitore quando la candidatura viene approvata.
        </p>
      </div>

      <div className="panel" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: "16px", overflow: "hidden", background: "#ffffff" }}>
          <div style={{ background: "#0f3f83", color: "#ffffff", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldCheck className="h-5 w-5" />
            <strong>Gruppo Solco - Albo Fornitori Digitale</strong>
          </div>
          <div style={{ height: "8px", background: "#f1c40f" }} />

          <div style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#1f7a1f", fontWeight: 700, marginBottom: "1rem" }}>
              <CheckCircle2 className="h-5 w-5" />
              Iscrizione approvata con successo
            </div>

            <p>Gentile <strong>{"{{nome_fornitore}}"}</strong>,</p>
            <p>
              la tua candidatura all&apos;Albo Fornitori &egrave; stata approvata.
              Il tuo profilo &egrave; ora attivo e disponibile secondo le regole di visibilit&agrave; previste.
            </p>

            <div className="home-step-card" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
              <p><strong>Dati iscrizione</strong></p>
              <p className="subtle">Codice protocollo: <strong>{"{{protocol_code}}"}</strong></p>
              <p className="subtle">Registro: <strong>{"{{registry_type}}"}</strong></p>
              <p className="subtle">Data approvazione: <strong>{"{{approved_at}}"}</strong></p>
            </div>

            <p style={{ marginBottom: "0.4rem" }}><strong>Prossimi passi:</strong></p>
            <ul>
              <li>accedi all&apos;area riservata fornitore;</li>
              <li>verifica dati, documenti e scadenze;</li>
              <li>mantieni aggiornato il profilo per il rinnovo annuale.</li>
            </ul>

            <div className="revamp-step-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="home-btn home-btn-primary admin-action-btn" disabled>
                Accedi all&apos;area riservata
              </button>
            </div>

            <p className="subtle" style={{ marginTop: "1rem" }}>
              Questa &egrave; una preview UI del template e-mail. I contenuti finali sono governati dalle variabili template lato backend.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
