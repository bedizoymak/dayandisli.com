# Phase 9 — Inventory API Extraction

## Objective

Extract clearly Inventory-owned Supabase data-access functions from the monolithic ERP API while preserving the existing `erpApi.ts` import surface and runtime behavior.

## Starting Findings

- `src/features/erp/shared/erpApi.ts` still contains warehouse, stock-card, and stock-movement data access.
- Inventory functions are consumed by Inventory pages and by production, purchasing, commerce, reporting, observability, settings, and admin workflows.
- Commerce reservation and purchasing receipt workflows orchestrate multiple domains and should remain in `erpApi.ts`.
- The working tree was clean and synchronized with `origin/main` before this phase.

## Files Inspected

- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/types.ts`
- Inventory pages and item detail pages
- Cross-domain consumers in production, purchasing, commerce, reports, observability, settings, and admin modules
- Supabase migration history and current Supabase changelog

## Inventory Functions Identified

- Warehouses: `listWarehouses`, `createWarehouse`, `updateWarehouse`
- Stock cards: `listInventoryItems`, `getInventoryItemById`, `createInventoryItem`, `updateInventoryItem`
- Stock movements: `listInventoryMovements`, `listInventoryMovementsForItem`, `createInventoryMovement`

No inventory delete, warehouse detail, low-stock-specific, or reorder-specific API functions currently exist in `erpApi.ts`.

## Shared Dependencies

- Inventory uses the shared Supabase client, result helpers, enterprise scoping, ownership defaults, search normalization, numeric normalization, audit logging, and validation errors.
- `createInventoryMovement` owns stock validation, movement insertion, balance updates, and inventory audit logging.
- Remaining cross-domain workflows call Inventory functions but do not belong to the Inventory data-access module.

## Changes Made

- Added `src/features/erp/shared/api/inventoryApi.ts` and moved the 10 existing Inventory exports into it.
- Moved the generic `validationFailure` helper to `api/internal.ts` because Inventory and remaining ERP domains both use it.
- Removed the moved implementations and stale Inventory type imports from `erpApi.ts`.
- Kept purchasing receipt, production consumption, commerce reservation, health, and reporting orchestration in `erpApi.ts`.
- Preserved all Supabase queries, Turkish validation and audit messages, stock calculations, enterprise scoping, and demo fallback scope names.

## Backward Compatibility

- `erpApi.ts` re-exports every extracted Inventory function.
- Existing feature, admin, settings, production, purchasing, commerce, reporting, and observability imports remain unchanged.
- Remaining cross-domain functions in `erpApi.ts` import `listInventoryItems` and `createInventoryMovement` directly from `inventoryApi.ts`.
- Type checking and the production build validate the compatibility layer.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed, 115 tests across 3 test files.
- `npm run build`: passed.
- `npx eslint src/features/erp/shared/erpApi.ts src/features/erp/shared/api/inventoryApi.ts src/features/erp/shared/api/internal.ts`: passed.
- `npm run lint`: failed on the unchanged repository backlog with 72 findings (32 errors and 40 warnings).
- The build retained existing non-blocking warnings for stale Browserslist data, PDF.js `eval`, and large chunks.

## Remaining Risks

- Stock movement insertion and inventory balance update remain separate client-side writes and are not transactionally atomic.
- Concurrent stock movements can calculate from the same starting balance and overwrite each other.
- Reservation movements intentionally do not update `current_stock`; reservation availability remains coordinated by commerce workflows outside this module.
- Audit-log failures remain non-blocking after successful warehouse or stock writes.
- The April 28, 2026 Supabase Data API exposure change should be considered for future new tables; this phase adds no tables or migrations.

## Next Recommended Phase

Add focused mocked tests for stock validation and movement behavior, then assess a transaction-safe stock movement RPC before extracting another domain.
