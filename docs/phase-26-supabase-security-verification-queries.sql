-- Phase 26 Supabase production security verification queries.
-- Run in Supabase SQL editor after migrations are applied.
-- These queries are read-only and are intended for audit evidence.

-- 1. Public schema tables without RLS.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- Expected: no sensitive ERP, payment, customer, governance or tenant tables.
-- Public read-only website/catalog tables may still rely on explicit public policies.

-- 2. Policies that are still broad using/check true.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    lower(coalesce(qual, '')) in ('true', '(true)')
    or lower(coalesce(with_check, '')) in ('true', '(true)')
  )
order by tablename, policyname;

-- Expected: only intentional public read policies for public website/catalog content.

-- 3. Anon privileges on sensitive ERP/payment tables.
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name in (
    'erp_users',
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
    'orders',
    'order_items',
    'shop_payment_statuses',
    'shop_customer_profiles',
    'shop_inventory_reservations',
    'commerce_checkout_events',
    'payment_provider_events',
    'payment_reconciliation_logs',
    'accounting_entries',
    'payment_refund_operations'
  )
order by table_name, privilege_type;

-- Expected: zero rows.

-- 4. Public read grants that remain intentional.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
order by table_name, privilege_type;

-- Expected: website/catalog/shipping surfaces only.

-- 5. Tenant policy coverage on tenant-owned tables.
select tablename,
       count(*) filter (where policyname like 'tenant_member_read_%') as member_read_policies,
       count(*) filter (where policyname like 'tenant_member_write_%') as member_insert_policies,
       count(*) filter (where policyname like 'tenant_member_update_%') as member_update_policies,
       count(*) filter (where policyname like 'tenant_admin_manage_%') as admin_policies
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

-- Expected: owned ERP/payment tables have tenant member/admin coverage.

-- 6. Tenant-owned rows missing company assignment after Phase 24/25.
select 'stakeholders' as table_name, count(*) as null_company_rows from public.stakeholders where company_id is null
union all select 'sales_orders', count(*) from public.sales_orders where company_id is null
union all select 'purchase_orders', count(*) from public.purchase_orders where company_id is null
union all select 'work_orders', count(*) from public.work_orders where company_id is null
union all select 'inventory_items', count(*) from public.inventory_items where company_id is null
union all select 'financial_accounts', count(*) from public.financial_accounts where company_id is null
union all select 'invoices', count(*) from public.invoices where company_id is null
union all select 'payments', count(*) from public.payments where company_id is null
union all select 'employees', count(*) from public.employees where company_id is null
union all select 'orders', count(*) from public.orders where company_id is null
union all select 'shop_payment_statuses', count(*) from public.shop_payment_statuses where company_id is null
union all select 'payment_provider_events', count(*) from public.payment_provider_events where company_id is null
union all select 'payment_reconciliation_logs', count(*) from public.payment_reconciliation_logs where company_id is null
union all select 'accounting_entries', count(*) from public.accounting_entries where company_id is null
union all select 'payment_refund_operations', count(*) from public.payment_refund_operations where company_id is null
order by table_name;

-- Expected before backfill: may be non-zero. Expected before strict tenant launch: zero or approved exceptions.

-- 7. Security definer functions exposed to browser roles.
select n.nspname as schema_name,
       p.proname as function_name,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'internal')
  and p.prosecdef = true
order by schema_name, function_name;

-- Expected: no sensitive security-definer function is executable by anon/authenticated unless explicitly reviewed.

-- 8. Views in public schema that may bypass RLS.
select table_schema, table_name
from information_schema.views
where table_schema = 'public'
order by table_name;

-- Expected: every public view is reviewed for security_invoker behavior or revoked from browser roles.

-- 9. Storage buckets and public/private posture.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

-- Expected: public buckets are limited to intended website/media assets; private buckets require storage.objects RLS policies.

-- 10. Storage object policies.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
order by tablename, policyname;

-- Expected: private buckets have owner/admin policies; public buckets have read-only public policies if needed.
