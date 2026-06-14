-- Emergency authorization repair derived from dayandisli_full_dump.sql
-- and the repository's original authorization migrations.
-- Scope: restore only the browser login gate and ERP user resolution objects.
-- Review and run manually in the Supabase SQL Editor for the production project.

begin;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.erp_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  email text not null unique,
  full_name text,
  role text not null default 'admin',
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  roles text[] not null default '{}'::text[],
  permissions text[] not null default '{}'::text[],
  default_company_id uuid,
  default_branch_id uuid,
  accessible_company_ids uuid[] not null default '{}'::uuid[],
  accessible_branch_ids uuid[] not null default '{}'::uuid[]
);

create unique index if not exists admin_users_email_key
  on public.admin_users (email);

create unique index if not exists erp_users_email_key
  on public.erp_users (email);

insert into public.admin_users (id, email, role, is_active, created_at)
values
  (
    '3b80df5f-9526-45d4-a9a7-9234fdcb4050',
    'info@dayandisli.com',
    'admin',
    true,
    '2026-05-17 19:47:00.738496+00'
  ),
  (
    '5b7aa135-4b95-4c5c-9dff-5a9502647857',
    'bedizoymak@eclipsemuhendislik.com',
    'superadmin',
    true,
    '2026-06-01 14:00:04.176333+00'
  )
on conflict (email) do update
set role = excluded.role,
    is_active = excluded.is_active;

insert into public.erp_users (
  id,
  auth_user_id,
  email,
  full_name,
  role,
  department,
  is_active,
  created_at,
  updated_at,
  roles,
  permissions,
  default_company_id,
  default_branch_id,
  accessible_company_ids,
  accessible_branch_ids
)
values (
  '09fa3fd6-a33a-4e0e-89b2-bdf4d278cada',
  null,
  'info@dayandisli.com',
  'DAYAN Admin',
  'admin',
  'Yönetim',
  true,
  '2026-05-18 04:30:12.808346+00',
  '2026-06-12 21:13:54.532282+00',
  array['admin']::text[],
  '{}'::text[],
  null,
  null,
  '{}'::uuid[],
  '{}'::uuid[]
)
on conflict (email) do update
set full_name = excluded.full_name,
    role = excluded.role,
    department = excluded.department,
    is_active = excluded.is_active,
    roles = excluded.roles,
    permissions = excluded.permissions,
    updated_at = now();

alter table public.admin_users enable row level security;
alter table public.erp_users enable row level security;

drop policy if exists "Allow admin_users read for authenticated"
  on public.admin_users;

create policy "Allow admin_users read for authenticated"
on public.admin_users
for select
to authenticated
using (true);

drop policy if exists "erp_users_select_authenticated"
  on public.erp_users;

create policy "erp_users_select_authenticated"
on public.erp_users
for select
to authenticated
using (true);

grant select on table public.admin_users to authenticated;
grant select on table public.erp_users to authenticated;
grant all on table public.admin_users to service_role;
grant all on table public.erp_users to service_role;

commit;

-- Verification queries. Run after the transaction completes.
select
  email,
  role,
  is_active
from public.admin_users
where email in (
  'info@dayandisli.com',
  'bedizoymak@eclipsemuhendislik.com'
)
order by email;

select
  email,
  role,
  roles,
  is_active
from public.erp_users
where email = 'info@dayandisli.com';

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in ('admin_users', 'erp_users')
order by tablename, policyname;

select
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in ('admin_users', 'erp_users')
order by table_name, privilege_type;
