-- Schedules the existing parasut-sync-run Edge Function to run automatically
-- via pg_cron + pg_net, replacing manual/on-demand invocation as the sole
-- refresh mechanism for the Parasut mirror (the root cause of the ~19-hour
-- staleness incident this project already diagnosed and repaired once).
--
-- Direction remains strictly Parasut -> Supabase: this migration only
-- schedules an HTTP POST to the ALREADY-DEPLOYED, already-tested
-- parasut-sync-run function. No new sync engine, no Supabase -> Parasut
-- write path, no OAuth credentials touched (those remain Edge Function
-- secrets only, as they always have been).
--
-- Cadence: every 5 minutes. parasut-sync-run's resumable, page-budgeted
-- design (server/parasut/sync-base.ts) means one invocation does NOT
-- necessarily complete every resource -- observed production invocations
-- take roughly 60-120 seconds and advance large resources
-- (sales_invoices/purchase_bills, capped at 2 pages/invocation) by only a
-- few pages at a time. A 5-minute cadence lets those resume chains
-- progress every cycle while keeping the whole mirror (contacts/accounts/
-- products/checks typically complete within one invocation; sales_invoices
-- and purchase_bills typically need ~15-17 invocations, i.e. roughly
-- 75-85 minutes, to fully re-traverse from a cold restart) within
-- approximately the targeted 15-minute freshness window for data that
-- changed since the last convergent pass, without invoking more often
-- than the function's own typical run time warrants.
--
-- Concurrency: parasut-sync-run now passes { concurrencyLock: true } to
-- every resource sync call (see the accompanying Edge Function change),
-- reusing sync-base.ts's existing enforceSingleRunner election so two
-- overlapping invocations (a slow run overlapping the next 5-minute tick)
-- can never race on the same resource's resume chain -- the loser's own
-- sync_runs row is marked failed cleanly, the winner proceeds normally,
-- and the next scheduled tick simply continues. No new locking mechanism.
--
-- Auth: parasut-sync-run has verify_jwt = true (Supabase gateway-level),
-- satisfied by ANY valid Supabase API key -- it does not grant any
-- elevated database access (the function's own service-role key stays an
-- Edge Function secret, never touched here). The project's anon/publishable
-- key is not a sensitive credential -- it is already compiled into the
-- public frontend bundle by design -- but it is stored via Supabase Vault
-- rather than duplicated as a plaintext literal in cron.job.command, for
-- clean rotation and to keep raw key material out of migration history
-- going forward.

create extension if not exists pg_cron;
create extension if not exists pg_net;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select vault.create_secret(
  'sb_publishable_tybsQmHLjFlVXHQn0PWxJA_l13ExKzY',
  'parasut_sync_run_invoke_key',
  'Supabase anon/publishable API key used ONLY to satisfy parasut-sync-run''s verify_jwt gateway gate for the scheduled pg_cron invocation. Not a sensitive credential (already public in the frontend bundle) and grants no elevated database access; stored via Vault instead of a plaintext literal in cron.job.command purely for clean rotation.'
);

select cron.schedule(
  'parasut-sync-run-every-5-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://meauutjsnnggzcigyvfp.supabase.co/functions/v1/parasut-sync-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'parasut_sync_run_invoke_key'),
      'X-Sync-Trigger', 'scheduled'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);
