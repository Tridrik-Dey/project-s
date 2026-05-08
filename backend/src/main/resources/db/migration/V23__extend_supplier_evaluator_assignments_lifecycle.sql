ALTER TABLE supplier_evaluator_assignments
    ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'ASSEGNATA',
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS reassigned_from_user_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reassignment_reason TEXT,
    ADD COLUMN IF NOT EXISTS completed_evaluation_id UUID REFERENCES evaluations(id),
    ADD COLUMN IF NOT EXISTS draft_overall_score SMALLINT,
    ADD COLUMN IF NOT EXISTS draft_dimension_scores_json JSONB,
    ADD COLUMN IF NOT EXISTS draft_collaboration_type VARCHAR(255),
    ADD COLUMN IF NOT EXISTS draft_collaboration_period VARCHAR(255),
    ADD COLUMN IF NOT EXISTS draft_reference_code VARCHAR(255),
    ADD COLUMN IF NOT EXISTS draft_comment TEXT;

CREATE INDEX IF NOT EXISTS idx_supplier_evaluator_assignments_status
    ON supplier_evaluator_assignments(status, active);
