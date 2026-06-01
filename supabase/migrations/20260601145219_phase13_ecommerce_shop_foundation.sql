-- Phase 13 e-commerce and shop foundation.
-- Extends existing public shop tables and prepares ERP-side commerce flow.

create table if not exists public.shop_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text null,
  parent_category_id uuid null references public.shop_categories(id),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text null unique,
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'amount', 'free_shipping')),
  discount_value numeric(12,2) not null default 0,
  starts_at timestamptz null,
  ends_at timestamptz null,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_carts (
  id uuid primary key default gen_random_uuid(),
  customer_email text null,
  customer_name text null,
  status text not null default 'active' check (status in ('active', 'converted', 'abandoned', 'expired')),
  currency text not null default 'TRY',
  subtotal numeric(12,2) not null default 0,
  converted_order_id uuid null references public.orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.shop_carts(id) on delete cascade,
  product_id uuid null references public.products(id),
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_payment_statuses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled')),
  provider text null,
  transaction_reference text null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.products
  add column if not exists shop_category_id uuid null references public.shop_categories(id),
  add column if not exists inventory_item_id uuid null references public.inventory_items(id),
  add column if not exists is_shop_visible boolean not null default true;

alter table if exists public.orders
  add column if not exists stakeholder_id uuid null references public.stakeholders(id),
  add column if not exists sales_order_id uuid null references public.sales_orders(id),
  add column if not exists invoice_id uuid null references public.invoices(id),
  add column if not exists payment_id uuid null references public.payments(id),
  add column if not exists campaign_id uuid null references public.shop_campaigns(id),
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled'));

create index if not exists idx_shop_categories_active on public.shop_categories(is_active);
create index if not exists idx_shop_campaigns_active on public.shop_campaigns(is_active);
create index if not exists idx_shop_carts_status on public.shop_carts(status);
create index if not exists idx_shop_cart_items_cart on public.shop_cart_items(cart_id);
create index if not exists idx_shop_payment_statuses_order on public.shop_payment_statuses(order_id);
create index if not exists idx_products_shop_category on public.products(shop_category_id);
create index if not exists idx_products_inventory_item on public.products(inventory_item_id);
create index if not exists idx_orders_sales_order on public.orders(sales_order_id);
create index if not exists idx_orders_payment_status on public.orders(payment_status);

alter table public.shop_categories enable row level security;
alter table public.shop_campaigns enable row level security;
alter table public.shop_carts enable row level security;
alter table public.shop_cart_items enable row level security;
alter table public.shop_payment_statuses enable row level security;

drop policy if exists "Anyone can view shop_categories" on public.shop_categories;
create policy "Anyone can view shop_categories"
on public.shop_categories for select
using (true);

drop policy if exists "Authenticated can manage shop_categories" on public.shop_categories;
create policy "Authenticated can manage shop_categories"
on public.shop_categories for all
to authenticated
using (true)
with check (true);

drop policy if exists "Anyone can view shop_campaigns" on public.shop_campaigns;
create policy "Anyone can view shop_campaigns"
on public.shop_campaigns for select
using (true);

drop policy if exists "Authenticated can manage shop_campaigns" on public.shop_campaigns;
create policy "Authenticated can manage shop_campaigns"
on public.shop_campaigns for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can view shop_carts" on public.shop_carts;
create policy "Authenticated can view shop_carts"
on public.shop_carts for select
to authenticated
using (true);

drop policy if exists "Anyone can insert shop_carts" on public.shop_carts;
create policy "Anyone can insert shop_carts"
on public.shop_carts for insert
with check (true);

drop policy if exists "Authenticated can update shop_carts" on public.shop_carts;
create policy "Authenticated can update shop_carts"
on public.shop_carts for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can view shop_cart_items" on public.shop_cart_items;
create policy "Authenticated can view shop_cart_items"
on public.shop_cart_items for select
to authenticated
using (true);

drop policy if exists "Anyone can insert shop_cart_items" on public.shop_cart_items;
create policy "Anyone can insert shop_cart_items"
on public.shop_cart_items for insert
with check (true);

drop policy if exists "Authenticated can manage shop_payment_statuses" on public.shop_payment_statuses;
create policy "Authenticated can manage shop_payment_statuses"
on public.shop_payment_statuses for all
to authenticated
using (true)
with check (true);

drop trigger if exists trg_shop_categories_updated_at on public.shop_categories;
create trigger trg_shop_categories_updated_at before update on public.shop_categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_shop_campaigns_updated_at on public.shop_campaigns;
create trigger trg_shop_campaigns_updated_at before update on public.shop_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists trg_shop_carts_updated_at on public.shop_carts;
create trigger trg_shop_carts_updated_at before update on public.shop_carts
for each row execute function public.set_updated_at();

drop trigger if exists trg_shop_payment_statuses_updated_at on public.shop_payment_statuses;
create trigger trg_shop_payment_statuses_updated_at before update on public.shop_payment_statuses
for each row execute function public.set_updated_at();
