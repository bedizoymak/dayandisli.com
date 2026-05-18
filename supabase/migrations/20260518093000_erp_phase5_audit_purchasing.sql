-- ERP Phase 5: audit trail and purchasing foundation.
-- Additive only: no existing production tables are dropped or truncated.

create table if not exists public.erp_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null,
  actor_email text null,
  entity_type text not null,
  entity_id uuid null,
  action text not null,
  old_status text null,
  new_status text null,
  description text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_order_no text unique not null,
  supplier_id uuid null references public.stakeholders(id),
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'partially_received', 'received', 'cancelled')),
  order_date date default current_date,
  expected_delivery_date date null,
  currency text default 'TRY',
  subtotal numeric(14,2) default 0,
  tax_total numeric(14,2) default 0,
  grand_total numeric(14,2) default 0,
  notes text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade,
  inventory_item_id uuid null references public.inventory_items(id),
  description text not null,
  quantity numeric(14,3) default 1,
  unit text default 'adet',
  unit_price numeric(14,2) default 0,
  total numeric(14,2) default 0,
  received_quantity numeric(14,3) default 0,
  created_at timestamptz default now()
);

create index if not exists idx_erp_audit_logs_entity
  on public.erp_audit_logs(entity_type, entity_id, created_at desc);

create index if not exists idx_erp_audit_logs_created_at
  on public.erp_audit_logs(created_at desc);

create index if not exists idx_purchase_orders_supplier
  on public.purchase_orders(supplier_id);

create index if not exists idx_purchase_orders_status
  on public.purchase_orders(status);

create index if not exists idx_purchase_order_items_order
  on public.purchase_order_items(purchase_order_id);

insert into public.erp_number_sequences (sequence_key, prefix, current_value)
values ('PURCHASE_ORDER', 'PO', 0)
on conflict (sequence_key) do update
set prefix = excluded.prefix,
    updated_at = now();

alter table public.erp_audit_logs enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "erp authenticated select erp_audit_logs" on public.erp_audit_logs;
create policy "erp authenticated select erp_audit_logs"
on public.erp_audit_logs
for select
to authenticated
using (true);

drop policy if exists "erp authenticated insert erp_audit_logs" on public.erp_audit_logs;
create policy "erp authenticated insert erp_audit_logs"
on public.erp_audit_logs
for insert
to authenticated
with check (true);

drop policy if exists "erp authenticated select purchase_orders" on public.purchase_orders;
create policy "erp authenticated select purchase_orders"
on public.purchase_orders
for select
to authenticated
using (true);

drop policy if exists "erp authenticated insert purchase_orders" on public.purchase_orders;
create policy "erp authenticated insert purchase_orders"
on public.purchase_orders
for insert
to authenticated
with check (true);

drop policy if exists "erp authenticated update purchase_orders" on public.purchase_orders;
create policy "erp authenticated update purchase_orders"
on public.purchase_orders
for update
to authenticated
using (true)
with check (true);

drop policy if exists "erp authenticated select purchase_order_items" on public.purchase_order_items;
create policy "erp authenticated select purchase_order_items"
on public.purchase_order_items
for select
to authenticated
using (true);

drop policy if exists "erp authenticated insert purchase_order_items" on public.purchase_order_items;
create policy "erp authenticated insert purchase_order_items"
on public.purchase_order_items
for insert
to authenticated
with check (true);

drop policy if exists "erp authenticated update purchase_order_items" on public.purchase_order_items;
create policy "erp authenticated update purchase_order_items"
on public.purchase_order_items
for update
to authenticated
using (true)
with check (true);
