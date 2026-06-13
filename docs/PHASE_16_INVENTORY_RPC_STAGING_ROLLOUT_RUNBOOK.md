# Phase 16 — Inventory RPC Staging Rollout Runbook

## Objective

Prepare a controlled staging rollout and production deployment runbook for the
inventory movement RPC without applying the migration or enabling the feature in
production.

## Starting Findings

- The inventory RPC is packaged as a migration but has only been exercised
  locally.
- The local integration harness covers the expected movement, concurrency,
  rollback, authorization, and cleanup behavior.
- `createInventoryMovement` uses the RPC only when
  `VITE_ENABLE_INVENTORY_RPC=true`; the legacy workflow remains the default.
- The local Supabase stack can run while the CLI remains linked to a remote
  project. Local availability alone therefore does not authorize `db push`.
- The currently linked remote project is the known production project and must
  not be used for this rollout.

## Files Inspected

- `supabase/migrations/20260613042605_inventory_movement_rpc.sql`
- `src/features/erp/shared/api/inventoryApi.ts`
- `scripts/test-inventory-rpc-integration.mjs`
- `scripts/verify-inventory-rpc-sql.mjs`
- `src/vite-env.d.ts`
- `docs/PHASE_15_INVENTORY_RPC_MIGRATION_AND_ADAPTER.md`
- `package.json`

## Migration Status

`20260613042605_inventory_movement_rpc.sql` is committed and applies
successfully during a local reset. It has not been applied to production by
this phase. The migration retains `SECURITY INVOKER`, does not grant execution
to `anon`, and grants execution to `authenticated`.

Before staging, compare `supabase migration list` with the intended staging
project and confirm that this migration is pending there. Do not continue if
the linked project is production or its identity is uncertain.

## Feature Flag Status

`VITE_ENABLE_INVENTORY_RPC` is opt-in. Only the exact string `true` selects the
RPC adapter. An absent value, `false`, or any other value keeps the legacy
client-side workflow.

Keep the flag disabled for the first staging migration application. Enable it
only in staging after migration verification and generated-type review.
Production must remain disabled until the production checklist is approved.

## Staging Environment Requirements

- A dedicated Supabase staging project with a project reference and name that
  are not the production values.
- Supabase CLI authentication with access to staging.
- A verified CLI link to staging.
- `SUPABASE_TARGET=staging`.
- `ALLOW_STAGING_DB_PUSH=1` set only for the rollout session.
- Staging-only application credentials for integration and UI testing.
- A deployment window with an identified operator and reviewer.
- A database backup or restore point appropriate to the staging environment.

Known production identifiers rejected by the preflight:

- Project ref: `meauutjsnnggzcigyvfp`
- Project name: `dayandisli.com`

## Staging Rollout Steps

1. Link the Supabase CLI to the dedicated staging project using the staging
   project reference. Verify the terminal and repository before continuing.
2. Set the explicit staging safety variables.

   PowerShell:

   ```powershell
   $env:SUPABASE_TARGET="staging"
   $env:ALLOW_STAGING_DB_PUSH="1"
   ```

   Bash:

   ```bash
   export SUPABASE_TARGET=staging
   export ALLOW_STAGING_DB_PUSH=1
   ```

3. Run the staging-only flow:

   ```bash
   npm run supabase:target-check
   supabase migration list
   supabase db push
   supabase gen types typescript --linked > src/integrations/supabase/types.ts
   RUN_INVENTORY_RPC_INTEGRATION=1 node scripts/test-inventory-rpc-integration.mjs
   ```

   In PowerShell, set the integration opt-in before the final command:

   ```powershell
   $env:RUN_INVENTORY_RPC_INTEGRATION="1"
   node scripts/test-inventory-rpc-integration.mjs
   ```

4. Review the migration result and generated type diff. Do not commit generated
   types until the diff is confirmed to come from staging and contains no
   unrelated schema drift.
5. Deploy the application to staging with the feature flag still disabled and
   complete baseline UI smoke tests.
6. Enable `VITE_ENABLE_INVENTORY_RPC=true` in staging only, redeploy, and repeat
   the integration and UI smoke tests.
7. Record the staging project ref, migration list, test results, application
   version, operator, reviewer, and execution time without recording tokens or
   credentials.

The commands above are for staging only. Production migration and feature-flag
changes require a separate approval and execution event.

## Type Regeneration Plan

Generate types only after the staging migration succeeds and while the CLI is
verified as linked to staging:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

Review the output before committing it. Confirm the RPC signature is present,
run TypeScript and tests, and reject unrelated schema changes. Production types
must not be regenerated during this phase.

## Integration Test Plan

Run the harness against staging only after migration application and with
explicit integration opt-in. The harness must retain its target safety checks
and use disposable, isolated test data.

Required evidence:

- Incoming movement increases stock.
- Outgoing movement decreases stock.
- Reservation movement preserves `current_stock`.
- Excessive outgoing movement returns `Stok eksiye düşemez.`.
- Invalid movement validation remains deterministic.
- Cross-company warehouse access is denied.
- Anonymous execution is denied.
- Concurrent outgoing movements serialize without negative or lost stock.
- Forced audit failure rolls back movement and stock writes.
- Test records are removed after execution.

## UI Smoke Test Plan

Test with an authorized staging ERP account:

- Open an inventory item and confirm its current stock.
- Create an incoming movement and verify the new stock and movement history.
- Create a valid outgoing movement and verify the reduced stock.
- Attempt excessive outgoing stock and verify the Turkish validation message.
- Create a reservation and verify stock remains unchanged.
- Confirm warehouse and company restrictions are enforced.
- Refresh the application and confirm persisted values are consistent.
- Disable the flag, redeploy staging, and confirm the legacy path still works.

Do not translate or alter existing Turkish UI messages during testing.

## Production Deployment Checklist

- Separate production change approval is recorded.
- Staging migration, integration tests, concurrency test, rollback test, and UI
  smoke tests all passed.
- Generated type changes were reviewed and repository quality gates passed.
- The exact migration SQL and application commit are identified.
- Production backup and rollback ownership are confirmed.
- A maintenance window and monitoring owner are assigned.
- The CLI target is independently verified immediately before migration work.
- The production migration is applied as an explicit, supervised step; this
  runbook does not authorize an automatic `supabase db push`.
- Production health is checked while the feature flag remains disabled.
- The RPC flag is enabled in production only through a separately approved,
  reversible configuration change.
- Inventory errors, stock consistency, audit rows, and application telemetry
  are monitored after enablement.

## Rollback Plan

Application rollback is the first response:

1. Set `VITE_ENABLE_INVENTORY_RPC=false` or remove the variable.
2. Redeploy the last known-good application configuration.
3. Confirm new inventory movements use the legacy path.
4. Investigate and reconcile any affected inventory records before retrying.

Do not automatically reverse the migration. The RPC is additive, so leaving the
unused function installed is safer than performing an unreviewed destructive
rollback. If database removal is required, prepare and review a separate
migration after confirming no clients depend on the function.

## Validation Results

Validation for this phase covers repository quality gates, the SQL safety
verifier, and the new target preflight. No migration push, remote type
generation, or production feature-flag change is part of validation.

Results are recorded after implementation:

- TypeScript: passed.
- Tests: passed, 126 tests across 4 files.
- Build: passed with existing bundle-size, `eval`, and Browserslist warnings.
- SQL verifier: passed all migration safety checks.
- Local target check: passed for `127.0.0.1` and explicitly stated that
  linked `db push` was not authorized.
- Production target rejection: passed; staging mode rejected the currently
  linked production project.
- Focused lint: passed for `scripts/check-supabase-target-safety.mjs`.
- Repository lint: failed on the known backlog with 32 errors and 40 warnings;
  no Phase 16 file introduced a lint finding.

## Remaining Risks

- Staging infrastructure and credentials must be provisioned and independently
  verified before the rollout commands are used.
- A preflight script cannot bind a later CLI command to the same target; the
  operator must re-check target identity immediately before `db push`.
- Staging data volume and contention may not fully represent production.
- The legacy fallback remains non-transactional while the feature flag is off.
- Production rollback may require inventory reconciliation even when the
  application is switched back promptly.

## Next Recommended Phase

Execute the runbook against a dedicated staging project, capture migration,
integration, generated-type, and UI evidence, then prepare a separately
approved production change with explicit operators, monitoring, and rollback
ownership.
