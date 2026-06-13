# Phase 14 — Inventory RPC Concurrency and Rollback Evidence

## Objective

Verify local row-lock serialization and transaction rollback when inventory audit insertion fails, without applying SQL to production or changing the runtime client.

## Starting Findings

- Phase 13 proved seven local RPC behavior and RLS cases.
- The RPC draft remains temporary local SQL rather than an active migration.
- Concurrency and forced audit-failure rollback were the remaining database evidence gaps.

## Environment Target

Local Supabase only:

```text
API: http://127.0.0.1:54321
Database: 127.0.0.1:54322
```

## Safety Gate

- Explicit opt-in remains required through `RUN_INVENTORY_RPC_INTEGRATION=1`.
- Local mode accepts only `localhost` or `127.0.0.1`.
- The known production reference and `dayandisli.com` project name remain blocked.
- Local rollback testing additionally requires an explicit local Docker database container name.
- No linked-project, remote database, migration push, or production credential is used.

## Files Inspected

- `scripts/test-inventory-rpc-integration.mjs`
- `supabase/manual/inventory_movement_rpc_draft.sql`
- `docs/PHASE_13_INVENTORY_RPC_LOCAL_STAGING_EXECUTION.md`
- Inventory, audit, tenant RLS, and warehouse migrations

## Concurrency Test Design

Create a dedicated inventory item with stock `10`, then launch two outgoing RPC calls for quantity `6` with `Promise.all`.

Expected evidence:

- Exactly one call succeeds.
- Exactly one call fails with `Stok eksiye düşemez.`.
- Final stock is `4`.
- Exactly one movement row persists for the unique concurrency marker.

This distinguishes row-lock serialization from a lost update or negative balance.

## Rollback Test Design

For local mode only, install a temporary trigger on `erp_audit_logs`. The trigger raises `Phase 14 zorunlu denetim kaydı hatası.` only when audit metadata contains the test run's unique source marker.

Call the RPC against a separate item with stock `10` and an incoming quantity of `5`.

Expected evidence:

- The deterministic trigger error reaches the caller.
- Item stock remains `10`.
- No matching movement row persists.
- The trigger and helper function are removed in `finally`.

## Test Data Created

The existing isolated fixture set is extended with separate concurrency and rollback inventory items. All fixtures use unique run identifiers and are removed during cleanup.

## Execution Results

- The two concurrent outgoing quantity `6` calls produced exactly one success and one `Stok eksiye düşemez.` failure.
- Final concurrency item stock was `4`.
- Exactly one concurrency movement row persisted before cleanup.
- The forced audit failure surfaced as `Phase 14 zorunlu denetim kaydı hatası.`.
- Rollback item stock remained `10`.
- No rollback-test movement row persisted.
- Post-run database checks found zero temporary triggers, helper functions, test movements, or test items.

## Production Readiness Decision

The RPC has sufficient local evidence to proceed to a reviewed staging migration phase. It is not approved for production yet because no active migration, generated type update, or staging verification exists.

## Changes Made

- Extended the local integration harness with concurrency assertions.
- Added a local-only forced audit-failure trigger and rollback assertions.
- Added guaranteed trigger removal and multi-item cleanup.
- Did not change the RPC draft, production migrations, generated types, or `createInventoryMovement`.

## Validation Results

- Integration harness refusal without opt-in: passed.
- Focused ESLint for the integration harness: passed.
- Local integration harness: passed all 9 behavior, RLS, concurrency, and rollback cases.
- Temporary database object and fixture cleanup: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed with 122 tests across 4 files.
- `npm run build`: passed with existing Browserslist, PDF.js eval, and large-chunk warnings.
- `node scripts/verify-inventory-rpc-sql.mjs`: passed all 8 static checks.
- `npm run lint`: failed with the known backlog of 72 findings (32 errors and 40 warnings).
- `git diff --check`: passed.

## Remaining Risks

- Local evidence does not replace staging verification.
- The RPC is not yet an active reviewed migration.
- Production-equivalent load and lock-wait behavior remain unmeasured.
- The local audit-failure trigger is test infrastructure only and must never be included in a production migration.

## Next Recommended Phase

If all local evidence passes, create a reviewed migration with the Supabase CLI, apply it to dedicated staging, regenerate types there, and perform a separate production deployment review.
