-- Phase 26: Supabase production security governance.
-- Non-destructive hardening: removes known broad authenticated policies on
-- tenant-owned tables, preserves public catalog/CMS behavior, and tightens anon
-- grants for sensitive ERP/payment/governance data.

do $$
declare
  target_table text;
  policy_name text;
  member_update_policy text;
begin
  foreach target_table in array array[
    'companies',
    'company_branches',
    'warehouses',
    'company_memberships',
    'erp_users',
    'erp_audit_logs',
    'erp_notifications',
    'stakeholders',
    'crm_leads',
    'crm_opportunities',
    'crm_tasks',
    'sales_orders',
    'sales_order_items',
    'purchase_orders',
    'purchase_order_items',
    'work_orders',
    'work_order_operations',
    'inventory_items',
    'inventory_movements',
    'financial_accounts',
    'invoices',
    'payments',
    'employees',
    'employee_time_entries',
    'hr_departments',
    'hr_positions',
    'hr_leave_requests',
    'hr_recruitment_candidates',
    'hr_onboarding_tasks',
    'shipments',
    'shipment_items',
    'quality_reports',
    'quality_measurements',
    'maintenance_tasks',
    'orders',
    'order_items',
    'shop_payment_statuses',
    'shop_customer_profiles',
    'shop_inventory_reservations',
    'commerce_checkout_events',
    'shop_shipments',
    'shop_fulfillment_history',
    'shop_customer_notifications',
    'shop_return_requests',
    'payment_provider_events',
    'payment_reconciliation_logs',
    'accounting_entries',
    'payment_refund_operations',
    'payment_provider_health'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('alter table public.%I enable row level security', target_table);

      foreach policy_name in array array[
        target_table || '_select_authenticated',
        target_table || '_insert_authenticated',
        target_table || '_update_authenticated',
        'erp authenticated select ' || target_table,
        'erp authenticated insert ' || target_table,
        'erp authenticated update ' || target_table
      ]
      loop
        execute format('drop policy if exists %I on public.%I', policy_name, target_table);
      end loop;

      execute format('revoke all on table public.%I from anon', target_table);
      execute format('grant select, insert, update on table public.%I to authenticated', target_table);
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
      member_update_policy := 'tenant_member_update_' || target_table;
      execute format('drop policy if exists %I on public.%I', member_update_policy, target_table);
      execute format(
        'create policy %I on public.%I for update to authenticated using (
          company_id is null
          or exists (
            select 1
            from public.company_memberships cm
            where lower(cm.email) = lower(auth.jwt() ->> ''email'')
              and cm.is_active = true
              and cm.company_id = company_id
              and (branch_id is null or cm.branch_id is null or cm.branch_id = branch_id)
          )
        ) with check (
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
        member_update_policy,
        target_table
      );
    end if;
  end loop;
end $$;

-- Keep explicitly public read-only commerce/catalog and website content accessible.
grant select on table public.products to anon, authenticated;
grant select on table public.shop_categories to anon, authenticated;
grant select on table public.shop_campaigns to anon, authenticated;
grant select on table public.shop_shipping_methods to anon, authenticated;
grant select on table public.shop_carriers to anon, authenticated;
grant select on table public.website_pages to anon, authenticated;
grant select on table public.website_seo_settings to anon, authenticated;
grant select on table public.website_menu_items to anon, authenticated;
grant select on table public.website_media_assets to anon, authenticated;
grant select on table public.website_banners to anon, authenticated;

-- Sensitive provider and governance functions stay unavailable through direct Data API roles.
revoke all on function public.record_payment_reconciliation(uuid, uuid, text, text, numeric, numeric, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.ensure_commerce_payment_financial_records(uuid, uuid, text, text, numeric, text) from public, anon, authenticated;
