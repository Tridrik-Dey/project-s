# UAT Compliance Matrix (Updated)

Date: 2026-04-15 (phase wrap-up refresh)  
Legend: `Met` / `Partial` / `Missing`

## A) Remaining Work Before Release

### Missing (must implement)
1. Revamp-aligned FE e2e automation:
   - current Playwright suite is still largely legacy-selector oriented and fails against the revamp UI routes/components.
   - evidence: `frontend/test-results/*` from `npm run test:e2e` (2026-04-15) with 6 failed / 3 passed.

### Partial (needs parity hardening)
1. FE Step 1 mockup parity:
   - progress/look-and-feel details and profile photo upload UX fidelity not fully aligned to high-fidelity mockup.
2. FE Step 2 mockup parity:
   - professional-type card-grid interaction/styling parity not fully guaranteed.
3. FE Step 3/Albo B mockup parity:
   - richer expansion behavior and services accordion with counters/required-per-category not fully matched.
4. Supplier reserved dashboard parity:
   - current dashboard exists but KPI/card/communication composition is not full mockup-level parity.
5. Admin dashboard parity:
   - route exists, but current consolidated validator dashboard is not yet the final target dashboard experience.
6. Admin application case UX parity:
   - tabbed page exists and works, but exact mockup fidelity (layout/details) remains partial.
7. Invite management parity:
   - create/new flow exists; full backend-driven historical monitoring list is still incomplete.
8. Reports/statistics parity:
   - KPI + CSV export exists; full analytics composition from mockup remains partial.
9. Invite channel lifecycle parity:
   - token entry works; full end-to-end invite acceptance behavior and states remain simplified vs target narrative.
10. Release-grade FE regression gate:
   - FE unit/build are green, but e2e suite must be updated to revamp selectors and route expectations before being considered a strict release gate.

## B) FE/BE Matrix vs `albo_fornitori_parte6_mockup_v2.docx`

| Requirement area | Status | Evidence | Gap |
|---|---|---|---|
| FE public landing with Albo A/B choice | Met | `frontend/src/pages/revamp/RevampEntryPage.tsx`, `frontend/src/router/AppRouter.tsx` | - |
| FE wizard step flow (1..5 + recap + submitted) | Met | revamp step pages + routes in `AppRouter.tsx` | - |
| FE Step 1 detailed UX mockup fidelity (progress style, inline specifics, profile photo upload) | Partial | `frontend/src/pages/revamp/RevampApplicationStep1Page.tsx` | High-fidelity parity not fully aligned |
| FE Step 2 card-grid professional type UX | Partial | `frontend/src/pages/revamp/RevampApplicationStep2Page.tsx` | Functional presence, fidelity parity not complete |
| FE Step 3A thematic areas with rich expansion behavior | Partial | `frontend/src/pages/revamp/RevampApplicationStep3Page.tsx` | Rich interaction model is simplified |
| FE Albo B Step 3 services accordion with counters/required per category | Partial | `frontend/src/pages/revamp/RevampApplicationStep3Page.tsx` | Accordion/counter behaviors not fully matched |
| FE Step 5 declarations + OTP + submit gating | Met | `frontend/src/pages/revamp/RevampApplicationStep5Page.tsx`, `frontend/src/api/authApi.ts` | - |
| FE pre-submit recap | Met | `frontend/src/pages/revamp/RevampApplicationRecapPage.tsx` | - |
| FE submitted page with protocol + copy | Met | `frontend/src/pages/revamp/RevampApplicationSubmittedPage.tsx` | - |
| FE supplier reserved dashboard mockup (full KPI/communications shape) | Partial | `frontend/src/pages/supplier/SupplierDashboardPage.tsx` | Full mockup parity not complete |
| FE approval email template screen/fidelity | Met | `frontend/src/pages/admin/AdminApprovalEmailTemplatePage.tsx`, route `/admin/invites/approval-email-template` in `frontend/src/router/AppRouter.tsx` | - |
| BE admin dashboard screen | Partial | `frontend/src/pages/validator/ValidatorDashboardPage.tsx` | Works, but not final target dashboard fidelity |
| BE provider list + advanced filters | Met | `ValidatorDashboardPage.tsx`, `frontend/src/api/validatorApi.ts` | - |
| BE profile detail tabs + action bar | Partial | `frontend/src/pages/admin/AdminApplicationCasePage.tsx` | Functionally present, final fidelity still partial |
| BE review queue + review actions (approve/reject/integration) | Met | `frontend/src/pages/admin/AdminQueuePage.tsx`, `frontend/src/pages/admin/AdminIntegrationPage.tsx`, `backend/src/main/java/com/supplierplatform/revamp/api/RevampReviewController.java` | - |
| BE invite management pages (list/new with live preview) | Partial | `frontend/src/pages/admin/AdminInvitesPage.tsx`, `backend/src/main/java/com/supplierplatform/revamp/api/RevampInviteController.java` | Full historical monitor/list backend support still incomplete |
| BE evaluations pages (list/form/detail analytics) | Partial | `frontend/src/pages/admin/AdminEvaluationsPage.tsx`, `backend/src/main/java/com/supplierplatform/revamp/api/RevampEvaluationController.java` | Core list/detail present; full mockup analytics/form depth partial |
| BE reports/statistics page | Partial | `frontend/src/pages/admin/AdminReportsPage.tsx`, `backend/src/main/java/com/supplierplatform/revamp/api/RevampReportController.java` | Core KPI/export present; full mockup analytics composition partial |

## C) Process/API Matrix vs `albo_fornitori_gruppo_solco_v4.docx`

| Requirement area | Status | Evidence | Gap |
|---|---|---|---|
| Public + invite access channels | Partial | `RevampEntryPage.tsx`, `RevampRegistryStartPage.tsx`, `RevampInviteEntryPage.tsx`, `RevampInviteController.java` | Invite lifecycle is still simplified |
| Email OTP verification before questionnaire access | Met | `/verify-otp` route/page, `frontend/src/pages/auth/VerifyOtpPage.tsx`, `backend/src/main/java/com/supplierplatform/revamp/api/RevampAuthController.java` (`/api/v2/auth/otp/verify-email`) | - |
| 5-step questionnaire A/B with branch logic | Met | revamp step pages + `frontend/src/pages/revamp/revampFlow.ts` | - |
| Submission produces protocol and review state | Met | `backend/src/main/java/com/supplierplatform/revamp/api/RevampApplicationController.java`, submitted page | - |
| Human admin review (no auto-approval) | Met | `backend/src/main/java/com/supplierplatform/revamp/api/RevampReviewController.java` | - |
| Admin roles and governance | Met | `backend/src/main/java/com/supplierplatform/revamp/api/RevampAdminUserRoleController.java`, `frontend/src/pages/admin/AdminUsersRolesPage.tsx` | - |
| Evaluation system | Partial | `RevampEvaluationController.java`, `AdminEvaluationsPage.tsx` | Core flow exists; full mockup-depth analytics/form parity partial |
| Notifications + audit traceability | Met | `RevampNotificationController.java`, `RevampAuditController.java`, admin-role audit emission in `RevampAdminRoleService.java` | - |
| Renewal/suspension/reactivation lifecycle | Met | `backend/src/main/java/com/supplierplatform/revamp/api/RevampProfileController.java`, `backend/src/main/java/com/supplierplatform/revamp/service/RevampSupplierProfileService.java` | - |
| Full admin IA route set (`dashboard/queue/applications/integrations/invites/evaluations/reports/users-roles`) | Met | `frontend/src/router/AppRouter.tsx` | - |

## D) Wrap-Up Gate Evidence (This Run)

1. Backend runtime + contract smoke: `PASS`
   - command: `scripts/run-revamp-post-switch-smoke.ps1`
   - artifact: `test-results/revamp-post-switch-smoke-wrapup.json`
   - checks passed:
     - `runtime_readiness`
     - `runtime_health`
     - `critical_revamp_contract_suite`

2. PostgreSQL cutover/integrity + revamp integration tests: `PASS`
   - command: `scripts/run-revamp-cutover-gate-postgres.ps1 -TargetDb supplier_platform_phase_validation_wrapup2 -SkipRuntimeApi`
   - includes:
     - migration phase closeout validation (`V1..V12`)
     - cutover integrity checks (orphans/consistency)
     - Postgres-backed `RevampWorkflowIntegrationTest` + `RevampReconciliationIntegrationTest`

3. FE regression:
   - `npm run test:unit` -> `PASS` (20 tests)
   - `npm run build` -> `PASS`
   - `npm run test:e2e` -> `FAIL` (6 failed / 3 passed) because suite expects legacy labels/routes/components in multiple specs.

## E) Bottom Line

1. Core revamp backend workflow and current revamp FE route coverage are in place.
2. Backend cutover readiness and Postgres-backed revamp workflow tests are healthy.
3. Main release focus is now:
   - high-fidelity mockup parity work across FE/admin screens,
   - revamp-aligned FE e2e automation refresh (current suite not release-grade for revamp UI).
3. Non-blocking but recommended before release:
   - complete invite monitor parity,
   - deepen reports/evaluations analytics parity to mockups.
