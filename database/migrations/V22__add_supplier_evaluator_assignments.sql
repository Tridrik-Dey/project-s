CREATE TABLE IF NOT EXISTS supplier_evaluator_assignments (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_registry_profile_id UUID      NOT NULL REFERENCES supplier_registry_profiles(id) ON DELETE CASCADE,
    assigned_evaluator_user_id   UUID      NOT NULL REFERENCES users(id),
    assigned_by_user_id          UUID      NOT NULL REFERENCES users(id),
    reason                       TEXT,
    active                       BOOLEAN   NOT NULL DEFAULT TRUE,
    assigned_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_supplier_evaluator_assignment_active_true
    ON supplier_evaluator_assignments(supplier_registry_profile_id)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_supplier_evaluator_assignments_evaluator
    ON supplier_evaluator_assignments(assigned_evaluator_user_id, active);
