import { useI18n } from "../../i18n/I18nContext";

export function PrivacyPolicyPage() {
  const { language } = useI18n();
  const isItalian = language === "it";

  return (
    <section className="stack legal-page">
      <article className="panel legal-content">
        <h2>{isItalian ? "Privacy Policy (GDPR)" : "Privacy Policy (GDPR)"}</h2>
        <p className="legal-updated">
          {isItalian ? "Ultimo aggiornamento: 9 aprile 2026" : "Last updated: April 9, 2026"}
        </p>

        <h3>{isItalian ? "1. Titolare del trattamento" : "1. Data Controller"}</h3>
        <p>
          {isItalian
            ? "Il titolare del trattamento e Albo Fornitori Digitale. Per richieste privacy puoi usare il canale Supporto presente in piattaforma."
            : "The data controller is Albo Fornitori Digitale. For privacy requests, you can use the Support channel available in the platform."}
        </p>

        <h3>{isItalian ? "2. Dati trattati" : "2. Personal Data Processed"}</h3>
        <ul>
          <li>{isItalian ? "Dati account: nome, email, ruolo." : "Account data: name, email, role."}</li>
          <li>{isItalian ? "Dati aziendali e di contatto inseriti nei moduli." : "Company and contact data entered in forms."}</li>
          <li>{isItalian ? "Documenti caricati dal fornitore." : "Documents uploaded by suppliers."}</li>
          <li>{isItalian ? "Log tecnici e di sicurezza (es. request id, timestamp)." : "Technical and security logs (e.g., request id, timestamp)."}</li>
        </ul>

        <h3>{isItalian ? "3. Finalita e base giuridica" : "3. Purpose and Legal Basis"}</h3>
        <ul>
          <li>
            {isItalian
              ? "Esecuzione del servizio (registrazione, validazione, gestione documentale)."
              : "Service delivery (registration, validation, document management)."}
          </li>
          <li>
            {isItalian
              ? "Adempimento di obblighi legali e di sicurezza."
              : "Compliance with legal and security obligations."}
          </li>
          <li>
            {isItalian
              ? "Legittimo interesse per prevenzione abusi e audit operativo."
              : "Legitimate interest for abuse prevention and operational audit."}
          </li>
        </ul>

        <h3>{isItalian ? "4. Conservazione dei dati" : "4. Data Retention"}</h3>
        <p>
          {isItalian
            ? "I dati sono conservati per il tempo necessario alle finalita operative e agli obblighi di legge, poi cancellati o anonimizzati."
            : "Data is kept for as long as needed for operational purposes and legal obligations, then deleted or anonymized."}
        </p>

        <h3>{isItalian ? "5. Condivisione dei dati" : "5. Data Sharing"}</h3>
        <p>
          {isItalian
            ? "I dati possono essere trattati da fornitori tecnici (hosting, email, infrastruttura) nominati responsabili del trattamento."
            : "Data may be processed by technical providers (hosting, email, infrastructure) acting as data processors."}
        </p>

        <h3>{isItalian ? "6. Diritti GDPR" : "6. GDPR Rights"}</h3>
        <ul>
          <li>{isItalian ? "Accesso ai dati personali." : "Access to personal data."}</li>
          <li>{isItalian ? "Rettifica dei dati inesatti." : "Rectification of inaccurate data."}</li>
          <li>{isItalian ? "Cancellazione (diritto all'oblio), ove applicabile." : "Erasure (right to be forgotten), where applicable."}</li>
          <li>{isItalian ? "Limitazione e opposizione al trattamento." : "Restriction and objection to processing."}</li>
          <li>{isItalian ? "Portabilita dei dati, ove tecnicamente applicabile." : "Data portability, where technically applicable."}</li>
        </ul>

        <h3>{isItalian ? "7. Sicurezza" : "7. Security"}</h3>
        <p>
          {isItalian
            ? "Sono adottate misure tecniche e organizzative adeguate per proteggere i dati da accessi non autorizzati, perdita o alterazione."
            : "Appropriate technical and organizational measures are applied to protect data against unauthorized access, loss, or alteration."}
        </p>

        <h3>{isItalian ? "8. Cookie" : "8. Cookies"}</h3>
        <p>
          {isItalian
            ? "La piattaforma usa principalmente storage locale per sessione applicativa e lingua. La sezione Cookie Policy puo essere aggiornata in base agli strumenti attivi."
            : "The platform mainly uses local storage for app session and language preferences. The Cookie Policy section may be updated based on active tools."}
        </p>
      </article>
    </section>
  );
}

