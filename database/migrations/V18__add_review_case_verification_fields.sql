-- Add verification fields to review_cases for Revisore handoff mechanism
ALTER TABLE review_cases
    ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMP,
    ADD COLUMN IF NOT EXISTS verification_note   TEXT;

-- Allow READY_FOR_DECISION in the status check constraint
ALTER TABLE review_cases DROP CONSTRAINT IF EXISTS review_cases_status_check;
ALTER TABLE review_cases ADD CONSTRAINT review_cases_status_check
    CHECK (status IN ('PENDING_ASSIGNMENT','IN_PROGRESS','WAITING_SUPPLIER_RESPONSE','READY_FOR_DECISION','DECIDED','CLOSED'));
