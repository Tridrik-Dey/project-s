-- Enforce one governance role per ADMIN user.
-- Priority for legacy multi-role cleanup: SUPER_ADMIN > RESPONSABILE_ALBO > REVISORE > VIEWER.

WITH ranked_roles AS (
    SELECT
        id,
        user_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY
                CASE admin_role
                    WHEN 'SUPER_ADMIN' THEN 1
                    WHEN 'RESPONSABILE_ALBO' THEN 2
                    WHEN 'REVISORE' THEN 3
                    WHEN 'VIEWER' THEN 4
                    ELSE 99
                END,
                created_at DESC,
                id
        ) AS rn
    FROM user_admin_roles
)
DELETE FROM user_admin_roles u
USING ranked_roles r
WHERE u.id = r.id
  AND r.rn > 1;

ALTER TABLE user_admin_roles
    DROP CONSTRAINT IF EXISTS uk_user_admin_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_user_admin_single_role'
          AND conrelid = 'user_admin_roles'::regclass
    ) THEN
        ALTER TABLE user_admin_roles
            ADD CONSTRAINT uk_user_admin_single_role UNIQUE (user_id);
    END IF;
END $$;
