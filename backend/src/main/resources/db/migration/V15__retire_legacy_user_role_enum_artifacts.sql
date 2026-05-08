DO $$
DECLARE
    tbl text;
    con record;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['users', 'revamp_users']
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = tbl
              AND column_name = 'role'
        ) THEN
            EXECUTE format(
                'UPDATE %I SET role = ''ADMIN'' WHERE upper(role::text) = ''VALIDATOR''',
                tbl
            );

            EXECUTE format(
                'ALTER TABLE %I ALTER COLUMN role TYPE varchar(50) USING role::text',
                tbl
            );
            EXECUTE format('ALTER TABLE %I ALTER COLUMN role DROP DEFAULT', tbl);

            FOR con IN
                SELECT c.conname
                FROM pg_constraint c
                WHERE c.conrelid = to_regclass(format('public.%I', tbl))
                  AND pg_get_constraintdef(c.oid) ILIKE '%VALIDATOR%'
            LOOP
                EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, con.conname);
            END LOOP;

            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS ck_%I_role_allowed', tbl, tbl);
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT ck_%I_role_allowed CHECK (role IN (''SUPPLIER'',''ADMIN''))',
                tbl,
                tbl
            );
        END IF;
    END LOOP;
END $$;

DROP TYPE IF EXISTS user_role;
