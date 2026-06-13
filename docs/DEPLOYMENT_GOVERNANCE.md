# Deployment Governance

## Purpose

This policy defines the required controls for Supabase, database, application, and ERP feature deployments.

## Production Rules

Production project:

- Ref: `meauutjsnnggzcigyvfp`
- Name: `dayandisli.com`

The following are forbidden without explicit owner approval:

- `supabase db push`
- `supabase migration repair`
- manual index creation or removal
- RLS policy creation, modification, or removal
- RPC deployment or activation
- production feature-flag enablement
- linked type regeneration
- out-of-band dashboard SQL

Every approved production change requires:

- named owner, operator, and reviewer;
- approved commit and migration versions;
- current backup or restore point;
- staging evidence;
- reviewed rollback plan;
- pre- and post-deployment catalog evidence;
- recorded execution time and result.

## Staging Rules

A staging project must have a distinct project ref and a clearly non-production name.

Allowed after target verification and approval:

- migration inspection and `db push`;
- type regeneration;
- isolated integration tests;
- feature-flag testing;
- manual concurrent index testing;
- RLS and RPC smoke testing;
- rollback rehearsal.

Required before any staging database action:

```powershell
$env:SUPABASE_TARGET="staging"
$env:ALLOW_STAGING_DB_PUSH="1"
npm run supabase:target-check
```

Set `ALLOW_STAGING_DB_PUSH` back to `0` or remove it after the approved session.

## Local Rules

Allowed when the safety check confirms `127.0.0.1`, `localhost`, or `::1`:

- destructive database testing;
- local reset;
- RPC experiments;
- RLS verification;
- concurrency tests;
- forced-failure and rollback testing;
- disposable Auth and business fixtures.

Local success does not authorize a remote deployment.

## Target Safety Check

Run:

```bash
npm run supabase:target-check
```

The script:

- rejects the known production ref and name;
- rejects explicit production mode;
- requires `SUPABASE_TARGET=staging`;
- requires `ALLOW_STAGING_DB_PUSH=1`;
- verifies linked staging identity;
- detects verified local hosts;
- never performs a push.

A passing check is a preflight result, not a durable authorization token. Reconfirm the linked target immediately before every remote command.

## Change Records

Each deployment record must include:

- environment;
- project ref and name;
- Git commit;
- migration versions;
- manual SQL artifacts;
- operator, reviewer, and owner;
- start and completion times;
- validation and smoke-test results;
- rollback status;
- incident reference when applicable.

Never record secrets in deployment documents.
