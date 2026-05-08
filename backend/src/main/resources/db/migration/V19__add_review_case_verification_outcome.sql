-- Add verification outcome to review_cases for explicit "Completa verifica" result tracking
ALTER TABLE review_cases
    ADD COLUMN IF NOT EXISTS verification_outcome VARCHAR(64);

-- Backfill existing verified rows to a default explicit outcome
UPDATE review_cases
SET verification_outcome = 'COMPLIANT'
WHERE verified_at IS NOT NULL
  AND verification_outcome IS NULL;
