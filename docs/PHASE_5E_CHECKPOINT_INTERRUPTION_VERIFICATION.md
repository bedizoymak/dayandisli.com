# Phase 5E — Checkpoint Interruption Verification

## Objective

Prove deterministic checkpoint behavior across interruption and persistence
failure boundaries without enabling HTTP resume execution.

## Test-First Finding

The first multi-page test exposed a correctness bug:

```text
page 1 persistence failed
page 2 persistence succeeded
checkpoint advanced to page 2
```

This could cause a future resume implementation to skip the failed page.

## Correctness Fix

The lifecycle now permanently blocks checkpoint advancement for the remainder
of a run after any parent or included-resource persistence error.

The sync may continue observing and idempotently persisting later pages, but
the durable checkpoint remains the last contiguous successful page.

## Verified Scenarios

### Page One Failure

When page 1 fails, no later page can create a checkpoint.

### Checkpoint Persistence Failure

When mirror persistence succeeds but checkpoint persistence fails:

- the error escapes the page loop
- the run is finalized as `failed`
- no successful checkpoint is recorded

### Page Two Failure

When page 1 completes and page 2 fails, the final checkpoint remains page 1.

### Included-Resource Failure

Failure while storing a confirmed included resource prevents checkpoint
advancement for that page and every later page in the same run.

### Rerun Safety

An interrupted run can reprocess an already stored source resource. The
external identity lookup and matching payload hash convert the second attempt
to an unchanged update rather than a duplicate insert.

## Interruption Boundaries

- Interruption after fetch but before persistence leaves the checkpoint
  unchanged.
- Parent persistence failure leaves the checkpoint unchanged.
- Included persistence failure leaves the checkpoint unchanged.
- Interruption after mirror persistence but before checkpoint persistence may
  repeat work on rerun, which is safe because mirror upserts are idempotent.
- Checkpoint persistence failure marks the run failed.

## Remaining Atomicity Limit

Mirror writes and checkpoint persistence remain separate database operations.
This phase proves safe under-reporting of progress and idempotent reprocessing,
not transaction-level atomicity.

## Safety

- No HTTP resume or checkpoint-based pagination was added.
- No Paraşüt request or production access occurred.
- No migration, scheduling, parallelism, ERP mapping, or CRM mapping was added.
