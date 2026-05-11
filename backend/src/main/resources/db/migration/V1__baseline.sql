-- =============================================================
-- Supplier Platform — Baseline Schema (V1 through V37 collapsed)
-- Generated from migration history; use this file for a clean
-- fresh-install instead of running the 37 incremental migrations.
--
-- Conventions:
--   - All enum-like columns are VARCHAR (no CREATE TYPE enums).
--   - Table names are the FINAL names after V11/V12 renames.
--   - Compat views (revamp_* aliases) are NOT included.
--   - Dropped tables (validation_reviews, supplier_profiles,
--     supplier_contacts, supplier_documents, supplier_service_categories,
--     status_history, notification_reminders) are NOT included.
-- =============================================================


-- =============================================================
-- SECTION 1: USERS
-- Final state: V1 + V3 (VARCHAR) + V5 (admin_last_seen_pending_at via V14)
--              + V15 (role constraint) + V15_1 (deleted_at)
--              + V25 (email_verified) + V26 (full_name nullable)
-- =============================================================

CREATE TABLE users (
    id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email                       VARCHAR(255) NOT NULL UNIQUE,
    password_hash               VARCHAR(255) NOT NULL,
    full_name                   VARCHAR(255),                   -- nullable since V26
    role                        VARCHAR(50)  NOT NULL,
    is_active                   BOOLEAN      NOT NULL DEFAULT TRUE,
    invited_by                  UUID         REFERENCES users(id),
    invite_token                VARCHAR(255),
    invite_expires_at           TIMESTAMP,
    last_login_at               TIMESTAMP,
    admin_last_seen_pending_at  TIMESTAMP,                      -- added V5, renamed V14
    deleted_at                  TIMESTAMP,                      -- added V15_1
    email_verified              BOOLEAN      NOT NULL DEFAULT FALSE,  -- added V25
    created_at                  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_users_role_allowed CHECK (role IN ('SUPPLIER', 'ADMIN'))
);


-- =============================================================
-- SECTION 2: SERVICE CATEGORIES
-- Final state: V1 + V7 (name_en, name_it columns; ATECO reset)
-- Old generic categories kept but marked is_active = FALSE.
-- New ATECO A–U sections inserted as the active set.
-- =============================================================

CREATE TABLE service_categories (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(50)  NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    name_en    VARCHAR(255),   -- added V7
    name_it    VARCHAR(255),   -- added V7
    parent_id  UUID         REFERENCES service_categories(id),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);


-- =============================================================
-- SECTION 3: INVITES  (was revamp_invites, renamed by V11)
-- =============================================================

CREATE TABLE invites (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_type          VARCHAR(20)  NOT NULL CHECK (registry_type IN ('ALBO_A', 'ALBO_B')),
    invited_email          VARCHAR(255) NOT NULL,
    invited_name           VARCHAR(255),
    token                  VARCHAR(255) NOT NULL UNIQUE,
    status                 VARCHAR(32)  NOT NULL CHECK (status IN ('CREATED', 'SENT', 'OPENED', 'CONSUMED', 'EXPIRED', 'RENEWED', 'CANCELLED')),
    source_user_id         UUID         REFERENCES users(id),
    expires_at             TIMESTAMP    NOT NULL,
    consumed_at            TIMESTAMP,
    renewed_from_invite_id UUID         REFERENCES invites(id),
    note                   TEXT,
    created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invites_email_status
    ON invites(invited_email, status);

CREATE INDEX idx_invites_expires_at
    ON invites(expires_at);


-- =============================================================
-- SECTION 4: APPLICATIONS  (was revamp_applications, renamed by V11)
-- Columns: + identity_key_type / identity_value_normalized (V24)
--          - legacy_supplier_profile_id (dropped V33)
--          Status constraint updated to include FIELD_CHANGE_IN_PROGRESS (V34)
-- =============================================================

CREATE TABLE applications (
    id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_user_id         UUID         NOT NULL REFERENCES users(id),
    invite_id                 UUID         REFERENCES invites(id),
    registry_type             VARCHAR(20)  NOT NULL CHECK (registry_type IN ('ALBO_A', 'ALBO_B')),
    source_channel            VARCHAR(16)  NOT NULL CHECK (source_channel IN ('INVITE', 'PUBLIC')),
    status                    VARCHAR(32)  NOT NULL,
    protocol_code             VARCHAR(50)  UNIQUE,
    current_revision          INTEGER      NOT NULL DEFAULT 1 CHECK (current_revision >= 1),
    submitted_at              TIMESTAMP,
    approved_at               TIMESTAMP,
    rejected_at               TIMESTAMP,
    suspended_at              TIMESTAMP,
    renewal_due_at            TIMESTAMP,
    identity_key_type         VARCHAR(32),   -- added V24
    identity_value_normalized VARCHAR(128),  -- added V24
    created_at                TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT revamp_applications_status_check CHECK (status IN (
        'INVITED',
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'INTEGRATION_REQUIRED',
        'APPROVED',
        'REJECTED',
        'SUSPENDED',
        'RENEWAL_DUE',
        'ARCHIVED',
        'FIELD_CHANGE_IN_PROGRESS'
    ))
);

CREATE INDEX idx_applications_user_status
    ON applications(applicant_user_id, status);

CREATE INDEX idx_applications_registry_status
    ON applications(registry_type, status);

-- Partial unique index: one active identity per registry type (V24)
CREATE UNIQUE INDEX uk_applications_active_identity
    ON applications(registry_type, identity_key_type, identity_value_normalized)
    WHERE identity_value_normalized IS NOT NULL
      AND status IN (
          'DRAFT',
          'SUBMITTED',
          'UNDER_REVIEW',
          'INTEGRATION_REQUIRED',
          'APPROVED',
          'SUSPENDED',
          'RENEWAL_DUE'
      );


-- =============================================================
-- SECTION 5: APPLICATION SECTIONS  (was revamp_application_sections)
-- =============================================================

CREATE TABLE application_sections (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID         NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    section_key     VARCHAR(32)  NOT NULL,
    section_version INTEGER      NOT NULL DEFAULT 1 CHECK (section_version >= 1),
    payload_json    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    is_latest       BOOLEAN      NOT NULL DEFAULT TRUE,
    completed       BOOLEAN      NOT NULL DEFAULT FALSE,
    validated_at    TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_application_section_version UNIQUE (application_id, section_key, section_version)
);

CREATE INDEX idx_application_sections_lookup
    ON application_sections(application_id, section_key, is_latest);


-- =============================================================
-- SECTION 6: OTP CHALLENGES  (was revamp_otp_challenges)
-- =============================================================

CREATE TABLE otp_challenges (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID         REFERENCES applications(id) ON DELETE SET NULL,
    user_id        UUID         REFERENCES users(id) ON DELETE SET NULL,
    challenge_type VARCHAR(32)  NOT NULL CHECK (challenge_type IN ('EMAIL_VERIFY', 'DECLARATION_SIGNATURE', 'ADMIN_2FA')),
    target_email   VARCHAR(255),
    otp_hash       VARCHAR(255) NOT NULL,
    attempts       INTEGER      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts   INTEGER      NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
    expires_at     TIMESTAMP    NOT NULL,
    verified_at    TIMESTAMP,
    status         VARCHAR(20)  NOT NULL CHECK (status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED')),
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_challenges_lookup
    ON otp_challenges(user_id, challenge_type, status, expires_at);


-- =============================================================
-- SECTION 7: REVIEW CASES  (was revamp_review_cases)
-- Columns: + verified_by_user_id / verified_at / verification_note (V18)
--          + verification_outcome (V19)
-- Status constraint updated to include READY_FOR_DECISION (V18/V20/V21)
-- =============================================================

CREATE TABLE review_cases (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID         NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status              VARCHAR(32)  NOT NULL,
    assigned_to_user_id UUID         REFERENCES users(id),
    assigned_at         TIMESTAMP,
    decision            VARCHAR(32)  CHECK (decision IN ('APPROVED', 'REJECTED', 'INTEGRATION_REQUIRED')),
    decision_reason     TEXT,
    decided_by_user_id  UUID         REFERENCES users(id),
    decided_at          TIMESTAMP,
    sla_due_at          TIMESTAMP,
    verified_by_user_id UUID         REFERENCES users(id),   -- added V18
    verified_at         TIMESTAMP,                           -- added V18
    verification_note   TEXT,                                -- added V18
    verification_outcome VARCHAR(64),                        -- added V19
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT review_cases_status_check CHECK (status IN (
        'PENDING_ASSIGNMENT',
        'IN_PROGRESS',
        'WAITING_SUPPLIER_RESPONSE',
        'READY_FOR_DECISION',
        'DECIDED',
        'CLOSED'
    ))
);

CREATE INDEX idx_review_cases_status
    ON review_cases(status, sla_due_at);


-- =============================================================
-- SECTION 8: INTEGRATION REQUESTS  (was revamp_integration_requests)
-- =============================================================

CREATE TABLE integration_requests (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    review_case_id         UUID         NOT NULL REFERENCES review_cases(id) ON DELETE CASCADE,
    requested_by_user_id   UUID         REFERENCES users(id),
    due_at                 TIMESTAMP    NOT NULL,
    request_message        TEXT         NOT NULL,
    requested_items_json   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    supplier_response_json JSONB,
    supplier_responded_at  TIMESTAMP,
    status                 VARCHAR(32)  NOT NULL CHECK (status IN ('OPEN', 'ANSWERED', 'OVERDUE', 'CLOSED')),
    created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_requests_status_due
    ON integration_requests(status, due_at);


-- =============================================================
-- SECTION 9: SUPPLIER REGISTRY PROFILES  (was revamp_supplier_registry_profiles)
-- =============================================================

CREATE TABLE supplier_registry_profiles (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id   UUID         UNIQUE REFERENCES applications(id),
    supplier_user_id UUID         NOT NULL REFERENCES users(id),
    registry_type    VARCHAR(20)  NOT NULL CHECK (registry_type IN ('ALBO_A', 'ALBO_B')),
    status           VARCHAR(32)  NOT NULL CHECK (status IN ('APPROVED', 'SUSPENDED', 'RENEWAL_DUE', 'ARCHIVED')),
    display_name     VARCHAR(255),
    public_summary   TEXT,
    aggregate_score  NUMERIC(5,2),
    is_visible       BOOLEAN      NOT NULL DEFAULT FALSE,
    approved_at      TIMESTAMP,
    expires_at       TIMESTAMP,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supplier_registry_profiles_status
    ON supplier_registry_profiles(status, is_visible);

CREATE INDEX idx_supplier_registry_profiles_expiry
    ON supplier_registry_profiles(expires_at);


-- =============================================================
-- SECTION 10: EVALUATIONS  (was revamp_evaluations, simplified by V29)
-- V29 removed: is_annulled, annulled_by_user_id, annulled_at
-- V29 changed unique constraint to (supplier_registry_profile_id, evaluator_user_id)
-- =============================================================

CREATE TABLE evaluations (
    id                           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_registry_profile_id UUID         NOT NULL REFERENCES supplier_registry_profiles(id) ON DELETE CASCADE,
    evaluator_user_id            UUID         NOT NULL REFERENCES users(id),
    collaboration_type           VARCHAR(100) NOT NULL,
    collaboration_period         VARCHAR(50)  NOT NULL,
    reference_code               VARCHAR(100),
    overall_score                SMALLINT     NOT NULL CHECK (overall_score BETWEEN 1 AND 5),
    comment                      TEXT,
    created_at                   TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_evaluation_supplier_evaluator UNIQUE (supplier_registry_profile_id, evaluator_user_id)
);

CREATE INDEX idx_evaluations_supplier
    ON evaluations(supplier_registry_profile_id, created_at DESC);


-- =============================================================
-- SECTION 11: EVALUATION DIMENSIONS  (was revamp_evaluation_dimensions)
-- =============================================================

CREATE TABLE evaluation_dimensions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID        NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    dimension_key VARCHAR(50) NOT NULL,
    score         SMALLINT    NOT NULL CHECK (score BETWEEN 1 AND 5),
    CONSTRAINT uk_evaluation_dimension_key UNIQUE (evaluation_id, dimension_key)
);


-- =============================================================
-- SECTION 12: NOTIFICATION EVENTS  (was revamp_notification_events)
-- + failure_reason VARCHAR(1000) added by V37
-- =============================================================

CREATE TABLE notification_events (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key           VARCHAR(100) NOT NULL,
    entity_type         VARCHAR(50)  NOT NULL,
    entity_id           UUID,
    recipient           VARCHAR(255),
    template_key        VARCHAR(100),
    template_version    INTEGER,
    delivery_status     VARCHAR(20)  NOT NULL CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED', 'RETRYING', 'CANCELLED')),
    provider_message_id VARCHAR(255),
    payload_json        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    retry_count         INTEGER      NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    sent_at             TIMESTAMP,
    failure_reason      VARCHAR(1000),   -- added V37
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_events_entity
    ON notification_events(entity_type, entity_id, created_at DESC);

CREATE INDEX idx_notification_events_status
    ON notification_events(delivery_status, created_at DESC);


-- =============================================================
-- SECTION 13: AUDIT EVENTS  (was revamp_audit_events)
-- =============================================================

CREATE TABLE audit_events (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key         VARCHAR(100) NOT NULL,
    entity_type       VARCHAR(50)  NOT NULL,
    entity_id         UUID,
    actor_user_id     UUID         REFERENCES users(id),
    actor_roles       VARCHAR(255),
    request_id        VARCHAR(100),
    reason            TEXT,
    before_state_json JSONB,
    after_state_json  JSONB,
    metadata_json     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    occurred_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_entity
    ON audit_events(entity_type, entity_id, occurred_at DESC);

CREATE INDEX idx_audit_events_actor
    ON audit_events(actor_user_id, occurred_at DESC);

CREATE INDEX idx_audit_events_request
    ON audit_events(request_id);


-- =============================================================
-- SECTION 14: USER ADMIN ROLES  (was revamp_user_admin_roles)
-- V16: replaced UNIQUE(user_id, admin_role) with UNIQUE(user_id)
--      (one governance role per admin user)
-- =============================================================

CREATE TABLE user_admin_roles (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_role         VARCHAR(50)  NOT NULL CHECK (admin_role IN ('SUPER_ADMIN', 'RESPONSABILE_ALBO', 'REVISORE', 'VIEWER')),
    created_by_user_id UUID         REFERENCES users(id),
    created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_user_admin_single_role UNIQUE (user_id)
);

CREATE INDEX idx_user_admin_roles_role
    ON user_admin_roles(admin_role, user_id);


-- =============================================================
-- SECTION 15: APPLICATION ATTACHMENTS  (created V17)
-- =============================================================

CREATE TABLE application_attachments (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID         NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    section_key    VARCHAR(32)  NOT NULL,
    field_key      VARCHAR(64),
    document_type  VARCHAR(40)  NOT NULL CHECK (document_type IN ('CV', 'VISURA_CAMERALE', 'DURC', 'COMPANY_PROFILE', 'CERTIFICATION', 'OTHER')),
    file_name      VARCHAR(255) NOT NULL,
    mime_type      VARCHAR(255),
    size_bytes     BIGINT,
    storage_key    VARCHAR(255) NOT NULL,
    uploaded_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMP
);

CREATE INDEX idx_application_attachments_app_section
    ON application_attachments(application_id, section_key);

CREATE INDEX idx_application_attachments_doc_type
    ON application_attachments(document_type, uploaded_at DESC);


-- =============================================================
-- SECTION 16: SUPPLIER REGISTRY PROFILE DETAILS  (created V17)
-- =============================================================

CREATE TABLE supplier_registry_profile_details (
    id                            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id                    UUID         NOT NULL UNIQUE REFERENCES supplier_registry_profiles(id) ON DELETE CASCADE,
    projected_json                JSONB        NOT NULL DEFAULT '{}'::jsonb,
    search_ateco_primary          VARCHAR(255),
    search_regions_csv            TEXT,
    search_service_categories_csv TEXT,
    search_certifications_csv     TEXT,
    created_at                    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supplier_registry_profile_details_ateco
    ON supplier_registry_profile_details(search_ateco_primary);

CREATE INDEX idx_supplier_registry_profile_details_profile
    ON supplier_registry_profile_details(profile_id);


-- =============================================================
-- SECTION 17: SUPPLIER EVALUATOR ASSIGNMENTS  (created V22, simplified V29)
-- V29 removed: assigned_by_user_id, reason, status, due_at,
--   reassigned_from_user_id, reassignment_reason, completed_evaluation_id,
--   draft_* columns, active, updated_at
-- V29 changed unique constraint to (supplier_registry_profile_id, assigned_evaluator_user_id)
-- =============================================================

CREATE TABLE supplier_evaluator_assignments (
    id                           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_registry_profile_id UUID         NOT NULL REFERENCES supplier_registry_profiles(id) ON DELETE CASCADE,
    assigned_evaluator_user_id   UUID         NOT NULL REFERENCES users(id),
    assigned_at                  TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_assignment_supplier_evaluator UNIQUE (supplier_registry_profile_id, assigned_evaluator_user_id)
);


-- =============================================================
-- SECTION 18: FIELD CHANGE REQUESTS
-- Created in database/migrations/V31, section_key widened to VARCHAR(32) by V32
-- =============================================================

CREATE TABLE field_change_requests (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID         NOT NULL REFERENCES applications(id),
    section_key         VARCHAR(32)  NOT NULL,   -- widened from VARCHAR(16) by V32
    supplier_message    TEXT         NOT NULL,
    status              VARCHAR(32)  NOT NULL,
    admin_note          TEXT,
    unlocked_by_user_id UUID         REFERENCES users(id),
    unlocked_at         TIMESTAMP,
    submitted_at        TIMESTAMP,
    before_value_json   JSONB,
    after_value_json    JSONB,
    review_case_id      UUID         REFERENCES review_cases(id),
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fcr_application_id ON field_change_requests(application_id);
CREATE INDEX idx_fcr_review_case_id ON field_change_requests(review_case_id);
CREATE INDEX idx_fcr_status         ON field_change_requests(status);


-- =============================================================
-- SECTION 19: DOCUMENT RENEWAL REQUESTS  (created V35, + batch_id V36)
-- batch_id is NOT NULL; new rows must supply it at insert time.
-- =============================================================

CREATE TABLE document_renewal_requests (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id        UUID         NOT NULL REFERENCES applications(id),
    review_case_id        UUID         REFERENCES review_cases(id),
    section_key           VARCHAR(16)  NOT NULL,
    document_type         VARCHAR(64)  NOT NULL,
    document_label        VARCHAR(255) NOT NULL,
    integration_item_code VARCHAR(96)  NOT NULL,
    certification_key     VARCHAR(64),
    expiry_date           DATE,
    status                VARCHAR(32)  NOT NULL,
    old_attachment_json   JSONB,
    new_attachment_json   JSONB,
    submitted_at          TIMESTAMP,
    batch_id              VARCHAR(128) NOT NULL,   -- added V36 (NOT NULL)
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_renewal_application_id   ON document_renewal_requests(application_id);
CREATE INDEX idx_doc_renewal_review_case_id   ON document_renewal_requests(review_case_id);
CREATE INDEX idx_doc_renewal_status           ON document_renewal_requests(status);
CREATE INDEX idx_doc_renewal_expiry_date      ON document_renewal_requests(expiry_date);
CREATE INDEX idx_doc_renewal_batch_id         ON document_renewal_requests(batch_id);
CREATE INDEX idx_doc_renewal_application_batch ON document_renewal_requests(application_id, batch_id);


-- =============================================================
-- SECTION 20: SEED DATA
-- =============================================================

-- -------------------------
-- Service Categories: old generic categories (all inactive after V7)
-- -------------------------

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active) VALUES
    ('IT_SERVICES',        'IT Services',             'IT Services',             'IT Services',             NULL, FALSE),
    ('CONSTRUCTION',       'Construction',            'Construction',            'Construction',            NULL, FALSE),
    ('LOGISTICS',          'Logistics & Transport',   'Logistics & Transport',   'Logistics & Transport',   NULL, FALSE),
    ('CONSULTING',         'Consulting',              'Consulting',              'Consulting',              NULL, FALSE),
    ('MANUFACTURING',      'Manufacturing',           'Manufacturing',           'Manufacturing',           NULL, FALSE),
    ('FACILITIES',         'Facilities Management',   'Facilities Management',   'Facilities Management',   NULL, FALSE),
    ('MARKETING',          'Marketing & Advertising', 'Marketing & Advertising', 'Marketing & Advertising', NULL, FALSE),
    ('LEGAL',              'Legal Services',          'Legal Services',          'Legal Services',          NULL, FALSE),
    ('FINANCE',            'Finance & Accounting',    'Finance & Accounting',    'Finance & Accounting',    NULL, FALSE),
    ('HR_RECRUITMENT',     'HR & Recruitment',        'HR & Recruitment',        'HR & Recruitment',        NULL, FALSE),
    ('ENERGY_SERVICES',    'Energy Services',         'Energy Services',         'Energy Services',         NULL, FALSE),
    ('FOOD_BEVERAGE',      'Food & Beverage',         'Food & Beverage',         'Food & Beverage',         NULL, FALSE),
    ('TEXTILE_FASHION',    'Textile & Fashion',       'Textile & Fashion',       'Textile & Fashion',       NULL, FALSE),
    ('AUTOMOTIVE',         'Automotive',              'Automotive',              'Automotive',              NULL, FALSE),
    ('HEALTHCARE',         'Healthcare',              'Healthcare',              'Healthcare',              NULL, FALSE),
    ('CHEMICALS',          'Chemicals',               'Chemicals',               'Chemicals',               NULL, FALSE),
    ('REAL_ESTATE',        'Real Estate',             'Real Estate',             'Real Estate',             NULL, FALSE),
    ('HOSPITALITY',        'Hospitality & Tourism',   'Hospitality & Tourism',   'Hospitality & Tourism',   NULL, FALSE),
    ('AGRICULTURE',        'Agriculture',             'Agriculture',             'Agriculture',             NULL, FALSE),
    ('WASTE_RECYCLING',    'Waste & Recycling',       'Waste & Recycling',       'Waste & Recycling',       NULL, FALSE),
    ('SECURITY',           'Security Services',       'Security Services',       'Security Services',       NULL, FALSE);

-- Generic sub-categories (also inactive)
INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'IT_SOFTWARE_DEV', 'Software Development', 'Software Development', 'Software Development',
       id, FALSE FROM service_categories WHERE code = 'IT_SERVICES';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'IT_INFRASTRUCTURE', 'IT Infrastructure', 'IT Infrastructure', 'IT Infrastructure',
       id, FALSE FROM service_categories WHERE code = 'IT_SERVICES';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'IT_CYBERSECURITY', 'Cybersecurity', 'Cybersecurity', 'Cybersecurity',
       id, FALSE FROM service_categories WHERE code = 'IT_SERVICES';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'IT_CLOUD', 'Cloud Services', 'Cloud Services', 'Cloud Services',
       id, FALSE FROM service_categories WHERE code = 'IT_SERVICES';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'LOG_FREIGHT', 'Freight & Shipping', 'Freight & Shipping', 'Freight & Shipping',
       id, FALSE FROM service_categories WHERE code = 'LOGISTICS';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'LOG_WAREHOUSING', 'Warehousing', 'Warehousing', 'Warehousing',
       id, FALSE FROM service_categories WHERE code = 'LOGISTICS';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'LOG_LAST_MILE', 'Last Mile Delivery', 'Last Mile Delivery', 'Last Mile Delivery',
       id, FALSE FROM service_categories WHERE code = 'LOGISTICS';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'LOG_FREIGHT_ROAD', 'Road Freight', 'Road Freight', 'Road Freight',
       id, FALSE FROM service_categories WHERE code = 'LOGISTICS';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'LOG_FREIGHT_SEA', 'Sea Freight', 'Sea Freight', 'Sea Freight',
       id, FALSE FROM service_categories WHERE code = 'LOGISTICS';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'LOG_CUSTOMS', 'Customs Brokerage', 'Customs Brokerage', 'Customs Brokerage',
       id, FALSE FROM service_categories WHERE code = 'LOGISTICS';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'CONSULTING_TAX', 'Tax Advisory', 'Tax Advisory', 'Tax Advisory',
       id, FALSE FROM service_categories WHERE code = 'CONSULTING';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'CONSULTING_LEGAL_COMPLIANCE', 'Legal Compliance', 'Legal Compliance', 'Legal Compliance',
       id, FALSE FROM service_categories WHERE code = 'CONSULTING';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'CONSULTING_DIGITAL', 'Digital Transformation', 'Digital Transformation', 'Digital Transformation',
       id, FALSE FROM service_categories WHERE code = 'CONSULTING';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'ENERGY_SOLAR', 'Solar Installation', 'Solar Installation', 'Solar Installation',
       id, FALSE FROM service_categories WHERE code = 'ENERGY_SERVICES';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'ENERGY_EFFICIENCY', 'Energy Efficiency Audits', 'Energy Efficiency Audits', 'Energy Efficiency Audits',
       id, FALSE FROM service_categories WHERE code = 'ENERGY_SERVICES';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'ENERGY_MAINTENANCE', 'Electrical Maintenance', 'Electrical Maintenance', 'Electrical Maintenance',
       id, FALSE FROM service_categories WHERE code = 'ENERGY_SERVICES';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'HEALTHCARE_MEDICAL_SUPPLIES', 'Medical Supplies', 'Medical Supplies', 'Medical Supplies',
       id, FALSE FROM service_categories WHERE code = 'HEALTHCARE';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'HEALTHCARE_CLINICAL_SERVICES', 'Clinical Services', 'Clinical Services', 'Clinical Services',
       id, FALSE FROM service_categories WHERE code = 'HEALTHCARE';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'FOOD_PROCESSING', 'Food Processing', 'Food Processing', 'Food Processing',
       id, FALSE FROM service_categories WHERE code = 'FOOD_BEVERAGE';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'FOOD_CATERING', 'Industrial Catering', 'Industrial Catering', 'Industrial Catering',
       id, FALSE FROM service_categories WHERE code = 'FOOD_BEVERAGE';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'TEXTILE_GARMENT', 'Garment Manufacturing', 'Garment Manufacturing', 'Garment Manufacturing',
       id, FALSE FROM service_categories WHERE code = 'TEXTILE_FASHION';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'AUTOMOTIVE_COMPONENTS', 'Automotive Components', 'Automotive Components', 'Automotive Components',
       id, FALSE FROM service_categories WHERE code = 'AUTOMOTIVE';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'WASTE_HAZARDOUS', 'Hazardous Waste Management', 'Hazardous Waste Management', 'Hazardous Waste Management',
       id, FALSE FROM service_categories WHERE code = 'WASTE_RECYCLING';

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active)
SELECT 'SECURITY_GUARDING', 'Guarding Services', 'Guarding Services', 'Guarding Services',
       id, FALSE FROM service_categories WHERE code = 'SECURITY';

-- -------------------------
-- Service Categories: ATECO sections A–U (active, from V7)
-- -------------------------

INSERT INTO service_categories (code, name, name_en, name_it, parent_id, is_active) VALUES
    ('A', 'Agriculture, Forestry and Fishing',
          'Agriculture, Forestry and Fishing',
          'Agricoltura, silvicoltura e pesca',
          NULL, TRUE),
    ('B', 'Mining and Quarrying',
          'Mining and Quarrying',
          'Estrazione di minerali',
          NULL, TRUE),
    ('C', 'Manufacturing',
          'Manufacturing',
          'Attivita manifatturiere',
          NULL, TRUE),
    ('D', 'Electricity, Gas, Steam',
          'Electricity, Gas, Steam',
          'Fornitura di energia elettrica, gas, vapore',
          NULL, TRUE),
    ('E', 'Water Supply, Waste Management',
          'Water Supply, Waste Management',
          'Fornitura di acqua, gestione rifiuti',
          NULL, TRUE),
    ('F', 'Construction',
          'Construction',
          'Costruzioni',
          NULL, TRUE),
    ('G', 'Wholesale and Retail Trade',
          'Wholesale and Retail Trade',
          'Commercio all''ingrosso e al dettaglio',
          NULL, TRUE),
    ('H', 'Transportation and Storage',
          'Transportation and Storage',
          'Trasporto e magazzinaggio',
          NULL, TRUE),
    ('I', 'Accommodation and Food Services',
          'Accommodation and Food Services',
          'Attivita dei servizi di alloggio e ristorazione',
          NULL, TRUE),
    ('J', 'Information and Communication',
          'Information and Communication',
          'Servizi di informazione e comunicazione',
          NULL, TRUE),
    ('K', 'Financial and Insurance Activities',
          'Financial and Insurance Activities',
          'Attivita finanziarie e assicurative',
          NULL, TRUE),
    ('L', 'Real Estate Activities',
          'Real Estate Activities',
          'Attivita immobiliari',
          NULL, TRUE),
    ('M', 'Professional, Scientific and Technical Activities',
          'Professional, Scientific and Technical Activities',
          'Attivita professionali, scientifiche e tecniche',
          NULL, TRUE),
    ('N', 'Administrative and Support Services',
          'Administrative and Support Services',
          'Noleggio, agenzie di viaggio, servizi di supporto',
          NULL, TRUE),
    ('O', 'Public Administration and Defence',
          'Public Administration and Defence',
          'Amministrazione pubblica e difesa',
          NULL, TRUE),
    ('P', 'Education',
          'Education',
          'Istruzione',
          NULL, TRUE),
    ('Q', 'Human Health and Social Work',
          'Human Health and Social Work',
          'Sanita e assistenza sociale',
          NULL, TRUE),
    ('R', 'Arts, Entertainment and Recreation',
          'Arts, Entertainment and Recreation',
          'Attivita artistiche, sportive e di intrattenimento',
          NULL, TRUE),
    ('S', 'Other Service Activities',
          'Other Service Activities',
          'Altre attivita di servizi',
          NULL, TRUE),
    ('T', 'Activities of Households as Employers',
          'Activities of Households as Employers',
          'Attivita di famiglie come datori di lavoro',
          NULL, TRUE),
    ('U', 'Activities of Extraterritorial Organizations',
          'Activities of Extraterritorial Organizations',
          'Organizzazioni extraterritoriali',
          NULL, TRUE);

-- -------------------------
-- Admin seed users (from V28 + V30; password = bcrypt of 'Admin@1234')
-- -------------------------

INSERT INTO users (id, email, password_hash, role, is_active, email_verified) VALUES
    (gen_random_uuid(), 'admin@supplierplatform.com',         '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', TRUE, TRUE),
    (gen_random_uuid(), 'responsabile1@supplierplatform.com', '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', TRUE, TRUE),
    (gen_random_uuid(), 'responsabile2@supplierplatform.com', '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', TRUE, TRUE),
    (gen_random_uuid(), 'revisore1@supplierplatform.com',     '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', TRUE, TRUE),
    (gen_random_uuid(), 'revisore2@supplierplatform.com',     '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', TRUE, TRUE),
    (gen_random_uuid(), 'viewer@supplierplatform.com',        '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', TRUE, TRUE),
    (gen_random_uuid(), 'viewer2@supplierplatform.com',       '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Governance sub-roles
INSERT INTO user_admin_roles (id, user_id, admin_role, created_by_user_id)
SELECT
    gen_random_uuid(),
    u.id,
    r.admin_role,
    (SELECT id FROM users WHERE email = 'admin@supplierplatform.com')
FROM (VALUES
    ('admin@supplierplatform.com',         'SUPER_ADMIN'       ),
    ('responsabile1@supplierplatform.com', 'RESPONSABILE_ALBO' ),
    ('responsabile2@supplierplatform.com', 'RESPONSABILE_ALBO' ),
    ('revisore1@supplierplatform.com',     'REVISORE'          ),
    ('revisore2@supplierplatform.com',     'REVISORE'          ),
    ('viewer@supplierplatform.com',        'VIEWER'            ),
    ('viewer2@supplierplatform.com',       'VIEWER'            )
) AS r(email, admin_role)
JOIN users u ON u.email = r.email
ON CONFLICT (user_id) DO NOTHING;
