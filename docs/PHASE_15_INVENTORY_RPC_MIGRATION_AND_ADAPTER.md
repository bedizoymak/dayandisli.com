# Phase 15 — Inventory RPC Migration and Feature-Flagged Adapter

## Objective

Package the locally verified inventory movement RPC as a reviewed migration and add an opt-in frontend adapter while preserving the legacy workflow as the production default.

## Starting Findings

- The RPC passed local behavior, RLS, concurrency, and rollback tests.
- Production has not received the RPC.
- `createInventoryMovement` still uses the multi-request legacy workflow.
- Generated Supabase types do not include the ERP tables or inventory RPC.
- `VITE_ENABLE_INVENTORY_RPC` did not previously exist.

## Files Inspected

- `supabase/manual/inventory_movement_rpc_draft.sql`
- `scripts/verify-inventory-rpc-sql.mjs`
- `scripts/test-inventory-rpc-integration.mjs`
- `src/features/erp/shared/api/inventoryApi.ts`
- `src/features/erp/shared/api/inventoryApi.test.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/types.ts`
- `src/integrations/supabase/types.ts`
- `src/vite-env.d.ts`

## Migration Created

The Supabase CLI created:

```text
supabase/migrations/20260613042605_inventory_movement_rpc.sql
```

It contains the reviewed RPC SQL without draft-only comments or local test infrastructure. It retains `SECURITY INVOKER`, row locking, Turkish messages, revocation from `PUBLIC` and `anon`, and execution for `authenticated`.

The migration was not pushed or applied to the linked production project.

## Feature Flag Design

The adapter uses:

```text
VITE_ENABLE_INVENTORY_RPC
```

Only the exact string `true` enables the RPC path. Missing, empty, malformed, and `false` values use the legacy workflow.

## Adapter Design

`createInventoryMovement` keeps its public signature and selects one internal implementation:

- Flag disabled: execute the existing client-side workflow unchanged.
- Flag enabled: call `erp_create_inventory_movement` with mapped nullable parameters and return the existing `ApiResult<InventoryMovement | null>` shape.

RPC errors use the existing `failure` helper, preserving Turkish PostgreSQL validation messages.

Because generated types do not yet know the RPC, the adapter uses the established narrow `as never` call pattern and casts only the RPC result. Production-derived types were not regenerated.

## Backward Compatibility

- Existing imports and exports remain unchanged.
- UI pages do not need import changes.
- The default path remains the legacy implementation.
- Reservation movements map directly to the RPC movement type without client-side stock handling.
- No automatic fallback occurs after an RPC error, preventing a failed RPC from being followed by duplicate legacy writes.

## Validation Results

- `supabase db reset --local --yes`: passed and applied the new migration after all existing migrations.
- Local inventory RPC integration harness: passed all 9 behavior, RLS, concurrency, and rollback cases against the migration-applied database.
- Focused inventory API tests: passed with 11 tests.
- Focused ESLint for touched TypeScript and JavaScript files: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed with 126 tests across 4 files.
- `npm run build`: passed with existing Browserslist, PDF.js eval, and large-chunk warnings.
- `node scripts/verify-inventory-rpc-sql.mjs`: passed all 8 migration safety checks.
- `npm run lint`: failed with the known backlog of 72 findings (32 errors and 40 warnings).
- `git diff --check`: passed.

## Production Deployment Checklist

1. Review the migration SQL and staging evidence.
2. Apply the migration only to a dedicated staging project.
3. Regenerate and review Supabase types from staging.
4. Run the full integration harness against staging.
5. Enable `VITE_ENABLE_INVENTORY_RPC=true` only in staging.
6. Verify inventory UI behavior and audit records.
7. Review rollback and observability procedures.
8. Schedule production migration separately.
9. Keep the production feature flag disabled until migration verification completes.

## Remaining Risks

- Staging deployment and generated type review remain outstanding.
- The legacy workflow remains non-atomic while the feature flag is disabled.
- Repository-wide lint debt remains outside this phase.

## Next Recommended Phase

Apply the reviewed migration to dedicated staging, regenerate types, run integration and UI smoke tests with the flag enabled, then make a separate production rollout decision.
