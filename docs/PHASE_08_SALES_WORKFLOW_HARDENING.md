# Phase 8 — Sales Workflow Hardening

## Objective

Add focused mocked tests for the extracted Sales API and reduce silent partial-conversion behavior without introducing an unverified production database migration.

## Starting Findings

- `salesApi.ts` creates a sales order, inserts quotation items sequentially, then creates the quotation link and audit log.
- Item, quotation-link, and audit results were previously ignored by the conversion workflow.
- A failed item insert could therefore still mark the quotation as converted.
- Stakeholder lookup uses a case-insensitive query followed by a separate insert.
- The repository test suite uses Vitest with a shared jsdom setup and does not require live Supabase credentials.

## Files Inspected

- `src/features/erp/shared/api/salesApi.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/api/crmApi.ts`
- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/types.ts`
- Existing Vitest tests and configuration
- `package.json`
- Supabase migrations defining stakeholders, quotation links, sales orders, and sales-order items

## Sales Workflow Risks

- Client-side multi-step quotation conversion is not atomic and may leave a sales order or some items behind after a later failure.
- Marking a quotation converted after an item failure would hide an incomplete order.
- Stakeholder lookup and creation have a race window because no normalized unique company-name constraint exists.
- Adding uniqueness without first auditing existing normalized duplicates could break a production migration.

## Tests Added

- Existing stakeholder lookup returns the matching record without inserting.
- Missing stakeholder lookup delegates to CRM stakeholder creation with the normalized company name.
- Sales-order listing converts a Supabase error object into the API's deterministic string error shape.
- Sales-order item creation calculates `total` and applies the existing default unit.
- Successful quotation conversion writes items, then the conversion link, then the audit record.
- Failed item insertion stops conversion before the quotation link and audit record are created.

## Database / RPC Assessment

The recommended final boundary is a Postgres transaction exposed through a narrowly scoped RPC. It should resolve or create the stakeholder, create the order and all items, create the quotation link, and write the audit record in one transaction. The function must respect the existing enterprise ownership and RLS model.

No RPC or uniqueness migration is introduced in this phase because existing production data has not been checked for normalized stakeholder-name duplicates and no local database integration test currently verifies the full workflow.

## Changes Made

- Added `salesApi.test.ts` with mocked Supabase fluent-query builders and mocked shared dependencies.
- Quotation conversion now checks every item insertion result and returns the normalized underlying error immediately.
- Quotation conversion now checks the quotation-link result before writing the audit log.
- Conversion links and audit records are no longer written after an item failure.
- No schema, RLS, UI, or backward-export changes were made.

## Validation Results

- Focused Sales tests: passed, 6 tests.
- `npm run typecheck`: passed.
- `npm run test`: passed, 115 tests across 3 test files.
- `npm run build`: passed.
- Focused ESLint for the touched Sales files: passed.
- `npm run lint`: failed on the unchanged repository backlog with 72 findings (32 errors and 40 warnings).
- The build retained existing non-blocking warnings for stale Browserslist data, PDF.js `eval`, and large chunks.

## Remaining Risks

- Client-side conversion still cannot roll back an already-created order or earlier successful items.
- Audit logging remains non-transactional and its failure does not roll back the completed conversion.
- Stakeholder lookup/create remains race-prone until normalized uniqueness and an atomic database workflow are introduced.
- Existing stakeholder data must be audited for normalized duplicates before adding a uniqueness constraint.

## Next Recommended Phase

Audit normalized stakeholder names in a controlled environment, then implement and integration-test a transaction-safe quotation conversion RPC with explicit RLS and execution grants.
