# API Surface V2 (Freeze)

Goal: introduce `/api/v2/*` without breaking current `/api/*`.

## Compatibility Rule

1. Existing `/api/*` remains operational during migration.
2. New features are exposed under `/api/v2/*`.
3. Legacy frontend remains functional until feature flags enable v2 screens.

## V2 Domains and Endpoints (Contract Locked - Backend)

## Auth + Security

- `POST /api/v2/auth/register`
- `POST /api/v2/auth/login`
- `POST /api/v2/auth/otp/verify-email`
- `POST /api/v2/auth/otp/verify-signature`
- `POST /api/v2/auth/2fa/challenge`
- `POST /api/v2/auth/2fa/verify`

## Invites

- `POST /api/v2/invites`
- `GET /api/v2/invites/token/{token}`

## Applications (A/B)

- `POST /api/v2/applications` (create draft)
- `GET /api/v2/applications/{id}`
- `GET /api/v2/applications/me/latest`
- `GET /api/v2/applications/{id}/sections`
- `PUT /api/v2/applications/{id}/sections/{sectionKey}` (autosave)
- `POST /api/v2/applications/{id}/submit`

## Review Workflow

- `GET /api/v2/reviews/queue`
- `POST /api/v2/reviews/{applicationId}/assign`
- `POST /api/v2/reviews/{reviewCaseId}/integration-request`
- `POST /api/v2/reviews/{reviewCaseId}/decision`
- `GET /api/v2/reviews/{applicationId}/history`

## Supplier Profile + Renewal

- `GET /api/v2/profiles/{id}`
- `GET /api/v2/profiles/{id}/timeline`
- `POST /api/v2/profiles/{id}/renewal/start`
- `POST /api/v2/profiles/{id}/suspend`
- `POST /api/v2/profiles/{id}/reactivate`

## Evaluations

- `POST /api/v2/evaluations`
- `GET /api/v2/evaluations?supplierId=...`
- `GET /api/v2/evaluations/summary?supplierId=...`
- `POST /api/v2/evaluations/{id}/annul` (super-admin only)

## Notifications + Audit

- `GET /api/v2/notifications/templates`
- `PUT /api/v2/notifications/templates/{key}`
- `GET /api/v2/notifications/events`
- `GET /api/v2/audit/events`

## OTP Challenges

- `POST /api/v2/otp-challenges/declaration/send`
- `POST /api/v2/otp-challenges/declaration/verify`

## Search + Reports

- `GET /api/v2/search/suppliers`
- `POST /api/v2/search/advanced`
- `GET /api/v2/reports/kpis`
- `GET /api/v2/reports/export`

## DTO Principles

1. `ApiResponse<T>` wrapper maintained for consistency.
2. Error payloads include `errorCode` and `requestId`.
3. Validation errors return HTTP `400` with `errorCode=VALIDATION_ERROR`.
4. Use stable enum string values aligned with `status-lifecycle-v2`.

## Error Payload Contract

All revamp endpoints return this structure on failure:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "data": null,
  "errorCode": "VALIDATION_ERROR",
  "requestId": "X-Request-Id value"
}
```

## Runtime Switch Controls

- `app.features.revamp.read-enabled` (default: `true`)
- `app.features.revamp.write-enabled` (default: `true`)
- `app.features.revamp.alias-enabled` (default: `true`) for `/api/*` bridge routes only

When disabled, revamp endpoints return conflict with `errorCode=ILLEGAL_STATE`.
