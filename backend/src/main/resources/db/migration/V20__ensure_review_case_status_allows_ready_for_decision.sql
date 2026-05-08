-- Ensure review case status constraint supports verify transition to READY_FOR_DECISION
ALTER TABLE review_cases DROP CONSTRAINT IF EXISTS review_cases_status_check;

ALTER TABLE review_cases
    ADD CONSTRAINT review_cases_status_check
        CHECK (status IN ('PENDING_ASSIGNMENT','IN_PROGRESS','WAITING_SUPPLIER_RESPONSE','READY_FOR_DECISION','DECIDED','CLOSED'));
