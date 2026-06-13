
create or replace function public.erp_create_inventory_movement(
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_source_type text default 'manual',
  p_source_id uuid default null,
  p_notes text default null,
  p_warehouse_id uuid default null
)
returns public.inventory_movements
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.inventory_items%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_next_stock numeric(14,3);
begin
  if p_movement_type not in ('in', 'out', 'adjustment', 'reservation', 'return') then
    raise exception using
      errcode = '22023',
      message = 'Geçersiz stok hareketi türü.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception using
      errcode = '22023',
      message = 'Miktar sıfırdan büyük olmalıdır.';
  end if;

  select item.*
  into v_item
  from public.inventory_items as item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Stok kartı bulunamadı veya erişim yetkiniz yok.';
  end if;

  if p_warehouse_id is not null then
    select warehouse.*
    into v_warehouse
    from public.warehouses as warehouse
    where warehouse.id = p_warehouse_id;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'Depo bulunamadı veya erişim yetkiniz yok.';
    end if;

    if v_item.company_id is not null
      and v_warehouse.company_id is distinct from v_item.company_id then
      raise exception using
        errcode = '22023',
        message = 'Depo ve stok kartı aynı şirkete ait olmalıdır.';
    end if;

    if v_item.branch_id is not null
      and v_warehouse.branch_id is not null
      and v_warehouse.branch_id is distinct from v_item.branch_id then
      raise exception using
        errcode = '22023',
        message = 'Depo ve stok kartı şube kapsamı uyuşmuyor.';
    end if;
  end if;

  v_next_stock := v_item.current_stock;

  if p_movement_type in ('in', 'return', 'adjustment') then
    v_next_stock := v_next_stock + p_quantity;
  elsif p_movement_type = 'out' then
    v_next_stock := v_next_stock - p_quantity;
  end if;

  if v_next_stock < 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Stok eksiye düşemez.';
  end if;

  insert into public.inventory_movements (
    inventory_item_id,
    movement_type,
    quantity,
    source_type,
    source_id,
    notes,
    company_id,
    branch_id,
    warehouse_id
  )
  values (
    v_item.id,
    p_movement_type,
    p_quantity,
    coalesce(nullif(p_source_type, ''), 'manual'),
    p_source_id,
    p_notes,
    v_item.company_id,
    v_item.branch_id,
    p_warehouse_id
  )
  returning * into v_movement;

  if p_movement_type <> 'reservation' then
    update public.inventory_items
    set current_stock = v_next_stock
    where id = v_item.id;
  end if;

  insert into public.erp_audit_logs (
    actor_user_id,
    actor_email,
    company_id,
    branch_id,
    entity_type,
    entity_id,
    action,
    old_status,
    new_status,
    description,
    metadata
  )
  values (
    (select auth.uid()),
    (select auth.jwt() ->> 'email'),
    v_item.company_id,
    v_item.branch_id,
    'inventory_item',
    v_item.id,
    'inventory_movement_created',
    v_item.current_stock::text,
    v_next_stock::text,
    p_movement_type || ' stok hareketi oluşturuldu.',
    jsonb_build_object(
      'movement_id', v_movement.id,
      'quantity', p_quantity,
      'source_type', coalesce(nullif(p_source_type, ''), 'manual'),
      'warehouse_id', p_warehouse_id
    )
  );

  return v_movement;
end;
$$;

revoke all on function public.erp_create_inventory_movement(
  uuid,
  text,
  numeric,
  text,
  uuid,
  text,
  uuid
) from public, anon;

grant execute on function public.erp_create_inventory_movement(
  uuid,
  text,
  numeric,
  text,
  uuid,
  text,
  uuid
) to authenticated;
