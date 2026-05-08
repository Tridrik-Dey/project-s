-- Add a second VIEWER admin account for evaluation testing.
-- Password is bcrypt of 'Admin@1234'.

INSERT INTO users (id, email, password_hash, role, is_active, email_verified)
VALUES (
    gen_random_uuid(),
    'viewer2@supplierplatform.com',
    '$2b$12$hA8/MvrZ35gW3V4KXK/BHe0G7yVkDfgPFNM1vjdlkaEm2Trp5qs4W',
    'ADMIN',
    true,
    true
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = true,
    email_verified = true;

INSERT INTO user_admin_roles (id, user_id, admin_role, created_by_user_id)
SELECT
    gen_random_uuid(),
    viewer.id,
    'VIEWER',
    admin.id
FROM users viewer
LEFT JOIN users admin ON admin.email = 'admin@supplierplatform.com'
WHERE viewer.email = 'viewer2@supplierplatform.com'
ON CONFLICT (user_id) DO UPDATE
SET admin_role = EXCLUDED.admin_role;
