-- Sales quotes module: real, persisted, PDF-capable quotes for the ERP.
-- Entirely local to this database — never written to or read from Parasut.
-- Additive only: no existing table is dropped, altered destructively, or
-- truncated.

begin;

-- ---------------------------------------------------------------------
-- Local-only quote customers: for prospects/one-off buyers that are not
-- (and must never become) a real Parasut contact. A quote referencing one
-- of these rows is the only durable record of that customer relationship.
-- ---------------------------------------------------------------------
create table if not exists public.quote_customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text null,
  phone text null,
  email text null,
  address text null,
  tax_no text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no text not null unique,
  issuer text not null check (issuer in ('dayan', 'ceha')),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  subject text not null default '',

  -- Exactly one of parasut_customer_id / local_customer_id is set, enforced
  -- below — a quote is always attributable to exactly one real customer
  -- identity, never both, never neither.
  customer_source text not null check (customer_source in ('parasut', 'local')),
  parasut_customer_id text null,
  local_customer_id uuid null references public.quote_customers(id),

  -- Snapshot of the customer's contact details at quote creation time, so a
  -- later edit to the Parasut contact or local customer record never
  -- silently rewrites the history of an already-issued quote.
  customer_name text not null,
  customer_contact text null,
  customer_phone text null,
  customer_email text null,
  customer_address text null,
  customer_tax_no text null,

  issue_date date not null default current_date,
  valid_until date null,
  payment_terms text null,
  delivery_terms text null,
  delivery_time text null,
  notes text null,

  subtotal numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  vat_total numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,

  converted_order_no text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint quotes_customer_source_consistency check (
    (customer_source = 'parasut' and parasut_customer_id is not null and local_customer_id is null)
    or (customer_source = 'local' and local_customer_id is not null and parasut_customer_id is null)
  )
);

create table if not exists public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position integer not null default 0,
  description text not null default '',
  detail text null,
  quantity numeric(14, 3) not null default 1,
  unit text not null default 'Adet',
  unit_price numeric(14, 2) not null default 0,
  discount_pct numeric(5, 2) not null default 0,
  vat_pct numeric(5, 2) not null default 20,
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- "Geçmiş teklif ekle": lets an old, pre-ERP quote be attached to a
-- customer's history without fabricating a full quotes/quote_lines record
-- for it and without ever writing to Parasut.
create table if not exists public.quote_history_entries (
  id uuid primary key default gen_random_uuid(),
  customer_source text not null check (customer_source in ('parasut', 'local')),
  parasut_customer_id text null,
  local_customer_id uuid null references public.quote_customers(id),
  quote_no text null,
  quote_date date null,
  amount numeric(14, 2) null,
  currency text null,
  note text null,
  created_at timestamptz not null default now(),
  constraint quote_history_entries_customer_source_consistency check (
    (customer_source = 'parasut' and parasut_customer_id is not null and local_customer_id is null)
    or (customer_source = 'local' and local_customer_id is not null and parasut_customer_id is null)
  )
);

create index if not exists idx_quotes_customer_source on public.quotes(customer_source, parasut_customer_id);
create index if not exists idx_quotes_local_customer on public.quotes(local_customer_id);
create index if not exists idx_quotes_status on public.quotes(status);
create index if not exists idx_quote_lines_quote on public.quote_lines(quote_id, position);
create index if not exists idx_quote_history_parasut_customer on public.quote_history_entries(parasut_customer_id);
create index if not exists idx_quote_history_local_customer on public.quote_history_entries(local_customer_id);

drop trigger if exists trg_quote_customers_updated_at on public.quote_customers;
create trigger trg_quote_customers_updated_at
before update on public.quote_customers
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
before update on public.quotes
for each row execute function public.erp_set_updated_at();

-- ---------------------------------------------------------------------
-- Concurrency-safe quote numbering: DY-YYYYMM-N / CH-YYYYMM-N, per
-- issuer+month. A single atomic UPSERT (unique constraint on
-- sequence_key) is the only writer of current_value, so two simultaneous
-- requests for the same issuer/month can never receive the same number —
-- the second writer blocks on the first's row lock and reads the
-- already-incremented value.
-- ---------------------------------------------------------------------
create table if not exists public.quote_number_sequences (
  id uuid primary key default gen_random_uuid(),
  sequence_key text unique not null,
  current_value integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.next_quote_number(p_issuer text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_period text;
  v_key text;
  v_next integer;
begin
  v_prefix := case p_issuer
    when 'dayan' then 'DY'
    when 'ceha' then 'CH'
    else null
  end;
  if v_prefix is null then
    raise exception 'Unknown quote issuer: %', p_issuer;
  end if;

  v_period := to_char(now(), 'YYYYMM');
  v_key := v_prefix || '-' || v_period;

  insert into public.quote_number_sequences (sequence_key, current_value)
  values (v_key, 1)
  on conflict (sequence_key) do update
  set current_value = public.quote_number_sequences.current_value + 1,
      updated_at = now()
  returning current_value into v_next;

  return v_key || '-' || v_next::text;
end;
$$;

revoke all on function public.next_quote_number(text) from public;
grant execute on function public.next_quote_number(text) to authenticated;

-- ---------------------------------------------------------------------
-- RLS — same "trusted authenticated ERP staff" model already used by the
-- CRM tables (public.crm_leads / crm_opportunities / crm_tasks /
-- crm_activities, see 20260601120000_crm_sales_workflows.sql): every
-- authenticated session is ERP staff, so full read/write is granted to
-- `authenticated`. quote_number_sequences is intentionally left with RLS
-- enabled and NO policies — it is only ever touched through the
-- security-definer next_quote_number() function above, never directly.
-- ---------------------------------------------------------------------
alter table public.quote_customers enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.quote_history_entries enable row level security;
alter table public.quote_number_sequences enable row level security;

drop policy if exists "erp authenticated read quote_customers" on public.quote_customers;
create policy "erp authenticated read quote_customers" on public.quote_customers for select to authenticated using (true);
drop policy if exists "erp authenticated write quote_customers" on public.quote_customers;
create policy "erp authenticated write quote_customers" on public.quote_customers for all to authenticated using (true) with check (true);

drop policy if exists "erp authenticated read quotes" on public.quotes;
create policy "erp authenticated read quotes" on public.quotes for select to authenticated using (true);
drop policy if exists "erp authenticated write quotes" on public.quotes;
create policy "erp authenticated write quotes" on public.quotes for all to authenticated using (true) with check (true);

drop policy if exists "erp authenticated read quote_lines" on public.quote_lines;
create policy "erp authenticated read quote_lines" on public.quote_lines for select to authenticated using (true);
drop policy if exists "erp authenticated write quote_lines" on public.quote_lines;
create policy "erp authenticated write quote_lines" on public.quote_lines for all to authenticated using (true) with check (true);

drop policy if exists "erp authenticated read quote_history_entries" on public.quote_history_entries;
create policy "erp authenticated read quote_history_entries" on public.quote_history_entries for select to authenticated using (true);
drop policy if exists "erp authenticated write quote_history_entries" on public.quote_history_entries;
create policy "erp authenticated write quote_history_entries" on public.quote_history_entries for all to authenticated using (true) with check (true);

commit;
