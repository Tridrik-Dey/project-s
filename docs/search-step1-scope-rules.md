# Step 1 - Search Scope and Rules

This document defines the initial scope for the dynamic field-based search feature.

## Scope

- Searchable area: `supplier_profiles` + linked `users` data.
- Excluded for now: documents binary content, audit/status history free-text, system/internal tables.
- Feature roles: `VALIDATOR`, `ADMIN`.

## Initial Searchable Fields

- `supplier.companyName` -> `supplier_profiles.company_name`
- `supplier.vatNumber` -> `supplier_profiles.vat_number`
- `supplier.taxId` -> `supplier_profiles.tax_id`
- `supplier.registrationNumber` -> `supplier_profiles.registration_number`
- `supplier.status` -> `supplier_profiles.status`
- `supplier.country` -> `supplier_profiles.country`
- `user.email` -> `users.email`
- `user.fullName` -> `users.full_name`

## Matching Rules

- Text fields: `CONTAINS`
- Enum fields: `EXACT`

## Validation/Runtime Limits

- Default page size: `20`
- Max page size: `200`
- Max selected fields: `20`
- Max search term length: `100`
- Max export rows: `50000`

## Implementation Location

- Policy code: `backend/src/main/java/com/supplierplatform/search/policy`
- Main policy class: `SearchScopePolicy`

