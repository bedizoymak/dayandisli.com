-- Dayan Disli ERP - legacy customer_full/customers_full compatibility
-- Manual apply after erp_core_schema.sql.
-- This file does not modify or delete customer_full/customers_full rows.

alter table if exists public.parties
  add column if not exists external_source text;

alter table if exists public.parties
  add column if not exists external_id text;

create index if not exists idx_parties_external_source
on public.parties(external_source);

create index if not exists idx_parties_external_id
on public.parties(external_id);

create unique index if not exists idx_parties_external_source_external_id_unique
on public.parties(external_source, external_id)
where external_source is not null and external_id is not null;

comment on column public.parties.external_source is 'Legacy source table name, for example customer_full or customers_full.';
comment on column public.parties.external_id is 'Primary key or stable identifier from the legacy customer source.';
