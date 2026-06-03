# Phase 25 Tenant Isolation, RLS and Data Safety Report

## Objective

Phase 25 hardens the Phase 24 enterprise foundation so company and branch separation can scale safely. The work stays non-destructive and does not add new modules.

## Company and Branch Field Audit

Phase 24 introduced `company_id` and `branch_id` ownership fields across major ERP, commerce, financial and governance tables. Phase 25 audited those fields and focused enforcement on the main read/write APIs and RLS foundations.

Covered areas:

- CRM: stakeholders, leads, opportunities and tasks
- Sales: sales orders
- Inventory: inventory items and movements
- Procurement: purchase orders
- Production: work orders
- Finance: financial accounts, invoices and payments
- HR: employees
- Commerce finance: shop payment statuses
- Payment operations: provider events, reconciliation logs, accounting entries and refund operations
- Governance: audit logs and notifications

Legacy records with `company_id` set to `null` remain visible until a controlled backfill is completed.

## Query Enforcement

The ERP API now resolves an enterprise query scope before core list operations.

Behavior:

- Admin users without a default company retain consolidated access.
- Users with a default company are scoped by `company_id`.
- Users with a default branch are additionally scoped by `branch_id`.
- Report filters can still apply additional company and branch filtering on the loaded scoped dataset.

Scoped list APIs now include:

- `listStakeholders`
- `listCRMLeads`
- `listCRMOpportunities`
- `listCRMTasks`
- `listSalesOrders`
- `listWorkOrders`
- `listInventoryItems`
- `listInventoryMovements`
- `listEmployees`
- `listFinancialAccounts`
- `listInvoices`
- `listPayments`
- `listPurchaseOrders`
- `listShopPaymentStatuses`
- `listPaymentProviderEvents`
- `listPaymentReconciliationLogs`
- `listPaymentRefundOperations`
- `listAccountingEntries`

## Write-Side Ownership Defaults

Create operations now inherit the current user enterprise context when no explicit company or branch is supplied.

Covered create APIs:

- Stakeholders
- CRM leads, opportunities and tasks
- Sales orders
- Work orders
- Inventory items
- Financial accounts
- Invoices
- Payments
- Purchase orders
- Shop payment statuses
- Refund operations

This prevents new records from being unintentionally created outside the user's default company/branch context.

## User Default Company and Branch Behavior

ERP settings now maintains company membership records when a user is assigned a default company or branch.

Behavior:

- Assigning a default company updates `erp_users.default_company_id`.
- Assigning a default branch updates `erp_users.default_branch_id`.
- Matching `company_memberships` records are created or updated.
- Admin default company assignments are marked as company admin memberships.
- Warehouse/admin branch assignments are marked as branch manager memberships.

This gives RLS a membership source to evaluate instead of relying only on user defaults.

## RLS Policy Foundation

New migration:

- `supabase/migrations/20260603123000_phase25_tenant_isolation_rls_data_safety.sql`

The migration enables RLS on the Phase 24 enterprise tables and ownership-bearing operational tables where they exist.

Policy model:

- Active `admin_users` can manage scoped ERP tables.
- Company members can read rows for their company.
- Branch members can read rows for their branch.
- Company-level members can read branch rows within their company.
- Authenticated users can read their own membership rows.
- Legacy `company_id is null` records remain readable until ownership backfill.

The migration uses `auth.jwt() ->> 'email'` and server-owned tables. It does not use user-editable metadata for authorization decisions.

## Cross-Company Leakage Controls

Controls added:

- Query-level company and branch scoping in ERP API reads
- Write-side ownership defaulting
- Membership-backed RLS policies
- Default company/branch membership synchronization
- Consolidated access limited to admin users without a default company in application reads

Remaining leakage risks:

- Legacy null-owned records are intentionally readable until backfill.
- Some secondary APIs and detail reads still need ownership checks before strict tenant isolation.
- Edge Functions should receive explicit company/branch context before provider and notification operations are fully tenant-isolated.

## Navigation and Filters

No new modules were added.

Existing Phase 24 settings and reports remain the control surfaces:

- ERP settings: user default company/branch assignment
- ERP settings: company, branch and warehouse administration
- ERP reports: company and branch filters

Visible ERP UI remains Turkish.

## Migration and RLS Risks

RLS risks:

- Enabling strict RLS before backfill would hide legacy operational data.
- Detail pages that query by ID can still require ownership enforcement in future phases.
- Membership data must stay synchronized with user defaults and role changes.

Migration risks:

- The current migration is non-destructive.
- It does not backfill existing rows.
- It does not make ownership columns mandatory.
- It does not remove existing policies.

Operational risks:

- Admin accounts retain broad access through `admin_users`.
- Consolidated reporting is still client-side and should move to tenant-aware database views or RPCs for larger datasets.
- Some Edge Functions and workflow automation need tenant context propagation.

## Recommendations

- Backfill existing records to the default company and branch after business approval.
- Add ownership checks to detail/read-by-ID APIs.
- Add tenant context to Edge Functions for checkout, payments, refunds, notifications and fulfillment.
- Convert high-volume reports to tenant-aware database views or RPCs.
- After backfill, remove the temporary `company_id is null` legacy allowance from member RLS policies.
- Add tests for scoped reads, scoped writes and default membership synchronization.

## Proposed Phase 26 Scope

Recommended Phase 26 scope:

- Controlled ownership backfill for legacy records
- Strict tenant RLS after backfill
- Ownership checks for detail pages and mutation APIs
- Tenant-aware Edge Function context propagation
- Company/branch selectors on transactional forms
- Server-side tenant reporting views
