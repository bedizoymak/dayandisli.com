begin;
select plan(4);

insert into public.companies (id, code, legal_name)
values
  ('10000000-0000-0000-0000-000000000001', 'RLS-A', 'RLS tenant A'),
  ('10000000-0000-0000-0000-000000000002', 'RLS-B', 'RLS tenant B');

insert into public.company_memberships
  (company_id, auth_user_id, email, is_company_admin, is_active)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'member-a@example.test', true, true);

insert into public.admin_users (email, role, is_active)
values ('global-admin@example.test', 'admin', true);

insert into public.parasut_contacts
  (company_id, parasut_id, parasut_company_id, resource_type, raw_payload, payload_hash)
values
  ('10000000-0000-0000-0000-000000000001', 'rls-contact-a', 'tenant-a', 'contacts', '{"id":"rls-contact-a","type":"contacts"}', 'hash-a'),
  ('10000000-0000-0000-0000-000000000002', 'rls-contact-b', 'tenant-b', 'contacts', '{"id":"rls-contact-b","type":"contacts"}', 'hash-b');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","email":"member-a@example.test","role":"authenticated"}', true);

select is(
  (select count(*)::integer from public.parasut_contacts),
  1,
  'company admin sees only the member tenant'
);
select is(
  (select count(*)::integer from public.parasut_contacts where company_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'company admin cannot read a different tenant'
);

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000099","email":"global-admin@example.test","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.parasut_contacts),
  2,
  'active admin_users entry can read all tenants'
);

reset role;
set local role anon;
select throws_ok(
  'select * from public.parasut_contacts',
  '42501',
  'permission denied for table parasut_contacts',
  'anon cannot read the mirror table'
);

select * from finish();
rollback;
