# Phase 24 — Staging Rollout Readiness

## Objective

Determine whether an approved, clearly non-production Supabase staging target is available for the production RPC prerequisite rollout. Prepare the rollout evidence without modifying production.

## Starting Findings

- Phase 23 packaged the transactional RLS prerequisite migration.
- The partial unique index is isolated as a manual non-transactional step.
- Local RLS, predicate, uniqueness, and cleanup checks passed.
- Production database pushes require separate owner approval.
- A linked project must never be treated as staging based only on local Supabase availability.

## Environment Discovery

Safe CLI discovery found:

- Linked project ref: `meauutjsnnggzcigyvfp`
- Linked project name: `dayandisli.com`
- Linked project classification: production
- Linked project status: active and healthy
- Other accessible project: `eclipsemuhendislik.com`
- Local API, database, and Studio hosts: `127.0.0.1`
- Installed Supabase CLI: `2.101.0`

The other accessible project belongs to a different site and is not an approved `dayandisli.com` staging target.

The linked production migration history already contains `20260613052204_production_rpc_rls_prerequisites.sql`. Phase 24 did not apply it. This conflicts with the starting assumption that production remained untouched and requires an ownership/deployment-history review.

No secret values were recorded.

## Safety Gate

`scripts/check-supabase-target-safety.mjs` rejects:

- project ref `meauutjsnnggzcigyvfp`;
- project name `dayandisli.com`;
- any explicit production target;
- staging without both `SUPABASE_TARGET=staging` and `ALLOW_STAGING_DB_PUSH=1`;
- an unverified or mismatched staging identity.

Passing the local target check does not authorize a linked database push.

## Staging Availability

No approved staging target available.

No migration or manual index SQL was applied by Phase 24. Production remains untouched by Phase 24.

## Migration Readiness

The transaction-safe migration is:

```text
supabase/migrations/20260613052204_production_rpc_rls_prerequisites.sql
```

It contains scoped tenant-aware policies and no concurrent index operation.

Local migration history does not contain `20260613052204`, while the linked production history does. A staging rollout cannot proceed until a dedicated staging project is provisioned and the production application event is reconciled.

## Manual Index Step Readiness

The separately executed file is:

```text
supabase/manual/work_orders_sales_order_unique_concurrent_index.sql
```

It includes a duplicate guard and partial concurrent unique index. It requires an approved non-transactional staging execution path with stop-on-error behavior.

The manual index was not executed. Its production state was not queried because no production SQL inspection or execution was authorized.

## Type Regeneration Readiness

Types may be regenerated only after the migration and manual index step are verified on an approved staging project:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

The generated diff must be reviewed for unrelated schema drift before commit.

No types were regenerated because no approved staging schema exists.

## Integration Test Readiness

The existing harnesses require explicit opt-in and currently enforce local targets. They are ready for local regression checks, but a future staging execution mode must retain equivalent production rejection and staging identity verification.

Required commands after an approved staging deployment:

```bash
RUN_PRODUCTION_PREREQ_INTEGRATION=1 node scripts/test-production-prereq-integration.mjs
RUN_PRODUCTION_RPC_INTEGRATION=1 node scripts/test-production-rpc-integration.mjs
```

Neither harness was run against a remote target. Their current guards are local-only, so staging execution requires an explicitly reviewed staging mode before use.

## UI Smoke Test Plan

- Sign in with a staging company-wide member and verify access across company branches.
- Sign in with a branch-scoped member and verify access only to the matching branch.
- Verify another-company work orders and operations are not visible.
- Create and update a work-order operation through the existing Turkish ERP UI.
- Convert a Sales order to a work order and verify duplicate conversion is rejected.
- Generate work-order operations from a production route.
- Confirm audit entries are tenant-scoped.
- Confirm anonymous access remains denied.
- Verify all Turkish labels and validation messages remain unchanged.

## Production Deployment Decision

Production deployment is not approved.

The production-linked history already records the prerequisite migration, but Phase 24 performed no write. Before further production work, identify when and by whom that migration was applied, verify its effective policies through an approved audit, and determine whether the separate manual index exists.

## Changes Made

- Added this staging readiness record.
- Confirmed that the existing target safety script enforces the required staging opt-in and rejects the production-linked project.
- No database, feature flag, generated type, or ERP behavior change was made.

## Validation Results

- `supabase projects list`: found production and one unrelated project; no approved staging project.
- `supabase status`: confirmed the running local target at `127.0.0.1` without recording credentials.
- `supabase migration list --linked`: read-only inspection showed migration `20260613052204` in production-linked history.
- `supabase migration list --local`: showed migration `20260613052204` is not in local migration history.
- `npm run supabase:target-check`: passed for local inspection and explicitly denied linked push authorization.
- Staging-mode target check with both opt-in variables: correctly failed because the linked project is production.
- `node scripts/verify-production-prereq-sql.mjs`: passed.
- `node scripts/verify-production-rpc-sql.mjs`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 5 files and 134 tests.
- `npm run build`: passed with existing bundle-size, dependency-data, and third-party `eval` warnings.
- `npm run lint`: failed on the known repository backlog with 32 errors and 40 warnings.
- No staging or production integration test was run.
- No migration, manual index, or type generation command was executed.

## Remaining Risks

- No approved staging project exists.
- Production history unexpectedly records the Phase 23 prerequisite migration as applied.
- The production state of the manual concurrent index is unknown.
- A local stack can coexist with a production-linked CLI.
- The manual concurrent index step cannot be executed through a transaction wrapper.
- Existing null-company compatibility and audit UPDATE access remain explicit follow-up risks.
- Staging data volume may not represent production contention.

## Next Recommended Phase

Provision and link a dedicated non-production `dayandisli.com` staging project. Separately reconcile the existing production migration-history entry and audit the effective production policy/index state under explicit owner approval before any additional deployment.
