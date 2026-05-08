-- =============================================================
-- Revamp naming cutover bridge (non-destructive)
-- Creates final-name compatibility views over revamp_* tables.
-- =============================================================

DO $$
BEGIN
    IF to_regclass('public.invites') IS NULL THEN
        EXECUTE 'CREATE VIEW public.invites AS SELECT * FROM public.revamp_invites';
    END IF;

    IF to_regclass('public.applications') IS NULL THEN
        EXECUTE 'CREATE VIEW public.applications AS SELECT * FROM public.revamp_applications';
    END IF;

    IF to_regclass('public.application_sections') IS NULL THEN
        EXECUTE 'CREATE VIEW public.application_sections AS SELECT * FROM public.revamp_application_sections';
    END IF;

    IF to_regclass('public.otp_challenges') IS NULL THEN
        EXECUTE 'CREATE VIEW public.otp_challenges AS SELECT * FROM public.revamp_otp_challenges';
    END IF;

    IF to_regclass('public.review_cases') IS NULL THEN
        EXECUTE 'CREATE VIEW public.review_cases AS SELECT * FROM public.revamp_review_cases';
    END IF;

    IF to_regclass('public.integration_requests') IS NULL THEN
        EXECUTE 'CREATE VIEW public.integration_requests AS SELECT * FROM public.revamp_integration_requests';
    END IF;

    IF to_regclass('public.supplier_registry_profiles') IS NULL THEN
        EXECUTE 'CREATE VIEW public.supplier_registry_profiles AS SELECT * FROM public.revamp_supplier_registry_profiles';
    END IF;

    IF to_regclass('public.evaluations') IS NULL THEN
        EXECUTE 'CREATE VIEW public.evaluations AS SELECT * FROM public.revamp_evaluations';
    END IF;

    IF to_regclass('public.evaluation_dimensions') IS NULL THEN
        EXECUTE 'CREATE VIEW public.evaluation_dimensions AS SELECT * FROM public.revamp_evaluation_dimensions';
    END IF;

    IF to_regclass('public.notification_events') IS NULL THEN
        EXECUTE 'CREATE VIEW public.notification_events AS SELECT * FROM public.revamp_notification_events';
    END IF;

    IF to_regclass('public.audit_events') IS NULL THEN
        EXECUTE 'CREATE VIEW public.audit_events AS SELECT * FROM public.revamp_audit_events';
    END IF;

    IF to_regclass('public.user_admin_roles') IS NULL THEN
        EXECUTE 'CREATE VIEW public.user_admin_roles AS SELECT * FROM public.revamp_user_admin_roles';
    END IF;
END
$$;

