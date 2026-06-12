-- ERP core schema (additive only)
-- WARNING: This migration does not drop or delete existing tables/data.

begin;

-- =========================================================
-- Helper: updated_at trigger function for ERP tables
-- =========================================================
create or replace function public.erp_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- A) User / Role / Authorization
-- =========================================================
create table if not exists public.erp_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null,
  email text unique not null,
  full_name text null,
  role text not null default 'admin',
  department text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.erp_users (email, role, is_active)
values ('info@dayandisli.com', 'admin', true)
on conflict (email) do update
set role = excluded.role,
    is_active = excluded.is_active,
    updated_at = now();

-- =========================================================
-- B) Stakeholders / CRM
-- =========================================================
create table if not exists public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('customer', 'supplier', 'subcontractor', 'both')),
  company_name text not null,
  contact_name text null,
  phone text null,
  email text null,
  tax_office text null,
  tax_number text null,
  address text null,
  city text null,
  country text not null default 'Türkiye',
  risk_limit numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- C) Quotation link table
-- =========================================================
create table if not exists public.erp_quotation_links (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid null,
  stakeholder_id uuid null references public.stakeholders(id),
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected', 'converted_to_order')),
  valid_until date null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- D) Sales Orders
-- =========================================================
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  stakeholder_id uuid null references public.stakeholders(id),
  source_quotation_id uuid null,
  title text not null,
  description text null,
  status text not null default 'new' check (status in (
    'new', 'confirmed', 'in_production', 'waiting_subcontractor',
    'ready_to_ship', 'shipped', 'invoiced', 'closed', 'cancelled'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  order_date date not null default current_date,
  due_date date null,
  currency text not null default 'TRY',
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references public.sales_orders(id) on delete cascade,
  item_code text null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit text not null default 'adet',
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  technical_drawing_id uuid null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- E) Production / Routing
-- =========================================================
create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  code text unique null,
  name text not null,
  machine_type text null,
  location text null,
  is_active boolean not null default true,
  maintenance_interval_days integer null,
  last_maintenance_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.machines (name)
select m.name
from (
  values
    ('Torna'),
    ('Freze'),
    ('Taslama'),
    ('Tel Erozyon'),
    ('Azdirma'),
    ('Fellows'),
    ('Profil Taslama'),
    ('Silindirik Taslama'),
    ('Kalite Kontrol'),
    ('Paketleme')
) as m(name)
where not exists (
  select 1 from public.machines existing where lower(existing.name) = lower(m.name)
);

create table if not exists public.production_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  is_template boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.production_route_steps (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.production_routes(id) on delete cascade,
  step_no integer not null,
  operation_name text not null,
  machine_id uuid null references public.machines(id),
  estimated_minutes integer not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  constraint production_route_steps_unique_step unique (route_id, step_no)
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_no text unique not null,
  sales_order_id uuid null references public.sales_orders(id),
  stakeholder_id uuid null references public.stakeholders(id),
  title text not null,
  part_name text null,
  part_code text null,
  quantity numeric(14,3) not null default 1,
  status text not null default 'planned' check (status in (
    'planned', 'released', 'in_progress', 'paused',
    'waiting_subcontractor', 'quality_check', 'completed', 'cancelled'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  planned_start_date date null,
  planned_end_date date null,
  actual_start_at timestamptz null,
  actual_end_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_order_operations (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references public.work_orders(id) on delete cascade,
  step_no integer not null,
  operation_name text not null,
  machine_id uuid null references public.machines(id),
  assigned_employee_id uuid null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'paused', 'completed', 'cancelled')),
  planned_minutes integer not null default 0,
  actual_minutes integer not null default 0,
  started_at timestamptz null,
  completed_at timestamptz null,
  quality_required boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  constraint work_order_operations_unique_step unique (work_order_id, step_no)
);

-- =========================================================
-- F) Subcontracting / Fason
-- =========================================================
create table if not exists public.subcontracting_jobs (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid null references public.work_orders(id),
  supplier_id uuid null references public.stakeholders(id),
  process_type text not null,
  dispatch_no text null,
  sent_date date null,
  expected_return_date date null,
  returned_date date null,
  status text not null default 'planned' check (status in ('planned', 'sent', 'in_process', 'returned', 'cancelled')),
  quantity_sent numeric(14,3) not null default 0,
  quantity_returned numeric(14,3) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- G) Technical Drawings / Documents
-- =========================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid null,
  document_type text not null,
  file_name text not null,
  file_path text null,
  version_no integer not null default 1,
  uploaded_by uuid null,
  notes text null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- H) Inventory / Warehouse
-- =========================================================
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('raw_material', 'consumable', 'tool', 'measuring_tool', 'finished_good', 'semi_finished')),
  code text unique null,
  name text not null,
  description text null,
  unit text not null default 'adet',
  current_stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  location text null,
  supplier_id uuid null references public.stakeholders(id),
  unit_cost numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid references public.inventory_items(id),
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment', 'reservation', 'return')),
  quantity numeric(14,3) not null,
  source_type text null,
  source_id uuid null,
  movement_date timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- I) Toolroom / Measuring Equipment
-- =========================================================
create table if not exists public.measuring_tools (
  id uuid primary key default gen_random_uuid(),
  code text unique null,
  name text not null,
  serial_no text null,
  calibration_due_date date null,
  last_calibration_date date null,
  status text not null default 'active' check (status in ('active', 'calibration_due', 'in_calibration', 'out_of_service')),
  assigned_to uuid null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- J) Finance / Bookkeeping
-- =========================================================
create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('cash', 'bank', 'customer', 'supplier')),
  name text not null,
  currency text not null default 'TRY',
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_type text not null check (invoice_type in ('sales', 'purchase')),
  invoice_no text null,
  stakeholder_id uuid null references public.stakeholders(id),
  invoice_date date not null default current_date,
  due_date date null,
  currency text not null default 'TRY',
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'partial', 'cancelled')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_type text not null check (payment_type in ('collection', 'payment')),
  stakeholder_id uuid null references public.stakeholders(id),
  financial_account_id uuid null references public.financial_accounts(id),
  amount numeric(14,2) not null,
  currency text not null default 'TRY',
  payment_date date not null default current_date,
  description text null,
  related_invoice_id uuid null references public.invoices(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- K) HR / Personnel
-- =========================================================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text null,
  department text null,
  phone text null,
  email text null,
  hire_date date null,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  work_date date not null default current_date,
  regular_hours numeric(5,2) not null default 0,
  overtime_hours numeric(5,2) not null default 0,
  work_order_id uuid null references public.work_orders(id),
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_assets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  asset_name text not null,
  asset_code text null,
  assigned_date date not null default current_date,
  returned_date date null,
  status text not null default 'assigned',
  notes text null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- L) Logistics / Shipping
-- =========================================================
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_no text unique not null,
  sales_order_id uuid null references public.sales_orders(id),
  stakeholder_id uuid null references public.stakeholders(id),
  carrier text null,
  tracking_no text null,
  delivery_note_no text null,
  package_count integer not null default 1,
  shipment_date date not null default current_date,
  status text not null default 'planned' check (status in ('planned', 'packed', 'shipped', 'delivered', 'cancelled')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete cascade,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit text not null default 'adet',
  notes text null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- M) Quality Control
-- =========================================================
create table if not exists public.quality_reports (
  id uuid primary key default gen_random_uuid(),
  report_no text unique not null,
  work_order_id uuid null references public.work_orders(id),
  sales_order_id uuid null references public.sales_orders(id),
  inspector_employee_id uuid null references public.employees(id),
  inspection_date date not null default current_date,
  result text not null default 'pending' check (result in ('pending', 'passed', 'failed', 'conditional')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_measurements (
  id uuid primary key default gen_random_uuid(),
  quality_report_id uuid references public.quality_reports(id) on delete cascade,
  characteristic text not null,
  nominal_value text null,
  tolerance text null,
  measured_value text null,
  result text not null default 'pending' check (result in ('pending', 'passed', 'failed')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- N) Maintenance
-- =========================================================
create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid references public.machines(id),
  task_name text not null,
  task_type text not null default 'periodic' check (task_type in ('periodic', 'breakdown', 'inspection')),
  planned_date date null,
  completed_date date null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  responsible_employee_id uuid null references public.employees(id),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- O) Numbering / Sequences
-- =========================================================
create table if not exists public.erp_number_sequences (
  id uuid primary key default gen_random_uuid(),
  sequence_key text unique not null,
  prefix text not null,
  current_value integer not null default 0,
  year integer null,
  month integer null,
  updated_at timestamptz not null default now()
);

insert into public.erp_number_sequences (sequence_key, prefix, current_value)
values
  ('SALES_ORDER', 'SO', 0),
  ('WORK_ORDER', 'WO', 0),
  ('SHIPMENT', 'SHP', 0),
  ('QUALITY_REPORT', 'QC', 0)
on conflict (sequence_key) do nothing;

create or replace function public.next_erp_number(p_sequence_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
  v_year integer;
begin
  v_year := extract(year from now())::integer;

  update public.erp_number_sequences
  set
    current_value = current_value + 1,
    year = coalesce(year, v_year),
    updated_at = now()
  where sequence_key = p_sequence_key
  returning prefix, current_value into v_prefix, v_next;

  if v_prefix is null then
    raise exception 'Sequence key not found: %', p_sequence_key;
  end if;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 5, '0');
end;
$$;

-- =========================================================
-- Indexes
-- =========================================================
create index if not exists idx_stakeholders_type_active on public.stakeholders(type, is_active);
create index if not exists idx_stakeholders_company_name on public.stakeholders(company_name);

create index if not exists idx_sales_orders_status on public.sales_orders(status);
create index if not exists idx_sales_orders_stakeholder on public.sales_orders(stakeholder_id);
create index if not exists idx_sales_orders_due_date on public.sales_orders(due_date);
create index if not exists idx_sales_order_items_sales_order_id on public.sales_order_items(sales_order_id);

create index if not exists idx_work_orders_status on public.work_orders(status);
create index if not exists idx_work_orders_stakeholder on public.work_orders(stakeholder_id);
create index if not exists idx_work_orders_planned_end on public.work_orders(planned_end_date);
create index if not exists idx_work_order_operations_work_order_id on public.work_order_operations(work_order_id);
create index if not exists idx_work_order_operations_machine_id on public.work_order_operations(machine_id);

create index if not exists idx_subcontracting_jobs_status on public.subcontracting_jobs(status);
create index if not exists idx_subcontracting_jobs_expected_return on public.subcontracting_jobs(expected_return_date);

create index if not exists idx_documents_entity on public.documents(entity_type, entity_id);

create index if not exists idx_inventory_items_type on public.inventory_items(item_type);
create index if not exists idx_inventory_items_stock_levels on public.inventory_items(current_stock, min_stock);
create index if not exists idx_inventory_movements_item_date on public.inventory_movements(inventory_item_id, movement_date desc);

create index if not exists idx_employees_active on public.employees(is_active);
create index if not exists idx_employee_time_entries_employee_date on public.employee_time_entries(employee_id, work_date);

create index if not exists idx_shipments_status on public.shipments(status);
create index if not exists idx_shipments_shipment_date on public.shipments(shipment_date);
create index if not exists idx_shipment_items_shipment_id on public.shipment_items(shipment_id);

create index if not exists idx_quality_reports_result on public.quality_reports(result);
create index if not exists idx_quality_reports_inspection_date on public.quality_reports(inspection_date);
create index if not exists idx_quality_measurements_report_id on public.quality_measurements(quality_report_id);

create index if not exists idx_maintenance_tasks_status on public.maintenance_tasks(status);
create index if not exists idx_maintenance_tasks_planned_date on public.maintenance_tasks(planned_date);

-- =========================================================
-- updated_at triggers
-- =========================================================
drop trigger if exists trg_erp_users_updated_at on public.erp_users;
create trigger trg_erp_users_updated_at before update on public.erp_users
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_stakeholders_updated_at on public.stakeholders;
create trigger trg_stakeholders_updated_at before update on public.stakeholders
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_sales_orders_updated_at on public.sales_orders;
create trigger trg_sales_orders_updated_at before update on public.sales_orders
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_machines_updated_at on public.machines;
create trigger trg_machines_updated_at before update on public.machines
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_work_orders_updated_at on public.work_orders;
create trigger trg_work_orders_updated_at before update on public.work_orders
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_subcontracting_jobs_updated_at on public.subcontracting_jobs;
create trigger trg_subcontracting_jobs_updated_at before update on public.subcontracting_jobs
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at before update on public.inventory_items
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_measuring_tools_updated_at on public.measuring_tools;
create trigger trg_measuring_tools_updated_at before update on public.measuring_tools
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at before update on public.invoices
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at before update on public.employees
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_shipments_updated_at on public.shipments;
create trigger trg_shipments_updated_at before update on public.shipments
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_quality_reports_updated_at on public.quality_reports;
create trigger trg_quality_reports_updated_at before update on public.quality_reports
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_maintenance_tasks_updated_at on public.maintenance_tasks;
create trigger trg_maintenance_tasks_updated_at before update on public.maintenance_tasks
for each row execute function public.erp_set_updated_at();

-- =========================================================
-- RLS and policies for ERP tables
-- =========================================================
do $$
declare
  t text;
  erp_tables text[] := array[
    'erp_users',
    'stakeholders',
    'erp_quotation_links',
    'sales_orders',
    'sales_order_items',
    'machines',
    'production_routes',
    'production_route_steps',
    'work_orders',
    'work_order_operations',
    'subcontracting_jobs',
    'documents',
    'inventory_items',
    'inventory_movements',
    'measuring_tools',
    'financial_accounts',
    'invoices',
    'payments',
    'employees',
    'employee_time_entries',
    'employee_assets',
    'shipments',
    'shipment_items',
    'quality_reports',
    'quality_measurements',
    'maintenance_tasks',
    'erp_number_sequences'
  ];
begin
  foreach t in array erp_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select_authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select_authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_authenticated', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_insert_authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_authenticated', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', t || '_update_authenticated', t);
  end loop;
end $$;

commit;
