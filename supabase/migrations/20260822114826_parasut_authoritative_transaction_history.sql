-- Authoritative Paraşüt contact statement mirror. Additive only: existing
-- financial mirror rows are neither rewritten nor deleted.

alter table parasut.transactions
  add column if not exists contact_parasut_id text,
  add column if not exists unmatched_debit_amount numeric,
  add column if not exists unmatched_credit_amount numeric,
  add column if not exists check_parasut_id text,
  add column if not exists sales_invoice_parasut_id text,
  add column if not exists purchase_bill_parasut_id text,
  add column if not exists reimbursement_purchase_bill_parasut_id text,
  add column if not exists opening_balance_parasut_id text,
  add column if not exists contact_transfer_parasut_id text,
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists relationships jsonb not null default '{}'::jsonb,
  add column if not exists included jsonb not null default '[]'::jsonb;

create index if not exists transactions_contact_date_idx
  on parasut.transactions (parasut_company_id, contact_parasut_id, date, parasut_id);
create index if not exists transactions_check_idx
  on parasut.transactions (parasut_company_id, check_parasut_id)
  where check_parasut_id is not null;
create index if not exists transactions_opening_balance_idx
  on parasut.transactions (parasut_company_id, opening_balance_parasut_id)
  where opening_balance_parasut_id is not null;

create table parasut.transaction_history_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_company_id text not null,
  parasut_id text not null,
  resource_type text not null default 'transaction_history_items'
    check (resource_type = 'transaction_history_items'),
  contact_parasut_id text not null,
  transaction_parasut_id text not null,
  statement_order bigint not null,
  transaction_date date,
  trl_balance numeric,
  usd_balance numeric,
  eur_balance numeric,
  gbp_balance numeric,
  attributes jsonb not null default '{}'::jsonb,
  relationships jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parasut_company_id, contact_parasut_id, parasut_id),
  unique (parasut_company_id, contact_parasut_id, transaction_parasut_id)
);

create index transaction_history_items_contact_order_idx
  on parasut.transaction_history_items
  (parasut_company_id, contact_parasut_id, statement_order, parasut_id);
create index transaction_history_items_transaction_idx
  on parasut.transaction_history_items (parasut_company_id, transaction_parasut_id);

create table parasut.opening_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_company_id text not null,
  parasut_id text not null,
  resource_type text not null default 'opening_balances'
    check (resource_type = 'opening_balances'),
  contact_parasut_id text,
  currency text,
  description text,
  issue_date date,
  debit_credit_type text,
  net_total numeric,
  remaining numeric,
  attributes jsonb not null default '{}'::jsonb,
  relationships jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parasut_company_id, parasut_id)
);

create index opening_balances_contact_date_idx
  on parasut.opening_balances (parasut_company_id, contact_parasut_id, issue_date, parasut_id);

-- Payment identities remain subordinate and non-balance-impacting. These
-- columns already exist in current installs; repeat add-if-missing for safe
-- upgrades from older migration histories.
alter table parasut.payments
  add column if not exists payable_parasut_id text,
  add column if not exists transaction_parasut_id text;
create index if not exists payments_transaction_idx
  on parasut.payments (parasut_company_id, transaction_parasut_id)
  where transaction_parasut_id is not null;

alter table parasut.transaction_history_items enable row level security;
alter table parasut.opening_balances enable row level security;
revoke all on table parasut.transaction_history_items from anon, authenticated;
revoke all on table parasut.opening_balances from anon, authenticated;
grant all on table parasut.transaction_history_items to service_role;
grant all on table parasut.opening_balances to service_role;

do $$
begin
  if to_regprocedure('public.erp_set_updated_at()') is not null then
    execute 'create trigger transaction_history_items_set_updated_at before update on parasut.transaction_history_items for each row execute function public.erp_set_updated_at()';
    execute 'create trigger opening_balances_set_updated_at before update on parasut.opening_balances for each row execute function public.erp_set_updated_at()';
  end if;
end $$;
