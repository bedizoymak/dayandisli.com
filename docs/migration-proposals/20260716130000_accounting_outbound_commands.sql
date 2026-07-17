-- APPLIED TO PRODUCTION on 2026-07-16 — the canonical, versioned copy of
-- this migration now lives at
-- supabase/migrations/20260716130000_accounting_outbound_commands.sql (that
-- file is the source of truth going forward; this proposal copy is kept for
-- historical context and is identical to what was applied, including the
-- company_id FK fix below).
--
-- This file originally lived under docs/migration-proposals/, NOT
-- supabase/migrations/, per the established convention in this same
-- directory (assign_erp_company_id.sql,
-- 20260716090000_move_sync_tables_to_parasut_schema.sql,
-- 20260716120000_erp_outbound_commands.sql) — proposals only move into
-- supabase/migrations/ once explicitly approved and applied, which has now
-- happened.
--
-- Purpose: durable outbound-write infrastructure for
-- DAYANDISLI_PHASE_SYSTEM.md Phase 007 (Bidirectional Customer Creation
-- MVP) §8.6-8.8. Supersedes the earlier, simpler 2-table draft in
-- 20260716120000_erp_outbound_commands.sql — that file predates this
-- phase's exact spec and should be considered superseded by this one, not
-- applied alongside it (do not apply both).
--
-- Schema placement: public.*, per ERP_BUSINESS_ARCHITECTURE.md's layering
-- rule — ERP-owned business data with no Paraşüt equivalent, never parasut.*.
--
-- Safety properties:
--   - `accounting_outbound_commands.status` is a constrained enum matching
--     exactly CreateCustomerCommandStatus in
--     server/erp/commands/create-customer-command.ts.
--   - The (company_id, provider, operation, idempotency_key) unique
--     constraint is what CommandRepository.findOrCreateCommand() relies on
--     to guarantee "the same idempotency key never creates a second
--     customer, never sends another POST" (§8.13) — enforced by the
--     database, not just application logic.
--   - `provider_resource_id` is nullable and only ever set once the real
--     Paraşüt id is known. It is NEVER used to write into parasut.contacts —
--     a separate, existing contacts-only GET sync is the only writer of
--     that table (server/erp/providers/parasut-contacts-only-sync.ts wraps
--     the existing, unmodified server/parasut/sync-contacts.ts).
--   - `accounting_outbound_attempts` and its summaries are safe-by-name
--     (`safe_request_summary`/`safe_response_summary`) — the application
--     layer (redactForAudit() in server/erp/commands/audit-trail.ts) is
--     responsible for ensuring nothing secret is ever placed in these
--     jsonb columns; this migration adds no additional guarantee beyond
--     that, and does not claim to.
--   - Every row is company-scoped (`company_id`), consistent with the
--     tenant-isolation discipline already established in this schema
--     (supabase/functions/_shared/company-scope.ts).
--   - RLS: frontend roles (anon, authenticated) get NO direct table access
--     at all — per §4/§8.8, "frontend users must not insert outbound
--     commands directly" and "commands are created only through ERP API".
--     A future ERP API (service-role-backed Edge Function, not yet built)
--     is the only writer; a future authenticated-read policy for "read your
--     own company's command status" is intentionally NOT included in this
--     draft because no ERP API exists yet to enforce membership validation
--     ahead of it — adding a read policy before that exists would be
--     exactly the "never trust frontend-supplied company_id without
--     membership validation" rule this file itself must not violate.

create table if not exists public.accounting_outbound_commands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null, -- no FK: this schema has no dedicated companies/tenant table; company_id is an application-validated scoping key everywhere else too (see erp_users.accessible_company_ids, supabase/functions/_shared/company-scope.ts) — confirmed at approval time via a production information_schema query that zero existing tables enforce a company_id FK.
  provider text not null,
  operation text not null,
  resource_type text not null,
  status text not null check (status in ('draft', 'validated', 'sending', 'sent', 'verified_in_provider', 'mirrored_back', 'failed', 'unknown_result')),
  idempotency_key text not null,
  requested_by uuid not null,
  safe_payload jsonb not null,
  provider_resource_id text,
  verification_status text check (verification_status in ('pending', 'verified', 'failed')),
  mirror_status text check (mirror_status in ('pending', 'mirrored')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  sending_at timestamptz,
  sent_at timestamptz,
  verified_at timestamptz,
  mirrored_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (company_id, provider, operation, idempotency_key)
);

create index if not exists accounting_outbound_commands_company_id_idx on public.accounting_outbound_commands (company_id);
create index if not exists accounting_outbound_commands_status_idx on public.accounting_outbound_commands (status);
create index if not exists accounting_outbound_commands_provider_resource_id_idx on public.accounting_outbound_commands (provider_resource_id) where provider_resource_id is not null;

create table if not exists public.accounting_outbound_attempts (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.accounting_outbound_commands(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  request_started_at timestamptz not null,
  response_received_at timestamptz,
  http_status integer,
  safe_request_summary jsonb not null default '{}'::jsonb,
  safe_response_summary jsonb not null default '{}'::jsonb,
  provider_request_id text,
  error_class text,
  error_code text,
  error_message text,
  result_classification text check (result_classification in ('success', 'validation_error', 'config_error', 'unknown_outcome')),
  created_at timestamptz not null default now(),
  unique (command_id, attempt_number)
);

create index if not exists accounting_outbound_attempts_command_id_idx on public.accounting_outbound_attempts (command_id);

create table if not exists public.accounting_provider_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  provider text not null,
  erp_resource_type text not null,
  erp_resource_id text not null,
  provider_resource_type text not null,
  provider_resource_id text not null,
  outbound_command_id uuid references public.accounting_outbound_commands(id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  last_mirrored_at timestamptz,
  unique (company_id, provider, provider_resource_type, provider_resource_id),
  unique (company_id, provider, erp_resource_type, erp_resource_id)
);

create index if not exists accounting_provider_links_company_id_idx on public.accounting_provider_links (company_id);

-- Not itemized in §8.6's field list, but required by §31 ("All outbound
-- writes require durable audit") and §4 — the attempts table above only
-- captures HTTP-call-level attempts; it cannot represent
-- command_created/validated/idempotent_replay/mirrored_back-style lifecycle
-- events. Added as the natural 4th table for
-- server/erp/commands/create-customer-command.ts's AuditRepository port,
-- following the same append-only, service-role-only pattern as
-- accounting_outbound_attempts.
create table if not exists public.accounting_audit_log (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.accounting_outbound_commands(id) on delete cascade,
  company_id uuid not null,
  actor_user_id uuid not null,
  action text not null check (action in ('command_created', 'validated', 'sending', 'sent', 'verified_in_provider', 'mirrored_back', 'failed', 'unknown_result', 'idempotent_replay')),
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists accounting_audit_log_command_id_idx on public.accounting_audit_log (command_id);
create index if not exists accounting_audit_log_company_id_idx on public.accounting_audit_log (company_id);

alter table public.accounting_outbound_commands enable row level security;
alter table public.accounting_outbound_attempts enable row level security;
alter table public.accounting_provider_links enable row level security;
alter table public.accounting_audit_log enable row level security;

-- No frontend role gets any access — service_role (the future ERP API) is
-- the only writer and reader until an authenticated-read policy is added
-- alongside the ERP API itself (see safety-properties note above).
revoke all on public.accounting_outbound_commands from anon, authenticated;
revoke all on public.accounting_outbound_attempts from anon, authenticated;
revoke all on public.accounting_provider_links from anon, authenticated;
revoke all on public.accounting_audit_log from anon, authenticated;
grant select, insert, update on public.accounting_outbound_commands to service_role;
grant select, insert on public.accounting_outbound_attempts to service_role; -- append-only: no update/delete, ever
grant select, insert, update on public.accounting_provider_links to service_role;
grant select, insert on public.accounting_audit_log to service_role; -- append-only: no update/delete, ever

-- New permissions referenced by §8.8 (accounting.contacts.create,
-- accounting.outbound.view) are application-level permission-key strings
-- checked in src/features/erp/shared/permissions.ts, exactly like
-- parasut.view/parasut.sync.view already are — they do not require a
-- database migration of their own and are intentionally not defined here.
