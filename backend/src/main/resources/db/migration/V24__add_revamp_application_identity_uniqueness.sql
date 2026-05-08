ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS identity_key_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS identity_value_normalized VARCHAR(128);

WITH latest_s1 AS (
    SELECT DISTINCT ON (s.application_id)
        s.application_id,
        s.payload_json
    FROM application_sections s
    WHERE s.section_key = 'S1'
      AND s.is_latest = TRUE
    ORDER BY s.application_id, s.section_version DESC
)
UPDATE applications a
SET identity_key_type = CASE
        WHEN a.registry_type = 'ALBO_A' THEN 'TAX_CODE'
        WHEN a.registry_type = 'ALBO_B' THEN 'VAT_NUMBER'
        ELSE NULL
    END,
    identity_value_normalized = CASE
        WHEN a.registry_type = 'ALBO_A' THEN upper(regexp_replace(coalesce(latest_s1.payload_json ->> 'taxCode', ''), '\s+', '', 'g'))
        WHEN a.registry_type = 'ALBO_B' THEN upper(regexp_replace(coalesce(latest_s1.payload_json ->> 'vatNumber', latest_s1.payload_json ->> 'piva', ''), '\s+', '', 'g'))
        ELSE NULL
    END
FROM latest_s1
WHERE latest_s1.application_id = a.id
  AND (
      (a.registry_type = 'ALBO_A' AND coalesce(latest_s1.payload_json ->> 'taxCode', '') <> '')
      OR (a.registry_type = 'ALBO_B' AND coalesce(latest_s1.payload_json ->> 'vatNumber', latest_s1.payload_json ->> 'piva', '') <> '')
  );

UPDATE applications
SET identity_key_type = NULL,
    identity_value_normalized = NULL
WHERE identity_value_normalized = '';

CREATE UNIQUE INDEX IF NOT EXISTS uk_applications_active_identity
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
