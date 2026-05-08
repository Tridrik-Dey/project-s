ALTER TABLE supplier_profiles
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) NOT NULL DEFAULT 'IT';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_supplier_profiles_preferred_language'
    ) THEN
        ALTER TABLE supplier_profiles
            ADD CONSTRAINT chk_supplier_profiles_preferred_language
            CHECK (preferred_language IN ('IT', 'EN'));
    END IF;
END
$$;
