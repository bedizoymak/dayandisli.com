# Phase 27 — Staging Provisioning and Validation

## Objective

Discover whether an approved, dedicated Supabase staging project exists and, only if its identity is safely verified as distinct from production, prepare it for rollout validation. Production changes are forbidden.

## Starting Findings

- Production project ref: `meauutjsnnggzcigyvfp`.
- Production project name: `dayandisli.com`.
- No approved staging project was known at the end of Phase 26.
- Production migration history matches the repository.
- Production does not contain the manual partial unique Sales-order work-order index.
- RPC feature flags remain disabled.

## Environment Discovery

Safe CLI discovery on June 13, 2026 found:

| Project Ref | Project Name | Classification |
| --- | --- | --- |
| `meauutjsnnggzcigyvfp` | `dayandisli.com` | Production; currently linked; forbidden |
| `dynnniynthkwvkzdnkuh` | `eclipsemuhendislik.com` | Unrelated project; not staging |

Local Supabase is running at `127.0.0.1`. No dedicated `dayandisli.com` staging project exists.

## Safety Gate

- Production ref `meauutjsnnggzcigyvfp` and name `dayandisli.com` are denied.
- A staging deployment requires a distinct project ref and name.
- `SUPABASE_TARGET=staging` and `ALLOW_STAGING_DB_PUSH=1` are required for staging deployment authorization.
- The repository target checker must pass before any migration command.
- No secret values may be printed or committed.

## Staging Provisioning

No dedicated staging project exists. Recommended name: `dayandisli.com-staging`.

Required setup:

1. Create a dedicated Supabase project in the approved organization.
2. Record its project ref and ownership without adding credentials to Git.
3. Configure staging-specific Auth providers, redirect URLs, email templates, and test users.
4. Configure the database through the reviewed migration chain.
5. Configure staging-only Storage buckets, limits, and RLS policies.
6. Add protected GitHub environment secrets for the staging project.
7. Add staging application environment variables using `.env.staging.example` as the non-secret template.
8. Require environment approval before exposing `ALLOW_STAGING_DB_PUSH=1`.
9. Verify the new ref and name are distinct from all production and unrelated projects.

No Supabase project was created automatically in this phase.

## Supabase Linking

No linking action was performed. The repository remains linked to production, so no remote deployment command is permitted.

After staging is provisioned, an approved operator must link to its ref and run:

```powershell
$env:SUPABASE_TARGET = "staging"
$env:ALLOW_STAGING_DB_PUSH = "1"
$env:SUPABASE_TARGET_PROJECT_REF = "<staging-ref>"
$env:SUPABASE_TARGET_PROJECT_NAME = "dayandisli.com-staging"
npm run supabase:target-check
```

The check must report an explicit non-production staging target before any database operation.

## Migration State

No staging migration was applied. `supabase db push` was not run because no approved staging target exists.

## Type Regeneration

No staging types were regenerated because there is no staging schema to inspect. The tracked types remain unchanged.

## Integration Validation

No staging integration harness was executed. The existing scripts are target-sensitive and cannot provide staging evidence against local or production.

## UI Smoke Test Plan

- [ ] Log in with a staging-only user.
- [ ] Verify CRM navigation, list access, and permitted actions.
- [ ] Verify Sales quotations, orders, and permission boundaries.
- [ ] Verify Inventory lists and movement behavior without enabling RPC flags.
- [ ] Verify Production routes, machines, and operations.
- [ ] Verify work-order creation, updates, and tenant isolation.
- [ ] Verify notifications are delivered only through staging channels.
- [ ] Verify company-wide and branch-scoped access across multiple companies.
- [ ] Confirm no staging action appears in production audit logs.

## Production Isolation Verification

Production was identified by both its known ref and name. No link, migration, SQL, index, type-generation, or integration command targeted production. The unrelated project was not treated as staging.

## Validation Results

- Supabase CLI `2.101.0` project discovery completed without exposing secrets.
- `npm run typecheck`: passed.
- `npm run test`: passed with 5 test files and 134 tests.
- `npm run build`: passed with existing Browserslist, PDF.js `eval`, and large-chunk warnings.
- `npm run lint`: failed on the known repository backlog with 32 errors and 40 warnings.
- No application code, generated type, migration, feature flag, or environment secret changed.

## Remaining Risks

- No dedicated staging project exists.
- The production migration actor remains unknown.
- The repository CLI remains linked to production and must be relinked only during an approved staging session.
- Auth, Storage, GitHub secrets, and environment variables cannot be validated until staging is provisioned.
- Migration, manual index, generated type, RLS, cleanup, and UI evidence remain outstanding.
- Production rollout remains blocked until staging evidence is complete.

## Next Recommended Phase

Provision `dayandisli.com-staging` in the approved Supabase organization, configure protected staging credentials, then repeat Phase 27 from the target-safety check onward. Production rollout remains blocked.
