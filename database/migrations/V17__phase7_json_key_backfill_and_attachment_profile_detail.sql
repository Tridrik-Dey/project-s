-- =============================================================
-- Phase 7 Step 1:
-- - Materialize missing final revamp tables introduced in code:
--   * application_attachments
--   * supplier_registry_profile_details
-- - Backfill canonical S5 declaration keys from legacy aliases.
-- - Backfill attachment rows from S4 JSON attachments arrays.
-- - Backfill profile detail/projection rows for already-approved profiles.
-- =============================================================

-- -------------------------
-- FINAL TABLES (idempotent)
-- -------------------------
CREATE TABLE IF NOT EXISTS application_attachments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID         NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    section_key    VARCHAR(32)  NOT NULL,
    field_key      VARCHAR(64),
    document_type  VARCHAR(40)  NOT NULL CHECK (document_type IN ('CV', 'VISURA_CAMERALE', 'DURC', 'COMPANY_PROFILE', 'CERTIFICATION', 'OTHER')),
    file_name      VARCHAR(255) NOT NULL,
    mime_type      VARCHAR(255),
    size_bytes     BIGINT,
    storage_key    VARCHAR(255) NOT NULL,
    uploaded_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_application_attachments_app_section
    ON application_attachments(application_id, section_key);

CREATE INDEX IF NOT EXISTS idx_application_attachments_doc_type
    ON application_attachments(document_type, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS supplier_registry_profile_details (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id                    UUID         NOT NULL UNIQUE REFERENCES supplier_registry_profiles(id) ON DELETE CASCADE,
    projected_json                JSONB        NOT NULL DEFAULT '{}'::jsonb,
    search_ateco_primary          VARCHAR(255),
    search_regions_csv            TEXT,
    search_service_categories_csv TEXT,
    search_certifications_csv     TEXT,
    created_at                    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_registry_profile_details_ateco
    ON supplier_registry_profile_details(search_ateco_primary);

CREATE INDEX IF NOT EXISTS idx_supplier_registry_profile_details_profile
    ON supplier_registry_profile_details(profile_id);

-- Keep compatibility aliases when legacy revamp_* object names are referenced.
DO $$
BEGIN
    IF to_regclass('public.application_attachments') IS NOT NULL
       AND to_regclass('public.revamp_application_attachments') IS NULL THEN
        EXECUTE 'CREATE VIEW public.revamp_application_attachments AS SELECT * FROM public.application_attachments';
    END IF;

    IF to_regclass('public.supplier_registry_profile_details') IS NOT NULL
       AND to_regclass('public.revamp_supplier_registry_profile_details') IS NULL THEN
        EXECUTE 'CREATE VIEW public.revamp_supplier_registry_profile_details AS SELECT * FROM public.supplier_registry_profile_details';
    END IF;
END
$$;

-- ---------------------------------
-- S5 CANONICAL JSON KEY BACKFILL
-- ---------------------------------
UPDATE application_sections s
SET payload_json = s.payload_json || jsonb_strip_nulls(jsonb_build_object(
    'truthfulnessDeclaration',
    CASE
        WHEN s.payload_json ? 'truthfulnessDeclaration' THEN NULL
        WHEN s.payload_json ? 'declarationTruthful' THEN s.payload_json -> 'declarationTruthful'
        ELSE NULL
    END,
    'noConflictOfInterest',
    CASE
        WHEN s.payload_json ? 'noConflictOfInterest' THEN NULL
        WHEN s.payload_json ? 'declarationNoConflict' THEN s.payload_json -> 'declarationNoConflict'
        ELSE NULL
    END,
    'qualityEnvSafetyAccepted',
    CASE
        WHEN s.payload_json ? 'qualityEnvSafetyAccepted' THEN NULL
        WHEN s.payload_json ? 'qualityStandardsAccepted' THEN s.payload_json -> 'qualityStandardsAccepted'
        ELSE NULL
    END,
    'alboDataProcessingConsent',
    CASE
        WHEN s.payload_json ? 'alboDataProcessingConsent' THEN NULL
        WHEN s.payload_json ? 'dataProcessingConsent' THEN s.payload_json -> 'dataProcessingConsent'
        ELSE NULL
    END,
    'noCriminalConvictions',
    CASE
        WHEN s.payload_json ? 'noCriminalConvictions' THEN NULL
        WHEN s.payload_json ? 'declarationTruthful' THEN s.payload_json -> 'declarationTruthful'
        ELSE NULL
    END
))
WHERE UPPER(s.section_key) = 'S5'
  AND (
      (s.payload_json ? 'declarationTruthful' AND NOT (s.payload_json ? 'truthfulnessDeclaration'))
   OR (s.payload_json ? 'declarationNoConflict' AND NOT (s.payload_json ? 'noConflictOfInterest'))
   OR (s.payload_json ? 'qualityStandardsAccepted' AND NOT (s.payload_json ? 'qualityEnvSafetyAccepted'))
   OR (s.payload_json ? 'dataProcessingConsent' AND NOT (s.payload_json ? 'alboDataProcessingConsent'))
   OR (s.payload_json ? 'declarationTruthful' AND NOT (s.payload_json ? 'noCriminalConvictions'))
  );

-- ---------------------------------
-- ATTACHMENT ROW BACKFILL (S4 JSON)
-- ---------------------------------
WITH s4_latest AS (
    SELECT
        s.application_id,
        s.payload_json,
        s.created_at,
        s.updated_at
    FROM application_sections s
    WHERE UPPER(s.section_key) = 'S4'
      AND s.is_latest = TRUE
      AND jsonb_typeof(s.payload_json -> 'attachments') = 'array'
),
exploded AS (
    SELECT
        l.application_id,
        l.created_at,
        l.updated_at,
        a.value AS item
    FROM s4_latest l
    CROSS JOIN LATERAL jsonb_array_elements(l.payload_json -> 'attachments') a(value)
)
INSERT INTO application_attachments (
    application_id,
    section_key,
    field_key,
    document_type,
    file_name,
    mime_type,
    size_bytes,
    storage_key,
    uploaded_at,
    expires_at
)
SELECT
    e.application_id,
    'S4',
    NULLIF(TRIM(e.item ->> 'fieldKey'), ''),
    CASE
        WHEN UPPER(COALESCE(e.item ->> 'documentType', '')) IN ('CV', 'VISURA_CAMERALE', 'DURC', 'COMPANY_PROFILE', 'CERTIFICATION', 'OTHER')
            THEN UPPER(e.item ->> 'documentType')
        ELSE 'OTHER'
    END,
    COALESCE(NULLIF(TRIM(e.item ->> 'fileName'), ''), 'attachment.bin'),
    NULLIF(TRIM(e.item ->> 'mimeType'), ''),
    CASE
        WHEN COALESCE(e.item ->> 'sizeBytes', '') ~ '^[0-9]+$' THEN (e.item ->> 'sizeBytes')::BIGINT
        ELSE NULL
    END,
    COALESCE(
        NULLIF(TRIM(e.item ->> 'storageKey'), ''),
        NULLIF(TRIM(e.item ->> 'url'), ''),
        NULLIF(TRIM(e.item ->> 'fileName'), '')
    ),
    COALESCE(
        CASE
            WHEN COALESCE(e.item ->> 'uploadedAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (e.item ->> 'uploadedAt')::TIMESTAMP
            ELSE NULL
        END,
        e.updated_at,
        e.created_at,
        NOW()
    ),
    CASE
        WHEN COALESCE(e.item ->> 'expiresAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (e.item ->> 'expiresAt')::DATE::TIMESTAMP
        WHEN COALESCE(e.item ->> 'expiresAt', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (e.item ->> 'expiresAt')::TIMESTAMP
        ELSE NULL
    END
FROM exploded e
WHERE COALESCE(
        NULLIF(TRIM(e.item ->> 'storageKey'), ''),
        NULLIF(TRIM(e.item ->> 'url'), ''),
        NULLIF(TRIM(e.item ->> 'fileName'), '')
      ) IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM application_attachments x
      WHERE x.application_id = e.application_id
        AND x.section_key = 'S4'
        AND x.storage_key = COALESCE(
            NULLIF(TRIM(e.item ->> 'storageKey'), ''),
            NULLIF(TRIM(e.item ->> 'url'), ''),
            NULLIF(TRIM(e.item ->> 'fileName'), '')
        )
        AND x.file_name = COALESCE(NULLIF(TRIM(e.item ->> 'fileName'), ''), 'attachment.bin')
  );

-- -------------------------------------------------
-- PROFILE DETAIL BACKFILL FOR ALREADY-APPROVED DATA
-- -------------------------------------------------
WITH profile_source AS (
    SELECT
        p.id AS profile_id,
        p.application_id,
        p.registry_type,
        p.display_name,
        p.status,
        p.is_visible,
        p.expires_at,
        p.updated_at,
        p.aggregate_score,
        s2.payload_json AS s2_json,
        COALESCE(
            CASE WHEN p.registry_type = 'ALBO_B' THEN s3.payload_json ELSE NULL END,
            s3a.payload_json,
            s3b.payload_json
        ) AS s3x_json,
        s4.payload_json AS s4_json
    FROM supplier_registry_profiles p
    LEFT JOIN LATERAL (
        SELECT payload_json
        FROM application_sections
        WHERE application_id = p.application_id
          AND UPPER(section_key) = 'S2'
          AND is_latest = TRUE
        ORDER BY section_version DESC
        LIMIT 1
    ) s2 ON TRUE
    LEFT JOIN LATERAL (
        SELECT payload_json
        FROM application_sections
        WHERE application_id = p.application_id
          AND UPPER(section_key) = 'S3'
          AND is_latest = TRUE
        ORDER BY section_version DESC
        LIMIT 1
    ) s3 ON TRUE
    LEFT JOIN LATERAL (
        SELECT payload_json
        FROM application_sections
        WHERE application_id = p.application_id
          AND UPPER(section_key) = 'S3A'
          AND is_latest = TRUE
        ORDER BY section_version DESC
        LIMIT 1
    ) s3a ON TRUE
    LEFT JOIN LATERAL (
        SELECT payload_json
        FROM application_sections
        WHERE application_id = p.application_id
          AND UPPER(section_key) = 'S3B'
          AND is_latest = TRUE
        ORDER BY section_version DESC
        LIMIT 1
    ) s3b ON TRUE
    LEFT JOIN LATERAL (
        SELECT payload_json
        FROM application_sections
        WHERE application_id = p.application_id
          AND UPPER(section_key) = 'S4'
          AND is_latest = TRUE
        ORDER BY section_version DESC
        LIMIT 1
    ) s4 ON TRUE
    WHERE NOT EXISTS (
        SELECT 1
        FROM supplier_registry_profile_details d
        WHERE d.profile_id = p.id
    )
),
prepared AS (
    SELECT
        ps.*,
        NULLIF(TRIM(COALESCE(ps.s2_json ->> 'atecoPrimary', '')), '') AS ateco_primary,
        CASE
            WHEN ps.registry_type = 'ALBO_B' THEN
                COALESCE((
                    SELECT string_agg(TRIM(v ->> 'region'), ',' ORDER BY TRIM(v ->> 'region'))
                    FROM jsonb_array_elements(COALESCE(ps.s2_json -> 'operatingRegions', '[]'::jsonb)) v
                    WHERE TRIM(v ->> 'region') <> ''
                ), '')
            ELSE
                COALESCE(
                    NULLIF(TRIM(ps.s3x_json #>> '{territory,regionsCsv}'), ''),
                    NULLIF(TRIM(ps.s3x_json ->> 'territory'), ''),
                    ''
                )
        END AS regions_csv,
        CASE
            WHEN ps.registry_type = 'ALBO_B' THEN
                COALESCE((
                    SELECT string_agg(k.key, ',' ORDER BY k.key)
                    FROM jsonb_object_keys(COALESCE(ps.s3x_json -> 'servicesByCategory', '{}'::jsonb)) AS k(key)
                ), '')
            ELSE
                COALESCE(NULLIF(TRIM(ps.s3x_json ->> 'serviceCategoriesCsv'), ''), '')
        END AS service_categories_csv,
        COALESCE(NULLIF(TRIM(ps.s4_json ->> 'accreditationSummary'), ''), '') AS certifications_csv
    FROM profile_source ps
)
INSERT INTO supplier_registry_profile_details (
    profile_id,
    projected_json,
    search_ateco_primary,
    search_regions_csv,
    search_service_categories_csv,
    search_certifications_csv,
    created_at,
    updated_at
)
SELECT
    p.profile_id,
    jsonb_build_object(
        'applicationId', COALESCE(p.application_id::TEXT, ''),
        'registryType', COALESCE(p.registry_type, ''),
        'projectedAt', NOW(),
        'search', jsonb_build_object(
            'atecoPrimary', COALESCE(p.ateco_primary, ''),
            'regionsCsv', COALESCE(p.regions_csv, ''),
            'serviceCategoriesCsv', COALESCE(p.service_categories_csv, ''),
            'certificationsCsv', COALESCE(p.certifications_csv, '')
        ),
        'publicCardView', jsonb_build_object(
            'displayName', COALESCE(p.display_name, ''),
            'registryType', COALESCE(p.registry_type, ''),
            'score', COALESCE(p.aggregate_score, 0),
            'territory', COALESCE(p.regions_csv, ''),
            'atecoPrimary', COALESCE(p.ateco_primary, '')
        ),
        'adminCardView', jsonb_build_object(
            'displayName', COALESCE(p.display_name, ''),
            'status', COALESCE(p.status, ''),
            'visible', COALESCE(p.is_visible, FALSE),
            'expiresAt', COALESCE(p.expires_at::TEXT, ''),
            'updatedAt', COALESCE(p.updated_at::TEXT, ''),
            'score', COALESCE(p.aggregate_score, 0),
            'atecoPrimary', COALESCE(p.ateco_primary, ''),
            'territory', COALESCE(p.regions_csv, ''),
            'serviceCategoriesCsv', COALESCE(p.service_categories_csv, ''),
            'certificationsCsv', COALESCE(p.certifications_csv, '')
        )
    ),
    p.ateco_primary,
    NULLIF(p.regions_csv, ''),
    NULLIF(p.service_categories_csv, ''),
    NULLIF(p.certifications_csv, ''),
    NOW(),
    NOW()
FROM prepared p;

-- Align helper search columns from projected_json when available.
UPDATE supplier_registry_profile_details d
SET
    search_ateco_primary = COALESCE(d.search_ateco_primary, NULLIF(d.projected_json #>> '{search,atecoPrimary}', '')),
    search_regions_csv = COALESCE(d.search_regions_csv, NULLIF(d.projected_json #>> '{search,regionsCsv}', '')),
    search_service_categories_csv = COALESCE(d.search_service_categories_csv, NULLIF(d.projected_json #>> '{search,serviceCategoriesCsv}', '')),
    search_certifications_csv = COALESCE(d.search_certifications_csv, NULLIF(d.projected_json #>> '{search,certificationsCsv}', ''))
WHERE
    d.search_ateco_primary IS NULL
    OR d.search_regions_csv IS NULL
    OR d.search_service_categories_csv IS NULL
    OR d.search_certifications_csv IS NULL;
