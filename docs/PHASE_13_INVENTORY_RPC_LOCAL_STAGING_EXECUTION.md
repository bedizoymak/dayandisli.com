# Phase 13 — Inventory RPC Local/Staging Execution

## Objective

Collect safe execution evidence for the inventory movement RPC without applying it to production or changing the production client workflow.

## Starting Findings

- The RPC remains a reviewed draft under `supabase/manual/`.
- Static safety verification passes.
- No active RPC migration exists in the repository.
- A local Supabase stack became available on loopback after the first Phase 13 run.
- The repository began clean and synchronized with `origin/main`.

## Environment Target

The execution target was the local Supabase stack only:

```text
API: http://127.0.0.1:54321
Database: postgresql://postgres:***@127.0.0.1:54322/postgres
Studio: http://127.0.0.1:54323
```

The CLI still identified the linked remote project as production `dayandisli.com`. No command in this rerun used `--linked`, `db push`, or the remote database URL.

## Safety Gate

- `supabase status -o json` confirmed local API and database URLs on `127.0.0.1`.
- `supabase projects list --output json` continued to identify the linked remote as production `dayandisli.com`.
- `supabase migration list --local` connected to the local database and showed migrations through `20260603150000`.
- The SQL was sent only to the named local Postgres Docker container.
- Local credentials were read from `supabase status` into process environment variables and were not written to files or printed by the integration script.

## Files Inspected

- `supabase/manual/inventory_movement_rpc_draft.sql`
- `scripts/verify-inventory-rpc-sql.mjs`
- `docs/PHASE_11_INVENTORY_RPC_DESIGN.md`
- `docs/PHASE_12_INVENTORY_RPC_SAFE_VERIFICATION.md`
- `supabase/config.toml`
- Inventory, warehouse, company, branch, membership, audit, and RLS migrations
- Existing Supabase health-check script and package configuration

## SQL Applied Where

The reviewed draft was applied as temporary SQL to the local Postgres container:

```powershell
Get-Content -Raw supabase/manual/inventory_movement_rpc_draft.sql |
  docker exec -i supabase_db_avspgczfqsazarwzhpau `
    psql -v ON_ERROR_STOP=1 -U postgres -d postgres
```

No migration file or migration-history entry was created. The production project was not modified.

Local catalog verification reported:

```text
prosecdef: false
execute: postgres, authenticated, service_role
anon/PUBLIC execute: absent
```

## Test Data Created

The harness created uniquely named local-only fixtures:

- Two companies
- One branch
- Two warehouses in different companies
- One authenticated test user and tenant membership
- One inventory item starting with stock `10`

Cleanup ran in `finally`. Direct database checks found zero leftover Phase 13 movements, inventory items, or companies.

## RPC Execution Results

- Incoming quantity `5` increased stock from `10` to `15`.
- Outgoing quantity `3` decreased stock from `15` to `12`.
- Excessive outgoing quantity failed with `Stok eksiye düşemez.`.
- Reservation quantity `2` left stock at `12`.
- Invalid movement type failed with `Geçersiz stok hareketi türü.`.
- A warehouse from another company was rejected.

All prepared RPC behavior cases passed.

## RLS Results

- The tenant member could execute the RPC for the scoped item and warehouse.
- The cross-company warehouse call failed.
- The anonymous client could not execute the RPC.
- Catalog inspection confirmed `SECURITY INVOKER` and no `anon` or `PUBLIC` execute grant.

## Rollback Results

- Failed excessive-outgoing and invalid-type calls did not change the observed stock balance.
- Cleanup found no persisted test movement rows after the suite.
- A forced audit-insert failure was not executed, so that rollback path remains unverified.

## Concurrency Results

Not executed. A future local test must run two authenticated outgoing calls against the same item and verify row-lock serialization, no lost update, and no negative stock.

## Type Generation Notes

Types were not regenerated because the function was installed as temporary local SQL and the runtime client is not changing in this phase. Type generation should follow a reviewed migration, with the generated diff inspected before integration.

## Production Readiness Decision

Not ready for production integration. Local PostgreSQL syntax, primary behavior, tenant execution, anonymous denial, warehouse isolation, and basic failure atomicity now have evidence. Concurrency and forced audit-failure rollback remain required before production migration review.

## Changes Made

- Applied the reviewed draft only to the local database as temporary SQL.
- Executed the existing explicit-opt-in integration harness against loopback.
- Updated this document with local execution evidence.
- Did not create an active migration, touch production, regenerate types, or change `createInventoryMovement`.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed with 122 tests across 4 files.
- `npm run build`: passed with existing Browserslist, PDF.js eval, and large-chunk warnings.
- `node scripts/verify-inventory-rpc-sql.mjs`: passed all 8 static checks.
- Local integration harness: passed all 7 prepared cases.
- Local fixture cleanup verification: passed with zero remaining test rows.
- Focused ESLint for both inventory RPC scripts: passed.
- `npm run lint`: failed with the known backlog of 72 findings (32 errors and 40 warnings).
- `git diff --check`: passed.

## Remaining Risks

- Concurrent calls have not been tested.
- Forced audit-insert failure rollback has not been tested.
- The function has not been packaged as a reviewed migration.
- Local evidence does not replace staging verification against production-equivalent RLS and data shape.
- Service-role credentials remain backend test-fixture credentials only and must never enter frontend configuration or logs.

## Next Recommended Phase

Add local concurrency and forced audit-failure rollback tests. If they pass, create a reviewed migration with `supabase migration new`, apply it to dedicated staging, regenerate types from that safe target, and review production deployment separately.
