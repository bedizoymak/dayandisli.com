-- AUTH-2: make public.erp_users the only runtime ERP authorization authority.
-- Legacy authorization tables remain present for AUTH-3 cleanup.

create schema if not exists private;

alter table if exists public.erp_users
  add column if not exists auth_user_id uuid,
  add column if not exists roles text[] not null default '{}'::text[],
  add column if not exists permissions text[] not null default '{}'::text[],
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.erp_users as erp_user
set auth_user_id = auth_user.id,
    updated_at = now()
from auth.users as auth_user
where erp_user.auth_user_id is null
  and lower(erp_user.email) = lower(auth_user.email);

create unique index if not exists erp_users_auth_user_id_unique
  on public.erp_users (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists erp_users_email_lower_unique
  on public.erp_users (lower(email));

create or replace function private.erp_user_has_any_permission(required_permissions text[] default '{}'::text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.erp_users as erp_user
    where erp_user.is_active
      and (
        erp_user.auth_user_id = (select auth.uid())
        or (
          erp_user.auth_user_id is null
          and lower(erp_user.email) = lower((select auth.jwt() ->> 'email'))
        )
      )
      and (
        erp_user.role = 'admin'
        or 'admin' = any(erp_user.roles)
        or coalesce(erp_user.permissions, '{}'::text[]) && required_permissions
      )
  );
$$;

revoke all on function private.erp_user_has_any_permission(text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.erp_user_has_any_permission(text[]) to authenticated;

alter table public.erp_users enable row level security;

drop policy if exists "erp authenticated select erp_users" on public.erp_users;
drop policy if exists "erp authenticated insert erp_users" on public.erp_users;
drop policy if exists "erp authenticated update erp_users" on public.erp_users;
drop policy if exists erp_users_select_authenticated on public.erp_users;
drop policy if exists erp_users_insert_authenticated on public.erp_users;
drop policy if exists erp_users_update_authenticated on public.erp_users;
drop policy if exists erp_users_select_own_active on public.erp_users;
drop policy if exists erp_users_manage_authorized on public.erp_users;

create policy erp_users_select_own_active
on public.erp_users
for select
to authenticated
using (
  is_active
  and (
    auth_user_id = (select auth.uid())
    or (
      auth_user_id is null
      and lower(email) = lower((select auth.jwt() ->> 'email'))
    )
  )
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
revoke insert, update, delete on table public.erp_users from authenticated;
grant select on table public.erp_users to authenticated;
grant all on table public.erp_users to service_role;

do $$
declare
  legacy_policy record;
  create_sql text;
  policy_mode text;
begin
  for legacy_policy in
    select schemaname, tablename, policyname, permissive, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename <> 'erp_users'
      and (
        coalesce(qual, '') ~* '(admin_users|allowed_emails|is_email_allowed)'
        or coalesce(with_check, '') ~* '(admin_users|allowed_emails|is_email_allowed)'
      )
  loop
    policy_mode := case when legacy_policy.permissive = 'RESTRICTIVE' then 'restrictive' else 'permissive' end;
    execute format(
      'drop policy if exists %I on %I.%I',
      legacy_policy.policyname,
      legacy_policy.schemaname,
      legacy_policy.tablename
    );

    create_sql := format(
      'create policy %I on %I.%I as %s for %s to authenticated',
      legacy_policy.policyname,
      legacy_policy.schemaname,
      legacy_policy.tablename,
      policy_mode,
      lower(legacy_policy.cmd)
    );

    if legacy_policy.cmd in ('ALL', 'SELECT', 'UPDATE', 'DELETE') then
      create_sql := create_sql || ' using (private.erp_user_has_any_permission(array[''system.manage'']::text[]))';
    end if;

    if legacy_policy.cmd in ('ALL', 'INSERT', 'UPDATE') then
      create_sql := create_sql || ' with check (private.erp_user_has_any_permission(array[''system.manage'']::text[]))';
    end if;

    execute create_sql;
  end loop;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'parasut_sync_runs',
    'parasut_contacts',
    'parasut_products',
    'parasut_sales_invoices',
    'parasut_sales_invoice_details',
    'parasut_purchase_bills',
    'parasut_purchase_bill_details',
    'parasut_payments',
    'parasut_accounts',
    'parasut_sync_errors'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    execute format(
      'drop policy if exists %I on public.%I',
      'parasut_admin_read_' || target_table,
      target_table
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        private.erp_user_has_any_permission(array[''system.manage'']::text[])
        or exists (
          select 1
          from public.company_memberships as membership
          where membership.company_id = %I.company_id
            and membership.branch_id is null
            and membership.is_company_admin = true
            and membership.is_active = true
            and (
              membership.auth_user_id = (select auth.uid())
              or lower(membership.email) = lower((select auth.jwt() ->> ''email''))
            )
        )
      )',
      'parasut_admin_read_' || target_table,
      target_table,
      target_table
    );
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.is_email_allowed(text)') is not null then
    revoke all on function public.is_email_allowed(text) from anon;
    revoke all on function public.is_email_allowed(text) from authenticated;
  end if;
end $$;
