-- =============================================================
-- Materialize final physical table names and keep revamp_* compatibility views
-- =============================================================

CREATE OR REPLACE FUNCTION public.__revamp_materialize_table_name(old_name text, new_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    old_kind "char";
    new_kind "char";
BEGIN
    SELECT c.relkind
    INTO old_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = old_name;

    SELECT c.relkind
    INTO new_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = new_name;

    -- If final name exists as a bridge view (V10), drop it so table rename can proceed.
    IF new_kind = 'v' THEN
        EXECUTE format('DROP VIEW public.%I', new_name);
        new_kind := NULL;
    END IF;

    -- Rename physical revamp table to final name when possible.
    IF old_kind = 'r' AND new_kind IS NULL THEN
        EXECUTE format('ALTER TABLE public.%I RENAME TO %I', old_name, new_name);
        old_kind := NULL;
        new_kind := 'r';
    END IF;

    -- Re-check old object kind after potential rename.
    SELECT c.relkind
    INTO old_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = old_name;

    -- Preserve backward compatibility for revamp_* references.
    IF old_kind IS NULL AND new_kind = 'r' THEN
        EXECUTE format('CREATE VIEW public.%I AS SELECT * FROM public.%I', old_name, new_name);
    END IF;
END
$$;

SELECT public.__revamp_materialize_table_name('revamp_invites', 'invites');
SELECT public.__revamp_materialize_table_name('revamp_applications', 'applications');
SELECT public.__revamp_materialize_table_name('revamp_application_sections', 'application_sections');
SELECT public.__revamp_materialize_table_name('revamp_otp_challenges', 'otp_challenges');
SELECT public.__revamp_materialize_table_name('revamp_review_cases', 'review_cases');
SELECT public.__revamp_materialize_table_name('revamp_integration_requests', 'integration_requests');
SELECT public.__revamp_materialize_table_name('revamp_supplier_registry_profiles', 'supplier_registry_profiles');
SELECT public.__revamp_materialize_table_name('revamp_evaluations', 'evaluations');
SELECT public.__revamp_materialize_table_name('revamp_evaluation_dimensions', 'evaluation_dimensions');
SELECT public.__revamp_materialize_table_name('revamp_notification_events', 'notification_events');
SELECT public.__revamp_materialize_table_name('revamp_audit_events', 'audit_events');
SELECT public.__revamp_materialize_table_name('revamp_user_admin_roles', 'user_admin_roles');

DROP FUNCTION public.__revamp_materialize_table_name(text, text);

