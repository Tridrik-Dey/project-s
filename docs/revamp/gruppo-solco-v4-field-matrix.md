# Gruppo Solco v4 -> Revamp DB Field Matrix (Supplier Questionnaire)

Scope:
- Source: `docs/new-requirements/gruppo_solco_v4.txt`
- Target DB model: revamp final tables (`applications`, `application_sections`, `otp_challenges`, `supplier_registry_profiles`, `users`)
- Status meaning: `Met` = explicitly implemented and persisted, `Partial` = persisted but simplified/aggregated/not full constraint model, `Missing` = not implemented in current revamp flow.

## 1) Access and application envelope

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Iscrizione tipo Albo (A/B) | Met | `applications.registry_type` |
| Canale accesso (invito/pubblico) | Met | `applications.source_channel` |
| Account email | Met | `users.email` |
| Password sicura | Met | `users.password_hash` (auth layer) |
| Verifica email OTP 6 cifre | Met | `otp_challenges.challenge_type='EMAIL_VERIFY'`, `otp_challenges.otp_hash`, `otp_challenges.expires_at`, `otp_challenges.verified_at`, `otp_challenges.status` |
| Stato candidatura (draft/submitted/etc) | Met | `applications.status` |
| Protocollo candidatura | Met | `applications.protocol_code` |

## 2) Albo A - Sezione 1 (Dati anagrafici)

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Nome | Missing | Not present in S1 payload |
| Cognome | Missing | Not present in S1 payload |
| Data di nascita | Missing | Not present in S1 payload |
| Luogo di nascita | Missing | Not present in S1 payload |
| Codice Fiscale | Met | `application_sections(section_key='S1').payload_json.taxCode` |
| Partita IVA (opz.) | Missing | Not present in S1 payload |
| Regime fiscale | Missing | Not present in S1 payload |
| Indirizzo professionale/residenza | Missing | Not present in S1 payload |
| Comune | Met | `application_sections(section_key='S1').payload_json.city` |
| CAP | Met | `application_sections(section_key='S1').payload_json.postalCode` |
| Provincia | Met | `application_sections(section_key='S1').payload_json.province` |
| Telefono principale | Met | `application_sections(section_key='S1').payload_json.phone` |
| Telefono secondario/WhatsApp | Missing | Not present in S1 payload |
| Email principale | Missing | stored at account level (`users.email`), not in S1 questionnaire payload |
| Email secondaria | Missing | Not present in S1 payload |
| PEC | Missing | Not present in S1 payload |
| Sito web/portfolio | Missing | Not present in S1 payload |
| Profilo LinkedIn | Missing | Not present in S1 payload |
| Foto profilo (mockup) | Partial | `application_sections(section_key='S1').payload_json.profilePhoto*` (base64 in JSON, no document store metadata model) |

## 3) Albo A - Sezione 2 (Tipologia professionale)

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Tipologia principale | Partial | `application_sections(section_key='S2').payload_json.professionalType` (implemented options are simplified vs full doc list) |
| Codice ATECO principale (obbl. per "Altro") | Met | `application_sections(section_key='S2').payload_json.atecoCode` |
| Disponibilita a lavorare in piu ruoli (opz.) | Missing | Not present in S2 payload |

## 4) Albo A - Sezione 3A (Docente/Formatore)

### A) Istruzione e abilitazioni
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Titolo di studio piu elevato | Missing | Not present in S3A payload |
| Ambito/indirizzo di studio | Missing | Not present in S3A payload |
| Anno di conseguimento | Missing | Not present in S3A payload |
| Certificazioni e abilitazioni | Missing | Not present in S3A payload |

### B) Aree tematiche di competenza
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Ambiti di competenza (>=1) | Partial | `application_sections(section_key='S3A').payload_json.thematicAreasCsv` (CSV free text, no structured per-ambito model) |
| Specifica tematiche per ambito | Missing | No per-ambito JSON object |
| Anni esperienza per ambito | Missing | No per-ambito JSON object |
| Esperienza docenza PA (S/N) | Missing | Not present |
| Ambiti consulenza offerti (opz.) | Missing | Not present |
| Area territoriale attivita in presenza | Missing | Not present (only generic city/province in S1) |
| Lingue parlate + livello QCER | Missing | Not present |
| Lingue docenza | Missing | Not present |
| Strumenti digitali rilevanti | Missing | Not present |
| Partecipazione reti/associazioni | Missing | Not present |

### C) Disponibilita/territorio/condizioni
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Disponibilita trasferte | Missing | Not present |
| Tariffa giornaliera indicativa | Missing | Not present |
| Tariffa oraria indicativa | Missing | Not present |

### D) Esperienze formative (fino a 5)
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Committente/organizzazione | Missing | Not present |
| Settore committente | Missing | Not present |
| Tipo intervento | Missing | Not present |
| Ambito tematico principale | Missing | Not present |
| Periodo da-a | Missing | Not present |
| Durata totale | Missing | Not present |
| Numero partecipanti | Missing | Not present |
| Modalita erogazione | Missing | Not present |
| Intervento finanziato (S/N + fondo) | Missing | Not present |

### E) Referenze
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Nome/cognome referente | Partial | `application_sections(section_key='S4').payload_json.referencesSummary` (single free-text summary, no structured references array) |
| Ruolo/organizzazione referente | Partial | same as above |
| Email/telefono referente | Partial | same as above |

### F) Allegati
| Document field | Status | Exact revamp mapping |
|---|---|---|
| CV aggiornato (PDF) | Missing | No document entity/path in revamp flow for candidate attachments |
| Certificazioni/attestati (upload) | Missing | Not present |

## 5) Albo A - Sezione 3B (Altri professionisti)

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Ordine professionale | Missing | Not present |
| Titolo di studio piu elevato | Missing | Not present |
| Ambito/indirizzo di studio | Missing | Not present |
| Anni esperienza complessiva | Missing | Not present |
| Servizi offerti (>=1) | Partial | `application_sections(section_key='S3B').payload_json.specialization` (free text only) |
| Certificazioni/abilitazioni specifiche | Missing | Not present |
| Area territoriale attivita | Partial | `application_sections(section_key='S3B').payload_json.operationalScope` (free text) |
| Tariffa oraria indicativa | Missing | Not present |
| CV (upload PDF) | Missing | Not present |

## 6) Albo A - Sezione 5 (Dichiarazioni e consensi)

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Assenza condanne penali ostative | Partial | `application_sections(section_key='S5').payload_json.declarationTruthful` (generic, not explicit criminal declaration key) |
| Assenza conflitti di interesse | Met | `application_sections(section_key='S5').payload_json.declarationNoConflict` |
| Veridicita informazioni | Partial | `application_sections(section_key='S5').payload_json.declarationTruthful` (combined semantics) |
| Accettazione Privacy Policy | Met | `application_sections(section_key='S5').payload_json.privacyAccepted` |
| Consenso dati per gestione Albo | Partial | covered generically by privacy/declaration; no dedicated key |
| Consenso comunicazioni commerciali (opz.) | Met | `application_sections(section_key='S5').payload_json.marketingConsent` |
| Accettazione Codice Etico | Met | `application_sections(section_key='S5').payload_json.ethicalCodeAccepted` |
| Accettazione standard qualita/ambiente/sicurezza | Met | `application_sections(section_key='S5').payload_json.qualityStandardsAccepted` |
| Conformita D.Lgs. 81/2008 (docenti in presenza) | Missing | no dedicated conditional boolean in S5 payload |
| Firma OTP via email | Met | `application_sections(section_key='S5').payload_json.otp*` + `otp_challenges(challenge_type='DECLARATION_SIGNATURE')` |

## 7) Albo B - Sezione 1 (Dati aziendali)

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Ragione sociale | Met | `application_sections(section_key='S1').payload_json.companyName` |
| Forma giuridica | Missing | Not present |
| Partita IVA | Met | `application_sections(section_key='S1').payload_json.vatNumber` |
| Codice Fiscale (se diverso) | Missing | Not present |
| Numero REA | Met | `application_sections(section_key='S1').payload_json.reaNumber` |
| CCIAA iscrizione | Met | `application_sections(section_key='S1').payload_json.cciaaProvince` |
| Data costituzione | Met | `application_sections(section_key='S1').payload_json.incorporationDate` |
| Sede legale (via+n.civico) | Missing | Not present |
| Comune | Missing | Not present in Albo B S1 |
| CAP | Missing | Not present in Albo B S1 |
| Provincia | Missing | Not present in Albo B S1 |
| Sede operativa principale | Missing | Not present |
| E-mail istituzionale | Missing | Not present |
| PEC | Missing | Not present |
| Telefono principale | Missing | Not present |
| Sito web aziendale | Missing | Not present |
| Legale rappresentante nome+cognome | Met | `application_sections(section_key='S1').payload_json.legalRepresentativeName` |
| Legale rappresentante codice fiscale | Missing | Not present |
| Legale rappresentante ruolo | Missing | Not present |
| Referente operativo (nome, ruolo, email, tel) | Partial | `application_sections(section_key='S1').payload_json.operationalContactEmail` only |

## 8) Albo B - Sezione 2 (Struttura, dimensione, settore)

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Numero dipendenti (fascia) | Met | `application_sections(section_key='S2').payload_json.employeeRange` |
| Fatturato ultimo esercizio (fascia) | Missing | Not present |
| Codice ATECO principale | Met | `application_sections(section_key='S2').payload_json.atecoPrimary` |
| Codici ATECO secondari (fino a 3) | Missing | Not present |
| Regioni operativita | Partial | `application_sections(section_key='S2').payload_json.operatingRegions` (single string, not structured list) |
| Accreditamento formazione regionale (S/N + dettagli) | Partial | generic in `application_sections(section_key='S4').payload_json.accreditationSummary` |
| Tipo organizzazione Terzo Settore | Missing | Not present |
| Numero iscrizione RUNTS | Missing | Not present |

## 9) Albo B - Sezione 3 (Tipologia e servizi offerti)

### Categoria A - Formazione/didattica
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Progettazione didattica / instructional design | Partial | `application_sections(section_key='S3').payload_json.servicesByCategory.CAT_A[]` -> `TRAINING_DESIGN` |
| Erogazione formazione in aula | Missing | Not in implemented CAT_A service IDs |
| Formazione online sincrona | Missing | Not in implemented CAT_A service IDs |
| Produzione contenuti e-learning | Partial | `...CAT_A[]` -> `LMS_CONTENT` |
| Sviluppo/gestione piattaforme LMS | Partial | collapsed into `LMS_CONTENT` |
| Corsi finanziati (FSE/fondi) | Missing | Not in implemented CAT_A service IDs |
| Formazione disoccupati/politiche attive | Missing | Not in implemented CAT_A service IDs |
| Assessment/testing competenze | Partial | `...CAT_A[]` -> `ASSESSMENT` |
| Simulatori VR/AR | Partial | `...CAT_A[]` -> `SIMULATION` |
| Traduzione/localizzazione contenuti | Missing | Not in implemented CAT_A service IDs |
| Descrizione sintetica categoria | Met | `application_sections(section_key='S3').payload_json.descriptionsByCategory.CAT_A` |

### Categoria B - HR/Lavoro
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Ricerca e selezione personale | Met | `...servicesByCategory.CAT_B[]` -> `RECRUITING` |
| Somministrazione lavoro (APL) | Met | `...servicesByCategory.CAT_B[]` -> `STAFFING` |
| Outplacement/ricollocazione | Missing | Not in implemented CAT_B service IDs |
| Payroll/amministrazione personale | Met | `...servicesByCategory.CAT_B[]` -> `PAYROLL` |
| Welfare aziendale | Missing | Not in implemented CAT_B service IDs |
| Consulenza organizzativa HR/change mgmt | Met | `...servicesByCategory.CAT_B[]` -> `HR_CONSULTING` |
| Sviluppo organizzativo/talent mgmt | Missing | Not in implemented CAT_B service IDs |
| Coaching e sviluppo manageriale | Missing | Not in implemented CAT_B service IDs |
| Descrizione sintetica categoria | Met | `application_sections(section_key='S3').payload_json.descriptionsByCategory.CAT_B` |

### Categoria C - Tecnologia e digitale
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Sviluppo software custom | Met | `...servicesByCategory.CAT_C[]` -> `CUSTOM_SOFTWARE` |
| Sistemi informativi HR | Missing | Not in implemented CAT_C service IDs |
| Digital marketing / SEO | Missing | Not in implemented CAT_C service IDs |
| Cybersecurity | Met | `...servicesByCategory.CAT_C[]` -> `CYBERSECURITY` |
| UX/UI design | Missing | Not in implemented CAT_C service IDs |
| Data analysis / BI | Met | `...servicesByCategory.CAT_C[]` -> `BI_DASHBOARD` |
| Cloud / managed services / help desk | Missing | Not in implemented CAT_C service IDs |
| AI applicata / automazione | Met | `...servicesByCategory.CAT_C[]` -> `AI_AUTOMATION` |
| Descrizione sintetica categoria | Met | `application_sections(section_key='S3').payload_json.descriptionsByCategory.CAT_C` |

### Categoria D - Consulenza/compliance
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Consulenza del lavoro | Missing | Not in implemented CAT_D service IDs |
| Consulenza fiscale/tributaria/contabile | Partial | `...servicesByCategory.CAT_D[]` -> `TAX_ACCOUNTING` |
| Consulenza legale | Met | `...servicesByCategory.CAT_D[]` -> `LEGAL` |
| Finanza agevolata/bandi | Met | `...servicesByCategory.CAT_D[]` -> `FUNDING` |
| Consulenza direzione/strategia | Missing | Not in implemented CAT_D service IDs |
| Audit/revisione/sistemi qualita | Missing | Not in implemented CAT_D service IDs |
| Compliance 231/GDPR/ESG | Met | `...servicesByCategory.CAT_D[]` -> `GDPR_231_ESG` |
| Servizi Terzo Settore | Missing | Not in implemented CAT_D service IDs |
| Ricerca sociale/valutazione impatto | Missing | Not in implemented CAT_D service IDs |
| Descrizione sintetica categoria | Met | `application_sections(section_key='S3').payload_json.descriptionsByCategory.CAT_D` |

### Categoria E - Servizi generali
| Document field | Status | Exact revamp mapping |
|---|---|---|
| Fornitura materiali didattici/editoriali | Missing | Not in implemented CAT_E service IDs |
| Comunicazione/grafica/video/foto | Partial | `...servicesByCategory.CAT_E[]` -> `COMMUNICATION` |
| Organizzazione eventi | Met | `...servicesByCategory.CAT_E[]` -> `EVENTS` |
| Logistica/travel management | Partial | `...servicesByCategory.CAT_E[]` -> `LOGISTICS` |
| Facility management | Met | `...servicesByCategory.CAT_E[]` -> `FACILITY` |
| Catering/ristorazione/hospitality | Missing | Not in implemented CAT_E service IDs |
| Noleggio attrezzature A/V | Missing | Not in implemented CAT_E service IDs |
| Segreteria/reception/back-office | Missing | Not in implemented CAT_E service IDs |
| Traduzioni/interpretariato | Missing | Not in implemented CAT_E service IDs |
| Descrizione sintetica categoria | Met | `application_sections(section_key='S3').payload_json.descriptionsByCategory.CAT_E` |

## 10) Albo B - Certificazioni e accreditamenti

| Document field | Status | Exact revamp mapping |
|---|---|---|
| ISO 9001 (S/N) | Met | `application_sections(section_key='S4').payload_json.iso9001` |
| ISO 9001 metadata (ente/scadenza/upload) | Missing | Not present |
| ISO 14001 (S/N + metadata) | Missing | Not present |
| ISO 45001/OHSAS (S/N + metadata) | Missing | Not present |
| SA8000 (S/N + metadata) | Missing | Not present |
| ISO 27001 (S/N + metadata) | Missing | Not present |
| Altre certificazioni (testo+upload) | Partial | `application_sections(section_key='S4').payload_json.certificationsNotes` (text only, no structured upload model) |
| Accreditamento formazione regionale (dettaglio) | Partial | `application_sections(section_key='S4').payload_json.accreditationSummary` (aggregated text) |
| Accreditamento servizi al lavoro (ANPAL/Regioni) | Partial | aggregated in `accreditationSummary` |

## 11) Albo B - Allegati aziendali

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Visura camerale (upload) | Missing | No candidate document storage mapping in revamp sections |
| Company profile (upload) | Missing | Not present |
| DURC (upload) | Missing | Not present |
| Certificati ISO/accreditamenti (upload) | Missing | Not present |

## 12) Albo B - Sezione 5 (Dichiarazioni e conformita)

| Document field | Status | Exact revamp mapping |
|---|---|---|
| Dichiarazione antimafia | Missing | No dedicated S5 boolean |
| Dichiarazione ex D.Lgs. 231/01 | Missing | No dedicated S5 boolean |
| Adozione Modello 231 (S/N) | Missing | No dedicated S5 key |
| Regolarita contributiva/fiscale | Missing | No dedicated S5 key |
| Conformita D.Lgs. 81/2008 | Missing | No dedicated S5 key |
| Conformita GDPR + DPO (se applicabile) | Partial | generic `privacyAccepted`, no DPO-specific field |
| Veridicita informazioni | Partial | `application_sections(section_key='S5').payload_json.declarationTruthful` |
| Accettazione Privacy Policy | Met | `application_sections(section_key='S5').payload_json.privacyAccepted` |
| Accettazione Codice Etico | Met | `application_sections(section_key='S5').payload_json.ethicalCodeAccepted` |
| Accettazione standard qualita/ambiente/sicurezza | Met | `application_sections(section_key='S5').payload_json.qualityStandardsAccepted` |
| Consenso dati gestione Albo | Partial | no dedicated field; partially implied by privacy/declarations |
| Consenso comunicazioni commerciali | Met | `application_sections(section_key='S5').payload_json.marketingConsent` |
| Firma OTP legale rappresentante | Met | `application_sections(section_key='S5').payload_json.otp*` + `otp_challenges(challenge_type='DECLARATION_SIGNATURE')` |

## 13) Projection to active supplier profile (post approval)

| Document expectation | Status | Exact revamp mapping |
|---|---|---|
| Full supplier profile searchable by rich fields | Partial | `supplier_registry_profiles` currently stores summary-level fields (`display_name`, `public_summary`, `status`, `registry_type`, etc.) |
| Full questionnaire field projection in profile table | Missing | Full detail remains in `application_sections.payload_json` only |

## Overall alignment (supplier fields only)

- Met: core flow envelope + subset of S1/S2/S3/S4/S5 fields.
- Partial: multiple areas persisted as aggregated text instead of structured field sets.
- Missing: large part of document-level detailed fields, especially uploads and legal/compliance declarations specific to Albo A/B.
