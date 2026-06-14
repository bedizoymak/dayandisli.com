# Phase 6A — Local Checkpoint Database Integration

## Objective

Verify the checkpoint metadata lifecycle against the existing Paraşüt mirror
schema in local Docker Supabase only.

## Safety Gate

The harness:

- requires `RUN_LOCAL_DB_TESTS=1`
- obtains local runtime values from `supabase status`
- calls `assertLocalOnlyEnvironment()` before creating a Supabase client
- rejects any API URL other than `localhost` or `127.0.0.1`
- rejects the production project reference `meauutjsnnggzcigyvfp`
- never prints keys, tokens, or connection strings

The local service-role key is used only by the Node process because mirror
tables intentionally deny authenticated browser writes.

## Synthetic Data

All rows use the marker `dayan-local-integration`. The harness creates one
synthetic company and synthetic sync runs. It does not use customer data,
personal data, or Paraşüt payloads.

## Verification Cases

1. Sync-run creation persists initialized versioned resume metadata.
2. A completed page update persists `last_completed_page`.
3. A simulated failed page leaves the stored checkpoint unchanged.
4. Stale-run recovery marks the run failed while preserving compatible resume
   metadata.
5. Cleanup removes all synthetic sync runs and the synthetic company.
6. Independently queried final counts pass `verifyDatabaseCleanup()`.

## Cleanup

Execution uses `try/finally`. Cleanup targets generated UUIDs rather than broad
marker-only deletion. Final count queries independently confirm that no
created rows survive.

## Scope Exclusions

This phase does not call Paraşüt, execute HTTP resume behavior, add
checkpoint-based pagination, create migrations, map ERP or CRM data, schedule
work, or access production.

## Execution

PowerShell:

```powershell
$env:RUN_LOCAL_DB_TESTS="1"
node scripts/test-parasut-checkpoint-integration.mjs
```

Local Supabase must already be running.

