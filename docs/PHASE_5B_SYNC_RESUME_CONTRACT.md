# Phase 5B — Paraşüt Sync Resume Contract

## Objective

Define a pure, local resume decision contract for interrupted Paraşüt
collection synchronization without executing HTTP requests or changing the
database schema.

## Scope

This phase defines:

- resume metadata versioning
- page checkpoint meaning
- restart-versus-resume rules
- safe association between a failed source run and a new run
- deterministic decision reasons

It does not wire resume decisions into the sync engine.

## Resume Metadata Contract

The source run must contain a `request_metadata.resume` object with:

```json
{
  "contract_version": 1,
  "eligible": true,
  "source_run_id": "<failed run UUID>",
  "resource_type": "contacts",
  "last_completed_page": 4,
  "endpoint": "/v4/666034/contacts",
  "include": [],
  "page_size": 25
}
```

The new run receives decision metadata containing:

- contract version
- selected strategy
- source run association
- start page
- last completed page
- deterministic reason

## Page Checkpoint Semantics

`last_completed_page` means that the full page was fetched and all attempted
mirror persistence work for that page finished before the checkpoint was
recorded.

The candidate resume page is:

```text
last_completed_page + 1
```

Phase 5B does not persist checkpoints or execute this page.

## Decision Rules

Restart from page 1 unless every resume condition passes:

- a source run exists
- source status is `failed`
- page-drift risk is explicitly accepted
- metadata uses the current contract version
- metadata is marked eligible
- checkpoint is a positive integer
- source run ID matches the metadata association
- DAYAN company, Paraşüt company, and resource type match
- endpoint, include set, and page size match

Include ordering is normalized because it does not change request meaning.

## Pagination Risks

Paraşüt collection pagination is page-number based. The discovery evidence does
not prove snapshot isolation, immutable ordering, or cursor stability.

Between the failed run and its continuation:

- inserted records may shift later pages
- deleted records may shift records to earlier pages
- updated sort fields may reorder records
- the same record may be observed twice
- a record may be skipped

Mirror upserts make duplicates safe, but they cannot recover a record skipped
by page drift. Therefore restart is the default and resume requires explicit
local risk acceptance.

## Safe Association

A new run may reference a source run only when the source is failed and all
identity and request checks pass. Restart decisions intentionally set
`source_run_id` to null, preventing misleading lineage.

## Validation

Tests cover:

- no source run
- explicit risk acceptance
- valid checkpoint continuation
- source association mismatch
- tenant and resource mismatch
- request fingerprint mismatch
- include normalization
- invalid metadata
- non-failed source status

## Safety

- No HTTP request is executed.
- No Paraşüt endpoint is called.
- No database migration or database write is performed.
- No production system is accessed.
- No ERP or CRM mapping is introduced.

## Remaining Boundary

Phase 5A recovery metadata does not yet contain the version, endpoint, include
set, and page-size fields required by this contract. Those existing recovered
runs will safely receive a restart decision rather than an unsafe resume.

Before HTTP resume execution can be enabled, the sync engine needs an atomic
page-completion checkpoint update and controlled local evidence for interruption
between fetch, persistence, and checkpoint storage.
