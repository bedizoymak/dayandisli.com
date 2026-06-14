# AUTH-4 — Local Auth Cleanup Completion

## Objective

Complete local unified ERP authorization verification and remove legacy authorization objects only after every local safety gate passes.

## Environment

- Docker Desktop: running.
- Supabase CLI: `2.101.0`.
- API target: `127.0.0.1`.
- Database target: `127.0.0.1`.
- Production reference and name: rejected by the integration and readiness scripts.
- Production access: none.

## Local Reset Evidence

Two clean local resets completed successfully:

1. all migrations through AUTH-2;
2. the full migration chain including AUTH-4 cleanup.

The final reset applied:

`supabase/migrations/20260614064406_remove_legacy_authorization_objects.sql`

## RLS Integration Evidence

`scripts/test-unified-auth-local.mjs` passed:

- active UUID-linked ERP-user self-read;
- transitional null-linked normalized email self-read;
- inactive ERP-user denial;
- unregistered Auth-user denial;
- cross-user denial;
- anonymous denial;
- ordinary browser insert, update, and delete denial;
- administrator directory access through `role`, `roles`, and `permissions`;
- zero effective legacy policy predicates;
- complete synthetic fixture cleanup.

## Paraşüt Mirror Compatibility

`scripts/test-parasut-mirror-integration.mjs` now uses an active `erp_users` administrator fixture.

AUTH-2 policy migration was corrected to preserve company-wide mirror read access while replacing only the legacy administrator branch. The focused local mirror integration passed:

- table creation;
- identity uniqueness;
- JSONB and null relationship preservation;
- ERP administrator read;
- company-wide administrator read;
- branch, cross-company, anonymous, and browser-write denial;
- cleanup.

## Catalog Dependency Evidence

The local cleanup-readiness verifier passed before cleanup.

After cleanup, PostgreSQL catalog checks reported:

```text
admin_users absent: true
allowed_emails absent: true
is_email_allowed(text) absent: true
legacy policy count: 0
```

## Cleanup Migration

The migration:

- independently scans policies, views, functions, procedures, triggers, and rewrite dependencies;
- raises an exception if an effective dependency remains;
- drops `public.is_email_allowed(text)`;
- drops `public.admin_users`;
- drops `public.allowed_emails`;
- does not use `CASCADE`;
- does not modify passwords or `auth.users`.

## Generated Types

`src/integrations/supabase/types.ts` was regenerated from local Supabase after cleanup.

It contains no:

- `admin_users`;
- `allowed_emails`;
- `is_email_allowed`.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed, 22 files and 304 tests.
- `npm run build`: passed with existing non-blocking warnings.
- `npx tsc -p tsconfig.server.json`: passed.
- Focused auth tests: passed, 4 files and 19 tests.
- Unified auth local integration: passed.
- Paraşüt mirror local integration: passed.
- Cleanup-readiness verifier: passed.
- Focused ESLint: zero errors and one existing React Fast Refresh warning.

## Safety Confirmation

- Local Supabase only.
- No production access or modification.
- No remote migration.
- No password changes.
- No direct `auth.users` writes except synthetic local Auth administration performed by test setup and cleanup.
- No commit.
- No push.

## Final Auth Closure

Local unified ERP authorization is complete.

`public.erp_users` is the sole runtime ERP authorization authority. Legacy authorization tables and the legacy email helper are removed by a fail-closed migration that has been validated through a clean local reset. Production remains unchanged.
