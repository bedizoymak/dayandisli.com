# Phase 7 — Sales API Extraction

## Objective

Extract clearly Sales-owned Supabase data-access functions from the monolithic ERP API while preserving the existing `erpApi.ts` import surface and runtime behavior.

## Starting Findings

- `src/features/erp/shared/erpApi.ts` remains a multi-domain module after the CRM extraction.
- Sales quotation conversion, quotation linking, sales orders, and sales-order items form one contiguous block.
- Production, logistics, finance, reporting, and shop modules consume Sales functions but retain their own domain workflows.
- The working tree was clean and synchronized with `origin/main` before this phase.

## Files Inspected

- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/api/crmApi.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/types.ts`
- Sales and quotation feature pages
- Cross-domain consumers in production, logistics, finance, quality, reports, dashboard, admin, details, and shop modules

## Sales Functions Identified

- Stakeholder workflow: `findOrCreateStakeholderByCompany`
- Quotations: `listERPQuotationsFromExistingTable`, `listQuotations`
- Quotation links and conversion state: `getQuotationConversionState`, `linkQuotationToStakeholder`
- Sales orders: `listSalesOrders`, `getSalesOrder`, `getSalesOrderById`, `createSalesOrder`, `updateSalesOrder`
- Sales-order items: `createSalesOrderItem`, `listSalesOrderItems`
- Quotation conversion: `convertQuotationToSalesOrder`

No delete or sales-order-item update functions currently exist in `erpApi.ts`.

## Shared Dependencies

- The Sales block uses the shared Supabase client, API result helpers, enterprise scoping, sequence generation, audit logging, search normalization, and missing-table handling.
- Quotation product conversion also uses the generic numeric normalization helper currently shared with other ERP domains.
- Stakeholder creation remains CRM-owned and is consumed from `crmApi.ts`.

## Changes Made

- Added `src/features/erp/shared/api/salesApi.ts` and moved the 13 existing Sales exports into it.
- Moved the private quotation product parsing and item conversion helpers with their owning workflow.
- Moved the generic `numberValue` helper to `api/internal.ts` because Sales and remaining ERP domains both use it.
- Kept production work-order creation, logistics shipment creation, finance, and shop-order conversion in `erpApi.ts`.
- Preserved all Supabase queries, Turkish messages, default values, sequence behavior, audit logging, and demo fallback scopes.

## Backward Compatibility

- `erpApi.ts` re-exports every extracted Sales function and alias.
- Existing feature and admin imports remain unchanged.
- Remaining cross-domain functions in `erpApi.ts` import Sales functions directly from `salesApi.ts`.
- Type checking and the production build validate the compatibility layer.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed, 109 tests across 2 test files.
- `npm run build`: passed.
- `npx eslint src/features/erp/shared/erpApi.ts src/features/erp/shared/api/salesApi.ts src/features/erp/shared/api/internal.ts`: passed.
- `npm run lint`: failed on the known repository backlog with 72 findings (32 errors and 40 warnings); the touched TypeScript files produced no findings.
- The build retained existing non-blocking warnings for stale Browserslist data, PDF.js `eval`, and large chunks.

## Remaining Risks

- Sales data-access behavior is covered indirectly by type checking, build validation, and existing tests; dedicated mocked Supabase tests do not yet exist.
- Quotation conversion creates order items sequentially and retains the existing partial-conversion risk if a later insert fails.
- `findOrCreateStakeholderByCompany` performs a case-insensitive lookup before CRM-owned stakeholder creation and retains the existing race window.
- Production, logistics, shop, finance, reports, and quality remain coupled to Sales through the compatibility module.

## Next Recommended Phase

Add focused tests for quotation conversion and sales-order creation, then extract the next cohesive domain while retaining the compatibility pattern.
