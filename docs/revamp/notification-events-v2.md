# Notification and Audit Events V2 (Freeze)

## Notification Event Catalog

## Invite Flow

- `INVITE_CREATED`
- `INVITE_SENT`
- `INVITE_EXPIRING_SOON`
- `INVITE_EXPIRED`
- `INVITE_RENEWED`

## Registration / Submission

- `OTP_EMAIL_SENT`
- `OTP_EMAIL_VERIFIED`
- `APPLICATION_SUBMITTED`
- `APPLICATION_PROTOCOL_ASSIGNED`

## Review

- `APPLICATION_TAKEN_IN_CHARGE`
- `INTEGRATION_REQUEST_SENT`
- `INTEGRATION_RESPONSE_RECEIVED`
- `APPLICATION_APPROVED`
- `APPLICATION_REJECTED`

## Lifecycle

- `RENEWAL_DUE_60`
- `RENEWAL_DUE_15`
- `PROFILE_SUSPENDED_AUTO`
- `PROFILE_REACTIVATED`

## Evaluation

- `EVALUATION_SUBMITTED`
- `EVALUATION_AGGREGATE_UPDATED`

## Audit Event Contract

Each audited action must include:

- `eventKey`
- `entityType`
- `entityId`
- `actorUserId`
- `actorRoles`
- `requestId`
- `occurredAt`
- `beforeState` (nullable JSON)
- `afterState` (nullable JSON)
- `metadata` (reason, source channel, client context)

## Delivery Log Contract

Notification dispatch log stores:

- template key,
- recipient,
- render variables hash,
- provider response id,
- delivery status,
- retry count,
- timestamps.

## Template Governance

1. Templates are key-versioned.
2. Changes are audited.
3. Variables must be whitelisted per template key.

