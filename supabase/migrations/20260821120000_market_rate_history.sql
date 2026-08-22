-- Daily closing snapshot per market-data instrument (usdTry/eurTry/gramTry),
-- written by the market-data edge function (service role) so the ERP
-- dashboard can show day-over-day change on the FX/gold tiles.
--
-- No RLS policies are defined: RLS is enabled with zero policies, which
-- denies anon/authenticated access entirely. Only the service role (used
-- exclusively by the market-data edge function) can read or write this
-- table, since it bypasses RLS.
create table if not exists public.market_rate_history (
  instrument text not null check (instrument in ('usdTry', 'eurTry', 'gramTry')),
  rate_date date not null,
  value numeric not null check (value > 0),
  source text not null,
  updated_at timestamptz not null default now(),
  primary key (instrument, rate_date)
);

alter table public.market_rate_history enable row level security;

comment on table public.market_rate_history is
  'One row per (instrument, calendar date) closing value, written by the market-data edge function so the dashboard can compute day-over-day change. Never contains caller coordinates or any tenant/user data.';
