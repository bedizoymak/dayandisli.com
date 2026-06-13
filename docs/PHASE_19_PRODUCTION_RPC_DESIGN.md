# Phase 19 — Transaction-Safe Production RPC Design

## Objective

Design review-only PostgreSQL RPC drafts for atomic Sales-order conversion and
route-operation generation. No draft is an active migration and no SQL is
applied to any database in this phase.

## Starting Findings

- Phase 18 prevents silent client-side failures but cannot roll back persisted
  rows.
- Sales orders and work orders carry `company_id` and `branch_id`.
- Production routes, route steps, and work-order operations do not currently
  carry tenant columns.
- Route and operation step numbers already have unique constraints within their
  parent records.
- `next_erp_number('WORK_ORDER')` is the existing number generator.
- Existing tenant RLS uses company membership and branch scope for parent ERP
  records, while older permissive policies require a separate policy audit
  before rollout.

## Files Inspected

- `src/features/erp/shared/api/productionApi.ts`
- `src/features/erp/shared/api/salesApi.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/types.ts`
- `supabase/migrations/20260517153000_erp_core_schema.sql`
- `supabase/migrations/20260518093000_erp_phase5_audit_purchasing.sql`
- `supabase/migrations/20260603120000_phase24_multi_company_branch_enterprise_foundation.sql`
- `supabase/migrations/20260603123000_phase25_tenant_isolation_rls_data_safety.sql`
- `supabase/migrations/20260603130000_phase26_supabase_production_security_governance.sql`
- Existing inventory RPC draft, migration, and verifier
- `docs/PHASE_18_PRODUCTION_WORKFLOW_HARDENING.md`

## Current Client-Side Workflows

### Sales Order to Work Order

The browser receives a Sales order, checks `work_orders` for an existing
`sales_order_id`, lists Sales order items, inserts a work order, updates the
Sales order to `in_production`, and writes an audit row.

Partial state can occur after work-order insertion if the Sales update or audit
insert fails. Two concurrent clients can both pass the duplicate check before
either inserts.

### Route to Operations

The browser checks existing operations, lists ordered route steps, and inserts
one operation at a time. A later insert failure leaves earlier operations
persisted. Concurrent requests can race, although the existing
`(work_order_id, step_no)` unique constraint prevents duplicate step numbers.

## Target RPC Workflows

Each PL/pgSQL function executes in the caller's transaction and raises on any
critical failure. PostgreSQL rolls back all statements in the function call
when an exception escapes.

The functions use `SECURITY INVOKER`, an empty `search_path`, schema-qualified
objects, parent-row locks, explicit tenant checks, transactional audit inserts,
and authenticated-only execution grants.

## RPC Contract: Sales Order to Work Order

Proposed signature:

```sql
public.erp_create_work_order_from_sales_order(p_sales_order_id uuid)
returns public.work_orders
```

Behavior:

1. Require an authenticated user and email.
2. Select and lock the visible Sales order with `FOR UPDATE`.
3. Validate active company and branch membership when `company_id` is present.
4. Reject an existing work order with `Bu sipariş için zaten iş emri var.`.
5. Read the first Sales order item by creation order.
6. Generate a work-order number with the existing sequence function.
7. Insert a work order using the Sales order tenant, stakeholder, title,
   priority, due date, and first-item details.
8. Update the Sales order to `in_production`.
9. Insert the existing Turkish conversion audit description.
10. Return the created work order.

The Sales row lock serializes calls made through this RPC. It does not prevent a
different direct writer from inserting another work order. Before production
rollout, existing data must be checked and a unique partial index on
`work_orders(sales_order_id) where sales_order_id is not null` should be
reviewed as a separate migration.

No initial route operations are created because current runtime behavior does
not do so.

## RPC Contract: Route to Operations

Proposed signature:

```sql
public.erp_create_operations_from_route(
  p_work_order_id uuid,
  p_route_id uuid,
  p_allow_append boolean default false
)
returns setof public.work_order_operations
```

Behavior:

1. Require an authenticated user and email.
2. Select and lock the visible work order with `FOR UPDATE`.
3. Validate active company and branch membership from the work order.
4. Confirm the route is visible under current RLS.
5. Reject existing operations unless append is explicitly allowed, preserving
   `Bu iş emrinde zaten operasyon var.`.
6. Read route steps ordered by `step_no`.
7. Reject a route with no steps using a Turkish validation message.
8. Insert every operation in step order.
9. Insert one work-order audit row recording route and operation count.
10. Return only the newly inserted operations ordered by `step_no`.

Any insert, unique-constraint, RLS, or audit failure aborts the function call
and rolls back every operation inserted by that call.

## RLS and Security Considerations

- Both drafts use `SECURITY INVOKER`; table RLS and grants remain effective.
- Execution is revoked from `PUBLIC` and `anon`, then granted to
  `authenticated`.
- Authentication is checked with `auth.uid()` and the JWT email.
- Authorization uses active `company_memberships`, never user-editable
  `user_metadata`.
- Branch-scoped users may act only within their branch; company-wide
  memberships with a null branch may act across company branches.
- Parent records with null `company_id` retain current legacy compatibility.
  This must be reviewed before production because null-tenant rows are broadly
  visible in current policies.
- Route templates are global in the current schema. Tenant-owned routes require
  a later schema and RLS design rather than assumptions inside these RPCs.
- Work-order operations inherit authorization through the locked work order
  because they have no tenant columns.
- Audit inserts are critical and transactional in the drafts. An audit failure
  rolls back the business writes.
- Existing older permissive authenticated policies must be audited to confirm
  they do not undermine later tenant policies.

## SQL Drafts

- `supabase/manual/production_work_order_from_sales_order_rpc_draft.sql`
- `supabase/manual/production_route_operations_rpc_draft.sql`

Both files are marked `DRAFT ONLY`, remain outside `supabase/migrations/`, and
must not be run without isolated local or staging review.

## TypeScript Integration Plan

After local verification:

1. Regenerate Supabase types from the isolated target.
2. Add feature flags for each Production RPC, defaulting to the current client
   workflows.
3. Call `supabase.rpc` with IDs rather than trusting client-provided tenant or
   business fields.
4. Normalize PostgreSQL Turkish validation messages through existing API result
   helpers.
5. Preserve `erpApi.ts` re-exports and existing UI call sites.
6. Add mocked adapter tests for flag selection and RPC error mapping.
7. Enable only in staging after database integration tests pass.

No runtime TypeScript behavior changes in this phase.

## Test Strategy

Future isolated database tests should cover:

- Successful conversion with and without Sales order items.
- Duplicate conversion and two concurrent conversion attempts.
- Cross-company and cross-branch denial.
- Sales update or audit failure rolling back the work order.
- Successful route generation preserving step order.
- Empty route rejection.
- Existing-operation rejection and explicit append behavior.
- A forced operation or audit failure rolling back all inserted operations.
- Anonymous execution denial.
- RLS behavior for company-wide, branch-scoped, and legacy null-company rows.
- Cleanup verification after every test.

## Changes Made

- Added two review-only SQL RPC drafts.
- Added a static verifier for draft markers, invoker security, grants, and core
  table references.
- Added this design and rollout assessment.
- No migrations, database execution, or runtime TypeScript changes were made.

## Validation Results

- TypeScript: passed.
- Tests: passed, 134 tests across 5 files.
- Build: passed with existing bundle-size, `eval`, and Browserslist warnings.
- Production SQL verifier: passed all draft, security, grant, and table
  reference checks.
- Focused ESLint: passed for `verify-production-rpc-sql.mjs`.
- Repository ESLint: failed on the known backlog with 32 errors and 40
  warnings; no Phase 19 file introduced a lint finding.
- Diff whitespace validation: passed.
- Database execution: intentionally not performed.

## Remaining Risks

- No unique database constraint currently guarantees one work order per Sales
  order outside the RPC.
- Route templates and operation rows lack direct tenant columns.
- Legacy permissive RLS policies may coexist with tenant policies.
- The drafts have not been parsed or executed by PostgreSQL.
- The existing number generator is `SECURITY DEFINER` and requires a separate
  security review even though the new drafts are `SECURITY INVOKER`.
- Exact production grants and RLS behavior require isolated integration tests.

## Next Recommended Phase

Statically review the drafts, apply them only to an isolated local Supabase
environment, add concurrency and forced-rollback integration tests, and decide
whether the uniqueness and RLS prerequisites are ready for staging.
