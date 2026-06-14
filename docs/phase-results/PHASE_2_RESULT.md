# Phase 2 Result

## Phase Summary

Phase 2 implemented the additive Paraşüt mirror database foundation as a
Supabase migration and added a localhost-only integration harness.

No Paraşüt API request, ERP domain mapping, production database operation,
commit, or push was performed.

## 1. Migration File Created

Created:

`supabase/migrations/20260613194043_parasut_mirror_database_foundation.sql`

The migration was generated with:

```text
supabase migration new parasut_mirror_database_foundation
```

It has not been applied to production.

## 2. Tables Created

The migration defines:

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

`parasut_sync_cursors` was intentionally not created.

## 3. Constraints Created

The resource tables contain:

- UUID primary keys
- required DAYAN `company_id` ownership
- foreign keys to `public.companies`
- fixed JSON:API `resource_type` checks
- JSONB object/array type checks
- non-empty payload hash checks
- unique external identity constraints on:

```text
parasut_company_id + resource_type + parasut_id
```

Synchronization tables include non-negative counter checks, status checks,
timestamp ordering checks, HTTP status validation, and parent-run integrity.

No ERP domain foreign keys were introduced.

## 4. Indexes Created

Every resource table defines:

- external identity uniqueness
- `(company_id, source_updated_at desc)`
- `(company_id, last_seen_at desc)`

Contacts, products, Sales invoices, purchase bills, and accounts define partial
indexes for explicitly archived rows.

Synchronization indexes cover:

- company/resource/run start time
- error run and occurrence time
- company/resource/error occurrence time

No broad JSONB GIN indexes were added.

## 5. RLS Policies Created

RLS is enabled on all ten new tables.

Each table has one authenticated SELECT policy permitting:

- active repository administrators, or
- active company-wide memberships with `is_company_admin = true`

Company membership reads must match the row's `company_id`; branch-scoped
members are denied.

The migration creates:

- no anonymous policies
- no authenticated INSERT policies
- no authenticated UPDATE policies
- no authenticated DELETE policies

Anonymous table privileges are revoked. Authenticated write privileges are
revoked, while authenticated SELECT remains governed by RLS.

Service-role ingestion remains possible from trusted server code through
Supabase's existing RLS bypass behavior. No service key was exposed.

## 6. Tests Added

Created:

`scripts/test-parasut-mirror-integration.mjs`

The harness tests:

- explicit opt-in
- localhost API and database safety gates
- required-table existence
- external identity uniqueness
- preservation of separate Paraşüt IDs with identical payloads
- JSONB round-trip behavior
- null relationship preservation
- anonymous denial
- branch-member denial
- cross-company denial
- authenticated browser-write denial
- approved company administrator read
- active repository administrator read
- absence of write policies
- cleanup of synthetic test data

The harness uses synthetic values only and makes no Paraşüt request.

## 7. Validation Results

| Validation | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 134 tests |
| `npm run build` | Passed |
| `npm run lint` | Failed on known repository backlog: 32 errors, 40 warnings |
| Focused ESLint on integration harness | Passed |
| Integration safety gate | Passed by refusing unavailable local target |
| Local migration application | Not run: local Supabase unavailable |
| Local RLS integration cases | Not run: local Supabase unavailable |
| Type regeneration | Not run: local schema unavailable |

Supabase CLI version `2.101.0` was available. `supabase status` and
`supabase migration list --local` failed because the Docker Desktop Linux engine
and local PostgreSQL endpoint were unavailable.

No remote target was used as a fallback.

## 8. Production Status

Production was not modified.

The following were not run:

- remote `supabase db push`
- production migration application
- production type generation
- any Paraşüt API operation

## 9. Remaining Unknowns

- The migration still requires clean local application evidence.
- The RLS harness still requires execution against local Supabase.
- Generated Supabase types cannot be updated until the local migration applies.
- Pagination, incremental filtering, rate limits, and deletion semantics remain
  outside this database-foundation phase.
- A complete standalone payments endpoint remains unconfirmed.
- Purchase bill `spender` remains unverified with a populated sample.
- Dedicated integration permissions and connection configuration remain future
  design work.

## 10. Exact Phase 3 Prompt

```md
Read and strictly follow `/docs/ENGINEERING_CONSTITUTION.md`.

# PHASE 3 — VERIFY PARASUT MIRROR FOUNDATION LOCALLY

## Scope

Verify the Phase 2 Paraşüt mirror migration against local Supabase only.

Do NOT call Paraşüt.
Do NOT implement HTTP synchronization.
Do NOT modify ERP domain tables.
Do NOT design CRM partners or stakeholders.
Do NOT map mirror data into ERP domains.
Do NOT apply anything to production.
Do NOT commit or push unless separately requested.

## Required Inputs

- `docs/PHASE_0_PARASUT_MIRROR_ARCHITECTURE.md`
- `docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`
- `docs/PHASE_2_PARASUT_MIRROR_DATABASE_IMPLEMENTATION.md`
- `supabase/migrations/20260613194043_parasut_mirror_database_foundation.sql`
- `scripts/test-parasut-mirror-integration.mjs`

## Safety Gate

Before any database command:

- confirm the API and database hosts are `127.0.0.1` or `localhost`
- reject production ref `meauutjsnnggzcigyvfp`
- reject production name `dayandisli.com`
- require `RUN_PARASUT_MIRROR_INTEGRATION=1`

No remote fallback is allowed.

## Required Work

1. Create:

   `docs/PHASE_3_PARASUT_MIRROR_LOCAL_VERIFICATION.md`

2. Start or confirm local Supabase.

3. Apply the complete migration chain to a clean local database using the
   repository's approved local reset workflow.

4. Run:

   `$env:RUN_PARASUT_MIRROR_INTEGRATION="1"`
   `node scripts/test-parasut-mirror-integration.mjs`

5. Fix only defects in the Phase 2 migration or harness.

6. Verify all ten tables, constraints, indexes, triggers, grants, and policies
   from the PostgreSQL catalogs.

7. Regenerate local Supabase TypeScript types if the repository workflow
   requires it.

8. Run:

   `npm run typecheck`
   `npm run test`
   `npm run build`
   `npm run lint`

9. Create:

   `docs/phase-results/PHASE_3_RESULT.md`

## Required Evidence

- clean local migration application
- external identity uniqueness
- separate source IDs remain separate
- JSONB and null relationship preservation
- anonymous denial
- branch denial
- cross-company denial
- browser-write denial
- company-admin read
- repository-admin read
- service-role write
- cleanup verification
- production untouched

Do not proceed to Paraşüt synchronization implementation until all local
database and RLS evidence passes.
```
