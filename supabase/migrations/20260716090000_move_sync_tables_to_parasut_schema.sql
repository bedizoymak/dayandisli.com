-- PROPOSED — NOT YET APPLIED, AND NOT AN ACTIVE MIGRATION.
--
-- This file intentionally lives under docs/migration-proposals/, NOT
-- supabase/migrations/ — a drafted-but-unapproved migration must never sit
-- in the active migrations directory, because the next unrelated
-- `supabase db push` would pick it up and apply it automatically. Only move
-- (copy) this file into supabase/migrations/ once it is explicitly approved,
-- immediately before applying it.
--
-- See PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md ("Schema Cohesion") for
-- the full impact analysis. Do not apply this until the accompanying code
-- changes ship in the same deploy — the sync engine and the Edge Function
-- must agree with the database on which schema `sync_runs`/`sync_errors`
-- live in:
--   - server/parasut/types.ts
--   - server/parasut/sync-base.ts
--   - server/parasut/sync-run-recovery.ts
--   - server/parasut/local-safety.test.ts
--   - supabase/functions/parasut-api/handlers.ts (scopedSyncTable's schema("integration") call)
--
-- Intent: schema cohesion. `parasut` = all Paraşüt mirror AND synchronization
-- data; `public` = native ERP data. `integration` was originally kept
-- separate to distinguish "sync infrastructure" from "resource mirror"
-- tables, but per the intended two-schema architecture, sync infrastructure
-- belongs in `parasut` too.
--
-- Safety: `ALTER TABLE ... SET SCHEMA` is a metadata-only operation — no rows
-- are read, copied, or rewritten. Confirmed via read-only count query at the
-- time this migration was drafted: both tables hold 0 rows (see report §5),
-- so there is no data migration risk regardless. Indexes, constraints,
-- triggers, RLS policies, and existing GRANTs stay attached to the table
-- object and move with it automatically — none of those need to be
-- recreated.

alter table integration.sync_runs set schema parasut;
alter table integration.sync_errors set schema parasut;

-- integration now has no tables left in it.
drop schema integration;
