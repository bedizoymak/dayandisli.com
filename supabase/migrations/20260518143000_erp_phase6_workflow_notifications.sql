-- ERP Phase 6: workflow automation, operation links, notifications.
-- Additive only: no existing production tables are dropped or truncated.

begin;

alter table if exists public.subcontracting_jobs
  add column if not exists work_order_operation_id uuid null;

alter table if exists public.quality_reports
  add column if not exists work_order_operation_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subcontracting_jobs_work_order_operation_id_fkey'
  ) then
    alter table public.subcontracting_jobs
      add constraint subcontracting_jobs_work_order_operation_id_fkey
      foreign key (work_order_operation_id)
      references public.work_order_operations(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quality_reports_work_order_operation_id_fkey'
  ) then
    alter table public.quality_reports
      add constraint quality_reports_work_order_operation_id_fkey
      foreign key (work_order_operation_id)
      references public.work_order_operations(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.erp_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid null references public.erp_users(id) on delete set null,
  recipient_email text null,
  severity text not null default 'info'
    check (severity in ('info', 'success', 'warning', 'danger')),
  category text not null default 'workflow'
    check (category in ('workflow', 'quality', 'subcontracting', 'shipment', 'inventory', 'maintenance', 'system')),
  title text not null,
  body text null,
  entity_type text null,
  entity_id uuid null,
  action_url text null,
  is_read boolean not null default false,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_subcontracting_jobs_operation_id
  on public.subcontracting_jobs(work_order_operation_id);

create index if not exists idx_quality_reports_operation_id
  on public.quality_reports(work_order_operation_id);

create index if not exists idx_erp_notifications_read_created
  on public.erp_notifications(is_read, created_at desc);

create index if not exists idx_erp_notifications_entity
  on public.erp_notifications(entity_type, entity_id);

create or replace function public.erp_current_actor_id()
returns uuid
language plpgsql
stable
as $$
declare
  v_actor_id uuid;
begin
  begin
    v_actor_id := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  exception when others then
    v_actor_id := null;
  end;

  return v_actor_id;
end;
$$;

create or replace function public.erp_current_actor_email()
returns text
language plpgsql
stable
as $$
begin
  return nullif(current_setting('request.jwt.claim.email', true), '');
exception when others then
  return null;
end;
$$;

create or replace function public.erp_write_audit_log(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_old_status text default null,
  p_new_status text default null,
  p_description text default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.erp_audit_logs (
    actor_user_id,
    actor_email,
    entity_type,
    entity_id,
    action,
    old_status,
    new_status,
    description,
    metadata
  )
  values (
    public.erp_current_actor_id(),
    public.erp_current_actor_email(),
    p_entity_type,
    p_entity_id,
    p_action,
    p_old_status,
    p_new_status,
    p_description,
    p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.erp_create_notification(
  p_category text,
  p_severity text,
  p_title text,
  p_body text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_action_url text default null,
  p_recipient_user_id uuid default null,
  p_recipient_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_category text := coalesce(nullif(p_category, ''), 'workflow');
  v_severity text := coalesce(nullif(p_severity, ''), 'info');
begin
  if v_category not in ('workflow', 'quality', 'subcontracting', 'shipment', 'inventory', 'maintenance', 'system') then
    v_category := 'workflow';
  end if;

  if v_severity not in ('info', 'success', 'warning', 'danger') then
    v_severity := 'info';
  end if;

  insert into public.erp_notifications (
    recipient_user_id,
    recipient_email,
    severity,
    category,
    title,
    body,
    entity_type,
    entity_id,
    action_url
  )
  values (
    p_recipient_user_id,
    p_recipient_email,
    v_severity,
    v_category,
    p_title,
    p_body,
    p_entity_type,
    p_entity_id,
    p_action_url
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.erp_mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.erp_notifications
  set is_read = true,
      read_at = coalesce(read_at, now())
  where id = p_notification_id;
end;
$$;

create or replace function public.erp_try_complete_work_order(p_work_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_order public.work_orders%rowtype;
  v_total_ops integer := 0;
  v_open_ops integer := 0;
  v_pending_quality integer := 0;
  v_active_subcontracting integer := 0;
  v_updated integer := 0;
begin
  select *
  into v_work_order
  from public.work_orders
  where id = p_work_order_id;

  if not found then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where status not in ('completed', 'cancelled'))::integer
  into v_total_ops, v_open_ops
  from public.work_order_operations
  where work_order_id = p_work_order_id;

  if v_total_ops = 0 or v_open_ops > 0 then
    return;
  end if;

  select count(*)::integer
  into v_pending_quality
  from public.quality_reports
  where work_order_id = p_work_order_id
    and result in ('pending', 'failed');

  select count(*)::integer
  into v_active_subcontracting
  from public.subcontracting_jobs
  where work_order_id = p_work_order_id
    and status in ('planned', 'sent', 'in_process');

  if v_pending_quality > 0 or v_active_subcontracting > 0 then
    return;
  end if;

  update public.work_orders
  set status = 'completed',
      actual_end_at = coalesce(actual_end_at, now())
  where id = p_work_order_id
    and status not in ('completed', 'cancelled');

  get diagnostics v_updated = row_count;

  if v_updated > 0 then
    perform public.erp_write_audit_log(
      'work_order',
      p_work_order_id,
      'work_order_completed',
      v_work_order.status,
      'completed',
      v_work_order.work_order_no || ' is emri operasyonlari tamamlandi.',
      jsonb_build_object('sales_order_id', v_work_order.sales_order_id)
    );

    perform public.erp_create_notification(
      'workflow',
      'success',
      'Is emri tamamlandi',
      v_work_order.work_order_no || ' icin tum operasyonlar tamamlandi.',
      'work_order',
      p_work_order_id,
      '/erp/work-orders/' || p_work_order_id::text
    );
  end if;

  if v_work_order.sales_order_id is not null then
    update public.sales_orders
    set status = 'ready_to_ship'
    where id = v_work_order.sales_order_id
      and status not in ('ready_to_ship', 'shipped', 'invoiced', 'closed', 'cancelled');
  end if;
end;
$$;

create or replace function public.erp_work_order_operation_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_order public.work_orders%rowtype;
  v_report_id uuid;
  v_status_changed boolean;
  v_quality_flag_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_status_changed := true;
    v_quality_flag_changed := false;
  else
    v_status_changed := old.status is distinct from new.status;
    v_quality_flag_changed := old.quality_required is distinct from new.quality_required;
  end if;

  if not v_status_changed and not v_quality_flag_changed then
    return new;
  end if;

  select *
  into v_work_order
  from public.work_orders
  where id = new.work_order_id;

  if not found then
    return new;
  end if;

  if new.status = 'in_progress' and v_status_changed then
    update public.work_orders
    set status = 'in_progress',
        actual_start_at = coalesce(actual_start_at, new.started_at, now())
    where id = new.work_order_id
      and status in ('planned', 'released', 'paused');
  end if;

  if new.status = 'completed' and new.quality_required then
    if not exists (
      select 1
      from public.quality_reports
      where work_order_operation_id = new.id
        and result = 'pending'
    ) then
      insert into public.quality_reports (
        report_no,
        work_order_id,
        work_order_operation_id,
        sales_order_id,
        result,
        notes
      )
      values (
        public.next_erp_number('QUALITY_REPORT'),
        new.work_order_id,
        new.id,
        v_work_order.sales_order_id,
        'pending',
        new.operation_name || ' operasyonu icin otomatik kalite kontrol kaydi.'
      )
      returning id into v_report_id;

      perform public.erp_write_audit_log(
        'quality_report',
        v_report_id,
        'quality_report_created',
        null,
        'pending',
        new.operation_name || ' operasyonu kalite kontrole alindi.',
        jsonb_build_object('work_order_id', new.work_order_id, 'work_order_operation_id', new.id)
      );

      perform public.erp_create_notification(
        'quality',
        'warning',
        'Kalite kontrol bekliyor',
        new.operation_name || ' operasyonu icin kalite raporu olusturuldu.',
        'quality_report',
        v_report_id,
        '/erp/quality/' || v_report_id::text
      );
    end if;

    update public.work_orders
    set status = 'quality_check'
    where id = new.work_order_id
      and status not in ('completed', 'cancelled');
  end if;

  if new.status = 'completed' then
    perform public.erp_try_complete_work_order(new.work_order_id);
  end if;

  return new;
end;
$$;

create or replace function public.erp_quality_report_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_result_changed := true;
  else
    v_result_changed := old.result is distinct from new.result;
  end if;

  if not v_result_changed or new.work_order_id is null then
    return new;
  end if;

  if new.result = 'pending' then
    update public.work_orders
    set status = 'quality_check'
    where id = new.work_order_id
      and status not in ('completed', 'cancelled');
  elsif new.result in ('passed', 'conditional') then
    perform public.erp_create_notification(
      'quality',
      'success',
      'Kalite kontrol tamamlandi',
      new.report_no || ' kalite sonucu: ' || new.result,
      'quality_report',
      new.id,
      '/erp/quality/' || new.id::text
    );

    perform public.erp_try_complete_work_order(new.work_order_id);
  elsif new.result = 'failed' then
    update public.work_orders
    set status = 'quality_check'
    where id = new.work_order_id
      and status not in ('completed', 'cancelled');

    perform public.erp_create_notification(
      'quality',
      'danger',
      'Kalite kontrol basarisiz',
      new.report_no || ' kalite kontrolunden kaldi.',
      'quality_report',
      new.id,
      '/erp/quality/' || new.id::text
    );
  end if;

  return new;
end;
$$;

create or replace function public.erp_subcontracting_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_status_changed := true;
  else
    v_status_changed := old.status is distinct from new.status;
  end if;

  if not v_status_changed then
    return new;
  end if;

  if new.status in ('sent', 'in_process') then
    if new.work_order_id is not null then
      update public.work_orders
      set status = 'waiting_subcontractor'
      where id = new.work_order_id
        and status not in ('completed', 'cancelled');
    end if;

    if new.work_order_operation_id is not null then
      update public.work_order_operations
      set status = 'paused'
      where id = new.work_order_operation_id
        and status not in ('completed', 'cancelled');
    end if;

    perform public.erp_create_notification(
      'subcontracting',
      'warning',
      'Fason islem bekliyor',
      new.process_type || ' fason sureci devam ediyor.',
      'subcontracting_job',
      new.id,
      '/erp/subcontracting/' || new.id::text
    );
  elsif new.status = 'returned' then
    if new.work_order_operation_id is not null then
      update public.work_order_operations
      set status = 'completed',
          completed_at = coalesce(completed_at, now())
      where id = new.work_order_operation_id
        and status not in ('completed', 'cancelled');
    end if;

    if new.work_order_id is not null then
      perform public.erp_try_complete_work_order(new.work_order_id);
    end if;

    perform public.erp_create_notification(
      'subcontracting',
      'success',
      'Fason islem geri geldi',
      new.process_type || ' fason sureci tamamlandi.',
      'subcontracting_job',
      new.id,
      '/erp/subcontracting/' || new.id::text
    );
  end if;

  return new;
end;
$$;

create or replace function public.erp_shipment_delivery_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_changed boolean;
  v_old_order_status text;
begin
  if tg_op = 'INSERT' then
    v_status_changed := true;
  else
    v_status_changed := old.status is distinct from new.status;
  end if;

  if not v_status_changed or new.sales_order_id is null then
    return new;
  end if;

  if new.status = 'shipped' then
    update public.sales_orders
    set status = 'shipped'
    where id = new.sales_order_id
      and status not in ('shipped', 'invoiced', 'closed', 'cancelled');

    perform public.erp_create_notification(
      'shipment',
      'info',
      'Sevkiyat yola cikti',
      new.shipment_no || ' sevkiyati yola cikti.',
      'shipment',
      new.id,
      '/erp/shipments/' || new.id::text
    );
  elsif new.status = 'delivered' then
    select status
    into v_old_order_status
    from public.sales_orders
    where id = new.sales_order_id;

    update public.sales_orders
    set status = 'closed'
    where id = new.sales_order_id
      and status not in ('closed', 'cancelled');

    perform public.erp_write_audit_log(
      'sales_order',
      new.sales_order_id,
      'delivery_completed',
      v_old_order_status,
      'closed',
      new.shipment_no || ' sevkiyati teslim edildi ve siparis kapatildi.',
      jsonb_build_object('shipment_id', new.id, 'shipment_no', new.shipment_no)
    );

    perform public.erp_create_notification(
      'shipment',
      'success',
      'Teslim tamamlandi',
      new.shipment_no || ' teslim edildi; ilgili siparis kapatildi.',
      'shipment',
      new.id,
      '/erp/shipments/' || new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_erp_work_order_operations_workflow on public.work_order_operations;
create trigger trg_erp_work_order_operations_workflow
after insert or update of status, quality_required
on public.work_order_operations
for each row
execute function public.erp_work_order_operation_workflow();

drop trigger if exists trg_erp_quality_reports_workflow on public.quality_reports;
create trigger trg_erp_quality_reports_workflow
after insert or update of result
on public.quality_reports
for each row
execute function public.erp_quality_report_workflow();

drop trigger if exists trg_erp_subcontracting_jobs_workflow on public.subcontracting_jobs;
create trigger trg_erp_subcontracting_jobs_workflow
after insert or update of status
on public.subcontracting_jobs
for each row
execute function public.erp_subcontracting_workflow();

drop trigger if exists trg_erp_shipments_delivery_workflow on public.shipments;
create trigger trg_erp_shipments_delivery_workflow
after insert or update of status
on public.shipments
for each row
execute function public.erp_shipment_delivery_workflow();

alter table public.erp_notifications enable row level security;

drop policy if exists "erp authenticated select erp_notifications" on public.erp_notifications;
create policy "erp authenticated select erp_notifications"
on public.erp_notifications
for select
to authenticated
using (true);

drop policy if exists "erp authenticated insert erp_notifications" on public.erp_notifications;
create policy "erp authenticated insert erp_notifications"
on public.erp_notifications
for insert
to authenticated
with check (true);

drop policy if exists "erp authenticated update erp_notifications" on public.erp_notifications;
create policy "erp authenticated update erp_notifications"
on public.erp_notifications
for update
to authenticated
using (true)
with check (true);

commit;
