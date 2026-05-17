-- ERP Phase 2/3 readiness migration (additive only)
-- This migration does not drop tables or delete production data.

begin;

-- Keep operational metadata readable with correct Turkish names where the first ERP migration seeded ASCII names.
update public.machines set name = 'Taşlama' where name = 'Taslama';
update public.machines set name = 'Azdırma' where name = 'Azdirma';
update public.machines set name = 'Profil Taşlama' where name = 'Profil Taslama';
update public.machines set name = 'Silindirik Taşlama' where name = 'Silindirik Taslama';

alter table if exists public.stakeholders
  alter column country set default 'Türkiye';

insert into public.erp_number_sequences (sequence_key, prefix, current_value)
values
  ('SALES_ORDER', 'SO', 0),
  ('WORK_ORDER', 'WO', 0),
  ('SHIPMENT', 'SHP', 0),
  ('QUALITY_REPORT', 'QC', 0),
  ('SUBCONTRACTING', 'FSN', 0)
on conflict (sequence_key) do update
set prefix = excluded.prefix,
    updated_at = now();

create or replace function public.next_erp_number(p_sequence_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_value integer;
  v_result text;
begin
  update public.erp_number_sequences
  set current_value = current_value + 1,
      year = extract(year from now())::integer,
      updated_at = now()
  where sequence_key = p_sequence_key
  returning prefix, current_value into v_prefix, v_value;

  if v_prefix is null then
    raise exception 'Sequence key not found: %', p_sequence_key;
  end if;

  v_result := v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_value::text, 5, '0');
  return v_result;
end;
$$;

do $$
declare
  v_route_id uuid;
  v_step_no integer;
  v_operation text;
  v_machine_id uuid;
  v_routes jsonb := '[
    {
      "name": "Genel Talaşlı İmalat",
      "description": "Torna, freze, taşlama, kalite kontrol ve paketleme için genel atölye rotası.",
      "steps": ["Torna", "Freze", "Taşlama", "Kalite Kontrol", "Paketleme"]
    },
    {
      "name": "Dişli İmalat",
      "description": "Dişli üretimi için torna, azdırma, taşlama, kalite kontrol ve paketleme rotası.",
      "steps": ["Torna", "Azdırma", "Taşlama", "Kalite Kontrol", "Paketleme"]
    },
    {
      "name": "Fason Isıl İşlemli Parça",
      "description": "Fason ısıl işlem içeren parça üretim rotası.",
      "steps": ["Torna", "Freze", "Fason Isıl İşlem", "Taşlama", "Kalite Kontrol"]
    }
  ]'::jsonb;
  v_route jsonb;
begin
  for v_route in select * from jsonb_array_elements(v_routes) loop
    insert into public.production_routes (name, description, is_template)
    select v_route->>'name', v_route->>'description', true
    where not exists (
      select 1 from public.production_routes existing
      where existing.name = v_route->>'name'
    );

    select id into v_route_id
    from public.production_routes
    where name = v_route->>'name'
    order by created_at asc
    limit 1;

    if v_route_id is not null then
      v_step_no := 0;

      for v_operation in select jsonb_array_elements_text(v_route->'steps') loop
        v_step_no := v_step_no + 10;

        select id into v_machine_id
        from public.machines
        where lower(name) = lower(v_operation)
        limit 1;

        insert into public.production_route_steps (route_id, step_no, operation_name, machine_id, estimated_minutes)
        values (v_route_id, v_step_no, v_operation, v_machine_id, 0)
        on conflict (route_id, step_no) do nothing;
      end loop;
    end if;
  end loop;
end $$;

create index if not exists idx_erp_quotation_links_quotation_id on public.erp_quotation_links(quotation_id);
create index if not exists idx_sales_orders_source_quotation_id on public.sales_orders(source_quotation_id);
create index if not exists idx_work_orders_sales_order_id on public.work_orders(sales_order_id);
create index if not exists idx_subcontracting_jobs_work_order_id on public.subcontracting_jobs(work_order_id);
create index if not exists idx_quality_reports_work_order_id on public.quality_reports(work_order_id);
create index if not exists idx_shipments_sales_order_id on public.shipments(sales_order_id);

do $$
declare
  t text;
  erp_tables text[] := array[
    'erp_users',
    'stakeholders',
    'erp_quotation_links',
    'sales_orders',
    'sales_order_items',
    'machines',
    'production_routes',
    'production_route_steps',
    'work_orders',
    'work_order_operations',
    'subcontracting_jobs',
    'documents',
    'inventory_items',
    'inventory_movements',
    'measuring_tools',
    'financial_accounts',
    'invoices',
    'payments',
    'employees',
    'employee_time_entries',
    'employee_assets',
    'shipments',
    'shipment_items',
    'quality_reports',
    'quality_measurements',
    'maintenance_tasks',
    'erp_number_sequences'
  ];
begin
  foreach t in array erp_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', 'erp authenticated select ' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'erp authenticated select ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'erp authenticated insert ' || t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', 'erp authenticated insert ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'erp authenticated update ' || t, t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', 'erp authenticated update ' || t, t);
  end loop;
end $$;

commit;
