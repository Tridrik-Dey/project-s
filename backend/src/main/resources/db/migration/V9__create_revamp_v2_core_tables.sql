-- =============================================================
-- Revamp V2 Core Tables (additive only, no legacy breakage)
-- =============================================================

-- -------------------------
-- INVITES
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_invites (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_type          VARCHAR(20)  NOT NULL CHECK (registry_type IN ('ALBO_A', 'ALBO_B')),
    invited_email          VARCHAR(255) NOT NULL,
    invited_name           VARCHAR(255),
    token                  VARCHAR(255) NOT NULL UNIQUE,
    status                 VARCHAR(32)  NOT NULL CHECK (status IN ('CREATED', 'SENT', 'OPENED', 'CONSUMED', 'EXPIRED', 'RENEWED', 'CANCELLED')),
    source_user_id         UUID REFERENCES users(id),
    expires_at             TIMESTAMP    NOT NULL,
    consumed_at            TIMESTAMP,
    renewed_from_invite_id UUID REFERENCES revamp_invites(id),
    note                   TEXT,
    created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revamp_invites_email_status
    ON revamp_invites(invited_email, status);

CREATE INDEX IF NOT EXISTS idx_revamp_invites_expires_at
    ON revamp_invites(expires_at);

-- -------------------------
-- APPLICATIONS
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_applications (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_user_id         UUID         NOT NULL REFERENCES users(id),
    invite_id                 UUID         REFERENCES revamp_invites(id),
    registry_type             VARCHAR(20)  NOT NULL CHECK (registry_type IN ('ALBO_A', 'ALBO_B')),
    source_channel            VARCHAR(16)  NOT NULL CHECK (source_channel IN ('INVITE', 'PUBLIC')),
    status                    VARCHAR(32)  NOT NULL CHECK (status IN (
        'INVITED', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INTEGRATION_REQUIRED',
        'APPROVED', 'REJECTED', 'SUSPENDED', 'RENEWAL_DUE', 'ARCHIVED'
    )),
    protocol_code             VARCHAR(50) UNIQUE,
    current_revision          INTEGER      NOT NULL DEFAULT 1 CHECK (current_revision >= 1),
    submitted_at              TIMESTAMP,
    approved_at               TIMESTAMP,
    rejected_at               TIMESTAMP,
    suspended_at              TIMESTAMP,
    renewal_due_at            TIMESTAMP,
    legacy_supplier_profile_id UUID        REFERENCES supplier_profiles(id),
    created_at                TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revamp_applications_user_status
    ON revamp_applications(applicant_user_id, status);

CREATE INDEX IF NOT EXISTS idx_revamp_applications_registry_status
    ON revamp_applications(registry_type, status);

-- -------------------------
-- APPLICATION SECTIONS
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_application_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID         NOT NULL REFERENCES revamp_applications(id) ON DELETE CASCADE,
    section_key     VARCHAR(32)  NOT NULL,
    section_version INTEGER      NOT NULL DEFAULT 1 CHECK (section_version >= 1),
    payload_json    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    is_latest       BOOLEAN      NOT NULL DEFAULT TRUE,
    completed       BOOLEAN      NOT NULL DEFAULT FALSE,
    validated_at    TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (application_id, section_key, section_version)
);

CREATE INDEX IF NOT EXISTS idx_revamp_app_sections_lookup
    ON revamp_application_sections(application_id, section_key, is_latest);

-- -------------------------
-- OTP CHALLENGES
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_otp_challenges (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES revamp_applications(id) ON DELETE SET NULL,
    user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_revamp_otp_lookup
    ON revamp_otp_challenges(user_id, challenge_type, status, expires_at);

-- -------------------------
-- REVIEW CASES
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_review_cases (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id     UUID         NOT NULL REFERENCES revamp_applications(id) ON DELETE CASCADE,
    status             VARCHAR(32)  NOT NULL CHECK (status IN ('PENDING_ASSIGNMENT', 'IN_PROGRESS', 'WAITING_SUPPLIER_RESPONSE', 'DECIDED', 'CLOSED')),
    assigned_to_user_id UUID        REFERENCES users(id),
    assigned_at        TIMESTAMP,
    decision           VARCHAR(32)  CHECK (decision IN ('APPROVED', 'REJECTED', 'INTEGRATION_REQUIRED')),
    decision_reason    TEXT,
    decided_by_user_id UUID         REFERENCES users(id),
    decided_at         TIMESTAMP,
    sla_due_at         TIMESTAMP,
    created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revamp_review_cases_status
    ON revamp_review_cases(status, sla_due_at);

-- -------------------------
-- INTEGRATION REQUESTS
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_integration_requests (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_case_id        UUID         NOT NULL REFERENCES revamp_review_cases(id) ON DELETE CASCADE,
    requested_by_user_id  UUID         REFERENCES users(id),
    due_at                TIMESTAMP    NOT NULL,
    request_message       TEXT         NOT NULL,
    requested_items_json  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    supplier_response_json JSONB,
    supplier_responded_at TIMESTAMP,
    status                VARCHAR(32)  NOT NULL CHECK (status IN ('OPEN', 'ANSWERED', 'OVERDUE', 'CLOSED')),
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revamp_integration_requests_status_due
    ON revamp_integration_requests(status, due_at);

-- -------------------------
-- SUPPLIER REGISTRY PROFILES
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_supplier_registry_profiles (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id             UUID UNIQUE REFERENCES revamp_applications(id),
    supplier_user_id           UUID         NOT NULL REFERENCES users(id),
    registry_type              VARCHAR(20)  NOT NULL CHECK (registry_type IN ('ALBO_A', 'ALBO_B')),
    status                     VARCHAR(32)  NOT NULL CHECK (status IN ('APPROVED', 'SUSPENDED', 'RENEWAL_DUE', 'ARCHIVED')),
    display_name               VARCHAR(255),
    public_summary             TEXT,
    aggregate_score            NUMERIC(5,2),
    is_visible                 BOOLEAN      NOT NULL DEFAULT FALSE,
    approved_at                TIMESTAMP,
    expires_at                 TIMESTAMP,
    created_at                 TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revamp_registry_profiles_status
    ON revamp_supplier_registry_profiles(status, is_visible);

CREATE INDEX IF NOT EXISTS idx_revamp_registry_profiles_expiry
    ON revamp_supplier_registry_profiles(expires_at);

-- -------------------------
-- EVALUATIONS
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_evaluations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_registry_profile_id UUID         NOT NULL REFERENCES revamp_supplier_registry_profiles(id) ON DELETE CASCADE,
    evaluator_user_id           UUID         NOT NULL REFERENCES users(id),
    collaboration_type          VARCHAR(100) NOT NULL,
    collaboration_period        VARCHAR(50)  NOT NULL,
    reference_code              VARCHAR(100),
    overall_score               SMALLINT     NOT NULL CHECK (overall_score BETWEEN 1 AND 5),
    comment                     TEXT,
    is_annulled                 BOOLEAN      NOT NULL DEFAULT FALSE,
    annulled_by_user_id         UUID         REFERENCES users(id),
    annulled_at                 TIMESTAMP,
    created_at                  TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (supplier_registry_profile_id, evaluator_user_id, collaboration_period)
);

CREATE INDEX IF NOT EXISTS idx_revamp_evaluations_supplier
    ON revamp_evaluations(supplier_registry_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS revamp_evaluation_dimensions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID         NOT NULL REFERENCES revamp_evaluations(id) ON DELETE CASCADE,
    dimension_key VARCHAR(50)  NOT NULL,
    score         SMALLINT     NOT NULL CHECK (score BETWEEN 1 AND 5),
    UNIQUE (evaluation_id, dimension_key)
);

-- -------------------------
-- NOTIFICATION EVENTS
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_notification_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key            VARCHAR(100) NOT NULL,
    entity_type          VARCHAR(50)  NOT NULL,
    entity_id            UUID,
    recipient            VARCHAR(255),
    template_key         VARCHAR(100),
    template_version     INTEGER,
    delivery_status      VARCHAR(20)  NOT NULL CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED', 'RETRYING', 'CANCELLED')),
    provider_message_id  VARCHAR(255),
    payload_json         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    retry_count          INTEGER      NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    sent_at              TIMESTAMP,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revamp_notif_events_entity
    ON revamp_notification_events(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revamp_notif_events_status
    ON revamp_notification_events(delivery_status, created_at DESC);

-- -------------------------
-- AUDIT EVENTS
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_audit_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key          VARCHAR(100) NOT NULL,
    entity_type        VARCHAR(50)  NOT NULL,
    entity_id          UUID,
    actor_user_id      UUID REFERENCES users(id),
    actor_roles        VARCHAR(255),
    request_id         VARCHAR(100),
    reason             TEXT,
    before_state_json  JSONB,
    after_state_json   JSONB,
    metadata_json      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    occurred_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revamp_audit_entity
    ON revamp_audit_events(entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_revamp_audit_actor
    ON revamp_audit_events(actor_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_revamp_audit_request
    ON revamp_audit_events(request_id);

-- -------------------------
-- ADMIN MULTI-ROLE MAPPING
-- -------------------------
CREATE TABLE IF NOT EXISTS revamp_user_admin_roles (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_role         VARCHAR(50) NOT NULL CHECK (admin_role IN ('SUPER_ADMIN', 'RESPONSABILE_ALBO', 'REVISORE', 'VIEWER')),
    created_by_user_id UUID REFERENCES users(id),
    created_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, admin_role)
);

CREATE INDEX IF NOT EXISTS idx_revamp_user_admin_roles_role
    ON revamp_user_admin_roles(admin_role, user_id);

