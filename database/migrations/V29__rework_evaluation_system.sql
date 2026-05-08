-- V29: Rework evaluation system
-- VIEWER self-assigns; only VIEWER submits evaluations; SUPER_ADMIN deletes; all others read-only.
-- Wipes all evaluation data and simplifies both tables.
-- Idempotent: safe to run multiple times.

-- 1. Wipe all evaluation data (assignments first due to FK to evaluations)
DELETE FROM supplier_evaluator_assignments;
DELETE FROM evaluations;
DELETE FROM evaluation_dimensions;

-- 2. Drop compat view that depends on annulment columns
DROP VIEW IF EXISTS revamp_evaluations CASCADE;

-- 3. Simplify supplier_evaluator_assignments: drop all workflow/draft columns
DROP INDEX IF EXISTS uk_supplier_evaluator_assignment_active_true;
DROP INDEX IF EXISTS idx_supplier_evaluator_assignments_status;
DROP INDEX IF EXISTS idx_supplier_evaluator_assignments_evaluator;

ALTER TABLE supplier_evaluator_assignments
    DROP COLUMN IF EXISTS assigned_by_user_id,
    DROP COLUMN IF EXISTS reason,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS due_at,
    DROP COLUMN IF EXISTS reassigned_from_user_id,
    DROP COLUMN IF EXISTS reassignment_reason,
    DROP COLUMN IF EXISTS completed_evaluation_id,
    DROP COLUMN IF EXISTS draft_overall_score,
    DROP COLUMN IF EXISTS draft_dimension_scores_json,
    DROP COLUMN IF EXISTS draft_collaboration_type,
    DROP COLUMN IF EXISTS draft_collaboration_period,
    DROP COLUMN IF EXISTS draft_reference_code,
    DROP COLUMN IF EXISTS draft_comment,
    DROP COLUMN IF EXISTS active,
    DROP COLUMN IF EXISTS updated_at;

-- One assignment per VIEWER-supplier pair (drop first for idempotency)
ALTER TABLE supplier_evaluator_assignments
    DROP CONSTRAINT IF EXISTS uk_assignment_supplier_evaluator;
ALTER TABLE supplier_evaluator_assignments
    ADD CONSTRAINT uk_assignment_supplier_evaluator
    UNIQUE (supplier_registry_profile_id, assigned_evaluator_user_id);

-- 4. Update evaluations: one evaluation per VIEWER-supplier pair
ALTER TABLE evaluations
    DROP CONSTRAINT IF EXISTS uk_evaluation_supplier_evaluator_period;
ALTER TABLE evaluations
    DROP CONSTRAINT IF EXISTS uk_evaluation_supplier_evaluator;
ALTER TABLE evaluations
    ADD CONSTRAINT uk_evaluation_supplier_evaluator
    UNIQUE (supplier_registry_profile_id, evaluator_user_id);

-- Drop annulment columns (replaced by hard delete)
ALTER TABLE evaluations
    DROP COLUMN IF EXISTS is_annulled,
    DROP COLUMN IF EXISTS annulled_by_user_id,
    DROP COLUMN IF EXISTS annulled_at;

-- Recreate compat view without removed columns
CREATE OR REPLACE VIEW revamp_evaluations AS
    SELECT id, supplier_registry_profile_id, evaluator_user_id,
           collaboration_type, collaboration_period, reference_code,
           overall_score, comment, created_at
    FROM evaluations;
