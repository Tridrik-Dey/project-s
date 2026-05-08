ALTER TABLE users
    ADD COLUMN IF NOT EXISTS validator_last_seen_pending_at TIMESTAMP;

UPDATE users
SET validator_last_seen_pending_at = NOW()
WHERE role IN ('VALIDATOR', 'ADMIN')
  AND validator_last_seen_pending_at IS NULL;
