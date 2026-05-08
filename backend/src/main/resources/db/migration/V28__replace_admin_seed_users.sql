-- Remove old admin/validator seed users and replace with the correct admin team.
-- Uses ON CONFLICT DO NOTHING so the script is safe to re-run after partial failures.

-- 1. Delete seed audit rows created by old admins (NOT NULL columns, cannot nullify)
DELETE FROM validation_reviews
WHERE reviewer_id IN (SELECT id FROM users WHERE email IN (
    'admin@supplierplatform.com',
    'validator1@supplierplatform.com',
    'validator2@supplierplatform.com'
));

DELETE FROM status_history
WHERE changed_by IN (SELECT id FROM users WHERE email IN (
    'admin@supplierplatform.com',
    'validator1@supplierplatform.com',
    'validator2@supplierplatform.com'
));

-- 2. Nullify nullable reviewer references in supplier_profiles
UPDATE supplier_profiles
SET reviewer_id = NULL
WHERE reviewer_id IN (SELECT id FROM users WHERE email IN (
    'admin@supplierplatform.com',
    'validator1@supplierplatform.com',
    'validator2@supplierplatform.com'
));

-- 3. Remove sub-role entries for old admins
DELETE FROM user_admin_roles
WHERE user_id IN (SELECT id FROM users WHERE email IN (
    'admin@supplierplatform.com',
    'validator1@supplierplatform.com',
    'validator2@supplierplatform.com'
));

-- 4. Remove old admin users
DELETE FROM users WHERE email IN (
    'admin@supplierplatform.com',
    'validator1@supplierplatform.com',
    'validator2@supplierplatform.com'
);

-- 5. Insert new admin users (password = bcrypt of 'Admin@1234')
INSERT INTO users (id, email, password_hash, role, is_active, email_verified) VALUES
    (gen_random_uuid(), 'admin@supplierplatform.com',         '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', true, true),
    (gen_random_uuid(), 'responsabile1@supplierplatform.com', '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', true, true),
    (gen_random_uuid(), 'responsabile2@supplierplatform.com', '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', true, true),
    (gen_random_uuid(), 'revisore1@supplierplatform.com',     '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', true, true),
    (gen_random_uuid(), 'revisore2@supplierplatform.com',     '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', true, true),
    (gen_random_uuid(), 'viewer@supplierplatform.com',        '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W', 'ADMIN', true, true)
ON CONFLICT (email) DO NOTHING;

-- 6. Assign governance sub-roles (skip if already assigned)
INSERT INTO user_admin_roles (id, user_id, admin_role, created_by_user_id)
SELECT
    gen_random_uuid(),
    u.id,
    r.admin_role,
    (SELECT id FROM users WHERE email = 'admin@supplierplatform.com')
FROM (VALUES
    ('admin@supplierplatform.com',         'SUPER_ADMIN'       ),
    ('responsabile1@supplierplatform.com', 'RESPONSABILE_ALBO' ),
    ('responsabile2@supplierplatform.com', 'RESPONSABILE_ALBO' ),
    ('revisore1@supplierplatform.com',     'REVISORE'          ),
    ('revisore2@supplierplatform.com',     'REVISORE'          ),
    ('viewer@supplierplatform.com',        'VIEWER'            )
) AS r(email, admin_role)
JOIN users u ON u.email = r.email
ON CONFLICT (user_id) DO NOTHING;
