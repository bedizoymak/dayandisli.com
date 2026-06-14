-- EMERGENCY PRODUCTION REPAIR: establish one active ERP superadmin.
-- Run manually in the Supabase SQL Editor after reviewing the verification output.
-- This script does not create or change passwords and does not write to auth.users.

begin;

do $$
declare
  target_email constant text := 'bedizoymak@eclipsemuhendislik.com';
  target_auth_user_id uuid;
  matching_auth_users integer;
begin
  select count(*), min(id)
  into matching_auth_users, target_auth_user_id
  from auth.users
  where lower(email) = lower(target_email);

  if matching_auth_users <> 1 or target_auth_user_id is null then
    raise exception
      'Emergency auth repair refused: expected exactly one matching auth.users row, found %.',
      matching_auth_users;
  end if;

  update public.erp_users
  set auth_user_id = null,
      is_active = false,
      updated_at = now()
  where auth_user_id = target_auth_user_id
    and lower(email) <> lower(target_email);

  update public.erp_users
  set is_active = false,
      updated_at = now()
  where lower(email) <> lower(target_email)
    and is_active;

  insert into public.erp_users (
    auth_user_id,
    email,
    full_name,
    role,
    roles,
    permissions,
    is_active,
    updated_at
  )
  values (
    target_auth_user_id,
    target_email,
    'Bediz Oymak',
    'admin',
    array['admin']::text[],
    array['system.manage']::text[],
    true,
    now()
  )
  on conflict ((lower(email)))
  do update
  set auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      roles = excluded.roles,
      permissions = excluded.permissions,
      is_active = excluded.is_active,
      updated_at = now();
end $$;

alter table public.erp_users enable row level security;

drop policy if exists erp_users_select_own_active on public.erp_users;
drop policy if exists erp_users_manage_authorized on public.erp_users;

create policy erp_users_select_own_active
on public.erp_users
for select
to authenticated
using (
  is_active
  and auth_user_id = (select auth.uid())
);

create policy erp_users_manage_authorized
on public.erp_users
for all
to authenticated
using (
  private.erp_user_has_any_permission(
    array['system.manage', 'users.edit', 'roles.manage']::text[]
  )
)
with check (
  private.erp_user_has_any_permission(
    array['system.manage', 'users.edit', 'roles.manage']::text[]
  )
);

revoke all on table public.erp_users from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.erp_users from authenticated;
grant select on table public.erp_users to authenticated;
grant all on table public.erp_users to service_role;

do $$
declare
  active_count integer;
  target_valid boolean;
  legacy_dependency_count integer;
begin
  select count(*)
  into active_count
  from public.erp_users
  where is_active;

  select exists (
    select 1
    from public.erp_users as erp_user
    join auth.users as auth_user
      on auth_user.id = erp_user.auth_user_id
    where lower(erp_user.email) = lower('bedizoymak@eclipsemuhendislik.com')
      and lower(auth_user.email) = lower('bedizoymak@eclipsemuhendislik.com')
      and erp_user.is_active
      and erp_user.role = 'admin'
      and erp_user.roles = array['admin']::text[]
      and erp_user.permissions = array['system.manage']::text[]
  )
  into target_valid;

  select count(*)
  into legacy_dependency_count
  from pg_policies
  where coalesce(qual, '') ~* '(admin_users|allowed_emails|is_email_allowed)'
     or coalesce(with_check, '') ~* '(admin_users|allowed_emails|is_email_allowed)';

  if active_count <> 1 or not target_valid then
    raise exception
      'Emergency auth repair verification failed: active_count=%, target_valid=%.',
      active_count,
      target_valid;
  end if;

  if legacy_dependency_count <> 0
     or to_regclass('public.admin_users') is not null
     or to_regclass('public.allowed_emails') is not null
     or to_regprocedure('public.is_email_allowed(text)') is not null then
    raise exception 'Emergency auth repair refused: legacy authorization dependencies remain.';
  end if;
end $$;

commit;

-- Verification SQL
select json_build_object(
  'auth_user_exists',
  (
    select count(*) = 1
    from auth.users
    where lower(email) = lower('bedizoymak@eclipsemuhendislik.com')
  ),
  'single_active_erp_user',
  (
    select count(*) = 1
    from public.erp_users
    where is_active
  ),
  'target_is_only_active_user',
  (
    select count(*) = 1
    from public.erp_users
    where is_active
      and lower(email) = lower('bedizoymak@eclipsemuhendislik.com')
  ),
  'auth_link_matches',
  exists (
    select 1
    from public.erp_users as erp_user
    join auth.users as auth_user
      on auth_user.id = erp_user.auth_user_id
    where lower(erp_user.email) = lower('bedizoymak@eclipsemuhendislik.com')
      and lower(auth_user.email) = lower('bedizoymak@eclipsemuhendislik.com')
  ),
  'superadmin_values_match',
  exists (
    select 1
    from public.erp_users
    where lower(email) = lower('bedizoymak@eclipsemuhendislik.com')
      and is_active
      and role = 'admin'
      and roles = array['admin']::text[]
      and permissions = array['system.manage']::text[]
  ),
  'self_read_policy_exists',
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'erp_users'
      and policyname = 'erp_users_select_own_active'
      and cmd = 'SELECT'
  ),
  'browser_writes_revoked',
  not has_table_privilege('authenticated', 'public.erp_users', 'INSERT')
    and not has_table_privilege('authenticated', 'public.erp_users', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.erp_users', 'DELETE'),
  'legacy_objects_absent',
  to_regclass('public.admin_users') is null
    and to_regclass('public.allowed_emails') is null
    and to_regprocedure('public.is_email_allowed(text)') is null,
  'login_query_simulation',
  exists (
    select 1
    from public.erp_users as erp_user
    join auth.users as auth_user on auth_user.id = erp_user.auth_user_id
    where auth_user.id = (
      select id
      from auth.users
      where lower(email) = lower('bedizoymak@eclipsemuhendislik.com')
      limit 1
    )
      and erp_user.is_active
  )
);
