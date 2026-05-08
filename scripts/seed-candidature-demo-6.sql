BEGIN;

-- =============================================================
-- Candidature demo seed: 3 Albo A + 3 Albo B, all non-approved.
-- Marker prefix: seedcand.
-- Safe to rerun: deletes only rows created by this script.
-- =============================================================

DELETE FROM application_attachments WHERE application_id IN (
    SELECT id FROM applications WHERE applicant_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
    )
);

DELETE FROM application_sections WHERE application_id IN (
    SELECT id FROM applications WHERE applicant_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
    )
);

DELETE FROM review_cases WHERE application_id IN (
    SELECT id FROM applications WHERE applicant_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
    )
);

DELETE FROM otp_challenges WHERE application_id IN (
    SELECT id FROM applications WHERE applicant_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
    )
) OR user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
);

DELETE FROM audit_events WHERE request_id LIKE 'seedcand-%' OR actor_user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
);

DELETE FROM notification_events WHERE provider_message_id LIKE 'seedcand-%' OR recipient LIKE 'seedcand.%@example.com';

DELETE FROM supplier_registry_profile_details WHERE profile_id IN (
    SELECT id FROM supplier_registry_profiles WHERE supplier_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
    )
);

DELETE FROM supplier_registry_profiles WHERE supplier_user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
);

DELETE FROM applications WHERE applicant_user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
);

DELETE FROM invites WHERE invited_email LIKE 'seedcand.%@example.com' OR token LIKE 'seedcand-%';

DELETE FROM supplier_profiles WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedcand.%@example.com'
);

DELETE FROM users WHERE email LIKE 'seedcand.%@example.com';

CREATE TEMP TABLE tmp_seedcand_src AS
SELECT *
FROM (VALUES
    (1, 'ALBO_A', 'Giulia Ferri',              'giulia.ferri',              'Consulente formazione digitale',    'Milano',  'MI', '85.59.20', 'Digital Learning, soft skills, project management'),
    (2, 'ALBO_A', 'Matteo Rinaldi',            'matteo.rinaldi',            'Docente sicurezza e qualita',       'Torino',  'TO', '85.59.20', 'Sicurezza lavoro, qualita ISO, audit interni'),
    (3, 'ALBO_A', 'Sara De Luca',              'sara.deluca',               'Coach organizzativa HR',            'Bologna', 'BO', '70.22.09', 'Coaching, HR, selezione e sviluppo persone'),
    (4, 'ALBO_B', 'Nexora Formazione SRL',     'nexora.formazione',         'Societa formazione e consulenza',   'Roma',    'RM', '85.59.20', 'Formazione finanziata, LMS, academy aziendali'),
    (5, 'ALBO_B', 'TechNova Servizi SPA',      'technova.servizi',          'Soluzioni digitali e automazione',  'Padova',  'PD', '62.01.00', 'Software, BI dashboard, integrazioni e AI automation'),
    (6, 'ALBO_B', 'Studio Integrato Lab SRL',  'studio.integrato.lab',      'Consulenza compliance e servizi',   'Napoli',  'NA', '70.22.09', 'Compliance, GDPR, 231, eventi e facility')
) AS t(idx, registry_type, display_name, email_slug, short_summary, city, province, ateco, skills);

INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at)
SELECT
    format('seedcand.%s@example.com', email_slug),
    'seed-candidature-hash',
    display_name,
    'SUPPLIER',
    true,
    NOW() - ((8 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_src;

CREATE TEMP TABLE tmp_seedcand_users AS
SELECT s.*, u.id AS user_id, u.email
FROM tmp_seedcand_src s
JOIN users u ON u.email = format('seedcand.%s@example.com', s.email_slug);

INSERT INTO supplier_profiles (
    user_id, status, company_name, trading_name, company_type,
    registration_number, vat_number, tax_id, country_of_incorporation,
    incorporation_date, website, description, employee_count_range,
    annual_revenue_range, address_line1, address_line2, city,
    state_province, postal_code, country, submitted_at, is_critical_edit_pending,
    preferred_language, created_at, updated_at
)
SELECT
    user_id,
    'PENDING',
    display_name,
    short_summary,
    CASE WHEN registry_type = 'ALBO_A' THEN 'SOLE_TRADER' ELSE 'LLC' END,
    format('SEEDCAND-REG-%s', 9000 + idx),
    format('IT%011s', 88000000000 + idx),
    format('SEEDCAND%08s', 1000 + idx),
    'IT',
    DATE '2014-01-01' + (idx * 137),
    format('https://%s.example.com', replace(email_slug, '.', '-')),
    format('%s. Competenze principali: %s.', short_summary, skills),
    CASE WHEN idx IN (5, 6) THEN 'MEDIUM' WHEN idx = 4 THEN 'SMALL' ELSE 'MICRO' END,
    CASE WHEN idx IN (5, 6) THEN '_1M_5M' WHEN idx = 4 THEN '_500K_1M' ELSE 'UNDER_100K' END,
    format('Via Demo Candidatura %s', idx),
    format('Interno %s', idx),
    city,
    province,
    format('%05s', 10000 + idx),
    'Italia',
    NOW() - (idx || ' days')::interval,
    false,
    'IT',
    NOW() - ((14 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_users;

INSERT INTO invites (
    registry_type, invited_email, invited_name, token, status, source_user_id,
    expires_at, consumed_at, renewed_from_invite_id, note, created_at, updated_at
)
SELECT
    registry_type,
    email,
    display_name,
    format('seedcand-%s-%s', lower(registry_type), idx),
    'CONSUMED',
    (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at NULLS LAST, id LIMIT 1),
    NOW() + interval '30 days',
    NOW() - (idx || ' days')::interval,
    NULL,
    'Candidatura demo completa per test approvazione.',
    NOW() - ((10 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_users;

CREATE TEMP TABLE tmp_seedcand_invites AS
SELECT i.id AS invite_id, s.idx
FROM invites i
JOIN tmp_seedcand_users s ON s.email = i.invited_email;

INSERT INTO applications (
    applicant_user_id, invite_id, registry_type, source_channel, status,
    protocol_code, current_revision, submitted_at, approved_at,
    rejected_at, suspended_at, renewal_due_at, legacy_supplier_profile_id,
    created_at, updated_at
)
SELECT
    s.user_id,
    i.invite_id,
    s.registry_type,
    'INVITE',
    'SUBMITTED',
    format('%s-%s-%s',
        CASE WHEN s.registry_type = 'ALBO_A' THEN 'A' ELSE 'B' END,
        EXTRACT(YEAR FROM CURRENT_DATE)::int,
        9600 + s.idx
    ),
    1,
    NOW() - (s.idx || ' days')::interval,
    NULL,
    NULL,
    NULL,
    NULL,
    sp.id,
    NOW() - ((12 - s.idx) || ' days')::interval,
    NOW() - (s.idx || ' hours')::interval
FROM tmp_seedcand_users s
JOIN tmp_seedcand_invites i ON i.idx = s.idx
JOIN supplier_profiles sp ON sp.user_id = s.user_id;

CREATE TEMP TABLE tmp_seedcand_apps AS
SELECT
    a.id AS application_id,
    s.*,
    a.protocol_code
FROM applications a
JOIN tmp_seedcand_users s ON s.user_id = a.applicant_user_id;

INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    application_id,
    'S1',
    1,
    CASE WHEN registry_type = 'ALBO_A' THEN jsonb_build_object(
        'firstName', split_part(display_name, ' ', 1),
        'lastName', substring(display_name from position(' ' in display_name) + 1),
        'birthDate', (DATE '1982-01-01' + (idx * 421))::text,
        'birthPlace', city,
        'taxCode', format('SCNDA%011s', 100000 + idx),
        'vatNumber', format('IT%011s', 81000000000 + idx),
        'taxRegime', CASE WHEN idx = 1 THEN 'FORFETTARIO' ELSE 'ORDINARIO' END,
        'addressLine', format('Via Professionista Demo %s', idx),
        'city', city,
        'postalCode', format('%05s', 20000 + idx),
        'province', province,
        'phone', format('+39 333 20%04s', idx),
        'secondaryPhone', format('+39 333 21%04s', idx),
        'email', email,
        'secondaryEmail', format('alt.%s', email),
        'pec', format('%s@pec.example.com', email_slug),
        'website', format('https://%s.example.com', replace(email_slug, '.', '-')),
        'linkedin', format('https://linkedin.example.com/in/%s', replace(email_slug, '.', '-')),
        'profilePhotoAttachment', jsonb_build_object(
            'documentType','OTHER',
            'fileName','brufen-upload.png',
            'mimeType','image/png',
            'sizeBytes',119313,
            'storageKey','seed-candidature/brufen-upload.png',
            'uploadedAt', NOW()::text
        )
    ) ELSE jsonb_build_object(
        'companyName', display_name,
        'legalForm', CASE WHEN idx = 5 THEN 'SPA' ELSE 'SRL' END,
        'vatNumber', format('IT%011s', 82000000000 + idx),
        'taxCodeIfDifferent', format('AZ%09s', 700000 + idx),
        'reaNumber', format('REA-DEMO-%s', 4000 + idx),
        'cciaaProvince', province,
        'incorporationDate', (DATE '2011-06-01' + (idx * 233))::text,
        'legalAddress', jsonb_build_object('street', format('Via Legale Demo %s', idx), 'city', city, 'cap', format('%05s', 30000 + idx), 'province', province),
        'operationalHeadquarter', jsonb_build_object('street', format('Viale Operativo %s', idx), 'city', city, 'postalCode', format('%05s', 31000 + idx), 'province', province),
        'institutionalEmail', email,
        'pec', format('%s@pec.example.com', email_slug),
        'phone', format('+39 02 70%04s', idx),
        'website', format('https://%s.example.com', replace(email_slug, '.', '-')),
        'legalRepresentative', jsonb_build_object('name', format('Rappresentante Demo %s', idx), 'taxCode', format('RAPP%012s', 900000 + idx), 'role', 'Amministratore'),
        'operationalContact', jsonb_build_object('name', format('Referente Operativo %s', idx), 'role', 'Responsabile fornitori', 'email', format('ops.%s', email), 'phone', format('+39 345 80%04s', idx))
    ) END,
    true,
    true,
    NOW() - (idx || ' days')::interval,
    NOW() - ((10 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_apps;

INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    application_id,
    'S2',
    1,
    CASE WHEN registry_type = 'ALBO_A' THEN jsonb_build_object(
        'professionalType', CASE WHEN idx = 1 THEN 'CONSULENTE' WHEN idx = 2 THEN 'DOCENTE_FORMATORE' ELSE 'PSICOLOGO_COACH' END,
        'secondaryProfessionalTypes', jsonb_build_array('CONSULENTE', 'DOCENTE_FORMATORE'),
        'atecoCode', ateco
    ) ELSE jsonb_build_object(
        'employeeRange', CASE WHEN idx = 5 THEN 'E_50_249' ELSE 'E_10_49' END,
        'revenueBand', CASE WHEN idx = 5 THEN 'R_2M_10M' ELSE 'R_500K_2M' END,
        'atecoPrimary', ateco,
        'atecoSecondary', jsonb_build_array('85.59.20', '70.22.09'),
        'operatingRegions', jsonb_build_array(jsonb_build_object('region', 'Lazio'), jsonb_build_object('region', 'Lombardia'), jsonb_build_object('region', 'Campania')),
        'regionalTrainingAccreditation', jsonb_build_object('accredited', true, 'authority', format('Regione %s', city), 'code', format('ACC-SEED-%s', idx), 'expiryDate', '2028-12-31'),
        'thirdSectorType', NULL,
        'runtsNumber', NULL
    ) END,
    true,
    true,
    NOW() - (idx || ' days')::interval,
    NOW() - ((10 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_apps;

INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    application_id,
    CASE WHEN idx = 3 THEN 'S3B' ELSE 'S3A' END,
    1,
    CASE WHEN idx = 3 THEN jsonb_build_object(
        'professionalOrder','Ordine Consulenti del Lavoro',
        'highestTitle','Laurea Magistrale',
        'studyArea','Psicologia delle organizzazioni',
        'experienceBand','Y10_15',
        'services', jsonb_build_array('Coaching individuale','Assessment HR','Consulenza organizzativa'),
        'territory', jsonb_build_object('regionsCsv','Emilia-Romagna,Lombardia,Veneto','provincesCsv','BO,MO,MI,VR'),
        'hourlyRateRange','90-140',
        'specificCertifications', jsonb_build_array('ICF Coach', 'Assessment DISC')
    ) ELSE jsonb_build_object(
        'education', jsonb_build_object('highestTitle','Laurea Magistrale','studyArea', CASE WHEN idx = 1 THEN 'Scienze della formazione' ELSE 'Ingegneria gestionale' END,'graduationYear', 2010 + idx),
        'certifications', jsonb_build_array(jsonb_build_object('name','Formatore qualificato','issuer','AIF','year',2020 + idx)),
        'competencies', jsonb_build_array(
            jsonb_build_object('theme', split_part(skills, ',', 1), 'details', skills, 'yearsBand', 'Y5_10'),
            jsonb_build_object('theme','Gestione aula', 'details','Progettazione, docenza e valutazione apprendimento', 'yearsBand','Y10_15')
        ),
        'paTeachingExperience', idx = 2,
        'consultingAreas', jsonb_build_array('Formazione','Organizzazione','Digitalizzazione'),
        'territory', jsonb_build_object('regions', jsonb_build_array('Lombardia','Piemonte','Emilia-Romagna'), 'provinces', jsonb_build_array('MI','TO','BO')),
        'languages', jsonb_build_array(jsonb_build_object('language','Italiano','qcerLevel','NATIVE'), jsonb_build_object('language','English','qcerLevel','B2')),
        'teachingLanguages', jsonb_build_array('Italiano','English'),
        'digitalTools', jsonb_build_array('Moodle','Microsoft Teams','Articulate 360'),
        'professionalNetworks', jsonb_build_array('AIF','ASFOR'),
        'availability', jsonb_build_object('travelAvailable', true, 'dailyRateRange','450-750', 'hourlyRateRange','75-130'),
        'experiences', jsonb_build_array(
            jsonb_build_object('clientName','Fondazione Demo','clientSector','Formazione','interventionType','Corso','mainTheme',split_part(skills, ',', 1),'periodFrom','2025-01-15','periodTo','2025-02-15','durationHours',32,'participantsCount',24,'deliveryMode','BLENDED','fundedIntervention',true,'fundName','Fondo Demo'),
            jsonb_build_object('clientName','Azienda Pilota','clientSector','Servizi','interventionType','Workshop','mainTheme','Competenze manageriali','periodFrom','2024-09-10','periodTo','2024-10-20','durationHours',28,'participantsCount',18,'deliveryMode','IN_PRESENCE','fundedIntervention',false,'fundName',NULL)
        )
    ) END,
    true,
    true,
    NOW() - (idx || ' days')::interval,
    NOW() - ((10 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_apps
WHERE registry_type = 'ALBO_A';

INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    application_id,
    'S3',
    1,
    jsonb_build_object(
        'servicesByCategory', jsonb_build_object(
            'CAT_A', jsonb_build_array('TRAINING_DESIGN','AULA_TRAINING','ONLINE_SYNC'),
            'CAT_B', jsonb_build_array('RECRUITING','HR_CONSULTING'),
            'CAT_C', jsonb_build_array('CUSTOM_SOFTWARE','BI_DASHBOARD','AI_AUTOMATION'),
            'CAT_D', jsonb_build_array('LEGAL','FUNDING','GDPR_231_ESG'),
            'CAT_E', jsonb_build_array('COMMUNICATION','EVENTS','FACILITY')
        ),
        'descriptionsByCategory', jsonb_build_object(
            'CAT_A', format('%s: progettazione ed erogazione corsi.', display_name),
            'CAT_B', 'Supporto HR, recruiting e consulenza organizzativa.',
            'CAT_C', 'Soluzioni digitali, dashboard e automazioni operative.',
            'CAT_D', 'Compliance, consulenza 231, privacy e finanza agevolata.',
            'CAT_E', 'Eventi, comunicazione e servizi operativi di supporto.'
        )
    ),
    true,
    true,
    NOW() - (idx || ' days')::interval,
    NOW() - ((10 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_apps
WHERE registry_type = 'ALBO_B';

INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    application_id,
    'S4',
    1,
    CASE WHEN registry_type = 'ALBO_A' THEN jsonb_build_object(
        'operationalCapacity', format('%s opera con disponibilita nazionale e sessioni online/presenza.', display_name),
        'references', jsonb_build_array(
            jsonb_build_object('fullName','Laura Conti','organizationRole','Responsabile Formazione','email','laura.conti@example.com','phone','+39 333 1111111'),
            jsonb_build_object('fullName','Andrea Galli','organizationRole','Direttore HR','email','andrea.galli@example.com','phone','+39 333 2222222')
        ),
        'attachments', jsonb_build_array(
            jsonb_build_object('documentType','CV','fileName',format('cv_%s.pdf', email_slug),'mimeType','application/pdf','sizeBytes',245000,'storageKey',format('seed-candidature/%s-cv.pdf', email_slug),'uploadedAt', NOW()::text, 'expiresAt', '2028-12-31T00:00:00'),
            jsonb_build_object('documentType','OTHER','fileName','brufen-upload.png','mimeType','image/png','sizeBytes',119313,'storageKey','seed-candidature/brufen-upload.png','uploadedAt', NOW()::text)
        )
    ) ELSE jsonb_build_object(
        'iso9001', 'YES',
        'accreditationSummary', format('%s possiede accreditamenti e documenti amministrativi aggiornati.', display_name),
        'accreditations', jsonb_build_array(jsonb_build_object('type','REGIONAL_TRAINING','authority',format('Regione %s', city),'code',format('ACC-SEED-%s', idx),'expiryDate','2028-12-31')),
        'attachments', jsonb_build_array(
            jsonb_build_object('documentType','VISURA_CAMERALE','fileName',format('visura_%s.pdf', email_slug),'mimeType','application/pdf','sizeBytes',325000,'storageKey',format('seed-candidature/%s-visura.pdf', email_slug),'uploadedAt', NOW()::text, 'expiresAt', '2028-12-31T00:00:00'),
            jsonb_build_object('documentType','DURC','fileName',format('durc_%s.pdf', email_slug),'mimeType','application/pdf','sizeBytes',175000,'storageKey',format('seed-candidature/%s-durc.pdf', email_slug),'uploadedAt', NOW()::text, 'expiresAt', '2027-12-31T00:00:00'),
            jsonb_build_object('documentType','CERTIFICATION','fileName',format('iso9001_%s.pdf', email_slug),'mimeType','application/pdf','sizeBytes',110000,'storageKey',format('seed-candidature/%s-iso9001.pdf', email_slug),'uploadedAt', NOW()::text, 'expiresAt', '2028-12-31T00:00:00'),
            jsonb_build_object('documentType','OTHER','fileName','brufen-upload.png','mimeType','image/png','sizeBytes',119313,'storageKey','seed-candidature/brufen-upload.png','uploadedAt', NOW()::text)
        )
    ) END,
    true,
    true,
    NOW() - (idx || ' days')::interval,
    NOW() - ((10 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_apps;

INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    application_id,
    'S5',
    1,
    CASE WHEN registry_type = 'ALBO_A' THEN jsonb_build_object(
        'noCriminalConvictions', true,
        'noConflictOfInterest', true,
        'truthfulnessDeclaration', true,
        'privacyAccepted', true,
        'ethicalCodeAccepted', true,
        'qualityEnvSafetyAccepted', true,
        'alboDataProcessingConsent', true,
        'marketingConsent', idx = 1,
        'dlgs81ComplianceWhenInPresence', true,
        'otpVerified', true
    ) ELSE jsonb_build_object(
        'antimafiaDeclaration', true,
        'dlgs231Declaration', true,
        'model231Adopted', idx = 5,
        'fiscalContributionRegularity', true,
        'gdprComplianceAndDpo', true,
        'truthfulnessDeclaration', true,
        'noConflictOfInterest', true,
        'noCriminalConvictions', true,
        'privacyAccepted', true,
        'ethicalCodeAccepted', true,
        'qualityEnvSafetyAccepted', true,
        'alboDataProcessingConsent', true,
        'marketingConsent', idx = 4,
        'otpVerified', true
    ) END,
    true,
    true,
    NOW() - (idx || ' days')::interval,
    NOW() - ((10 - idx) || ' days')::interval,
    NOW()
FROM tmp_seedcand_apps;

INSERT INTO application_attachments (
    application_id, section_key, field_key, document_type, file_name,
    mime_type, size_bytes, storage_key, uploaded_at, expires_at
)
SELECT
    s.application_id,
    'S4',
    NULL,
    CASE
        WHEN UPPER(item->>'documentType') IN ('CV','VISURA_CAMERALE','DURC','COMPANY_PROFILE','CERTIFICATION','OTHER')
        THEN UPPER(item->>'documentType')
        ELSE 'OTHER'
    END,
    item->>'fileName',
    item->>'mimeType',
    (item->>'sizeBytes')::bigint,
    item->>'storageKey',
    NOW() - interval '1 day',
    CASE WHEN COALESCE(item->>'expiresAt','') = '' THEN NULL ELSE (item->>'expiresAt')::timestamp END
FROM application_sections s
CROSS JOIN LATERAL jsonb_array_elements(s.payload_json->'attachments') item
WHERE s.section_key = 'S4'
  AND s.application_id IN (SELECT application_id FROM tmp_seedcand_apps);

INSERT INTO otp_challenges (
    application_id, user_id, challenge_type, target_email, otp_hash,
    attempts, max_attempts, expires_at, verified_at, status, created_at
)
SELECT
    application_id,
    user_id,
    'EMAIL_VERIFY',
    email,
    format('seedcand-email-hash-%s', idx),
    0,
    5,
    NOW() + interval '15 minutes',
    NOW() - interval '5 minutes',
    'VERIFIED',
    NOW() - (idx || ' days')::interval
FROM tmp_seedcand_apps;

INSERT INTO otp_challenges (
    application_id, user_id, challenge_type, target_email, otp_hash,
    attempts, max_attempts, expires_at, verified_at, status, created_at
)
SELECT
    application_id,
    user_id,
    'DECLARATION_SIGNATURE',
    email,
    format('seedcand-sign-hash-%s', idx),
    0,
    5,
    NOW() + interval '20 minutes',
    NOW() - interval '4 minutes',
    'VERIFIED',
    NOW() - (idx || ' days')::interval
FROM tmp_seedcand_apps;

INSERT INTO review_cases (
    application_id, status, assigned_to_user_id, assigned_at,
    decision, decision_reason, decided_by_user_id, decided_at,
    sla_due_at, created_at, updated_at
)
SELECT
    application_id,
    'PENDING_ASSIGNMENT',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NOW() + ((7 - idx) || ' days')::interval,
    NOW() - (idx || ' days')::interval,
    NOW() - (idx || ' hours')::interval
FROM tmp_seedcand_apps;

INSERT INTO audit_events (
    event_key, entity_type, entity_id, actor_user_id, actor_roles,
    request_id, reason, before_state_json, after_state_json, metadata_json, occurred_at
)
SELECT
    'revamp.application.submitted',
    'REVAMP_APPLICATION',
    application_id,
    user_id,
    'SUPPLIER',
    format('seedcand-%s', idx),
    'Candidatura demo completa caricata da seed.',
    '{"status":"DRAFT"}'::jsonb,
    jsonb_build_object('status','SUBMITTED','protocolCode',protocol_code),
    jsonb_build_object('applicantName', display_name, 'registryType', registry_type),
    NOW() - (idx || ' days')::interval
FROM tmp_seedcand_apps;

COMMIT;
