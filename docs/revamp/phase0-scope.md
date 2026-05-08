# Phase 0 Scope Freeze

This document defines what Phase 0 includes and excludes.

## Included

- Establish the revamp target architecture and contracts in-repo.
- Define and freeze lifecycle statuses and allowed transitions.
- Define and freeze RBAC roles, permissions, and data visibility.
- Define `/api/v2` boundaries and DTO contracts.
- Define migration strategy, data mapping, and rollback approach.
- Define feature-flag contract (all flags OFF by default).
- Define audit and observability event contract.
- Define test strategy entry criteria for next phases.
- Define information architecture for FE/BE navigation and wizard sections.

## Excluded

- No user-visible UI redesign implementation.
- No database schema migrations execution.
- No business flow changes in existing endpoints.
- No production behavior changes.

## Non-Regression Rule

Phase 0 artifacts must not break current `/api/*` flows or current frontend routes.

## Deliverables

- `docs/revamp/domain-model-v2.md`
- `docs/revamp/status-lifecycle-v2.md`
- `docs/revamp/rbac-matrix-v2.md`
- `docs/revamp/api-surface-v2.md`
- `docs/revamp/migration-strategy-v2.md`
- `docs/revamp/notification-events-v2.md`
- `docs/revamp/test-strategy-v2.md`
- `docs/revamp/information-architecture-v2.md`

