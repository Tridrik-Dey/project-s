-- Drop the existing check constraint on challenge_type (whatever Hibernate named it)
DO $$
DECLARE
    c text;
BEGIN
    SELECT con.conname INTO c
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'otp_challenges'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%challenge_type%';

    IF c IS NOT NULL THEN
        EXECUTE 'ALTER TABLE otp_challenges DROP CONSTRAINT ' || quote_ident(c);
    END IF;
END $$;

-- Re-add with PASSWORD_RESET included
ALTER TABLE otp_challenges
    ADD CONSTRAINT otp_challenges_challenge_type_check
    CHECK (challenge_type IN ('EMAIL_VERIFY', 'DECLARATION_SIGNATURE', 'ADMIN_2FA', 'PASSWORD_RESET'));
