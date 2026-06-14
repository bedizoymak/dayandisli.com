# Phase 5A — Sync Run Recovery

## Objective

Add a local-only recovery foundation for Paraşüt synchronization runs that were
interrupted before normal finalization.

## Scope

This phase implements:

- stale `running` detection
- safe transition of interrupted runs to a terminal state
- idempotent cleanup
- schema-compatible recovery and resume metadata

It does not implement incremental synchronization, cursors, scheduling,
parallel execution, ERP mapping, CRM mapping, production access, or Paraşüt
write operations.

## Starting Findings

`parasut_sync_runs` currently supports these status values:

```text
running
completed
partial
failed
```

It does not contain:

- an `abandoned` status
- a `recovery_reason` column
- a `recovered_at` column

The table does contain a non-null JSONB `request_metadata` object. Phase 5A
therefore preserves schema compatibility by storing namespaced recovery and
resume metadata inside that object.

## Stale Run Definition

A run is stale when all conditions are true:

- `status = 'running'`
- `completed_at is null`
- `created_at` is older than the recovery cutoff

The default threshold is 30 minutes. Callers may supply a positive custom
threshold for deterministic tests or future operational policy.

## Recovery Strategy

The preferred transition is:

```text
running → failed
```

This is preferred over `running → abandoned` because:

- `failed` is already an allowed terminal state.
- no migration or constraint change is required.
- existing operational queries can recognize the result.
- the transition accurately states that the original execution did not finish.

Adding `abandoned`, `recovery_reason`, and `recovered_at` as dedicated columns
remains a future additive migration option.

## Recovery Metadata

The existing `request_metadata` object is merged with:

```json
{
  "recovery": {
    "reason": "stale_running_timeout",
    "recovered_at": "<ISO timestamp>",
    "threshold_minutes": 30,
    "previous_status": "running"
  },
  "resume": {
    "eligible": true,
    "source_run_id": "<run UUID>",
    "resource_type": "<Paraşüt resource type>",
    "last_completed_page": 0
  }
}
```

`last_completed_page` uses the existing `page_count` value. It is metadata only;
Phase 5A does not resume HTTP pagination.

## Concurrency and Idempotency

Each update is guarded by:

```text
id = candidate id
status = running
completed_at is null
```

If another process finalizes or recovers the row after detection, the guarded
update affects no row and the candidate is reported as skipped. A second
recovery execution finds no stale `running` rows.

## API

`recoverStaleRuns()` accepts:

- a server-side database client
- optional threshold minutes
- optional deterministic clock
- optional company or Paraşüt company filters

It returns detected, recovered, and skipped run identifiers without exposing
credentials or source payloads.

## Safety

- No migration is created.
- No production target is accessed.
- No Paraşüt endpoint is called.
- No ERP or CRM table is read or modified.
- Recovery is limited to stale rows in `parasut_sync_runs`.

## Validation

Required validation:

```text
npm run typecheck
npm run test
npm run build
npx tsc -p tsconfig.server.json
npx eslint server/parasut/sync-run-recovery.ts server/parasut/sync-run-recovery.test.ts
```

## Remaining Boundary

A future phase may add dedicated recovery columns and an `abandoned` status
through an additive migration after the operational model is approved.
