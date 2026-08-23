-- P0 follow-up: the statement-refresh step (transaction_history_items
-- staleness catch-up) previously ran inline at the end of the shared
-- 5-minute parasut-sync-run cron job. Raising its contact budget there
-- added enough wall-clock time to that already-tight invocation that
-- consecutive ticks started overlapping, which enforceSingleRunner then
-- correctly (but disruptively) resolved by failing the losing invocation's
-- "checks" sync (observed live in production on 2026-08-23). At a
-- safe-but-unraised budget of 1 contact/tick, the ~430-contact never-synced
-- backlog would take roughly 36 hours to clear, during which the P1 fix
-- correctly but unacceptably blocks printing for those contacts.
--
-- Fix: run statement-refresh as its own separate, more frequent cron job
-- calling the SAME parasut-sync-run function with a distinct
-- {"action":"statement-refresh"} body, entirely decoupled from the
-- six-resource loop — it can never extend that loop's cycle time no matter
-- its own budget. Every 1 minute, 5 contacts/invocation (~10 Paraşüt
-- requests/invocation against a measured 10-req/~10s limit, so each
-- invocation alone stays under the ceiling with no risk of self-inflicted
-- 429s) drains the backlog in roughly 90 minutes instead of 36 hours.

select cron.schedule(
  'parasut-sync-run-statement-refresh-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://meauutjsnnggzcigyvfp.supabase.co/functions/v1/parasut-sync-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'parasut_sync_run_invoke_key'),
      'X-Sync-Trigger', 'scheduled'
    ),
    body := '{"action":"statement-refresh"}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
