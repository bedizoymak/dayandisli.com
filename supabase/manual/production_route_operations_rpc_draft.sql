-- DRAFT ONLY. DO NOT RUN WITHOUT REVIEW.
-- This file is intentionally outside supabase/migrations/.
-- Validate it against an isolated local or staging Supabase project first.

create or replace function public.erp_create_operations_from_route(
  p_work_order_id uuid,
  p_route_id uuid,
  p_allow_append boolean default false
)
returns setof public.work_order_operations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_actor_email text;
  v_work_order public.work_orders%rowtype;
  v_route public.production_routes%rowtype;
  v_step public.production_route_steps%rowtype;
  v_operation public.work_order_operations%rowtype;
  v_created_ids uuid[] := '{}'::uuid[];
begin
  v_actor_user_id := (select auth.uid());
  v_actor_email := nullif((select auth.jwt() ->> 'email'), '');

  if v_actor_user_id is null or v_actor_email is null then
    raise exception using
      errcode = '42501',
      message = 'Bu işlem için oturum açmalısınız.';
  end if;

  select work_order.*
  into v_work_order
  from public.work_orders as work_order
  where work_order.id = p_work_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'İş emri bulunamadı veya erişim yetkiniz yok.';
  end if;

  if v_work_order.company_id is not null
    and not exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(v_actor_email)
        and membership.is_active = true
        and membership.company_id = v_work_order.company_id
        and (
          v_work_order.branch_id is null
          or membership.branch_id is null
          or membership.branch_id = v_work_order.branch_id
        )
    ) then
    raise exception using
      errcode = '42501',
      message = 'Bu şirket veya şube için işlem yetkiniz yok.';
  end if;

  select route.*
  into v_route
  from public.production_routes as route
  where route.id = p_route_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Üretim rotası bulunamadı veya erişim yetkiniz yok.';
  end if;

  if not coalesce(p_allow_append, false)
    and exists (
      select 1
      from public.work_order_operations as operation
      where operation.work_order_id = v_work_order.id
    ) then
    raise exception using
      errcode = '23505',
      message = 'Bu iş emrinde zaten operasyon var.';
  end if;

  if not exists (
    select 1
    from public.production_route_steps as step
    where step.route_id = v_route.id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Üretim rotasında operasyon adımı bulunamadı.';
  end if;

  for v_step in
    select step.*
    from public.production_route_steps as step
    where step.route_id = v_route.id
    order by step.step_no, step.id
  loop
    insert into public.work_order_operations (
      work_order_id,
      step_no,
      operation_name,
      machine_id,
      status,
      planned_minutes,
      actual_minutes,
      quality_required,
      notes
    )
    values (
      v_work_order.id,
      v_step.step_no,
      v_step.operation_name,
      v_step.machine_id,
      'pending',
      v_step.estimated_minutes,
      0,
      false,
      v_step.notes
    )
    returning * into v_operation;

    v_created_ids := array_append(v_created_ids, v_operation.id);
  end loop;

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
    v_work_order.company_id,
    v_work_order.branch_id,
    'work_order',
    v_work_order.id,
    'route_operations_created',
    v_work_order.work_order_no || ' iş emrine rota operasyonları eklendi.',
    jsonb_build_object(
      'route_id', v_route.id,
      'operation_count', cardinality(v_created_ids)
    )
  );

  return query
  select operation.*
  from public.work_order_operations as operation
  where operation.id = any(v_created_ids)
  order by operation.step_no, operation.id;
end;
$$;

revoke all on function public.erp_create_operations_from_route(
  uuid,
  uuid,
  boolean
)
from public, anon;

grant execute on function public.erp_create_operations_from_route(
  uuid,
  uuid,
  boolean
)
to authenticated;
