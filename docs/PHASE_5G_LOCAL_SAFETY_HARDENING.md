# Phase 5G — Local Supabase Integration Safety Hardening

## Objective

Establish deterministic, reusable safety guards before any future local
Supabase integration test performs database writes.

## Scope

This phase adds pure validation helpers and mocked tests only. It does not
connect to Supabase, call Paraşüt, alter a database, or execute cleanup.

## Safety Contract

Local database tests require all of the following:

- `SUPABASE_URL` uses `http` or `https`.
- The URL hostname is exactly `localhost` or `127.0.0.1`.
- The URL does not contain the production project reference
  `meauutjsnnggzcigyvfp`.
- `SUPABASE_ANON_KEY` is present.
- `RUN_LOCAL_DB_TESTS` is exactly `1`.

Cloud Supabase endpoints, public endpoints, malformed URLs, embedded
credentials, and production references are rejected.

## Cleanup Verification

`verifyDatabaseCleanup()` accepts final row counts from a future integration
harness. It succeeds only when every named synthetic-data scope has a finite,
non-negative count of zero. It throws with the remaining scope names and
counts when cleanup is incomplete.

The helper does not query or mutate a database. Future integration code must
perform cleanup and then supply independently measured counts.

## Synthetic Data

`createSyntheticPayload()` generates deterministic test-only identifiers and
metadata. It contains no customer names, emails, phone numbers, addresses,
Paraşüt payloads, or other personal data.

## Tests

Focused tests cover:

- `localhost` acceptance
- `127.0.0.1` acceptance
- cloud URL rejection
- production project rejection
- explicit opt-in enforcement
- required anonymous-key enforcement
- successful cleanup verification
- incomplete cleanup rejection
- synthetic payload determinism and privacy

## Safety Confirmation

No real database writes, Paraşüt requests, migrations, production access,
commits, or pushes are part of this phase.

## Remaining Unknowns

The future local integration harness must define the exact table scopes,
cleanup order, and post-cleanup count queries. Service-role credentials are
not introduced by this phase.

