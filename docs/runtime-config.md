# Runtime Configuration

## Required Environment Variables (mail features)

If you want reminder emails and review-status emails to be delivered, set:

- `MAIL_HOST` (default: `smtp.gmail.com`)
- `MAIL_PORT` (default: `587`)
- `MAIL_USERNAME` (SMTP username, e.g. full Gmail address)
- `MAIL_PASSWORD` (SMTP password or Gmail App Password)
- `REMINDER_MAIL_ENABLED=true`
- `REMINDER_MAIL_FROM` (sender email)
- `REVIEW_STATUS_MAIL_ENABLED=true`
- `REVIEW_STATUS_MAIL_FROM` (sender email)

## Mail Retry (dev-friendly reliability)

Mail sends use retry/backoff to avoid transient SMTP failures blocking flows.

- `MAIL_RETRY_MAX_ATTEMPTS` (default: `3`)
- `MAIL_RETRY_BACKOFF_MS` (default: `500`)

Recommended:

- Local development/testing: keep defaults or set small values (`1`, `0`) for fast feedback
- Non-local environments: keep retries enabled (`>=2`) to reduce transient failure impact

## Mail Fail-Fast Guard

The backend includes a startup validator (`MailSettingsValidator`) with:

- `app.mail.fail-fast=false` by default.

When `app.mail.fail-fast=true` and at least one mail feature is enabled (`app.reminders.document-expiry.mail.enabled` or `app.reviews.status-mail.enabled`), startup will fail if `spring.mail.username` or `spring.mail.password` is missing.

Recommended:

- Local development: keep `app.mail.fail-fast=false`
- CI/staging/production: set `app.mail.fail-fast=true` when mail is expected to work

## Dev/Test Health Endpoint

`GET /api/ops/health`

Returns:

- `status` (`UP` or `DEGRADED`)
- `databaseUp` (basic DB check via `SELECT 1`)
- `mailConfigValid` (true when mail features are disabled, or when username/password are configured)
- `timestamp`
