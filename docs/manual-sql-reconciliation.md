# Manual SQL Reconciliation (Phase 12)

`supabase/manual/*.sql` contains SQL applied by hand (SQL Editor / psql) outside the migrations pipeline, mostly during incidents when a migration round-trip was too slow or too risky. This document is the authoritative reconciliation of that state. **Rule going forward: no new manual SQL — everything ships as a versioned migration.**

Status legend:
- APPLIED-REPRESENTED: effect also exists as a migration; the manual file is historical record only. Do NOT re-run.
- APPLIED-NOT-IN-MIGRATIONS: exists in prod but no migration represents it. A future idempotent migration must be written before any environment rebuild can work.
- DRAFT: never applied; review-gated. **DO NOT EXECUTE** without staging rehearsal.

| File | Status | Notes / follow-up |
|---|---|---|
| erp_core_schema.sql | APPLIED-NOT-IN-MIGRATIONS | The ERP core table set (parties canonical note included). Highest-priority reconciliation target: an idempotent `CREATE TABLE IF NOT EXISTS` mirror migration should be generated from the live schema dump before any rebuild attempt. |
| customer_full_erp_sync.sql | APPLIED-NOT-IN-MIGRATIONS | Adds external_source/external_id mapping columns + sync helpers for the legacy bridge. Legacy-generation (see database-generation-retirement.md §GEN-CUSTOMER-0) — reconcile into the parties retirement migration instead of a standalone one. |
| erp_customer_supplier_finance_schema.sql | APPLIED-NOT-IN-MIGRATIONS | Finance-side tables/columns. Same reconciliation priority as erp_core_schema. |
| inventory_movement_rpc_draft.sql | DRAFT → partially superseded | scripts/verify-inventory-rpc-sql.mjs validates the latest inventory_movement_rpc migration against this draft; the RPC itself shipped as a reviewed migration. Treat file as reference only. |
| production_route_operations_rpc_draft.sql | DRAFT | Unverified application state. Do not run; confirm live signature via pg_proc before any reuse. |
| production_work_order_from_sales_order_rpc_draft.sql | DRAFT | Same handling as above. |
| tenant_policy_predicate_corrections_draft.sql | DRAFT | Policy predicate corrections; if applied by hand during the RLS phases, the phase-25/26 migrations already encode the intended final policy set (they rewrite policy text). Reconcile by diffing live policies against those migrations, then mark obsolete. |
| work_orders_sales_order_unique_draft.sql | DRAFT → superseded | Unique constraint; companion `_concurrent_index.sql` documents the CONCURRENTLY path required on a live table (plain CREATE UNIQUE INDEX takes locks — never run it on prod during business hours). |
| work_orders_sales_order_unique_concurrent_index.sql | APPLIED-REPRESENTED (assumed) | Concurrent index application; verify via pg_indexes in the next maintenance window. |
| work_order_operations_rls_prereq_draft.sql | DRAFT | RLS prerequisite grants/policies; phase-26 migrations revoke anon broadly — diff before treating either as authoritative. |

## Known migration-history blemish (no action now)
Migration `20260811120000_schedule_parasut_sync_run.sql` embeds a literal publishable (anon-equivalent) key as the initial Vault secret value. Publishable keys ship in every frontend bundle, so exposure class is low — but the plaintext-in-history defeats Vault rotation hygiene. Action: rotate to a NEW secret name/value at the next natural secret rotation window (requires production secret write access → out of scope for this remediation branch).

## Machine-state untracked (this phase)
`supabase/.temp/` and `supabase/.branches/` removed from git and ignored — CLI link state is per-workstation.
