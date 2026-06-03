# Phase 24 Multi-Company, Branch and Enterprise Foundation Report

## Repository Summary

Phase 24 extends the completed Phase 0 through Phase 23 ERP, CMS, commerce and financial reliability foundation with an additive enterprise architecture. The implementation keeps the current single-company behavior working while introducing explicit company, branch, warehouse and membership primitives for future tenant isolation.

Primary touched areas:

- Supabase migration: `20260603120000_phase24_multi_company_branch_enterprise_foundation.sql`
- ERP shared types and API: enterprise entities, ownership fields and management helpers
- ERP settings UI: company, branch, warehouse and default user assignment management
- ERP reporting UI: company and branch filters with consolidated reporting defaults

## Company Architecture

New `companies` table supports:

- Multiple companies
- Company code and legal/trade names
- Active, passive and suspended statuses
- Base currency and timezone configuration
- JSON settings for future company-level behavior
- Primary administrator email

The ERP settings page now exposes a Turkish "Şirketler" tab for company creation, status management and visibility.

## Branch Architecture

New `company_branches` table supports:

- Company to branch hierarchy
- Branch code and branch name
- Active, passive and closed statuses
- Branch manager email
- Phone, email, address, city and country fields
- JSON settings for future branch-level behavior

The ERP settings page now exposes a Turkish "Şubeler" tab for branch creation and status management.

## ERP Isolation Strategy

Phase 24 prepares ERP records for ownership without forcing a disruptive data migration. Nullable `company_id` and `branch_id` fields were added to major operational, financial, commerce and governance tables where the table exists.

Prepared ERP areas:

- CRM: stakeholders, leads, opportunities and tasks
- Sales: sales orders
- Inventory: inventory items and inventory movements
- Procurement: purchase orders
- Production: work orders
- Finance and accounting: financial accounts, invoices, payments, accounting entries
- HR: employees
- E-Commerce: products, orders and shop payment statuses
- Commerce operations: payment provider events, reconciliation logs and refund operations
- Governance: audit logs and notifications

Existing records remain valid because ownership fields are nullable. Future phases can backfill ownership and then tighten RLS policies.

## Warehouse Expansion

New `warehouses` table supports:

- Multi-warehouse records
- Company ownership
- Optional branch linkage
- Active, passive and closed statuses
- Visibility scope: company, branch or private
- Manager and location metadata

Inventory was not rebuilt. Instead:

- `inventory_items.default_warehouse_id` prepares default warehouse assignment.
- `inventory_movements.warehouse_id` prepares movement-level warehouse tracking.
- Existing inventory logic can continue to operate while future stock logic becomes warehouse-aware.

## Financial Entity Expansion

Financial tables now support company and branch context:

- `financial_accounts.company_id`
- `financial_accounts.branch_id`
- `invoices.company_id`
- `invoices.branch_id`
- `payments.company_id`
- `payments.branch_id`
- `accounting_entries.company_id`
- `accounting_entries.branch_id`

This prepares company bank accounts, company cash accounts and branch financial visibility without changing current accounting behavior.

## Authorization Integration

Phase 24 extends Phase 10 authorization with:

- `company_memberships`
- `erp_users.default_company_id`
- `erp_users.default_branch_id`
- `erp_users.accessible_company_ids`
- `erp_users.accessible_branch_ids`

The settings screen now lets authorized ERP managers assign default company and branch values to users. Membership records are available for future fine-grained policies and branch manager workflows.

## Reporting Strategy

Reporting now includes:

- Company filter
- Branch filter
- Consolidated default view through "Tüm Şirketler" and "Tüm Şubeler"
- Company and branch scope KPI cards

Filters are applied to operational rows that expose company and branch ownership fields. Existing records without ownership remain visible in consolidated mode and are excluded only when a specific company or branch is selected.

## Supabase Mapping

New tables:

- `companies`
- `company_branches`
- `warehouses`
- `company_memberships`

New governance and ownership fields:

- `company_id`
- `branch_id`
- `warehouse_id` where warehouse context is relevant
- `default_company_id` and `default_branch_id` on `erp_users`
- `accessible_company_ids` and `accessible_branch_ids` on `erp_users`

Indexes:

- Company and branch lookup indexes for major ERP tables
- Warehouse company and branch indexes
- Membership email and scope indexes
- ERP user default company and branch indexes

RLS:

- RLS enabled for new enterprise tables
- Active `admin_users` can manage enterprise tables
- Users can read their own company membership records by email

## Migration Strategy

The migration is safe and additive:

- No existing columns are dropped.
- No existing records are reassigned by force.
- New ownership fields are nullable.
- Default company, branch and warehouse records are seeded with conflict protection.
- Existing module logic remains compatible.

Recommended next migration steps:

- Backfill existing ERP rows to the default company and main branch after stakeholder review.
- Add module-specific ownership write paths in forms and Edge Functions.
- Tighten RLS after backfill and authorization policy review.
- Add branch-aware warehouse stock aggregation.

## Scalability Review

Schema impact:

- Adds enterprise hierarchy tables and ownership fields across major domains.

RLS impact:

- New RLS policies are intentionally broad for administrators.
- Tenant-grade RLS must be introduced only after data backfill and user membership verification.

Reporting impact:

- Existing reporting infrastructure now supports company and branch filters.
- Consolidated reporting remains the default.

Performance impact:

- Ownership indexes were added for future scoped queries.
- Current reports still load several full datasets client-side; larger tenant datasets should move to server-side reporting views or RPCs.

Migration impact:

- Safe for current records because ownership is nullable.
- A later mandatory ownership migration will require careful backfill validation.

## Risks

- Existing records do not yet have assigned company or branch ownership.
- RLS does not yet isolate all operational ERP tables by company or branch.
- Some create/update forms do not yet write company and branch fields.
- Reporting remains client-side and should be optimized before high-volume multi-company use.
- Supabase CLI availability should be confirmed before applying remote migrations from local tooling.

## Recommendations

- Treat Phase 24 as the enterprise foundation, not final tenant isolation.
- Backfill all existing ERP records to the default company and branch in a controlled Phase 25 migration.
- Introduce company and branch selectors on transactional forms.
- Move high-volume reporting to scoped database views or RPC functions.
- Add membership-aware RLS policies after data backfill.
- Extend payment, fulfillment and notification Edge Functions with company and branch context.

## Proposed Phase 25 Scope

Recommended Phase 25 scope:

- Enterprise ownership backfill
- Company and branch selectors in transactional ERP forms
- Membership-aware RLS policies
- Branch-aware inventory movement enforcement
- Company-aware accounting periods and fiscal configuration
- Server-side consolidated reporting views
- Tenant isolation audit and security verification
