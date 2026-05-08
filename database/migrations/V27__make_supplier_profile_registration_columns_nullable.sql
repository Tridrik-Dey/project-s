-- These columns are populated during profile submission, not at initial registration.
-- The entity already treats them as nullable; drop the DB NOT NULL constraints to match.
ALTER TABLE supplier_profiles
    ALTER COLUMN company_name             DROP NOT NULL,
    ALTER COLUMN company_type             DROP NOT NULL,
    ALTER COLUMN registration_number      DROP NOT NULL,
    ALTER COLUMN tax_id                   DROP NOT NULL,
    ALTER COLUMN country_of_incorporation DROP NOT NULL,
    ALTER COLUMN address_line1            DROP NOT NULL,
    ALTER COLUMN city                     DROP NOT NULL,
    ALTER COLUMN postal_code              DROP NOT NULL,
    ALTER COLUMN country                  DROP NOT NULL;
