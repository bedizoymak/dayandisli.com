# Phase 13 — Inventory RPC Local/Staging Execution

## Objective

Collect safe execution evidence for the inventory movement RPC without applying it to production or changing the production client workflow.

## Starting Findings

- The RPC remains a reviewed draft under `supabase/manual/`.
- Static safety verification passes.
- No active RPC migration exists.
- The repository began clean and synchronized with `origin/main`.

## Environment Target

No safe execution target was available. Supabase CLI identified the linked remote project as:

```text
Reference: meauutjsnnggzcigyvfp
Name: dayandisli.com
Status: ACTIVE_HEALTHY
```

This is treated as production. The other visible project is unrelated and was not treated as staging.

## Safety Gate

- `supabase status` reported that the local database container does not exist.
- `supabase projects list` identified the linked remote as `dayandisli.com`.
- `supabase migration list` connected to that remote and showed local and remote migrations aligned through `20260603150000`.
- Because local Supabase was unavailable and the linked project is production, no reset, push, SQL execution, or test-data write was attempted.

## Files Inspected

- `supabase/manual/inventory_movement_rpc_draft.sql`
- `scripts/verify-inventory-rpc-sql.mjs`
- `docs/PHASE_11_INVENTORY_RPC_DESIGN.md`
- `docs/PHASE_12_INVENTORY_RPC_SAFE_VERIFICATION.md`
- `supabase/config.toml`
- Inventory, warehouse, company, branch, membership, audit, and RLS migrations
- Existing Supabase health-check script and package configuration

## SQL Applied Where

Nowhere. No active migration was created because there was no confirmed local or staging target.

## Test Data Created

None. The production safety gate stopped execution before any database client or write was created.

## RPC Execution Results

Not executed. PostgreSQL syntax and behavioral evidence remain pending a disposable local or dedicated staging environment.

## RLS Results

Not executed. The integration harness added in this phase includes authenticated and anonymous execution checks, but they require the RPC to be installed on a safe target.

## Rollback Results

Not executed. Excessive outgoing stock and invalid movement cases are prepared as failure assertions. Full rollback inspection remains required in the safe environment.

## Concurrency Results

Not executed and not automated in this phase. A future test must run two authenticated outgoing calls against the same item and verify serialized balances and no negative stock.

## Type Generation Notes

Types were not regenerated because the RPC was not installed. After safe migration execution, generate types from the local or staging target and review the diff before replacing repository types.

## Production Readiness Decision

Not ready. Static checks pass, but there is still no database-engine, RLS, rollback, or concurrency evidence.

## Changes Made

- Added this environment and safety-gate record.
- Added an explicit-opt-in integration script that rejects known production identifiers, creates isolated fixtures, exercises RPC behavior, and attempts cleanup.
- Did not create an active migration, apply SQL, regenerate types, or change `createInventoryMovement`.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed with 122 tests across 4 files.
- `npm run build`: passed with existing Browserslist, PDF.js eval, and large-chunk warnings.
- `node scripts/verify-inventory-rpc-sql.mjs`: passed all 8 static checks.
- Integration script refusal path: passed; it exited non-zero without explicit opt-in.
- Focused ESLint for both inventory RPC scripts: passed.
- `npm run lint`: failed with the known backlog of 72 findings (32 errors and 40 warnings).
- `git diff --check`: passed.

## Remaining Risks

- The draft has not been parsed or executed by PostgreSQL.
- RLS behavior for tenant members and audit insertion is unproven.
- Rollback and row-lock behavior are unproven.
- The integration harness itself requires its first successful run against a disposable target.
- Service-role credentials are required only for backend fixture setup and must never enter frontend configuration or logs.

## Next Recommended Phase

Provision a disposable local Supabase stack or a dedicated staging project, relink explicitly, rerun the safety gate, create the migration with `supabase migration new`, apply it only there, execute the integration harness, and record database evidence before production review.
