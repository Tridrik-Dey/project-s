# Test Strategy V2 (Freeze)

## Test Layers

1. Unit tests
- validators, status transition guards, scoring calculations, permission checks.

2. Contract tests
- `/api/v2/*` response shapes, error codes, auth/permission outcomes.

3. Integration tests
- end-to-end backend workflow with DB and mail stub.

4. UI tests
- component + route tests for wizard/admin flows.

5. E2E tests
- Playwright full user journeys (public, supplier, admin).

## Mandatory Workflow Scenarios

1. Invite flow
- create invite -> consume token -> draft started.

2. Public flow
- register -> OTP verify -> wizard submit -> protocol assigned.

3. Review flow
- queue assignment -> integration request -> supplier update -> approve/reject.

4. Renewal flow
- T-60/T-15 notifications -> renewal submission -> re-review.

5. Evaluation flow
- submit evaluation -> aggregate updated -> visibility constraints enforced.

## Security Scenarios

1. Role-based access control denies unauthorized actions.
2. Sensitive fields masked for insufficient roles.
3. Admin 2FA required in configured environments.

## Migration/Reconciliation Scenarios

1. Legacy status to v2 status parity check.
2. Document linkage parity.
3. Review history parity.

## Phase Gate Criteria (for Phase 1+)

1. All contract tests green for introduced endpoints.
2. No regression in existing `/api/*` tests.
3. Required E2E critical paths passing.
4. Audit events emitted for all status-changing actions.

