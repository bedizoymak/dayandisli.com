# Phase 25 — Production Schema Audit

## Objective

Audit the linked production migration history and effective schema without making any database or repository schema changes.

## Starting Findings

- Phase 24 found migration `20260613052204_production_rpc_rls_prerequisites.sql` in linked production history.
- The application event was not expected from the recent stabilization phases.
- No approved staging project exists.
- The production state of the manual partial unique index is unknown.

## Environment

The linked target was confirmed as:

- Project ref: `meauutjsnnggzcigyvfp`
- Project name: `dayandisli.com`
- Region: `eu-west-3`
- Status: active and healthy
- Classification: production

All production database access used `SELECT` statements through `supabase db query --linked`.

## Migration History Audit

- Production records all 23 repository migration versions.
- The repository contains no migration version absent from production.
- Production contains no migration version absent from the repository.
- Version `20260613052204` is recorded with name `production_rpc_rls_prerequisites`.
- Its `YYYYMMDDHHMMSS` version format is consistent with the repository migration filename.
- The migration row contains 28 stored statements.
- Stored statement text includes the expected `work_order_operations` and `erp_audit_logs` policy definitions.
- The migration metadata schema has no application timestamp or actor column, so it cannot identify when beyond the encoded version, or by whom, the migration was executed.

## Schema State Audit

RLS is enabled on all audited tables:

- `work_order_operations`
- `work_orders`
- `sales_orders`
- `erp_audit_logs`
- `company_memberships`

RLS is not forced for table owners on these tables, which is normal for the current migration design but means privileged owner roles bypass it.

## Policy Audit

- `work_order_operations` has authenticated SELECT, INSERT, and UPDATE policies deriving access through parent `work_orders`.
- `work_orders`, `sales_orders`, and `erp_audit_logs` have authenticated member policies with explicit target-table company and branch qualification.
- The audited policy catalog contains zero known company self-comparison patterns.
- Admin `ALL` policies remain on `work_orders`, `sales_orders`, and `erp_audit_logs`.
- Null `company_id` rows remain accessible under the packaged legacy compatibility rule.
- `erp_audit_logs` retains authenticated member UPDATE access.
- No audited business-table policy targets `anon`.
- `company_memberships` retains two legacy policies targeting `public`: `Admin users can manage memberships` and `Users can read own memberships`.
- Those public membership policies require an active admin match or JWT email equality, so an anonymous token should not match a row. Their role scope is still broader than the newer authenticated-only duplicates and should be reconciled in a future governance migration.

## Index Audit

- Production does not contain `uq_work_orders_sales_order_id_not_null`.
- Production contains `idx_work_orders_sales_order_id`.
- `idx_work_orders_sales_order_id` is non-unique.
- It is a full B-tree index with no predicate.
- Therefore production does not currently enforce one work order per non-null Sales order.

## Drift Analysis

Classification: `PARTIAL DRIFT`.

Evidence:

- Migration versions are fully matched.
- Effective RLS policies match the packaged migration's expected names and corrected predicates.
- Migration stored statements confirm the prerequisite migration was executed rather than only named in history.
- The separately packaged manual partial unique index is absent.
- The repository rollout design therefore remains only partially realized in production.
- The production application actor and exact execution event cannot be reconstructed from `supabase_migrations.schema_migrations`.

## Findings

1. The prerequisite RLS migration was applied to production before this audit.
2. Effective production policies substantially match the repository migration.
3. The manual partial unique index was not applied.
4. Migration version history is otherwise fully synchronized with the repository.
5. Legacy public-role membership policies remain alongside authenticated governance policies.
6. Existing null-company and audit-update allowances remain active.

## Risk Assessment

- High: production lacks database uniqueness for non-null `work_orders.sales_order_id`, so concurrent or repeated conversion can still create duplicates unless RPC locking alone prevents it.
- Medium: the unexplained production migration event is a deployment-governance failure even though the resulting RLS state matches the repository.
- Medium: legacy `public` membership policies broaden policy role scope and duplicate newer authenticated policies.
- Medium: null-company rows retain cross-tenant compatibility behavior.
- Medium: audit rows remain mutable by tenant members under UPDATE policy.
- Low: migration version drift itself is not present.

## Production Consistency Decision

`REQUIRES MANUAL RECONCILIATION`

Future Production RPC rollout must not continue directly. A dedicated staging environment is still required. Production ownership must reconcile the unexplained migration application, review legacy membership policies, and explicitly decide whether and when to execute the guarded manual unique-index step.

## Validation Results

- `supabase projects list --output-format json`: confirmed the linked production identity.
- `supabase migration list --linked`: confirmed complete version alignment.
- Repository migration enumeration: confirmed 23 local migration files matching 23 production versions.
- Read-only `supabase db query --linked` migration metadata queries: confirmed version, name, statement count, and expected policy statements.
- Read-only `pg_class` query: confirmed RLS enabled on all five audited tables.
- Read-only `pg_policies` queries: confirmed effective policies, role scopes, and zero known self-comparisons.
- Read-only `pg_indexes` query: confirmed the partial unique index is absent and the existing Sales-order index is non-unique.
- `npm run typecheck`: passed.
- `npm run test`: passed, 5 files and 134 tests.
- `npm run build`: passed with existing bundle-size, dependency-data, and third-party `eval` warnings.
- `node scripts/verify-production-prereq-sql.mjs`: passed.
- `node scripts/verify-production-rpc-sql.mjs`: passed.
- `npm run lint`: failed on the known repository backlog with 32 errors and 40 warnings.
- No write SQL, migration command, reset, repair, push, index creation, or policy change was executed.

## Remaining Risks

- The migration actor and execution channel remain unknown.
- Production lacks the partial unique index.
- Legacy public-role membership policies remain.
- Null-company compatibility and audit UPDATE access remain.
- No approved staging project exists.
- Read-only catalog evidence cannot prove application-level behavior or concurrency safety in production.

## Next Recommended Phase

Reconcile deployment ownership and logs for migration `20260613052204`, provision dedicated staging, and prepare a separately approved governance change for legacy membership policies. Validate the manual unique index on staging before considering a supervised production index step.
