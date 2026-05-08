-- =============================================================
-- Rename remaining revamp_* DB object names to final labels
-- (non-destructive: object names only, no data movement)
-- =============================================================

CREATE OR REPLACE FUNCTION public.__rename_index_if_exists(old_name text, new_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    old_exists boolean;
    new_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = old_name
          AND c.relkind = 'i'
    ) INTO old_exists;

    SELECT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = new_name
          AND c.relkind = 'i'
    ) INTO new_exists;

    IF old_exists AND NOT new_exists THEN
        EXECUTE format('ALTER INDEX public.%I RENAME TO %I', old_name, new_name);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.__rename_constraint_if_exists(old_name text, new_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    target_table text;
    new_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conname = new_name
    ) INTO new_exists;

    IF new_exists THEN
        RETURN;
    END IF;

    SELECT format('%I.%I', n.nspname, cls.relname)
    INTO target_table
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE c.conname = old_name
      AND n.nspname = 'public'
    LIMIT 1;

    IF target_table IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', target_table, old_name, new_name);
    END IF;
END
$$;

SELECT public.__rename_index_if_exists('idx_revamp_invites_email_status', 'idx_invites_email_status');
SELECT public.__rename_index_if_exists('idx_revamp_invites_expires_at', 'idx_invites_expires_at');
SELECT public.__rename_index_if_exists('idx_revamp_applications_user_status', 'idx_applications_user_status');
SELECT public.__rename_index_if_exists('idx_revamp_applications_registry_status', 'idx_applications_registry_status');
SELECT public.__rename_index_if_exists('idx_revamp_app_sections_lookup', 'idx_application_sections_lookup');
SELECT public.__rename_index_if_exists('idx_revamp_otp_lookup', 'idx_otp_challenges_lookup');
SELECT public.__rename_index_if_exists('idx_revamp_review_cases_status', 'idx_review_cases_status');
SELECT public.__rename_index_if_exists('idx_revamp_integration_requests_status_due', 'idx_integration_requests_status_due');
SELECT public.__rename_index_if_exists('idx_revamp_registry_profiles_status', 'idx_supplier_registry_profiles_status');
SELECT public.__rename_index_if_exists('idx_revamp_registry_profiles_expiry', 'idx_supplier_registry_profiles_expiry');
SELECT public.__rename_index_if_exists('idx_revamp_evaluations_supplier', 'idx_evaluations_supplier');
SELECT public.__rename_index_if_exists('idx_revamp_notif_events_entity', 'idx_notification_events_entity');
SELECT public.__rename_index_if_exists('idx_revamp_notif_events_status', 'idx_notification_events_status');
SELECT public.__rename_index_if_exists('idx_revamp_audit_entity', 'idx_audit_events_entity');
SELECT public.__rename_index_if_exists('idx_revamp_audit_actor', 'idx_audit_events_actor');
SELECT public.__rename_index_if_exists('idx_revamp_audit_request', 'idx_audit_events_request');
SELECT public.__rename_index_if_exists('idx_revamp_user_admin_roles_role', 'idx_user_admin_roles_role');

SELECT public.__rename_constraint_if_exists('uk_revamp_app_section_version', 'uk_application_section_version');
SELECT public.__rename_constraint_if_exists('uk_revamp_evaluation_supplier_evaluator_period', 'uk_evaluation_supplier_evaluator_period');
SELECT public.__rename_constraint_if_exists('uk_revamp_eval_dimension_key', 'uk_evaluation_dimension_key');
SELECT public.__rename_constraint_if_exists('uk_revamp_user_admin_role', 'uk_user_admin_role');

DROP FUNCTION public.__rename_constraint_if_exists(text, text);
DROP FUNCTION public.__rename_index_if_exists(text, text);

