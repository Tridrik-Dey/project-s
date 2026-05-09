ALTER TABLE document_renewal_requests
    ADD COLUMN IF NOT EXISTS batch_id VARCHAR(128);

UPDATE document_renewal_requests
SET batch_id = COALESCE(batch_id, 'legacy-' || id::text)
WHERE batch_id IS NULL OR batch_id = '';

ALTER TABLE document_renewal_requests
    ALTER COLUMN batch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_renewal_batch_id ON document_renewal_requests(batch_id);
CREATE INDEX IF NOT EXISTS idx_doc_renewal_application_batch ON document_renewal_requests(application_id, batch_id);
