-- Phase 11 HR and organization foundation.
-- Extends existing employee records and keeps Supabase Auth / erp_users as the identity source.

create table if not exists public.hr_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text null unique,
  manager_employee_id uuid null references public.employees(id),
  parent_department_id uuid null references public.hr_departments(id),
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_positions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid null references public.hr_departments(id),
  title text not null,
  code text null unique,
  reports_to_position_id uuid null references public.hr_positions(id),
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.employees
  add column if not exists employee_no text null unique,
  add column if not exists status text not null default 'active' check (status in ('active', 'inactive', 'on_leave', 'terminated', 'candidate')),
  add column if not exists department_id uuid null references public.hr_departments(id),
  add column if not exists position_id uuid null references public.hr_positions(id),
  add column if not exists manager_employee_id uuid null references public.employees(id),
  add column if not exists erp_user_id uuid null references public.erp_users(id);

create table if not exists public.hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  leave_type text not null default 'annual',
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  approver_employee_id uuid null references public.employees(id),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text null,
  phone text null,
  position_id uuid null references public.hr_positions(id),
  department_id uuid null references public.hr_departments(id),
  status text not null default 'new' check (status in ('new', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  source text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid null references public.employees(id),
  candidate_id uuid null references public.hr_recruitment_candidates(id),
  title text not null,
  responsible_employee_id uuid null references public.employees(id),
  due_date date null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_departments_active on public.hr_departments(is_active);
create index if not exists idx_hr_positions_department on public.hr_positions(department_id);
create index if not exists idx_employees_department_position on public.employees(department_id, position_id);
create index if not exists idx_employees_erp_user on public.employees(erp_user_id);
create index if not exists idx_hr_leave_requests_employee_status on public.hr_leave_requests(employee_id, status);
create index if not exists idx_hr_recruitment_candidates_status on public.hr_recruitment_candidates(status);
create index if not exists idx_hr_onboarding_tasks_status on public.hr_onboarding_tasks(status);

drop trigger if exists trg_hr_departments_updated_at on public.hr_departments;
create trigger trg_hr_departments_updated_at before update on public.hr_departments
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_hr_positions_updated_at on public.hr_positions;
create trigger trg_hr_positions_updated_at before update on public.hr_positions
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_hr_leave_requests_updated_at on public.hr_leave_requests;
create trigger trg_hr_leave_requests_updated_at before update on public.hr_leave_requests
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_hr_recruitment_candidates_updated_at on public.hr_recruitment_candidates;
create trigger trg_hr_recruitment_candidates_updated_at before update on public.hr_recruitment_candidates
for each row execute function public.erp_set_updated_at();

drop trigger if exists trg_hr_onboarding_tasks_updated_at on public.hr_onboarding_tasks;
create trigger trg_hr_onboarding_tasks_updated_at before update on public.hr_onboarding_tasks
for each row execute function public.erp_set_updated_at();
