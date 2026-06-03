-- Phase 29: persisted observability, scheduled jobs and alert workflow.
-- Non-destructive foundation for durable operational monitoring.

create table if not exists public.platform_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid null references public.company_branches(id) on delete set null,
  metric_key text not null,
  metric_name text not null,
  metric_value numeric null,
  metric_unit text null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  status text not null default 'active' check (status in ('active', 'inactive', 'resolved', 'archived')),
  source text not null,
  module text not null,
  measured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid null references public.company_branches(id) on delete set null,
  event_key text not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  status text not null default 'recorded' check (status in ('recorded', 'processing', 'processed', 'failed', 'ignored')),
  source text not null,
  module text not null,
  actor_email text null,
  entity_type text null,
  entity_id text null,
  title text not null,
  description text null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid null references public.company_branches(id) on delete set null,
  alert_key text not null,
  title text not null,
  description text null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  source text not null,
  module text not null,
  event_id uuid null references public.platform_events(id) on delete set null,
  acknowledged_by text null,
  acknowledged_at timestamptz null,
  resolved_by text null,
  resolved_at timestamptz null,
  resolution_notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_job_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid null references public.company_branches(id) on delete set null,
  job_key text not null,
  job_name text not null,
  job_type text not null check (job_type in ('reconciliation_check', 'inventory_verification', 'webhook_cleanup', 'backup_verification', 'rls_control_check', 'maintenance')),
  status text not null default 'scheduled' check (status in ('scheduled', 'running', 'success', 'failed', 'cancelled')),
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  source text not null default 'erp',
  module text not null default 'operations',
  started_at timestamptz null,
  completed_at timestamptz null,
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),
  failure_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_metrics_scope_time
  on public.platform_metrics(company_id, branch_id, measured_at desc);
create index if not exists idx_platform_metrics_key_status
  on public.platform_metrics(metric_key, status, measured_at desc);

create index if not exists idx_platform_events_scope_time
  on public.platform_events(company_id, branch_id, occurred_at desc);
create index if not exists idx_platform_events_module_status
  on public.platform_events(module, status, occurred_at desc);
create index if not exists idx_platform_events_entity
  on public.platform_events(entity_type, entity_id, occurred_at desc);

create index if not exists idx_platform_alerts_scope_status
  on public.platform_alerts(company_id, branch_id, status, severity, created_at desc);
create index if not exists idx_platform_alerts_key_open
  on public.platform_alerts(alert_key, status, created_at desc);

create index if not exists idx_scheduled_job_runs_scope_status
  on public.scheduled_job_runs(company_id, branch_id, job_type, status, created_at desc);

create index if not exists idx_erp_audit_logs_scope_search
  on public.erp_audit_logs(company_id, branch_id, entity_type, action, created_at desc);
create index if not exists idx_erp_audit_logs_text_search
  on public.erp_audit_logs using gin (
    to_tsvector('simple',
      coalesce(actor_email, '') || ' ' ||
      coalesce(entity_type, '') || ' ' ||
      coalesce(action, '') || ' ' ||
      coalesce(description, '')
    )
  );

alter table public.platform_metrics enable row level security;
alter table public.platform_events enable row level security;
alter table public.platform_alerts enable row level security;
alter table public.scheduled_job_runs enable row level security;

grant select, insert, update on table public.platform_metrics to authenticated;
grant select, insert, update on table public.platform_events to authenticated;
grant select, insert, update on table public.platform_alerts to authenticated;
grant select, insert, update on table public.scheduled_job_runs to authenticated;

revoke all on table public.platform_metrics from anon;
revoke all on table public.platform_events from anon;
revoke all on table public.platform_alerts from anon;
revoke all on table public.scheduled_job_runs from anon;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['platform_metrics', 'platform_events', 'platform_alerts', 'scheduled_job_runs']
  loop
    execute format('drop policy if exists %I on public.%I', 'tenant_member_read_' || target_table, target_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        exists (
          select 1
          from public.company_memberships cm
          where lower(cm.email) = lower(auth.jwt() ->> ''email'')
            and cm.is_active = true
            and cm.company_id = company_id
            and (branch_id is null or cm.branch_id is null or cm.branch_id = branch_id)
        )
      )',
      'tenant_member_read_' || target_table,
      target_table
    );

    execute format('drop policy if exists %I on public.%I', 'tenant_member_insert_' || target_table, target_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (
        exists (
          select 1
          from public.company_memberships cm
          where lower(cm.email) = lower(auth.jwt() ->> ''email'')
            and cm.is_active = true
            and cm.company_id = company_id
            and (branch_id is null or cm.branch_id is null or cm.branch_id = branch_id)
        )
      )',
      'tenant_member_insert_' || target_table,
      target_table
    );

    execute format('drop policy if exists %I on public.%I', 'tenant_member_update_' || target_table, target_table);
    execute format(
      'create policy %I on public.%I for update to authenticated using (
        exists (
          select 1
          from public.company_memberships cm
          where lower(cm.email) = lower(auth.jwt() ->> ''email'')
            and cm.is_active = true
            and cm.company_id = company_id
            and (branch_id is null or cm.branch_id is null or cm.branch_id = branch_id)
        )
      ) with check (
        exists (
          select 1
          from public.company_memberships cm
          where lower(cm.email) = lower(auth.jwt() ->> ''email'')
            and cm.is_active = true
            and cm.company_id = company_id
            and (branch_id is null or cm.branch_id is null or cm.branch_id = branch_id)
        )
      )',
      'tenant_member_update_' || target_table,
      target_table
    );
  end loop;
end $$;
