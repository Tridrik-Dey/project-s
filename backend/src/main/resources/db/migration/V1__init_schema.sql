-- =============================================================
-- Supplier Registration Platform — Initial Schema
-- =============================================================

-- -------------------------
-- ENUMS
-- -------------------------

CREATE TYPE user_role AS ENUM (
    'SUPPLIER',
    'VALIDATOR',
    'ADMIN'
);

CREATE TYPE supplier_status AS ENUM (
    'DRAFT',
    'PENDING',
    'NEEDS_REVISION',
    'APPROVED',
    'ACTIVE',
    'INACTIVE',
    'REJECTED'
);

CREATE TYPE company_type AS ENUM (
    'LLC',
    'SOLE_TRADER',
    'PARTNERSHIP',
    'CORPORATION',
    'NON_PROFIT',
    'OTHER'
);

CREATE TYPE employee_count_range AS ENUM (
    'MICRO',
    'SMALL',
    'MEDIUM',
    'LARGE'
);

CREATE TYPE annual_revenue_range AS ENUM (
    'UNDER_100K',
    '_100K_500K',
    '_500K_1M',
    '_1M_5M',
    'ABOVE_5M'
);

CREATE TYPE contact_type AS ENUM (
    'PRIMARY',
    'SECONDARY',
    'FINANCE',
    'TECHNICAL'
);

CREATE TYPE document_type AS ENUM (
    'COMPANY_PROFILE',
    'TRADE_LICENSE',
    'VAT_CERTIFICATE',
    'BANK_LETTER',
    'INSURANCE_CERTIFICATE',
    'ISO_CERTIFICATION',
    'FINANCIAL_STATEMENT',
    'OTHER'
);

CREATE TYPE review_action AS ENUM (
    'APPROVED',
    'REJECTED',
    'REVISION_REQUESTED'
);

CREATE TYPE reminder_type AS ENUM (
    'DOCUMENT_EXPIRY',
    'INCOMPLETE_PROFILE',
    'PENDING_TOO_LONG'
);

-- -------------------------
-- USERS
-- -------------------------

CREATE TABLE users (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    full_name         VARCHAR(255) NOT NULL,
    role              user_role    NOT NULL,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    invited_by        UUID         REFERENCES users(id),
    invite_token      VARCHAR(255),
    invite_expires_at TIMESTAMP,
    last_login_at     TIMESTAMP,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- -------------------------
-- SUPPLIER PROFILES
-- -------------------------

CREATE TABLE supplier_profiles (
    id                       UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID             NOT NULL UNIQUE REFERENCES users(id),
    status                   supplier_status  NOT NULL DEFAULT 'DRAFT',
    company_name             VARCHAR(255)     NOT NULL,
    trading_name             VARCHAR(255),
    company_type             company_type     NOT NULL,
    registration_number      VARCHAR(100)     NOT NULL,
    vat_number               VARCHAR(100)     UNIQUE,
    tax_id                   VARCHAR(100)     NOT NULL UNIQUE,
    country_of_incorporation VARCHAR(100)     NOT NULL,
    incorporation_date       DATE,
    website                  VARCHAR(255),
    description              TEXT,
    employee_count_range     employee_count_range,
    annual_revenue_range     annual_revenue_range,
    address_line1            VARCHAR(255)     NOT NULL,
    address_line2            VARCHAR(255),
    city                     VARCHAR(100)     NOT NULL,
    state_province           VARCHAR(100),
    postal_code              VARCHAR(20)      NOT NULL,
    country                  VARCHAR(100)     NOT NULL,
    submitted_at             TIMESTAMP,
    last_reviewed_at         TIMESTAMP,
    reviewer_id              UUID             REFERENCES users(id),
    rejection_reason         TEXT,
    revision_notes           TEXT,
    is_critical_edit_pending BOOLEAN          NOT NULL DEFAULT FALSE,
    created_at               TIMESTAMP        NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMP        NOT NULL DEFAULT NOW()
);

-- -------------------------
-- SUPPLIER CONTACTS
-- -------------------------

CREATE TABLE supplier_contacts (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id  UUID         NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
    contact_type contact_type NOT NULL,
    full_name    VARCHAR(255) NOT NULL,
    job_title    VARCHAR(100),
    email        VARCHAR(255) NOT NULL,
    phone        VARCHAR(50),
    is_primary   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Only one primary contact allowed per supplier
CREATE UNIQUE INDEX uq_supplier_primary_contact
    ON supplier_contacts(supplier_id)
    WHERE is_primary = TRUE;

-- -------------------------
-- SUPPLIER DOCUMENTS
-- -------------------------

CREATE TABLE supplier_documents (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id       UUID          NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
    document_type     document_type NOT NULL,
    original_filename VARCHAR(255)  NOT NULL,
    storage_key       VARCHAR(512)  NOT NULL,
    mime_type         VARCHAR(100)  NOT NULL,
    file_size_bytes   BIGINT        NOT NULL,
    uploaded_by       UUID          NOT NULL REFERENCES users(id),
    is_current        BOOLEAN       NOT NULL DEFAULT TRUE,
    expiry_date       DATE,
    notes             TEXT,
    uploaded_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- -------------------------
-- SERVICE CATEGORIES
-- -------------------------

CREATE TABLE service_categories (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(50) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    parent_id  UUID        REFERENCES service_categories(id),
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- -------------------------
-- SUPPLIER ↔ SERVICE CATEGORIES
-- -------------------------

CREATE TABLE supplier_service_categories (
    supplier_id UUID      NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
    category_id UUID      NOT NULL REFERENCES service_categories(id),
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (supplier_id, category_id)
);

-- -------------------------
-- VALIDATION REVIEWS
-- -------------------------

CREATE TABLE validation_reviews (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     UUID            NOT NULL REFERENCES supplier_profiles(id),
    reviewer_id     UUID            NOT NULL REFERENCES users(id),
    action          review_action   NOT NULL,
    comment         TEXT,
    internal_note   TEXT,
    previous_status supplier_status NOT NULL,
    new_status      supplier_status NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- -------------------------
-- STATUS HISTORY
-- -------------------------

CREATE TABLE status_history (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID            NOT NULL REFERENCES supplier_profiles(id),
    from_status supplier_status,
    to_status   supplier_status NOT NULL,
    changed_by  UUID            NOT NULL REFERENCES users(id),
    reason      TEXT,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- -------------------------
-- NOTIFICATION REMINDERS
-- -------------------------

CREATE TABLE notification_reminders (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id   UUID          NOT NULL REFERENCES supplier_profiles(id),
    reminder_type reminder_type NOT NULL,
    scheduled_for TIMESTAMP     NOT NULL,
    sent_at       TIMESTAMP,
    is_dismissed  BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- -------------------------
-- INDEXES
-- -------------------------

CREATE INDEX idx_supplier_status         ON supplier_profiles(status);
CREATE INDEX idx_supplier_country        ON supplier_profiles(country);
CREATE INDEX idx_supplier_company_name   ON supplier_profiles(company_name);
CREATE INDEX idx_doc_supplier            ON supplier_documents(supplier_id);
CREATE INDEX idx_doc_is_current          ON supplier_documents(supplier_id, is_current);
CREATE INDEX idx_review_supplier         ON validation_reviews(supplier_id);
CREATE INDEX idx_status_history_supplier ON status_history(supplier_id);
CREATE INDEX idx_reminder_scheduled      ON notification_reminders(scheduled_for)
    WHERE sent_at IS NULL;
