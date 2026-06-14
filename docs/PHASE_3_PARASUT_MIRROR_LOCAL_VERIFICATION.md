# Phase 3 — Paraşüt Mirror Local Verification

## Objective

Verify the Phase 2 Paraşüt mirror database foundation against local Supabase
only, including migration application, PostgreSQL catalog state, data
constraints, RLS behavior, service-role access, and cleanup.

## Safety Boundary

- Paraşüt must not be called.
- Production must not be accessed or modified.
- Both Supabase API and database hosts must resolve to `127.0.0.1` or
  `localhost`.
- Known production identifiers must be rejected.
- The integration harness requires `RUN_PARASUT_MIRROR_INTEGRATION=1`.
- No remote fallback is allowed.
- Only migration or harness defects discovered by local verification may be
  corrected.

## Required Inputs

- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/PHASE_0_PARASUT_MIRROR_ARCHITECTURE.md`
- `docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`
- `docs/PHASE_2_PARASUT_MIRROR_DATABASE_IMPLEMENTATION.md`
- `docs/phase-results/PHASE_2_RESULT.md`
- `supabase/migrations/20260613194043_parasut_mirror_database_foundation.sql`
- `scripts/test-parasut-mirror-integration.mjs`

## Local Verification Procedure

1. Start or confirm local Supabase.
2. Read `supabase status --output json`.
3. Confirm API and database hosts are local.
4. Confirm no production identifier appears in the target.
5. Apply the complete migration chain through the approved local reset flow.
6. Run the explicit-opt-in integration harness.
7. Inspect PostgreSQL catalogs for all ten tables.
8. Verify columns, keys, checks, indexes, triggers, grants, RLS, and policies.
9. Regenerate local Supabase TypeScript types if required.
10. Run repository validation.

## Required Tables

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

## Required Behavioral Evidence

- external identity uniqueness
- separate source IDs remain separate
- JSONB preservation
- null relationship preservation
- anonymous denial
- branch-member denial
- cross-company denial
- authenticated browser-write denial
- company-admin read
- repository-admin read
- service-role write
- complete synthetic-data cleanup

## Production Status

Production is not an authorized target for this phase. No migration, SQL,
type-generation, or verification command may use the linked production project.

## Result Recording

Final evidence and any local-environment limitation will be recorded in:

`docs/phase-results/PHASE_3_RESULT.md`
