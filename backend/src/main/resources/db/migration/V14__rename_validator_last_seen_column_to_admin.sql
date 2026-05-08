DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'validator_last_seen_pending_at'
    ) THEN
        ALTER TABLE users
            RENAME COLUMN validator_last_seen_pending_at TO admin_last_seen_pending_at;
    END IF;
END $$;
