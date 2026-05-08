# Gruppo Solco v4 Remediation Checklist (Missing + Partial Only)

Source baseline:
- `docs/revamp/gruppo-solco-v4-field-matrix.md`

Scope:
- Only items currently marked `Missing` or `Partial`.
- Ordered by implementation phase.
- Revamp-only model (no legacy tables).

## Phase 1 - Contract and Validation Hardening (JSONB-first)

- [x] Define canonical JSONB contracts per section key (`S1`, `S2`, `S3A`, `S3B`, `S3`, `S4`, `S5`) in backend docs.
- [x] Add backend section-level validation (server-side) before saving `application_sections.payload_json`.
- [x] Enforce conditional rules currently implicit in doc:
  - `S2`: Albo A `Altro` => ATECO required.
  - `S5`: docenti in presenza => `D.Lgs. 81/2008` declaration required.
  - `S3` Albo B: per-category description required when at least one service is selected.
- [x] Normalize enum values for legal and classification fields (legal form, employee ranges, service taxonomy, declaration keys).

## Phase 2 - Albo A Questionnaire Completion

- [x] Expand `S1` payload to include missing anagrafica fields:
  - `firstName`, `lastName`, `birthDate`, `birthPlace`, `vatNumber`, `taxRegime`,
  - `addressLine`, `secondaryPhone`, `secondaryEmail`, `pec`, `website`, `linkedin`.
- [x] Expand `S2` payload:
  - keep `professionalType`, add `secondaryProfessionalTypes[]`.
- [x] Redesign `S3A` from aggregated CSV/text to structured blocks:
  - `education` (`highestTitle`, `studyArea`, `graduationYear`),
  - `certifications[]`,
  - `competencies[]` with per-item `theme`, `details`, `yearsBand`,
  - `paTeachingExperience`,
  - `consultingAreas[]`,
  - `territory` (regions/provinces),
  - `languages[]` with `qcerLevel`,
  - `teachingLanguages[]`,
  - `digitalTools[]`,
  - `professionalNetworks[]`,
  - `availability` and indicative rates.
- [x] Add `S3A.experiences[]` (max 5, last 5 years) with all required subfields.
- [x] Replace `S4.referencesSummary` with structured `references[]` (max 2, optional).
- [x] Expand `S3B` with doc-required structured fields:
  - `professionalOrder`, `highestTitle`, `studyArea`, `experienceBand`,
  - `services[]`, `territory`, `hourlyRateRange`, `specificCertifications[]`.

## Phase 3 - Albo B Questionnaire Completion

- [x] Expand `S1` payload with full legal/company profile:
  - `legalForm`, `taxCodeIfDifferent`, `legalAddress` (street/city/cap/province),
  - `operationalHeadquarter`,
  - `institutionalEmail`, `pec`, `phone`, `website`,
  - legal representative details (`name`, `taxCode`, `role`),
  - structured `operationalContact` (`name`, `role`, `email`, `phone`).
- [x] Expand `S2` payload:
  - `revenueBand`,
  - `atecoSecondary[]` (max 3),
  - `operatingRegions[]` (structured list),
  - `regionalTrainingAccreditation` structured object,
  - `thirdSectorType`,
  - `runtsNumber`.
- [x] Complete `S3` service taxonomy parity to full document list for CAT_A..CAT_E.
- [x] Keep `servicesByCategory` but add strict IDs for every document service item.
- [x] Keep per-category descriptions with max length enforcement (400 chars each).

## Phase 4 - Attachments and Evidence Model

- [x] Introduce revamp attachments table for application-level files (new final-name table).
- [x] Store file metadata and linkage to section/field:
  - `application_id`, `section_key`, `document_type`, `file_name`, `mime_type`, `size_bytes`, `storage_key`, `uploaded_at`, `expires_at`.
- [x] Add document-type validation rules:
  - Albo A: CV required, certifications optional.
  - Albo B: visura required, DURC required, company profile optional, certifications/accreditations required when declared.
- [x] Add expiry-aware document flags for admin review (`expired`, `expiringSoon`).
- [x] Replace base64 image-in-JSON pattern with attachment reference for consistency.

## Phase 5 - Declaration Granularity and Legal Compliance

- [x] Split generic `S5` booleans into explicit legal keys (A and B variants where required):
  - `noCriminalConvictions`, `noConflictOfInterest`, `truthfulnessDeclaration`,
  - `privacyAccepted`, `ethicalCodeAccepted`, `qualityEnvSafetyAccepted`,
  - `alboDataProcessingConsent`, `marketingConsent`,
  - Albo A specific: `dlgs81ComplianceWhenInPresence`.
  - Albo B specific: `antimafiaDeclaration`, `dlgs231Declaration`, `model231Adopted`, `fiscalContributionRegularity`, `gdprComplianceAndDpo`.
- [x] Keep OTP signature but bind it to a declaration snapshot hash persisted with section version.

## Phase 6 - Registry Profile Projection and Search Readiness

- [x] Add profile projection process from latest approved `application_sections` into `supplier_registry_profiles` JSONB summary fields (or dedicated profile detail table).
- [x] Ensure admin list/search filters can use projected structured fields (ATECO, regions, service categories, status, certifications).
- [x] Add computed public/admin views for profile card parity (A/B specific data slices).

## Phase 7 - Data Migration and Compatibility

- [x] Add migration scripts for new JSON keys and new attachments table.
- [x] Provide payload up-converter for existing drafts using old keys (`thematicAreasCsv`, `referencesSummary`, etc.).
- [x] Preserve backward read compatibility for existing section versions during rollout.

## Phase 8 - Regression, Contracts, and Gates

- [x] Add backend contract tests for all section schemas and conditional rules.
- [x] Add FE unit tests for each new required field and conditional path.
- [x] Add integration tests:
  - full Albo A submission with max-depth payload,
  - full Albo B submission with attachments + declarations,
  - admin review integration request with missing-doc guidance.
- [x] Add Postgres gate checks to fail if required JSON paths are absent on submitted applications.

## Suggested execution order

- [ ] Run Phase 1 first (stabilize contracts).
- [ ] Run Phase 2 and Phase 3 next (field parity for A/B).
- [ ] Run Phase 4 and Phase 5 (attachments + legal declarations).
- [ ] Run Phase 6, then Phase 7, then Phase 8.
