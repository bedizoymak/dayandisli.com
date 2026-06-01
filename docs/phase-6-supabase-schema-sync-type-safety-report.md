# Phase 6 Supabase Schema Sync and Type Safety Report

Date: 2026-06-01  
Workspace: `C:\Users\Bediz\Documents\dayandisli.com`  
Scope: Supabase schema/type-safety stabilization only. No new ERP workflows or role filtering were added.

## Executive Summary

The ERP codebase is ahead of the generated Supabase TypeScript definitions. The current `src/integrations/supabase/types.ts` only represents the original public/shop/admin baseline plus `quotations`, while the code now queries many ERP, CRM, purchasing, notification, finance, and manual-sync tables.

Supabase CLI is installed and the project has `supabase/config.toml`, but type regeneration could not be completed in this local session:

- `supabase status` failed because Docker Desktop/local Supabase containers are not available.
- `supabase gen types --project-id avspgczfqsazarwzhpau --schema public --lang typescript` failed because the current Supabase account lacks privileges for generated types on this project.

Because regeneration was blocked, `src/integrations/supabase/types.ts` was not overwritten. This avoids committing broken or guessed generated types. Type-safety cleanup was limited to tables/functions already represented in the existing generated types.

## Migration Inventory

### Applied Migration Files Present Locally

- `supabase/migrations/20251208092932_b7d45e49-989a-4ea1-a451-45de4f44dffd.sql`
  - Baseline public/shop/admin support:
  - `settings`
  - `allowed_emails`
  - `products`
  - `product_images`
  - `orders`
  - `order_items`
  - `order_counter`
  - `generate_order_number`
  - `is_email_allowed`

- `supabase/migrations/20260517110000_admin_users_auth.sql`
  - `admin_users`

- `supabase/migrations/20260517153000_erp_core_schema.sql`
  - ERP foundation:
  - `erp_users`
  - `stakeholders`
  - `erp_quotation_links`
  - `sales_orders`
  - `sales_order_items`
  - `machines`
  - `production_routes`
  - `production_route_steps`
  - `work_orders`
  - `work_order_operations`
  - `subcontracting_jobs`
  - `documents`
  - `inventory_items`
  - `inventory_movements`
  - `measuring_tools`
  - `financial_accounts`
  - `invoices`
  - `payments`
  - `employees`
  - `employee_time_entries`
  - `employee_assets`
  - `shipments`
  - `shipment_items`
  - `quality_reports`
  - `quality_measurements`
  - `maintenance_tasks`
  - `erp_number_sequences`
  - `next_erp_number`

- `supabase/migrations/20260517230000_erp_phase2_phase3_readiness.sql`
  - Additive ERP readiness/RLS/index work.

- `supabase/migrations/20260518093000_erp_phase5_audit_purchasing.sql`
  - `erp_audit_logs`
  - `purchase_orders`
  - `purchase_order_items`

- `supabase/migrations/20260518143000_erp_phase6_workflow_notifications.sql`
  - Existing migration already named Phase 6.
  - Adds workflow notification support:
  - `erp_notifications`
  - workflow trigger/function logic for operations, quality, subcontracting, and shipments.

- `supabase/migrations/20260601120000_crm_sales_workflows.sql`
  - CRM/Sales workflow tables:
  - `crm_leads`
  - `crm_opportunities`
  - `crm_tasks`
  - `crm_activities`
  - CRM number sequence keys.

### Manual SQL Files Present

- `supabase/manual/erp_core_schema.sql`
- `supabase/manual/erp_customer_supplier_finance_schema.sql`
- `supabase/manual/customer_full_erp_sync.sql`

Manual SQL defines or references tables that are used by code but are not part of the normal migration inventory:

- `parties`
- `financial_transactions`
- `payment_documents`
- `party_notes`
- `customers_full`

## Generated Types Status

Current generated type file:

- `src/integrations/supabase/types.ts`

Tables currently represented:

- `allowed_emails`
- `order_counter`
- `order_items`
- `orders`
- `product_images`
- `products`
- `quotations`
- `settings`

Functions currently represented:

- `generate_order_number`
- `is_email_allowed`

Status:

- Stale for ERP.
- Stale for CRM/Sales.
- Stale for purchasing/audit/notifications.
- Missing `admin_users`, even though app access control queries it.
- Missing `next_erp_number`, even though ERP sequencing depends on it.

## Tables Missing From Types

### Migration-backed tables missing from `types.ts`

- `admin_users`
- `erp_users`
- `stakeholders`
- `erp_quotation_links`
- `sales_orders`
- `sales_order_items`
- `machines`
- `production_routes`
- `production_route_steps`
- `work_orders`
- `work_order_operations`
- `subcontracting_jobs`
- `documents`
- `inventory_items`
- `inventory_movements`
- `measuring_tools`
- `financial_accounts`
- `invoices`
- `payments`
- `employees`
- `employee_time_entries`
- `employee_assets`
- `shipments`
- `shipment_items`
- `quality_reports`
- `quality_measurements`
- `maintenance_tasks`
- `erp_number_sequences`
- `erp_audit_logs`
- `purchase_orders`
- `purchase_order_items`
- `erp_notifications`
- `crm_leads`
- `crm_opportunities`
- `crm_tasks`
- `crm_activities`

### Manual/legacy tables used by code and missing from `types.ts`

- `parties`
- `financial_transactions`
- `payment_documents`
- `party_notes`
- `customers_full`
- `customer_profile`
- `counter`
- `parasut_tokens`
- `parasut_contacts`
- `parasut_products`
- `parasut_invoices`

These should either be promoted into normal migrations or explicitly documented as external/manual schema dependencies.

## CRM/Sales Type Verification

CRM/Sales migration exists locally:

- `supabase/migrations/20260601120000_crm_sales_workflows.sql`

Expected CRM tables:

- `crm_leads`
- `crm_opportunities`
- `crm_tasks`
- `crm_activities`

Current `types.ts` status:

- None of the four CRM tables are represented.
- Current code therefore still needs casts in `src/features/erp/shared/erpApi.ts` for CRM/Sales operations.

Conclusion:

- CRM/Sales schema exists in migration form, but generated TypeScript types do not verify it yet.

## Existing Phase 6 Workflow Notification Migration Status

There is already a local migration named:

- `supabase/migrations/20260518143000_erp_phase6_workflow_notifications.sql`

Local status:

- Present in repository.
- Referenced by current API/database status checks through `erp_notifications`.
- Build does not prove whether it is applied in the remote Supabase database.

Remote/local database status:

- Could not be verified in this session.
- `supabase status` failed because local Docker/Supabase containers are not reachable.
- Remote type generation failed due Supabase platform access permissions.

Recommendation:

- Treat this migration as an existing Phase 6 database foundation migration until production migration state is confirmed.
- Before Phase 7, verify whether it is applied remotely with `supabase migration list --linked` from an account with project permissions.

## Supabase Type Regeneration Attempt

CLI version:

```bash
supabase --version
```

Result:

```text
2.101.0
```

Local status command:

```bash
supabase status
```

Result:

```text
failed to inspect container health ... dockerDesktopLinuxEngine ... The system cannot find the file specified.
```

Remote/project-id generation command attempted:

```bash
supabase gen types --project-id avspgczfqsazarwzhpau --schema public --lang typescript
```

Result:

```text
failed to retrieve generated types: Your account does not have the necessary privileges to access this endpoint.
```

Generated types were not changed.

## Exact Commands Needed

Use one of these once project access or local Supabase is available.

### Preferred remote generation

```bash
supabase login
supabase gen types --project-id avspgczfqsazarwzhpau --schema public --lang typescript > src/integrations/supabase/types.ts
npm run build
```

### If the project is linked and the account has access

```bash
supabase login
supabase link --project-ref avspgczfqsazarwzhpau
supabase migration list --linked
supabase gen types --linked --schema public --lang typescript > src/integrations/supabase/types.ts
npm run build
```

### Local generation if Docker/Supabase local stack is available

```bash
supabase start
supabase db reset
supabase gen types --local --schema public --lang typescript > src/integrations/supabase/types.ts
npm run build
```

Important:

- Do not commit `types.ts` unless `npm run build` passes after generation.
- If remote production has migrations not present locally, prefer remote generation.
- If local migrations are the source of truth, run `supabase db reset` before local generation so all migrations are represented.

## `as never` Usage Before/After

Before Phase 6 cleanup:

```text
238 lines matched `as never` under src/
```

After Phase 6 cleanup:

```text
219 lines matched `as never` under src/
```

Reduced casts in areas already supported by generated types:

- `products`
- `orders`
- `order_items`
- `settings`
- `generate_order_number`

Remaining casts are mostly caused by missing generated types for:

- ERP core tables
- CRM/Sales tables
- admin auth table
- purchasing/audit/notification tables
- manual/legacy finance and party tables
- dynamic admin table access

## Files Modified

- `src/features/shop/api.ts`
  - Removed unnecessary `as never` casts for generated shop tables and `generate_order_number`.

- `src/components/ProtectedRoute.tsx`
  - Removed unnecessary `as never` cast for generated `settings` table access.

- `src/features/admin/AdminSettings.tsx`
  - Removed unnecessary `as never` casts for generated `settings` table read/write.

- `docs/phase-6-supabase-schema-sync-type-safety-report.md`
  - Added this report.

Also present from the previous audit task and included by `git add .`:

- `docs/bediz-local-full-folder-audit-before-phase-6.md`

## Validation

Command:

```bash
npm run build
```

Result:

- Passed.

Build warnings still present:

- Browserslist/caniuse-lite data is stale.
- `pdfjs-dist` uses eval.
- Main chunk is larger than 500 kB after minification.

Git status after modifications showed:

```text
 M src/components/ProtectedRoute.tsx
 M src/features/admin/AdminSettings.tsx
 M src/features/shop/api.ts
?? docs/bediz-local-full-folder-audit-before-phase-6.md
?? docs/phase-6-supabase-schema-sync-type-safety-report.md
```

## Risks

- ERP/CRM type safety is still incomplete until Supabase types are regenerated from the real current schema.
- The production database migration state was not verified because local Docker is unavailable and remote type access is restricted.
- `types.ts` may reflect an older database snapshot, not current migrations.
- Manual SQL dependencies are not fully represented in migration history.
- Broad authenticated RLS policies remain in place; this phase intentionally did not add role filtering.
- Dynamic admin table access will continue to need looser typing unless replaced with typed per-table data access functions.

## Recommended Phase 7 Scope

Recommended Phase 7 should focus on verified workflow UX and typed data access after schema sync is completed:

- Regenerate and commit Supabase types from the confirmed schema.
- Replace remaining ERP/CRM `as never` casts table by table.
- Promote manual schema dependencies into migrations or retire unused legacy services.
- Add typed data access helpers for CRM leads, opportunities, tasks, and activities.
- Add CRM lead/opportunity detail pages and activity timeline integration.
- Add Opportunity -> Quotation prefill only after CRM/Sales types are verified.
- Keep role-based filtering for a later permissions phase.

