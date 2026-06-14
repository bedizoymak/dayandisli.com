-- Phase 2: read-only Paraşüt mirror database foundation.
-- This migration is additive and does not modify ERP domain tables.

create table public.parasut_sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
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

create table public.parasut_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'contacts'),
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
);

create table public.parasut_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'products'),
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
);

create table public.parasut_sales_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'sales_invoices'),
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
);

create table public.parasut_sales_invoice_details (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'sales_invoice_details'),
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
);

create table public.parasut_purchase_bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'purchase_bills'),
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
);

create table public.parasut_purchase_bill_details (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'purchase_bill_details'),
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
);

create table public.parasut_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'payments'),
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
);

create table public.parasut_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'accounts'),
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
);

create table public.parasut_sync_errors (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.parasut_sync_runs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
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

create index parasut_sync_runs_company_resource_started_idx
  on public.parasut_sync_runs (company_id, resource_type, started_at desc);

create index parasut_sync_errors_run_occurred_idx
  on public.parasut_sync_errors (sync_run_id, occurred_at);

create index parasut_sync_errors_company_resource_occurred_idx
  on public.parasut_sync_errors (company_id, resource_type, occurred_at desc);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'parasut_contacts',
    'parasut_products',
    'parasut_sales_invoices',
    'parasut_sales_invoice_details',
    'parasut_purchase_bills',
    'parasut_purchase_bill_details',
    'parasut_payments',
    'parasut_accounts'
  ]
  loop
    execute format(
      'create index %I on public.%I (company_id, source_updated_at desc)',
      target_table || '_company_source_updated_idx',
      target_table
    );
    execute format(
      'create index %I on public.%I (company_id, last_seen_at desc)',
      target_table || '_company_last_seen_idx',
      target_table
    );
  end loop;

  foreach target_table in array array[
    'parasut_contacts',
    'parasut_products',
    'parasut_sales_invoices',
    'parasut_purchase_bills',
    'parasut_accounts'
  ]
  loop
    execute format(
      'create index %I on public.%I (company_id, source_archived) where source_archived = true',
      target_table || '_archived_idx',
      target_table
    );
  end loop;
end $$;

do $$
declare
  target_table text;
begin
  if to_regprocedure('public.erp_set_updated_at()') is null then
    raise exception 'Required function public.erp_set_updated_at() is missing';
  end if;

  foreach target_table in array array[
    'parasut_sync_runs',
    'parasut_contacts',
    'parasut_products',
    'parasut_sales_invoices',
    'parasut_sales_invoice_details',
    'parasut_purchase_bills',
    'parasut_purchase_bill_details',
    'parasut_payments',
    'parasut_accounts'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.erp_set_updated_at()',
      target_table || '_set_updated_at',
      target_table
    );
  end loop;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'parasut_sync_runs',
    'parasut_contacts',
    'parasut_products',
    'parasut_sales_invoices',
    'parasut_sales_invoice_details',
    'parasut_purchase_bills',
    'parasut_purchase_bill_details',
    'parasut_payments',
    'parasut_accounts',
    'parasut_sync_errors'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        exists (
          select 1
          from public.admin_users as administrator
          where lower(administrator.email) = lower(auth.jwt() ->> ''email'')
            and administrator.is_active = true
        )
        or exists (
          select 1
          from public.company_memberships as membership
          where membership.company_id = %I.company_id
            and membership.branch_id is null
            and membership.is_company_admin = true
            and membership.is_active = true
            and (
              membership.auth_user_id = (select auth.uid())
              or lower(membership.email) = lower(auth.jwt() ->> ''email'')
            )
        )
      )',
      'parasut_admin_read_' || target_table,
      target_table,
      target_table
    );

    execute format('revoke all on table public.%I from anon', target_table);
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on table public.%I from authenticated',
      target_table
    );
    execute format('grant select on table public.%I to authenticated', target_table);
  end loop;
end $$;
