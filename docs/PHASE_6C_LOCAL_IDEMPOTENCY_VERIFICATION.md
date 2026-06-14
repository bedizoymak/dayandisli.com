# Phase 6C — Local Idempotency Verification

## Objective

Verify deterministic mirror idempotency against local Docker Supabase using
the production `upsertResource()` helper and synthetic data only.

## Safety Gate

The harness requires `RUN_LOCAL_DB_TESTS=1`, obtains local runtime values from
`supabase status`, and calls `assertLocalOnlyEnvironment()` before creating a
database client. Only `localhost` and `127.0.0.1` are accepted. The production
project reference is rejected.

## Verification Design

The harness performs three independent synthetic sync runs:

1. Insert a parent contact and included sales invoice detail.
2. Reprocess byte-equivalent business payloads with reordered object keys.
3. Reprocess modified payloads under the same external identities.

It verifies:

- identical payloads produce `unchanged`
- canonical hashing is independent of object key order
- row counts remain one per external identity
- database row IDs remain stable
- modified payloads produce `updated`
- payload hashes and raw payloads change deterministically
- included-resource reprocessing creates no duplicates
- every sync run remains an independent row

## Cleanup

All generated row IDs are tracked and removed in `finally`. Independent
post-cleanup counts are passed to `verifyDatabaseCleanup()`.

## Scope Exclusions

No Paraşüt request, resume execution, incremental synchronization, scheduling,
migration, ERP mapping, CRM mapping, production access, commit, or push is
part of this phase.

