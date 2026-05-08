-- Field Change Request feature
-- Stores supplier requests to change a section of their approved profile,
-- tracks admin unlock/reject, before/after values for audit trail,
-- and links to the review case created after supplier submits.

CREATE TABLE IF NOT EXISTS field_change_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID NOT NULL REFERENCES applications(id),
    section_key         VARCHAR(16) NOT NULL,
    supplier_message    TEXT NOT NULL,
    status              VARCHAR(32) NOT NULL,
    admin_note          TEXT,
    unlocked_by_user_id UUID REFERENCES users(id),
    unlocked_at         TIMESTAMP,
    submitted_at        TIMESTAMP,
    before_value_json   JSONB,
    after_value_json    JSONB,
    review_case_id      UUID REFERENCES review_cases(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fcr_application_id ON field_change_requests(application_id);
CREATE INDEX IF NOT EXISTS idx_fcr_review_case_id ON field_change_requests(review_case_id);
CREATE INDEX IF NOT EXISTS idx_fcr_status         ON field_change_requests(status);

-- Also add the new application status value (no-op in Postgres enums stored as VARCHAR)
-- If ApplicationStatus is stored as a Postgres enum type, run:
-- ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'FIELD_CHANGE_IN_PROGRESS';
