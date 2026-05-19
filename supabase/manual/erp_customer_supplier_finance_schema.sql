-- Dayan Disli ERP - Customer, Supplier and Finance schema
-- Apply manually in Supabase SQL editor after review.
-- This migration is additive only: it does not delete, rewrite, or migrate existing quotation/customer tables.

create extension if not exists pgcrypto;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  party_type text not null check (party_type in ('customer', 'supplier', 'both')),
  entity_type text not null check (entity_type in ('individual', 'company')),
  title text not null,
  contact_name text,
  tax_or_identity_no text,
  tax_office text,
  phone text,
  email text,
  website text,
  address text,
  city text,
  district text,
  default_account_type text not null default 'official' check (default_account_type in ('official', 'operational')),
  currency text not null default 'TRY',
  payment_term_days integer not null default 0 check (payment_term_days >= 0),
  risk_limit numeric not null default 0 check (risk_limit >= 0),
  category text,
  tags text[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id),
  party_type text not null check (party_type in ('customer', 'supplier')),
  account_type text not null check (account_type in ('official', 'operational')),
  transaction_type text not null check (transaction_type in ('debit', 'credit', 'payment_in', 'payment_out', 'refund', 'adjustment')),
  direction text not null check (direction in ('in', 'out')),
  amount numeric not null check (amount >= 0),
  currency text not null default 'TRY',
  transaction_date date not null default current_date,
  due_date date,
  payment_method text check (payment_method in ('cash', 'bank_transfer', 'credit_card', 'cheque', 'promissory_note', 'other')),
  -- Keep nullable until existing order/quotation IDs are confirmed compatible with UUID references.
  order_id uuid,
  quotation_id uuid,
  reference_no text,
  description text,
  status text not null default 'completed' check (status in ('planned', 'pending', 'completed', 'cancelled')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.payment_documents (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id),
  transaction_id uuid references public.financial_transactions(id),
  document_type text not null check (document_type in ('cheque', 'promissory_note', 'receipt', 'bank_receipt', 'other')),
  document_no text,
  bank_name text,
  branch_name text,
  due_date date,
  amount numeric not null default 0 check (amount >= 0),
  currency text not null default 'TRY',
  status text not null default 'pending' check (status in ('pending', 'collected', 'paid', 'cancelled', 'returned')),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.party_notes (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id),
  note text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists idx_parties_party_type on public.parties(party_type);
create index if not exists idx_parties_title on public.parties(title);
create index if not exists idx_parties_tax_or_identity_no on public.parties(tax_or_identity_no);
create index if not exists idx_financial_transactions_party_id on public.financial_transactions(party_id);
create index if not exists idx_financial_transactions_transaction_date on public.financial_transactions(transaction_date);
create index if not exists idx_financial_transactions_account_type on public.financial_transactions(account_type);
create index if not exists idx_payment_documents_party_id on public.payment_documents(party_id);
create index if not exists idx_payment_documents_due_date on public.payment_documents(due_date);
create index if not exists idx_payment_documents_status on public.payment_documents(status);

drop trigger if exists trg_parties_updated_at on public.parties;
create trigger trg_parties_updated_at
before update on public.parties
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_financial_transactions_updated_at on public.financial_transactions;
create trigger trg_financial_transactions_updated_at
before update on public.financial_transactions
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_payment_documents_updated_at on public.payment_documents;
create trigger trg_payment_documents_updated_at
before update on public.payment_documents
for each row execute function public.update_updated_at_column();

alter table public.parties enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.payment_documents enable row level security;
alter table public.party_notes enable row level security;

drop policy if exists "Authenticated users can read parties" on public.parties;
create policy "Authenticated users can read parties"
on public.parties for select
to authenticated
using (deleted_at is null);

drop policy if exists "Authenticated users can insert parties" on public.parties;
create policy "Authenticated users can insert parties"
on public.parties for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update parties" on public.parties;
create policy "Authenticated users can update parties"
on public.parties for update
to authenticated
using (deleted_at is null)
with check (true);

drop policy if exists "Authenticated users can read financial transactions" on public.financial_transactions;
create policy "Authenticated users can read financial transactions"
on public.financial_transactions for select
to authenticated
using (deleted_at is null);

drop policy if exists "Authenticated users can insert financial transactions" on public.financial_transactions;
create policy "Authenticated users can insert financial transactions"
on public.financial_transactions for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update financial transactions" on public.financial_transactions;
create policy "Authenticated users can update financial transactions"
on public.financial_transactions for update
to authenticated
using (deleted_at is null)
with check (true);

drop policy if exists "Authenticated users can read payment documents" on public.payment_documents;
create policy "Authenticated users can read payment documents"
on public.payment_documents for select
to authenticated
using (deleted_at is null);

drop policy if exists "Authenticated users can insert payment documents" on public.payment_documents;
create policy "Authenticated users can insert payment documents"
on public.payment_documents for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update payment documents" on public.payment_documents;
create policy "Authenticated users can update payment documents"
on public.payment_documents for update
to authenticated
using (deleted_at is null)
with check (true);

drop policy if exists "Authenticated users can read party notes" on public.party_notes;
create policy "Authenticated users can read party notes"
on public.party_notes for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert party notes" on public.party_notes;
create policy "Authenticated users can insert party notes"
on public.party_notes for insert
to authenticated
with check (true);

comment on table public.parties is 'Unified customer/supplier party cards for ERP. Existing customer_profile and quotation data remain untouched.';
comment on table public.financial_transactions is 'Audit-friendly simple ledger for customer/supplier account movements. No hard deletes are required by the UI.';
comment on column public.financial_transactions.order_id is 'Nullable until existing order IDs are formally linked.';
comment on column public.financial_transactions.quotation_id is 'Nullable until existing quotation IDs are formally linked.';
