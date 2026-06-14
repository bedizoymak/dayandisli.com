# AUTH-3 — Local Unified Auth Verification and Legacy Cleanup

## Objective

Verify the AUTH-2 unified `erp_users` authorization model against local Supabase and permit destructive legacy cleanup only after every local safety gate passes.

## Safety Gate

All database tools created in this phase:

- require `RUN_LOCAL_AUTH_TESTS=1`;
- discover the target through `supabase status`;
- accept only `localhost` or `127.0.0.1`;
- reject production project reference `meauutjsnnggzcigyvfp`;
- reject production project name `dayandisli.com`;
- use synthetic `example.invalid` identities;
- clean synthetic Auth and ERP-user rows in `finally`.

No production access is permitted.

## Local Environment Result

Supabase CLI version `2.101.0` was available. Docker Desktop was not running, so `supabase status -o json` failed before database access. Consequently:

- a clean local reset could not run;
- AUTH-2 could not be applied to local PostgreSQL;
- authenticated RLS integration could not run;
- local type generation could not run;
- the destructive cleanup safety gate did not pass.

## Integration Harness

`scripts/test-unified-auth-local.mjs` verifies:

- active UUID-linked self-read;
- active null-linked normalized email bootstrap;
- inactive ERP-user denial;
- unregistered Auth-user denial;
- cross-user denial;
- anonymous denial;
- ordinary browser insert, update, and delete denial;
- administrator management through `role`, `roles`, or `permissions`;
- absence of effective legacy policy predicates;
- complete synthetic fixture cleanup.

Run only after local Supabase starts:

```powershell
supabase db reset --local --no-seed
$env:RUN_LOCAL_AUTH_TESTS="1"
node scripts/test-unified-auth-local.mjs
```

## Dependency Audit

`scripts/verify-unified-auth-cleanup-readiness.mjs` fails unless:

- active runtime source contains no legacy authorization reference;
- the target is local;
- effective policy expressions contain no legacy authorization reference;
- PostgreSQL dependency metadata contains no dependent object for the legacy tables or function.

Historical migrations and historical documentation retain references by design and are not runtime dependencies.

The following non-historical items still require local-schema resolution:

- generated Supabase types expose `admin_users`, `allowed_emails`, and `is_email_allowed`;
- `scripts/test-parasut-mirror-integration.mjs` uses `admin_users` as a legacy test fixture.

The generated types must not be hand-edited. They must be regenerated after the gated cleanup migration is applied locally.

## Cleanup Migration Decision

No cleanup migration was created.

This is the required fail-closed outcome because local database verification was unavailable. Creating a migration that drops `admin_users`, `allowed_emails`, or `is_email_allowed` without applying AUTH-2 and proving the RLS contract locally would violate the phase gate and the engineering constitution.

## Required Local Completion Sequence

1. Start Docker Desktop and local Supabase.
2. Run `supabase db reset --local --no-seed`.
3. Run the unified auth integration harness.
4. Run the cleanup-readiness verifier.
5. Replace the Paraşüt mirror integration fixture with an `erp_users` administrator.
6. Create the cleanup migration with `supabase migration new`.
7. Make the migration independently recheck catalog and policy dependencies before any drop.
8. Apply the migration locally from a clean reset.
9. Regenerate types:

```powershell
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

10. Verify generated types contain no legacy objects and rerun all validation.

## Current Production Status

Production was not accessed or modified. No migration was applied remotely.

## Validation Results

- Application typecheck passed.
- Full test suite passed: 22 files and 304 tests.
- Production build passed with existing non-blocking warnings.
- Server TypeScript check passed.
- Focused auth suite passed: 4 files and 19 tests.
- Focused ESLint passed with zero errors and one existing Fast Refresh warning.
- Local reset and RLS integration were blocked by unavailable Docker Desktop.
- Cleanup readiness remained blocked by legacy generated type entries.
