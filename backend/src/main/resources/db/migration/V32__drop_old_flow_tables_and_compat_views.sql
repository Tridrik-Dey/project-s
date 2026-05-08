-- Drop old compatibility views (revamp_ prefixed views pointing to renamed tables)
DROP VIEW IF EXISTS revamp_application_attachments;
DROP VIEW IF EXISTS revamp_application_sections;
DROP VIEW IF EXISTS revamp_applications;
DROP VIEW IF EXISTS revamp_audit_events;
DROP VIEW IF EXISTS revamp_evaluation_dimensions;
DROP VIEW IF EXISTS revamp_evaluations;
DROP VIEW IF EXISTS revamp_integration_requests;
DROP VIEW IF EXISTS revamp_invites;
DROP VIEW IF EXISTS revamp_notification_events;
DROP VIEW IF EXISTS revamp_otp_challenges;
DROP VIEW IF EXISTS revamp_review_cases;
DROP VIEW IF EXISTS revamp_supplier_registry_profile_details;
DROP VIEW IF EXISTS revamp_supplier_registry_profiles;
DROP VIEW IF EXISTS revamp_user_admin_roles;

-- Drop old flow tables (child tables first to respect FK constraints)
DROP TABLE IF EXISTS notification_reminders CASCADE;
DROP TABLE IF EXISTS supplier_contacts CASCADE;
DROP TABLE IF EXISTS supplier_documents CASCADE;
DROP TABLE IF EXISTS supplier_service_categories CASCADE;
DROP TABLE IF EXISTS status_history CASCADE;
DROP TABLE IF EXISTS supplier_profiles CASCADE;
