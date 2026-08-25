-- PROPOSED / OPERATOR-GATED — NEVER AUTO-APPLIED. Part of the 2026-08-25
-- execution-source separation: parasut-sync-run now rejects every invocation
-- that cannot prove it is the scheduled cron (X-Sync-Trigger: scheduled +
-- X-Sync-Secret matching the PARASUT_SYNC_CRON_SECRET edge secret). The two
-- existing pg_cron jobs authenticate only with the PUBLIC publishable key
-- plus a forgeable header, so they MUST be recreated with the new secret
-- header before automatic synchronization is ever un-paused.
--
-- ACTIVATION ORDER (all steps operator-performed; none are automatic):
--   1. Apply this file manually (supabase db execute / SQL editor).
--   2. Read the generated value:
--        select decrypted_secret from vault.decrypted_secrets
--        where name = 'parasut_sync_cron_secret_v2';
--   3. Set the edge secret to the SAME value (no function redeploy needed):
--        supabase secrets set PARASUT_SYNC_CRON_SECRET=<value>
--      and deploy the updated parasut-sync-run function.
--   4. Verify with pause active: a manual curl WITHOUT the secret must get
--      403 {"error":"unauthorized_execution_source"}; WITH trigger+secret it
--      must get 200 {"status":"paused",...}.
--   5. Only then consider setting PARASUT_SYNC_EMERGENCY_PAUSE=false.
--
-- Until this file is applied, recreated cron ticks receive 403 instead of
-- 200-paused — harmless, because automatic execution is paused anyway.

create extension if not exists pgcrypto;

select vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'parasut_sync_cron_secret_v2',
  'Shared proof-of-scheduled-origin for parasut-sync-run. Mirrored into the edge secret PARASUT_SYNC_CRON_SECRET by the operator (step 3 of the activation order). Never used as a database credential; its only purpose is distinguishing the pg_cron invocations from unproven callers.'
);

select cron.unschedule('parasut-sync-run-every-5-minutes');
select cron.schedule(
  'parasut-sync-run-every-5-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://meauutjsnnggzcigyvfp.supabase.co/functions/v1/parasut-sync-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'parasut_sync_run_invoke_key'),
      'X-Sync-Trigger', 'scheduled',
      'X-Sync-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'parasut_sync_cron_secret_v2')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);

select cron.unschedule('parasut-sync-run-statement-refresh-every-minute');
select cron.schedule(
  'parasut-sync-run-statement-refresh-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://meauutjsnnggzcigyvfp.supabase.co/functions/v1/parasut-sync-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'parasut_sync_run_invoke_key'),
      'X-Sync-Trigger', 'scheduled',
      'X-Sync-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'parasut_sync_cron_secret_v2')
    ),
    body := '{"action":"statement-refresh"}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
