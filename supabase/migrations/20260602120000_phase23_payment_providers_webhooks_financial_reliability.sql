-- Phase 23 payment providers, webhooks and financial reliability.
-- Additive foundation for controlled provider launch. Provider-specific logic stays in Edge Functions.

alter table if exists public.orders
  add column if not exists provider_payment_id text null,
  add column if not exists provider_payment_url text null,
  add column if not exists payment_provider text null
    check (payment_provider is null or payment_provider in ('iyzico', 'paytr', 'stripe', 'manual')),
  add column if not exists payment_reconciliation_status text not null default 'pending'
    check (payment_reconciliation_status in ('pending', 'matched', 'mismatch', 'duplicate', 'manual_review')),
  add column if not exists paid_at timestamptz null,
  add column if not exists refunded_at timestamptz null;

alter table if exists public.shop_payment_statuses
  add column if not exists provider_event_id text null,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed', 'duplicate', 'replayed')),
  add column if not exists reconciliation_status text not null default 'pending'
    check (reconciliation_status in ('pending', 'matched', 'mismatch', 'duplicate', 'manual_review')),
  add column if not exists invoice_id uuid null references public.invoices(id),
  add column if not exists payment_id uuid null references public.payments(id);

create unique index if not exists uq_shop_payment_statuses_provider_reference
on public.shop_payment_statuses(provider, transaction_reference)
where provider is not null and transaction_reference is not null;

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('iyzico', 'paytr', 'stripe')),
  event_id text not null,
  event_type text not null,
  order_id uuid null references public.orders(id) on delete set null,
  customer_user_id uuid null references auth.users(id) on delete set null,
  payment_status_id uuid null references public.shop_payment_statuses(id) on delete set null,
  signature_valid boolean not null default false,
  replay_detected boolean not null default false,
  duplicate_detected boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null
);

create unique index if not exists uq_payment_provider_events_provider_event
on public.payment_provider_events(provider, event_id);

create index if not exists idx_payment_provider_events_order on public.payment_provider_events(order_id, received_at desc);
create index if not exists idx_payment_provider_events_status on public.payment_provider_events(processing_status, received_at desc);

create table if not exists public.payment_reconciliation_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  invoice_id uuid null references public.invoices(id) on delete set null,
  payment_id uuid null references public.payments(id) on delete set null,
  payment_status_id uuid null references public.shop_payment_statuses(id) on delete set null,
  provider text null check (provider is null or provider in ('iyzico', 'paytr', 'stripe', 'manual')),
  provider_payment_id text null,
  expected_amount numeric(14,2) not null default 0,
  received_amount numeric(14,2) not null default 0,
  currency text not null default 'TRY',
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'mismatch', 'duplicate', 'manual_review')),
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_reconciliation_logs_order on public.payment_reconciliation_logs(order_id, created_at desc);
create index if not exists idx_payment_reconciliation_logs_status on public.payment_reconciliation_logs(status, created_at desc);

create table if not exists public.accounting_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid null references public.orders(id) on delete set null,
  invoice_id uuid null references public.invoices(id) on delete set null,
  payment_id uuid null references public.payments(id) on delete set null,
  refund_request_id uuid null references public.shop_return_requests(id) on delete set null,
  entry_type text not null check (entry_type in ('payment_received', 'refund_approved', 'refund_completed', 'payment_failed')),
  provider text null check (provider is null or provider in ('iyzico', 'paytr', 'stripe', 'manual')),
  external_reference text null,
  amount numeric(14,2) not null default 0,
  currency text not null default 'TRY',
  debit_account text null,
  credit_account text null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_accounting_entries_payment_type
on public.accounting_entries(payment_id, entry_type)
where payment_id is not null;

create unique index if not exists uq_accounting_entries_refund_type
on public.accounting_entries(refund_request_id, entry_type)
where refund_request_id is not null;

create table if not exists public.payment_refund_operations (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.shop_return_requests(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_status_id uuid null references public.shop_payment_statuses(id) on delete set null,
  provider text null check (provider is null or provider in ('iyzico', 'paytr', 'stripe', 'manual')),
  provider_refund_id text null,
  requested_amount numeric(14,2) not null default 0,
  approved_amount numeric(14,2) null,
  currency text not null default 'TRY',
  status text not null default 'requested'
    check (status in ('requested', 'erp_review', 'provider_pending', 'provider_verified', 'completed', 'rejected', 'failed')),
  reviewed_by text null,
  reviewed_at timestamptz null,
  completed_at timestamptz null,
  failure_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_payment_refund_operations_return
on public.payment_refund_operations(return_request_id);

create table if not exists public.payment_provider_health (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('iyzico', 'paytr', 'stripe')),
  status text not null default 'unknown' check (status in ('healthy', 'degraded', 'down', 'unknown')),
  last_success_at timestamptz null,
  last_failure_at timestamptz null,
  failure_count integer not null default 0,
  last_error text null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(provider)
);

insert into public.payment_provider_health(provider, status)
values ('iyzico', 'unknown'), ('paytr', 'unknown'), ('stripe', 'unknown')
on conflict (provider) do nothing;

alter table public.payment_provider_events enable row level security;
alter table public.payment_reconciliation_logs enable row level security;
alter table public.accounting_entries enable row level security;
alter table public.payment_refund_operations enable row level security;
alter table public.payment_provider_health enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['payment_provider_events', 'payment_reconciliation_logs', 'accounting_entries', 'payment_refund_operations', 'payment_provider_health']
  loop
    execute format('drop policy if exists %I on public.%I', 'Admins can manage ' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.admin_users where admin_users.email = (auth.jwt() ->> ''email'') and admin_users.is_active = true)) with check (exists (select 1 from public.admin_users where admin_users.email = (auth.jwt() ->> ''email'') and admin_users.is_active = true))',
      'Admins can manage ' || t,
      t
    );
  end loop;
end $$;

drop policy if exists "Customers can view own payment_provider_events" on public.payment_provider_events;
create policy "Customers can view own payment_provider_events"
on public.payment_provider_events for select
to authenticated
using (customer_user_id = auth.uid());

drop policy if exists "Customers can view own payment_refund_operations" on public.payment_refund_operations;
create policy "Customers can view own payment_refund_operations"
on public.payment_refund_operations for select
to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = payment_refund_operations.order_id
      and orders.customer_user_id = auth.uid()
  )
);

create or replace function public.record_payment_reconciliation(
  p_order_id uuid,
  p_payment_status_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_expected_amount numeric,
  p_received_amount numeric,
  p_currency text,
  p_status text,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_id uuid;
begin
  insert into public.payment_reconciliation_logs (
    order_id,
    payment_status_id,
    provider,
    provider_payment_id,
    expected_amount,
    received_amount,
    currency,
    status,
    notes,
    metadata
  )
  values (
    p_order_id,
    p_payment_status_id,
    p_provider,
    p_provider_payment_id,
    p_expected_amount,
    p_received_amount,
    p_currency,
    p_status,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  update public.orders
  set payment_reconciliation_status = p_status
  where id = p_order_id;

  update public.shop_payment_statuses
  set reconciliation_status = p_status
  where id = p_payment_status_id;

  return v_id;
end;
$$;

create or replace function public.ensure_commerce_payment_financial_records(
  p_order_id uuid,
  p_payment_status_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_amount numeric,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_order public.orders%rowtype;
  v_invoice_id uuid;
  v_payment_id uuid;
  v_accounting_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found: %', p_order_id;
  end if;

  if v_order.payment_id is not null then
    select id into v_payment_id from public.payments where id = v_order.payment_id;
  end if;

  if v_order.invoice_id is not null then
    select id into v_invoice_id from public.invoices where id = v_order.invoice_id;
  end if;

  if v_invoice_id is null then
    insert into public.invoices (
      invoice_type,
      invoice_no,
      stakeholder_id,
      invoice_date,
      currency,
      subtotal,
      tax_total,
      grand_total,
      status,
      notes
    )
    values (
      'sales',
      'WEB-' || v_order.order_number,
      v_order.stakeholder_id,
      current_date,
      coalesce(p_currency, v_order.currency),
      v_order.subtotal,
      v_order.tax_total,
      v_order.grand_total,
      'paid',
      'E-ticaret ödeme sağlayıcısı ile oluşturuldu.'
    )
    on conflict do nothing
    returning id into v_invoice_id;

    if v_invoice_id is null then
      select id into v_invoice_id
      from public.invoices
      where invoice_no = 'WEB-' || v_order.order_number
      limit 1;
    end if;
  end if;

  if v_payment_id is null then
    insert into public.payments (
      payment_type,
      stakeholder_id,
      financial_account_id,
      amount,
      currency,
      payment_date,
      description,
      related_invoice_id
    )
    values (
      'collection',
      v_order.stakeholder_id,
      null,
      p_amount,
      coalesce(p_currency, v_order.currency),
      current_date,
      concat('E-ticaret ödeme tahsilatı: ', coalesce(p_provider, 'manual'), ' ', coalesce(p_provider_payment_id, '')),
      v_invoice_id
    )
    returning id into v_payment_id;
  end if;

  insert into public.accounting_entries (
    order_id,
    invoice_id,
    payment_id,
    entry_type,
    provider,
    external_reference,
    amount,
    currency,
    debit_account,
    credit_account,
    status,
    metadata
  )
  values (
    p_order_id,
    v_invoice_id,
    v_payment_id,
    'payment_received',
    p_provider,
    p_provider_payment_id,
    p_amount,
    coalesce(p_currency, v_order.currency),
    'payment_provider_clearing',
    'trade_receivables',
    'posted',
    jsonb_build_object('payment_status_id', p_payment_status_id)
  )
  on conflict do nothing
  returning id into v_accounting_id;

  update public.orders
  set
    payment_status = 'paid',
    payment_method = coalesce(p_provider, payment_method),
    payment_provider = p_provider,
    provider_payment_id = p_provider_payment_id,
    payment_id = v_payment_id,
    invoice_id = v_invoice_id,
    paid_at = coalesce(paid_at, now()),
    payment_reconciliation_status = case when abs(coalesce(p_amount, 0) - coalesce(grand_total, 0)) < 0.01 then 'matched' else 'mismatch' end
  where id = p_order_id;

  update public.shop_payment_statuses
  set
    status = 'paid',
    lifecycle_status = 'payment_received',
    verification_status = 'verified',
    reconciliation_status = case when abs(coalesce(p_amount, 0) - coalesce(v_order.grand_total, 0)) < 0.01 then 'matched' else 'mismatch' end,
    invoice_id = v_invoice_id,
    payment_id = v_payment_id
  where id = p_payment_status_id;

  perform public.record_payment_reconciliation(
    p_order_id,
    p_payment_status_id,
    p_provider,
    p_provider_payment_id,
    v_order.grand_total,
    p_amount,
    coalesce(p_currency, v_order.currency),
    case when abs(coalesce(p_amount, 0) - coalesce(v_order.grand_total, 0)) < 0.01 then 'matched' else 'mismatch' end,
    'Sağlayıcı ödeme doğrulaması işlendi.',
    jsonb_build_object('invoice_id', v_invoice_id, 'payment_id', v_payment_id)
  );

  return jsonb_build_object('invoice_id', v_invoice_id, 'payment_id', v_payment_id, 'accounting_entry_id', v_accounting_id);
end;
$$;

create or replace function internal.record_refund_operation_change()
returns trigger
language plpgsql
security definer
set search_path = public, internal
as $$
begin
  new.updated_at = now();

  if new.status in ('completed', 'provider_verified') and old.status is distinct from new.status then
    update public.shop_return_requests
    set refund_status = 'refund_completed', status = case when status = 'approved' then 'closed' else status end, updated_at = now()
    where id = new.return_request_id;

    update public.orders
    set refund_status = 'completed', payment_status = case when payment_status = 'paid' then 'refunded' else payment_status end, refunded_at = coalesce(refunded_at, now())
    where id = new.order_id;

    insert into public.accounting_entries (
      order_id,
      payment_id,
      refund_request_id,
      entry_type,
      provider,
      external_reference,
      amount,
      currency,
      debit_account,
      credit_account,
      status,
      metadata
    )
    select
      new.order_id,
      sps.payment_id,
      new.return_request_id,
      'refund_completed',
      new.provider,
      new.provider_refund_id,
      coalesce(new.approved_amount, new.requested_amount),
      new.currency,
      'sales_returns',
      'payment_provider_clearing',
      'posted',
      jsonb_build_object('payment_status_id', new.payment_status_id)
    from public.shop_payment_statuses sps
    where sps.id = new.payment_status_id
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_refund_operations_change on public.payment_refund_operations;
create trigger trg_payment_refund_operations_change
before update on public.payment_refund_operations
for each row execute function internal.record_refund_operation_change();

do $$
declare
  t text;
begin
  foreach t in array array['payment_refund_operations', 'payment_provider_health']
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

revoke all on function public.record_payment_reconciliation(uuid, uuid, text, text, numeric, numeric, text, text, text, jsonb) from public;
revoke all on function public.record_payment_reconciliation(uuid, uuid, text, text, numeric, numeric, text, text, text, jsonb) from anon;
revoke all on function public.record_payment_reconciliation(uuid, uuid, text, text, numeric, numeric, text, text, text, jsonb) from authenticated;
revoke all on function public.ensure_commerce_payment_financial_records(uuid, uuid, text, text, numeric, text) from public;
revoke all on function public.ensure_commerce_payment_financial_records(uuid, uuid, text, text, numeric, text) from anon;
revoke all on function public.ensure_commerce_payment_financial_records(uuid, uuid, text, text, numeric, text) from authenticated;
