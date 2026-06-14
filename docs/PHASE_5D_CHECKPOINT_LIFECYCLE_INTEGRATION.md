# Phase 5D — Checkpoint Lifecycle Integration

## Objective

Integrate the Phase 5C checkpoint contract into local full-sync run creation
and page persistence while keeping HTTP resume execution disabled.

## Changes

Sync-run creation now generates the run UUID before insertion. This allows the
initial `request_metadata.resume.source_run_id` value to reference the current
run without a second initialization update.

Initial metadata preserves the existing endpoint and include fields and adds:

- contract version
- eligibility
- source run ID
- resource type
- normalized include set
- page size
- zero checkpoint

After a page is fetched, parent resources and included resources are persisted
using the existing lifecycle. The checkpoint advances only when that page adds
no persistence errors.

## Start Page

Every sync still starts at page 1. The client call remains:

```text
getPaginated(endpoint, include)
```

No checkpoint or resume decision is passed to the HTTP client.

## Partial Failure Behavior

Parent and included-resource failures retain the existing sanitized error
recording behavior. A page with any such error does not advance
`last_completed_page`.

Checkpoint persistence failure is critical. It escapes the page loop, records
the run failure through the existing outer failure path, and finalizes the run
as failed.

## Atomicity

Mirror writes and checkpoint persistence remain separate client-side database
operations. If interruption occurs after mirror writes and before the
checkpoint update, a future restart may repeat the page. Existing idempotent
mirror upserts make repetition safer than incorrectly claiming completion.

## Validation

Mocked lifecycle tests verify:

- versioned metadata is inserted with the run
- unrelated endpoint and include metadata remains present
- include values are normalized in the resume fingerprint
- a successful page advances the checkpoint
- a parent persistence failure prevents checkpoint advancement

Existing Phase 5C tests continue to cover ordering, repeated updates,
regression rejection, and checkpoint suppression after persistence failure.

## Safety

- No HTTP resume behavior was added.
- No incremental synchronization or source cursor was added.
- No database migration was created.
- No production system or Paraşüt endpoint was accessed.
- No ERP or CRM mapping was changed.
