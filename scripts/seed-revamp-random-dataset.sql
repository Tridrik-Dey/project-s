BEGIN;

-- =============================================================
-- REVAMP RANDOM DATASET SEED (revamp DB only)
-- Marker prefix: seedrv.
-- Safe to rerun: removes only rows previously seeded by this script.
-- =============================================================

-- -------------------------
-- Cleanup previous seed rows
-- -------------------------
DELETE FROM evaluation_dimensions WHERE evaluation_id IN (
    SELECT id FROM evaluations WHERE reference_code LIKE 'SEED-RV-%'
);

DELETE FROM evaluations WHERE reference_code LIKE 'SEED-RV-%';

DELETE FROM integration_requests WHERE review_case_id IN (
    SELECT id FROM review_cases WHERE application_id IN (
        SELECT id FROM applications WHERE applicant_user_id IN (
            SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
        )
    )
);

DELETE FROM review_cases WHERE application_id IN (
    SELECT id FROM applications WHERE applicant_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
    )
);

DELETE FROM otp_challenges WHERE application_id IN (
    SELECT id FROM applications WHERE applicant_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
    )
) OR user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
);

DELETE FROM application_attachments WHERE application_id IN (
    SELECT id FROM applications WHERE applicant_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
    )
);

DELETE FROM application_sections WHERE application_id IN (
    SELECT id FROM applications WHERE applicant_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
    )
);

DELETE FROM audit_events WHERE request_id LIKE 'seedrv-%' OR actor_user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
);

DELETE FROM notification_events WHERE provider_message_id LIKE 'seedrv-%' OR recipient LIKE 'seedrv.%@example.com';

DELETE FROM supplier_registry_profile_details WHERE profile_id IN (
    SELECT id FROM supplier_registry_profiles WHERE supplier_user_id IN (
        SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
    )
);

DELETE FROM supplier_registry_profiles WHERE supplier_user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
);

DELETE FROM applications WHERE applicant_user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
);

DELETE FROM invites WHERE invited_email LIKE 'seedrv.%@example.com' OR token LIKE 'seedrv-%';

DELETE FROM supplier_profiles WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
);

DELETE FROM user_admin_roles WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE 'seedrv.%@example.com'
);

DELETE FROM users WHERE email LIKE 'seedrv.%@example.com';

-- -------------------------
-- Seed admin users (evaluators + governance)
-- -------------------------
WITH admin_src AS (
    SELECT * FROM (VALUES
        (1, 'seedrv.admin.super@example.com', 'Seedrv Super Admin', 'SUPER_ADMIN'),
        (2, 'seedrv.admin.resp@example.com',  'Seedrv Responsabile Albo', 'RESPONSABILE_ALBO'),
        (3, 'seedrv.admin.rev1@example.com',  'Seedrv Revisore 1', 'REVISORE'),
        (4, 'seedrv.admin.rev2@example.com',  'Seedrv Revisore 2', 'REVISORE'),
        (5, 'seedrv.admin.view@example.com',  'Seedrv Viewer', 'VIEWER'),
        (6, 'seedrv.admin.ops@example.com',   'Seedrv Admin Ops', 'RESPONSABILE_ALBO')
    ) AS t(idx, email, full_name, admin_role)
), inserted AS (
    INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at)
    SELECT email, 'seedrv-hash', full_name, 'ADMIN', true, NOW() - (idx || ' days')::interval, NOW()
    FROM admin_src
    RETURNING id, email
)
INSERT INTO user_admin_roles (user_id, admin_role, created_by_user_id, created_at)
SELECT u.id, s.admin_role, u.id, NOW()
FROM inserted u
JOIN admin_src s ON s.email = u.email;

-- -------------------------
-- Seed supplier source rows
-- -------------------------
CREATE TEMP TABLE tmp_seed_supplier_src AS
SELECT
    gs AS idx,
    format('seedrv.supplier%03s@example.com', gs) AS email,
    format('Seedrv Supplier %s', gs) AS full_name,
    CASE WHEN gs % 2 = 0 THEN 'ALBO_A' ELSE 'ALBO_B' END AS registry_type,
    CASE
        WHEN gs % 9 = 0 THEN 'DRAFT'
        WHEN gs % 8 = 0 THEN 'INTEGRATION_REQUIRED'
        WHEN gs % 7 = 0 THEN 'UNDER_REVIEW'
        WHEN gs % 6 = 0 THEN 'SUBMITTED'
        ELSE 'APPROVED'
    END AS app_status,
    CASE
        WHEN gs % 5 = 0 THEN 'PENDING'
        WHEN gs % 11 = 0 THEN 'REJECTED'
        ELSE 'ACTIVE'
    END AS supplier_status
FROM generate_series(1, 180) gs;

-- -------------------------
-- Insert supplier users
-- -------------------------
INSERT INTO users (email, password_hash, full_name, role, is_active, created_at, updated_at)
SELECT
    s.email,
    'seedrv-hash',
    s.full_name,
    'SUPPLIER',
    true,
    NOW() - (s.idx || ' days')::interval,
    NOW() - ((s.idx % 10) || ' hours')::interval
FROM tmp_seed_supplier_src s;

CREATE TEMP TABLE tmp_seed_supplier_users AS
SELECT s.*, u.id AS user_id
FROM tmp_seed_supplier_src s
JOIN users u ON u.email = s.email;

-- -------------------------
-- Insert supplier_profiles (legacy-compatible table used by KPI)
-- -------------------------
INSERT INTO supplier_profiles (
    user_id, status, company_name, trading_name, company_type,
    registration_number, vat_number, tax_id, country_of_incorporation,
    incorporation_date, website, description, employee_count_range,
    annual_revenue_range, address_line1, address_line2, city,
    state_province, postal_code, country, submitted_at, is_critical_edit_pending,
    preferred_language, created_at, updated_at
)
SELECT
    su.user_id,
    su.supplier_status,
    CASE WHEN su.registry_type = 'ALBO_A' THEN format('Professionista %s', su.idx) ELSE format('Azienda %s SRL', su.idx) END,
    format('Trade %s', su.idx),
    (ARRAY['LLC','SOLE_TRADER','PARTNERSHIP','CORPORATION','NON_PROFIT','OTHER'])[(su.idx % 6) + 1],
    format('REG-%s', 100000 + su.idx),
    format('IT%011s', 90000000000 + su.idx),
    format('TAX%08s', 10000000 + su.idx),
    'IT',
    (DATE '2010-01-01' + ((su.idx % 4000)::int)),
    format('https://seedrv-%s.example.com', su.idx),
    format('Profilo seed revamp %s', su.idx),
    (ARRAY['MICRO','SMALL','MEDIUM','LARGE'])[(su.idx % 4) + 1],
    (ARRAY['UNDER_100K','_100K_500K','_500K_1M','_1M_5M','ABOVE_5M'])[(su.idx % 5) + 1],
    format('Via Seed %s', su.idx),
    format('Scala %s', (su.idx % 4) + 1),
    (ARRAY['Milano','Roma','Torino','Bologna','Bergamo','Napoli'])[(su.idx % 6) + 1],
    (ARRAY['MI','RM','TO','BO','BG','NA'])[(su.idx % 6) + 1],
    format('%05s', 20000 + su.idx),
    'Italia',
    NOW() - ((su.idx % 90) || ' days')::interval,
    false,
    'IT',
    NOW() - ((su.idx % 180) || ' days')::interval,
    NOW() - ((su.idx % 10) || ' days')::interval
FROM tmp_seed_supplier_users su;

CREATE TEMP TABLE tmp_seed_supplier_profiles AS
SELECT su.idx, su.user_id, su.registry_type, su.app_status, su.supplier_status, sp.id AS supplier_profile_id
FROM tmp_seed_supplier_users su
JOIN supplier_profiles sp ON sp.user_id = su.user_id;

-- -------------------------
-- Insert invites
-- -------------------------
WITH admin_pick AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
    FROM users
    WHERE email LIKE 'seedrv.admin.%@example.com'
)
INSERT INTO invites (
    registry_type, invited_email, invited_name, token, status, source_user_id,
    expires_at, consumed_at, renewed_from_invite_id, note, created_at, updated_at
)
SELECT
    sp.registry_type,
    su.email,
    su.full_name,
    format('seedrv-invite-%s', sp.idx),
    CASE WHEN sp.idx % 6 = 0 THEN 'CONSUMED' WHEN sp.idx % 5 = 0 THEN 'EXPIRED' ELSE 'SENT' END,
    ap.id,
    NOW() + ((sp.idx % 30) + 5 || ' days')::interval,
    CASE WHEN sp.idx % 6 = 0 THEN NOW() - ((sp.idx % 20) || ' days')::interval ELSE NULL END,
    NULL,
    format('Seed invite %s', sp.idx),
    NOW() - ((sp.idx % 60) || ' days')::interval,
    NOW() - ((sp.idx % 10) || ' days')::interval
FROM tmp_seed_supplier_profiles sp
JOIN tmp_seed_supplier_users su ON su.idx = sp.idx
JOIN admin_pick ap ON ap.rn = ((sp.idx - 1) % 6) + 1;

CREATE TEMP TABLE tmp_seed_invites AS
SELECT i.id, su.idx
FROM invites i
JOIN tmp_seed_supplier_users su ON su.email = i.invited_email
WHERE i.token LIKE 'seedrv-invite-%';

-- -------------------------
-- Insert applications
-- -------------------------
INSERT INTO applications (
    applicant_user_id, invite_id, registry_type, source_channel, status,
    protocol_code, current_revision, submitted_at, approved_at,
    rejected_at, suspended_at, renewal_due_at, legacy_supplier_profile_id,
    created_at, updated_at
)
SELECT
    sp.user_id,
    ti.id,
    sp.registry_type,
    CASE WHEN sp.idx % 3 = 0 THEN 'PUBLIC' ELSE 'INVITE' END,
    sp.app_status,
    CASE WHEN sp.app_status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED')
         THEN format('PRT-%s', 500000 + sp.idx) ELSE NULL END,
    1,
    CASE WHEN sp.app_status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED')
         THEN NOW() - ((sp.idx % 80) || ' days')::interval ELSE NULL END,
    CASE WHEN sp.app_status = 'APPROVED' THEN NOW() - ((sp.idx % 50) || ' days')::interval ELSE NULL END,
    CASE WHEN sp.app_status = 'REJECTED' THEN NOW() - ((sp.idx % 40) || ' days')::interval ELSE NULL END,
    NULL,
    CASE WHEN sp.idx % 14 = 0 THEN NOW() + ((sp.idx % 120) || ' days')::interval ELSE NULL END,
    sp.supplier_profile_id,
    NOW() - ((sp.idx % 120) || ' days')::interval,
    NOW() - ((sp.idx % 7) || ' days')::interval
FROM tmp_seed_supplier_profiles sp
LEFT JOIN tmp_seed_invites ti ON ti.idx = sp.idx;

CREATE TEMP TABLE tmp_seed_apps AS
SELECT a.id AS application_id, sp.*
FROM applications a
JOIN tmp_seed_supplier_profiles sp ON sp.user_id = a.applicant_user_id;

-- -------------------------
-- Insert application sections (complete, JSONB)
-- -------------------------
-- S1
INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    ta.application_id,
    'S1',
    1,
    CASE
      WHEN ta.registry_type = 'ALBO_A' THEN jsonb_build_object(
          'firstName', format('Nome%s', ta.idx),
          'lastName', format('Cognome%s', ta.idx),
          'birthDate', '1988-01-15',
          'birthPlace', 'Milano',
          'taxCode', format('RSSMRA%08s', 10000000 + ta.idx),
          'vatNumber', format('IT%011s', 70000000000 + ta.idx),
          'taxRegime', 'ORDINARIO',
          'addressLine', format('Via Professionista %s', ta.idx),
          'city', 'Milano',
          'postalCode', '20100',
          'province', 'MI',
          'phone', format('+39 333 10%03s', ta.idx),
          'secondaryPhone', format('+39 333 20%03s', ta.idx),
          'email', format('seedrv.supplier%03s@example.com', ta.idx),
          'secondaryEmail', format('alt.seedrv%03s@example.com', ta.idx),
          'pec', format('seedrv%03s@pec.example.com', ta.idx),
          'website', format('https://seedrv-prof-%s.example.com', ta.idx),
          'linkedin', format('https://linkedin.example.com/in/seedrv-%s', ta.idx),
          'profilePhotoAttachment', jsonb_build_object(
              'documentType','OTHER',
              'fileName', format('profile_%s.jpg', ta.idx),
              'mimeType','image/jpeg',
              'sizeBytes', 152000,
              'storageKey', format('seedrv/profile/%s.jpg', ta.idx)
          )
      )
      ELSE jsonb_build_object(
          'companyName', format('Azienda %s SRL', ta.idx),
          'legalForm', 'SRL',
          'vatNumber', format('IT%011s', 80000000000 + ta.idx),
          'taxCodeIfDifferent', format('TX%08s', 20000000 + ta.idx),
          'reaNumber', format('REA-%s', 300000 + ta.idx),
          'cciaaProvince', 'MI',
          'incorporationDate', '2012-05-10',
          'legalAddress', jsonb_build_object('street', format('Via Impresa %s', ta.idx), 'city', 'Milano', 'cap', '20100', 'province', 'MI'),
          'operationalHeadquarter', jsonb_build_object('street', format('Via Operativa %s', ta.idx), 'city', 'Monza', 'postalCode', '20900', 'province', 'MB'),
          'institutionalEmail', format('seedrv.supplier%03s@example.com', ta.idx),
          'pec', format('azienda%03s@pec.example.com', ta.idx),
          'phone', format('+39 02 55%04s', ta.idx),
          'website', format('https://seedrv-company-%s.example.com', ta.idx),
          'legalRepresentative', jsonb_build_object('name', format('Legale %s', ta.idx), 'taxCode', format('LGL%08s', 50000000 + ta.idx), 'role', 'Amministratore Unico'),
          'operationalContact', jsonb_build_object('name', format('Operativo %s', ta.idx), 'role', 'Responsabile commerciale', 'email', format('ops%03s@example.com', ta.idx), 'phone', format('+39 345 77%03s', ta.idx))
      )
    END,
    true,
    true,
    NOW() - ((ta.idx % 20) || ' days')::interval,
    NOW() - ((ta.idx % 30) || ' days')::interval,
    NOW() - ((ta.idx % 7) || ' days')::interval
FROM tmp_seed_apps ta;

-- S2
INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    ta.application_id,
    'S2',
    1,
    CASE
      WHEN ta.registry_type = 'ALBO_A' THEN jsonb_build_object(
          'professionalType', CASE WHEN ta.idx % 3 = 0 THEN 'DOCENTE_FORMATORE' WHEN ta.idx % 3 = 1 THEN 'CONSULENTE' ELSE 'PSICOLOGO_COACH' END,
          'secondaryProfessionalTypes', jsonb_build_array('CONSULENTE'),
          'atecoCode', '85.59.20'
      )
      ELSE jsonb_build_object(
          'employeeRange', CASE WHEN ta.idx % 4 = 0 THEN 'E_1_9' WHEN ta.idx % 4 = 1 THEN 'E_10_49' WHEN ta.idx % 4 = 2 THEN 'E_50_249' ELSE 'E_250_PLUS' END,
          'revenueBand', CASE WHEN ta.idx % 5 = 0 THEN 'R_LT_100K' WHEN ta.idx % 5 = 1 THEN 'R_100K_500K' WHEN ta.idx % 5 = 2 THEN 'R_500K_2M' WHEN ta.idx % 5 = 3 THEN 'R_2M_10M' ELSE 'R_GT_10M' END,
          'atecoPrimary', '70.22.09',
          'atecoSecondary', jsonb_build_array('85.59.20','62.01.00'),
          'operatingRegions', jsonb_build_array(jsonb_build_object('region','Lombardia'), jsonb_build_object('region','Piemonte')),
          'regionalTrainingAccreditation', jsonb_build_object('accredited', true, 'authority', 'Regione Lombardia', 'code', format('ACC-%s', ta.idx), 'expiryDate', '2028-12-31'),
          'thirdSectorType', CASE WHEN ta.idx % 10 = 0 THEN 'ETS' ELSE NULL END,
          'runtsNumber', CASE WHEN ta.idx % 10 = 0 THEN format('RUNTS-%s', ta.idx) ELSE NULL END
      )
    END,
    true,
    true,
    NOW() - ((ta.idx % 20) || ' days')::interval,
    NOW() - ((ta.idx % 30) || ' days')::interval,
    NOW() - ((ta.idx % 7) || ' days')::interval
FROM tmp_seed_apps ta;

-- S3A for ALBO_A even idx
INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    ta.application_id,
    'S3A',
    1,
    jsonb_build_object(
        'education', jsonb_build_object('highestTitle','Laurea Magistrale','studyArea','Psicologia del lavoro','graduationYear',2012),
        'certifications', jsonb_build_array(jsonb_build_object('name','AIF','issuer','AIF','year',2020)),
        'competencies', jsonb_build_array(
            jsonb_build_object('theme','Digital Learning','details','LMS, SCORM, authoring','yearsBand','Y5_10'),
            jsonb_build_object('theme','Soft Skills','details','Leadership e team coaching','yearsBand','Y10_15')
        ),
        'paTeachingExperience', (ta.idx % 4 = 0),
        'consultingAreas', jsonb_build_array('HR','Formazione'),
        'territory', jsonb_build_object('regions', jsonb_build_array('Lombardia','Piemonte'), 'provinces', jsonb_build_array('MI','TO')),
        'languages', jsonb_build_array(jsonb_build_object('language','Italiano','qcerLevel','NATIVE'), jsonb_build_object('language','English','qcerLevel','B2')),
        'teachingLanguages', jsonb_build_array('Italiano','English'),
        'digitalTools', jsonb_build_array('Moodle','Teams','Articulate'),
        'professionalNetworks', jsonb_build_array('AIF','ASFOR'),
        'availability', jsonb_build_object('travelAvailable', true, 'dailyRateRange','400-700', 'hourlyRateRange','70-120'),
        'experiences', jsonb_build_array(
            jsonb_build_object('clientName','Cliente Uno','clientSector','Servizi','interventionType','Corso','mainTheme','Soft Skills','periodFrom','2025-02-01','periodTo','2025-02-10','durationHours',24,'participantsCount',20,'deliveryMode','BLENDED','fundedIntervention',false,'fundName',null),
            jsonb_build_object('clientName','Cliente Due','clientSector','Industria','interventionType','Academy','mainTheme','Digital Learning','periodFrom','2024-09-01','periodTo','2024-09-30','durationHours',32,'participantsCount',35,'deliveryMode','IN_PRESENCE','fundedIntervention',true,'fundName','FSE')
        )
    ),
    true,
    true,
    NOW() - ((ta.idx % 18) || ' days')::interval,
    NOW() - ((ta.idx % 28) || ' days')::interval,
    NOW() - ((ta.idx % 6) || ' days')::interval
FROM tmp_seed_apps ta
WHERE ta.registry_type = 'ALBO_A' AND ta.idx % 2 = 0;

-- S3B for ALBO_A odd idx
INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    ta.application_id,
    'S3B',
    1,
    jsonb_build_object(
        'professionalOrder','Ordine Consulenti',
        'highestTitle','Laurea',
        'studyArea','Economia',
        'experienceBand','Y5_10',
        'services', jsonb_build_array('Consulenza organizzativa','Supporto HR'),
        'territory', jsonb_build_object('regionsCsv','Lombardia,Veneto','provincesCsv','MI,BG,VR'),
        'hourlyRateRange','60-100',
        'specificCertifications', jsonb_build_array('ISO 9001 Lead Auditor')
    ),
    true,
    true,
    NOW() - ((ta.idx % 18) || ' days')::interval,
    NOW() - ((ta.idx % 28) || ' days')::interval,
    NOW() - ((ta.idx % 6) || ' days')::interval
FROM tmp_seed_apps ta
WHERE ta.registry_type = 'ALBO_A' AND ta.idx % 2 = 1;

-- S3 for ALBO_B
INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    ta.application_id,
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
            'CAT_A', 'Progettazione ed erogazione percorsi formativi.',
            'CAT_B', 'Servizi HR e organizzazione.',
            'CAT_C', 'Soluzioni digitali e BI.',
            'CAT_D', 'Compliance e consulenza legale/fiscale.',
            'CAT_E', 'Servizi generali di supporto.'
        )
    ),
    true,
    true,
    NOW() - ((ta.idx % 18) || ' days')::interval,
    NOW() - ((ta.idx % 28) || ' days')::interval,
    NOW() - ((ta.idx % 6) || ' days')::interval
FROM tmp_seed_apps ta
WHERE ta.registry_type = 'ALBO_B';

-- S4
INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    ta.application_id,
    'S4',
    1,
    CASE
      WHEN ta.registry_type = 'ALBO_A' THEN jsonb_build_object(
          'operationalCapacity', 'Capacita operativa completa',
          'references', jsonb_build_array(
              jsonb_build_object('fullName','Ref Uno','organizationRole','HR Manager','email','ref1@example.com','phone','+39 333 1111111'),
              jsonb_build_object('fullName','Ref Due','organizationRole','Direttore','email','ref2@example.com','phone','+39 333 2222222')
          ),
          'attachments', jsonb_build_array(
              jsonb_build_object('documentType','CV','fileName',format('cv_%s.pdf', ta.idx),'mimeType','application/pdf','sizeBytes',245000,'storageKey',format('seedrv/docs/%s/cv.pdf', ta.idx),'uploadedAt', NOW()::text)
          )
      )
      ELSE jsonb_build_object(
          'iso9001', 'YES',
          'accreditationSummary', 'Accreditata Regione Lombardia',
          'accreditations', jsonb_build_array(jsonb_build_object('type','REGIONAL_TRAINING','authority','Regione Lombardia','code',format('ACCR-%s', ta.idx),'expiryDate','2028-12-31')),
          'attachments', jsonb_build_array(
              jsonb_build_object('documentType','VISURA_CAMERALE','fileName',format('visura_%s.pdf', ta.idx),'mimeType','application/pdf','sizeBytes',325000,'storageKey',format('seedrv/docs/%s/visura.pdf', ta.idx),'uploadedAt', NOW()::text),
              jsonb_build_object('documentType','DURC','fileName',format('durc_%s.pdf', ta.idx),'mimeType','application/pdf','sizeBytes',175000,'storageKey',format('seedrv/docs/%s/durc.pdf', ta.idx),'uploadedAt', NOW()::text),
              jsonb_build_object('documentType','CERTIFICATION','fileName',format('iso9001_%s.pdf', ta.idx),'mimeType','application/pdf','sizeBytes',110000,'storageKey',format('seedrv/docs/%s/iso9001.pdf', ta.idx),'uploadedAt', NOW()::text)
          )
      )
    END,
    true,
    true,
    NOW() - ((ta.idx % 18) || ' days')::interval,
    NOW() - ((ta.idx % 28) || ' days')::interval,
    NOW() - ((ta.idx % 6) || ' days')::interval
FROM tmp_seed_apps ta;

-- S5
INSERT INTO application_sections (application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at)
SELECT
    ta.application_id,
    'S5',
    1,
    CASE
      WHEN ta.registry_type = 'ALBO_A' THEN jsonb_build_object(
          'noCriminalConvictions', true,
          'noConflictOfInterest', true,
          'truthfulnessDeclaration', true,
          'privacyAccepted', true,
          'ethicalCodeAccepted', true,
          'qualityEnvSafetyAccepted', true,
          'alboDataProcessingConsent', true,
          'marketingConsent', (ta.idx % 3 = 0),
          'dlgs81ComplianceWhenInPresence', true,
          'otpVerified', true
      )
      ELSE jsonb_build_object(
          'antimafiaDeclaration', true,
          'dlgs231Declaration', true,
          'model231Adopted', (ta.idx % 4 = 0),
          'fiscalContributionRegularity', true,
          'gdprComplianceAndDpo', true,
          'truthfulnessDeclaration', true,
          'noConflictOfInterest', true,
          'noCriminalConvictions', true,
          'privacyAccepted', true,
          'ethicalCodeAccepted', true,
          'qualityEnvSafetyAccepted', true,
          'alboDataProcessingConsent', true,
          'marketingConsent', (ta.idx % 3 = 0),
          'otpVerified', true
      )
    END,
    true,
    true,
    NOW() - ((ta.idx % 18) || ' days')::interval,
    NOW() - ((ta.idx % 28) || ' days')::interval,
    NOW() - ((ta.idx % 6) || ' days')::interval
FROM tmp_seed_apps ta;

-- -------------------------
-- Insert attachment rows from sections
-- -------------------------
INSERT INTO application_attachments (
    application_id, section_key, field_key, document_type, file_name,
    mime_type, size_bytes, storage_key, uploaded_at, expires_at
)
SELECT
    s.application_id,
    'S4',
    NULLIF(TRIM(item->>'fieldKey'),''),
    CASE
      WHEN UPPER(COALESCE(item->>'documentType','')) IN ('CV','VISURA_CAMERALE','DURC','COMPANY_PROFILE','CERTIFICATION','OTHER')
      THEN UPPER(item->>'documentType')
      ELSE 'OTHER'
    END,
    COALESCE(NULLIF(TRIM(item->>'fileName'),''),'attachment.bin'),
    NULLIF(TRIM(item->>'mimeType'),''),
    CASE WHEN COALESCE(item->>'sizeBytes','') ~ '^[0-9]+$' THEN (item->>'sizeBytes')::bigint ELSE NULL END,
    COALESCE(NULLIF(TRIM(item->>'storageKey'),''), format('seedrv/docs/%s/other.bin', s.application_id::text)),
    NOW() - (random() * interval '120 days'),
    NOW() + (random() * interval '365 days')
FROM application_sections s
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload_json->'attachments','[]'::jsonb)) item
WHERE s.section_key = 'S4'
  AND s.application_id IN (SELECT application_id FROM tmp_seed_apps);

-- -------------------------
-- Insert OTP challenges
-- -------------------------
INSERT INTO otp_challenges (
    application_id, user_id, challenge_type, target_email, otp_hash,
    attempts, max_attempts, expires_at, verified_at, status, created_at
)
SELECT
    ta.application_id,
    ta.user_id,
    'EMAIL_VERIFY',
    su.email,
    format('hash-seedrv-email-%s', ta.idx),
    0,
    5,
    NOW() + interval '15 minutes',
    NOW() - interval '1 minute',
    'VERIFIED',
    NOW() - ((ta.idx % 120) || ' days')::interval
FROM tmp_seed_apps ta
JOIN tmp_seed_supplier_users su ON su.idx = ta.idx;

INSERT INTO otp_challenges (
    application_id, user_id, challenge_type, target_email, otp_hash,
    attempts, max_attempts, expires_at, verified_at, status, created_at
)
SELECT
    ta.application_id,
    ta.user_id,
    'DECLARATION_SIGNATURE',
    su.email,
    format('hash-seedrv-sign-%s', ta.idx),
    0,
    5,
    NOW() + interval '20 minutes',
    NOW() - interval '1 minute',
    'VERIFIED',
    NOW() - ((ta.idx % 110) || ' days')::interval
FROM tmp_seed_apps ta
JOIN tmp_seed_supplier_users su ON su.idx = ta.idx;

-- -------------------------
-- Insert review cases
-- -------------------------
WITH admins AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
    FROM users
    WHERE email LIKE 'seedrv.admin.%@example.com'
), base AS (
    SELECT
        ta.*,
        CASE
            WHEN ta.app_status = 'INTEGRATION_REQUIRED' THEN 'WAITING_SUPPLIER_RESPONSE'
            WHEN ta.app_status IN ('SUBMITTED','UNDER_REVIEW') THEN 'IN_PROGRESS'
            ELSE 'DECIDED'
        END AS case_status,
        CASE
            WHEN ta.app_status = 'APPROVED' THEN 'APPROVED'
            WHEN ta.app_status = 'REJECTED' THEN 'REJECTED'
            WHEN ta.app_status = 'INTEGRATION_REQUIRED' THEN 'INTEGRATION_REQUIRED'
            ELSE NULL
        END AS decision
    FROM tmp_seed_apps ta
)
INSERT INTO review_cases (
    application_id, status, assigned_to_user_id, assigned_at,
    decision, decision_reason, decided_by_user_id, decided_at,
    sla_due_at, created_at, updated_at
)
SELECT
    b.application_id,
    b.case_status,
    a.id,
    NOW() - ((b.idx % 30) || ' days')::interval,
    b.decision,
    CASE WHEN b.decision IS NOT NULL THEN format('Decisione seed %s', b.idx) ELSE NULL END,
    CASE WHEN b.decision IS NOT NULL THEN a.id ELSE NULL END,
    CASE WHEN b.decision IS NOT NULL THEN NOW() - ((b.idx % 20) || ' days')::interval ELSE NULL END,
    NOW() + ((b.idx % 10) || ' days')::interval,
    NOW() - ((b.idx % 40) || ' days')::interval,
    NOW() - ((b.idx % 5) || ' days')::interval
FROM base b
JOIN admins a ON a.rn = ((b.idx - 1) % 6) + 1
WHERE b.app_status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED');

-- -------------------------
-- Insert integration requests
-- -------------------------
INSERT INTO integration_requests (
    review_case_id, requested_by_user_id, due_at, request_message,
    requested_items_json, supplier_response_json, supplier_responded_at,
    status, created_at, updated_at
)
SELECT
    rc.id,
    rc.assigned_to_user_id,
    NOW() + ((row_number() OVER (ORDER BY rc.created_at) % 12 + 2) || ' days')::interval,
    'Integrare documentazione e dettagliare competenze.',
    jsonb_build_array(
        jsonb_build_object('code','DOC_ID','label','Documento di identita','instruction','Allegare PDF leggibile'),
        jsonb_build_object('code','THEMATIC_SPEC','label','Specifica tematiche','instruction','Dettagliare esperienze per area')
    ),
    NULL,
    NULL,
    'OPEN',
    NOW() - ((row_number() OVER (ORDER BY rc.created_at) % 20) || ' days')::interval,
    NOW() - ((row_number() OVER (ORDER BY rc.created_at) % 3) || ' days')::interval
FROM review_cases rc
JOIN applications a ON a.id = rc.application_id
WHERE a.status = 'INTEGRATION_REQUIRED';

-- -------------------------
-- Insert supplier registry profiles (revamp)
-- -------------------------
INSERT INTO supplier_registry_profiles (
    application_id, supplier_user_id, registry_type, status,
    display_name, public_summary, aggregate_score, is_visible,
    approved_at, expires_at, created_at, updated_at
)
SELECT
    ta.application_id,
    ta.user_id,
    ta.registry_type,
    CASE
        WHEN ta.idx % 15 = 0 THEN 'SUSPENDED'
        WHEN ta.idx % 11 = 0 THEN 'RENEWAL_DUE'
        WHEN ta.idx % 19 = 0 THEN 'ARCHIVED'
        ELSE 'APPROVED'
    END,
    CASE WHEN ta.registry_type='ALBO_A' THEN format('Professionista %s', ta.idx) ELSE format('Azienda %s SRL', ta.idx) END,
    format('Profilo registro seed revamp %s', ta.idx),
    ROUND((3.4 + (ta.idx % 15) * 0.1)::numeric, 2),
    CASE WHEN ta.idx % 19 = 0 THEN false ELSE true END,
    NOW() - ((ta.idx % 100) || ' days')::interval,
    NOW() + ((ta.idx % 400) || ' days')::interval,
    NOW() - ((ta.idx % 120) || ' days')::interval,
    NOW() - ((ta.idx % 4) || ' days')::interval
FROM tmp_seed_apps ta
WHERE ta.app_status IN ('APPROVED','UNDER_REVIEW','SUBMITTED','INTEGRATION_REQUIRED')
  AND ta.supplier_status IN ('ACTIVE','PENDING');

CREATE TEMP TABLE tmp_seed_registry AS
SELECT srp.id AS profile_id, ta.idx, ta.user_id, ta.registry_type
FROM supplier_registry_profiles srp
JOIN tmp_seed_apps ta ON ta.application_id = srp.application_id;

-- -------------------------
-- Insert profile details
-- -------------------------
INSERT INTO supplier_registry_profile_details (
    profile_id, projected_json, search_ateco_primary, search_regions_csv,
    search_service_categories_csv, search_certifications_csv, created_at, updated_at
)
SELECT
    tr.profile_id,
    jsonb_build_object(
        'applicationId', ta.application_id::text,
        'registryType', tr.registry_type,
        'projectedAt', NOW(),
        'search', jsonb_build_object(
            'atecoPrimary', CASE WHEN tr.registry_type='ALBO_A' THEN '85.59.20' ELSE '70.22.09' END,
            'regionsCsv', 'Lombardia,Piemonte',
            'serviceCategoriesCsv', CASE WHEN tr.registry_type='ALBO_A' THEN 'CAT_A,CAT_B' ELSE 'CAT_A,CAT_C,CAT_D' END,
            'certificationsCsv', 'ISO9001,ACCREDITATION'
        ),
        'publicCardView', jsonb_build_object(
            'displayName', srp.display_name,
            'registryType', srp.registry_type,
            'score', srp.aggregate_score
        )
    ),
    CASE WHEN tr.registry_type='ALBO_A' THEN '85.59.20' ELSE '70.22.09' END,
    'Lombardia,Piemonte',
    CASE WHEN tr.registry_type='ALBO_A' THEN 'CAT_A,CAT_B' ELSE 'CAT_A,CAT_C,CAT_D' END,
    'ISO9001,ACCREDITATION',
    NOW() - ((tr.idx % 30) || ' days')::interval,
    NOW() - ((tr.idx % 3) || ' days')::interval
FROM tmp_seed_registry tr
JOIN tmp_seed_apps ta ON ta.idx = tr.idx
JOIN supplier_registry_profiles srp ON srp.id = tr.profile_id;

-- -------------------------
-- Insert evaluations + dimensions
-- -------------------------
CREATE TEMP TABLE tmp_seed_admin_evaluators AS
SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
FROM users
WHERE email LIKE 'seedrv.admin.%@example.com';

INSERT INTO evaluations (
    supplier_registry_profile_id, evaluator_user_id, collaboration_type,
    collaboration_period, reference_code, overall_score, comment,
    is_annulled, annulled_by_user_id, annulled_at, created_at
)
SELECT
    tr.profile_id,
    ae.id,
    (ARRAY['Docenza in aula','Blended','Consulenza organizzativa','Formazione online'])[((tr.idx + p.n) % 4) + 1],
    to_char((DATE '2025-01-01' + ((p.n-1) * interval '30 days')), 'Mon YYYY'),
    format('SEED-RV-%s-%s', tr.idx, p.n),
    ((tr.idx + p.n) % 3) + 3,
    format('Valutazione seed revamp %s/%s', tr.idx, p.n),
    false,
    NULL,
    NULL,
    NOW() - (((tr.idx + p.n) % 200) || ' days')::interval
FROM tmp_seed_registry tr
CROSS JOIN LATERAL (VALUES (1),(2),(3)) AS p(n)
JOIN tmp_seed_admin_evaluators ae ON ae.rn = ((tr.idx + p.n - 1) % 6) + 1;

INSERT INTO evaluation_dimensions (evaluation_id, dimension_key, score)
SELECT e.id, d.key, GREATEST(1, LEAST(5, e.overall_score + d.delta))
FROM evaluations e
CROSS JOIN LATERAL (
    VALUES
      ('QUALITY', 0),
      ('TIMELINESS', 1),
      ('COMMUNICATION', 0),
      ('FLEXIBILITY', -1),
      ('VALUE_FOR_MONEY', 0)
) AS d(key, delta)
WHERE e.reference_code LIKE 'SEED-RV-%';

-- -------------------------
-- Insert notifications and audit events
-- -------------------------
INSERT INTO notification_events (
    event_key, entity_type, entity_id, recipient, template_key,
    template_version, delivery_status, provider_message_id,
    payload_json, retry_count, sent_at, created_at, updated_at
)
SELECT
    CASE WHEN i.status='SENT' THEN 'INVITE_SENT' ELSE 'INVITE_STATUS_CHANGED' END,
    'INVITE',
    i.id,
    i.invited_email,
    'invite-email',
    1,
    CASE WHEN i.status='SENT' THEN 'SENT' ELSE 'FAILED' END,
    format('seedrv-msg-%s', row_number() OVER (ORDER BY i.created_at, i.id)),
    jsonb_build_object('inviteStatus', i.status, 'registryType', i.registry_type),
    CASE WHEN i.status='SENT' THEN 0 ELSE 1 END,
    CASE WHEN i.status='SENT' THEN i.created_at + interval '1 minute' ELSE NULL END,
    i.created_at,
    i.updated_at
FROM invites i
WHERE i.token LIKE 'seedrv-invite-%';

INSERT INTO audit_events (
    event_key, entity_type, entity_id, actor_user_id, actor_roles,
    request_id, reason, before_state_json, after_state_json,
    metadata_json, occurred_at
)
SELECT
    'REVIEW_DECISION',
    'APPLICATION',
    a.id,
    rc.assigned_to_user_id,
    'ADMIN',
    format('seedrv-%s', a.id::text),
    COALESCE(rc.decision_reason, 'seed decision'),
    jsonb_build_object('status','UNDER_REVIEW'),
    jsonb_build_object('status', a.status),
    jsonb_build_object('source','seed-script'),
    NOW() - ((row_number() OVER (ORDER BY a.created_at, a.id) % 90) || ' days')::interval
FROM applications a
JOIN review_cases rc ON rc.application_id = a.id
WHERE a.applicant_user_id IN (SELECT user_id FROM tmp_seed_supplier_profiles);

DROP TABLE IF EXISTS tmp_seed_admin_evaluators;
DROP TABLE IF EXISTS tmp_seed_registry;
DROP TABLE IF EXISTS tmp_seed_apps;
DROP TABLE IF EXISTS tmp_seed_invites;
DROP TABLE IF EXISTS tmp_seed_supplier_profiles;
DROP TABLE IF EXISTS tmp_seed_supplier_users;
DROP TABLE IF EXISTS tmp_seed_supplier_src;

COMMIT;
