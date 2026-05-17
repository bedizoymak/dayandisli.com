create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_users (email, role, is_active)
values ('info@dayandisli.com', 'admin', true)
on conflict (email) do update
set role = excluded.role,
    is_active = excluded.is_active;

alter table public.admin_users enable row level security;

drop policy if exists "Allow admin_users read for authenticated" on public.admin_users;

create policy "Allow admin_users read for authenticated"
on public.admin_users
for select
to authenticated
using (true);