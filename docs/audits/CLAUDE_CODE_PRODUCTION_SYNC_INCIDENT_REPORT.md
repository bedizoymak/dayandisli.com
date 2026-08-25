# Production Sync Incident Report — 2026-08-24

## Summary

Between roughly 08:52 and 12:38 UTC on 2026-08-24, ERP login (`POST /auth/v1/token`) was degraded and then fully failing (progressing from 10-36s response times / 504 timeouts to a hard Cloudflare 522 "origin timed out — something on your server is hogging resources"). The Supabase Dashboard independently reported resource exhaustion, with Postgres showing a 12% error rate and Auth a 13.6% error rate over the preceding 24h, while API Gateway carried 1.2M requests at a 0.05% error rate. This report covers the emergency mitigation only — not a full root-cause fix.

## 1. Every trigger of `parasut-sync-run` found

| # | Trigger | Type | Cadence | Found in |
|---|---|---|---|---|
| 1 | `parasut-sync-run-every-5-minutes` (pg_cron → `net.http_post`, body `{}`) | Automatic, repeated | Every 5 min (288/day) | `supabase/migrations/20260811120000_schedule_parasut_sync_run.sql` |
| 2 | `parasut-sync-run-statement-refresh-every-minute` (pg_cron → `net.http_post`, body `{"action":"statement-refresh"}`) | Automatic, repeated | Every 1 min (1,440/day) | `supabase/migrations/20260823134500_schedule_statement_refresh.sql` |
| 3 | Manual "Sync" button (`ParasutManualSyncControl.tsx` → `parasutManualSync.ts` → `parasut-sync-run` with `{}`) | Manual, admin-triggered | On click only | `src/features/crm/ParasutManualSyncControl.tsx` |
| 4 | `scripts/run-parasut-history-backfill.ts` | Manual, CLI-only | On demand only | repo root `scripts/` |

**A related, separate trigger of `syncContacts()` (NOT via `parasut-sync-run`) was also found and is documented for completeness, but intentionally NOT paused (see reasoning below):**

| # | Trigger | Type | Cadence | Found in |
|---|---|---|---|---|
| 5 | `ParasutContactsOnlySync.syncAndCheck` → `syncContacts(context)` with `concurrencyLock` defaulting to **false** | Demand-driven (fires once per customer-creation action) | On demand only, one call per new customer created | `server/erp/providers/parasut-contacts-only-sync.ts`, wired in `supabase/functions/parasut-write-api/index.ts` |

No GitHub Actions workflow, no frontend `setInterval`/polling, and no other scheduled mechanism triggers sync. (`.github/workflows/quality.yml` was checked and contains no cron/sync trigger; the only frontend `setInterval` usages found — a UI clock in `ErpLayout.tsx` and a self-clearing reCAPTCHA widget poll in `ContactForm.tsx` — are unrelated to sync.)

## 2. Mitigation applied

**A. Both automatic/repeated pg_cron triggers were unscheduled** (via `select cron.unschedule('<jobname>')`, executed directly against the linked production database):
- `parasut-sync-run-every-5-minutes` → unscheduled successfully (confirmed: `{"unschedule": true}`).
- `parasut-sync-run-statement-refresh-every-minute` → unscheduled successfully on retry after an initial connection timeout (confirmed: `{"unschedule": true}`).

Their exact prior configuration (schedule expression, HTTP target, headers, body, timeout) is preserved in version control, unmodified, in the two migration files listed above — nothing was deleted from the repository, only the live `cron.job` rows were removed from the database. **Restoring them exactly is a matter of re-running those two `cron.schedule(...)` blocks** (see §7).

**B. A code-level emergency-pause guard was added and deployed** to `supabase/functions/parasut-sync-run/index.ts`, as defense in depth:
- Checked as the very first line inside the request handler, before any environment/secret loading, before the Supabase client is created, and before any Paraşüt or Postgres request is made.
- Fail-safe default: **any value other than the literal string `"false"`** for the `PARASUT_SYNC_EMERGENCY_PAUSE` environment variable keeps the guard active — including the variable being entirely unset. This means the deployed function is paused right now with no secret configured, and stays paused even if a secret is accidentally cleared later.
- Covers every caller that reaches this one Edge Function entrypoint: the (now-unscheduled) cron jobs, the manual "Sync" button, and the CLI backfill runner — all funnel through the same `serve()` handler.
- Verified live: `POST /functions/v1/parasut-sync-run` with body `{}` now returns `{"status":"paused","reason":"emergency_pause_active"}` immediately (sub-second), doing zero Paraşüt or database work.
- Trigger #5 (`ParasutContactsOnlySync`) is a **separate Edge Function** (`parasut-write-api`) and does **not** go through this guard — see §4 for why it was deliberately left untouched.

**No mirrored data was deleted or altered. No Paraşüt data was written. No cron job definition was deleted from the repository — only unscheduled live, with the source-of-truth SQL intact in migrations.**

## 3. Root cause status: **SUSPECTED, not confirmed**

What is **confirmed** (verified by direct testing/reading, not inference):
- The 5-minute and 1-minute cron jobs were genuinely running automatically and unattended, at the cadences above, up until this incident.
- Auth's password-grant endpoint was measurably degraded (10-36s response times, then 504, then 522) across roughly 3.5 hours of direct testing in this session, independent of and prior to any action taken in this incident response.
- The Supabase Dashboard's own resource-exhaustion report and the 522 Cloudflare error text ("something on your server is hogging resources") are Supabase's own diagnosis, not mine.
- After unscheduling both cron jobs and deploying the pause guard, Auth password-grant login recovered to a stable ~0.4-0.5s response time across 4 consecutive tests (see §6). This is a **strong timing correlation**, not proof of sole causation — Supabase's own dashboard data (from an earlier turn in this incident) showed error concentration disproportionate to the cron jobs' own request volume (Postgres/Auth error *rates* of 12-14% against a much larger, mostly-error-free 1.2M-request Gateway total), meaning some other, unidentified traffic source may also be contributing. That other source was **not identified** — the Logflare-backed per-endpoint/IP log breakdown needed to identify it could not be retrieved (Management API access was blocked by the harness's safety layer even with user approval to extract the stored CLI token; see the audit turn immediately preceding this incident).

What is **suspected but not confirmed** (a structural finding from reading the code, not from an observed log entry):
- **The likely mechanism behind the reported "repeated PATCH contacts...500" traffic**: in `server/parasut/sync-base.ts`'s `syncCollection`, `persistCheckpoint` is skipped for a page whenever *any* row on that page errors (`if (!checkpointBlocked)`, where `checkpointBlocked = true` the moment `counters.errors > errorsBeforePage`). If a specific contact's upsert PATCH persistently fails (e.g., a genuinely malformed attribute value causing a consistent 500 from PostgREST), the resume checkpoint never advances past that page — so **every subsequent 5-minute cron tick re-fetches and re-attempts the identical failing write from scratch**, indefinitely, with zero backoff and zero circuit breaker. At the prior cadence this is up to 288 identical retries/day against the same failing row. This exactly matches the reported symptom shape (repeated GET/PATCH to `rest/v1/contacts`, at least one PATCH 500) but **the specific contact, the specific SQL/API error message, and whether this mechanism was actually firing during the incident window were not confirmed** — that requires the Postgres/PostgREST error log entries, which were not accessible (see §4).

## 4. Investigation of the failing `PATCH contacts` path

- **Confirmed from code**: `upsertResource()` (`server/parasut/upsert-resource.ts`) issues one `SELECT` (existence/hash check) followed by one `UPDATE` (PostgREST PATCH) or `INSERT` **per contact row**, not batched. For a full contacts resync (~441 active contacts), that is up to ~441 SELECT+PATCH/INSERT pairs per invocation when nothing is cached/unchanged, spread across up to 20 pages per invocation (`MAX_PAGES_PER_INVOCATION` in `server/parasut/sync-contacts.ts`). This is the existing, working-as-designed upsert engine used for every resource type — it was not introduced or modified in this incident response, and is not itself the anomaly; the anomaly (if the suspected mechanism above is correct) is a *stuck* resume chain re-issuing the same page's writes repeatedly, not the per-row write pattern itself.
- **Not confirmed**: the exact SQL/API error text behind the reported "PATCH 500". No error was masked or retried by anything changed in this incident response — the emergency pause stops the retries at the source (no invocation runs at all) rather than papering over them.
- **Explicitly not done, per instructions**: no full sync, statement refresh, queue drain, backfill, or manual retry was run to reproduce or further diagnose the failing PATCH while this report was being written.

## 5. Sync jobs paused

- `parasut-sync-run-every-5-minutes` (six-resource sync: accounts, contacts, products, sales_invoices, purchase_bills, checks) — **paused** (unscheduled + code-guarded).
- `parasut-sync-run-statement-refresh-every-minute` (customer-ledger statement freshness) — **paused** (unscheduled + code-guarded).
- Manual "Sync" button — **paused** (code-guarded; the button itself was not removed from the UI, so a click still reaches the function, which now safely returns `{"status":"paused"}` and does nothing).
- `ParasutContactsOnlySync` (customer-creation flow) — **NOT paused**, deliberately. Reasoning: it is demand-driven (fires once per explicit "create customer" action, not automatic or repeated), it does not go through the paused entrypoint, pausing it would break a core unrelated feature (customer creation) that the incident instructions explicitly say not to touch, and — most importantly — a single on-demand contacts sync is a negligible, bounded, one-shot load compared to the 288/day and 1,440/day cron cadences that were the actual repeated-load triggers named in the incident report. If this later proves to be a meaningful contributor, it needs its own, separately-scoped fix (e.g., adding `concurrencyLock: true` there too), not an emergency pause of a working customer-facing feature.

## 6. Validation results

| Check | Before mitigation | After mitigation |
|---|---|---|
| `parasut-sync-run` invocation | Ran full sync/statement-refresh work automatically every 1-5 min | Returns `{"status":"paused","reason":"emergency_pause_active"}` immediately, zero DB/Paraşüt work (verified live) |
| `POST /auth/v1/token?grant_type=password` | 10-36s response times, then HTTP 504, then HTTP 522 (Cloudflare origin timeout) across ~3.5h of direct testing | **HTTP 200 in 0.4-0.5s, stable across 4 consecutive tests** taken after mitigation |
| Customer ledger read (`parasut-api` → PİNO, contact `1011029161`) | Not specifically retested during the outage window | **Confirmed working**: `status: reconciled`, 23 rows, balance 927,109.11 — matches the exact figure independently verified in the prior customer-ledger work, i.e. no mirrored data was lost or altered |
| New high-frequency `contacts` PATCH traffic | N/A (this incident's subject) | Not independently re-observable from here (no Logflare log access — see §3); inferred stopped because both cron sources of that traffic are unscheduled and the shared entrypoint now no-ops |

**Auth recovery is a strong, directly-observed, timestamped correlation with the mitigation. It is not proof the cron jobs were the sole cause** — see §3's caveat about the unexplained portion of the 1.2M-request Gateway volume, which this incident response did not identify.

## 7. Exact safe procedure to re-enable sync later

**Do not re-enable until:**
1. The suspected stuck-checkpoint retry mechanism (§3) is either confirmed or ruled out against the actual Postgres/PostgREST error logs (requires Logflare/Management API access this session could not obtain).
2. Per-invocation and per-row protections are added — none of the following exist in the current code and should be added before resuming:
   - A **single-flight lock already exists** at the resource level (`enforceSingleRunner` via `concurrencyLock: true`) for the cron-triggered paths, but trigger #5 (`ParasutContactsOnlySync`) does not opt in — decide whether it should.
   - **No bounded per-row retry / no exponential backoff** exists inside `syncCollection`'s row loop — a single persistently-failing row currently just increments an error counter and blocks the checkpoint forever, rather than being skipped-with-backoff or quarantined after N attempts.
   - **No cross-invocation circuit breaker** exists — `MAX_CONSECUTIVE_RESOURCE_ERRORS = 5` in `parasut-sync-run/index.ts` only aborts *within* one invocation; it does not prevent the next scheduled invocation 5 minutes later from immediately repeating the identical failing work.
   - **No explicit inter-batch delay/backoff** between pages or between invocations beyond the fixed cron cadence itself.
   - **Telemetry** (run count, rows processed, duration, errors) already exists per-invocation via `sync_runs`/`emitSyncSummary`, but there is no aggregated view or alert distinguishing "this resource has failed the same row N times in a row" from a one-off transient error — worth adding before resuming.

**When ready to resume, in this order:**
1. Set the `PARASUT_SYNC_EMERGENCY_PAUSE` secret to the literal string `"false"` on the `parasut-sync-run` Edge Function (via `supabase secrets set` or the Dashboard) — **this alone does not restore the cron schedule**, it only lifts the code-level guard for manual/CLI invocations.
2. Re-run the exact `select cron.schedule(...)` blocks from `supabase/migrations/20260811120000_schedule_parasut_sync_run.sql` and `supabase/migrations/20260823134500_schedule_statement_refresh.sql` (both files unmodified by this incident) to restore the two automatic cron jobs, only after step 1's manual/CLI testing confirms the underlying issue is actually fixed.
3. Monitor the Dashboard's Postgres/Auth error-rate panels closely for at least one full 5-minute cycle before trusting a full resumption.

## 8. Errors still outstanding
- The specific SQL/API error behind the reported "PATCH contacts 500" — **not identified**, blocked by lack of Logflare/Management API log access.
- Whether the suspected stuck-checkpoint mechanism (§3) was actually the active failure mode during this incident, versus some other unidentified contributor to the 1.2M-request Gateway volume — **not confirmed**.
- The single-flight lock, bounded retry/backoff, circuit breaker, and enhanced telemetry listed in §7 are **not yet implemented** — this incident response stopped the bleeding, it did not harden the sync engine.

## Commit / deploy
- Commit: (recorded after this report is committed — see the final report entry below or `git log`)
- Deployed: `parasut-sync-run` Edge Function, containing only the emergency-pause guard. No frontend changes, no schema changes, no other Edge Function touched.
