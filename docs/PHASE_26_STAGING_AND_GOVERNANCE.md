# Phase 26 — Staging Provisioning and Governance

## Objective

Prepare repository governance, environment conventions, and approval controls for a future staging environment and controlled production rollout. This phase performs no database operation.

## Starting Findings

- Production migration history matches the repository.
- Production RLS prerequisites are active.
- The manual partial unique index is absent from production.
- The actor and execution channel for the latest production migration are unknown.
- No approved `dayandisli.com` staging project exists.
- Production rollout remains blocked pending governance and staging evidence.

## Current Environment Inventory

| Environment | Project Ref | Project Name | Status |
| --- | --- | --- | --- |
| Production | `meauutjsnnggzcigyvfp` | `dayandisli.com` | Active; protected |
| Local | Local Docker project | Local Supabase | Available for destructive testing |
| Future Staging | Not provisioned | Recommended: `dayandisli.com-staging` | Required before rollout |

No credentials or secret values are recorded in this inventory.

## Environment Classification

Production contains live business data and requires explicit owner approval for every schema, index, RPC, RLS, or feature-flag change.

Staging must be a dedicated non-production Supabase project with a distinct project ref and name. It must never reuse another site's project or production credentials.

Local is the developer-owned Docker environment at `127.0.0.1` or `localhost`. Destructive verification is permitted only when the target safety check confirms local identity.

## Production Safety Rules

- Never infer authorization from a successful local test.
- Never use a production-linked CLI for an unreviewed push.
- Require a named owner, operator, reviewer, approved change window, backup, and rollback plan.
- Run `npm run supabase:target-check` before any deployment command.
- Reconfirm the linked project immediately before a database action.
- Keep manual concurrent index execution separate from transactional migrations.
- Record migration commit, operator, reviewer, timestamps, and results.
- Never commit secrets, access tokens, database passwords, or service-role keys.

## Staging Provisioning Checklist

- [ ] Create a dedicated Supabase project owned by the correct organization.
- [ ] Use a clearly non-production name such as `dayandisli.com-staging`.
- [ ] Record the staging project ref in the approved secret manager.
- [ ] Configure separate staging Auth, database, Storage, and application credentials.
- [ ] Set production data-copy and masking rules before importing any fixture data.
- [ ] Configure staging-only deployment secrets in GitHub.
- [ ] Link the CLI to staging and independently verify the project ref and name.
- [ ] Set `SUPABASE_TARGET=staging`.
- [ ] Keep `ALLOW_STAGING_DB_PUSH=0` by default.
- [ ] Set `ALLOW_STAGING_DB_PUSH=1` only for the approved deployment session.
- [ ] Run `npm run supabase:target-check`.
- [ ] Compare local and staging migration histories.
- [ ] Apply migrations and manual index steps under review.
- [ ] Regenerate and review Supabase types.
- [ ] Run integration and UI smoke tests.
- [ ] Disable temporary opt-in variables after the session.

## Environment Variable Matrix

| Variable | Local | Staging | Production |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Local API URL | Staging secret | Production secret |
| `VITE_SUPABASE_ANON_KEY` | Local anon key | Staging secret | Production secret |
| `VITE_ENABLE_INVENTORY_RPC` | Test as needed | `false`, then approved testing | `false` until separate approval |
| `SUPABASE_TARGET` | `local` or omitted | `staging` | Production mode is rejected |
| `ALLOW_STAGING_DB_PUSH` | Not required | `0` normally; `1` during approval window | Never used |
| `SUPABASE_TARGET_PROJECT_REF` | Optional local validation | Approved staging ref | Never used to bypass production rejection |
| `SUPABASE_TARGET_PROJECT_NAME` | Optional local validation | Approved staging name | Never used to bypass production rejection |

`.env.staging.example` contains placeholders only. Real values belong in protected environment configuration.

## Deployment Approval Workflow

1. Author prepares migration, manual steps, test evidence, and rollback plan.
2. Reviewer verifies SQL, RLS scope, target identity rules, and data safety.
3. Owner approves the environment, execution window, and named operator.
4. Operator captures pre-deployment migration, policy, and index state.
5. Operator runs `npm run supabase:target-check`.
6. Reviewer confirms the exact target and commit before execution.
7. Operator performs only the approved commands.
8. Operator and reviewer record results and complete smoke tests.
9. Owner decides whether feature flags may change.

Production approval cannot be implied by staging approval.

## Migration Ownership Policy

- Every migration must have an identifiable author and reviewer.
- Every deployment must have an identifiable operator and owner approval.
- Migration files are immutable after application.
- Corrections require a new migration.
- Manual SQL must have a repository artifact, prerequisite query, explicit target, and execution record.
- Migration history repair requires separate owner approval and written evidence.
- Out-of-band dashboard SQL is prohibited except for an approved incident response.
- Deployment records must include the Git commit and migration versions.

## Incident Response Procedure

1. Stop further deployment activity and feature-flag changes.
2. Preserve logs, migration history, policy definitions, index definitions, and application version.
3. Disable affected feature flags when that reduces risk.
4. Notify the owner and assign an incident lead.
5. Determine whether data integrity, tenant isolation, or authorization is affected.
6. Use read-only inspection first.
7. Prepare and review a corrective migration or application rollback.
8. Reconcile affected records before resuming normal operation.
9. Document timeline, root cause, impact, and preventive controls.

## Rollback Procedure

- Prefer application and feature-flag rollback when the database change is additive.
- Never edit or delete an applied migration.
- Use a reviewed forward corrective migration for policy or schema correction.
- Drop a manual index only through an approved, separately reviewed statement.
- Do not disable RLS as a rollback shortcut.
- Verify migration history, policies, indexes, audit logs, and application behavior after rollback.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed with 5 test files and 134 tests.
- `npm run build`: passed. Existing Browserslist, PDF.js `eval`, and large-chunk warnings remain.
- `npm run lint`: failed on the known repository backlog with 32 errors and 40 warnings.
- `.env.staging.example` contains placeholders only and is tracked by Git.
- No database command, migration execution, environment provisioning, or production modification was performed.

## Remaining Risks

- Staging is not yet provisioned.
- The actor behind the latest production migration remains unknown.
- Production still lacks the partial unique Sales-order work-order index.
- Legacy public-role membership policies remain.
- Human process controls require consistent enforcement outside the repository.

## Next Recommended Phase

Provision the dedicated staging project, configure protected staging secrets, verify the target safety gate, and execute the prerequisite rollout and integration plan under the documented approval workflow.
