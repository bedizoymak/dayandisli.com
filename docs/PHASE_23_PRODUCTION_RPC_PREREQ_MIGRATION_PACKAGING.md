# Phase 23 — Production RPC Prerequisite Migration Packaging

## Objective

Package the locally verified production RPC prerequisites into reviewed deployment artifacts without applying them to production.

## Starting Findings

- Phase 22 verified tenant-aware `work_order_operations` policies locally.
- Explicit tenant predicates for `sales_orders` and `work_orders` compiled without self-comparisons.
- The effective local `erp_audit_logs` member policies still contain ambiguous company and branch self-comparisons.
- A partial unique index on `work_orders.sales_order_id` behaved correctly locally.
- Concurrent index creation cannot run inside a transaction block.

## Files Inspected

- `supabase/manual/work_order_operations_rls_prereq_draft.sql`
- `supabase/manual/tenant_policy_predicate_corrections_draft.sql`
- `supabase/manual/work_orders_sales_order_unique_draft.sql`
- `scripts/verify-production-prereq-sql.mjs`
- `scripts/test-production-prereq-integration.mjs`
- `docs/PHASE_21_RLS_AND_PRODUCTION_RPC_PREREQUISITES.md`
- `docs/PHASE_22_RLS_UNIQUENESS_LOCAL_VERIFICATION.md`
- effective local policies in `pg_policies`
- migrations defining `erp_audit_logs`, tenant columns, and membership policies

## Migration Strategy

The prerequisite deployment is split into two artifacts:

1. A normal Supabase migration containing transaction-safe RLS policy changes.
2. A separately approved manual SQL step containing the concurrent partial unique index.

The split prevents `CREATE UNIQUE INDEX CONCURRENTLY` from being placed in a migration runner transaction.

## RLS Migration

`supabase/migrations/20260613052204_production_rpc_rls_prerequisites.sql`:

- enables RLS on all four scoped tables;
- creates tenant-aware SELECT, INSERT, and UPDATE policies for `work_order_operations`;
- resolves operation access through parent `work_orders`;
- targets authenticated users only;
- adds no role grants;
- performs no data cleanup.

## Tenant Predicate Correction Migration

The migration replaces member policies for:

- `sales_orders`;
- `work_orders`;
- `erp_audit_logs`.

Every membership comparison explicitly qualifies the target table. Company-wide membership uses a null membership branch; branch-scoped membership requires an exact non-null target branch.

For compatibility, rows with null `company_id` retain the existing legacy allowance. The existing audit command surface is preserved as SELECT, INSERT, and UPDATE; this phase corrects tenant isolation without redesigning audit mutability.

## Unique Index Deployment Strategy

`supabase/manual/work_orders_sales_order_unique_concurrent_index.sql` is an operator-run production step. It:

1. reports duplicate non-null `sales_order_id` groups;
2. raises an exception when duplicates exist;
3. creates the partial unique index concurrently only after the guard succeeds.

It must run with stop-on-error behavior in a session that does not wrap the script in a transaction. It must not be copied into the normal migration chain unless the execution mode is explicitly verified.

## Validation Results

- The normal migration executed successfully inside a local `BEGIN` / `ROLLBACK` transaction.
- `node scripts/verify-production-prereq-sql.mjs`: passed.
- `npx eslint scripts/verify-production-prereq-sql.mjs scripts/test-production-prereq-integration.mjs`: passed.
- `$env:RUN_PRODUCTION_PREREQ_INTEGRATION="1"; node scripts/test-production-prereq-integration.mjs`: passed all RLS, predicate, uniqueness, and cleanup checks.
- `npm run typecheck`: passed.
- `npm run test`: passed, 5 files and 134 tests.
- `npm run build`: passed with existing bundle-size, dependency-data, and third-party `eval` warnings.
- `npm run lint`: failed on the known repository backlog with 32 errors and 40 warnings.
- No SQL was applied to production.

## Production Deployment Notes

1. Obtain explicit production approval.
2. Back up and inspect effective policies and grants.
3. Run the duplicate query from the manual index file.
4. Stop and review data if any duplicate group is returned.
5. Apply the normal RLS migration using the approved migration process.
6. Run the manual index file separately with `ON_ERROR_STOP=1` and no transaction wrapper.
7. Inspect `pg_policies` for explicit target qualification.
8. Inspect `pg_indexes` for the partial unique index.
9. Run approved tenant and production workflow smoke tests.

No production command is executed by Phase 23.

## Rollback Plan

- Keep the previous policy definitions from the pre-deployment catalog export.
- If RLS behavior regresses, replace the new named policies with reviewed prior definitions through a new corrective migration; do not edit applied migration history.
- Drop the partial unique index concurrently if it causes an unexpected application regression:

```sql
drop index concurrently if exists public.uq_work_orders_sales_order_id_not_null;
```

- Do not disable RLS as a rollback mechanism.

## Remaining Risks

- Overlapping admin policies remain and must be included in deployment review.
- Null-company rows retain legacy cross-tenant visibility.
- Audit UPDATE access is preserved for compatibility and should receive a separate immutability review.
- The correction remains intentionally scoped rather than fixing every generated tenant policy.
- The manual index step depends on operator discipline and non-transactional execution.
- Local verification does not replace staging verification.

## Next Recommended Phase

Apply both artifacts to an approved staging environment, rerun catalog and tenant-isolation tests, verify the manual non-transactional index procedure, and only then prepare the production RPC migration rollout.
