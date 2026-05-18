-- DAYAN Disli ERP controlled mock seed data.
-- Safe intent: insert/update fixed mock rows only.
-- Do not put passwords, access tokens, service keys, or fake auth users in this file.
-- Do not add delete, truncate, drop, or reset commands.

begin;

insert into public.stakeholders (
  id,
  type,
  company_name,
  contact_name,
  phone,
  email,
  city,
  country,
  risk_limit,
  current_balance,
  notes,
  is_active
) values
  (
    '00000000-0000-4000-8000-000000000101',
    'customer',
    '[MOCK] Atlas Makina A.S.',
    'Test Musteri',
    '+90 212 000 00 01',
    'mock.customer@example.invalid',
    'Istanbul',
    'Turkiye',
    250000,
    0,
    '[MOCK] ERP test musterisi. Gercek musteri verisi degildir.',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'both',
    '[MOCK] Isil Fason Ltd.',
    'Test Tedarikci',
    '+90 216 000 00 02',
    'mock.supplier@example.invalid',
    'Kocaeli',
    'Turkiye',
    0,
    0,
    '[MOCK] ERP test tedarikci/fason kaydi. Gercek firma verisi degildir.',
    true
  )
on conflict (id) do update
set type = excluded.type,
    company_name = excluded.company_name,
    contact_name = excluded.contact_name,
    phone = excluded.phone,
    email = excluded.email,
    city = excluded.city,
    country = excluded.country,
    risk_limit = excluded.risk_limit,
    current_balance = excluded.current_balance,
    notes = excluded.notes,
    is_active = excluded.is_active;

insert into public.inventory_items (
  id,
  item_type,
  code,
  name,
  description,
  unit,
  current_stock,
  min_stock,
  location,
  supplier_id,
  unit_cost,
  is_active
) values (
  '00000000-0000-4000-8000-000000000201',
  'raw_material',
  'MOCK-C45-050',
  '[MOCK] C45 Yuvarlak Celik 50mm',
  '[MOCK] Test hammadde karti.',
  'kg',
  120,
  50,
  'MOCK-A1',
  '00000000-0000-4000-8000-000000000102',
  42.50,
  true
)
on conflict (id) do update
set item_type = excluded.item_type,
    code = excluded.code,
    name = excluded.name,
    description = excluded.description,
    unit = excluded.unit,
    current_stock = excluded.current_stock,
    min_stock = excluded.min_stock,
    location = excluded.location,
    supplier_id = excluded.supplier_id,
    unit_cost = excluded.unit_cost,
    is_active = excluded.is_active;

insert into public.sales_orders (
  id,
  order_no,
  stakeholder_id,
  source_quotation_id,
  title,
  description,
  status,
  priority,
  order_date,
  due_date,
  currency,
  subtotal,
  tax_total,
  grand_total,
  notes
) values (
  '00000000-0000-4000-8000-000000000301',
  'SO-MOCK-2026-00001',
  '00000000-0000-4000-8000-000000000101',
  null,
  '[MOCK] Disli seti test siparisi',
  '[MOCK] Tekliften siparise donusum test senaryosu.',
  'in_production',
  'normal',
  date '2026-05-18',
  date '2026-06-01',
  'TRY',
  10000,
  2000,
  12000,
  '[MOCK] ERP test siparisi. Gercek siparis verisi degildir.'
)
on conflict (id) do update
set order_no = excluded.order_no,
    stakeholder_id = excluded.stakeholder_id,
    source_quotation_id = excluded.source_quotation_id,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    priority = excluded.priority,
    order_date = excluded.order_date,
    due_date = excluded.due_date,
    currency = excluded.currency,
    subtotal = excluded.subtotal,
    tax_total = excluded.tax_total,
    grand_total = excluded.grand_total,
    notes = excluded.notes;

insert into public.sales_order_items (
  id,
  sales_order_id,
  item_code,
  description,
  quantity,
  unit,
  unit_price,
  total,
  technical_drawing_id
) values (
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000301',
  'MOCK-GEAR-001',
  '[MOCK] Helis disli seti',
  2,
  'adet',
  5000,
  10000,
  null
)
on conflict (id) do update
set sales_order_id = excluded.sales_order_id,
    item_code = excluded.item_code,
    description = excluded.description,
    quantity = excluded.quantity,
    unit = excluded.unit,
    unit_price = excluded.unit_price,
    total = excluded.total,
    technical_drawing_id = excluded.technical_drawing_id;

insert into public.work_orders (
  id,
  work_order_no,
  sales_order_id,
  stakeholder_id,
  title,
  part_name,
  part_code,
  quantity,
  status,
  priority,
  planned_start_date,
  planned_end_date,
  actual_start_at,
  actual_end_at,
  notes
) values (
  '00000000-0000-4000-8000-000000000401',
  'WO-MOCK-2026-00001',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000101',
  '[MOCK] Disli seti uretim is emri',
  '[MOCK] Helis disli',
  'MOCK-GEAR-001',
  2,
  'waiting_subcontractor',
  'normal',
  date '2026-05-19',
  date '2026-05-29',
  null,
  null,
  '[MOCK] ERP test is emri. Gercek uretim verisi degildir.'
)
on conflict (id) do update
set work_order_no = excluded.work_order_no,
    sales_order_id = excluded.sales_order_id,
    stakeholder_id = excluded.stakeholder_id,
    title = excluded.title,
    part_name = excluded.part_name,
    part_code = excluded.part_code,
    quantity = excluded.quantity,
    status = excluded.status,
    priority = excluded.priority,
    planned_start_date = excluded.planned_start_date,
    planned_end_date = excluded.planned_end_date,
    actual_start_at = excluded.actual_start_at,
    actual_end_at = excluded.actual_end_at,
    notes = excluded.notes;

insert into public.work_order_operations (
  id,
  work_order_id,
  step_no,
  operation_name,
  machine_id,
  assigned_employee_id,
  status,
  planned_minutes,
  actual_minutes,
  started_at,
  completed_at,
  quality_required,
  notes
) values
  (
    '00000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000401',
    10,
    '[MOCK] Torna',
    null,
    null,
    'completed',
    120,
    118,
    timestamptz '2026-05-19 08:30:00+03',
    timestamptz '2026-05-19 10:28:00+03',
    false,
    '[MOCK] Test operasyonu.'
  ),
  (
    '00000000-0000-4000-8000-000000000403',
    '00000000-0000-4000-8000-000000000401',
    20,
    '[MOCK] Fason isil islem',
    null,
    null,
    'paused',
    1440,
    0,
    null,
    null,
    false,
    '[MOCK] Fason baglantili test operasyonu.'
  ),
  (
    '00000000-0000-4000-8000-000000000404',
    '00000000-0000-4000-8000-000000000401',
    30,
    '[MOCK] Kalite Kontrol',
    null,
    null,
    'pending',
    45,
    0,
    null,
    null,
    true,
    '[MOCK] Kalite baglantili test operasyonu.'
  )
on conflict (id) do update
set work_order_id = excluded.work_order_id,
    step_no = excluded.step_no,
    operation_name = excluded.operation_name,
    machine_id = excluded.machine_id,
    assigned_employee_id = excluded.assigned_employee_id,
    status = excluded.status,
    planned_minutes = excluded.planned_minutes,
    actual_minutes = excluded.actual_minutes,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at,
    quality_required = excluded.quality_required,
    notes = excluded.notes;

insert into public.subcontracting_jobs (
  id,
  work_order_id,
  work_order_operation_id,
  supplier_id,
  process_type,
  dispatch_no,
  sent_date,
  expected_return_date,
  returned_date,
  status,
  quantity_sent,
  quantity_returned,
  unit_cost,
  total_cost,
  notes
) values (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000403',
  '00000000-0000-4000-8000-000000000102',
  '[MOCK] Isil islem',
  'MOCK-FSN-00001',
  date '2026-05-20',
  date '2026-05-24',
  null,
  'sent',
  2,
  0,
  750,
  1500,
  '[MOCK] ERP test fason kaydi. Gercek fason verisi degildir.'
)
on conflict (id) do update
set work_order_id = excluded.work_order_id,
    work_order_operation_id = excluded.work_order_operation_id,
    supplier_id = excluded.supplier_id,
    process_type = excluded.process_type,
    dispatch_no = excluded.dispatch_no,
    sent_date = excluded.sent_date,
    expected_return_date = excluded.expected_return_date,
    returned_date = excluded.returned_date,
    status = excluded.status,
    quantity_sent = excluded.quantity_sent,
    quantity_returned = excluded.quantity_returned,
    unit_cost = excluded.unit_cost,
    total_cost = excluded.total_cost,
    notes = excluded.notes;

insert into public.quality_reports (
  id,
  report_no,
  work_order_id,
  work_order_operation_id,
  sales_order_id,
  inspector_employee_id,
  inspection_date,
  result,
  notes
) values (
  '00000000-0000-4000-8000-000000000601',
  'QC-MOCK-2026-00001',
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000404',
  '00000000-0000-4000-8000-000000000301',
  null,
  date '2026-05-25',
  'pending',
  '[MOCK] ERP test kalite raporu. Gercek kalite verisi degildir.'
)
on conflict (id) do update
set report_no = excluded.report_no,
    work_order_id = excluded.work_order_id,
    work_order_operation_id = excluded.work_order_operation_id,
    sales_order_id = excluded.sales_order_id,
    inspector_employee_id = excluded.inspector_employee_id,
    inspection_date = excluded.inspection_date,
    result = excluded.result,
    notes = excluded.notes;

insert into public.quality_measurements (
  id,
  quality_report_id,
  characteristic,
  nominal_value,
  tolerance,
  measured_value,
  result
) values
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000601',
    '[MOCK] Dis capi',
    '50.00 mm',
    '+/- 0.02',
    null,
    'pending'
  ),
  (
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000601',
    '[MOCK] Sertlik',
    '58 HRC',
    '+/- 2',
    null,
    'pending'
  )
on conflict (id) do update
set quality_report_id = excluded.quality_report_id,
    characteristic = excluded.characteristic,
    nominal_value = excluded.nominal_value,
    tolerance = excluded.tolerance,
    measured_value = excluded.measured_value,
    result = excluded.result;

insert into public.shipments (
  id,
  shipment_no,
  sales_order_id,
  stakeholder_id,
  carrier,
  tracking_no,
  delivery_note_no,
  package_count,
  shipment_date,
  status,
  notes
) values (
  '00000000-0000-4000-8000-000000000701',
  'SHP-MOCK-2026-00001',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000101',
  '[MOCK] Test Kargo',
  'MOCKTRACK0001',
  'MOCK-IRS-00001',
  1,
  date '2026-05-30',
  'planned',
  '[MOCK] ERP test sevkiyati. Gercek sevkiyat verisi degildir.'
)
on conflict (id) do update
set shipment_no = excluded.shipment_no,
    sales_order_id = excluded.sales_order_id,
    stakeholder_id = excluded.stakeholder_id,
    carrier = excluded.carrier,
    tracking_no = excluded.tracking_no,
    delivery_note_no = excluded.delivery_note_no,
    package_count = excluded.package_count,
    shipment_date = excluded.shipment_date,
    status = excluded.status,
    notes = excluded.notes;

insert into public.shipment_items (
  id,
  shipment_id,
  description,
  quantity,
  unit,
  notes
) values (
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000701',
  '[MOCK] Helis disli seti',
  2,
  'adet',
  '[MOCK] Test sevkiyat kalemi.'
)
on conflict (id) do update
set shipment_id = excluded.shipment_id,
    description = excluded.description,
    quantity = excluded.quantity,
    unit = excluded.unit,
    notes = excluded.notes;

insert into public.purchase_orders (
  id,
  purchase_order_no,
  supplier_id,
  title,
  status,
  order_date,
  expected_delivery_date,
  currency,
  subtotal,
  tax_total,
  grand_total,
  notes
) values (
  '00000000-0000-4000-8000-000000000801',
  'PO-MOCK-2026-00001',
  '00000000-0000-4000-8000-000000000102',
  '[MOCK] Hammadde test satin alma',
  'sent',
  date '2026-05-18',
  date '2026-05-23',
  'TRY',
  4250,
  850,
  5100,
  '[MOCK] ERP test satin alma siparisi. Gercek satin alma verisi degildir.'
)
on conflict (id) do update
set purchase_order_no = excluded.purchase_order_no,
    supplier_id = excluded.supplier_id,
    title = excluded.title,
    status = excluded.status,
    order_date = excluded.order_date,
    expected_delivery_date = excluded.expected_delivery_date,
    currency = excluded.currency,
    subtotal = excluded.subtotal,
    tax_total = excluded.tax_total,
    grand_total = excluded.grand_total,
    notes = excluded.notes;

insert into public.purchase_order_items (
  id,
  purchase_order_id,
  inventory_item_id,
  description,
  quantity,
  unit,
  unit_price,
  total,
  received_quantity
) values (
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000201',
  '[MOCK] C45 Yuvarlak Celik 50mm',
  100,
  'kg',
  42.50,
  4250,
  0
)
on conflict (id) do update
set purchase_order_id = excluded.purchase_order_id,
    inventory_item_id = excluded.inventory_item_id,
    description = excluded.description,
    quantity = excluded.quantity,
    unit = excluded.unit,
    unit_price = excluded.unit_price,
    total = excluded.total,
    received_quantity = excluded.received_quantity;

insert into public.inventory_movements (
  id,
  inventory_item_id,
  movement_type,
  quantity,
  source_type,
  source_id,
  movement_date,
  notes
) values (
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000201',
  'reservation',
  20,
  'work_order',
  '00000000-0000-4000-8000-000000000401',
  timestamptz '2026-05-18 09:00:00+03',
  '[MOCK] Test is emri icin stok rezervasyonu.'
)
on conflict (id) do update
set inventory_item_id = excluded.inventory_item_id,
    movement_type = excluded.movement_type,
    quantity = excluded.quantity,
    source_type = excluded.source_type,
    source_id = excluded.source_id,
    movement_date = excluded.movement_date,
    notes = excluded.notes;

insert into public.erp_audit_logs (
  id,
  actor_user_id,
  actor_email,
  entity_type,
  entity_id,
  action,
  old_status,
  new_status,
  description,
  metadata
) values (
  '00000000-0000-4000-8000-000000000a01',
  null,
  null,
  'system',
  null,
  'mock_seed_applied',
  null,
  null,
  '[MOCK] ERP test seed verisi uygulandi.',
  '{"source":"supabase/seed_erp_mock.sql","mock":true}'::jsonb
)
on conflict (id) do update
set actor_user_id = excluded.actor_user_id,
    actor_email = excluded.actor_email,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    action = excluded.action,
    old_status = excluded.old_status,
    new_status = excluded.new_status,
    description = excluded.description,
    metadata = excluded.metadata;

insert into public.erp_notifications (
  id,
  recipient_user_id,
  recipient_email,
  severity,
  category,
  title,
  body,
  entity_type,
  entity_id,
  action_url,
  is_read,
  read_at
) values (
  '00000000-0000-4000-8000-000000000b01',
  null,
  null,
  'info',
  'system',
  '[MOCK] ERP test verisi hazir',
  '[MOCK] Kontrollu ERP mock seed verisi eklendi veya guncellendi.',
  'system',
  null,
  '/erp/dashboard',
  false,
  null
)
on conflict (id) do update
set recipient_user_id = excluded.recipient_user_id,
    recipient_email = excluded.recipient_email,
    severity = excluded.severity,
    category = excluded.category,
    title = excluded.title,
    body = excluded.body,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    action_url = excluded.action_url,
    is_read = excluded.is_read,
    read_at = excluded.read_at;

commit;
