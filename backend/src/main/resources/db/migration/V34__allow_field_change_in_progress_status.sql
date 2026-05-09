ALTER TABLE applications
    DROP CONSTRAINT IF EXISTS revamp_applications_status_check;

ALTER TABLE applications
    DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications
    ADD CONSTRAINT revamp_applications_status_check
        CHECK (status IN (
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
        ));
