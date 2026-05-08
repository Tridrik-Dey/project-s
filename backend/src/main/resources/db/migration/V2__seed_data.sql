-- =============================================================
-- Supplier Registration Platform — Seed Data
-- =============================================================

-- -------------------------
-- SEED: Service Categories
-- -------------------------

INSERT INTO service_categories (id, code, name, parent_id) VALUES
    -- Top-level
    (gen_random_uuid(), 'IT_SERVICES',        'IT Services',              NULL),
    (gen_random_uuid(), 'CONSTRUCTION',       'Construction',             NULL),
    (gen_random_uuid(), 'LOGISTICS',          'Logistics & Transport',    NULL),
    (gen_random_uuid(), 'CONSULTING',         'Consulting',               NULL),
    (gen_random_uuid(), 'MANUFACTURING',      'Manufacturing',            NULL),
    (gen_random_uuid(), 'FACILITIES',         'Facilities Management',    NULL),
    (gen_random_uuid(), 'MARKETING',          'Marketing & Advertising',  NULL),
    (gen_random_uuid(), 'LEGAL',              'Legal Services',           NULL),
    (gen_random_uuid(), 'FINANCE',            'Finance & Accounting',     NULL),
    (gen_random_uuid(), 'HR_RECRUITMENT',     'HR & Recruitment',         NULL);

-- Subcategories for IT Services
INSERT INTO service_categories (id, code, name, parent_id) VALUES
    (gen_random_uuid(), 'IT_SOFTWARE_DEV',    'Software Development',
        (SELECT id FROM service_categories WHERE code = 'IT_SERVICES')),
    (gen_random_uuid(), 'IT_INFRASTRUCTURE',  'IT Infrastructure',
        (SELECT id FROM service_categories WHERE code = 'IT_SERVICES')),
    (gen_random_uuid(), 'IT_CYBERSECURITY',   'Cybersecurity',
        (SELECT id FROM service_categories WHERE code = 'IT_SERVICES')),
    (gen_random_uuid(), 'IT_CLOUD',           'Cloud Services',
        (SELECT id FROM service_categories WHERE code = 'IT_SERVICES'));

-- Subcategories for Logistics
INSERT INTO service_categories (id, code, name, parent_id) VALUES
    (gen_random_uuid(), 'LOG_FREIGHT',        'Freight & Shipping',
        (SELECT id FROM service_categories WHERE code = 'LOGISTICS')),
    (gen_random_uuid(), 'LOG_WAREHOUSING',    'Warehousing',
        (SELECT id FROM service_categories WHERE code = 'LOGISTICS')),
    (gen_random_uuid(), 'LOG_LAST_MILE',      'Last Mile Delivery',
        (SELECT id FROM service_categories WHERE code = 'LOGISTICS'));

-- -------------------------
-- SEED: Admin & Validator Users
-- (passwords are bcrypt of 'Admin@1234' and 'Validator@1234')
-- -------------------------

INSERT INTO users (id, email, password_hash, full_name, role) VALUES
    (
        gen_random_uuid(),
        'admin@supplierplatform.com',
        '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@1234
        'Platform Admin',
        'ADMIN'
    ),
    (
        gen_random_uuid(),
        'validator1@supplierplatform.com',
        '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@1234
        'Sarah Johnson',
        'VALIDATOR'
    ),
    (
        gen_random_uuid(),
        'validator2@supplierplatform.com',
        '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@1234
        'Mark Thompson',
        'VALIDATOR'
    );

-- -------------------------
-- SEED: Demo Supplier Users & Profiles
-- -------------------------

-- Supplier 1 — APPROVED
INSERT INTO users (id, email, password_hash, full_name, role) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'contact@techcorp.com',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Alice Brown',
    'SUPPLIER'
);

INSERT INTO supplier_profiles (
    id, user_id, status, company_name, company_type,
    registration_number, tax_id, vat_number,
    country_of_incorporation, address_line1, city, postal_code, country,
    description, submitted_at, last_reviewed_at
) VALUES (
    'aaaa1111-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'APPROVED',
    'TechCorp Solutions Ltd', 'LLC',
    'REG-TC-001', 'TAX-TC-001', 'VAT-TC-001',
    'United Kingdom', '10 Tech Street', 'London', 'EC1A 1BB', 'United Kingdom',
    'Leading provider of software development and cloud services.',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '5 days'
);

INSERT INTO supplier_contacts (supplier_id, contact_type, full_name, job_title, email, phone, is_primary)
VALUES (
    'aaaa1111-0000-0000-0000-000000000001',
    'PRIMARY', 'Alice Brown', 'CEO', 'alice@techcorp.com', '+44 7700 900001', TRUE
);

-- Supplier 2 — PENDING
INSERT INTO users (id, email, password_hash, full_name, role) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'info@buildright.com',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Carlos Mendez',
    'SUPPLIER'
);

INSERT INTO supplier_profiles (
    id, user_id, status, company_name, company_type,
    registration_number, tax_id,
    country_of_incorporation, address_line1, city, postal_code, country,
    submitted_at
) VALUES (
    'aaaa2222-0000-0000-0000-000000000002',
    '22222222-2222-2222-2222-222222222222',
    'PENDING',
    'BuildRight Construction', 'CORPORATION',
    'REG-BR-002', 'TAX-BR-002',
    'Spain', 'Calle Mayor 25', 'Madrid', '28013', 'Spain',
    NOW() - INTERVAL '2 days'
);

INSERT INTO supplier_contacts (supplier_id, contact_type, full_name, job_title, email, phone, is_primary)
VALUES (
    'aaaa2222-0000-0000-0000-000000000002',
    'PRIMARY', 'Carlos Mendez', 'Director', 'carlos@buildright.com', '+34 600 000 002', TRUE
);

-- Supplier 3 — NEEDS_REVISION
INSERT INTO users (id, email, password_hash, full_name, role) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'hello@swiftlog.com',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Fatima Al-Hassan',
    'SUPPLIER'
);

INSERT INTO supplier_profiles (
    id, user_id, status, company_name, company_type,
    registration_number, tax_id,
    country_of_incorporation, address_line1, city, postal_code, country,
    submitted_at, last_reviewed_at, revision_notes
) VALUES (
    'aaaa3333-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333',
    'NEEDS_REVISION',
    'SwiftLog Logistics', 'LLC',
    'REG-SL-003', 'TAX-SL-003',
    'UAE', 'Al Quoz Industrial Area', 'Dubai', '00000', 'United Arab Emirates',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '3 days',
    'Please upload a valid Trade License and VAT Certificate. The registration number format appears incorrect.'
);

INSERT INTO supplier_contacts (supplier_id, contact_type, full_name, job_title, email, phone, is_primary)
VALUES (
    'aaaa3333-0000-0000-0000-000000000003',
    'PRIMARY', 'Fatima Al-Hassan', 'Operations Manager', 'fatima@swiftlog.com', '+971 50 000 0003', TRUE
);

-- Supplier 4 — DRAFT
INSERT INTO users (id, email, password_hash, full_name, role) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'office@greenleaf.com',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'James O''Connor',
    'SUPPLIER'
);

INSERT INTO supplier_profiles (
    id, user_id, status, company_name, company_type,
    registration_number, tax_id,
    country_of_incorporation, address_line1, city, postal_code, country
) VALUES (
    'aaaa4444-0000-0000-0000-000000000004',
    '44444444-4444-4444-4444-444444444444',
    'DRAFT',
    'GreenLeaf Consulting', 'SOLE_TRADER',
    'REG-GL-004', 'TAX-GL-004',
    'Ireland', '5 Green Road', 'Dublin', 'D01 X2Y3', 'Ireland'
);

-- -------------------------
-- SEED: Supplier ↔ Categories
-- -------------------------

INSERT INTO supplier_service_categories (supplier_id, category_id)
SELECT 'aaaa1111-0000-0000-0000-000000000001', id
FROM service_categories
WHERE code IN ('IT_SERVICES', 'IT_SOFTWARE_DEV', 'IT_CLOUD');

INSERT INTO supplier_service_categories (supplier_id, category_id)
SELECT 'aaaa2222-0000-0000-0000-000000000002', id
FROM service_categories
WHERE code IN ('CONSTRUCTION');

INSERT INTO supplier_service_categories (supplier_id, category_id)
SELECT 'aaaa3333-0000-0000-0000-000000000003', id
FROM service_categories
WHERE code IN ('LOGISTICS', 'LOG_FREIGHT', 'LOG_WAREHOUSING');

-- -------------------------
-- SEED: Status History
-- -------------------------

INSERT INTO status_history (supplier_id, from_status, to_status, changed_by, reason) VALUES
(
    'aaaa1111-0000-0000-0000-000000000001', NULL, 'DRAFT',
    '11111111-1111-1111-1111-111111111111', 'Profile created'
),
(
    'aaaa1111-0000-0000-0000-000000000001', 'DRAFT', 'PENDING',
    '11111111-1111-1111-1111-111111111111', 'Submitted for review'
),
(
    'aaaa1111-0000-0000-0000-000000000001', 'PENDING', 'APPROVED',
    (SELECT id FROM users WHERE email = 'validator1@supplierplatform.com'),
    'All documents verified. Company profile complete.'
),
(
    'aaaa2222-0000-0000-0000-000000000002', NULL, 'DRAFT',
    '22222222-2222-2222-2222-222222222222', 'Profile created'
),
(
    'aaaa2222-0000-0000-0000-000000000002', 'DRAFT', 'PENDING',
    '22222222-2222-2222-2222-222222222222', 'Submitted for review'
),
(
    'aaaa3333-0000-0000-0000-000000000003', NULL, 'DRAFT',
    '33333333-3333-3333-3333-333333333333', 'Profile created'
),
(
    'aaaa3333-0000-0000-0000-000000000003', 'DRAFT', 'PENDING',
    '33333333-3333-3333-3333-333333333333', 'Submitted for review'
),
(
    'aaaa3333-0000-0000-0000-000000000003', 'PENDING', 'NEEDS_REVISION',
    (SELECT id FROM users WHERE email = 'validator2@supplierplatform.com'),
    'Documents missing or invalid.'
),
(
    'aaaa4444-0000-0000-0000-000000000004', NULL, 'DRAFT',
    '44444444-4444-4444-4444-444444444444', 'Profile created'
);

-- -------------------------
-- SEED: Validation Reviews
-- -------------------------

INSERT INTO validation_reviews (supplier_id, reviewer_id, action, comment, previous_status, new_status) VALUES
(
    'aaaa1111-0000-0000-0000-000000000001',
    (SELECT id FROM users WHERE email = 'validator1@supplierplatform.com'),
    'APPROVED',
    'All documents verified. Company profile complete and accurate.',
    'PENDING', 'APPROVED'
),
(
    'aaaa3333-0000-0000-0000-000000000003',
    (SELECT id FROM users WHERE email = 'validator2@supplierplatform.com'),
    'REVISION_REQUESTED',
    'Please upload a valid Trade License and VAT Certificate. The registration number format appears incorrect.',
    'PENDING', 'NEEDS_REVISION'
);
