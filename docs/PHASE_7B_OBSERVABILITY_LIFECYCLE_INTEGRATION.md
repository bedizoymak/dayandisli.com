# Phase 7B — Observability Lifecycle Integration

## Objective

Integrate the Phase 7A observability contract into the Paraşüt sync lifecycle
without changing synchronization behavior or database writes.

## Integration Design

`SyncContext` accepts an optional observability sink. When absent, no
observability work occurs.

The lifecycle emits:

- one structured run summary after completed-run finalization
- one structured run summary after partial-run finalization
- one structured run summary after failed-run finalization
- sanitized error summaries after corresponding error rows are persisted

## Failure Isolation

Sink methods may be synchronous or asynchronous. Throws and rejected promises
are ignored so observability cannot alter a sync result, suppress the original
error, or change database state.

## Data Safety

Only Phase 7A summary objects reach the sink. Raw payloads, request metadata,
credentials, emails, phone numbers, and untrusted unsanitized errors are not
emitted.

## Scope

No external logging provider, scheduler, Paraşüt request, resume execution,
incremental synchronization, migration, ERP mapping, CRM mapping, production
access, commit, or push is part of this phase.

