BEGIN;

-- Remove old invalid seeded supplier/application dataset
DELETE FROM supplier_registry_profiles
WHERE application_id = 'a00a5eed-1111-2222-3333-444444444444';

DELETE FROM applications
WHERE id = 'a00a5eed-1111-2222-3333-444444444444';

DELETE FROM otp_challenges
WHERE application_id = 'a00a5eed-1111-2222-3333-444444444444'
   OR user_id = 'aeed1111-aaaa-bbbb-cccc-dddddddddddd';

DELETE FROM audit_events
WHERE entity_id = 'a00a5eed-1111-2222-3333-444444444444'
   OR actor_user_id = 'aeed1111-aaaa-bbbb-cccc-dddddddddddd';

DELETE FROM users
WHERE id = 'aeed1111-aaaa-bbbb-cccc-dddddddddddd';

-- Insert replacement supplier user with proper UUID
INSERT INTO users (
    id, email, password_hash, full_name, role, is_active, created_at, updated_at
) VALUES (
    '8c1d2e3f-4a5b-4c6d-9e8f-112233445566',
    'mario.rossi.seed@supplierplatform.it',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Mario Rossi',
    'SUPPLIER',
    true,
    now(),
    now()
);

-- Insert replacement application with proper UUID
INSERT INTO applications (
    id, applicant_user_id, registry_type, source_channel, status, protocol_code,
    current_revision, submitted_at, created_at, updated_at
) VALUES (
    '7b2e9f24-6f7a-4d1a-8b2f-1c4e5a7d9f10',
    '8c1d2e3f-4a5b-4c6d-9e8f-112233445566',
    'ALBO_A',
    'PUBLIC',
    'UNDER_REVIEW',
    'ALB-A-2026-SEED02',
    1,
    now() - interval '2 days',
    now() - interval '2 days',
    now()
);

INSERT INTO application_sections (
    id, application_id, section_key, section_version, payload_json, is_latest, completed, validated_at, created_at, updated_at
) VALUES
(
    '11111111-2222-4333-8aaa-000000000001',
    '7b2e9f24-6f7a-4d1a-8b2f-1c4e5a7d9f10',
    'S1',
    1,
    $$
    {
      "legalRepresentativeName": "Mario Rossi",
      "taxCode": "RSSMRA80A01H501U",
      "phone": "+39 333 1234567",
      "city": "Milano",
      "province": "MI",
      "postalCode": "20100"
    }
    $$::jsonb,
    true,
    true,
    now() - interval '1 day',
    now() - interval '2 days',
    now()
),
(
    '11111111-2222-4333-8aaa-000000000002',
    '7b2e9f24-6f7a-4d1a-8b2f-1c4e5a7d9f10',
    'S2',
    1,
    $$
    {
      "professionalType": "Docente / Formatore",
      "atecoCode": "85.59.20",
      "employeeRange": "1-9"
    }
    $$::jsonb,
    true,
    true,
    now() - interval '1 day',
    now() - interval '2 days',
    now()
),
(
    '11111111-2222-4333-8aaa-000000000003',
    '7b2e9f24-6f7a-4d1a-8b2f-1c4e5a7d9f10',
    'S3',
    1,
    $$
    {
      "thematicAreasCsv": "Digital Learning, Formazione manageriale",
      "specialization": "LMS, e-learning, instructional design"
    }
    $$::jsonb,
    true,
    true,
    now() - interval '1 day',
    now() - interval '2 days',
    now()
),
(
    '11111111-2222-4333-8aaa-000000000004',
    '7b2e9f24-6f7a-4d1a-8b2f-1c4e5a7d9f10',
    'S4',
    1,
    $$
    {
      "attachments": [
        {
          "documentType": "OTHER",
          "fileName": "Screenshot 2026-04-22 173014.png",
          "storageKey": "http://127.0.0.1:3000/seed-doc-7b2e9f24.png",
          "expired": false,
          "expiringSoon": false
        }
      ],
      "operationalCapacity": "Disponibile su territorio nazionale"
    }
    $$::jsonb,
    true,
    true,
    now() - interval '1 day',
    now() - interval '2 days',
    now()
),
(
    '11111111-2222-4333-8aaa-000000000005',
    '7b2e9f24-6f7a-4d1a-8b2f-1c4e5a7d9f10',
    'S5',
    1,
    $$
    {
      "acceptance1": true,
      "acceptance2": true,
      "acceptance3": true
    }
    $$::jsonb,
    true,
    true,
    now() - interval '1 day',
    now() - interval '2 days',
    now()
);

INSERT INTO application_attachments (
    id, application_id, section_key, field_key, document_type, file_name, mime_type, size_bytes, storage_key, uploaded_at
) VALUES (
    '22222222-3333-4444-8bbb-000000000001',
    '7b2e9f24-6f7a-4d1a-8b2f-1c4e5a7d9f10',
    'S4',
    'seed_doc',
    'OTHER',
    'Screenshot 2026-04-22 173014.png',
    'image/png',
    144638,
    'http://127.0.0.1:3000/seed-doc-7b2e9f24.png',
    now()
);

INSERT INTO review_cases (
    id, application_id, status,
    assigned_to_user_id, assigned_at,
    verified_by_user_id, verified_at, verification_note, verification_outcome,
    sla_due_at, created_at, updated_at
) VALUES (
    '3f5e7c91-2a4b-4d8e-9f10-223344556677',
    '7b2e9f24-6f7a-4d1a-8b2f-1c4e5a7d9f10',
    'READY_FOR_DECISION',
    'c0000001-0000-0000-0000-000000000001',
    now() - interval '1 day',
    'c0000001-0000-0000-0000-000000000001',
    now() - interval '12 hours',
    'Verifica iniziale completata dal revisore.',
    'COMPLIANT',
    now() + interval '5 days',
    now() - interval '1 day',
    now()
);

COMMIT;
