-- Phase 24: Multi-company, multi-branch and enterprise scalability foundation.
-- This migration is intentionally additive. Existing ERP records remain valid with
-- nullable company and branch ownership until tenant isolation is tightened.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  legal_name text not null,
  trade_name text,
  tax_office text,
  tax_number text,
  status text not null default 'active' check (status in ('active', 'passive', 'suspended')),
  base_currency text not null default 'TRY',
  timezone text not null default 'Europe/Istanbul',
  settings jsonb not null default '{}'::jsonb,
  primary_admin_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'passive', 'closed')),
  manager_email text,
  phone text,
  email text,
  address_line text,
  city text,
  country text not null default 'Turkiye',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.company_branches(id) on delete set null,
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'passive', 'closed')),
  visibility_scope text not null default 'branch' check (visibility_scope in ('company', 'branch', 'private')),
  address_line text,
  city text,
  manager_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.company_branches(id) on delete cascade,
  erp_user_id uuid references public.erp_users(id) on delete set null,
  auth_user_id uuid,
  email text not null,
  role text not null default 'viewer',
  is_company_admin boolean not null default false,
  is_branch_manager boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_memberships_company_email_branch_idx
  on public.company_memberships (company_id, lower(email), coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists company_branches_company_id_idx on public.company_branches(company_id);
create index if not exists warehouses_company_id_idx on public.warehouses(company_id);
create index if not exists warehouses_branch_id_idx on public.warehouses(branch_id);
create index if not exists company_memberships_company_id_idx on public.company_memberships(company_id);
create index if not exists company_memberships_branch_id_idx on public.company_memberships(branch_id);
create index if not exists company_memberships_email_idx on public.company_memberships(lower(email));

insert into public.companies (code, legal_name, trade_name, primary_admin_email)
values ('DAYAN', 'Dayan Disli', 'Dayan Disli', 'info@dayandisli.com')
on conflict (code) do nothing;

insert into public.company_branches (company_id, code, name, city)
select id, 'MERKEZ', 'Merkez Sube', 'Istanbul'
from public.companies
where code = 'DAYAN'
on conflict (company_id, code) do nothing;

insert into public.warehouses (company_id, branch_id, code, name, visibility_scope, city)
select c.id, b.id, 'MERKEZ', 'Merkez Depo', 'branch', b.city
from public.companies c
join public.company_branches b on b.company_id = c.id and b.code = 'MERKEZ'
where c.code = 'DAYAN'
on conflict (company_id, code) do nothing;

alter table if exists public.erp_users add column if not exists default_company_id uuid references public.companies(id) on delete set null;
alter table if exists public.erp_users add column if not exists default_branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.erp_users add column if not exists accessible_company_ids uuid[] not null default '{}'::uuid[];
alter table if exists public.erp_users add column if not exists accessible_branch_ids uuid[] not null default '{}'::uuid[];
create index if not exists erp_users_default_company_id_idx on public.erp_users(default_company_id);
create index if not exists erp_users_default_branch_id_idx on public.erp_users(default_branch_id);

alter table if exists public.erp_audit_logs add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.erp_audit_logs add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.erp_notifications add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.erp_notifications add column if not exists branch_id uuid references public.company_branches(id) on delete set null;

alter table if exists public.stakeholders add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.stakeholders add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.crm_leads add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.crm_leads add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.crm_opportunities add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.crm_opportunities add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.crm_tasks add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.crm_tasks add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.sales_orders add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.sales_orders add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.purchase_orders add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.purchase_orders add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.work_orders add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.work_orders add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.inventory_items add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.inventory_items add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.inventory_items add column if not exists default_warehouse_id uuid references public.warehouses(id) on delete set null;
alter table if exists public.inventory_movements add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.inventory_movements add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.inventory_movements add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;
alter table if exists public.financial_accounts add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.financial_accounts add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.invoices add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.invoices add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.payments add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.payments add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.employees add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.employees add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.shipments add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.shipments add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.quality_reports add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.quality_reports add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.maintenance_tasks add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.maintenance_tasks add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.orders add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.orders add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.products add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.products add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.products add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;
alter table if exists public.shop_payment_statuses add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.shop_payment_statuses add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.payment_provider_events add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.payment_provider_events add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.payment_reconciliation_logs add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.payment_reconciliation_logs add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.accounting_entries add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.accounting_entries add column if not exists branch_id uuid references public.company_branches(id) on delete set null;
alter table if exists public.payment_refund_operations add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table if exists public.payment_refund_operations add column if not exists branch_id uuid references public.company_branches(id) on delete set null;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'erp_audit_logs', 'erp_notifications', 'stakeholders', 'crm_leads', 'crm_opportunities',
    'crm_tasks', 'sales_orders', 'purchase_orders', 'work_orders', 'inventory_items', 'inventory_movements',
    'financial_accounts', 'invoices', 'payments', 'employees', 'shipments', 'quality_reports',
    'maintenance_tasks', 'orders', 'products', 'shop_payment_statuses', 'payment_provider_events',
    'payment_reconciliation_logs', 'accounting_entries', 'payment_refund_operations'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('create index if not exists %I on public.%I(company_id)', target_table || '_company_id_idx', target_table);
      execute format('create index if not exists %I on public.%I(branch_id)', target_table || '_branch_id_idx', target_table);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.erp_set_updated_at()') is not null then
    drop trigger if exists companies_set_updated_at on public.companies;
    create trigger companies_set_updated_at before update on public.companies for each row execute function public.erp_set_updated_at();
    drop trigger if exists company_branches_set_updated_at on public.company_branches;
    create trigger company_branches_set_updated_at before update on public.company_branches for each row execute function public.erp_set_updated_at();
    drop trigger if exists warehouses_set_updated_at on public.warehouses;
    create trigger warehouses_set_updated_at before update on public.warehouses for each row execute function public.erp_set_updated_at();
    drop trigger if exists company_memberships_set_updated_at on public.company_memberships;
    create trigger company_memberships_set_updated_at before update on public.company_memberships for each row execute function public.erp_set_updated_at();
  end if;
end $$;

alter table public.companies enable row level security;
alter table public.company_branches enable row level security;
alter table public.warehouses enable row level security;
alter table public.company_memberships enable row level security;

drop policy if exists "Admin users can manage companies" on public.companies;
create policy "Admin users can manage companies"
on public.companies
for all
using (exists (select 1 from public.admin_users au where au.email = auth.jwt() ->> 'email' and au.is_active = true))
with check (exists (select 1 from public.admin_users au where au.email = auth.jwt() ->> 'email' and au.is_active = true));

drop policy if exists "Admin users can manage branches" on public.company_branches;
create policy "Admin users can manage branches"
on public.company_branches
for all
using (exists (select 1 from public.admin_users au where au.email = auth.jwt() ->> 'email' and au.is_active = true))
with check (exists (select 1 from public.admin_users au where au.email = auth.jwt() ->> 'email' and au.is_active = true));

drop policy if exists "Admin users can manage warehouses" on public.warehouses;
create policy "Admin users can manage warehouses"
on public.warehouses
for all
using (exists (select 1 from public.admin_users au where au.email = auth.jwt() ->> 'email' and au.is_active = true))
with check (exists (select 1 from public.admin_users au where au.email = auth.jwt() ->> 'email' and au.is_active = true));

drop policy if exists "Admin users can manage memberships" on public.company_memberships;
create policy "Admin users can manage memberships"
on public.company_memberships
for all
using (exists (select 1 from public.admin_users au where au.email = auth.jwt() ->> 'email' and au.is_active = true))
with check (exists (select 1 from public.admin_users au where au.email = auth.jwt() ->> 'email' and au.is_active = true));

drop policy if exists "Users can read own memberships" on public.company_memberships;
create policy "Users can read own memberships"
on public.company_memberships
for select
using (lower(email) = lower(auth.jwt() ->> 'email'));
