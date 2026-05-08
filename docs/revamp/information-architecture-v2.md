# Information Architecture V2 (Freeze)

## Front-End (Public + Supplier)

## Public

- `/` landing with `Albo A` / `Albo B` selection.
- `/register` account creation.
- `/verify-otp` email verification.
- `/invite/:token` invite-entry flow.

## Wizard

- `/application/:id/step/1` anagrafica/azienda base.
- `/application/:id/step/2` professional type / structure-sector.
- `/application/:id/step/3` adaptive section:
  - `3A` docente-formatore,
  - `3B` altri professionisti,
  - services categories for Albo B.
- `/application/:id/step/4` capacities/references/certifications.
- `/application/:id/step/5` declarations + OTP signature.
- `/application/:id/recap`
- `/application/:id/submitted`

## Supplier Reserved Area

- `/supplier/dashboard`
- `/supplier/profile`
- `/supplier/documents`
- `/supplier/communications`
- `/supplier/renewal`

## Back-End (Admin)

- `/admin/dashboard`
- `/admin/queue`
- `/admin/applications/:id` tabs:
  - profile,
  - documents,
  - evaluations,
  - history,
  - internal-notes,
  - communications.
- `/admin/integrations/:applicationId`
- `/admin/invites`
- `/admin/invites/new`
- `/admin/evaluations`
- `/admin/evaluations/:supplierId`
- `/admin/reports`
- `/admin/users-roles` (super-admin)

## Navigation Principles

1. Supplier flow is wizard-first, resume-friendly.
2. Admin flow is queue-first with urgency signals.
3. Profile detail pages are tab-based with action bar.
4. Critical actions require explicit reason/comment input.

