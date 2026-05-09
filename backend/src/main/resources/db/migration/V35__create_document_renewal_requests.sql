CREATE TABLE IF NOT EXISTS document_renewal_requests (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id         UUID NOT NULL REFERENCES applications(id),
    review_case_id         UUID REFERENCES review_cases(id),
    section_key            VARCHAR(16) NOT NULL,
    document_type          VARCHAR(64) NOT NULL,
    document_label         VARCHAR(255) NOT NULL,
    integration_item_code  VARCHAR(96) NOT NULL,
    certification_key      VARCHAR(64),
    expiry_date            DATE,
    status                 VARCHAR(32) NOT NULL,
    old_attachment_json    JSONB,
    new_attachment_json    JSONB,
    submitted_at           TIMESTAMP,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_renewal_application_id ON document_renewal_requests(application_id);
CREATE INDEX IF NOT EXISTS idx_doc_renewal_review_case_id ON document_renewal_requests(review_case_id);
CREATE INDEX IF NOT EXISTS idx_doc_renewal_status ON document_renewal_requests(status);
CREATE INDEX IF NOT EXISTS idx_doc_renewal_expiry_date ON document_renewal_requests(expiry_date);
