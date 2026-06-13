# Staging Command Runbook

This runbook applies only to the approved `dayandisli.com-staging` Supabase project. Production ref `meauutjsnnggzcigyvfp` and production name `dayandisli.com` are forbidden unless the owner separately approves a production procedure.

## Before Linking

Confirm the approved staging project exists, its ref is recorded in the secret manager, the operator is authenticated to the correct Supabase organization, and the repository is on the reviewed commit. The manual-index operator environment must also provide a PostgreSQL `psql` client.

PowerShell:

```powershell
supabase projects list
git status --short
psql --version
```

Bash:

```bash
supabase projects list
git status --short
psql --version
```

Do not continue if the staging project name is not exactly `dayandisli.com-staging`.

## Link to Staging

PowerShell:

```powershell
supabase link --project-ref "<staging-ref>"
```

Bash:

```bash
supabase link --project-ref "<staging-ref>"
```

Never substitute the production ref.

## Safety Variables

PowerShell:

```powershell
$env:SUPABASE_TARGET="staging"
$env:ALLOW_STAGING_DB_PUSH="1"
$env:SUPABASE_TARGET_PROJECT_REF="<staging-ref>"
$env:SUPABASE_TARGET_PROJECT_NAME="dayandisli.com-staging"
```

Bash:

```bash
export SUPABASE_TARGET=staging
export ALLOW_STAGING_DB_PUSH=1
export SUPABASE_TARGET_PROJECT_REF="<staging-ref>"
export SUPABASE_TARGET_PROJECT_NAME="dayandisli.com-staging"
```

Keep database passwords and service-role keys in the approved secret manager. Never echo them.

## Preflight

PowerShell and Bash:

```bash
npm run staging:preflight
```

The command must report a verified staging target. A failure authorizes no follow-on operation.

## Migration Push

Run only after preflight succeeds and the migration plan is approved.

PowerShell and Bash:

```bash
supabase migration list --linked
supabase db push
supabase migration list --linked
```

Production execution is forbidden without separate owner approval.

## Manual Unique Index

Run only after preflight succeeds and the duplicate query returns no rows. The file must execute outside a transaction wrapper with stop-on-error behavior.

PowerShell:

```powershell
$env:STAGING_DATABASE_URL="<secret-staging-direct-database-url>"
psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f "supabase/manual/work_orders_sales_order_unique_concurrent_index.sql"
Remove-Item Env:STAGING_DATABASE_URL
```

Bash:

```bash
export STAGING_DATABASE_URL="<secret-staging-direct-database-url>"
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/manual/work_orders_sales_order_unique_concurrent_index.sql
unset STAGING_DATABASE_URL
```

Stop if duplicate rows are returned. Record the exact index name: `uq_work_orders_sales_order_id_not_null`.

## Type Generation

PowerShell:

```powershell
supabase gen types typescript --linked | Set-Content -Encoding utf8 "src/integrations/supabase/types.ts"
git diff -- src/integrations/supabase/types.ts
npm run typecheck
```

Bash:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
git diff -- src/integrations/supabase/types.ts
npm run typecheck
```

Review the generated diff before committing it.

## Integration Tests

The current Production prerequisite and Production RPC harnesses are local-only because they install temporary SQL through Docker. The Inventory harness also contains a local-only rollback trigger case. Do not run these scripts against staging until remote-safe variants are implemented and reviewed.

Local regression commands remain:

PowerShell:

```powershell
$env:RUN_PRODUCTION_PREREQ_INTEGRATION="1"
node scripts/test-production-prereq-integration.mjs
$env:RUN_PRODUCTION_RPC_INTEGRATION="1"
node scripts/test-production-rpc-integration.mjs
```

Bash:

```bash
RUN_PRODUCTION_PREREQ_INTEGRATION=1 node scripts/test-production-prereq-integration.mjs
RUN_PRODUCTION_RPC_INTEGRATION=1 node scripts/test-production-rpc-integration.mjs
```

## UI Smoke Tests

- [ ] Log in with a staging-only account.
- [ ] Verify CRM lists and permission boundaries.
- [ ] Verify Sales quotations and orders.
- [ ] Verify Inventory without enabling RPC feature flags.
- [ ] Verify Production routes, machines, operations, and work orders.
- [ ] Verify notifications use staging channels.
- [ ] Verify branch-scoped and company-wide access.
- [ ] Confirm production audit logs receive no staging activity.

## Cleanup

Confirm disposable integration data is removed, temporary users are deleted, staging-only environment variables are cleared, and no feature flag was enabled.

PowerShell:

```powershell
Remove-Item Env:SUPABASE_TARGET -ErrorAction SilentlyContinue
Remove-Item Env:ALLOW_STAGING_DB_PUSH -ErrorAction SilentlyContinue
Remove-Item Env:SUPABASE_TARGET_PROJECT_REF -ErrorAction SilentlyContinue
Remove-Item Env:SUPABASE_TARGET_PROJECT_NAME -ErrorAction SilentlyContinue
```

Bash:

```bash
unset SUPABASE_TARGET
unset ALLOW_STAGING_DB_PUSH
unset SUPABASE_TARGET_PROJECT_REF
unset SUPABASE_TARGET_PROJECT_NAME
```

## Relink Back to Production or Unlink

Relinking to production is forbidden without separate owner approval. Prefer unlinking after the staging session:

PowerShell and Bash:

```bash
supabase unlink
```

If an owner separately approves relinking, independently verify the intended target and record the operator, approval, commit, and time.
