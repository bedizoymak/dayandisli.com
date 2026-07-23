-- PROPOSED — NOT YET APPLIED, AND NOT AN ACTIVE MIGRATION.
--
-- This file intentionally lives under docs/migration-proposals/, NOT
-- supabase/migrations/, per the established convention in this same
-- directory (assign_erp_company_id.sql,
-- 20260716090000_move_sync_tables_to_parasut_schema.sql,
-- 20260716130000_accounting_outbound_commands.sql) — proposals only move
-- into supabase/migrations/ once explicitly approved and applied. This has
-- NOT been applied to any database. Only move (copy) this file into
-- supabase/migrations/ once explicitly approved, immediately before
-- applying it.
--
-- Intent: expand the `parasut` schema so every one of the 24 distinct
-- top-level resources in Paraşüt's own API v4 documentation
-- (https://apidocs.parasut.com/ → swagger.json) has a mirror table, with
-- one real, typed SQL column per documented attribute/relationship —
-- matching the swagger `*Attributes` definitions field-for-field — instead
-- of a generic JSONB attributes blob. Column names are identical to the
-- API's own attribute names so future sync code can map
-- `attributes.<field>` straight onto `<column>` without translation.
--
-- Generated from the live swagger.json (Paraşüt API V4, version 4.0.0) via
-- a one-off extraction script; every column/type/enum/relationship below
-- was mechanically derived from that spec, not hand-guessed. `numeric`
-- currency fields (e.g. Payment.currency) that look like they should be
-- text are intentionally left as the API's own documented type.
--
-- Split into two parts for safety:
--
-- PART 1 — 20 genuinely new resources (bank_fees, e_archives,
-- e_invoice_inboxes, e_invoices, e_smms, employees, item_categories,
-- inventory_levels, salaries, sales_offers, sales_offers_details,
-- shipment_documents, stock_movements, stock_updates,
-- stock_update_details, tags, taxes, trackable_jobs, transactions,
-- warehouses): plain CREATE TABLE, following the exact bookkeeping-column
-- convention established in
-- supabase/migrations/20260713120000_parasut_mirror_schema_foundation.sql
-- (id, company_id, parasut_id, parasut_company_id, resource_type,
-- source_created_at/updated_at/archived, raw_payload, first_seen_at,
-- last_seen_at, synced_at, payload_hash, created_at, updated_at, unique
-- constraint), plus the same index trio and RLS default-deny posture
-- (service_role only — `parasut` is not a PostgREST-exposed schema, this
-- is defense-in-depth).
--
-- PART 2 — the 8 resources that already have a mirror table (accounts,
-- contacts, products, sales_invoices, sales_invoice_details,
-- purchase_bills, purchase_bill_details, payments): ADD COLUMN IF NOT
-- EXISTS only. No DROP, no data rewrite, existing rows untouched. NOT NULL
-- is deliberately omitted here even for API-required fields, because
-- ADD COLUMN ... NOT NULL without a DEFAULT fails outright against a
-- table that may already hold synced rows, and even with a DEFAULT it's
-- still safer to backfill first. Tighten to NOT NULL in a follow-up
-- migration once existing rows (if any — verify row counts first) are
-- backfilled from their existing `attributes`/`raw_payload` JSONB.
--
-- What this migration deliberately does NOT do:
--   - It does not touch the two existing `parasut.sync_runs` /
--     `parasut.sync_errors` tables.
--   - It does not backfill any of the new typed columns from the
--     existing `attributes`/`raw_payload` JSONB on the 8 existing tables
--     — that is a data migration, tracked separately, and needs its own
--     review since it reads/rewrites existing rows.
--   - It does not touch the old, likely-orphaned `public.parasut_*`
--     table set from the original 2026-06-13 foundation migration (see
--     supabase/tests/parasut_mirror_rls.test.sql, which still targets
--     that older set, not this one) — that's a separate cleanup item.

-- ============================================================
-- PART 1: brand-new resource tables (CREATE TABLE)
-- ============================================================

create table parasut.bank_fees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'bank_fees'),

  -- attributes
  "total_paid" numeric,
  "remaining" numeric,
  "remaining_in_trl" numeric,
  "description" text not null,
  "currency" text check ("currency" in ('TRL', 'USD', 'EUR', 'GBP') or "currency" is null) not null,
  "issue_date" date not null,
  "due_date" date not null,
  "exchange_rate" numeric,
  "net_total" numeric not null,

  -- relationships
  "category_parasut_id" text,
  "tags" jsonb not null default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.e_archives (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'e_archives'),

  -- attributes
  "uuid" text,
  "vkn" text,
  "invoice_number" text,
  "note" text,
  "is_printed" boolean,
  "status" text check ("status" in ('bounced', 'sent', 'printed', 'legalized') or "status" is null),
  "printed_at" timestamptz,
  "cancellable_until" timestamptz,
  "is_signed" boolean,

  -- relationships
  "sales_invoice_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.e_invoice_inboxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'e_invoice_inboxes'),

  -- attributes
  "vkn" text,
  "e_invoice_address" text,
  "name" text,
  "inbox_type" text,
  "address_registered_at" timestamptz,
  "registered_at" timestamptz,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.e_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'e_invoices'),

  -- attributes
  "external_id" text,
  "uuid" text,
  "env_uuid" text,
  "from_address" text,
  "from_vkn" text,
  "to_address" text,
  "to_vkn" text,
  "direction" text check ("direction" in ('inbound', 'outbound') or "direction" is null),
  "note" text,
  "response_type" text check ("response_type" in ('accepted', 'rejected', 'refunded') or "response_type" is null),
  "contact_name" text,
  "scenario" text check ("scenario" in ('basic', 'commercial') or "scenario" is null),
  "status" text check ("status" in ('waiting', 'failed', 'successful') or "status" is null),
  "gtb_ref_no" text,
  "gtb_registration_no" text,
  "gtb_export_date" date,
  "response_note" text,
  "issue_date" date,
  "is_expired" boolean,
  "is_answerable" boolean,
  "net_total" numeric,
  "currency" text check ("currency" in ('TRL', 'USD', 'EUR', 'GBP') or "currency" is null),
  "item_type" text check ("item_type" in ('refund', 'invoice') or "item_type" is null),

  -- relationships
  "invoice_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.e_smms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'e_smms'),

  -- attributes
  "printed_at" date,
  "uuid" text,
  "vkn" text,
  "invoice_number" numeric,
  "is_printed" boolean,
  "pdf_url" text,

  -- relationships
  "sales_invoice_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'employees'),

  -- attributes
  "balance" numeric,
  "trl_balance" numeric,
  "usd_balance" numeric,
  "eur_balance" numeric,
  "gbp_balance" numeric,
  "name" text not null,
  "email" text,
  "iban" text,

  -- relationships
  "category_parasut_id" text,
  "managed_by_user_parasut_id" text,
  "managed_by_user_role_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.item_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'item_categories'),

  -- attributes
  "full_path" text,
  "name" text not null,
  "bg_color" text,
  "text_color" text,
  "category_type" text check ("category_type" in ('Product', 'Contact', 'Employee', 'SalesInvoice', 'Expenditure') or "category_type" is null) not null,
  "parent_id" bigint,

  -- relationships
  "parent_category_parasut_id" text,
  "subcategories" jsonb not null default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'inventory_levels'),

  -- attributes
  "stock_count" numeric,
  "initial_stock_count" numeric,
  "critical_stock_count" numeric,

  -- relationships
  "product_parasut_id" text,
  "warehouse_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.salaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'salaries'),

  -- attributes
  "total_paid" numeric,
  "remaining" numeric,
  "remaining_in_trl" numeric,
  "description" text not null,
  "currency" text check ("currency" in ('TRL', 'USD', 'EUR', 'GBP') or "currency" is null) not null,
  "issue_date" date not null,
  "due_date" date not null,
  "exchange_rate" numeric,
  "net_total" numeric not null,

  -- relationships
  "employee_parasut_id" text,
  "category_parasut_id" text,
  "tags" jsonb not null default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.sales_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'sales_offers'),

  -- attributes
  "content" text,
  "contact_type" text,
  "sharings_count" numeric,
  "status" text,
  "display_exchange_rate_in_pdf" boolean,
  "net_total" numeric,
  "gross_total" numeric,
  "withholding" numeric,
  "total_excise_duty" numeric,
  "total_communications_tax" numeric,
  "total_accommodation_tax" numeric,
  "total_vat" numeric,
  "total_vat_withholding" numeric,
  "vat_withholding" numeric,
  "total_discount" numeric,
  "total_invoice_discount" numeric,
  "description" text,
  "issue_date" date not null,
  "due_date" date,
  "currency" text check ("currency" in ('TRL', 'USD', 'EUR', 'GBP') or "currency" is null),
  "exchange_rate" numeric,
  "withholding_rate" numeric,
  "invoice_discount_type" text check ("invoice_discount_type" in ('percentage', 'amount') or "invoice_discount_type" is null),
  "invoice_discount" numeric,
  "billing_address" text,
  "billing_phone" text,
  "billing_fax" text,
  "tax_office" text,
  "tax_number" text,
  "city" text,
  "district" text,
  "is_abroad" boolean,
  "order_no" text,
  "order_date" date,

  -- relationships
  "sales_invoice_parasut_id" text,
  "contact_parasut_id" text,
  "details" jsonb not null default '[]'::jsonb,
  "activities" jsonb not null default '[]'::jsonb,
  "sharings" jsonb not null default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.sales_offers_details (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'sales_offers_details'),

  -- attributes
  "description" text,
  "net_total" numeric,
  "unit_price" numeric,
  "vat_rate" numeric,
  "quantity" numeric,
  "discount_type" text,
  "discount_value" numeric,
  "communications_tax_rate" numeric,
  "excise_duty_type" text,
  "invoice_discount" numeric,
  "excise_duty" numeric,
  "excise_duty_rate" numeric,
  "discount" numeric,
  "communications_tax" numeric,
  "detail_no" numeric,
  "net_total_without_invoice_discount" numeric,
  "vat_withholding" numeric,
  "vat_withholding_rate" numeric,
  "accommodation_tax_rate" numeric,
  "accommodation_tax" numeric,
  "accommodation_tax_exempt" boolean,
  "excise_duty_value" numeric,

  -- relationships
  "product_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.shipment_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'shipment_documents'),

  -- attributes
  "invoice_no" text,
  "print_note" text,
  "printed_at" timestamptz,
  "inflow" boolean,
  "description" text,
  "city" text,
  "district" text,
  "address" text,
  "issue_date" date not null,
  "shipment_date" timestamptz,
  "procurement_number" text,

  -- relationships
  "contact_parasut_id" text,
  "tags" jsonb not null default '[]'::jsonb,
  "stock_movements" jsonb not null default '[]'::jsonb,
  "invoices" jsonb not null default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'stock_movements'),

  -- attributes
  "detail_no" numeric,
  "date" date,
  "quantity" numeric not null,

  -- relationships
  "warehouse_parasut_id" text,
  "product_parasut_id" text,
  "source_parasut_id" text,
  "contact_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.stock_updates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'stock_updates'),

  -- attributes

  -- relationships
  "details" jsonb not null default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.stock_update_details (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'stock_update_details'),

  -- attributes
  "old_total_inventory" numeric,
  "new_total_inventory" numeric not null,

  -- relationships
  "warehouse_parasut_id" text,
  "product_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'tags'),

  -- attributes
  "name" text not null,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.taxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'taxes'),

  -- attributes
  "total_paid" numeric,
  "remaining" numeric,
  "remaining_in_trl" numeric,
  "description" text not null,
  "issue_date" date not null,
  "due_date" date not null,
  "net_total" numeric not null,

  -- relationships
  "category_parasut_id" text,
  "tags" jsonb not null default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.trackable_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'trackable_jobs'),

  -- attributes
  "status" text check ("status" in ('running', 'done', 'error') or "status" is null),
  "errors" jsonb default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'transactions'),

  -- attributes
  "description" text,
  "transaction_type" text,
  "date" date,
  "amount_in_trl" numeric,
  "debit_amount" numeric,
  "debit_currency" text check ("debit_currency" in ('TRL', 'USD', 'EUR', 'GBP') or "debit_currency" is null),
  "credit_amount" numeric,
  "credit_currency" text check ("credit_currency" in ('TRL', 'USD', 'EUR', 'GBP') or "credit_currency" is null),

  -- relationships
  "debit_account_parasut_id" text,
  "credit_account_parasut_id" text,
  "payments" jsonb not null default '[]'::jsonb,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

create table parasut.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  parasut_id text not null,
  parasut_company_id text not null,
  resource_type text not null check (resource_type = 'warehouses'),

  -- attributes
  "name" text not null,
  "address" text,
  "city" text,
  "district" text,
  "is_abroad" boolean,

  -- relationships
  "inventory_levels_parasut_id" text,

  -- sync bookkeeping
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_archived boolean,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (parasut_company_id, resource_type, parasut_id)
);

-- Indexes for new tables
create index bank_fees_company_source_updated_idx on parasut.bank_fees (company_id, source_updated_at desc);
create index bank_fees_company_last_seen_idx on parasut.bank_fees (company_id, last_seen_at desc);
create index bank_fees_archived_idx on parasut.bank_fees (company_id, source_archived) where source_archived = true;
create index e_archives_company_source_updated_idx on parasut.e_archives (company_id, source_updated_at desc);
create index e_archives_company_last_seen_idx on parasut.e_archives (company_id, last_seen_at desc);
create index e_invoice_inboxes_company_source_updated_idx on parasut.e_invoice_inboxes (company_id, source_updated_at desc);
create index e_invoice_inboxes_company_last_seen_idx on parasut.e_invoice_inboxes (company_id, last_seen_at desc);
create index e_invoices_company_source_updated_idx on parasut.e_invoices (company_id, source_updated_at desc);
create index e_invoices_company_last_seen_idx on parasut.e_invoices (company_id, last_seen_at desc);
create index e_smms_company_source_updated_idx on parasut.e_smms (company_id, source_updated_at desc);
create index e_smms_company_last_seen_idx on parasut.e_smms (company_id, last_seen_at desc);
create index employees_company_source_updated_idx on parasut.employees (company_id, source_updated_at desc);
create index employees_company_last_seen_idx on parasut.employees (company_id, last_seen_at desc);
create index employees_archived_idx on parasut.employees (company_id, source_archived) where source_archived = true;
create index item_categories_company_source_updated_idx on parasut.item_categories (company_id, source_updated_at desc);
create index item_categories_company_last_seen_idx on parasut.item_categories (company_id, last_seen_at desc);
create index inventory_levels_company_source_updated_idx on parasut.inventory_levels (company_id, source_updated_at desc);
create index inventory_levels_company_last_seen_idx on parasut.inventory_levels (company_id, last_seen_at desc);
create index salaries_company_source_updated_idx on parasut.salaries (company_id, source_updated_at desc);
create index salaries_company_last_seen_idx on parasut.salaries (company_id, last_seen_at desc);
create index salaries_archived_idx on parasut.salaries (company_id, source_archived) where source_archived = true;
create index sales_offers_company_source_updated_idx on parasut.sales_offers (company_id, source_updated_at desc);
create index sales_offers_company_last_seen_idx on parasut.sales_offers (company_id, last_seen_at desc);
create index sales_offers_archived_idx on parasut.sales_offers (company_id, source_archived) where source_archived = true;
create index sales_offers_details_company_source_updated_idx on parasut.sales_offers_details (company_id, source_updated_at desc);
create index sales_offers_details_company_last_seen_idx on parasut.sales_offers_details (company_id, last_seen_at desc);
create index shipment_documents_company_source_updated_idx on parasut.shipment_documents (company_id, source_updated_at desc);
create index shipment_documents_company_last_seen_idx on parasut.shipment_documents (company_id, last_seen_at desc);
create index shipment_documents_archived_idx on parasut.shipment_documents (company_id, source_archived) where source_archived = true;
create index stock_movements_company_source_updated_idx on parasut.stock_movements (company_id, source_updated_at desc);
create index stock_movements_company_last_seen_idx on parasut.stock_movements (company_id, last_seen_at desc);
create index stock_updates_company_source_updated_idx on parasut.stock_updates (company_id, source_updated_at desc);
create index stock_updates_company_last_seen_idx on parasut.stock_updates (company_id, last_seen_at desc);
create index stock_update_details_company_source_updated_idx on parasut.stock_update_details (company_id, source_updated_at desc);
create index stock_update_details_company_last_seen_idx on parasut.stock_update_details (company_id, last_seen_at desc);
create index tags_company_source_updated_idx on parasut.tags (company_id, source_updated_at desc);
create index tags_company_last_seen_idx on parasut.tags (company_id, last_seen_at desc);
create index taxes_company_source_updated_idx on parasut.taxes (company_id, source_updated_at desc);
create index taxes_company_last_seen_idx on parasut.taxes (company_id, last_seen_at desc);
create index taxes_archived_idx on parasut.taxes (company_id, source_archived) where source_archived = true;
create index trackable_jobs_company_source_updated_idx on parasut.trackable_jobs (company_id, source_updated_at desc);
create index trackable_jobs_company_last_seen_idx on parasut.trackable_jobs (company_id, last_seen_at desc);
create index transactions_company_source_updated_idx on parasut.transactions (company_id, source_updated_at desc);
create index transactions_company_last_seen_idx on parasut.transactions (company_id, last_seen_at desc);
create index warehouses_company_source_updated_idx on parasut.warehouses (company_id, source_updated_at desc);
create index warehouses_company_last_seen_idx on parasut.warehouses (company_id, last_seen_at desc);
create index warehouses_archived_idx on parasut.warehouses (company_id, source_archived) where source_archived = true;

-- updated_at triggers for new tables
create trigger bank_fees_set_updated_at before update on parasut.bank_fees for each row execute function public.erp_set_updated_at();
create trigger e_archives_set_updated_at before update on parasut.e_archives for each row execute function public.erp_set_updated_at();
create trigger e_invoice_inboxes_set_updated_at before update on parasut.e_invoice_inboxes for each row execute function public.erp_set_updated_at();
create trigger e_invoices_set_updated_at before update on parasut.e_invoices for each row execute function public.erp_set_updated_at();
create trigger e_smms_set_updated_at before update on parasut.e_smms for each row execute function public.erp_set_updated_at();
create trigger employees_set_updated_at before update on parasut.employees for each row execute function public.erp_set_updated_at();
create trigger item_categories_set_updated_at before update on parasut.item_categories for each row execute function public.erp_set_updated_at();
create trigger inventory_levels_set_updated_at before update on parasut.inventory_levels for each row execute function public.erp_set_updated_at();
create trigger salaries_set_updated_at before update on parasut.salaries for each row execute function public.erp_set_updated_at();
create trigger sales_offers_set_updated_at before update on parasut.sales_offers for each row execute function public.erp_set_updated_at();
create trigger sales_offers_details_set_updated_at before update on parasut.sales_offers_details for each row execute function public.erp_set_updated_at();
create trigger shipment_documents_set_updated_at before update on parasut.shipment_documents for each row execute function public.erp_set_updated_at();
create trigger stock_movements_set_updated_at before update on parasut.stock_movements for each row execute function public.erp_set_updated_at();
create trigger stock_updates_set_updated_at before update on parasut.stock_updates for each row execute function public.erp_set_updated_at();
create trigger stock_update_details_set_updated_at before update on parasut.stock_update_details for each row execute function public.erp_set_updated_at();
create trigger tags_set_updated_at before update on parasut.tags for each row execute function public.erp_set_updated_at();
create trigger taxes_set_updated_at before update on parasut.taxes for each row execute function public.erp_set_updated_at();
create trigger trackable_jobs_set_updated_at before update on parasut.trackable_jobs for each row execute function public.erp_set_updated_at();
create trigger transactions_set_updated_at before update on parasut.transactions for each row execute function public.erp_set_updated_at();
create trigger warehouses_set_updated_at before update on parasut.warehouses for each row execute function public.erp_set_updated_at();

-- ============================================================
-- PART 2: existing tables — additive columns only, no drops,
-- no data touched (ALTER TABLE ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- accounts: additive only, existing table/data untouched.
-- NOT NULL is intentionally dropped here even where the API marks a field
-- required — ADD COLUMN ... NOT NULL fails/is unsafe against a table that
-- may already hold synced rows with no value for the new column. Add NOT
-- NULL back in a follow-up migration once existing rows are backfilled.
alter table parasut.accounts add column if not exists "used_for" text;
alter table parasut.accounts add column if not exists "last_used_at" timestamptz;
alter table parasut.accounts add column if not exists "balance" numeric;
alter table parasut.accounts add column if not exists "last_adjustment_date" timestamptz;
alter table parasut.accounts add column if not exists "bank_integration_type" text;
alter table parasut.accounts add column if not exists "associate_email" text;
alter table parasut.accounts add column if not exists "name" text;
alter table parasut.accounts add column if not exists "currency" text check ("currency" in ('TRL', 'USD', 'EUR', 'GBP') or "currency" is null);
alter table parasut.accounts add column if not exists "account_type" text check ("account_type" in ('cash', 'bank', 'sys') or "account_type" is null);
alter table parasut.accounts add column if not exists "bank_name" text;
alter table parasut.accounts add column if not exists "bank_branch" text;
alter table parasut.accounts add column if not exists "bank_account_no" text;
alter table parasut.accounts add column if not exists "iban" text;

-- contacts: additive only, existing table/data untouched.
-- NOT NULL is intentionally dropped here even where the API marks a field
-- required — ADD COLUMN ... NOT NULL fails/is unsafe against a table that
-- may already hold synced rows with no value for the new column. Add NOT
-- NULL back in a follow-up migration once existing rows are backfilled.
alter table parasut.contacts add column if not exists "balance" numeric;
alter table parasut.contacts add column if not exists "trl_balance" numeric;
alter table parasut.contacts add column if not exists "usd_balance" numeric;
alter table parasut.contacts add column if not exists "eur_balance" numeric;
alter table parasut.contacts add column if not exists "gbp_balance" numeric;
alter table parasut.contacts add column if not exists "email" text;
alter table parasut.contacts add column if not exists "name" text;
alter table parasut.contacts add column if not exists "short_name" text;
alter table parasut.contacts add column if not exists "contact_type" text check ("contact_type" in ('person', 'company') or "contact_type" is null);
alter table parasut.contacts add column if not exists "tax_office" text;
alter table parasut.contacts add column if not exists "tax_number" text;
alter table parasut.contacts add column if not exists "district" text;
alter table parasut.contacts add column if not exists "postal_code" text;
alter table parasut.contacts add column if not exists "city" text;
alter table parasut.contacts add column if not exists "country" text;
alter table parasut.contacts add column if not exists "address" text;
alter table parasut.contacts add column if not exists "phone" text;
alter table parasut.contacts add column if not exists "fax" text;
alter table parasut.contacts add column if not exists "is_abroad" boolean;
alter table parasut.contacts add column if not exists "iban" text;
alter table parasut.contacts add column if not exists "account_type" text check ("account_type" in ('customer', 'supplier') or "account_type" is null);
alter table parasut.contacts add column if not exists "untrackable" boolean;
alter table parasut.contacts add column if not exists "invoicing_preferences" jsonb default '{}'::jsonb;
alter table parasut.contacts add column if not exists "category_parasut_id" text;
alter table parasut.contacts add column if not exists "contact_portal_parasut_id" text;
alter table parasut.contacts add column if not exists "contact_people" jsonb default '[]'::jsonb;

-- products: additive only, existing table/data untouched.
-- NOT NULL is intentionally dropped here even where the API marks a field
-- required — ADD COLUMN ... NOT NULL fails/is unsafe against a table that
-- may already hold synced rows with no value for the new column. Add NOT
-- NULL back in a follow-up migration once existing rows are backfilled.
alter table parasut.products add column if not exists "sales_excise_duty_code" text;
alter table parasut.products add column if not exists "sales_invoice_details_count" bigint;
alter table parasut.products add column if not exists "purchase_invoice_details_count" bigint;
alter table parasut.products add column if not exists "list_price_in_trl" numeric;
alter table parasut.products add column if not exists "buying_price_in_trl" numeric;
alter table parasut.products add column if not exists "stock_count" numeric;
alter table parasut.products add column if not exists "code" text;
alter table parasut.products add column if not exists "name" text;
alter table parasut.products add column if not exists "vat_rate" numeric;
alter table parasut.products add column if not exists "sales_excise_duty" numeric;
alter table parasut.products add column if not exists "sales_excise_duty_type" text;
alter table parasut.products add column if not exists "purchase_excise_duty" numeric;
alter table parasut.products add column if not exists "purchase_excise_duty_type" text;
alter table parasut.products add column if not exists "unit" text;
alter table parasut.products add column if not exists "communications_tax_rate" numeric;
alter table parasut.products add column if not exists "list_price" numeric;
alter table parasut.products add column if not exists "currency" text;
alter table parasut.products add column if not exists "buying_price" numeric;
alter table parasut.products add column if not exists "buying_currency" text;
alter table parasut.products add column if not exists "inventory_tracking" boolean;
alter table parasut.products add column if not exists "initial_stock_count" numeric;
alter table parasut.products add column if not exists "gtip" text;
alter table parasut.products add column if not exists "barcode" text;
alter table parasut.products add column if not exists "inventory_levels_parasut_id" text;
alter table parasut.products add column if not exists "category_parasut_id" text;

-- purchase_bills: additive only, existing table/data untouched.
-- NOT NULL is intentionally dropped here even where the API marks a field
-- required — ADD COLUMN ... NOT NULL fails/is unsafe against a table that
-- may already hold synced rows with no value for the new column. Add NOT
-- NULL back in a follow-up migration once existing rows are backfilled.
alter table parasut.purchase_bills add column if not exists "total_paid" numeric;
alter table parasut.purchase_bills add column if not exists "gross_total" numeric;
alter table parasut.purchase_bills add column if not exists "total_excise_duty" numeric;
alter table parasut.purchase_bills add column if not exists "total_communications_tax" numeric;
alter table parasut.purchase_bills add column if not exists "total_vat" numeric;
alter table parasut.purchase_bills add column if not exists "total_vat_withholding" numeric;
alter table parasut.purchase_bills add column if not exists "total_discount" numeric;
alter table parasut.purchase_bills add column if not exists "total_invoice_discount" numeric;
alter table parasut.purchase_bills add column if not exists "remaining" numeric;
alter table parasut.purchase_bills add column if not exists "remaining_in_trl" numeric;
alter table parasut.purchase_bills add column if not exists "payment_status" text check ("payment_status" in ('paid', 'overdue', 'unpaid', 'partially_paid') or "payment_status" is null);
alter table parasut.purchase_bills add column if not exists "is_detailed" boolean;
alter table parasut.purchase_bills add column if not exists "sharings_count" bigint;
alter table parasut.purchase_bills add column if not exists "e_invoices_count" bigint;
alter table parasut.purchase_bills add column if not exists "remaining_reimbursement" numeric;
alter table parasut.purchase_bills add column if not exists "remaining_reimbursement_in_trl" numeric;
alter table parasut.purchase_bills add column if not exists "item_type" text check ("item_type" in ('purchase_bill', 'cancelled', 'recurring_purchase_bill', 'refund') or "item_type" is null);
alter table parasut.purchase_bills add column if not exists "description" text;
alter table parasut.purchase_bills add column if not exists "issue_date" date;
alter table parasut.purchase_bills add column if not exists "due_date" date;
alter table parasut.purchase_bills add column if not exists "invoice_no" text;
alter table parasut.purchase_bills add column if not exists "currency" text check ("currency" in ('TRL', 'USD', 'EUR', 'GBP') or "currency" is null);
alter table parasut.purchase_bills add column if not exists "exchange_rate" numeric;
alter table parasut.purchase_bills add column if not exists "net_total" numeric;
alter table parasut.purchase_bills add column if not exists "withholding_rate" numeric;
alter table parasut.purchase_bills add column if not exists "invoice_discount_type" text check ("invoice_discount_type" in ('percentage', 'amount') or "invoice_discount_type" is null);
alter table parasut.purchase_bills add column if not exists "invoice_discount" numeric;
alter table parasut.purchase_bills add column if not exists "category_parasut_id" text;
alter table parasut.purchase_bills add column if not exists "spender_parasut_id" text;
alter table parasut.purchase_bills add column if not exists "supplier_parasut_id" text;
alter table parasut.purchase_bills add column if not exists "details" jsonb default '[]'::jsonb;
alter table parasut.purchase_bills add column if not exists "payments" jsonb default '[]'::jsonb;
alter table parasut.purchase_bills add column if not exists "tags" jsonb default '[]'::jsonb;
alter table parasut.purchase_bills add column if not exists "recurrence_plan_parasut_id" text;
alter table parasut.purchase_bills add column if not exists "active_e_document_parasut_id" text;
alter table parasut.purchase_bills add column if not exists "pay_to_parasut_id" text;

-- purchase_bill_details: additive only, existing table/data untouched.
-- NOT NULL is intentionally dropped here even where the API marks a field
-- required — ADD COLUMN ... NOT NULL fails/is unsafe against a table that
-- may already hold synced rows with no value for the new column. Add NOT
-- NULL back in a follow-up migration once existing rows are backfilled.
alter table parasut.purchase_bill_details add column if not exists "net_total" numeric;
alter table parasut.purchase_bill_details add column if not exists "vat_withholding" numeric;
alter table parasut.purchase_bill_details add column if not exists "quantity" numeric;
alter table parasut.purchase_bill_details add column if not exists "unit_price" numeric;
alter table parasut.purchase_bill_details add column if not exists "vat_rate" numeric;
alter table parasut.purchase_bill_details add column if not exists "vat_withholding_rate" numeric;
alter table parasut.purchase_bill_details add column if not exists "discount_type" text check ("discount_type" in ('percentage', 'amount') or "discount_type" is null);
alter table parasut.purchase_bill_details add column if not exists "discount_value" numeric;
alter table parasut.purchase_bill_details add column if not exists "excise_duty_type" text check ("excise_duty_type" in ('percentage', 'amount') or "excise_duty_type" is null);
alter table parasut.purchase_bill_details add column if not exists "excise_duty_value" numeric;
alter table parasut.purchase_bill_details add column if not exists "communications_tax_rate" numeric;
alter table parasut.purchase_bill_details add column if not exists "description" text;
alter table parasut.purchase_bill_details add column if not exists "warehouse_parasut_id" text;
alter table parasut.purchase_bill_details add column if not exists "product_parasut_id" text;

-- sales_invoices: additive only, existing table/data untouched.
-- NOT NULL is intentionally dropped here even where the API marks a field
-- required — ADD COLUMN ... NOT NULL fails/is unsafe against a table that
-- may already hold synced rows with no value for the new column. Add NOT
-- NULL back in a follow-up migration once existing rows are backfilled.
alter table parasut.sales_invoices add column if not exists "invoice_no" text;
alter table parasut.sales_invoices add column if not exists "net_total" numeric;
alter table parasut.sales_invoices add column if not exists "gross_total" numeric;
alter table parasut.sales_invoices add column if not exists "withholding" numeric;
alter table parasut.sales_invoices add column if not exists "total_excise_duty" numeric;
alter table parasut.sales_invoices add column if not exists "total_communications_tax" numeric;
alter table parasut.sales_invoices add column if not exists "total_vat" numeric;
alter table parasut.sales_invoices add column if not exists "total_vat_withholding" numeric;
alter table parasut.sales_invoices add column if not exists "total_discount" numeric;
alter table parasut.sales_invoices add column if not exists "total_invoice_discount" numeric;
alter table parasut.sales_invoices add column if not exists "before_taxes_total" numeric;
alter table parasut.sales_invoices add column if not exists "remaining" numeric;
alter table parasut.sales_invoices add column if not exists "remaining_in_trl" numeric;
alter table parasut.sales_invoices add column if not exists "payment_status" text check ("payment_status" in ('paid', 'overdue', 'unpaid', 'partially_paid') or "payment_status" is null);
alter table parasut.sales_invoices add column if not exists "item_type" text check ("item_type" in ('invoice', 'export', 'estimate', 'cancelled', 'recurring_invoice', 'recurring_estimate', 'recurring_export', 'refund') or "item_type" is null);
alter table parasut.sales_invoices add column if not exists "description" text;
alter table parasut.sales_invoices add column if not exists "issue_date" date;
alter table parasut.sales_invoices add column if not exists "due_date" date;
alter table parasut.sales_invoices add column if not exists "invoice_series" text;
alter table parasut.sales_invoices add column if not exists "invoice_id" bigint;
alter table parasut.sales_invoices add column if not exists "currency" text check ("currency" in ('TRL', 'USD', 'EUR', 'GBP') or "currency" is null);
alter table parasut.sales_invoices add column if not exists "exchange_rate" numeric;
alter table parasut.sales_invoices add column if not exists "withholding_rate" numeric;
alter table parasut.sales_invoices add column if not exists "invoice_discount_type" text check ("invoice_discount_type" in ('percentage', 'amount') or "invoice_discount_type" is null);
alter table parasut.sales_invoices add column if not exists "invoice_discount" numeric;
alter table parasut.sales_invoices add column if not exists "billing_address" text;
alter table parasut.sales_invoices add column if not exists "billing_postal_code" text;
alter table parasut.sales_invoices add column if not exists "billing_phone" text;
alter table parasut.sales_invoices add column if not exists "billing_fax" text;
alter table parasut.sales_invoices add column if not exists "tax_office" text;
alter table parasut.sales_invoices add column if not exists "tax_number" text;
alter table parasut.sales_invoices add column if not exists "country" text;
alter table parasut.sales_invoices add column if not exists "city" text;
alter table parasut.sales_invoices add column if not exists "district" text;
alter table parasut.sales_invoices add column if not exists "is_abroad" boolean;
alter table parasut.sales_invoices add column if not exists "order_no" text;
alter table parasut.sales_invoices add column if not exists "order_date" date;
alter table parasut.sales_invoices add column if not exists "shipment_addres" text;
alter table parasut.sales_invoices add column if not exists "shipment_included" boolean;
alter table parasut.sales_invoices add column if not exists "cash_sale" boolean;
alter table parasut.sales_invoices add column if not exists "payer_tax_numbers" jsonb default '[]'::jsonb;
alter table parasut.sales_invoices add column if not exists "invoice_note" text;
alter table parasut.sales_invoices add column if not exists "append_contact_balance" boolean;
alter table parasut.sales_invoices add column if not exists "e_document_accounts" jsonb default '[]'::jsonb;
alter table parasut.sales_invoices add column if not exists "category_parasut_id" text;
alter table parasut.sales_invoices add column if not exists "contact_parasut_id" text;
alter table parasut.sales_invoices add column if not exists "details" jsonb default '[]'::jsonb;
alter table parasut.sales_invoices add column if not exists "payments" jsonb default '[]'::jsonb;
alter table parasut.sales_invoices add column if not exists "tags" jsonb default '[]'::jsonb;
alter table parasut.sales_invoices add column if not exists "sales_offer_parasut_id" text;
alter table parasut.sales_invoices add column if not exists "sharings" jsonb default '[]'::jsonb;
alter table parasut.sales_invoices add column if not exists "recurrence_plan_parasut_id" text;
alter table parasut.sales_invoices add column if not exists "active_e_document_parasut_id" text;

-- sales_invoice_details: additive only, existing table/data untouched.
-- NOT NULL is intentionally dropped here even where the API marks a field
-- required — ADD COLUMN ... NOT NULL fails/is unsafe against a table that
-- may already hold synced rows with no value for the new column. Add NOT
-- NULL back in a follow-up migration once existing rows are backfilled.
alter table parasut.sales_invoice_details add column if not exists "net_total" numeric;
alter table parasut.sales_invoice_details add column if not exists "vat_withholding" numeric;
alter table parasut.sales_invoice_details add column if not exists "quantity" numeric;
alter table parasut.sales_invoice_details add column if not exists "unit_price" numeric;
alter table parasut.sales_invoice_details add column if not exists "vat_rate" numeric;
alter table parasut.sales_invoice_details add column if not exists "vat_withholding_rate" numeric;
alter table parasut.sales_invoice_details add column if not exists "discount_type" text check ("discount_type" in ('percentage', 'amount') or "discount_type" is null);
alter table parasut.sales_invoice_details add column if not exists "discount_value" numeric;
alter table parasut.sales_invoice_details add column if not exists "excise_duty_type" text check ("excise_duty_type" in ('percentage', 'amount') or "excise_duty_type" is null);
alter table parasut.sales_invoice_details add column if not exists "excise_duty_value" numeric;
alter table parasut.sales_invoice_details add column if not exists "communications_tax_rate" numeric;
alter table parasut.sales_invoice_details add column if not exists "description" text;
alter table parasut.sales_invoice_details add column if not exists "delivery_method" text check ("delivery_method" in ('CFR', 'CIF', 'CIP', 'CPT', 'DAF', 'DAP', 'DPU', 'DDP', 'DDU', 'DEQ', 'DES', 'EXW', 'FAS', 'FCA', 'FOB') or "delivery_method" is null);
alter table parasut.sales_invoice_details add column if not exists "shipping_method" text check ("shipping_method" in ('Denizyolu', 'Demiryolu', 'Karayolu', 'Havayolu', 'Posta', 'Çok araçlı', 'Sabit taşıma tesisleri', 'İç su taşımacılığı') or "shipping_method" is null);
alter table parasut.sales_invoice_details add column if not exists "warehouse_parasut_id" text;
alter table parasut.sales_invoice_details add column if not exists "product_parasut_id" text;

-- payments: additive only, existing table/data untouched.
-- NOT NULL is intentionally dropped here even where the API marks a field
-- required — ADD COLUMN ... NOT NULL fails/is unsafe against a table that
-- may already hold synced rows with no value for the new column. Add NOT
-- NULL back in a follow-up migration once existing rows are backfilled.
alter table parasut.payments add column if not exists "date" date;
alter table parasut.payments add column if not exists "amount" numeric;
alter table parasut.payments add column if not exists "currency" numeric;
alter table parasut.payments add column if not exists "notes" text;
alter table parasut.payments add column if not exists "payable_parasut_id" text;
alter table parasut.payments add column if not exists "transaction_parasut_id" text;

-- ============================================================
-- PART 3: RLS lockdown for new tables (same posture as the original
-- parasut schema foundation migration: default-deny, service_role only,
-- defense-in-depth since `parasut` is not a PostgREST-exposed schema)
-- ============================================================

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'bank_fees',
    'e_archives',
    'e_invoice_inboxes',
    'e_invoices',
    'e_smms',
    'employees',
    'item_categories',
    'inventory_levels',
    'salaries',
    'sales_offers',
    'sales_offers_details',
    'shipment_documents',
    'stock_movements',
    'stock_updates',
    'stock_update_details',
    'tags',
    'taxes',
    'trackable_jobs',
    'transactions',
    'warehouses'
  ]
  loop
    execute format('alter table parasut.%I enable row level security', target_table);
    execute format('revoke all on table parasut.%I from anon', target_table);
    execute format('revoke all on table parasut.%I from authenticated', target_table);
    execute format('grant all on table parasut.%I to service_role', target_table);
  end loop;
end $$;