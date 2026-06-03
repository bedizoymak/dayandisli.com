-- Phase 25: Tenant isolation, RLS enforcement and multi-company data safety.
-- Non-destructive hardening for Phase 24 ownership fields. Legacy rows with
-- null company_id remain visible until a controlled backfill assigns ownership.

do $$
declare
  target_table text;
  member_read_policy text;
  member_write_policy text;
begin
  foreach target_table in array array[
    'companies',
    'company_branches',
    'warehouses',
    'company_memberships',
    'erp_audit_logs',
    'erp_notifications',
    'stakeholders',
    'crm_leads',
    'crm_opportunities',
    'crm_tasks',
    'sales_orders',
    'purchase_orders',
    'work_orders',
    'inventory_items',
    'inventory_movements',
    'financial_accounts',
    'invoices',
    'payments',
    'employees',
    'shipments',
    'quality_reports',
    'maintenance_tasks',
    'orders',
    'products',
    'shop_payment_statuses',
    'payment_provider_events',
    'payment_reconciliation_logs',
    'accounting_entries',
    'payment_refund_operations'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('alter table public.%I enable row level security', target_table);

      execute format('drop policy if exists %I on public.%I', 'tenant_admin_manage_' || target_table, target_table);
      execute format(
        'create policy %I on public.%I for all to authenticated using (
          exists (
            select 1 from public.admin_users au
            where lower(au.email) = lower(auth.jwt() ->> ''email'')
              and au.is_active = true
          )
        ) with check (
          exists (
            select 1 from public.admin_users au
            where lower(au.email) = lower(auth.jwt() ->> ''email'')
              and au.is_active = true
          )
        )',
        'tenant_admin_manage_' || target_table,
        target_table
      );
    end if;
  end loop;

  foreach target_table in array array[
    'erp_audit_logs',
    'erp_notifications',
    'stakeholders',
    'crm_leads',
    'crm_opportunities',
    'crm_tasks',
    'sales_orders',
    'purchase_orders',
    'work_orders',
    'inventory_items',
    'inventory_movements',
    'financial_accounts',
    'invoices',
    'payments',
    'employees',
    'shipments',
    'quality_reports',
    'maintenance_tasks',
    'orders',
    'products',
    'shop_payment_statuses',
    'payment_provider_events',
    'payment_reconciliation_logs',
    'accounting_entries',
    'payment_refund_operations'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      member_read_policy := 'tenant_member_read_' || target_table;
      member_write_policy := 'tenant_member_write_' || target_table;

      execute format('drop policy if exists %I on public.%I', member_read_policy, target_table);
      execute format(
        'create policy %I on public.%I for select to authenticated using (
          company_id is null
          or exists (
            select 1
            from public.company_memberships cm
            where lower(cm.email) = lower(auth.jwt() ->> ''email'')
              and cm.is_active = true
              and cm.company_id = company_id
              and (branch_id is null or cm.branch_id is null or cm.branch_id = branch_id)
          )
        )',
        member_read_policy,
        target_table
      );

      execute format('drop policy if exists %I on public.%I', member_write_policy, target_table);
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (
          company_id is null
          or exists (
            select 1
            from public.company_memberships cm
            where lower(cm.email) = lower(auth.jwt() ->> ''email'')
              and cm.is_active = true
              and cm.company_id = company_id
              and (branch_id is null or cm.branch_id is null or cm.branch_id = branch_id)
          )
        )',
        member_write_policy,
        target_table
      );
    end if;
  end loop;
end $$;

drop policy if exists tenant_member_read_companies on public.companies;
create policy tenant_member_read_companies
on public.companies
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships cm
    where lower(cm.email) = lower(auth.jwt() ->> 'email')
      and cm.is_active = true
      and cm.company_id = companies.id
  )
);

drop policy if exists tenant_member_read_branches on public.company_branches;
create policy tenant_member_read_branches
on public.company_branches
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships cm
    where lower(cm.email) = lower(auth.jwt() ->> 'email')
      and cm.is_active = true
      and cm.company_id = company_branches.company_id
      and (cm.branch_id is null or cm.branch_id = company_branches.id)
  )
);

drop policy if exists tenant_member_read_warehouses on public.warehouses;
create policy tenant_member_read_warehouses
on public.warehouses
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships cm
    where lower(cm.email) = lower(auth.jwt() ->> 'email')
      and cm.is_active = true
      and cm.company_id = warehouses.company_id
      and (warehouses.branch_id is null or cm.branch_id is null or cm.branch_id = warehouses.branch_id)
  )
);

drop policy if exists tenant_member_read_own_memberships on public.company_memberships;
create policy tenant_member_read_own_memberships
on public.company_memberships
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));
