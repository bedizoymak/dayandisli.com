-- DAYAN Disli ERP demo schema and seed.
-- Paste into Supabase SQL Editor if demo tables are missing.
-- This is additive: no DROP, TRUNCATE, DELETE, or service-role secret usage.

begin;

create extension if not exists pgcrypto;

-- This file matches the ERP readiness check in src/features/erp/shared/erpApi.ts.
-- The app checks these exact public table names:
-- admin_users, companies, company_branches, warehouses, company_memberships,
-- erp_users, stakeholders, erp_quotation_links, quotations, sales_orders,
-- sales_order_items, machines, production_routes, production_route_steps,
-- work_orders, work_order_operations, subcontracting_jobs, documents,
-- inventory_items, inventory_movements, measuring_tools, financial_accounts,
-- invoices, payments, products, orders, order_items, shop_categories,
-- shop_campaigns, shop_carts, shop_payment_statuses, website_pages,
-- website_seo_settings, website_menu_items, website_media_assets,
-- website_forms, website_form_submissions, website_banners, employees,
-- hr_departments, hr_positions, employee_time_entries, hr_leave_requests,
-- hr_recruitment_candidates, hr_onboarding_tasks, employee_assets, shipments,
-- shipment_items, quality_reports, quality_measurements, maintenance_tasks,
-- erp_number_sequences, erp_audit_logs, erp_notifications, platform_metrics,
-- platform_events, platform_alerts, scheduled_job_runs, automation_rules,
-- automation_executions, purchase_orders, purchase_order_items.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.erp_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  email text not null unique,
  full_name text,
  role text not null default 'viewer',
  roles text[],
  permissions text[],
  department text,
  default_company_id uuid,
  default_branch_id uuid,
  accessible_company_ids uuid[],
  accessible_branch_ids uuid[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  legal_name text not null,
  trade_name text,
  tax_office text,
  tax_number text,
  status text not null default 'active',
  base_currency text not null default 'TRY',
  timezone text not null default 'Europe/Istanbul',
  settings jsonb not null default '{}'::jsonb,
  primary_admin_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  code text not null,
  name text not null,
  status text not null default 'active',
  manager_email text,
  phone text,
  email text,
  address_line text,
  city text,
  country text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  erp_user_id uuid,
  auth_user_id uuid,
  email text not null,
  role text not null default 'viewer',
  is_company_admin boolean not null default false,
  is_branch_manager boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  code text not null,
  name text not null,
  status text not null default 'active',
  visibility_scope text not null default 'company',
  address_line text,
  city text,
  manager_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  type text not null default 'customer',
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  tax_office text,
  tax_number text,
  address text,
  city text,
  country text,
  risk_limit numeric not null default 0,
  current_balance numeric not null default 0,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  teklif_no text not null,
  firma text not null,
  ilgili_kisi text,
  tel text,
  email text,
  konu text,
  products jsonb,
  subtotal numeric not null default 0,
  kdv numeric not null default 0,
  total numeric not null default 0,
  active_currency text not null default 'TRY',
  created_at timestamptz not null default now()
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  order_no text not null unique,
  stakeholder_id uuid,
  source_quotation_id uuid,
  title text not null,
  description text,
  status text not null default 'new',
  priority text not null default 'normal',
  order_date date not null default current_date,
  due_date date,
  currency text not null default 'TRY',
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  grand_total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null,
  item_code text,
  description text not null,
  quantity numeric not null default 1,
  unit text not null default 'adet',
  unit_price numeric not null default 0,
  total numeric not null default 0,
  technical_drawing_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  machine_type text,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.production_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_template boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.production_route_steps (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null,
  step_no integer not null,
  operation_name text not null,
  machine_id uuid,
  estimated_minutes integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  work_order_no text not null unique,
  sales_order_id uuid,
  stakeholder_id uuid,
  title text not null,
  part_name text,
  part_code text,
  quantity numeric not null default 1,
  status text not null default 'planned',
  priority text not null default 'normal',
  planned_start_date date,
  planned_end_date date,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_order_operations (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null,
  step_no integer not null,
  operation_name text not null,
  machine_id uuid,
  assigned_employee_id uuid,
  status text not null default 'pending',
  planned_minutes integer not null default 0,
  actual_minutes integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  quality_required boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  item_type text not null default 'raw_material',
  code text,
  name text not null,
  description text,
  unit text not null default 'adet',
  current_stock numeric not null default 0,
  min_stock numeric not null default 0,
  location text,
  supplier_id uuid,
  unit_cost numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  inventory_item_id uuid not null,
  movement_type text not null,
  quantity numeric not null,
  source_type text,
  source_id uuid,
  movement_date timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  account_type text not null default 'bank',
  name text not null,
  currency text not null default 'TRY',
  opening_balance numeric not null default 0,
  current_balance numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  invoice_type text not null default 'sales',
  invoice_no text,
  stakeholder_id uuid,
  invoice_date date not null default current_date,
  due_date date,
  currency text not null default 'TRY',
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  grand_total numeric not null default 0,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  payment_type text not null default 'collection',
  stakeholder_id uuid,
  financial_account_id uuid,
  amount numeric not null,
  currency text not null default 'TRY',
  payment_date date not null default current_date,
  description text,
  related_invoice_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  employee_no text,
  full_name text not null,
  role text,
  department text,
  department_id uuid,
  position_id uuid,
  manager_employee_id uuid,
  erp_user_id uuid,
  status text not null default 'active',
  phone text,
  email text,
  hire_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  purchase_order_no text not null unique,
  supplier_id uuid,
  title text not null,
  status text not null default 'draft',
  priority text not null default 'normal',
  order_date date not null default current_date,
  expected_date date,
  currency text not null default 'TRY',
  subtotal numeric not null default 0,
  tax_total numeric not null default 0,
  grand_total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.erp_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  company_id uuid,
  branch_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_status text,
  new_status text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.erp_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  body text,
  severity text not null default 'info',
  category text not null default 'system',
  entity_type text,
  entity_id uuid,
  action_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.erp_quotation_links (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid,
  erp_quotation_id uuid,
  sales_order_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.subcontracting_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  job_no text,
  supplier_id uuid,
  work_order_id uuid,
  title text,
  status text not null default 'sent',
  due_date date,
  cost numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  document_type text not null,
  file_name text not null,
  file_path text,
  version_no integer not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.measuring_tools (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text,
  tool_type text,
  calibration_due_date date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  sku text,
  description text,
  price numeric not null default 0,
  currency text not null default 'TRY',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text,
  customer_name text,
  customer_email text,
  status text not null default 'new',
  total numeric not null default 0,
  currency text not null default 'TRY',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  product_id uuid,
  product_name text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  discount_type text,
  discount_value numeric not null default 0,
  status text not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_carts (
  id uuid primary key default gen_random_uuid(),
  customer_email text,
  status text not null default 'active',
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_payment_statuses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  provider text,
  status text not null default 'pending',
  amount numeric not null default 0,
  currency text not null default 'TRY',
  created_at timestamptz not null default now()
);

create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  content text,
  status text not null default 'published',
  created_at timestamptz not null default now()
);

create table if not exists public.website_seo_settings (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null unique,
  title text,
  description text,
  keywords text,
  created_at timestamptz not null default now()
);

create table if not exists public.website_menu_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  placement text not null default 'header',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.website_media_assets (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_path text,
  media_type text not null default 'image',
  alt_text text,
  usage_area text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.website_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form_key text not null unique,
  target_email text,
  success_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.website_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid,
  form_key text,
  submitter_email text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.website_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_path text,
  link_url text,
  placement text not null default 'home',
  status text not null default 'published',
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  name text not null,
  code text,
  manager_employee_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  department_id uuid,
  title text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid,
  entry_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid,
  leave_type text not null default 'annual',
  start_date date,
  end_date date,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  position_id uuid,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid,
  title text not null,
  status text not null default 'open',
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_assets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid,
  asset_name text not null,
  asset_tag text,
  assigned_at date,
  status text not null default 'assigned',
  created_at timestamptz not null default now()
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  shipment_no text,
  sales_order_id uuid,
  stakeholder_id uuid,
  carrier text,
  tracking_no text,
  status text not null default 'planned',
  shipment_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid,
  description text,
  quantity numeric not null default 1,
  unit text not null default 'adet',
  created_at timestamptz not null default now()
);

create table if not exists public.quality_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  report_no text,
  work_order_id uuid,
  result text not null default 'pending',
  inspector_employee_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.quality_measurements (
  id uuid primary key default gen_random_uuid(),
  quality_report_id uuid,
  metric_name text not null,
  measured_value numeric,
  target_value numeric,
  tolerance text,
  result text not null default 'ok',
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid,
  title text not null,
  status text not null default 'planned',
  planned_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.erp_number_sequences (
  id uuid primary key default gen_random_uuid(),
  sequence_key text not null unique,
  prefix text not null,
  current_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  metric_name text not null,
  metric_value numeric,
  metric_unit text,
  severity text not null default 'info',
  status text not null default 'active',
  source text,
  module text,
  measured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  event_key text,
  title text not null,
  description text,
  severity text not null default 'info',
  status text not null default 'open',
  module text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text,
  title text not null,
  description text,
  severity text not null default 'warning',
  status text not null default 'open',
  module text,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'success',
  severity text not null default 'info',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  retry_count integer not null default 0,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null default 'manual',
  action_type text not null default 'notify',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  automation_rule_id uuid,
  status text not null default 'success',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid,
  inventory_item_id uuid,
  description text not null,
  quantity numeric not null default 1,
  unit text not null default 'adet',
  unit_price numeric not null default 0,
  total numeric not null default 0,
  received_quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.admin_users (email, role, is_active)
select email, 'admin', true
from auth.users
where email is not null
on conflict (email) do update set is_active = true, role = excluded.role;

insert into public.erp_users (auth_user_id, email, full_name, role, roles, permissions, department, is_active)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', email),
  'admin',
  array['admin'],
  array['*'],
  'Yonetim',
  true
from auth.users
where email is not null
on conflict (email) do update set
  auth_user_id = excluded.auth_user_id,
  role = excluded.role,
  roles = excluded.roles,
  permissions = excluded.permissions,
  is_active = true;

insert into public.companies (id, code, legal_name, trade_name, primary_admin_email)
values ('00000000-0000-4000-8000-100000000001', 'DAYAN-DEMO', 'Dayan Disli Demo Sirketi', 'Dayan Disli', 'info@dayandisli.com')
on conflict (id) do update set legal_name = excluded.legal_name, trade_name = excluded.trade_name;

insert into public.company_branches (id, company_id, code, name, city, country)
values ('00000000-0000-4000-8000-100000000002', '00000000-0000-4000-8000-100000000001', 'MRKZ', 'Merkez Uretim', 'Istanbul', 'Turkiye')
on conflict (id) do update set name = excluded.name;

insert into public.warehouses (id, company_id, branch_id, code, name, city)
values ('00000000-0000-4000-8000-100000000003', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'ANA', 'Ana Depo', 'Istanbul')
on conflict (id) do update set name = excluded.name;

insert into public.erp_users (id, email, full_name, role, roles, permissions, department, default_company_id, default_branch_id, accessible_company_ids, accessible_branch_ids, is_active)
values
  ('00000000-0000-4000-8000-100000000011', 'info@dayandisli.com', 'Demo Admin', 'admin', array['admin'], array['crm.view','sales.view','production.view','inventory.view','accounting.view','hr.view','reports.view','settings.view'], 'Yonetim', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', array['00000000-0000-4000-8000-100000000001']::uuid[], array['00000000-0000-4000-8000-100000000002']::uuid[], true),
  ('00000000-0000-4000-8000-100000000012', 'planlama@dayandisli.com', 'Demo Planlama', 'planner', array['planner'], array['sales.view','production.view','inventory.view','quality.view','reports.view'], 'Planlama', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', array['00000000-0000-4000-8000-100000000001']::uuid[], array['00000000-0000-4000-8000-100000000002']::uuid[], true)
on conflict (email) do update
set full_name = excluded.full_name, role = excluded.role, roles = excluded.roles, permissions = excluded.permissions, is_active = true;

insert into public.company_memberships (id, company_id, branch_id, erp_user_id, email, role, is_company_admin, is_branch_manager, is_active)
values
  ('00000000-0000-4000-8000-100000000021', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', '00000000-0000-4000-8000-100000000011', 'info@dayandisli.com', 'admin', true, true, true),
  ('00000000-0000-4000-8000-100000000022', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', '00000000-0000-4000-8000-100000000012', 'planlama@dayandisli.com', 'planner', false, true, true)
on conflict (id) do update set is_active = true, role = excluded.role;

insert into public.stakeholders (id, company_id, branch_id, type, company_name, contact_name, phone, email, city, country, risk_limit, current_balance, notes, is_active)
values
  ('00000000-0000-4000-8000-100000000101', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'customer', '[DEMO] Atlas Makina A.S.', 'Murat Yilmaz', '+90 212 000 00 11', 'demo.customer@example.invalid', 'Istanbul', 'Turkiye', 750000, 125000, 'Demo musteri kaydi.', true),
  ('00000000-0000-4000-8000-100000000102', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'both', '[DEMO] Isil Fason Ltd.', 'Ayse Demir', '+90 262 000 00 22', 'demo.supplier@example.invalid', 'Kocaeli', 'Turkiye', 250000, -42000, 'Demo tedarikci/fason kaydi.', true)
on conflict (id) do update set company_name = excluded.company_name, current_balance = excluded.current_balance, is_active = true;

insert into public.quotations (id, teklif_no, firma, ilgili_kisi, tel, email, konu, products, subtotal, kdv, total, active_currency)
values (
  '00000000-0000-4000-8000-100000000201',
  'TKL-DEMO-2026-001',
  '[DEMO] Atlas Makina A.S.',
  'Murat Yilmaz',
  '+90 212 000 00 11',
  'demo.customer@example.invalid',
  'Helis disli seti demo teklifi',
  '[{"kod":"DG-HL-001","cins":"Helis disli","malzeme":"C45","miktar":2,"birim":"adet","birimFiyat":18500},{"kod":"DG-MIL-002","cins":"Ara mil","malzeme":"42CrMo4","miktar":1,"birim":"adet","birimFiyat":12500}]'::jsonb,
  49500,
  9900,
  59400,
  'TRY'
)
on conflict (id) do update set total = excluded.total, products = excluded.products;

insert into public.sales_orders (id, company_id, branch_id, order_no, stakeholder_id, source_quotation_id, title, description, status, priority, order_date, due_date, currency, subtotal, tax_total, grand_total, notes)
values ('00000000-0000-4000-8000-100000000301', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'SO-DEMO-2026-001', '00000000-0000-4000-8000-100000000101', '00000000-0000-4000-8000-100000000201', 'Helis disli seti demo siparisi', 'Demo siparis kaydi.', 'in_production', 'high', current_date, current_date + 9, 'TRY', 49500, 9900, 59400, 'Demo sunum verisi.')
on conflict (id) do update set status = excluded.status, grand_total = excluded.grand_total;

insert into public.sales_order_items (id, sales_order_id, item_code, description, quantity, unit, unit_price, total)
values ('00000000-0000-4000-8000-100000000302', '00000000-0000-4000-8000-100000000301', 'DG-HL-001', 'Helis disli seti', 2, 'adet', 18500, 37000)
on conflict (id) do update set quantity = excluded.quantity, total = excluded.total;

insert into public.machines (id, code, name, machine_type, location, is_active)
values ('00000000-0000-4000-8000-100000000401', 'CNC-DEMO-01', 'Demo CNC Azdirma', 'Azdirma', 'Uretim Hatti 1', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.production_routes (id, name, description, is_template)
values ('00000000-0000-4000-8000-100000000501', 'Demo Helis Disli Rotasi', 'Torna, azdirma ve kalite kontrol demo akisi.', true)
on conflict (id) do update set name = excluded.name;

insert into public.production_route_steps (id, route_id, step_no, operation_name, machine_id, estimated_minutes, notes)
values
  ('00000000-0000-4000-8000-100000000502', '00000000-0000-4000-8000-100000000501', 10, 'Torna hazirlik', '00000000-0000-4000-8000-100000000401', 90, 'Demo rota adimi.'),
  ('00000000-0000-4000-8000-100000000503', '00000000-0000-4000-8000-100000000501', 20, 'Disli azdirma', '00000000-0000-4000-8000-100000000401', 180, 'Demo rota adimi.')
on conflict (id) do update set operation_name = excluded.operation_name;

insert into public.employees (id, company_id, branch_id, employee_no, full_name, role, department, status, phone, email, hire_date, is_active, notes)
values ('00000000-0000-4000-8000-100000000901', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'PRS-DEMO-001', 'Demo Operator', 'CNC Operatoru', 'Uretim', 'active', '+90 555 000 00 01', 'operator.demo@example.invalid', date '2024-01-15', true, 'Demo personel kaydi.')
on conflict (id) do update set full_name = excluded.full_name, is_active = true;

insert into public.work_orders (id, company_id, branch_id, work_order_no, sales_order_id, stakeholder_id, title, part_name, part_code, quantity, status, priority, planned_start_date, planned_end_date, actual_start_at, notes)
values ('00000000-0000-4000-8000-100000000601', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'WO-DEMO-2026-001', '00000000-0000-4000-8000-100000000301', '00000000-0000-4000-8000-100000000101', 'Helis disli uretim is emri', 'Helis disli', 'DG-HL-001', 2, 'in_progress', 'high', current_date, current_date + 7, now(), 'Demo is emri.')
on conflict (id) do update set status = excluded.status;

insert into public.work_order_operations (id, work_order_id, step_no, operation_name, machine_id, assigned_employee_id, status, planned_minutes, actual_minutes, started_at, completed_at, quality_required, notes)
values
  ('00000000-0000-4000-8000-100000000602', '00000000-0000-4000-8000-100000000601', 10, 'Torna hazirlik', '00000000-0000-4000-8000-100000000401', '00000000-0000-4000-8000-100000000901', 'completed', 90, 86, now() - interval '3 hours', now() - interval '90 minutes', false, 'Demo tamamlanan operasyon.'),
  ('00000000-0000-4000-8000-100000000603', '00000000-0000-4000-8000-100000000601', 20, 'Disli azdirma', '00000000-0000-4000-8000-100000000401', '00000000-0000-4000-8000-100000000901', 'in_progress', 180, 45, now() - interval '45 minutes', null, true, 'Demo devam eden operasyon.')
on conflict (id) do update set status = excluded.status, actual_minutes = excluded.actual_minutes;

insert into public.inventory_items (id, company_id, branch_id, item_type, code, name, description, unit, current_stock, min_stock, location, supplier_id, unit_cost, is_active)
values ('00000000-0000-4000-8000-100000000701', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'raw_material', 'C45-050-DEMO', 'C45 yuvarlak celik 50mm', 'Demo hammadde stogu.', 'kg', 120, 50, 'A-01', '00000000-0000-4000-8000-100000000102', 42.5, true)
on conflict (id) do update set current_stock = excluded.current_stock, min_stock = excluded.min_stock;

insert into public.inventory_movements (id, company_id, branch_id, inventory_item_id, movement_type, quantity, source_type, source_id, notes)
values ('00000000-0000-4000-8000-100000000702', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', '00000000-0000-4000-8000-100000000701', 'in', 120, 'demo_seed', '00000000-0000-4000-8000-100000001001', 'Demo stok girisi.')
on conflict (id) do update set quantity = excluded.quantity;

insert into public.financial_accounts (id, company_id, branch_id, account_type, name, currency, opening_balance, current_balance, is_active)
values ('00000000-0000-4000-8000-100000000801', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'bank', 'Demo Banka Hesabi', 'TRY', 250000, 309400, true)
on conflict (id) do update set current_balance = excluded.current_balance;

insert into public.invoices (id, company_id, branch_id, invoice_type, invoice_no, stakeholder_id, invoice_date, due_date, currency, subtotal, tax_total, grand_total, status, notes)
values ('00000000-0000-4000-8000-100000000802', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'sales', 'INV-DEMO-2026-001', '00000000-0000-4000-8000-100000000101', current_date, current_date + 14, 'TRY', 49500, 9900, 59400, 'issued', 'Demo satis faturasi.')
on conflict (id) do update set status = excluded.status, grand_total = excluded.grand_total;

insert into public.payments (id, company_id, branch_id, payment_type, stakeholder_id, financial_account_id, amount, currency, payment_date, description, related_invoice_id)
values ('00000000-0000-4000-8000-100000000803', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'collection', '00000000-0000-4000-8000-100000000101', '00000000-0000-4000-8000-100000000801', 59400, 'TRY', current_date, 'Demo tahsilat kaydi.', '00000000-0000-4000-8000-100000000802')
on conflict (id) do update set amount = excluded.amount;

insert into public.purchase_orders (id, company_id, branch_id, purchase_order_no, supplier_id, title, status, priority, order_date, expected_date, currency, subtotal, tax_total, grand_total, notes)
values ('00000000-0000-4000-8000-100000001001', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'PO-DEMO-2026-001', '00000000-0000-4000-8000-100000000102', 'C45 hammadde demo satin alma', 'sent', 'normal', current_date, current_date + 3, 'TRY', 51000, 10200, 61200, 'Demo satin alma kaydi.')
on conflict (id) do update set status = excluded.status;

insert into public.purchase_order_items (id, purchase_order_id, inventory_item_id, description, quantity, unit, unit_price, total, received_quantity)
values ('00000000-0000-4000-8000-100000001002', '00000000-0000-4000-8000-100000001001', '00000000-0000-4000-8000-100000000701', 'C45 yuvarlak celik 50mm', 120, 'kg', 425, 51000, 0)
on conflict (id) do update set quantity = excluded.quantity, total = excluded.total;

insert into public.subcontracting_jobs (id, company_id, branch_id, job_no, supplier_id, work_order_id, title, status, due_date, cost, notes)
values ('00000000-0000-4000-8000-100000001201', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'FSN-DEMO-2026-001', '00000000-0000-4000-8000-100000000102', '00000000-0000-4000-8000-100000000601', 'Demo isil islem takibi', 'sent', current_date + 5, 8500, 'Demo fason sureci.')
on conflict (id) do update set status = excluded.status, cost = excluded.cost;

insert into public.shipments (id, company_id, branch_id, shipment_no, sales_order_id, stakeholder_id, carrier, tracking_no, status, shipment_date, notes)
values ('00000000-0000-4000-8000-100000001301', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'SHP-DEMO-2026-001', '00000000-0000-4000-8000-100000000301', '00000000-0000-4000-8000-100000000101', 'Demo Kargo', 'TRK-DEMO-001', 'planned', current_date, 'Demo sevkiyat kaydi.')
on conflict (id) do update set status = excluded.status, tracking_no = excluded.tracking_no;

insert into public.shipment_items (id, shipment_id, description, quantity, unit)
values ('00000000-0000-4000-8000-100000001302', '00000000-0000-4000-8000-100000001301', 'Helis disli seti', 2, 'adet')
on conflict (id) do update set quantity = excluded.quantity;

insert into public.quality_reports (id, company_id, branch_id, report_no, work_order_id, result, inspector_employee_id, notes)
values ('00000000-0000-4000-8000-100000001401', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'QC-DEMO-2026-001', '00000000-0000-4000-8000-100000000601', 'pending', '00000000-0000-4000-8000-100000000901', 'Demo kalite kontrol raporu.')
on conflict (id) do update set result = excluded.result;

insert into public.quality_measurements (id, quality_report_id, metric_name, measured_value, target_value, tolerance, result)
values ('00000000-0000-4000-8000-100000001402', '00000000-0000-4000-8000-100000001401', 'Dis capi', 120.02, 120.00, '+/-0.05', 'ok')
on conflict (id) do update set measured_value = excluded.measured_value, result = excluded.result;

insert into public.maintenance_tasks (id, machine_id, title, status, planned_date, notes)
values ('00000000-0000-4000-8000-100000001501', '00000000-0000-4000-8000-100000000401', 'Demo CNC periyodik bakim', 'planned', current_date + 10, 'Demo bakim plani.')
on conflict (id) do update set status = excluded.status, planned_date = excluded.planned_date;

insert into public.documents (id, entity_type, entity_id, document_type, file_name, file_path, notes)
values ('00000000-0000-4000-8000-100000001601', 'work_order', '00000000-0000-4000-8000-100000000601', 'technical_drawing', 'demo-teknik-resim.pdf', null, 'Demo dokuman kaydi.')
on conflict (id) do update set file_name = excluded.file_name;

insert into public.measuring_tools (id, code, name, tool_type, calibration_due_date, status)
values ('00000000-0000-4000-8000-100000001701', 'OLC-DEMO-001', 'Demo Mikrometre', 'micrometer', current_date + 45, 'active')
on conflict (id) do update set calibration_due_date = excluded.calibration_due_date, status = excluded.status;

insert into public.hr_departments (id, company_id, name, code, is_active)
values ('00000000-0000-4000-8000-100000001801', '00000000-0000-4000-8000-100000000001', 'Uretim', 'URT', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.hr_positions (id, company_id, department_id, title, code, is_active)
values ('00000000-0000-4000-8000-100000001802', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000001801', 'CNC Operatoru', 'CNC-OP', true)
on conflict (id) do update set title = excluded.title, is_active = true;

insert into public.employee_time_entries (id, employee_id, entry_date, check_in, status, notes)
values ('00000000-0000-4000-8000-100000001803', '00000000-0000-4000-8000-100000000901', current_date, now() - interval '4 hours', 'present', 'Demo devam kaydi.')
on conflict (id) do update set entry_date = excluded.entry_date, status = excluded.status;

insert into public.hr_leave_requests (id, employee_id, leave_type, start_date, end_date, status, notes)
values ('00000000-0000-4000-8000-100000001804', '00000000-0000-4000-8000-100000000901', 'annual', current_date + 20, current_date + 22, 'pending', 'Demo izin talebi.')
on conflict (id) do update set status = excluded.status;

insert into public.hr_recruitment_candidates (id, full_name, email, phone, position_id, status, notes)
values ('00000000-0000-4000-8000-100000001805', 'Demo Aday', 'aday.demo@example.invalid', '+90 555 000 00 02', '00000000-0000-4000-8000-100000001802', 'interview', 'Demo ise alim adayi.')
on conflict (id) do update set status = excluded.status;

insert into public.hr_onboarding_tasks (id, employee_id, title, status, due_date)
values ('00000000-0000-4000-8000-100000001806', '00000000-0000-4000-8000-100000000901', 'Demo is guvenligi egitimi', 'open', current_date + 2)
on conflict (id) do update set status = excluded.status;

insert into public.employee_assets (id, employee_id, asset_name, asset_tag, assigned_at, status)
values ('00000000-0000-4000-8000-100000001807', '00000000-0000-4000-8000-100000000901', 'Demo Laptop', 'ASSET-DEMO-001', current_date, 'assigned')
on conflict (id) do update set status = excluded.status;

insert into public.products (id, name, slug, sku, description, price, currency, is_active)
values ('00000000-0000-4000-8000-100000001901', 'Demo Helis Disli', 'demo-helis-disli', 'SHOP-DEMO-001', 'Demo e-ticaret urunu.', 18500, 'TRY', true)
on conflict (id) do update set price = excluded.price, is_active = true;

insert into public.orders (id, order_no, customer_name, customer_email, status, total, currency)
values ('00000000-0000-4000-8000-100000001902', 'WEB-DEMO-2026-001', 'Demo Web Musteri', 'web.demo@example.invalid', 'paid', 18500, 'TRY')
on conflict (id) do update set status = excluded.status, total = excluded.total;

insert into public.order_items (id, order_id, product_id, product_name, quantity, unit_price, total)
values ('00000000-0000-4000-8000-100000001903', '00000000-0000-4000-8000-100000001902', '00000000-0000-4000-8000-100000001901', 'Demo Helis Disli', 1, 18500, 18500)
on conflict (id) do update set quantity = excluded.quantity, total = excluded.total;

insert into public.shop_categories (id, name, slug, description, is_active, sort_order)
values ('00000000-0000-4000-8000-100000001904', 'Demo Disliler', 'demo-disliler', 'Demo kategori.', true, 1)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.shop_campaigns (id, name, description, discount_type, discount_value, status, starts_at, ends_at)
values ('00000000-0000-4000-8000-100000001905', 'Demo Kampanya', 'Demo sunum kampanyasi.', 'percent', 10, 'active', now() - interval '1 day', now() + interval '30 days')
on conflict (id) do update set status = excluded.status;

insert into public.shop_carts (id, customer_email, status, total)
values ('00000000-0000-4000-8000-100000001906', 'web.demo@example.invalid', 'active', 18500)
on conflict (id) do update set total = excluded.total;

insert into public.shop_payment_statuses (id, order_id, provider, status, amount, currency)
values ('00000000-0000-4000-8000-100000001907', '00000000-0000-4000-8000-100000001902', 'demo', 'paid', 18500, 'TRY')
on conflict (id) do update set status = excluded.status, amount = excluded.amount;

insert into public.website_pages (id, slug, title, summary, content, status)
values ('00000000-0000-4000-8000-100000002001', 'demo-erp', 'Demo ERP Sayfasi', 'Demo CMS kaydi.', 'ERP demo icerigi.', 'published')
on conflict (id) do update set title = excluded.title, status = excluded.status;

insert into public.website_seo_settings (id, page_slug, title, description, keywords)
values ('00000000-0000-4000-8000-100000002002', 'demo-erp', 'Demo ERP', 'Demo SEO kaydi.', 'demo,erp')
on conflict (id) do update set title = excluded.title;

insert into public.website_menu_items (id, label, url, placement, sort_order, is_active)
values ('00000000-0000-4000-8000-100000002003', 'Demo ERP', '/sayfa/demo-erp', 'header', 99, true)
on conflict (id) do update set label = excluded.label, is_active = true;

insert into public.website_media_assets (id, file_name, file_path, media_type, alt_text, usage_area, is_public)
values ('00000000-0000-4000-8000-100000002004', 'demo-erp.jpg', null, 'image', 'Demo ERP', 'demo', true)
on conflict (id) do update set file_name = excluded.file_name;

insert into public.website_forms (id, name, form_key, target_email, success_message, is_active)
values ('00000000-0000-4000-8000-100000002005', 'Demo Iletisim Formu', 'demo_contact', 'info@dayandisli.com', 'Tesekkurler.', true)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.website_form_submissions (id, form_id, form_key, submitter_email, payload, status)
values ('00000000-0000-4000-8000-100000002006', '00000000-0000-4000-8000-100000002005', 'demo_contact', 'web.demo@example.invalid', '{"message":"Demo form kaydi"}'::jsonb, 'new')
on conflict (id) do update set status = excluded.status;

insert into public.website_banners (id, title, subtitle, image_path, link_url, placement, status, sort_order)
values ('00000000-0000-4000-8000-100000002007', 'Demo Banner', 'ERP demo hazir.', null, '/apps', 'home', 'published', 1)
on conflict (id) do update set title = excluded.title, status = excluded.status;

insert into public.erp_quotation_links (id, quotation_id, erp_quotation_id, sales_order_id)
values ('00000000-0000-4000-8000-100000002101', '00000000-0000-4000-8000-100000000201', '00000000-0000-4000-8000-100000000201', '00000000-0000-4000-8000-100000000301')
on conflict (id) do update set sales_order_id = excluded.sales_order_id;

insert into public.erp_number_sequences (id, sequence_key, prefix, current_value)
values
  ('00000000-0000-4000-8000-100000002201', 'SALES_ORDER', 'SO', 1),
  ('00000000-0000-4000-8000-100000002202', 'WORK_ORDER', 'WO', 1),
  ('00000000-0000-4000-8000-100000002203', 'PURCHASE_ORDER', 'PO', 1)
on conflict (id) do update set current_value = excluded.current_value;

insert into public.platform_metrics (id, metric_key, metric_name, metric_value, metric_unit, severity, status, source, module, metadata)
values ('00000000-0000-4000-8000-100000002301', 'demo_health', 'Demo sistem sagligi', 100, 'percent', 'info', 'active', 'demo_seed', 'operations', '{"demo":true}'::jsonb)
on conflict (id) do update set metric_value = excluded.metric_value;

insert into public.platform_events (id, event_key, title, description, severity, status, module, metadata)
values ('00000000-0000-4000-8000-100000002302', 'demo_event', 'Demo olay kaydi', 'Demo operasyon olayi.', 'info', 'open', 'operations', '{"demo":true}'::jsonb)
on conflict (id) do update set title = excluded.title;

insert into public.platform_alerts (id, alert_key, title, description, severity, status, module)
values ('00000000-0000-4000-8000-100000002303', 'demo_alert', 'Demo uyari', 'Demo izleme uyarisi.', 'warning', 'open', 'operations')
on conflict (id) do update set status = excluded.status;

insert into public.scheduled_job_runs (id, job_type, status, severity, completed_at, retry_count, summary, metadata)
values ('00000000-0000-4000-8000-100000002304', 'demo_smoke_check', 'success', 'info', now(), 0, 'Demo smoke check basarili.', '{"demo":true}'::jsonb)
on conflict (id) do update set status = excluded.status, completed_at = now();

insert into public.automation_rules (id, name, trigger_type, action_type, is_active, metadata)
values ('00000000-0000-4000-8000-100000002305', 'Demo bildirim otomasyonu', 'manual', 'notify', true, '{"demo":true}'::jsonb)
on conflict (id) do update set is_active = true;

insert into public.automation_executions (id, automation_rule_id, status, completed_at, summary, metadata)
values ('00000000-0000-4000-8000-100000002306', '00000000-0000-4000-8000-100000002305', 'success', now(), 'Demo otomasyon calisti.', '{"demo":true}'::jsonb)
on conflict (id) do update set status = excluded.status, completed_at = now();

insert into public.erp_audit_logs (id, actor_email, company_id, branch_id, entity_type, entity_id, action, description, metadata)
values ('00000000-0000-4000-8000-100000001101', 'demo-seed@dayandisli.com', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'demo', '00000000-0000-4000-8000-100000000301', 'demo_seed_applied', 'Demo ERP seed verisi uygulandi.', '{"source":"demo-erp-schema-and-seed.sql"}'::jsonb)
on conflict (id) do update set created_at = now(), description = excluded.description;

insert into public.erp_notifications (id, title, body, severity, category, entity_type, action_url, is_read)
values ('00000000-0000-4000-8000-100000001102', 'Demo verisi hazir', 'ERP demo kayitlari Supabase uzerinde hazirlandi.', 'success', 'system', 'demo', '/dashboard', false)
on conflict (id) do update set is_read = false, body = excluded.body;

commit;
