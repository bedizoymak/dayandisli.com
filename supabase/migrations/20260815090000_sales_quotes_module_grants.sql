-- Root-cause fix for "teklif kaydedilemiyor" on /apps/sales/quotes/new.
--
-- The 20260814120000 migration created public.quotes/quote_lines/
-- quote_customers/quote_history_entries with RLS policies but — unlike the
-- reference crm_sales_workflows tables, which received their table-level
-- GRANTs from a later, now-historical security-hardening migration that
-- named them explicitly (20260603130000, a fixed table-name array) — never
-- received an explicit GRANT to the `authenticated` role. Postgres denies
-- access at the privilege-check layer before RLS is ever evaluated, so
-- every insert/select/update from the frontend against these four tables
-- failed with a permission-denied error regardless of how correct the RLS
-- policies were. This migration is the missing grant, applied
-- idempotently (GRANT is safe to re-run).

begin;

grant select, insert, update, delete on table public.quote_customers to authenticated;
grant select, insert, update, delete on table public.quotes to authenticated;
grant select, insert, update, delete on table public.quote_lines to authenticated;
grant select, insert, update, delete on table public.quote_history_entries to authenticated;

revoke all on table public.quote_customers from anon;
revoke all on table public.quotes from anon;
revoke all on table public.quote_lines from anon;
revoke all on table public.quote_history_entries from anon;

-- quote_number_sequences is intentionally left ungranted — it is only ever
-- touched through the security-definer next_quote_number() function, which
-- already has its own explicit EXECUTE grant and does not need (and must
-- not have) direct table access from the client role.

commit;
