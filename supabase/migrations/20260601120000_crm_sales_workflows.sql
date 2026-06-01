-- Phase 5: CRM and sales workflow foundation.
-- Additive only: no existing ERP tables are dropped or truncated.

begin;

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  lead_no text unique not null,
  company_name text not null,
  contact_name text null,
  phone text null,
  email text null,
  source text null,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'converted', 'lost')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  stakeholder_id uuid null references public.stakeholders(id),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_no text unique not null,
  title text not null,
  lead_id uuid null references public.crm_leads(id),
  stakeholder_id uuid null references public.stakeholders(id),
  status text not null default 'open'
    check (status in ('open', 'proposal', 'won', 'lost', 'cancelled')),
  expected_value numeric(14,2) not null default 0,
  probability integer not null default 0 check (probability >= 0 and probability <= 100),
  expected_close_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  related_type text null check (related_type in ('lead', 'opportunity', 'stakeholder', 'quotation', 'sales_order')),
  related_id uuid null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  activity_type text not null default 'note'
    check (activity_type in ('note', 'call', 'meeting', 'email', 'visit', 'status_change')),
  related_type text null check (related_type in ('lead', 'opportunity', 'stakeholder', 'quotation', 'sales_order')),
  related_id uuid null,
  activity_date timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_leads_status on public.crm_leads(status);
create index if not exists idx_crm_leads_stakeholder on public.crm_leads(stakeholder_id);
create index if not exists idx_crm_opportunities_status on public.crm_opportunities(status);
create index if not exists idx_crm_opportunities_lead on public.crm_opportunities(lead_id);
create index if not exists idx_crm_opportunities_stakeholder on public.crm_opportunities(stakeholder_id);
create index if not exists idx_crm_tasks_status on public.crm_tasks(status);
create index if not exists idx_crm_tasks_related on public.crm_tasks(related_type, related_id);
create index if not exists idx_crm_activities_related on public.crm_activities(related_type, related_id, activity_date desc);

insert into public.erp_number_sequences (sequence_key, prefix, current_value)
values
  ('CRM_LEAD', 'LEAD', 0),
  ('CRM_OPPORTUNITY', 'OPP', 0)
on conflict (sequence_key) do update
set prefix = excluded.prefix,
    updated_at = now();

drop trigger if exists trg_crm_leads_updated_at on public.crm_leads;
create trigger trg_crm_leads_updated_at
before update on public.crm_leads
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_crm_opportunities_updated_at on public.crm_opportunities;
create trigger trg_crm_opportunities_updated_at
before update on public.crm_opportunities
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_crm_tasks_updated_at on public.crm_tasks;
create trigger trg_crm_tasks_updated_at
before update on public.crm_tasks
for each row execute function public.erp_set_updated_at();

alter table public.crm_leads enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_activities enable row level security;

drop policy if exists "erp authenticated read crm_leads" on public.crm_leads;
create policy "erp authenticated read crm_leads" on public.crm_leads for select to authenticated using (true);
drop policy if exists "erp authenticated write crm_leads" on public.crm_leads;
create policy "erp authenticated write crm_leads" on public.crm_leads for all to authenticated using (true) with check (true);

drop policy if exists "erp authenticated read crm_opportunities" on public.crm_opportunities;
create policy "erp authenticated read crm_opportunities" on public.crm_opportunities for select to authenticated using (true);
drop policy if exists "erp authenticated write crm_opportunities" on public.crm_opportunities;
create policy "erp authenticated write crm_opportunities" on public.crm_opportunities for all to authenticated using (true) with check (true);

drop policy if exists "erp authenticated read crm_tasks" on public.crm_tasks;
create policy "erp authenticated read crm_tasks" on public.crm_tasks for select to authenticated using (true);
drop policy if exists "erp authenticated write crm_tasks" on public.crm_tasks;
create policy "erp authenticated write crm_tasks" on public.crm_tasks for all to authenticated using (true) with check (true);

drop policy if exists "erp authenticated read crm_activities" on public.crm_activities;
create policy "erp authenticated read crm_activities" on public.crm_activities for select to authenticated using (true);
drop policy if exists "erp authenticated write crm_activities" on public.crm_activities;
create policy "erp authenticated write crm_activities" on public.crm_activities for all to authenticated using (true) with check (true);

commit;
