-- Phase 19 public e-commerce operations, checkout foundation and customer portal.
-- Additive schema hooks only; ERP-owned orders, products, inventory, invoicing and fulfillment remain authoritative.

alter table if exists public.orders
  add column if not exists customer_user_id uuid null references auth.users(id),
  add column if not exists billing_address text null,
  add column if not exists shipping_address text null,
  add column if not exists shipping_method text null,
  add column if not exists shipping_status text not null default 'pending'
    check (shipping_status in ('pending', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled')),
  add column if not exists tracking_number text null,
  add column if not exists inventory_reservation_status text not null default 'pending'
    check (inventory_reservation_status in ('pending', 'reserved', 'partial', 'failed', 'released')),
  add column if not exists checkout_source text not null default 'public_shop',
  add column if not exists customer_reference text null;

alter table if exists public.order_items
  add column if not exists inventory_item_id uuid null references public.inventory_items(id),
  add column if not exists reservation_status text not null default 'pending'
    check (reservation_status in ('pending', 'reserved', 'partial', 'failed', 'released'));

alter table if exists public.shop_carts
  add column if not exists customer_user_id uuid null references auth.users(id),
  add column if not exists guest_cart_key text null,
  add column if not exists notes text null;

create table if not exists public.shop_shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text null,
  estimated_days text null,
  base_price numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.shop_shipping_methods (name, code, description, estimated_days, base_price, sort_order)
values
  ('Firma Sevkiyatı', 'company_shipping', 'Dayan Dişli ekibi tarafından planlanan sevkiyat.', 'Teklif sonrası planlanır', 0, 10),
  ('Müşteri Teslim Alır', 'customer_pickup', 'Müşteri tarafından teslim alma seçeneği.', 'Hazırlık sonrası', 0, 20),
  ('Kargo Planlanacak', 'cargo_planned', 'Kargo firması daha sonra ERP operasyon ekibi tarafından belirlenir.', 'Teklif sonrası planlanır', 0, 30)
on conflict (code) do nothing;

create index if not exists idx_orders_customer_user_id on public.orders(customer_user_id);
create index if not exists idx_orders_email on public.orders(lower(email));
create index if not exists idx_orders_shipping_status on public.orders(shipping_status);
create index if not exists idx_order_items_inventory_item on public.order_items(inventory_item_id);
create index if not exists idx_shop_carts_customer_user_id on public.shop_carts(customer_user_id);
create index if not exists idx_shop_carts_guest_cart_key on public.shop_carts(guest_cart_key);
create index if not exists idx_shop_shipping_methods_active on public.shop_shipping_methods(is_active, sort_order);

alter table public.shop_shipping_methods enable row level security;

drop policy if exists "Anyone can view active shop_shipping_methods" on public.shop_shipping_methods;
create policy "Anyone can view active shop_shipping_methods"
on public.shop_shipping_methods for select
using (is_active = true);

drop policy if exists "Authenticated can manage shop_shipping_methods" on public.shop_shipping_methods;
create policy "Authenticated can manage shop_shipping_methods"
on public.shop_shipping_methods for all
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

drop policy if exists "Authenticated can view orders" on public.orders;
create policy "Authenticated can view own or managed orders"
on public.orders for select
to authenticated
using (
  customer_user_id = auth.uid()
  or lower(email) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop policy if exists "Authenticated can update orders" on public.orders;
create policy "Authenticated can update managed orders"
on public.orders for update
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

drop policy if exists "Authenticated can view order_items" on public.order_items;
create policy "Authenticated can view own or managed order_items"
on public.order_items for select
to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (
        orders.customer_user_id = auth.uid()
        or lower(orders.email) = lower(auth.jwt() ->> 'email')
        or exists (
          select 1 from public.admin_users
          where admin_users.email = (auth.jwt() ->> 'email')
            and admin_users.is_active = true
        )
      )
  )
);

drop policy if exists "Authenticated can view shop_carts" on public.shop_carts;
create policy "Authenticated can view own or managed shop_carts"
on public.shop_carts for select
to authenticated
using (
  customer_user_id = auth.uid()
  or customer_email = (auth.jwt() ->> 'email')
  or exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop policy if exists "Authenticated can update shop_carts" on public.shop_carts;
create policy "Authenticated can update own or managed shop_carts"
on public.shop_carts for update
to authenticated
using (
  customer_user_id = auth.uid()
  or customer_email = (auth.jwt() ->> 'email')
  or exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
)
with check (
  customer_user_id = auth.uid()
  or customer_email = (auth.jwt() ->> 'email')
  or exists (
    select 1 from public.admin_users
    where admin_users.email = (auth.jwt() ->> 'email')
      and admin_users.is_active = true
  )
);

drop trigger if exists trg_shop_shipping_methods_updated_at on public.shop_shipping_methods;
create trigger trg_shop_shipping_methods_updated_at before update on public.shop_shipping_methods
for each row execute function public.erp_set_updated_at();

create schema if not exists internal;

create or replace function internal.create_sales_order_from_shop_order()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_stakeholder_id uuid;
  v_sales_order_id uuid;
  v_order_no text;
begin
  if new.sales_order_id is not null then
    return new;
  end if;

  select id into v_stakeholder_id
  from public.stakeholders
  where lower(email) = lower(new.email)
  order by created_at desc
  limit 1;

  if v_stakeholder_id is null then
    insert into public.stakeholders (
      type,
      company_name,
      contact_name,
      phone,
      email,
      address,
      notes
    )
    values (
      'customer',
      coalesce(nullif(new.company_name, ''), new.customer_name),
      new.customer_name,
      new.phone,
      new.email,
      coalesce(new.shipping_address, new.address),
      'E-ticaret siparişinden otomatik oluşturuldu.'
    )
    returning id into v_stakeholder_id;
  end if;

  v_order_no := public.next_erp_number('SALES_ORDER');

  insert into public.sales_orders (
    order_no,
    stakeholder_id,
    title,
    description,
    status,
    priority,
    order_date,
    currency,
    subtotal,
    tax_total,
    grand_total,
    notes
  )
  values (
    v_order_no,
    v_stakeholder_id,
    'E-Ticaret Siparişi ' || new.order_number,
    new.notes,
    'new',
    'normal',
    coalesce(new.created_at::date, current_date),
    new.currency,
    new.subtotal,
    new.tax_total,
    new.grand_total,
    'Kaynak e-ticaret siparişi: ' || new.order_number
  )
  returning id into v_sales_order_id;

  insert into public.sales_order_items (
    sales_order_id,
    item_code,
    description,
    quantity,
    unit,
    unit_price,
    total
  )
  select
    v_sales_order_id,
    p.sku,
    oi.product_name,
    oi.quantity,
    'adet',
    oi.unit_price,
    oi.line_total
  from public.order_items oi
  left join public.products p on p.id = oi.product_id
  where oi.order_id = new.id;

  update public.orders
  set sales_order_id = v_sales_order_id,
      stakeholder_id = v_stakeholder_id,
      status = 'confirmed'
  where id = new.id;

  insert into public.erp_audit_logs (
    entity_type,
    entity_id,
    action,
    description,
    metadata
  )
  values (
    'shop_order',
    new.id,
    'converted_to_sales_order',
    new.order_number || ' e-ticaret siparişi satış siparişine bağlandı.',
    jsonb_build_object('sales_order_id', v_sales_order_id, 'order_no', v_order_no)
  );

  return new;
exception
  when others then
    insert into public.erp_audit_logs (
      entity_type,
      entity_id,
      action,
      description,
      metadata
    )
    values (
      'shop_order',
      new.id,
      'sales_order_conversion_failed',
      new.order_number || ' e-ticaret siparişi için satış siparişi bağlantısı oluşturulamadı.',
      jsonb_build_object('error', sqlerrm)
    );
    return new;
end;
$$;

revoke all on function internal.create_sales_order_from_shop_order() from public;

drop trigger if exists trg_orders_create_sales_order on public.orders;
create trigger trg_orders_create_sales_order
after insert on public.orders
for each row execute function internal.create_sales_order_from_shop_order();

create or replace function internal.create_sales_order_item_from_shop_order_item()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_sales_order_id uuid;
  v_sku text;
begin
  select sales_order_id into v_sales_order_id
  from public.orders
  where id = new.order_id;

  if v_sales_order_id is null then
    return new;
  end if;

  select sku into v_sku
  from public.products
  where id = new.product_id;

  insert into public.sales_order_items (
    sales_order_id,
    item_code,
    description,
    quantity,
    unit,
    unit_price,
    total
  )
  values (
    v_sales_order_id,
    v_sku,
    new.product_name,
    new.quantity,
    'adet',
    new.unit_price,
    new.line_total
  );

  return new;
exception
  when others then
    insert into public.erp_audit_logs (
      entity_type,
      entity_id,
      action,
      description,
      metadata
    )
    values (
      'shop_order_item',
      new.id,
      'sales_order_item_conversion_failed',
      new.product_name || ' kalemi için satış siparişi kalemi oluşturulamadı.',
      jsonb_build_object('error', sqlerrm, 'order_id', new.order_id)
    );
    return new;
end;
$$;

revoke all on function internal.create_sales_order_item_from_shop_order_item() from public;

drop trigger if exists trg_order_items_create_sales_order_item on public.order_items;
create trigger trg_order_items_create_sales_order_item
after insert on public.order_items
for each row execute function internal.create_sales_order_item_from_shop_order_item();
