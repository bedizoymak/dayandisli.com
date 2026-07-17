-- Rollback for 20260716090000_move_sync_tables_to_parasut_schema.sql
-- Not a Supabase-applied migration file (no "supabase/migrations" naming
-- convention timestamp ordering intended) — a manual rollback script only,
-- to run by hand via `supabase db execute` (or psql) if the forward
-- migration needs to be reverted before its code-reference follow-up
-- migration is applied.

create schema if not exists integration;
grant usage on schema integration to service_role;
revoke all on schema integration from anon, authenticated;

alter table parasut.sync_runs set schema integration;
alter table parasut.sync_errors set schema integration;
