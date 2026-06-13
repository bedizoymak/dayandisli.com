# Phase 20 — Production RPC Local Verification

## Objective

Apply the two Production RPC drafts only to the running local Supabase stack
and collect integration evidence for transactions, concurrency, RLS, grants,
and cleanup without changing production or runtime TypeScript behavior.

## Starting Findings

- Both RPCs existed only as review drafts under `supabase/manual/`.
- Static SQL safety verification passed in Phase 19.
- The local Supabase API is running on `127.0.0.1`.
- The repository remains linked to the production project, so no linked
  migration or remote database command is permitted.
- The existing inventory integration harness provides a proven pattern for
  local users, tenant fixtures, forced audit failures, and cleanup.
- Local execution found that `work_order_operations` has RLS enabled but no
  authenticated SELECT or INSERT policy. A `SECURITY INVOKER` route RPC cannot
  operate without reviewed policies for that table.

## Environment Target

Local Supabase only:

- API host: `127.0.0.1`
- Database host: `127.0.0.1`
- Remote project operations: prohibited

## Safety Gate

The integration harness must:

- Require `RUN_PRODUCTION_RPC_INTEGRATION=1`.
- Read and validate local Supabase status.
- Accept only `localhost` or `127.0.0.1`.
- Reject production ref `meauutjsnnggzcigyvfp`.
- Reject production name `dayandisli.com`.
- Refuse caller-provided remote URLs.
- Never print API keys, database passwords, JWTs, or access tokens.
- Use Docker `psql` only against the local Supabase database container.

## Files Inspected

- `supabase/manual/production_work_order_from_sales_order_rpc_draft.sql`
- `supabase/manual/production_route_operations_rpc_draft.sql`
- `scripts/verify-production-rpc-sql.mjs`
- `scripts/test-inventory-rpc-integration.mjs`
- `docs/PHASE_19_PRODUCTION_RPC_DESIGN.md`
- Relevant ERP schema, audit, tenant, and RLS migrations

## SQL Applied Where

Both draft files were applied directly with `psql` to the local Supabase
database container discovered from the running stack. No migration file,
`supabase db push`, linked-project operation, or remote SQL execution was used.

The functions remain installed only in the disposable local database. Two
temporary local SELECT/INSERT policies for `work_order_operations` were created
for route testing and removed during harness cleanup.

## Test Data Created

The harness created uniquely named disposable fixtures for:

- Two local authenticated users.
- Two companies and branch-scoped memberships.
- Four Sales orders and their items.
- Four direct work-order fixtures plus RPC-created work orders.
- One populated route and one empty route.
- Audit-failure rollback records.

All test business rows and Auth users were removed. Cleanup queries confirmed
zero remaining test Sales orders, work orders, and routes.

## Sales-to-Work-Order RPC Results

- Successful conversion created one work order and changed the Sales order to
  `in_production`.
- A second conversion returned `Bu sipariş için zaten iş emri var.`.
- Two concurrent calls produced exactly one work order: one succeeded and one
  returned the Turkish duplicate message.
- A user belonging only to another company received
  `Bu şirket veya şube için işlem yetkiniz yok.`.
- Anonymous execution was denied.

## Route-to-Operations RPC Results

- Two route steps produced exactly two operations in `10, 20` step order.
- Repeating generation without append returned
  `Bu iş emrinde zaten operasyon var.`.
- An empty route returned
  `Üretim rotasında operasyon adımı bulunamadı.`.
- Two concurrent calls produced one complete operation set; one call succeeded
  and one failed.
- Anonymous execution was denied.

## RLS Results

- Cross-company conversion was denied by the RPC's explicit tenant check.
- Anonymous execution was denied for both functions by function grants.
- The current local schema lacks authenticated policies for
  `work_order_operations`; the route function failed under `SECURITY INVOKER`
  until temporary local test policies were installed.
- The local policy inspection also exposed ambiguous generated tenant
  predicates such as `cm.company_id = cm.company_id`. These policies require a
  separate correction and verification before production rollout.

## Rollback Results

- A temporary audit trigger forced conversion audit insertion to fail.
  PostgreSQL rolled back both the work order and Sales status update.
- The same trigger forced route audit insertion to fail. PostgreSQL rolled back
  every operation from the call.
- Both failures surfaced the deterministic local Turkish test error:
  `Phase 20 zorunlu denetim kaydı hatası.`.

## Concurrency Results

- Concurrent Sales conversion serialized on the locked Sales order. Exactly one
  call succeeded and one failed; one work order persisted.
- Concurrent route generation serialized on the locked work order. Exactly one
  call succeeded and one failed; one complete two-operation set persisted.

## Production Readiness Decision

Not ready for production. The SQL drafts parse and pass local transaction,
concurrency, explicit tenant, anonymous-denial, rollback, and cleanup tests.
Production rollout remains blocked by missing tenant-aware
`work_order_operations` policies, ambiguous existing tenant policy predicates,
and the missing unique Sales-order-to-work-order database constraint.

## Changes Made

- Added `scripts/test-production-rpc-integration.mjs`.
- Added strict local-target and explicit opt-in gates.
- Added isolated fixture creation and verified cleanup.
- Added local draft application, concurrency, RLS, anonymous denial, and
  forced-audit rollback tests.
- Documented the discovered RLS prerequisites.
- Runtime TypeScript and active migrations remain unchanged.

## Validation Results

- Local integration: passed all 14 reported safety and workflow checks.
- SQL drafts: parsed and applied successfully to local PostgreSQL.
- Static SQL verifier: passed.
- Focused ESLint: passed for the integration and verifier scripts.
- TypeScript: passed.
- Tests: passed, 134 tests across 5 files.
- Build: passed with existing bundle-size, `eval`, and Browserslist warnings.
- Repository ESLint: failed on the known backlog with 32 errors and 40
  warnings; no Phase 20 file introduced a lint finding.
- Temporary database artifacts: zero Phase 20 policies and zero rollback
  triggers remained after execution.
- Diff whitespace validation: passed.

## Remaining Risks

- Draft SQL may require changes after real PostgreSQL parsing.
- Production requires tenant-aware `work_order_operations` policies; Phase 20
  uses temporary permissive policies locally only to verify RPC transactions.
- Existing tenant policy expressions require review because the generated
  membership predicates show ambiguous unqualified company and branch columns.
- There is no unique `work_orders.sales_order_id` constraint for direct writers.
- Local concurrency and data volume do not fully represent production.

## Next Recommended Phase

Use the local evidence to revise the drafts, then package reviewed migrations
and feature-flagged adapters only after all production prerequisites are met.
