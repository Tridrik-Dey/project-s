# Status Lifecycle V2 (Freeze)

## Enumerations

## ApplicationStatus

- `INVITED`
- `DRAFT`
- `SUBMITTED`
- `UNDER_REVIEW`
- `INTEGRATION_REQUIRED`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`
- `RENEWAL_DUE`
- `ARCHIVED`

## InviteStatus

- `CREATED`
- `SENT`
- `OPENED`
- `CONSUMED`
- `EXPIRED`
- `RENEWED`
- `CANCELLED`

## ReviewCaseStatus

- `PENDING_ASSIGNMENT`
- `IN_PROGRESS`
- `WAITING_SUPPLIER_RESPONSE`
- `DECIDED`
- `CLOSED`

## Allowed Transitions (Application)

1. `INVITED -> DRAFT`
2. `DRAFT -> SUBMITTED`
3. `SUBMITTED -> UNDER_REVIEW`
4. `UNDER_REVIEW -> INTEGRATION_REQUIRED`
5. `INTEGRATION_REQUIRED -> UNDER_REVIEW`
6. `UNDER_REVIEW -> APPROVED`
7. `UNDER_REVIEW -> REJECTED`
8. `APPROVED -> RENEWAL_DUE`
9. `RENEWAL_DUE -> UNDER_REVIEW` (renewal submitted)
10. `RENEWAL_DUE -> SUSPENDED` (expired without renewal)
11. `APPROVED -> SUSPENDED`
12. `SUSPENDED -> UNDER_REVIEW` (reactivation via updated submission)
13. `REJECTED -> ARCHIVED`
14. `SUSPENDED -> ARCHIVED`

## Transition Guards

1. `DRAFT -> SUBMITTED`
- mandatory section validation passes,
- mandatory declarations accepted,
- OTP signature present.

2. `UNDER_REVIEW -> APPROVED/REJECTED`
- decision reason required,
- decision actor with permission.

3. `INTEGRATION_REQUIRED -> UNDER_REVIEW`
- requested missing items resolved or explicitly waived.

4. `RENEWAL_DUE -> SUSPENDED`
- renewal deadline elapsed.

## Current-to-V2 Mapping (Compatibility)

- Current `DRAFT` -> V2 `DRAFT`
- Current `PENDING` -> V2 `UNDER_REVIEW`
- Current `NEEDS_REVISION` -> V2 `INTEGRATION_REQUIRED`
- Current `APPROVED` -> V2 `APPROVED`
- Current `ACTIVE` -> V2 `APPROVED` (visibility flag true)
- Current `INACTIVE` -> V2 `SUSPENDED`
- Current `REJECTED` -> V2 `REJECTED`

## Audit Requirement

Every status transition must emit:
- actor id,
- previous status,
- new status,
- reason,
- request id,
- timestamp.

