# Phase 2 — Paraşüt Mirror Database Implementation

## Objective

Implement the additive PostgreSQL foundation for the read-only Paraşüt mirror
layer defined in Phases 0 and 1.

This phase creates mirror storage, synchronization audit storage, RLS policies,
and a local-only integration harness. It does not call Paraşüt, implement HTTP
synchronization, or map mirror records into ERP domain tables.

## Starting Findings

- Eight Paraşüt JSON:API resource types have confirmed payload evidence.
- Mirror resources require company ownership and stable external identity.
- Current repository migrations use UUID primary keys, JSONB payloads,
  `timestamptz`, `public.erp_set_updated_at()`, and tenant-aware RLS.
- Raw mirror payloads may contain personal, banking, tax, and accounting data.
- Browser writes must be denied.
- Service-role ingestion must remain possible only from trusted server code.
- `parasut_sync_cursors` remains deferred because incremental cursor semantics
  have not been verified.

## Files Inspected

- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/PHASE_0_PARASUT_MIRROR_ARCHITECTURE.md`
- `docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`
- sanitized discovery artifacts under `tools/parasut/discovery/`
- current Supabase migration, trigger, company-membership, and RLS conventions
- existing local-only database integration harnesses under `scripts/`
- `supabase/config.toml`
- `package.json`

## Implementation Scope

The migration creates:

- `parasut_sync_runs`
- `parasut_contacts`
- `parasut_products`
- `parasut_sales_invoices`
- `parasut_sales_invoice_details`
- `parasut_purchase_bills`
- `parasut_purchase_bill_details`
- `parasut_payments`
- `parasut_accounts`
- `parasut_sync_errors`

No ERP domain table is modified.

## Resource Storage

Every resource table contains:

- internal UUID identity
- DAYAN company ownership
- Paraşüt company, resource type, and resource ID
- JSONB attributes, relationships, included resources, and raw payload
- source creation, update, and archive projections
- first-seen, last-seen, and synchronization timestamps
- deterministic payload hash
- database audit timestamps

Each table fixes its JSON:API resource type with a check constraint and enforces
the external identity:

```text
parasut_company_id + resource_type + parasut_id
```

## Synchronization Storage

`parasut_sync_runs` records bounded synchronization execution metadata and
counts without storing credentials or unrestricted response payloads.

`parasut_sync_errors` records sanitized technical failures associated with a
run. It must not contain tokens, authorization headers, passwords, or complete
personal payloads.

## Indexes

Every resource table receives:

- an external identity unique constraint
- `(company_id, source_updated_at desc)`
- `(company_id, last_seen_at desc)`

Resources with confirmed archive attributes receive a partial archived-row
index.

Synchronization tables receive company, resource, run, and occurrence-time
indexes supporting operational review.

No broad JSONB GIN indexes are introduced without measured query evidence.

## RLS Model

RLS is enabled on all ten tables.

Authenticated reads require either:

- an active repository administrator record, or
- an active company-wide membership with `is_company_admin = true`.

The membership must match the row's `company_id` and must have
`branch_id is null`.

No policies are created for:

- anonymous access
- authenticated insert
- authenticated update
- authenticated delete

The trusted Supabase service role can perform future server-side ingestion by
its existing RLS bypass capability. No service credential is introduced into
source code, SQL, documentation, or browser configuration.

## Local Integration Harness

The local-only harness:

- requires an explicit opt-in environment variable
- discovers the local Supabase URL and keys from `supabase status`
- accepts only `127.0.0.1` or `localhost`
- rejects known production identifiers
- creates synthetic companies, users, memberships, and mirror rows
- tests external identity, JSONB preservation, null relationships, and RLS
- cleans up all test records and users
- never calls Paraşüt
- never prints credentials

## Validation Plan

Repository validation:

```text
npm run typecheck
npm run test
npm run build
npm run lint
```

Local database validation:

```powershell
$env:RUN_PARASUT_MIRROR_INTEGRATION="1"
node scripts/test-parasut-mirror-integration.mjs
```

The database harness may run only after `supabase status` proves both API and
database targets are local.

## Environment Status

At implementation start, Supabase CLI version `2.101.0` was available, but
local Supabase was not running because the Docker Desktop Linux engine was
unavailable. No remote or production fallback is permitted.

## Production Status

Production is untouched. The migration must not be pushed or remotely applied
in this phase.

## Remaining Boundaries

- No Paraşüt HTTP synchronization
- No connection/cursor model
- No domain mapping
- No CRM, stakeholder, Sales, Purchasing, Inventory, or Finance changes
- No frontend access
- No production deployment
