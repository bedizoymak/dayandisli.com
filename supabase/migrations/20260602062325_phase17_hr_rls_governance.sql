-- Phase 17 security, RLS and governance hardening.
-- Non-destructive RLS enablement for Phase 11 HR organization tables.

alter table if exists public.hr_departments enable row level security;
alter table if exists public.hr_positions enable row level security;
alter table if exists public.hr_leave_requests enable row level security;
alter table if exists public.hr_recruitment_candidates enable row level security;
alter table if exists public.hr_onboarding_tasks enable row level security;

do $$
declare
  t text;
  hr_tables text[] := array[
    'hr_departments',
    'hr_positions',
    'hr_leave_requests',
    'hr_recruitment_candidates',
    'hr_onboarding_tasks'
  ];
begin
  foreach t in array hr_tables loop
    execute format('drop policy if exists %I on public.%I', 'erp authenticated select ' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'erp authenticated select ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'erp authenticated insert ' || t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', 'erp authenticated insert ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'erp authenticated update ' || t, t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', 'erp authenticated update ' || t, t);
  end loop;
end $$;
