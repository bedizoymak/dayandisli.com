-- Phase 10 authorization foundation.
-- Extends existing ERP users without creating a second identity system.

alter table if exists public.erp_users
  add column if not exists roles text[] not null default '{}',
  add column if not exists permissions text[] not null default '{}';

update public.erp_users
set roles = array[role]
where roles = '{}';

create index if not exists idx_erp_users_role on public.erp_users(role);
create index if not exists idx_erp_users_roles on public.erp_users using gin(roles);
create index if not exists idx_erp_users_permissions on public.erp_users using gin(permissions);
