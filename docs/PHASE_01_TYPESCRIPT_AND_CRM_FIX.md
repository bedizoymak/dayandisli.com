# Phase 1 — TypeScript Integrity and CRM Opportunity Fix

## Objective

Restore TypeScript confidence, repair the CRM opportunity creation path, and address the directly related type errors identified by the repository audit without changing unrelated product behavior.

## Starting Findings

- The production Vite build passed during the repository audit.
- `npx tsc -p tsconfig.app.json --noEmit` failed with 20 errors.
- `npm run lint` failed with 32 errors and 39 warnings.
- `CRMOperationsPage.tsx` referenced `createCRMOpportunity`, but the symbol was not available in that file.
- Admin report fields, demo fallback fixtures, shop schema types, a customer portal checkout payload, and an ERP query scope were inconsistent with their current TypeScript contracts.
- Generated Supabase types appeared older than the migrations and application queries.

## Files Inspected

- `src/features/erp/crm/CRMOperationsPage.tsx`
- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/types.ts`
- `src/features/admin/AdminSummaryPages.tsx`
- `src/features/erp/shared/demoFallback.ts`
- `src/features/shop/api.ts`
- `src/features/shop/pages/CustomerPortalPage.tsx`
- `src/integrations/supabase/types.ts`
- `src/services/customerFullService.ts`
- `src/services/financeService.ts`
- `src/services/partiesService.ts`
- Relevant commerce and CRM migrations
- `package.json`

## Changes Made

- Imported the existing Supabase-backed `createCRMOpportunity` API into `CRMOperationsPage.tsx`.
- Corrected the inventory verification job to pass enterprise scope through the second `listInventoryItems` argument.
- Updated demo purchase order and notification fixtures to match current domain types.
- Calculated admin invoice, payment, customer, and supplier totals from the records already returned by the admin summary API.
- Added the established default `iyzico` provider to the customer profile payload required by `CheckoutPayload`.
- Added migration-proven commerce columns to the stale generated types for `products`, `orders`, and `order_items`.
- Removed impossible post-narrowing `missing_table` comparisons in three service error paths.
- Added an `npm run typecheck` script.

## TypeScript Errors Before

Command:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Result: failed with 20 errors.

## TypeScript Errors After

Command:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Result: passed with zero errors.

The initial 20 TypeScript errors were reduced to zero.

## Validation Results

### Build

Command:

```bash
npm run build
```

Result: passed. Vite transformed 3,553 modules.

Existing warnings remain:

- `caniuse-lite` data is 12 months old.
- `pdfjs-dist/build/pdf.js` uses `eval`.
- Several production chunks exceed 500 kB after minification.

### Lint

Command:

```bash
npm run lint
```

Result: failed with 71 findings: 32 errors and 39 warnings.

These are pre-existing repository-wide lint findings, primarily explicit `any` usage, React hook dependency warnings, shadcn fast-refresh warnings, and a CommonJS import in `tailwind.config.ts`. They were not expanded into this TypeScript stabilization phase.

## Risk Assessment

The CRM change wires an already implemented API function and does not introduce a new write path. Generated type additions are limited to columns explicitly present in local migrations, but the complete type file is still older than the full deployed schema. Live Supabase type generation remains required to establish production parity.

Admin financial totals are now derived client-side from the records returned by the existing summary calls. If those list functions later paginate, the totals should move to a server-side aggregate.

The customer profile payload uses `iyzico`, matching the existing checkout default. This field is required by a shared payload type even though profile persistence does not use payment-provider data directly.

## Manual QA Checklist

- Create a CRM opportunity and confirm it persists in `crm_opportunities`.
- Confirm the CRM opportunity list refreshes after creation.
- Open admin finance and report summary pages.
- Open ERP pages that use company and branch scope.
- Load the public shop catalog and product detail pages.
- Sign in to the customer portal and exercise the affected checkout/reorder path.
- Run TypeScript, build, and lint validation.

## Next Recommended Phase

Normalize application launcher, route, and sidebar permissions, then add role-based navigation smoke tests. Separately regenerate the complete Supabase types from the live project and review the remaining repository-wide lint backlog.
