-- Rollback for 20260716130000_accounting_outbound_commands.sql
-- Not a Supabase-applied migration file — a manual rollback script only, to
-- run by hand (via `supabase db query --linked -f ...`) if the forward
-- migration needs to be reverted.
--
-- Safe to run at any point after the forward migration: these tables are
-- never written to by the existing GET sync engine or any other production
-- path, so dropping them cannot affect parasut.* or any other existing
-- table. If any outbound commands exist with real Paraşüt-created customers
-- attached (provider_resource_id IS NOT NULL), review them before dropping —
-- this rollback does not delete the real Paraşüt contacts, only the ERP's
-- own tracking of them (see PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md's
-- "read-only mirror" rule — this schema never had write access to
-- parasut.contacts in the first place).

drop table if exists public.accounting_audit_log;
drop table if exists public.accounting_provider_links;
drop table if exists public.accounting_outbound_attempts;
drop table if exists public.accounting_outbound_commands;
