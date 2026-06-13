# Phase 11 — Transaction-Safe Inventory Movement RPC Design

## Objective

Design a reviewed, non-executed Postgres RPC draft that makes inventory movement insertion, stock validation, balance update, and audit logging one transaction while preserving tenant RLS.

## Starting Findings

- The current client performs multiple Data API requests that cannot share a transaction.
- Concurrent requests can read the same `current_stock` value and overwrite each other's results.
- Inventory tables have company, branch, and warehouse ownership columns.
- Current production RLS grants tenant members scoped SELECT, INSERT, and UPDATE access and grants active admins broader access.
- No active inventory movement RPC currently exists.
- The working tree was clean and synchronized with `origin/main` before this phase.

## Files Inspected

- `src/features/erp/shared/api/inventoryApi.ts`
- `src/features/erp/shared/api/internal.ts`
- `src/features/erp/shared/types.ts`
- `docs/PHASE_10_INVENTORY_WORKFLOW_HARDENING.md`
- Inventory, enterprise ownership, workflow, and RLS migrations
- `src/integrations/supabase/types.ts`
- Existing files under `supabase/manual/`
- Supabase security guidance and Postgres locking best practices

## Current Client-Side Workflow

1. Select the inventory item.
2. Validate quantity and calculate the next balance in the browser.
3. Insert an inventory movement.
4. Update `inventory_items.current_stock` for non-reservation movements.
5. Write an audit log.

Two requests can complete step 1 with the same balance. Each then calculates independently, and the later update can overwrite the earlier movement's result. A failed update also leaves the inserted movement behind.

## Target Database Transaction Workflow

1. Validate the movement type and positive quantity.
2. Select the target inventory item with `FOR UPDATE`.
3. Let RLS reject inaccessible items before any write.
4. Derive company and branch ownership from the locked item.
5. Validate an optional warehouse against that ownership scope.
6. Calculate and validate the next stock balance.
7. Insert the movement with derived ownership fields.
8. Update `current_stock` unless the movement is a reservation.
9. Insert the audit record.
10. Return the inserted movement.

The function call is one PostgreSQL transaction. Any raised exception rolls back every write, and the row lock serializes movements for the same item.

## Required RPC Contract

Function:

```text
public.erp_create_inventory_movement
```

Parameters:

```text
p_item_id uuid
p_movement_type text
p_quantity numeric
p_source_type text default 'manual'
p_source_id uuid default null
p_notes text default null
p_warehouse_id uuid default null
```

The current schema has no movement `unit`, `reference_type`, or `description` columns, so those parameters are intentionally omitted. Company and branch IDs are derived from the item instead of accepted from the client.

Return type:

```text
public.inventory_movements
```

## RLS and Security Considerations

- The function should be `SECURITY INVOKER` so inventory item selection, movement insertion, stock update, warehouse lookup, and audit insertion remain subject to the caller's RLS policies.
- Do not use `SECURITY DEFINER` to solve permission failures. It would bypass tenant RLS unless the function duplicated all authorization checks correctly.
- Revoke default execution from `PUBLIC` and `anon`; grant execution only to `authenticated`.
- Derive `company_id` and `branch_id` from the locked inventory item.
- An optional warehouse must match the item's company when both are non-null and must not conflict with the item's branch.
- Keep the transaction short: one item lock, one optional warehouse lookup, two or three writes, and no external calls.
- Existing indexes on item ID, company ID, branch ID, and warehouse primary key support the access path.
- The production migration should verify that authenticated users have tenant-scoped INSERT permission on `erp_audit_logs`.

## SQL Draft

The reviewed draft is stored at:

```text
supabase/manual/inventory_movement_rpc_draft.sql
```

It is marked `DRAFT ONLY` and is not part of the active migration chain.

## TypeScript Integration Plan

After the RPC is reviewed, migrated, and generated into Supabase types:

1. Add the migration through the normal Supabase migration workflow.
2. Regenerate `src/integrations/supabase/types.ts`.
3. Replace the multi-step body of `createInventoryMovement` with:

```ts
const { data, error } = await supabase.rpc("erp_create_inventory_movement", {
  p_item_id: payload.inventory_item_id,
  p_movement_type: payload.movement_type,
  p_quantity: payload.quantity,
  p_source_type: payload.source_type ?? "manual",
  p_source_id: payload.source_id ?? null,
  p_notes: payload.notes ?? null,
  p_warehouse_id: payload.warehouse_id ?? null,
});
```

4. Map PostgreSQL validation messages through the existing API result helpers.
5. Remove the separate item select, movement insert, stock update, and client audit call only after RPC integration tests pass.
6. Preserve the `erpApi.ts` compatibility export.

The current TypeScript payload does not expose `warehouse_id`; Phase 12 should decide whether to add it as an optional field based on UI and workflow requirements.

## Test Strategy

- Mocked RPC success returns the inserted movement.
- Mocked RPC returns the Turkish insufficient-stock error.
- Mocked RPC returns an RLS denial without fallback data.
- Reservation movement integration test verifies unchanged `current_stock`.
- Concurrent outgoing movement integration test verifies row-lock serialization and no negative stock.
- Rollback test verifies an audit or stock update exception leaves neither movement nor balance change.
- Warehouse mismatch test verifies tenant and branch validation.
- Authenticated tenant member and active admin authorization tests.
- Anonymous execution denial test.

Live database and concurrency tests belong in Phase 12 against an isolated local or staging Supabase database, not the production project.

## Changes Made

- Added this design document.
- Added a non-executed SQL draft under `supabase/manual/`.
- No migration, client runtime, UI, RLS policy, or generated type was changed.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed with 122 tests across 4 test files.
- `npm run build`: passed. Existing Browserslist, PDF.js eval, and large chunk warnings remain.
- `npm run lint`: failed with the known repository backlog: 72 findings (32 errors and 40 warnings).
- The SQL draft was intentionally not executed against a database and was not added as an active migration.
- `git diff --check`: passed.

## Remaining Risks

- The SQL draft has not been executed against a local or staging database.
- Existing RLS policies and legacy null ownership rows require integration verification.
- The exact audit insertion policy must be validated for non-admin tenant members.
- Warehouse selection semantics are not yet exposed by the current client payload.

## Next Recommended Phase

Create and verify an active migration in an isolated Supabase environment, add concurrency and RLS integration tests, regenerate types, then switch `createInventoryMovement` to the RPC.
