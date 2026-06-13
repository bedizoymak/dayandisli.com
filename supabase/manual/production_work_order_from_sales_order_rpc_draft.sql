-- DRAFT ONLY. DO NOT RUN WITHOUT REVIEW.
-- This file is intentionally outside supabase/migrations/.
-- Validate it against an isolated local or staging Supabase project first.

create or replace function public.erp_create_work_order_from_sales_order(
  p_sales_order_id uuid
)
returns public.work_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_actor_email text;
  v_sales_order public.sales_orders%rowtype;
  v_first_item public.sales_order_items%rowtype;
  v_existing_work_order public.work_orders%rowtype;
  v_work_order public.work_orders%rowtype;
  v_work_order_no text;
begin
  v_actor_user_id := (select auth.uid());
  v_actor_email := nullif((select auth.jwt() ->> 'email'), '');

  if v_actor_user_id is null or v_actor_email is null then
    raise exception using
      errcode = '42501',
      message = 'Bu işlem için oturum açmalısınız.';
  end if;

  select sales_order.*
  into v_sales_order
  from public.sales_orders as sales_order
  where sales_order.id = p_sales_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Satış siparişi bulunamadı veya erişim yetkiniz yok.';
  end if;

  if v_sales_order.company_id is not null
    and not exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(v_actor_email)
        and membership.is_active = true
        and membership.company_id = v_sales_order.company_id
        and (
          v_sales_order.branch_id is null
          or membership.branch_id is null
          or membership.branch_id = v_sales_order.branch_id
        )
    ) then
    raise exception using
      errcode = '42501',
      message = 'Bu şirket veya şube için işlem yetkiniz yok.';
  end if;

  select work_order.*
  into v_existing_work_order
  from public.work_orders as work_order
  where work_order.sales_order_id = v_sales_order.id
  limit 1;

  if found then
    raise exception using
      errcode = '23505',
      message = 'Bu sipariş için zaten iş emri var.';
  end if;

  select item.*
  into v_first_item
  from public.sales_order_items as item
  where item.sales_order_id = v_sales_order.id
  order by item.created_at, item.id
  limit 1;

  v_work_order_no := public.next_erp_number('WORK_ORDER');

  insert into public.work_orders (
    work_order_no,
    sales_order_id,
    stakeholder_id,
    title,
    part_name,
    quantity,
    status,
    priority,
    planned_end_date,
    company_id,
    branch_id
  )
  values (
    v_work_order_no,
    v_sales_order.id,
    v_sales_order.stakeholder_id,
    v_sales_order.title,
    coalesce(v_first_item.description, v_sales_order.title),
    coalesce(v_first_item.quantity, 1),
    'planned',
    v_sales_order.priority,
    v_sales_order.due_date,
    v_sales_order.company_id,
    v_sales_order.branch_id
  )
  returning * into v_work_order;

  update public.sales_orders
  set status = 'in_production'
  where id = v_sales_order.id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Satış siparişi durumu güncellenemedi.';
  end if;

  insert into public.erp_audit_logs (
    actor_user_id,
    actor_email,
    company_id,
    branch_id,
    entity_type,
    entity_id,
    action,
    description,
    metadata
  )
  values (
    v_actor_user_id,
    v_actor_email,
    v_sales_order.company_id,
    v_sales_order.branch_id,
    'sales_order',
    v_sales_order.id,
    'sales_order_converted',
    v_sales_order.order_no || ' numaralı sipariş iş emrine dönüştürüldü.',
    jsonb_build_object(
      'work_order_id', v_work_order.id,
      'work_order_no', v_work_order.work_order_no
    )
  );

  return v_work_order;
end;
$$;

revoke all on function public.erp_create_work_order_from_sales_order(uuid)
from public, anon;

grant execute on function public.erp_create_work_order_from_sales_order(uuid)
to authenticated;
