# Phase 10 — Inventory Workflow Hardening

## Objective

Add focused mocked tests for Inventory movement behavior and prevent critical stock-update failures from being reported as successful without introducing an unverified production migration.

## Starting Findings

- `createInventoryMovement` reads the current stock, validates the requested movement, inserts the movement, updates `current_stock`, and writes an audit record.
- Movement insert errors already stop the stock update.
- The result of `updateInventoryItem` was previously ignored, allowing a successful movement response with a stale inventory balance.
- Reservation movements intentionally insert a movement without changing `current_stock`.
- Audit logging is intentionally non-blocking after critical inventory writes.
- The repository uses Vitest and mocked Supabase clients without requiring live credentials.

## Files Inspected

- `src/features/erp/shared/api/inventoryApi.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/types.ts`
- Existing Vitest tests and configuration
- `package.json`
- Supabase migrations defining inventory tables, enterprise columns, RLS policies, and transactional commerce functions
- Current Supabase changelog

## Inventory Workflow Risks

- Movement insertion and stock update are separate client-side writes and cannot roll back together.
- A stock update failure leaves a movement row recorded against an unchanged balance.
- Concurrent requests can read the same balance and overwrite each other's calculated stock.
- Reservation movements rely on external commerce logic to interpret reserved availability.
- Audit logging can fail after critical writes, by design, without changing the successful movement result.

## Tests Added

- Incoming movements increase `current_stock`.
- Outgoing movements decrease `current_stock`.
- Outgoing movements that exceed available stock return the existing Turkish validation error before inserting a movement.
- Reservation movements insert successfully without updating `current_stock`.
- Movement insertion failures stop before stock updates and audit logging.
- Stock update failures return a deterministic normalized error and stop before audit logging.
- Audit failures remain non-blocking after movement insertion and stock update succeed.

## Database / RPC Assessment

The final correct boundary is a transaction-safe Postgres function. It should lock the target inventory row with `SELECT ... FOR UPDATE`, validate the movement, insert the movement, update stock when applicable, and record audit metadata in one transaction. It must enforce enterprise and warehouse ownership, use explicit execution grants, and operate consistently with existing RLS policies.

No RPC is introduced in this phase because the authorization contract, warehouse selection rules, generated Supabase types, and integration-test path have not yet been verified together.

## Changes Made

- Added `inventoryApi.test.ts` with mocked Supabase fluent-query builders and a mocked audit helper.
- `createInventoryMovement` now checks the result of `updateInventoryItem`.
- Failed stock updates return the normalized underlying error, or the existing Turkish fallback message when no error detail is available.
- Audit logging now occurs only after movement insertion and any required stock update succeed.
- Reservation behavior and non-blocking audit behavior remain unchanged.
- No schema, migration, RLS, UI, or backward-export changes were made.

## Validation Results

- Focused Inventory tests: passed, 7 tests.
- `npm run typecheck`: passed.
- `npm run test`: passed, 122 tests across 4 test files.
- `npm run build`: passed.
- Focused ESLint for the touched Inventory files: passed.
- `npm run lint`: failed on the unchanged repository backlog with 72 findings (32 errors and 40 warnings).
- The build retained existing non-blocking warnings for stale Browserslist data, PDF.js `eval`, and large chunks.

## Remaining Risks

- A failed stock update still leaves the already-inserted movement row because client-side writes cannot share a transaction.
- Concurrent stock movements can still overwrite balances without row locking.
- Reservation availability remains coordinated outside `current_stock`.
- Audit logging remains intentionally non-blocking.

## Next Recommended Phase

Design and integration-test a transaction-safe inventory movement RPC with row locking, enterprise and warehouse validation, explicit execution grants, and generated client types.
