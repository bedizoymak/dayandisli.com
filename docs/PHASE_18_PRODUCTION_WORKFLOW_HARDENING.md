# Phase 18 — Production Workflow Hardening

## Objective

Add focused mocked tests for Production API workflows and prevent critical
client-side failures from being silently ignored, without introducing database
RPCs or changing ERP UI behavior.

## Starting Findings

- Production functions are isolated in `api/productionApi.ts` and remain
  re-exported through `erpApi.ts`.
- `createWorkOrderFromSalesOrder` creates a work order before updating the
  Sales order, but it ignored Sales item retrieval and status update failures.
- Its audit log already ran after the work-order and Sales status writes.
- `createOperationsFromRoute` returned route-step errors but silently continued
  after failed operation inserts.
- Subcontracting status changes update the related work order when the job is
  sent or in process.

## Files Inspected

- `src/features/erp/shared/api/productionApi.ts`
- `src/features/erp/shared/api/salesApi.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/types.ts`
- `src/features/erp/shared/erpApi.ts`
- Existing API tests under `src/features/erp/shared/api/`
- `package.json`
- `docs/PHASE_17_PRODUCTION_API_EXTRACTION.md`

## Production Workflow Risks

- Sales-to-Production conversion spans work-order lookup, Sales item retrieval,
  work-order insertion, Sales status update, and audit insertion without one
  database transaction.
- A Sales status update can fail after the work order has already persisted.
- Route operation generation inserts rows sequentially and cannot roll back
  already-created operations from the browser.
- Audit logging remains intentionally non-blocking after critical writes.

## Tests Added

Eight mocked Vitest cases now cover:

- Successful Sales-order-to-work-order conversion.
- Sales order item retrieval failure.
- Work order creation failure.
- Sales order status update failure after work-order creation.
- Successful route operation generation.
- Route-step retrieval failure.
- Operation insertion failure with immediate stop and partial-result reporting.
- Subcontracting status propagation to the related work order.

## Changes Made

- Sales item retrieval errors now stop conversion before work-order creation.
- Work-order creation errors are returned deterministically and prevent Sales
  status and audit writes.
- Sales status update errors are returned with the already-created work order
  so callers can identify the partial state.
- Conversion audit logging runs only after both critical writes succeed.
- Route-step retrieval errors remain explicit.
- Operation insertion now stops at the first failure and returns the operations
  already inserted plus a deterministic Turkish error.
- Existing backward exports and UI behavior remain unchanged.

## Transaction Boundary Assessment

Both `createWorkOrderFromSalesOrder` and `createOperationsFromRoute` are strong
future RPC candidates. Each workflow contains multiple dependent database
writes that require atomicity to eliminate partial state.

RPC design should follow focused test coverage and a schema/RLS review. No RPC,
migration, or production database change is included in this phase.

## Validation Results

- TypeScript: passed.
- Tests: passed, 134 tests across 5 files.
- Focused Production tests: passed, 8 tests.
- Build: passed with existing bundle-size, `eval`, and Browserslist warnings.
- Focused ESLint: passed for `productionApi.ts` and
  `productionApi.test.ts`.
- Repository ESLint: failed on the known backlog with 32 errors and 40
  warnings; no touched file produced a finding.
- Diff whitespace validation: passed.

## Remaining Risks

- Client-side hardening can report partial state but cannot atomically undo it.
- A work order may remain after a Sales status update failure.
- Operations inserted before a later failure may remain attached to the work
  order.
- Concurrent conversion attempts still rely on database constraints and the
  existing duplicate check.

## Next Recommended Phase

Design transaction-safe, `SECURITY INVOKER` database RPC drafts for the two
production workflows after reviewing company scope, RLS, uniqueness, audit
requirements, and rollback behavior.
