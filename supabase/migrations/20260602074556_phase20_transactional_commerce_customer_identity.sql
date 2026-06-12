-- Phase 20 transactional commerce hardening and customer identity.
-- Additive hardening for public commerce before payment launch.

create table if not exists public.shop_customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade unique,
  email text not null,
  full_name text not null,
  company_name text null,
  phone text null,
  billing_address text null,
  shipping_address text null,
  stakeholder_id uuid null references public.stakeholders(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid null references public.order_items(id) on delete cascade,
  product_id uuid null references public.products(id),
  inventory_item_id uuid null references public.inventory_items(id),
  quantity numeric(14,3) not null,
  status text not null default 'reserved' check (status in ('reserved', 'released', 'failed')),
  reason text null,
  created_at timestamptz not null default now(),
  released_at timestamptz null
);

create table if not exists public.commerce_checkout_events (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null references auth.users(id) on delete set null,
  email text null,
  event_type text not null,
  ip_hash text null,
  user_agent text null,
  order_id uuid null references public.orders(id) on delete set null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shop_customer_profiles_auth_user_id on public.shop_customer_profiles(auth_user_id);
create index if not exists idx_shop_customer_profiles_email on public.shop_customer_profiles(lower(email));
create index if not exists idx_shop_inventory_reservations_order on public.shop_inventory_reservations(order_id);
create index if not exists idx_shop_inventory_reservations_inventory on public.shop_inventory_reservations(inventory_item_id, status);
create index if not exists idx_commerce_checkout_events_user_time on public.commerce_checkout_events(auth_user_id, created_at desc);
create index if not exists idx_commerce_checkout_events_email_time on public.commerce_checkout_events(lower(email), created_at desc);
create index if not exists idx_commerce_checkout_events_type_time on public.commerce_checkout_events(event_type, created_at desc);

alter table public.shop_customer_profiles enable row level security;
alter table public.shop_inventory_reservations enable row level security;
alter table public.commerce_checkout_events enable row level security;

drop policy if exists "Customers can view own shop_customer_profiles" on public.shop_customer_profiles;
create policy "Customers can view own shop_customer_profiles"
on public.shop_customer_profiles for select
to authenticated
using (
  auth_user_id = auth.uid()
  or exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop policy if exists "Customers can insert own shop_customer_profiles" on public.shop_customer_profiles;
create policy "Customers can insert own shop_customer_profiles"
on public.shop_customer_profiles for insert
to authenticated
with check (auth_user_id = auth.uid() and lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "Customers can update own shop_customer_profiles" on public.shop_customer_profiles;
create policy "Customers can update own shop_customer_profiles"
on public.shop_customer_profiles for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid() and lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "Admins can manage shop_customer_profiles" on public.shop_customer_profiles;
create policy "Admins can manage shop_customer_profiles"
on public.shop_customer_profiles for all
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop policy if exists "Customers can view own shop_inventory_reservations" on public.shop_inventory_reservations;
create policy "Customers can view own shop_inventory_reservations"
on public.shop_inventory_reservations for select
to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = shop_inventory_reservations.order_id
      and orders.customer_user_id = auth.uid()
  )
  or exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop policy if exists "Admins can manage shop_inventory_reservations" on public.shop_inventory_reservations;
create policy "Admins can manage shop_inventory_reservations"
on public.shop_inventory_reservations for all
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop policy if exists "Admins can view commerce_checkout_events" on public.commerce_checkout_events;
create policy "Admins can view commerce_checkout_events"
on public.commerce_checkout_events for select
to authenticated
using (
  auth_user_id = auth.uid()
  or exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

-- Direct public checkout inserts are disabled. The Edge Function uses service role and validates identity, rate limits and inventory.
drop policy if exists "Anyone can insert orders" on public.orders;
drop policy if exists "Authenticated can insert orders" on public.orders;
create policy "Admins can insert managed orders"
on public.orders for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop policy if exists "Anyone can insert order_items" on public.order_items;

drop policy if exists "Authenticated can view own or managed orders" on public.orders;
create policy "Authenticated can view own or managed orders"
on public.orders for select
to authenticated
using (
  customer_user_id = auth.uid()
  or exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop policy if exists "Authenticated can view own or managed order_items" on public.order_items;
create policy "Authenticated can view own or managed order_items"
on public.order_items for select
to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (
        orders.customer_user_id = auth.uid()
        or exists (
          select 1 from public.admin_users
          where admin_users.email = (auth.jwt() ->> 'email')
            and admin_users.is_active = true
        )
      )
  )
);

create or replace function internal.release_shop_order_reservations(p_order_id uuid, p_reason text default 'manual_release')
returns integer
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select *
    from public.shop_inventory_reservations
    where order_id = p_order_id
      and status = 'reserved'
  loop
    if r.inventory_item_id is not null then
      update public.inventory_items
      set current_stock = current_stock + r.quantity
      where id = r.inventory_item_id;
    end if;

    update public.shop_inventory_reservations
    set status = 'released',
        reason = p_reason,
        released_at = now()
    where id = r.id;

    v_count := v_count + 1;
  end loop;

  update public.order_items
  set reservation_status = 'released'
  where order_id = p_order_id
    and reservation_status = 'reserved';

  update public.orders
  set inventory_reservation_status = 'released'
  where id = p_order_id
    and inventory_reservation_status = 'reserved';

  return v_count;
end;
$$;

revoke all on function internal.release_shop_order_reservations(uuid, text) from public;

drop trigger if exists trg_shop_customer_profiles_updated_at on public.shop_customer_profiles;
create trigger trg_shop_customer_profiles_updated_at before update on public.shop_customer_profiles
for each row execute function public.erp_set_updated_at();
