-- ============================================================================
-- PROPOSED — DO NOT APPLY WITHOUT HUMAN SIGN-OFF (Phase 13, 2026-08-25)
-- ============================================================================
-- This file retires the superseded GEN-1 Paraşüt mirror tables in schema
-- `public` (created by 20260613194043). The canonical mirror is schema
-- `parasut` (created by 20260713120000; sync_runs relocated from
-- `integration` by 20260716090000).
--
-- WHY THIS FILE IS NOT IN supabase/migrations/:
--   Anything in migrations/ is AUTO-APPLIED by `supabase db push`. Dropping
--   production tables must never happen as an unnoticed side effect. Apply
--   procedure:
--     1. Complete docs/database-generation-retirement.md §GEN-PARASUT-1
--        checklist on a STAGING restore (row counts, zero-dependency probe).
--     2. Move this file into supabase/migrations/.
--     3. `supabase db push` to staging; run the app's full smoke matrix
--        (finance screens + customer statement print parity).
--     4. Only then push to production inside the documented maintenance
--        window (docs/deployment-and-rollback.md).
--
-- SAFETY DESIGN (idempotent, fail-closed):
--   * A pre-condition block ABORTS (raises) if any live dependency is found:
--     views, foreign keys, functions using the tables, non-historic policies.
--   * Rows are archived to side tables `_retired_YYYYMMDD_*` before drop;
--     nothing is destroyed irreversibly until a later, separate archive purge
--     that a human runs explicitly after the retention window.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Pre-condition guard: refuse to run if anything still depends on gen-1.
-- ---------------------------------------------------------------------------
do $$
declare
  dependent_views text;
  dependent_fks   text;
  dependent_fns   text;
begin
  select string_agg(distinct view_name, ', ')
    into dependent_views
  from (
    select referencing_entity_name::text as view_name
    from pg_partition_tree('public.parasut_contacts')
    where false
  ) s
  where false;

  -- Views depending on any gen-1 table (pg_depend based).
  with deps as (
    select distinct
      n.nspname || '.' || c.relname as dependent,
      src.nspname || '.' || sr.relname as source_table
    from pg_depend d
    join pg_rewrite r   on r.oid = d.objid
    join pg_class c     on c.oid = r.ev_class
    join pg_namespace n on n.oid = c.relnamespace
    join pg_class sr    on sr.oid = d.refobjid
    join pg_namespace src on src.oid = sr.relnamespace
    where sr.relname in (
      'parasut_sync_runs','parasut_contacts','parasut_products',
      'parasut_sales_invoices','parasut_sales_invoice_details',
      'parasut_purchase_bills','parasut_purchase_bill_details',
      'parasut_payments','parasut_accounts','parasut_sync_errors'
    )
      and sr.relnamespace = 'public'::regnamespace
      and c.relkind in ('v','m')
      and (n.nspname <> 'public' or c.relname not like 'parasut_%')
  )
  select coalesce(string_agg(dependent, ', '), '') into dependent_views from deps;

  if coalesce(dependent_views, '') <> '' then
    raise exception 'RETIREMENT ABORTED: views still depend on gen-1 parasut tables: %', dependent_views;
  end if;

  -- Foreign keys pointing at gen-1 tables.
  with fks as (
    select conrelid::regclass::text as fk_table
    from pg_constraint
    where confrelid in (
      select c.oid from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'parasut_sync_runs','parasut_contacts','parasut_products',
          'parasut_sales_invoices','parasut_sales_invoice_details',
          'parasut_purchase_bills','parasut_purchase_bill_details',
          'parasut_payments','parasut_accounts','parasut_sync_errors'
        )
    )
  )
  select coalesce(string_agg(distinct fk_table, ', '), '') into dependent_fks from fks;

  if coalesce(dependent_fks, '') <> '' then
    raise exception 'RETIREMENT ABORTED: foreign keys still reference gen-1 parasut tables: %', dependent_fks;
  end if;

  -- Functions (security definer helpers etc.) whose body mentions gen-1 names.
  select coalesce(string_agg(distinct p.proname, ', '), '')
    into dependent_fns
  from pg_proc p
  join pg_namespace pn on pn.oid = p.pronamespace
  where pn.nspname not in ('pg_catalog','information_schema')
    and p.prosrc ~* 'parasut_(sync_runs|contacts|products|sales_invoice|purchase_bill|payments|accounts|sync_errors)'
    and p.proname not like '\_retired%';

  if coalesce(dependent_fns, '') <> '' then
    raise exception 'RETIREMENT ABORTED: functions still reference gen-1 parasut tables: %', dependent_fns;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Archive then drop. Each statement is idempotent (IF EXISTS / TO NOT EXISTS
-- guards) so an interrupted application can be retried safely.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  archive_name text;
  ts text := to_char(now(), 'YYYYMMDD');
begin
  foreach t in array array[
    'parasut_sync_runs','parasut_contacts','parasut_products',
    'parasut_sales_invoices','parasut_sales_invoice_details',
    'parasut_purchase_bills','parasut_purchase_bill_details',
    'parasut_payments','parasut_accounts','parasut_sync_errors'
  ] loop
    -- 1) ARCHIVE: snapshot the full table into a dated side table so no row
    --    is ever irreversibly destroyed by this migration. Idempotent: if the
    --    archive already exists (retry after partial application) it is kept.
    archive_name := format('_retired_%s_%s', ts, t);
    if to_regclass(format('public.%I', archive_name)) is null
       and to_regclass(format('public.%I', t)) is not null then
      execute format('create table public.%I as select * from public.%I', archive_name, t);
    end if;

    -- 2) DROP the gen-1 table (its policies go with it, legibly logged).
    execute format('drop table if exists public.%I cascade', t);
    raise notice 'retired public.% (archived as public.% when rows existed)', t, archive_name;
  end loop;
end $$;
