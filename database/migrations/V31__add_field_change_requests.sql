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
