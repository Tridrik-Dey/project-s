-- =============================================================
-- Convert PostgreSQL native enum columns to VARCHAR
-- Allows Hibernate @Enumerated(EnumType.STRING) to work without
-- requiring a custom JDBC type. Values are still validated at the
-- application layer by Java enums and @NotNull constraints.
-- =============================================================

-- users.role
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50) USING role::text;

-- supplier_profiles
ALTER TABLE supplier_profiles ALTER COLUMN status DROP DEFAULT;
ALTER TABLE supplier_profiles ALTER COLUMN status            TYPE VARCHAR(50)  USING status::text;
ALTER TABLE supplier_profiles ALTER COLUMN company_type      TYPE VARCHAR(50)  USING company_type::text;
ALTER TABLE supplier_profiles ALTER COLUMN employee_count_range TYPE VARCHAR(50) USING employee_count_range::text;
ALTER TABLE supplier_profiles ALTER COLUMN annual_revenue_range TYPE VARCHAR(50) USING annual_revenue_range::text;
ALTER TABLE supplier_profiles ALTER COLUMN status SET DEFAULT 'DRAFT';

-- supplier_contacts
ALTER TABLE supplier_contacts ALTER COLUMN contact_type TYPE VARCHAR(50) USING contact_type::text;

-- supplier_documents
ALTER TABLE supplier_documents ALTER COLUMN document_type TYPE VARCHAR(50) USING document_type::text;

-- validation_reviews
ALTER TABLE validation_reviews ALTER COLUMN action          TYPE VARCHAR(50) USING action::text;
ALTER TABLE validation_reviews ALTER COLUMN previous_status TYPE VARCHAR(50) USING previous_status::text;
ALTER TABLE validation_reviews ALTER COLUMN new_status      TYPE VARCHAR(50) USING new_status::text;

-- status_history
ALTER TABLE status_history ALTER COLUMN from_status TYPE VARCHAR(50) USING from_status::text;
ALTER TABLE status_history ALTER COLUMN to_status   TYPE VARCHAR(50) USING to_status::text;

-- notification_reminders
ALTER TABLE notification_reminders ALTER COLUMN reminder_type TYPE VARCHAR(50) USING reminder_type::text;

-- Drop the now-unused custom enum types
DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS supplier_status;
DROP TYPE IF EXISTS company_type;
DROP TYPE IF EXISTS employee_count_range;
DROP TYPE IF EXISTS annual_revenue_range;
DROP TYPE IF EXISTS contact_type;
DROP TYPE IF EXISTS document_type;
DROP TYPE IF EXISTS review_action;
DROP TYPE IF EXISTS reminder_type;
