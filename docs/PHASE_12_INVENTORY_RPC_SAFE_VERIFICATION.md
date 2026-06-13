# Phase 12 — Inventory RPC Safe Verification

## Objective

Review the inventory movement RPC draft against the repository schema and add repeatable static safety checks without applying SQL or changing production behavior.

## Starting Findings

- Phase 11 created a review-only SQL file outside `supabase/migrations/`.
- The production client still uses the existing multi-request inventory workflow.
- The draft targets a single locked inventory item and keeps all database writes inside one function call.
- No isolated local or staging database was prepared for this phase.

## Files Inspected

- `supabase/manual/inventory_movement_rpc_draft.sql`
- `docs/PHASE_11_INVENTORY_RPC_DESIGN.md`
- Inventory and movement definitions in `supabase/migrations/20260517153000_erp_core_schema.sql`
- Audit definitions in `supabase/migrations/20260518093000_erp_phase5_audit_purchasing.sql`
- Warehouse and tenant columns in `supabase/migrations/20260603120000_phase24_multi_company_branch_enterprise_foundation.sql`
- Tenant RLS policies in the Phase 25 and Phase 26 migrations
- `package.json`
- Existing scripts under `scripts/`

## Local/Staging Verification Plan

Use a disposable local Supabase stack or a dedicated staging project. Never point these steps at production.

1. Confirm the target with `supabase status` and inspect the project link before any database command.
2. Start an isolated local stack with `supabase start`.
3. Reset only that disposable local database:

   ```bash
   supabase db reset
   ```

4. Copy the reviewed draft into a temporary local migration or execute it only against the disposable database.
5. Create isolated test users, memberships, companies, branches, warehouses, and inventory items.
6. Run the RPC cases below through authenticated sessions.
7. Discard the local stack and temporary migration after recording results.

For staging, first confirm the linked project is the dedicated staging project, then use:

```bash
supabase db push
```

Only a reviewed migration should be pushed. The manual draft must not be pushed directly.

## SQL Review Findings

- The PL/pgSQL structure, parameter defaults, composite return type, `FOR UPDATE`, and grant signatures are syntactically coherent.
- Referenced tables and columns exist in the migration history.
- `SECURITY INVOKER` preserves caller permissions and RLS.
- `SECURITY DEFINER` is absent.
- Default function execution is revoked from `PUBLIC` and `anon`; execution is granted only to `authenticated`.
- Warehouse lookup is subject to RLS and validates company and branch compatibility.
- Reservation movements insert a movement but skip the stock update.
- Movement type, quantity, missing item, missing warehouse, scope mismatch, and negative-stock messages remain Turkish.
- Audit insertion is part of the same transaction, so an audit failure rolls back the movement and balance update.

Static review cannot prove runtime SQL validity, RLS behavior, or concurrency correctness. Those require the isolated database plan.

## Required Schema Assumptions

- `inventory_items.current_stock` is non-null numeric and the item row is visible and updateable to the caller.
- `inventory_movements` accepts the derived company, branch, and optional warehouse values.
- The caller can read the selected warehouse under tenant RLS.
- The caller can insert `erp_audit_logs` for the derived company and branch.
- Phase 25 and Phase 26 tenant policies are applied in migration order.
- `auth.uid()` and the email claim are available for authenticated calls.
- Legacy rows with null company or branch values are intentionally supported by current policies.

## Test Data Plan

Create two companies, two branches, two users, and memberships that separate tenant scope. Add:

- One active warehouse per company.
- One company-wide warehouse with a null branch.
- One inventory item with positive stock.
- One low-stock item for insufficient-stock testing.
- One legacy null-scope item only if legacy behavior must remain supported.

Use unique codes and remove all records when the isolated test completes.

## RPC Test Cases

1. Incoming movement inserts a movement and increases stock.
2. Outgoing movement inserts a movement and decreases stock.
3. An excessive outgoing movement raises `Stok eksiye düşemez.` and writes nothing.
4. Reservation inserts a movement without changing `current_stock`.
5. Invalid movement type and non-positive quantity return the expected Turkish messages.
6. Missing or inaccessible items return the same non-disclosing Turkish message.
7. A warehouse from another company is rejected.
8. A conflicting branch warehouse is rejected.
9. A company-wide warehouse is accepted for a matching company.
10. An audit insert failure rolls back the movement and stock update.
11. Two concurrent outgoing calls serialize on the item row and cannot produce a lost update or negative stock.
12. `anon` cannot execute the function; an authorized tenant member and active admin can execute only within their RLS scope.

## Production Readiness Decision

Not ready for production integration. Static review passed, but the RPC has not been parsed or executed by PostgreSQL and has no isolated RLS, rollback, or concurrency test evidence.

## Changes Made

- Added `scripts/verify-inventory-rpc-sql.mjs`.
- Added this verification and test plan.
- Did not modify the SQL draft, active migrations, generated Supabase types, or inventory client behavior.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed with 122 tests across 4 test files.
- `npm run build`: passed with the existing Browserslist, PDF.js eval, and large-chunk warnings.
- `node scripts/verify-inventory-rpc-sql.mjs`: passed all 8 static safety checks.
- `npm run lint`: failed with the known repository backlog of 72 findings (32 errors and 40 warnings).
- The SQL draft was not executed, added to the migration chain, or applied to any database.

## Remaining Risks

- PostgreSQL syntax and runtime behavior remain unverified by a database engine.
- RLS policy composition may differ from static migration-history assumptions in the deployed environment.
- Audit insertion under `SECURITY INVOKER` must be verified for ordinary tenant members.
- Null tenant ownership and optional warehouse semantics need explicit product approval.
- Concurrency behavior needs two-session database testing.

## Next Recommended Phase

Create a reviewed migration in an isolated environment, execute the full RLS and concurrency test matrix, regenerate Supabase types, and only then plan the client integration.
