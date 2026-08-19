-- Local cheque operations and Paraşüt-mirror overlays.
--
-- This migration never writes to parasut.*. The parasut.checks and
-- parasut.contacts tables are read only to validate/refresh an overlay.
-- ERP-created instruments and ERP-only associations live in public.*.

begin;

do $$
begin
  if to_regclass('public.erp_users') is null then
    raise exception 'Required table public.erp_users is missing';
  end if;
  if to_regclass('public.quote_customers') is null then
    raise exception 'Required table public.quote_customers is missing';
  end if;
  if to_regclass('parasut.checks') is null then
    raise exception 'Required table parasut.checks is missing';
  end if;
  if to_regclass('parasut.contacts') is null then
    raise exception 'Required table parasut.contacts is missing';
  end if;
  if to_regprocedure('public.erp_set_updated_at()') is null then
    raise exception 'Required function public.erp_set_updated_at() is missing';
  end if;
end $$;

create schema if not exists private;

-- The production tenant authority is erp_users.accessible_company_ids.
-- Admin/planner may bypass the requested permission, but never the company
-- membership check. A finance role satisfies finance.* permissions; explicit
-- per-user permissions and system.manage remain supported.
create or replace function private.erp_user_can_access_company(
  target_company_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.erp_users as erp_user
    where erp_user.is_active
      and (
        erp_user.auth_user_id = (select auth.uid())
        or (
          erp_user.auth_user_id is null
          and lower(erp_user.email) = lower((select auth.jwt() ->> 'email'))
        )
      )
      and target_company_id = any(
        coalesce(erp_user.accessible_company_ids, '{}'::uuid[])
      )
      and (
        erp_user.role in ('admin', 'planner')
        or coalesce(erp_user.roles, '{}'::text[]) && array['admin', 'planner']::text[]
        or 'system.manage' = any(coalesce(erp_user.permissions, '{}'::text[]))
        or required_permission = any(coalesce(erp_user.permissions, '{}'::text[]))
        or (
          required_permission like 'finance.%'
          and (
            erp_user.role = 'finance'
            or 'finance' = any(coalesce(erp_user.roles, '{}'::text[]))
          )
        )
      )
  );
$$;

revoke all on function private.erp_user_can_access_company(uuid, text) from public;
revoke all on function private.erp_user_can_access_company(uuid, text) from anon;
grant usage on schema private to authenticated;
grant execute on function private.erp_user_can_access_company(uuid, text) to authenticated;

create table public.payment_instruments (
  id uuid primary key default gen_random_uuid(),

  -- Intentionally no FK: production has no canonical companies table.
  -- Authorization is anchored to erp_users.accessible_company_ids.
  company_id uuid not null,

  source text not null
    check (source in ('erp_local', 'parasut_mirror')),
  external_parasut_id text null,
  instrument_type text not null default 'check'
    check (instrument_type = 'check'),
  direction text not null
    check (direction in ('received', 'issued')),

  contact_parasut_id text null,

  -- Referential integrity only: quote_customers currently has no company_id,
  -- so this FK cannot prove same-company ownership. The instrument row itself
  -- remains tenant-scoped by company_id + RLS.
  local_quote_customer_id uuid null
    references public.quote_customers(id) on delete restrict,
  contact_snapshot_name text null,

  bank_name text null,
  check_number text null,
  issue_date date null,
  due_date date not null,
  currency text not null
    check (currency in ('TRY', 'USD', 'EUR')),
  original_amount numeric(18, 2) not null,
  remaining_amount numeric(18, 2) not null,
  settlement_status text not null default 'open'
    check (settlement_status in ('open', 'paid', 'cancelled', 'returned')),
  paid_at timestamptz null,
  notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_instruments_source_external_consistency check (
    (source = 'erp_local' and external_parasut_id is null)
    or (
      source = 'parasut_mirror'
      and nullif(btrim(external_parasut_id), '') is not null
    )
  ),
  constraint payment_instruments_party_choice check (
    num_nonnulls(contact_parasut_id, local_quote_customer_id) <= 1
  ),
  constraint payment_instruments_contact_id_nonblank check (
    contact_parasut_id is null or nullif(btrim(contact_parasut_id), '') is not null
  ),
  constraint payment_instruments_original_amount_positive check (
    original_amount > 0
  ),
  constraint payment_instruments_remaining_amount_range check (
    remaining_amount >= 0 and remaining_amount <= original_amount
  ),
  constraint payment_instruments_open_has_remaining check (
    settlement_status <> 'open' or remaining_amount > 0
  ),
  constraint payment_instruments_paid_has_zero_remaining check (
    settlement_status <> 'paid' or remaining_amount = 0
  ),
  constraint payment_instruments_paid_at_consistency check (
    paid_at is null or settlement_status = 'paid'
  ),
  constraint payment_instruments_local_paid_at_required check (
    source <> 'erp_local'
    or settlement_status <> 'paid'
    or paid_at is not null
  ),
  constraint payment_instruments_id_company_unique unique (id, company_id)
);

create unique index payment_instruments_mirror_external_unique_idx
  on public.payment_instruments (company_id, external_parasut_id)
  where source = 'parasut_mirror';

create index payment_instruments_company_due_idx
  on public.payment_instruments (company_id, due_date, id);

create index payment_instruments_company_source_idx
  on public.payment_instruments (company_id, source);

create index payment_instruments_open_due_idx
  on public.payment_instruments (company_id, due_date, direction)
  where settlement_status = 'open';

create index payment_instruments_direction_status_due_idx
  on public.payment_instruments (
    company_id,
    direction,
    settlement_status,
    due_date
  );

create index payment_instruments_contact_idx
  on public.payment_instruments (company_id, contact_parasut_id)
  where contact_parasut_id is not null;

create index payment_instruments_local_quote_customer_idx
  on public.payment_instruments (company_id, local_quote_customer_id)
  where local_quote_customer_id is not null;

-- PostgreSQL does not auto-index referencing FK columns. This index keeps a
-- quote-customer delete/restrict check from scanning every tenant's cheques.
create index payment_instruments_local_quote_customer_fk_idx
  on public.payment_instruments (local_quote_customer_id)
  where local_quote_customer_id is not null;

create table public.payment_instrument_events (
  id uuid primary key default gen_random_uuid(),
  payment_instrument_id uuid not null,
  company_id uuid not null,
  event_type text not null check (
    event_type in (
      'created',
      'updated',
      'party_linked',
      'party_unlinked',
      'marked_paid',
      'cancelled',
      'returned'
    )
  ),
  previous_settlement_status text null check (
    previous_settlement_status is null
    or previous_settlement_status in ('open', 'paid', 'cancelled', 'returned')
  ),
  new_settlement_status text not null check (
    new_settlement_status in ('open', 'paid', 'cancelled', 'returned')
  ),
  actor_user_id uuid null,
  note text null,
  changes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(changes) = 'object'),
  occurred_at timestamptz not null default now(),

  constraint payment_instrument_events_instrument_company_fkey
    foreign key (payment_instrument_id, company_id)
    references public.payment_instruments(id, company_id)
    on delete restrict
);

create index payment_instrument_events_instrument_time_idx
  on public.payment_instrument_events (payment_instrument_id, occurred_at desc);

create index payment_instrument_events_company_time_idx
  on public.payment_instrument_events (company_id, occurred_at desc);

-- Refresh mirror-owned fields from the real mirror, validate party identity,
-- and protect immutable/status fields from direct authenticated updates.
create or replace function private.validate_payment_instrument()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, parasut
as $$
declare
  mirror_row parasut.checks%rowtype;
  mirror_currency text;
  mirror_payment_status text;
  contact_account_type text;
  contact_name text;
  local_quote_customer_name text;
  mirror_contact_id text;
  transition_allowed boolean;
  transition_note text;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.source is distinct from old.source
       or new.external_parasut_id is distinct from old.external_parasut_id
       or new.instrument_type is distinct from old.instrument_type
       or new.created_at is distinct from old.created_at then
      raise exception using
        errcode = '22023',
        message = 'Çek kimliği, şirketi ve kaynak alanları değiştirilemez.';
    end if;

    if old.source = 'parasut_mirror'
       and (select auth.uid()) is not null
       and (
         new.direction is distinct from old.direction
         or new.bank_name is distinct from old.bank_name
         or new.check_number is distinct from old.check_number
         or new.issue_date is distinct from old.issue_date
         or new.due_date is distinct from old.due_date
         or new.currency is distinct from old.currency
         or new.original_amount is distinct from old.original_amount
         or new.remaining_amount is distinct from old.remaining_amount
         or new.settlement_status is distinct from old.settlement_status
         or new.paid_at is distinct from old.paid_at
         or new.notes is distinct from old.notes
       ) then
      raise exception using
        errcode = '22023',
        message = 'Paraşüt kaynaklı çekin finansal alanları ERP kullanıcısı tarafından değiştirilemez.';
    end if;

    transition_allowed := coalesce(
      current_setting('app.payment_instrument_transition_allowed', true),
      ''
    ) = 'on';
    transition_note := nullif(
      btrim(coalesce(
        current_setting('app.payment_instrument_transition_note', true),
        ''
      )),
      ''
    );

    if old.source = 'erp_local'
       and old.settlement_status <> 'open'
       and (select auth.uid()) is not null
       and (
         new.direction is distinct from old.direction
         or new.contact_parasut_id is distinct from old.contact_parasut_id
         or new.local_quote_customer_id is distinct from old.local_quote_customer_id
         or new.contact_snapshot_name is distinct from old.contact_snapshot_name
         or new.bank_name is distinct from old.bank_name
         or new.check_number is distinct from old.check_number
         or new.issue_date is distinct from old.issue_date
         or new.due_date is distinct from old.due_date
         or new.currency is distinct from old.currency
         or new.original_amount is distinct from old.original_amount
         or new.notes is distinct from old.notes
       ) then
      raise exception using
        errcode = '22023',
        message = 'Kapanmış çek düzenlenemez.';
    end if;

    if old.source = 'erp_local'
       and (
         new.settlement_status is distinct from old.settlement_status
         or new.remaining_amount is distinct from old.remaining_amount
         or new.paid_at is distinct from old.paid_at
       )
       and (select auth.uid()) is not null
       and not transition_allowed then
      raise exception using
        errcode = '42501',
        message = 'Durum ve kalan tutar yalnız güvenli çek durum işlemiyle değiştirilebilir.';
    end if;

    if new.settlement_status is distinct from old.settlement_status
       and new.settlement_status in ('cancelled', 'returned')
       and transition_note is null then
      raise exception using
        errcode = '22023',
        message = 'İptal ve iade işlemlerinde açıklama zorunludur.';
    end if;

    -- A pristine open local cheque may have its amount corrected. Keep its
    -- remaining amount aligned without exposing remaining_amount to UPDATE.
    if old.source = 'erp_local'
       and new.original_amount is distinct from old.original_amount then
      if old.settlement_status <> 'open'
         or old.remaining_amount <> old.original_amount then
        raise exception using
          errcode = '22023',
          message = 'İşlem görmüş çekin asıl tutarı değiştirilemez.';
      end if;
      new.remaining_amount := new.original_amount;
    end if;
  end if;

  if new.source = 'erp_local' and tg_op = 'INSERT' then
    if new.settlement_status = 'open' then
      new.remaining_amount := new.original_amount;
      new.paid_at := null;
    elsif new.settlement_status = 'paid' then
      new.remaining_amount := 0;
      new.paid_at := clock_timestamp();
    end if;
  end if;

  if new.source = 'parasut_mirror' then
    select mirror.*
      into mirror_row
    from parasut.checks as mirror
    where mirror.company_id = new.company_id
      and mirror.parasut_id = new.external_parasut_id
      and mirror.source_archived is not true
    limit 1;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Aynı şirkette etkin Paraşüt çek kaydı bulunamadı.';
    end if;

    new.instrument_type := 'check';
    if coalesce(
      mirror_row.is_in,
      nullif(mirror_row.attributes ->> 'is_in', '')::boolean,
      false
    ) then
      new.direction := 'received';
    elsif coalesce(
      mirror_row.is_out,
      nullif(mirror_row.attributes ->> 'is_out', '')::boolean,
      false
    ) then
      new.direction := 'issued';
    else
      raise exception using
        errcode = '23514',
        message = 'Paraşüt çek yönü belirlenemedi.';
    end if;

    mirror_contact_id := case
      when new.direction = 'received' then coalesce(
        nullif(mirror_row.issued_by_parasut_id, ''),
        nullif(mirror_row.relationships #>> '{issued_by,data,id}', '')
      )
      when new.direction = 'issued' then coalesce(
        nullif(mirror_row.given_to_parasut_id, ''),
        nullif(mirror_row.relationships #>> '{given_to,data,id}', '')
      )
      else null
    end;
    if mirror_contact_id is not null
       and new.contact_parasut_id is distinct from mirror_contact_id then
      raise exception using
        errcode = '22023',
        message = 'Kaynak Paraşüt taraf ilişkisi ERP içinde değiştirilemez.';
    end if;

    new.bank_name := coalesce(
      nullif(mirror_row.bank_name, ''),
      nullif(mirror_row.attributes ->> 'bank_name', ''),
      nullif(mirror_row.attributes ->> 'bank_identifier', ''),
      nullif(mirror_row.bank_identifier, '')
    );
    new.check_number := coalesce(
      nullif(mirror_row.serial_number, ''),
      nullif(mirror_row.attributes ->> 'serial_number', '')
    );
    new.issue_date := coalesce(
      mirror_row.issue_date,
      nullif(mirror_row.attributes ->> 'issue_date', '')::date
    );
    new.due_date := coalesce(
      mirror_row.due_date,
      nullif(mirror_row.attributes ->> 'due_date', '')::date
    );
    if new.due_date is null then
      raise exception using
        errcode = '23514',
        message = 'Paraşüt çek vade tarihi eksik.';
    end if;

    mirror_currency := upper(coalesce(
      nullif(mirror_row.currency, ''),
      nullif(mirror_row.attributes ->> 'currency', '')
    ));
    new.currency := case mirror_currency
      when 'TRL' then 'TRY'
      when 'TRY' then 'TRY'
      when 'USD' then 'USD'
      when 'EUR' then 'EUR'
      else null
    end;
    if new.currency is null then
      raise exception using
        errcode = '23514',
        message = 'Paraşüt çek para birimi desteklenmiyor.';
    end if;

    new.original_amount := coalesce(
      mirror_row.net_total,
      nullif(mirror_row.attributes ->> 'net_total', '')::numeric
    );
    new.remaining_amount := coalesce(
      mirror_row.remaining,
      nullif(mirror_row.attributes ->> 'remaining', '')::numeric
    );
    if new.original_amount is null or new.original_amount <= 0 then
      raise exception using
        errcode = '23514',
        message = 'Paraşüt çek tutarı eksik veya geçersiz.';
    end if;
    if new.remaining_amount is null then
      raise exception using
        errcode = '23514',
        message = 'Paraşüt çek kalan tutarı eksik.';
    end if;
    mirror_payment_status := lower(coalesce(
      nullif(mirror_row.payment_status, ''),
      nullif(mirror_row.attributes ->> 'payment_status', ''),
      ''
    ));
    new.settlement_status := case
      when mirror_payment_status = 'paid' or new.remaining_amount = 0 then 'paid'
      when mirror_payment_status in ('cancelled', 'canceled') then 'cancelled'
      when mirror_payment_status = 'returned' then 'returned'
      else 'open'
    end;
    new.paid_at := null;

    -- Notes are mirror-owned too. Always derive them from the validated
    -- Paraşüt row so an overlay cannot retain a stale or caller-spoofed note.
    new.notes := coalesce(
      nullif(mirror_row.description, ''),
      nullif(mirror_row.attributes ->> 'description', '')
    );
  end if;

  if new.contact_parasut_id is not null then
    select
      contact.attributes ->> 'account_type',
      nullif(btrim(contact.attributes ->> 'name'), '')
      into contact_account_type, contact_name
    from parasut.contacts as contact
    where contact.company_id = new.company_id
      and contact.parasut_id = new.contact_parasut_id
      and contact.source_archived is not true
    limit 1;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Aynı şirkette etkin Paraşüt taraf kaydı bulunamadı.';
    end if;

    if (new.direction = 'received' and contact_account_type is distinct from 'customer')
       or (new.direction = 'issued' and contact_account_type is distinct from 'supplier') then
      raise exception using
        errcode = '23514',
        message = 'Alınan çek müşteriye, verilen çek tedarikçiye bağlanmalıdır.';
    end if;

    if contact_name is null then
      raise exception using
        errcode = '23514',
        message = 'Paraşüt taraf adının boş olmaması gerekir.';
    end if;

    new.contact_snapshot_name := contact_name;
  elsif new.local_quote_customer_id is not null then
    if new.direction <> 'received' then
      raise exception using
        errcode = '23514',
        message = 'Yerel teklif müşterisi yalnız alınan çeke bağlanabilir.';
    end if;

    select nullif(btrim(quote_customer.company_name), '')
      into local_quote_customer_name
    from public.quote_customers as quote_customer
    where quote_customer.id = new.local_quote_customer_id
    limit 1;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Yerel teklif müşterisi bulunamadı.';
    end if;

    new.contact_snapshot_name := local_quote_customer_name;
  else
    new.contact_snapshot_name := null;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_payment_instrument() from public;
revoke all on function private.validate_payment_instrument() from anon, authenticated;

create trigger payment_instruments_10_validate
before insert or update on public.payment_instruments
for each row execute function private.validate_payment_instrument();

create trigger payment_instruments_20_set_updated_at
before update on public.payment_instruments
for each row execute function public.erp_set_updated_at();

-- Audit writes are deliberately security-definer and trigger-only. Clients get
-- no INSERT privilege on the event table, so they cannot forge history rows.
create or replace function private.log_payment_instrument_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  resolved_event_type text;
  resolved_note text;
  resolved_changes jsonb;
begin
  if tg_table_schema <> 'public'
     or tg_table_name <> 'payment_instruments' then
    raise exception 'Unexpected audit trigger source %.%', tg_table_schema, tg_table_name;
  end if;

  resolved_note := nullif(
    btrim(coalesce(
      current_setting('app.payment_instrument_transition_note', true),
      ''
    )),
    ''
  );

  if tg_op = 'INSERT' then
    resolved_event_type := 'created';
    resolved_changes := jsonb_build_object('after', to_jsonb(new));
    insert into public.payment_instrument_events (
      payment_instrument_id,
      company_id,
      event_type,
      previous_settlement_status,
      new_settlement_status,
      actor_user_id,
      note,
      changes
    ) values (
      new.id,
      new.company_id,
      resolved_event_type,
      null,
      new.settlement_status,
      (select auth.uid()),
      resolved_note,
      resolved_changes
    );
    return new;
  end if;

  resolved_event_type := case
    when new.settlement_status is distinct from old.settlement_status
      and new.settlement_status = 'paid' then 'marked_paid'
    when new.settlement_status is distinct from old.settlement_status
      and new.settlement_status = 'cancelled' then 'cancelled'
    when new.settlement_status is distinct from old.settlement_status
      and new.settlement_status = 'returned' then 'returned'
    when (
      new.contact_parasut_id is distinct from old.contact_parasut_id
      or new.local_quote_customer_id is distinct from old.local_quote_customer_id
    ) and new.contact_parasut_id is null
      and new.local_quote_customer_id is null then 'party_unlinked'
    when new.contact_parasut_id is distinct from old.contact_parasut_id
      or new.local_quote_customer_id is distinct from old.local_quote_customer_id
      then 'party_linked'
    else 'updated'
  end;

  resolved_changes := jsonb_build_object(
    'before', to_jsonb(old),
    'after', to_jsonb(new)
  );

  insert into public.payment_instrument_events (
    payment_instrument_id,
    company_id,
    event_type,
    previous_settlement_status,
    new_settlement_status,
    actor_user_id,
    note,
    changes
  ) values (
    new.id,
    new.company_id,
    resolved_event_type,
    old.settlement_status,
    new.settlement_status,
    (select auth.uid()),
    resolved_note,
    resolved_changes
  );

  return new;
end;
$$;

revoke all on function private.log_payment_instrument_event() from public;
revoke all on function private.log_payment_instrument_event() from anon, authenticated;

create trigger payment_instruments_90_audit
after insert or update on public.payment_instruments
for each row execute function private.log_payment_instrument_event();

create or replace function private.reject_payment_instrument_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Çek kayıtları kalıcı olarak silinemez; durum işlemi kullanın.';
end;
$$;

revoke all on function private.reject_payment_instrument_delete() from public;
revoke all on function private.reject_payment_instrument_delete() from anon, authenticated;

create trigger payment_instruments_reject_delete
before delete on public.payment_instruments
for each row execute function private.reject_payment_instrument_delete();

create or replace function private.reject_payment_instrument_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Çek geçmişi append-only kayıttır ve değiştirilemez.';
end;
$$;

revoke all on function private.reject_payment_instrument_event_mutation() from public;
revoke all on function private.reject_payment_instrument_event_mutation() from anon, authenticated;

create trigger payment_instrument_events_reject_mutation
before update or delete on public.payment_instrument_events
for each row execute function private.reject_payment_instrument_event_mutation();

-- Controlled local-only settlement transition. The function derives company_id
-- from the locked row, checks the caller against that company, and never accepts
-- a browser-provided tenant id.
create or replace function public.transition_payment_instrument(
  p_instrument_id uuid,
  p_target_status text,
  p_note text default null
)
returns public.payment_instruments
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_instrument public.payment_instruments;
  updated_instrument public.payment_instruments;
  target_status text;
  operation_note text;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Yetkili kullanıcı gerekli.';
  end if;

  select instrument.*
    into current_instrument
  from public.payment_instruments as instrument
  where instrument.id = p_instrument_id
    and private.erp_user_can_access_company(
      instrument.company_id,
      'finance.edit'
    )
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Çek kaydı bulunamadı.';
  end if;

  if current_instrument.source <> 'erp_local' then
    raise exception using
      errcode = '22023',
      message = 'Paraşüt kaynaklı çeklerin durumu ERP üzerinden değiştirilemez.';
  end if;

  if current_instrument.settlement_status <> 'open' then
    raise exception using
      errcode = '22023',
      message = 'Yalnız açık çekler için durum işlemi yapılabilir.';
  end if;

  target_status := lower(btrim(coalesce(p_target_status, '')));
  if target_status not in ('paid', 'cancelled', 'returned') then
    raise exception using
      errcode = '22023',
      message = 'Geçersiz çek durum işlemi.';
  end if;

  operation_note := nullif(btrim(coalesce(p_note, '')), '');
  if target_status in ('cancelled', 'returned') and operation_note is null then
    raise exception using
      errcode = '22023',
      message = 'İptal ve iade işlemlerinde açıklama zorunludur.';
  end if;

  perform set_config('app.payment_instrument_transition_allowed', 'on', true);
  perform set_config(
    'app.payment_instrument_transition_note',
    coalesce(operation_note, ''),
    true
  );

  update public.payment_instruments
  set settlement_status = target_status,
      remaining_amount = case
        when target_status = 'paid' then 0
        else remaining_amount
      end,
      paid_at = case
        when target_status = 'paid' then clock_timestamp()
        else null
      end
  where id = current_instrument.id
  returning * into updated_instrument;

  perform set_config('app.payment_instrument_transition_allowed', '', true);
  perform set_config('app.payment_instrument_transition_note', '', true);

  return updated_instrument;
end;
$$;

revoke all on function public.transition_payment_instrument(uuid, text, text) from public;
revoke all on function public.transition_payment_instrument(uuid, text, text) from anon;
grant execute on function public.transition_payment_instrument(uuid, text, text) to authenticated;

alter table public.payment_instruments enable row level security;
alter table public.payment_instrument_events enable row level security;

create policy payment_instruments_select_company
on public.payment_instruments
for select
to authenticated
using (
  private.erp_user_can_access_company(company_id, 'finance.view')
);

create policy payment_instruments_insert_local
on public.payment_instruments
for insert
to authenticated
with check (
  source = 'erp_local'
  and (
    (
      settlement_status = 'open'
      and remaining_amount = original_amount
      and paid_at is null
    )
    or (
      settlement_status = 'paid'
      and remaining_amount = 0
      and paid_at is not null
    )
  )
  and private.erp_user_can_access_company(company_id, 'finance.create')
);

create policy payment_instruments_insert_mirror_overlay
on public.payment_instruments
for insert
to authenticated
with check (
  source = 'parasut_mirror'
  and private.erp_user_can_access_company(company_id, 'finance.edit')
);

create policy payment_instruments_update_company
on public.payment_instruments
for update
to authenticated
using (
  private.erp_user_can_access_company(company_id, 'finance.edit')
)
with check (
  private.erp_user_can_access_company(company_id, 'finance.edit')
);

create policy payment_instrument_events_select_company
on public.payment_instrument_events
for select
to authenticated
using (
  private.erp_user_can_access_company(company_id, 'finance.view')
);

-- Data API grants are explicit and intentionally narrower than table-owner
-- rights. No authenticated DELETE is granted. Status/remaining/paid_at and
-- tenant/source identity columns are omitted from UPDATE; the RPC owns them.
revoke all on table public.payment_instruments from anon, authenticated, service_role;
revoke all on table public.payment_instrument_events from anon, authenticated, service_role;

grant select on table public.payment_instruments to authenticated;
grant insert (
  company_id,
  source,
  external_parasut_id,
  instrument_type,
  direction,
  contact_parasut_id,
  contact_snapshot_name,
  bank_name,
  check_number,
  issue_date,
  due_date,
  currency,
  original_amount,
  remaining_amount,
  settlement_status,
  notes
) on public.payment_instruments to authenticated;
grant update (
  direction,
  contact_parasut_id,
  contact_snapshot_name,
  bank_name,
  check_number,
  issue_date,
  due_date,
  currency,
  original_amount,
  notes
) on public.payment_instruments to authenticated;

grant select on table public.payment_instrument_events to authenticated;

grant select, insert, update on table public.payment_instruments to service_role;
grant select, insert on table public.payment_instrument_events to service_role;

comment on table public.payment_instruments is
  'ERP-local cheques plus validated overlays for read-only Paraşüt mirror cheques; never writes to Paraşüt.';
comment on column public.payment_instruments.company_id is
  'Tenant scope validated against public.erp_users.accessible_company_ids; no companies FK exists in production.';
comment on column public.payment_instruments.local_quote_customer_id is
  'Referential-only FK to quote_customers(id); quote_customers has no company_id, so same-company ownership is not inferred.';
comment on table public.payment_instrument_events is
  'Append-only, trigger-generated audit trail for payment instrument lifecycle and party-link changes.';

commit;
