# Phase 5C — Local Page Checkpoint Persistence Foundation

## Objective

Define the local metadata and persistence boundary required to record completed
Paraşüt collection pages without enabling HTTP resume behavior.

## Scope

This phase implements:

- versioned resume metadata initialization
- deterministic request fingerprint storage
- normalized include storage
- page checkpoint advancement
- safe metadata merging
- persistence ordering enforcement

It does not modify the existing sync engine or database schema.

## Initialization Contract

At run creation, `request_metadata.resume` is initialized with:

```json
{
  "contract_version": 1,
  "eligible": true,
  "source_run_id": "<current run ID>",
  "resource_type": "<resource type>",
  "endpoint": "<collection endpoint>",
  "include": ["<sorted unique includes>"],
  "page_size": 25,
  "last_completed_page": 0
}
```

Existing top-level metadata and unrelated fields already inside `resume` are
preserved. Contract-owned fields are replaced with values for the new run.

## Checkpoint Semantics

`last_completed_page = N` means:

1. Page `N` was fetched by the caller.
2. All parent mirror upserts completed.
3. All included-resource persistence completed.
4. Only then was the checkpoint metadata persisted.

The helper cannot advance the checkpoint when page persistence rejects.
Repeated writes of the same page are idempotent. Regression to an earlier page
is rejected.

## Persistence Boundary

`persistPageThenCheckpoint()` receives two caller-provided operations:

- `persistPage()`
- `persistCheckpoint(metadata)`

The checkpoint operation is invoked only after `persistPage()` resolves.
Phase 5C deliberately does not know how parent and included resources are
stored.

## Atomicity Limitation

Mirror resource writes and the `parasut_sync_runs.request_metadata` checkpoint
update are separate database operations. The current client-side boundary is
not transactionally atomic.

Failure after mirror writes but before checkpoint persistence produces safe
reprocessing on restart because mirror upserts are idempotent. It may repeat
work, but it does not claim an unpersisted page was complete.

The reverse ordering is forbidden because checkpoint-first persistence could
skip source records after interruption.

True atomicity would require a database transaction boundary that combines all
page writes and the checkpoint update. That is not introduced in this phase.

## Tests

Deterministic mocked tests cover:

- metadata initialization
- preservation of unrelated metadata
- include normalization
- successful checkpoint advancement
- page-before-checkpoint ordering
- repeated checkpoint updates
- checkpoint regression rejection
- failed page persistence preventing advancement

## Safety

- No HTTP request is executed.
- No Paraşüt endpoint is called.
- No database operation or migration is performed.
- No production system is accessed.
- No ERP or CRM mapping is introduced.

## Next Boundary

The next phase should integrate metadata initialization and checkpoint calls
into the local sync lifecycle while keeping actual resume execution disabled.
