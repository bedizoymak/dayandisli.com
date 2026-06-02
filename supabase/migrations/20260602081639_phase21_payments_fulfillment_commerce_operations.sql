-- Phase 21 payments, fulfillment and end-to-end commerce operations.
-- Additive operational lifecycle foundation. No real payment provider integration is enabled.

alter table if exists public.orders
  add column if not exists fulfillment_status text not null default 'received'
    check (fulfillment_status in ('received', 'preparing', 'packed', 'shipped', 'delivered', 'completed', 'cancelled')),
  add column if not exists refund_status text not null default 'none'
    check (refund_status in ('none', 'pending', 'approved', 'completed', 'rejected')),
  add column if not exists carrier_name text null;

alter table if exists public.shop_payment_statuses
  add column if not exists lifecycle_status text not null default 'payment_pending'
    check (lifecycle_status in ('payment_pending', 'payment_received', 'payment_failed', 'refund_pending', 'refund_completed')),
  add column if not exists future_provider text null
    check (future_provider is null or future_provider in ('iyzico', 'paytr', 'stripe', 'manual')),
  add column if not exists customer_user_id uuid null references auth.users(id);

create table if not exists public.shop_carriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  tracking_url_template text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_user_id uuid null references auth.users(id),
  carrier_id uuid null references public.shop_carriers(id),
  carrier_name text null,
  tracking_number text null,
  status text not null default 'preparing'
    check (status in ('preparing', 'packed', 'shipped', 'delivered', 'cancelled')),
  shipped_at timestamptz null,
  delivered_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_fulfillment_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_user_id uuid null references auth.users(id),
  from_status text null,
  to_status text not null,
  description text null,
  created_by text null,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_customer_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid null references public.orders(id) on delete cascade,
  customer_user_id uuid null references auth.users(id),
  event_type text not null
    check (event_type in ('order_created', 'payment_received', 'shipment_created', 'delivery_completed', 'return_requested', 'refund_completed')),
  title text not null,
  message text not null,
  channel text not null default 'email_event'
    check (channel in ('email_event', 'erp_notification')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'read')),
  metadata jsonb null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create table if not exists public.shop_return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_user_id uuid not null references auth.users(id),
  reason text not null,
  status text not null default 'requested'
    check (status in ('requested', 'erp_review', 'approved', 'rejected', 'received', 'closed')),
  refund_status text not null default 'refund_pending'
    check (refund_status in ('refund_pending', 'refund_approved', 'refund_completed', 'refund_rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.shop_carriers (name, code, tracking_url_template, sort_order)
values
  ('Yurtiçi Kargo', 'yurtici', 'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={tracking_number}', 10),
  ('Aras Kargo', 'aras', 'https://www.araskargo.com.tr/tracking/{tracking_number}', 20),
  ('MNG Kargo', 'mng', 'https://www.mngkargo.com.tr/gonderi-takip/{tracking_number}', 30),
  ('Manuel Sevkiyat', 'manual', null, 40)
on conflict (code) do nothing;

create index if not exists idx_orders_fulfillment_status on public.orders(fulfillment_status);
create index if not exists idx_shop_shipments_order on public.shop_shipments(order_id);
create index if not exists idx_shop_shipments_customer on public.shop_shipments(customer_user_id);
create index if not exists idx_shop_fulfillment_history_order on public.shop_fulfillment_history(order_id, created_at desc);
create index if not exists idx_shop_customer_notifications_customer on public.shop_customer_notifications(customer_user_id, created_at desc);
create index if not exists idx_shop_return_requests_customer on public.shop_return_requests(customer_user_id, created_at desc);
create index if not exists idx_shop_return_requests_order on public.shop_return_requests(order_id);

alter table public.shop_carriers enable row level security;
alter table public.shop_shipments enable row level security;
alter table public.shop_fulfillment_history enable row level security;
alter table public.shop_customer_notifications enable row level security;
alter table public.shop_return_requests enable row level security;

drop policy if exists "Anyone can view active shop_carriers" on public.shop_carriers;
create policy "Anyone can view active shop_carriers"
on public.shop_carriers for select
using (is_active = true);

do $$
declare
  t text;
begin
  foreach t in array array['shop_carriers', 'shop_shipments', 'shop_fulfillment_history', 'shop_customer_notifications', 'shop_return_requests']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.admin_users where admin_users.email = (auth.jwt() ->> ''email'') and admin_users.is_active = true)) with check (exists (select 1 from public.admin_users where admin_users.email = (auth.jwt() ->> ''email'') and admin_users.is_active = true))',
      t || '_admin_manage',
      t
    );
  end loop;
end $$;

drop policy if exists "Customers can view own shop_shipments" on public.shop_shipments;
create policy "Customers can view own shop_shipments"
on public.shop_shipments for select
to authenticated
using (customer_user_id = auth.uid());

drop policy if exists "Customers can view own shop_fulfillment_history" on public.shop_fulfillment_history;
create policy "Customers can view own shop_fulfillment_history"
on public.shop_fulfillment_history for select
to authenticated
using (customer_user_id = auth.uid());

drop policy if exists "Customers can view own shop_customer_notifications" on public.shop_customer_notifications;
create policy "Customers can view own shop_customer_notifications"
on public.shop_customer_notifications for select
to authenticated
using (customer_user_id = auth.uid());

drop policy if exists "Customers can update own notification read state" on public.shop_customer_notifications;
create policy "Customers can update own notification read state"
on public.shop_customer_notifications for update
to authenticated
using (customer_user_id = auth.uid())
with check (customer_user_id = auth.uid());

drop policy if exists "Customers can view own shop_return_requests" on public.shop_return_requests;
create policy "Customers can view own shop_return_requests"
on public.shop_return_requests for select
to authenticated
using (customer_user_id = auth.uid());

drop policy if exists "Customers can create own shop_return_requests" on public.shop_return_requests;
create policy "Customers can create own shop_return_requests"
on public.shop_return_requests for insert
to authenticated
with check (
  customer_user_id = auth.uid()
  and exists (
    select 1 from public.orders
    where orders.id = shop_return_requests.order_id
      and orders.customer_user_id = auth.uid()
  )
);

create or replace function internal.record_shop_fulfillment_change()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
begin
  if old.fulfillment_status is distinct from new.fulfillment_status then
    insert into public.shop_fulfillment_history (
      order_id,
      customer_user_id,
      from_status,
      to_status,
      description,
      created_by
    )
    values (
      new.id,
      new.customer_user_id,
      old.fulfillment_status,
      new.fulfillment_status,
      'Sipariş durumu güncellendi.',
      'erp'
    );
  end if;

  if old.payment_status is distinct from new.payment_status and new.payment_status = 'paid' then
    insert into public.shop_customer_notifications (order_id, customer_user_id, event_type, title, message)
    values (new.id, new.customer_user_id, 'payment_received', 'Ödeme alındı', new.order_number || ' numaralı siparişinizin ödeme durumu alındı olarak güncellendi.');
  end if;

  if old.fulfillment_status is distinct from new.fulfillment_status and new.fulfillment_status = 'delivered' then
    insert into public.shop_customer_notifications (order_id, customer_user_id, event_type, title, message)
    values (new.id, new.customer_user_id, 'delivery_completed', 'Teslimat tamamlandı', new.order_number || ' numaralı siparişiniz teslim edildi.');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_record_fulfillment_change on public.orders;
create trigger trg_orders_record_fulfillment_change
after update on public.orders
for each row execute function internal.record_shop_fulfillment_change();

create or replace function internal.record_shop_order_created()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
begin
  insert into public.shop_fulfillment_history (order_id, customer_user_id, from_status, to_status, description, created_by)
  values (new.id, new.customer_user_id, null, coalesce(new.fulfillment_status, 'received'), 'Sipariş alındı.', 'system');

  insert into public.shop_customer_notifications (order_id, customer_user_id, event_type, title, message)
  values (new.id, new.customer_user_id, 'order_created', 'Sipariş alındı', new.order_number || ' numaralı siparişiniz ERP sürecine alındı.');

  return new;
end;
$$;

drop trigger if exists trg_orders_record_order_created on public.orders;
create trigger trg_orders_record_order_created
after insert on public.orders
for each row execute function internal.record_shop_order_created();

create or replace function internal.record_shop_shipment_created()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
begin
  insert into public.shop_customer_notifications (order_id, customer_user_id, event_type, title, message, metadata)
  values (
    new.order_id,
    new.customer_user_id,
    'shipment_created',
    'Sevkiyat oluşturuldu',
    'Siparişiniz için sevkiyat kaydı oluşturuldu.',
    jsonb_build_object('tracking_number', new.tracking_number, 'carrier_name', new.carrier_name)
  );
  return new;
end;
$$;

drop trigger if exists trg_shop_shipments_record_created on public.shop_shipments;
create trigger trg_shop_shipments_record_created
after insert on public.shop_shipments
for each row execute function internal.record_shop_shipment_created();

do $$
declare
  t text;
begin
  foreach t in array array['shop_carriers', 'shop_shipments', 'shop_return_requests']
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
