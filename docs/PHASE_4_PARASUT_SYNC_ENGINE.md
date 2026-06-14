# Phase 4 — Paraşüt Read-Only Sync Engine

## Objective

Implement the first server-side, local-only synchronization engine that reads
confirmed Paraşüt JSON:API resources and stores exact source snapshots in the
verified mirror tables.

## Safety Boundary

- Paraşüt access is read-only.
- OAuth token requests are the only non-GET Paraşüt requests.
- Resource endpoints use GET only.
- Supabase writes are allowed only when both API and database targets are local.
- Production, linked migrations, ERP domain tables, and browser code are out of
  scope.
- Tokens remain in memory and are never logged or persisted.

## Architecture

The engine is organized under `server/parasut/`:

- `auth.ts`: OAuth acquisition and refresh
- `client.ts`: authenticated GET, retries, rate-limit handling, pagination
- `types.ts`: JSON:API, configuration, and sync contracts
- `upsert-resource.ts`: canonical hashing and idempotent mirror upserts
- `sync-base.ts`: sync-run lifecycle, included routing, sanitized errors
- resource modules for contacts, products, Sales invoices, purchase bills, and
  accounts

The local runner discovers local Supabase credentials through
`supabase status`, validates localhost targets, resolves the DAYAN company, and
executes selected resources.

## Resource Scope

Top-level collection targets:

- `contacts`
- `products`
- `sales_invoices`
- `purchase_bills`
- `accounts`

Confirmed included types routed to mirror tables:

- `sales_invoice_details`
- `purchase_bill_details`
- `payments`

Other included types remain preserved inside the parent `included` snapshot but
are not written to speculative tables.

## Payload Preservation

The mirror row stores:

- exact `attributes`
- exact `relationships`
- exact request-level `included`
- complete resource object as `raw_payload`

No ERP meaning is inferred. Null relationships remain null.

## Hashing and Idempotency

SHA-256 is calculated over canonical JSON containing:

```text
type + id + attributes + relationships
```

Object keys are sorted recursively. Request-level included data is excluded from
the resource hash.

An existing row with the same hash receives only a `last_seen_at` update. A
changed hash updates the source snapshot and synchronization metadata.

## Pagination and Retry

Pagination is sequential and bounded:

- explicit page number and page size
- stop on empty page
- stop when returned count is smaller than page size
- respect recognized total-count metadata when available
- hard maximum page limit

Transient status codes and network failures use exponential backoff. HTTP 429
and `Retry-After` are respected. Authentication failure triggers one token
refresh and request retry.

## Sync Metadata

Each resource execution creates one `parasut_sync_runs` row.

Run counters record:

- pages fetched
- resources observed
- inserted rows
- updated rows
- unchanged rows
- sanitized errors

Errors are stored in `parasut_sync_errors` without response payloads, tokens,
credentials, or authorization headers.

## Local Validation

The implementation includes:

- mocked unit tests for hashing, retries, token refresh, pagination,
  idempotent upserts, and changed-payload update detection
- a local-only runner for real read-only Paraşüt synchronization
- local Supabase target and production-identifier gates
- count, idempotency, payload, and update-detection reporting

The local run completed all five top-level resources. Representative completed
second-pass evidence:

- contacts: 417 unchanged resources
- products: 2,378 unchanged resources
- sales invoices and confirmed included resources: 2,395 unchanged resources
- purchase bills and confirmed included resources: 3,165 unchanged resources
- accounts: 3 unchanged resources

All completed runs reported zero synchronization errors. Counts that include
invoice details and payments are intentionally resource observations rather
than parent collection row counts.

The initial all-resource command exceeded the command-session timeout while
processing purchase bills. Purchase bills and accounts were then executed
separately and completed successfully. This interruption can leave a local
`running` sync-run record because process termination cannot execute the normal
failure-finalization path.

## Production Status

This engine is not authorized for production execution. It introduces no
migration, RLS change, ERP mapping, browser UI, commit, or push.
