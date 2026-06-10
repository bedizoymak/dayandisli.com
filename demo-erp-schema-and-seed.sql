-- DAYAN Disli ERP demo schema and seed.
-- Paste into Supabase SQL Editor if demo tables are missing.
-- This is additive: no DROP, TRUNCATE, DELETE, or service-role secret usage.

begin;

create extension if not exists pgcrypto;

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

insert into public.erp_audit_logs (id, actor_email, company_id, branch_id, entity_type, entity_id, action, description, metadata)
values ('00000000-0000-4000-8000-100000001101', 'demo-seed@dayandisli.com', '00000000-0000-4000-8000-100000000001', '00000000-0000-4000-8000-100000000002', 'demo', '00000000-0000-4000-8000-100000000301', 'demo_seed_applied', 'Demo ERP seed verisi uygulandi.', '{"source":"demo-erp-schema-and-seed.sql"}'::jsonb)
on conflict (id) do update set created_at = now(), description = excluded.description;

insert into public.erp_notifications (id, title, body, severity, category, entity_type, action_url, is_read)
values ('00000000-0000-4000-8000-100000001102', 'Demo verisi hazir', 'ERP demo kayitlari Supabase uzerinde hazirlandi.', 'success', 'system', 'demo', '/dashboard', false)
on conflict (id) do update set is_read = false, body = excluded.body;

commit;
