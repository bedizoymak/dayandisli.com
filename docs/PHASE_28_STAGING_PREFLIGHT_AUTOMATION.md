# Phase 28 — Staging Preflight Automation

## Objective

Prepare read-only staging preflight automation and an operator runbook that can be used after a dedicated staging project is manually created. Production must remain untouched.

## Starting Findings

- Production is linked as `meauutjsnnggzcigyvfp` / `dayandisli.com`.
- `eclipsemuhendislik.com` is unrelated and must not be treated as staging.
- No approved `dayandisli.com-staging` project exists.
- Local Supabase is available at `127.0.0.1`.
- Existing integration harnesses protect local destructive tests.

## Safety Model

The preflight is read-only and fails closed. It validates environment intent, linked project identity, the existing target-safety script, and remote migration-list readability. It never links projects, pushes migrations, executes SQL, generates types, or prints credentials.

Production ref `meauutjsnnggzcigyvfp`, production name `dayandisli.com`, and unrelated project name `eclipsemuhendislik.com` are always rejected.

## Staging Identity Requirements

- `SUPABASE_TARGET=staging`
- `ALLOW_STAGING_DB_PUSH=1`
- `SUPABASE_TARGET_PROJECT_REF=<approved-staging-ref>`
- `SUPABASE_TARGET_PROJECT_NAME=dayandisli.com-staging`
- The linked project ref must match the declared staging ref.
- The linked project name must exactly match `dayandisli.com-staging`.

## Preflight Script

`scripts/staging-preflight.mjs` checks CLI availability, validates required environment declarations, discovers the linked project through machine-readable CLI output, invokes `scripts/check-supabase-target-safety.mjs`, and inspects the linked migration list.

When staging is absent or incorrectly linked, it exits non-zero with:

```text
No approved dayandisli.com staging target is linked. No database operation was performed.
```

## Integration Harness Readiness

- `test-production-prereq-integration.mjs` remains local-only. It applies draft SQL and performs index changes through a local Docker container.
- `test-production-rpc-integration.mjs` remains local-only. It installs temporary policies, functions, and triggers through local Docker.
- `test-inventory-rpc-integration.mjs` accepts staging identity inputs, but its forced rollback case requires local Docker SQL. It is not approved for full staging execution.

No harness safeguard was loosened. A future phase must separate remote-safe data/RLS cases from local-only schema mutation and rollback cases before staging execution.

## Manual Index Readiness

The reviewed file is `supabase/manual/work_orders_sales_order_unique_concurrent_index.sql`. It contains duplicate detection, refusal on duplicates, the partial predicate, and index name `uq_work_orders_sales_order_id_not_null`.

It must run only after staging preflight passes, outside a transaction wrapper, with stop-on-error behavior. Any duplicate row blocks execution.

## Type Generation Readiness

Types must not be generated until staging identity is verified. The runbook uses:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

The generated diff, TypeScript result, tests, and build must be reviewed before commit.

## Commands Added

```text
npm run staging:preflight
```

Detailed PowerShell and Bash workflows are in `docs/STAGING_COMMAND_RUNBOOK.md`.

## Validation Results

- `node --check scripts/staging-preflight.mjs`: passed.
- `npm run staging:preflight`: failed safely because no staging identity variables or approved linked staging project exist. The required no-operation message was emitted.
- A hostile declaration using production ref `meauutjsnnggzcigyvfp` was rejected before linked migration inspection.
- `npm run typecheck`: passed.
- `npm run test`: passed with 5 test files and 134 tests.
- `npm run build`: passed with existing Browserslist, PDF.js `eval`, and large-chunk warnings.
- `npm run lint`: failed on the known repository backlog with 32 errors and 40 warnings.
- `supabase unlink --help`: confirmed the documented unlink command is available in CLI `2.101.0`.
- `psql` is not installed on this workstation; the manual-index command was not executed.
- No database operation, project link, migration push, SQL execution, type generation, or feature-flag change occurred.

## Remaining Risks

- Dedicated staging does not exist.
- Remote-safe integration harnesses are not yet separated from local-only schema mutation.
- The staging operator environment must provide `psql` before the manual concurrent-index step.
- Staging Auth, Storage, secrets, migration state, RLS, and cleanup behavior remain unverified.
- Production remains linked until an approved staging operator deliberately relinks the CLI.

## Next Recommended Phase

Create `dayandisli.com-staging`, configure protected staging credentials, link it during an approved session, run the preflight, and then build dedicated remote-safe integration harness variants before any staging data tests.
