# Migration Strategy V2 (Freeze)

## Objectives

1. Introduce v2 model with zero downtime for current flows.
2. Preserve historical data and status history.
3. Allow rollback without data loss.

## Strategy

1. Expand-first:
- Add new v2 tables/entities without removing current tables.
- Keep old reads/writes intact.

2. Dual-read / adapter phase:
- v2 services read from v2 tables.
- compatibility adapters map old data where v2 is missing.

3. Controlled dual-write (only when enabled by flag):
- Write v2 primary records.
- Optionally mirror essential fields to legacy tables for coexistence.

## Data Mapping Rules

1. `users` remains source of identity.
2. `supplier_profiles` maps to:
- `applications` (latest stateful workflow),
- `supplier_registry_profiles` (approved active profile projection).
3. Current `status_history` is copied to new audit-compatible lifecycle history.
4. Existing documents are linked to v2 application/profile references.
5. Existing reviews map to `review_cases` history with decision metadata.

## Rollback Plan

1. Feature flags remain OFF until validation passes.
2. If rollback needed:
- disable v2 flags,
- route traffic to legacy endpoints/UI,
- keep v2 data for forensic reconciliation.

## Reconciliation Checks

1. Row count parity for mapped suppliers.
2. Status parity according to mapping table.
3. Document linkage integrity checks.
4. Review history checksum per supplier.
5. Sampled semantic parity checks on key fields.

## Execution Runbook (PostgreSQL)

1. Run single fail-fast gate (recommended):
- `pwsh scripts/run-revamp-cutover-gate-postgres.ps1`

2. Optional strict legacy parity gate:
- `pwsh scripts/run-revamp-cutover-gate-postgres.ps1 -StrictLegacyParity`

3. CI/sandbox fallback when backend runtime endpoint is intentionally unavailable:
- `pwsh scripts/run-revamp-cutover-gate-postgres.ps1 -SkipRuntimeApi`

4. Runtime-on-validation-DB sequence (backend already connected to validation DB):
- Run phase closeout first: `pwsh scripts/validate-phase-closeout-postgres.ps1`
- Then run strict gate without dropping DB again:
  `pwsh scripts/run-revamp-cutover-gate-postgres.ps1 -SkipPhaseCloseout`

5. Runtime switch dry-run + rollback (alias OFF -> ON -> OFF):
- `pwsh scripts/invoke-revamp-runtime-switch.ps1`

6. Post-switch smoke checks (runtime + alias/v2 + error contract):
- `pwsh scripts/run-revamp-post-switch-smoke.ps1`

7. Single-command evidence pack + go/no-go:
- `pwsh scripts/revamp-cutover-go-no-go.ps1`
- Artifacts are written under `test-results/revamp-cutover/<timestamp>/`

## Cutover Gate (Must Pass)

1. Final physical tables exist.
2. `revamp_*` compatibility views exist.
3. No critical orphan records across revamp relational links.
4. No `is_latest` conflicts in `application_sections`.
5. No submitted/reviewed applications missing protocol code or submitted timestamp.

## Toggle Procedure (Switch + Rollback)

1. Pre-check:
- `pwsh scripts/run-revamp-cutover-gate-postgres.ps1`
- The gate enforces:
  - schema/migration closeout,
  - database integrity readiness checks,
  - `GET /api/ops/revamp-cutover-readiness` == `status=READY` and `readyForAliasEnable=true`,
  - `RevampWorkflowIntegrationTest` + `RevampReconciliationIntegrationTest` on PostgreSQL.

2. Enable canonical revamp APIs:
- keep `FEATURE_REVAMP_READ_ENABLED=true`
- keep `FEATURE_REVAMP_WRITE_ENABLED=true`

3. Enable legacy alias bridge (`/api/* -> revamp`):
- set `FEATURE_REVAMP_ALIAS_ENABLED=true`

4. Rollback order (safe):
- set `FEATURE_REVAMP_ALIAS_ENABLED=false` first (stops `/api/*` bridge)
- if needed, set `FEATURE_REVAMP_WRITE_ENABLED=false`
- if needed, set `FEATURE_REVAMP_READ_ENABLED=false`
- keep `/api/v2/*` validation-only during rollback window.

## Non-Destructive Rule

No legacy table drop/rename in early migration phases.
