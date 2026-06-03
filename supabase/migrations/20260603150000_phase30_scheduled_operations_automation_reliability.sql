-- Phase 30: scheduled operations engine, automation execution and reliability.
-- Non-destructive execution foundation. No external scheduler is introduced.

alter table if exists public.scheduled_job_runs
  drop constraint if exists scheduled_job_runs_status_check;

alter table if exists public.scheduled_job_runs
  add constraint scheduled_job_runs_status_check
  check (status in ('queued', 'scheduled', 'running', 'completed', 'success', 'failed', 'cancelled'));

alter table if exists public.scheduled_job_runs
  drop constraint if exists scheduled_job_runs_job_type_check;

alter table if exists public.scheduled_job_runs
  add constraint scheduled_job_runs_job_type_check
  check (job_type in ('reconciliation_check', 'inventory_verification', 'webhook_cleanup', 'backup_verification', 'rls_control_check', 'tenant_isolation_verification', 'observability_aggregation', 'maintenance'));

alter table if exists public.scheduled_job_runs
  add column if not exists queued_at timestamptz null,
  add column if not exists retry_count integer not null default 0 check (retry_count >= 0),
  add column if not exists max_retries integer not null default 2 check (max_retries >= 0),
  add column if not exists next_retry_at timestamptz null,
  add column if not exists parent_job_run_id uuid null references public.scheduled_job_runs(id) on delete set null,
  add column if not exists audit_log_id uuid null references public.erp_audit_logs(id) on delete set null;

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid null references public.company_branches(id) on delete set null,
  rule_key text not null,
  name text not null,
  description text null,
  trigger_event text not null,
  condition jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  source text not null default 'erp',
  module text not null default 'automation',
  last_triggered_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, branch_id, rule_key)
);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  branch_id uuid null references public.company_branches(id) on delete set null,
  rule_id uuid null references public.automation_rules(id) on delete set null,
  rule_key text not null,
  trigger_event text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  source text not null default 'erp',
  module text not null default 'automation',
  started_at timestamptz null,
  completed_at timestamptz null,
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 2 check (max_retries >= 0),
  failure_reason text null,
  event_id uuid null references public.platform_events(id) on delete set null,
  alert_id uuid null references public.platform_alerts(id) on delete set null,
  job_run_id uuid null references public.scheduled_job_runs(id) on delete set null,
  audit_log_id uuid null references public.erp_audit_logs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scheduled_job_runs_retry
  on public.scheduled_job_runs(company_id, branch_id, status, next_retry_at, created_at desc);
create index if not exists idx_scheduled_job_runs_reliability
  on public.scheduled_job_runs(company_id, branch_id, status, retry_count, created_at desc);

create index if not exists idx_automation_rules_scope_trigger
  on public.automation_rules(company_id, branch_id, trigger_event, status);
create index if not exists idx_automation_executions_scope_status
  on public.automation_executions(company_id, branch_id, status, created_at desc);
create index if not exists idx_automation_executions_rule
  on public.automation_executions(rule_key, trigger_event, created_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_executions enable row level security;

grant select, insert, update on table public.automation_rules to authenticated;
grant select, insert, update on table public.automation_executions to authenticated;
revoke all on table public.automation_rules from anon;
revoke all on table public.automation_executions from anon;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['automation_rules', 'automation_executions']
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
