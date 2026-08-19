begin;
select plan(33);

insert into public.erp_users (
  id,
  auth_user_id,
  email,
  role,
  roles,
  permissions,
  accessible_company_ids,
  is_active
) values
  (
    '32000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000011',
    'finance-a@payment-instruments.test',
    'finance',
    array['finance'],
    '{}'::text[],
    array['31000000-0000-4000-8000-000000000001']::uuid[],
    true
  ),
  (
    '32000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000012',
    'admin-b@payment-instruments.test',
    'admin',
    array['admin'],
    '{}'::text[],
    array['31000000-0000-4000-8000-000000000002']::uuid[],
    true
  );

insert into public.quote_customers (
  id,
  company_name
) values (
  '33000000-0000-4000-8000-000000000001',
  'Local quote customer A'
);

insert into parasut.contacts (
  company_id,
  parasut_id,
  parasut_company_id,
  resource_type,
  attributes,
  relationships,
  included,
  raw_payload,
  source_archived,
  payload_hash
) values
  (
    '31000000-0000-4000-8000-000000000001',
    'customer-a',
    'payment-instruments-test',
    'contacts',
    '{"account_type":"customer","name":"Customer A"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '{"id":"customer-a","type":"contacts"}'::jsonb,
    null,
    'payment-instruments-customer-a'
  ),
  (
    '31000000-0000-4000-8000-000000000001',
    'supplier-a',
    'payment-instruments-test',
    'contacts',
    '{"account_type":"supplier","name":"Supplier A"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '{"id":"supplier-a","type":"contacts"}'::jsonb,
    false,
    'payment-instruments-supplier-a'
  );

insert into parasut.checks (
  company_id,
  parasut_id,
  parasut_company_id,
  resource_type,
  attributes,
  relationships,
  included,
  raw_payload,
  net_total,
  remaining,
  source_archived,
  payload_hash
) values (
  '31000000-0000-4000-8000-000000000001',
  'mirror-check-a',
  'payment-instruments-test',
  'checks',
  '{
    "is_in": true,
    "currency": "TRL",
    "issue_date": "2026-08-01",
    "due_date": "2026-08-20",
    "payment_status": "unpaid",
    "bank_name": "",
    "bank_identifier": "Mirror Bank Identifier",
    "serial_number": "MIRROR-001",
    "description": "Mirror authoritative note",
    "net_total": "1250.00",
    "remaining": "1250.00"
  }'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  '{"id":"mirror-check-a","type":"checks"}'::jsonb,
  1250.00,
  1250.00,
  null,
  'payment-instruments-mirror-check-a'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-4000-8000-000000000011","email":"finance-a@payment-instruments.test","role":"authenticated"}',
  true
);

select ok(
  private.erp_user_can_access_company(
    '31000000-0000-4000-8000-000000000001',
    'finance.create'
  ),
  'finance role receives finance.create only inside its assigned company'
);

select is(
  private.erp_user_can_access_company(
    '31000000-0000-4000-8000-000000000002',
    'finance.view'
  ),
  false,
  'finance role cannot escape accessible_company_ids'
);

select is(
  has_column_privilege('authenticated', 'public.payment_instruments', 'paid_at', 'INSERT'),
  false,
  'authenticated callers cannot forge paid_at on insert'
);

select is(
  has_column_privilege('authenticated', 'public.payment_instruments', 'local_quote_customer_id', 'INSERT')
    or has_column_privilege('authenticated', 'public.payment_instruments', 'local_quote_customer_id', 'UPDATE'),
  false,
  'tenant-unsafe local quote customer links are not writable through Data API'
);

insert into public.payment_instruments (
  company_id,
  source,
  instrument_type,
  direction,
  bank_name,
  check_number,
  issue_date,
  due_date,
  currency,
  original_amount,
  notes
) values (
  '31000000-0000-4000-8000-000000000001',
  'erp_local',
  'check',
  'received',
  'Local Bank',
  'LOCAL-001',
  date '2026-08-01',
  date '2026-08-25',
  'TRY',
  5000.00,
  'Local cheque'
);

select is(
  (
    select remaining_amount
    from public.payment_instruments
    where check_number = 'LOCAL-001'
  ),
  5000.00::numeric,
  'local insert initializes remaining_amount to original_amount'
);

select is(
  (
    select count(*)::integer
    from public.payment_instrument_events
    where payment_instrument_id = (
      select id
      from public.payment_instruments
      where check_number = 'LOCAL-001'
    )
      and event_type = 'created'
  ),
  1,
  'local insert creates one immutable audit event'
);

insert into public.payment_instruments (
  company_id,
  source,
  instrument_type,
  direction,
  check_number,
  due_date,
  currency,
  original_amount,
  settlement_status
) values (
  '31000000-0000-4000-8000-000000000001',
  'erp_local',
  'check',
  'issued',
  'LOCAL-PAID-001',
  date '2026-08-18',
  'TRY',
  750.00,
  'paid'
);

select is(
  (
    select remaining_amount
    from public.payment_instruments
    where check_number = 'LOCAL-PAID-001'
  ),
  0::numeric,
  'atomic paid local insert clears remaining amount'
);

select ok(
  (
    select paid_at is not null
    from public.payment_instruments
    where check_number = 'LOCAL-PAID-001'
  ),
  'atomic paid local insert supplies paid_at'
);

select throws_ok(
  $$
    insert into public.payment_instruments (
      company_id, source, instrument_type, direction, due_date,
      currency, original_amount, remaining_amount, settlement_status, notes
    ) values (
      '31000000-0000-4000-8000-000000000001', 'erp_local', 'check',
      'received', date '2026-08-25', 'TRY', 100.00, 100.00, 'cancelled',
      'not an allowed initial state'
    )
  $$,
  '42501',
  null,
  'local insert accepts only open or paid settlement state'
);

select throws_ok(
  $$
    insert into public.payment_instruments (
      company_id, source, instrument_type, direction, due_date,
      currency, original_amount, notes
    ) values (
      '31000000-0000-4000-8000-000000000002', 'erp_local', 'check',
      'received', date '2026-08-25', 'TRY', 100.00, 'cross tenant'
    )
  $$,
  '42501',
  null,
  'RLS rejects a local cheque for another company'
);

select throws_ok(
  $$
    update public.payment_instruments
    set settlement_status = 'paid'
    where check_number = 'LOCAL-001'
  $$,
  '42501',
  null,
  'authenticated users cannot update settlement columns directly'
);

select is(
  (
    public.transition_payment_instrument(
      (
        select id
        from public.payment_instruments
        where check_number = 'LOCAL-001'
      ),
      'paid',
      null
    )
  ).settlement_status,
  'paid',
  'controlled transition marks an open local cheque paid'
);

select is(
  (
    select remaining_amount
    from public.payment_instruments
    where check_number = 'LOCAL-001'
  ),
  0::numeric,
  'paid transition clears remaining amount'
);

select ok(
  (
    select paid_at is not null
    from public.payment_instruments
    where check_number = 'LOCAL-001'
  ),
  'paid transition records paid_at'
);

select is(
  (
    select count(*)::integer
    from public.payment_instrument_events
    where payment_instrument_id = (
      select id
      from public.payment_instruments
      where check_number = 'LOCAL-001'
    )
      and event_type = 'marked_paid'
      and actor_user_id = '32000000-0000-4000-8000-000000000011'
  ),
  1,
  'paid transition creates an attributed audit event'
);

select throws_ok(
  format(
    'select public.transition_payment_instrument(%L::uuid, %L, null)',
    (
      select id
      from public.payment_instruments
      where check_number = 'LOCAL-001'
    ),
    'paid'
  ),
  '22023',
  'Yalnız açık çekler için durum işlemi yapılabilir.',
  'terminal local cheque cannot be transitioned twice'
);

insert into public.payment_instruments (
  company_id,
  source,
  external_parasut_id,
  instrument_type,
  direction,
  due_date,
  currency,
  original_amount,
  remaining_amount,
  settlement_status,
  notes
) values (
  '31000000-0000-4000-8000-000000000001',
  'parasut_mirror',
  'mirror-check-a',
  'check',
  'issued',
  date '2030-01-01',
  'USD',
  1.00,
  1.00,
  'open',
  'Caller-forged mirror note'
);

select is(
  (
    select direction
    from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  ),
  'received',
  'mirror overlay direction is refreshed from real Paraşüt data'
);

select is(
  (
    select currency
    from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  ),
  'TRY',
  'mirror overlay normalizes TRL to TRY from real Paraşüt data'
);

select is(
  (
    select original_amount
    from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  ),
  1250.00::numeric,
  'mirror overlay amount is authoritative from the mirror'
);

select is(
  (
    select due_date
    from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  ),
  date '2026-08-20',
  'mirror overlay due date is authoritative from the mirror'
);

select is(
  (
    select bank_name
    from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  ),
  'Mirror Bank Identifier',
  'mirror overlay bank label falls back to the authoritative bank identifier'
);

select is(
  (
    select notes
    from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  ),
  'Mirror authoritative note',
  'mirror overlay note is always derived from the authoritative mirror row'
);

select throws_ok(
  $$
    insert into public.payment_instruments (
      company_id, source, external_parasut_id, instrument_type, direction,
      due_date, currency, original_amount, remaining_amount, settlement_status
    ) values (
      '31000000-0000-4000-8000-000000000001', 'parasut_mirror',
      'no-such-check', 'check', 'received', date '2026-08-20', 'TRY',
      10.00, 10.00, 'open'
    )
  $$,
  '23503',
  'Aynı şirkette etkin Paraşüt çek kaydı bulunamadı.',
  'mirror overlay cannot invent a nonexistent Paraşüt cheque'
);

select throws_ok(
  $$
    update public.payment_instruments
    set bank_name = 'Forged Bank'
    where external_parasut_id = 'mirror-check-a'
  $$,
  '22023',
  'Paraşüt kaynaklı çekin finansal alanları ERP kullanıcısı tarafından değiştirilemez.',
  'authenticated users cannot mutate mirror-authoritative fields'
);

select throws_ok(
  $$
    update public.payment_instruments
    set notes = 'Forged mirror note'
    where external_parasut_id = 'mirror-check-a'
  $$,
  '22023',
  'Paraşüt kaynaklı çekin finansal alanları ERP kullanıcısı tarafından değiştirilemez.',
  'authenticated users cannot mutate mirror-authoritative notes'
);

select throws_ok(
  $$
    update public.payment_instruments
    set contact_parasut_id = 'supplier-a'
    where external_parasut_id = 'mirror-check-a'
  $$,
  '23514',
  'Alınan çek müşteriye, verilen çek tedarikçiye bağlanmalıdır.',
  'received cheque cannot be linked to a supplier'
);

update public.payment_instruments
set contact_parasut_id = 'customer-a',
    contact_snapshot_name = 'Forged Label'
where external_parasut_id = 'mirror-check-a';

select is(
  (
    select contact_parasut_id
    from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  ),
  'customer-a',
  'received cheque accepts a real same-company customer link'
);

select is(
  (
    select contact_snapshot_name
    from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  ),
  'Customer A',
  'party snapshot is derived from the validated Paraşüt contact'
);

select is(
  (
    select count(*)::integer
    from public.payment_instrument_events
    where payment_instrument_id = (
      select id
      from public.payment_instruments
      where external_parasut_id = 'mirror-check-a'
    )
      and event_type = 'party_linked'
  ),
  1,
  'party link is recorded in append-only history'
);

select throws_ok(
  $$
    update public.payment_instrument_events
    set note = 'forged audit'
    where payment_instrument_id = (
      select id
      from public.payment_instruments
      where external_parasut_id = 'mirror-check-a'
    )
  $$,
  '42501',
  null,
  'authenticated users cannot rewrite audit events'
);

select throws_ok(
  $$
    delete from public.payment_instruments
    where external_parasut_id = 'mirror-check-a'
  $$,
  '42501',
  null,
  'authenticated users receive no hard-delete privilege'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"32000000-0000-4000-8000-000000000012","email":"admin-b@payment-instruments.test","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.payment_instruments),
  0,
  'admin permission bypass does not bypass accessible_company_ids tenant scope'
);

reset role;
set local role anon;
select throws_ok(
  'select * from public.payment_instruments',
  '42501',
  'permission denied for table payment_instruments',
  'anon cannot access payment instruments'
);

select * from finish();
rollback;
