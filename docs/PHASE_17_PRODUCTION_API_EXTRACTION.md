# Phase 17 — Production API Extraction

## Objective

Extract the production, work-order, routing, machine, and production-linked
subcontracting API functions from the monolithic ERP API while preserving all
existing imports through backward-compatible re-exports.

## Starting Findings

- `erpApi.ts` still contained one contiguous production block.
- CRM, Sales, and Inventory APIs were already split into domain modules.
- Production feature pages import through `erpApi.ts`.
- Production dashboard and report aggregation remains cross-domain.
- The Sales-to-Production conversion reads Sales order items and updates the
  Sales order after creating a work order.
- Subcontracting jobs directly transition their related work order.

## Files Inspected

- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/api/salesApi.ts`
- `src/features/erp/shared/types.ts`
- Production, Sales, detail, subcontracting, and admin consumers under `src/`

## Production Functions Identified

- `listMachines`
- `listProductionRoutes`
- `createProductionRoute`
- `updateProductionRoute`
- `listProductionRouteSteps`
- `createProductionRouteStep`
- `updateProductionRouteStep`
- `deleteProductionRouteStep`
- `listWorkOrders`
- `getWorkOrder`
- `getWorkOrderById`
- `createWorkOrder`
- `updateWorkOrder`
- `createWorkOrderFromSalesOrder`
- `listWorkOrderOperations`
- `createWorkOrderOperation`
- `updateWorkOrderOperationStatus`
- `createOperationsFromRoute`
- `listSubcontractingJobs`
- `getSubcontractingJobById`
- `createSubcontractingJob`
- `updateSubcontractingJob`

## Shared Dependencies

The extracted module uses the existing Supabase client and shared helpers from
`api/internal.ts` for enterprise scoping, generated ERP numbers, audit logging,
result normalization, missing-table handling, and validation failures.

`createWorkOrderFromSalesOrder` retains its dependency on `listSalesOrderItems`
and `updateSalesOrder` from `salesApi.ts`. This is an intentional
Sales-to-Production orchestration boundary. Subcontracting remains in the
Production API because its state transitions directly update work orders.

## Changes Made

- Created `src/features/erp/shared/api/productionApi.ts`.
- Moved the identified production functions without changing their
  implementation bodies.
- Reused shared helpers from `api/internal.ts`.
- Retained the Sales API dependency for Sales-to-Production conversion.
- Removed production-owned implementations and types from `erpApi.ts`.
- Imported the extracted functions needed by remaining dashboard, report, and
  quality workflows.
- Added backward-compatible exports for every extracted function.

## Backward Compatibility

All extracted functions are re-exported from `erpApi.ts`. Existing feature and
admin imports remain unchanged. The extracted implementation body was compared
with the previous `erpApi.ts` block after line-ending normalization and matched
exactly.

## Validation Results

- TypeScript: passed.
- Tests: passed, 126 tests across 4 files.
- Build: passed with existing bundle-size, `eval`, and Browserslist warnings.
- Focused ESLint: passed for `erpApi.ts` and `productionApi.ts`.
- Repository ESLint: failed on the known backlog with 32 errors and 40
  warnings; no touched file produced a finding.
- Diff whitespace validation: passed.

## Remaining Risks

- Sales-to-Production conversion performs multiple client-side writes without a
  database transaction.
- Route-to-operation creation inserts operations sequentially and can leave a
  partial result if a later insert fails.
- Audit logging remains non-blocking in existing workflows.
- Production dashboard and report functions remain in `erpApi.ts` because they
  aggregate several domains.

## Next Recommended Phase

Add focused Production API tests around work-order conversion, route operation
creation, status transitions, and partial-write behavior before changing any
transaction boundaries.
