-- Singleton row tracking MetalpriceAPI call-rate state (last call time,
-- monthly call count, last successful EUR/XAU/XAG rates) for the
-- market-data edge function. Shared globally across every caller and every
-- edge function instance/region, so the 8-hour minimum interval and the
-- 99-call monthly cap are enforced regardless of cold starts, restarts, or
-- concurrent simultaneous requests.
--
-- No RLS policies are defined: RLS is enabled with zero policies, which
-- denies anon/authenticated access entirely. Only the service role (used
-- exclusively by the market-data edge function) can read or write this
-- table, since it bypasses RLS.
create table if not exists public.metalprice_api_state (
  id int primary key default 1,
  last_call_at timestamptz,
  last_success_at timestamptz,
  calls_this_month int not null default 0,
  call_month text not null,
  last_rates jsonb,
  last_error text,
  in_flight boolean not null default false,
  in_flight_started_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint metalprice_api_state_singleton check (id = 1)
);

insert into public.metalprice_api_state (id, call_month)
values (1, to_char(now() at time zone 'utc', 'YYYY-MM'))
on conflict (id) do nothing;

alter table public.metalprice_api_state enable row level security;

comment on table public.metalprice_api_state is
  'Singleton row (id=1) tracking MetalpriceAPI rate-limit state for the market-data edge function: last call timestamp, current calendar month + its call count, and the last successfully fetched EUR/XAU/XAG rates (reused whenever a fresh call is not due/allowed). Never contains caller coordinates or any tenant/user data.';

-- Atomically claims the right to perform exactly one MetalpriceAPI refresh.
-- Resets the monthly counter first if the calendar month has rolled over.
-- Returns claimed=false (with the current cached rates/count, if any) when
-- a refresh is not yet due, the monthly cap has been reached, or another
-- concurrent request already holds the in-flight claim — callers must treat
-- claimed=false as "reuse the cached rates", never as an error.
--
-- Race-safety: the UPDATE ... WHERE ... RETURNING below is a single atomic
-- statement. Postgres serializes concurrent UPDATEs on the same row via its
-- normal row lock — only the first caller's UPDATE can see in_flight=false
-- and matching timing/cap conditions; by the time a second concurrent
-- caller's UPDATE acquires the row lock, in_flight is already true, so its
-- WHERE clause no longer matches and it affects zero rows (claimed=false).
-- No advisory lock or explicit transaction is needed for this guarantee.
create or replace function public.claim_metalprice_refresh(
  p_now timestamptz,
  p_month text,
  p_min_interval_seconds int,
  p_monthly_cap int,
  p_stale_lock_seconds int
) returns table (
  claimed boolean,
  last_rates jsonb,
  calls_this_month int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.metalprice_api_state;
begin
  update public.metalprice_api_state
    set calls_this_month = 0, call_month = p_month
    where id = 1 and call_month <> p_month;

  update public.metalprice_api_state t
    set in_flight = true, in_flight_started_at = p_now
    where t.id = 1
      and (t.in_flight = false or t.in_flight_started_at < p_now - make_interval(secs => p_stale_lock_seconds))
      and (t.last_call_at is null or t.last_call_at <= p_now - make_interval(secs => p_min_interval_seconds))
      and t.calls_this_month < p_monthly_cap
    returning t.* into v_row;

  if found then
    return query select true, v_row.last_rates, v_row.calls_this_month;
  else
    select * into v_row from public.metalprice_api_state where id = 1;
    return query select false, v_row.last_rates, v_row.calls_this_month;
  end if;
end;
$$;

-- Records the outcome of a claimed refresh attempt and releases the
-- in-flight lock. Always increments calls_this_month and bumps
-- last_call_at (an attempt consumes the monthly budget even when it
-- fails) — last_rates/last_success_at only advance on success, so a failed
-- attempt never overwrites the last known-good rates.
create or replace function public.record_metalprice_result(
  p_now timestamptz,
  p_success boolean,
  p_rates jsonb,
  p_error text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.metalprice_api_state
    set in_flight = false,
        in_flight_started_at = null,
        last_call_at = p_now,
        calls_this_month = calls_this_month + 1,
        last_rates = case when p_success then p_rates else last_rates end,
        last_success_at = case when p_success then p_now else last_success_at end,
        last_error = case when p_success then null else p_error end,
        updated_at = p_now
    where id = 1;
end;
$$;
