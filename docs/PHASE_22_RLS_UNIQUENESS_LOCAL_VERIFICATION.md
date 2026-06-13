# Phase 22 — RLS and Uniqueness Local Verification

## Objective

Verify the Phase 21 RLS, tenant predicate, and work-order uniqueness prerequisite drafts against local Supabase only. This phase must not create a production migration or modify any remote database.

## Starting Findings

- `work_order_operations` has no durable tenant-aware policy in the effective schema.
- Generated tenant policies can collapse ambiguous membership comparisons into self-comparisons.
- `work_orders.sales_order_id` has no durable partial uniqueness guarantee.
- Phase 21 produced review-only drafts and a static verifier.

## Environment Target

The integration harness accepts only a Supabase API host of `127.0.0.1` or `localhost` and a local database host. Remote overrides and known production identifiers are rejected.

## Safety Gate

Execution requires:

```text
RUN_PRODUCTION_PREREQ_INTEGRATION=1
```

The harness also rejects:

- production project reference `meauutjsnnggzcigyvfp`;
- production project name `dayandisli.com`;
- non-local API or database targets;
- environment variables that attempt to override discovered local credentials.

No `supabase db push` command is used.

## Files Inspected

- `supabase/manual/work_order_operations_rls_prereq_draft.sql`
- `supabase/manual/tenant_policy_predicate_corrections_draft.sql`
- `supabase/manual/work_orders_sales_order_unique_draft.sql`
- `scripts/verify-production-prereq-sql.mjs`
- `scripts/test-production-rpc-integration.mjs`
- `docs/PHASE_21_RLS_AND_PRODUCTION_RPC_PREREQUISITES.md`
- relevant ERP schema and tenant-governance migrations

## SQL Applied Where

The three review drafts were applied directly to the local PostgreSQL container discovered through `supabase status`. The confirmed targets were:

- API: `http://127.0.0.1:54321`
- Database host: `127.0.0.1`

No migration history entry was created, no remote command was run, and production was not contacted. The corrected policies and partial unique index remain in the local database for inspection.

## Test Data Created

The planned isolated fixture contains:

- two companies;
- two branches in the primary company;
- a branch-scoped member;
- a company-wide member;
- a member from the other company;
- authenticated sessions for each member;
- parent work orders and work-order operations;
- sales orders used only for uniqueness verification.

Every fixture uses randomized identifiers and is removed in a `finally` cleanup path.

## RLS Results

- A matching branch member selected, inserted, and updated an operation.
- A branch-scoped member could not read an operation from another branch.
- A company-wide member read operations from both company branches.
- A member of another company could not read the primary company's operation.
- Anonymous access returned no protected operation.
- Operation access resolved through the parent `work_orders` row.

## Predicate Correction Results

Before correction, Phase 21 catalog inspection found generated expressions collapsing into company and branch self-comparisons. After applying the draft locally, catalog inspection for `sales_orders`, `work_orders`, and `work_order_operations` found no known company self-comparison.

The effective operation policy retained `parent_work_order.company_id`, confirming that PostgreSQL preserved the explicit parent qualification.

## Uniqueness Results

- The duplicate-group query detected the isolated duplicate fixture.
- The draft raised its deterministic prerequisite error and stopped before index creation while duplicates existed.
- After removing the second fixture row, the partial unique index was created.
- PostgreSQL rejected a second non-null work order for the same sales order with error code `23505`.
- Two work orders with null `sales_order_id` were accepted.

`CREATE UNIQUE INDEX CONCURRENTLY` cannot run inside a transaction block. The local harness executes it as a standalone statement with stop-on-error behavior.

## Cleanup Results

All randomized operations, work orders, sales orders, memberships, branches, companies, and Auth users were removed. Post-cleanup count checks found zero remaining test business rows.

The locally applied policies and index were intentionally retained for schema inspection. They are not represented in migration history.

## Production Readiness Decision

The reviewed RLS and uniqueness behavior is locally verified, but production packaging is not yet approved.

Before a production migration is created:

- review overlapping effective policies and grants;
- complete the `erp_audit_logs` predicate and write-model decision;
- decide how the deployment path will execute concurrent index creation outside a transaction;
- repeat these checks in an approved staging environment.

## Changes Made

- Added this verification record.
- Added the guarded local integration harness at `scripts/test-production-prereq-integration.mjs`.
- No application runtime behavior or Turkish user-facing text is changed.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed, 5 files and 134 tests.
- `npm run build`: passed with existing bundle-size, dependency-data, and third-party `eval` warnings.
- `node scripts/verify-production-prereq-sql.mjs`: passed.
- `npx eslint scripts/test-production-prereq-integration.mjs scripts/verify-production-prereq-sql.mjs`: passed.
- `$env:RUN_PRODUCTION_PREREQ_INTEGRATION="1"; node scripts/test-production-prereq-integration.mjs`: passed all RLS, predicate, uniqueness, and cleanup checks.
- `npm run lint`: failed on the known repository backlog with 32 errors and 40 warnings. Neither Phase 22 script produced a focused lint finding.

## Remaining Risks

- Existing overlapping policies and grants require a separate migration review.
- Null-company compatibility remains in the draft predicates.
- The tenant correction draft covers only production-RPC prerequisite tables.
- Local verification does not replace staging review.
- Concurrent index creation needs deployment tooling that does not wrap it in a transaction.

## Next Recommended Phase

Package narrowly scoped prerequisite migrations only after local evidence is complete, then repeat catalog, RLS, and uniqueness tests in an approved staging environment.
