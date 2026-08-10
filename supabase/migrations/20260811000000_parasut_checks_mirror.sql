-- Adds `parasut.checks` — the Paraşüt "Çek/Senet" (cheque) resource.
--
-- Table shape follows the ORIGINAL foundation-migration convention
-- (20260713120000_parasut_mirror_schema_foundation.sql: attributes/
-- relationships/included JSONB + raw_payload + bookkeeping), NOT the
-- later 20260723103525 "full apidocs" convention (typed-columns-only, no
-- attributes/relationships/included). That later convention is
-- INCOMPATIBLE with the actual write path: upsert-resource.ts
-- unconditionally writes `attributes`, `relationships`, and `included`
-- into every row it inserts/updates, and every one of those 20260723
-- tables (bank_fees, taxes, salaries, ...) has zero synced rows in
-- production today — this project has never actually round-tripped a
-- write through that table shape. `checks` mirrors the ONE table shape
-- that has: contacts/products/sales_invoices/purchase_bills/accounts,
-- all foundation-style, all currently syncing successfully.
--
-- Typed columns below are added for query/reporting convenience and to
-- satisfy the finance vertical slice's explicit field list, but — same
-- precedent as `contacts` (see field-mapping-registry.ts:
-- `currentlyMappedByProduction` is false for every contacts column
-- except the 4 balance numerics) — only the numeric columns are actually
-- populated by the write path via `numericAttributeFields`
-- (server/parasut/sync-checks.ts). Non-numeric fields (currency,
-- due_date, is_in, is_out, ...) remain sourced from the `attributes`
-- JSONB column for all read paths (parasut-api handlers already read
-- sales_invoices/purchase_bills the same way), not from these typed
-- columns, unless/until this resource is added to
-- TYPED_MAPPING_SCOPED_RESOURCES in a future pass.

create table parasut.checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'checks'),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  relationships jsonb not null default '{}'::jsonb check (jsonb_typeof(relationships) = 'object'),
  included jsonb not null default '[]'::jsonb check (jsonb_typeof(included) = 'array'),
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),

  -- typed columns (see header comment: numeric ones are the only ones
  -- the write path currently populates; the rest exist for future use
  -- and ad-hoc SQL querying against raw_payload/attributes in the
  -- meantime).
  "net_total" numeric,
  "remaining" numeric,
  "remaining_in_trl" numeric,
  "days_overdue" numeric,
  "days_till_due_date" numeric,
  "currency" text check ("currency" in ('TRL', 'USD', 'EUR', 'GBP') or "currency" is null),
  "issue_date" date,
  "due_date" date,
  "payment_status" text,
  "is_in" boolean,
  "is_out" boolean,
  "is_cashed" boolean,
  "is_transferred" boolean,
  "bank_identifier" text,
  "bank_name" text,
  "serial_number" text,
  "description" text,

  -- relationships (issued_by / given_to -> contacts)
  "issued_by_parasut_id" text,
  "given_to_parasut_id" text,

  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create index checks_company_source_updated_idx on parasut.checks (company_id, source_updated_at desc);
create index checks_company_last_seen_idx on parasut.checks (company_id, last_seen_at desc);
create index checks_archived_idx on parasut.checks (company_id, source_archived) where source_archived = true;

do $$
begin
  if to_regprocedure('public.erp_set_updated_at()') is null then
    raise exception 'Required function public.erp_set_updated_at() is missing';
  end if;

  execute 'create trigger checks_set_updated_at before update on parasut.checks for each row execute function public.erp_set_updated_at()';
end $$;

-- RLS: same default-deny, service_role-only posture as every other parasut.* table.
alter table parasut.checks enable row level security;
revoke all on table parasut.checks from anon;
revoke all on table parasut.checks from authenticated;
grant all on table parasut.checks to service_role;
