-- Paraşüt API mirror layer: greenfield schema creation.
--
-- This migration creates a dedicated `parasut` schema for read-only mirror
-- copies of Paraşüt API resources, and a dedicated `integration` schema for
-- sync infrastructure (run logs, error logs) that is NOT itself mirrored
-- API data. It does not create, rename, or depend on any public.parasut_*
-- tables, and it does not touch public.erp_users, public.machines, or any
-- other ERP canonical table.
--
-- Table names under `parasut` are taken verbatim from confirmed Paraşüt
-- JSON:API `type` values / endpoint segments used by server/parasut/*:
-- contacts, products, sales_invoices, sales_invoice_details,
-- purchase_bills, purchase_bill_details, payments, accounts.
-- See PARASUT_SCHEMA_AUDIT_REPORT.md for the discovery trail.

create schema if not exists parasut;
create schema if not exists integration;

-- Neither schema is added to Supabase's exposed API schema list (only
-- `public` is exposed by default), so PostgREST/the frontend cannot reach
-- these tables regardless of RLS. RLS is still enabled below as
-- defense-in-depth, with no policies granted to anon/authenticated —
-- access is service-role only.

-- ---------------------------------------------------------------------
-- integration.sync_runs / integration.sync_errors: sync infrastructure.
-- Kept structurally separate from resource mirror tables per requirement
-- that sync logs/cursors/errors must not be mixed into resource tables.
-- ---------------------------------------------------------------------

create table integration.sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_company_id text not null,
  resource_type text not null,
  trigger_type text not null,
  status text not null check (status in ('running', 'completed', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  page_count integer not null default 0 check (page_count >= 0),
  records_observed integer not null default 0 check (records_observed >= 0),
  records_inserted integer not null default 0 check (records_inserted >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  records_unchanged integer not null default 0 check (records_unchanged >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  request_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(request_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at)
);

create table integration.sync_errors (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references integration.sync_runs(id) on delete cascade,
  company_id uuid not null,
  parasut_company_id text not null,
  resource_type text not null,
  parasut_id text,
  http_status integer check (http_status is null or http_status between 100 and 599),
  error_code text,
  sanitized_message text not null,
  retryable boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index sync_runs_company_resource_started_idx
  on integration.sync_runs (company_id, resource_type, started_at desc);

create index sync_errors_run_occurred_idx
  on integration.sync_errors (sync_run_id, occurred_at);

create index sync_errors_company_resource_occurred_idx
  on integration.sync_errors (company_id, resource_type, occurred_at desc);

-- ---------------------------------------------------------------------
-- parasut.<resource>: one table per confirmed Paraşüt API resource.
-- Common envelope shape preserves: external id, resource type, full
-- attributes/relationships, raw payload, source timestamps, archive
-- state, local sync bookkeeping, and a payload hash for idempotent
-- upsert. Table names match the API resource name exactly.
-- ---------------------------------------------------------------------

do $$
declare
  resource_name text;
begin
  foreach resource_name in array array[
    'contacts',
    'products',
    'sales_invoices',
    'sales_invoice_details',
    'purchase_bills',
    'purchase_bill_details',
    'payments',
    'accounts'
  ]
  loop
    execute format(
      $sql$
      create table parasut.%I (
        id uuid primary key default gen_random_uuid(),
        company_id uuid not null,
        parasut_id text not null,
        parasut_company_id text not null,
        resource_type text not null check (resource_type = %L),
        attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
        relationships jsonb not null default '{}'::jsonb check (jsonb_typeof(relationships) = 'object'),
        included jsonb not null default '[]'::jsonb check (jsonb_typeof(included) = 'array'),
        raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
        source_created_at timestamptz,
        source_updated_at timestamptz,
        source_archived boolean,
        first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now(),
        synced_at timestamptz not null default now(),
        payload_hash text not null check (payload_hash <> ''),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (parasut_company_id, resource_type, parasut_id)
      )
      $sql$,
      resource_name,
      resource_name
    );

    execute format(
      'create index %I on parasut.%I (company_id, source_updated_at desc)',
      resource_name || '_company_source_updated_idx',
      resource_name
    );
    execute format(
      'create index %I on parasut.%I (company_id, last_seen_at desc)',
      resource_name || '_company_last_seen_idx',
      resource_name
    );
  end loop;

  -- Archive-state partial index only applies to top-level directly-synced
  -- resources (not included-only detail/payment rows, though the column
  -- exists on all tables should the API ever supply archived state there).
  foreach resource_name in array array[
    'contacts',
    'products',
    'sales_invoices',
    'purchase_bills',
    'accounts'
  ]
  loop
    execute format(
      'create index %I on parasut.%I (company_id, source_archived) where source_archived = true',
      resource_name || '_archived_idx',
      resource_name
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- updated_at triggers (reuses the existing shared trigger function).
-- ---------------------------------------------------------------------

do $$
declare
  target_table text;
begin
  if to_regprocedure('public.erp_set_updated_at()') is null then
    raise exception 'Required function public.erp_set_updated_at() is missing';
  end if;

  foreach target_table in array array['sync_runs']
  loop
    execute format(
      'create trigger %I before update on integration.%I for each row execute function public.erp_set_updated_at()',
      target_table || '_set_updated_at',
      target_table
    );
  end loop;

  foreach target_table in array array[
    'contacts',
    'products',
    'sales_invoices',
    'sales_invoice_details',
    'purchase_bills',
    'purchase_bill_details',
    'payments',
    'accounts'
  ]
  loop
    execute format(
      'create trigger %I before update on parasut.%I for each row execute function public.erp_set_updated_at()',
      target_table || '_set_updated_at',
      target_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RLS: backend/service-role controlled by default. Neither `parasut` nor
-- `integration` is a PostgREST-exposed schema (only `public` is exposed
-- via Supabase's default `db.schemas` config), so the frontend cannot
-- reach these tables through the API regardless of RLS. RLS is enabled
-- here as defense-in-depth with an explicit default-deny posture: no
-- policies are granted to `anon` or `authenticated`, and both roles have
-- all privileges revoked. Only `service_role` (used by server code /
-- edge functions) can read or write.
-- ---------------------------------------------------------------------

do $$
declare
  target_schema text;
  target_table text;
begin
  for target_schema, target_table in
    select *
    from unnest(
      array['integration', 'integration',
            'parasut', 'parasut', 'parasut', 'parasut',
            'parasut', 'parasut', 'parasut', 'parasut'],
      array['sync_runs', 'sync_errors',
            'contacts', 'products', 'sales_invoices', 'sales_invoice_details',
            'purchase_bills', 'purchase_bill_details', 'payments', 'accounts']
    ) as pair(schema_name, table_name)
  loop
    execute format('alter table %I.%I enable row level security', target_schema, target_table);
    execute format('revoke all on table %I.%I from anon', target_schema, target_table);
    execute format('revoke all on table %I.%I from authenticated', target_schema, target_table);
    execute format('grant all on table %I.%I to service_role', target_schema, target_table);
  end loop;
end $$;

grant usage on schema parasut to service_role;
grant usage on schema integration to service_role;
revoke all on schema parasut from anon, authenticated;
revoke all on schema integration from anon, authenticated;
