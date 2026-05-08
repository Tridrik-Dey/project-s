# Domain Model V2 (Freeze)

This document defines the target domain model for the revamp.

## Core Aggregates

1. `User`
- Existing auth identity.
- Role assignment moves to explicit admin-role mapping (multi-role support).

2. `SupplierRegistryProfile`
- Canonical supplier profile after approval.
- Distinguishes `ALBO_A` (professional) and `ALBO_B` (company).

3. `Application`
- Candidate application lifecycle record.
- Tracks source channel (`INVITE`, `PUBLIC`) and registry type (`ALBO_A`, `ALBO_B`).
- Owns draft/submission/revision lifecycle.

4. `ApplicationSection`
- Stores section payload snapshots per step (`S1..S5`), versioned.
- Supports adaptive wizard branching.

5. `Invite`
- Admin-generated invitation with token, expiry, status, renewal chain.

6. `OtpChallenge`
- OTP verification/signature events for:
  - account verification,
  - declaration signature.

7. `ReviewCase`
- Administrative review record for each submission/revision cycle.
- Includes decision, reason, SLA metadata, assignment.

8. `IntegrationRequest`
- Document/field-level integration requests with due date and response tracking.

9. `Evaluation`
- Structured scorecard input from authorized evaluators.
- Immutable once submitted (except super-admin annulment).

10. `NotificationEvent`
- Event-level email/notification dispatch log with template and delivery state.

11. `AuditEvent`
- Immutable audit trail with before/after snapshots and request correlation.

## Relationships (Logical)

1. `User 1..* -> Application`
2. `Application 1..* -> ApplicationSection`
3. `Application 0..* -> ReviewCase`
4. `ReviewCase 0..* -> IntegrationRequest`
5. `Application 0..1 -> SupplierRegistryProfile` (materialized on approval)
6. `User 0..* -> Invite` (created by admin, consumed by candidate email)
7. `Application 0..* -> OtpChallenge`
8. `SupplierRegistryProfile 0..* -> Evaluation`
9. `* -> NotificationEvent` (origin entity reference)
10. `* -> AuditEvent` (origin entity reference)

## Registry-Specific Data Strategy

1. Shared canonical fields remain normalized (identity, contact, status, dates).
2. Section-specific forms for Albo A/B are stored as validated JSON payloads per section.
3. Search projections are materialized from canonical + section data.

## Compatibility Rule

- Existing `supplier_profiles` remains active during transition.
- V2 model is introduced in parallel and mapped through compatibility adapters.

