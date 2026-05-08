-- Run this script manually before restarting the backend.
-- Adds email_verified to users and marks all existing suppliers as verified
-- (they already completed registration before this column existed).

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET email_verified = TRUE WHERE role = 'SUPPLIER';
