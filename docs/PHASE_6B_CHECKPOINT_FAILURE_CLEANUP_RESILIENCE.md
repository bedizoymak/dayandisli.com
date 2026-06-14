# Phase 6B — Checkpoint Failure and Cleanup Resilience

## Objective

Verify local-only checkpoint failure behavior and cleanup resilience against
the existing Paraşüt mirror schema.

## Failure Injection

The harness uses the existing `request_metadata` JSON object constraint to
reject an invalid array checkpoint. No schema, policy, or production code is
changed.

## Verified Behavior

- A rejected checkpoint write preserves the previous completed page.
- The affected sync run can be finalized with `status = failed`.
- Cleanup executes after a controlled assertion failure.
- Repeated cleanup is idempotent.
- Independently queried counts prove that no synthetic rows survive.

## Safety

Execution requires `RUN_LOCAL_DB_TESTS=1` and
`assertLocalOnlyEnvironment()`. Only `localhost` and `127.0.0.1` are accepted.
All fixtures use generated identifiers and the marker
`dayan-local-integration`.

No Paraşüt request, migration, production operation, commit, or push is part
of this phase.

