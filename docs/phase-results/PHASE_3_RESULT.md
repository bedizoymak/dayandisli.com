# Phase 3 Result

## Phase Summary

Phase 3 verified the Paraşüt mirror database foundation against local Supabase.
The complete migration chain applied cleanly, all ten mirror tables were
verified from PostgreSQL catalogs, the local integration harness passed, and
local Supabase TypeScript types were regenerated.

No Paraşüt request, production database operation, domain mapping, commit, or
push was performed.

## 1. Local Supabase Status

Local Supabase started successfully after Docker Desktop was started.

Supabase CLI version:

```text
2.101.0
```

## 2. Local Database Target Confirmation

Confirmed local-only targets:

```text
API: http://127.0.0.1:54321
Database: postgresql://...@127.0.0.1:54322/postgres
```

The known production reference and project name were not present. No remote
fallback was used.

## 3. Migration Application Result

Command:

```text
supabase db reset --local --yes
```

Result: passed.

The complete migration chain applied to a clean local database, including:

```text
20260613194043_parasut_mirror_database_foundation.sql
```

The local migration history records the Phase 2 migration.

## 4. All Ten Mirror Tables Verified

PostgreSQL catalog inspection confirmed:

1. `parasut_sync_runs`
2. `parasut_contacts`
3. `parasut_products`
4. `parasut_sales_invoices`
5. `parasut_sales_invoice_details`
6. `parasut_purchase_bills`
7. `parasut_purchase_bill_details`
8. `parasut_payments`
9. `parasut_accounts`
10. `parasut_sync_errors`

The eight resource tables each contain 18 columns. `parasut_sync_runs` contains
17 columns and `parasut_sync_errors` contains 12 columns.

## Catalog Verification

Verified for all ten tables:

- primary keys
- company foreign keys
- JSONB and resource-type check constraints
- external identity unique constraints on resource tables
- expected indexes
- updated-at triggers where designed
- authenticated SELECT grants only
- no anonymous grants
- RLS enabled
- exactly one authenticated SELECT policy per table
- no INSERT, UPDATE, DELETE, or ALL policies

Resource tables contain four or five indexes depending on archive support.
Synchronization tables contain the expected operational indexes.

## 5. External Identity Uniqueness Verified

Attempting to insert the same:

```text
parasut_company_id + resource_type + parasut_id
```

twice produced PostgreSQL unique-violation code `23505`.

## 6. Separate Source IDs Remain Separate

Two contact resources with identical payloads but different Paraşüt IDs were
inserted as two distinct mirror rows.

## 7. JSONB Preservation Verified

Synthetic `attributes`, `relationships`, `included`, and `raw_payload` values
round-tripped through the local Data API without structural loss.

## 8. Null Relationship Preservation Verified

A synthetic relationship containing:

```json
{ "data": null }
```

was returned unchanged. No relationship was inferred.

## 9. Anonymous Denial Verified

The anonymous client could not access the synthetic mirror rows. Catalog
inspection also confirmed no `anon` table grants or policies.

## 10. Branch-Member Denial Verified

An active branch-scoped membership, including one marked company administrator,
could not read raw mirror rows because its membership had a non-null branch.

## 11. Cross-Company Denial Verified

An active company-wide administrator belonging to another company received no
rows from the tested company.

## 12. Authenticated Browser-Write Denial Verified

An approved authenticated company administrator could read but could not insert
mirror rows.

Catalog inspection confirmed authenticated clients have SELECT privilege only
and no write policies.

## 13. Company-Admin Read Verified

An active company-wide membership with:

```text
branch_id = null
is_company_admin = true
```

could read mirror rows belonging to the same DAYAN company.

## 14. Repository-Admin Read Verified

An active user represented in `admin_users` could read the tested mirror rows.

## 15. Service-Role Write Verified

The trusted local service-role client created the synthetic companies,
memberships, administrator fixture, and mirror rows required by the harness.
This confirms service-side ingestion remains possible while browser writes stay
denied.

No service credential was written to source files or documentation.

## 16. Cleanup Verification

The harness deleted all synthetic mirror rows, memberships, administrator
records, companies, branches through company cascading, and authentication
users.

The final mirror-row count for created IDs was zero.

## 17. Type Regeneration Status

Command:

```text
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

Result: passed.

The generated schema contract now includes the Paraşüt mirror tables.

## 18. Typecheck Result

Command:

```text
npm run typecheck
```

Result: passed.

## 19. Test Result

Command:

```text
npm run test
```

Result: passed.

```text
5 test files
134 tests
```

## 20. Build Result

Command:

```text
npm run build
```

Result: passed.

Existing bundle-size, Browserslist, and PDF library warnings remain.

## 21. Lint Result

Command:

```text
npm run lint
```

Result: failed on the existing repository backlog.

```text
32 errors
40 warnings
```

No reported lint issue originated from a Phase 3 file.

## 22. Production Untouched Confirmation

Production was not accessed or modified.

Not run:

- remote `supabase db push`
- linked type generation
- remote SQL
- Paraşüt authentication or API requests

## 23. Remaining Unknowns

- Stable Paraşüt pagination ordering is unverified.
- Incremental filtering semantics are unverified.
- Rate-limit and retry behavior is unverified.
- Source deletion semantics are unknown.
- A complete standalone payments collection is unconfirmed.
- A populated purchase bill `spender` relationship remains unobserved.
- The DAYAN company to Paraşüt company connection model is not designed.
- The server-side synchronization architecture is not yet designed.
- Historical snapshot retention remains undecided.
- Repository-wide lint debt remains.

## 24. Exact Phase 4 Prompt

```md
Read and strictly follow `/docs/ENGINEERING_CONSTITUTION.md`.

# PHASE 4 — DESIGN PARASUT READ-ONLY MIRROR SYNCHRONIZATION

## Mode

This phase is architecture and implementation planning only.

Do NOT call Paraşüt.
Do NOT implement synchronization code.
Do NOT create or apply migrations.
Do NOT modify database schema or RLS.
Do NOT modify ERP domain tables.
Do NOT design CRM partners or stakeholders.
Do NOT map mirror data into CRM, Sales, Purchasing, Inventory, or Finance.
Do NOT add browser access.
Do NOT access or modify production.
Do NOT commit or push.

## Required Inputs

- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/PHASE_0_PARASUT_MIRROR_ARCHITECTURE.md`
- `docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`
- `docs/PHASE_2_PARASUT_MIRROR_DATABASE_IMPLEMENTATION.md`
- `docs/PHASE_3_PARASUT_MIRROR_LOCAL_VERIFICATION.md`
- `docs/phase-results/PHASE_3_RESULT.md`
- `supabase/migrations/20260613194043_parasut_mirror_database_foundation.sql`
- current server-side function and job conventions under `supabase/functions/`
- sanitized discovery artifacts under `tools/parasut/discovery/`

## Objective

Design the server-side, GET-only synchronization architecture that imports
confirmed Paraşüt JSON:API resources into the verified mirror tables.

## Required Design

1. Connection configuration and DAYAN company to Paraşüt company ownership
2. Server-only credential handling and token refresh
3. Resource registry for the eight confirmed mirror resources
4. Collection, detail, and included-resource fetch strategy
5. Pagination strategy without assuming unverified ordering
6. Canonical JSON and SHA-256 payload hashing
7. Idempotent upsert behavior
8. Included-resource routing
9. Sync-run and sanitized-error lifecycle
10. Retry, rate-limit, timeout, and partial-run behavior
11. Archive and missing-record behavior
12. Concurrency and duplicate-run prevention
13. Local test strategy with mocked HTTP only
14. Production safety and rollout boundaries
15. Exact Phase 5 implementation prompt

## Required Output

Create:

- `docs/PHASE_4_PARASUT_MIRROR_SYNC_DESIGN.md`
- `docs/phase-results/PHASE_4_RESULT.md`

Documentation must be English.
No implementation or Paraşüt request is allowed.
```
