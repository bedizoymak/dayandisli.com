# Paraşüt Customer Mirror — Production Release Report

Date: 2026-08-25 · Branch: `remediation/architecture-stabilization`

## 1–2. SHAs
- **Starting SHA:** `18318da` (Phase 16 terminal; working tree carried the uncommitted mirror + gate work)
- **Final deployment SHA:** **`170ea69`** — pushed to `origin/remediation/architecture-stabilization`; remote ref confirmed identical (`170ea69887d153b58389d59e11d88932d2ed8cb3`). Frontend built and Edge Functions deployed from exactly this commit.

## 3. API connectivity root cause
**No repository defect existed.** VERIFIED — PRODUCTION: `.env` holds every required name; production bundles bake the correct URL + publishable key; auth `/health` → 200; all functions reachable. The reported "Cannot connect…" string exists in no shipped source/bundle/dependency → transient/environmental on the reporting client. Nothing to repair; no config code changed.

## 4–5. Config files changed / env names
None for connectivity (nothing was broken). Environment variable NAMES required — all PRESENT, values REDACTED:
`VITE_SUPABASE_URL` ✓ · `VITE_SUPABASE_PUBLISHABLE_KEY` ✓ · `PARASUT_USERNAME` ✓ · `PARASUT_PASSWORD` ✓ · `PARASUT_CLIENT_ID` ✓ · `PARASUT_CLIENT_SECRET` ✓ · `PARASUT_COMPANY_ID` ✓ (`ERP_COMPANY_ID` absent locally; local-runner-only). Deploy-time: `DAYAN_FTP_HOST/USER/PASS/PORT/REMOTE_ROOT` ✓ (from `.env.local`, never printed).

## 6–7. Manual-sync architecture & authorization rule
Two surfaces, one engine, fail-closed classification:
- **`parasut-sync-run`** (scheduled-only): `gateScheduledInvocation` requires `X-Sync-Trigger: scheduled` AND timing-safe-matched `X-Sync-Secret` == `PARASUT_SYNC_CRON_SECRET`; everything else → **403 unauthorized_execution_source**, pause active or not. Proven-scheduled callers still hit the PAUSED default.
- **`parasut-write-api`** (manual): `resync` / `full-resync` (+ new generic `transaction_history` per-contact refresh) require Supabase JWT → active `erp_users` row → **strictly role=admin** → company-scoped context → canonical engine runners with `concurrencyLock: true`.
Authorization rule verbatim: *valid Supabase JWT ∧ erp_users.is_active ∧ roleSet∋"admin" ∧ companyScope.ok* — existing architecture, nothing invented.

## 8. Automatic sync remains paused — proof
VERIFIED — PRODUCTION: `cron.job` returns **NO CRON JOBS SCHEDULED**. VERIFIED — CODE: emergency-pause default literal `?? "true"` unchanged (guard-tested); even scheduled-shaped calls without the secret are 403 (probed live ×2). No unpause performed.

## 9. Cheque deletion reconciliation design
Enabled `reconcile: true` on `syncChecks()` using the existing proven machinery: archival ONLY after a completed error-free full snapshot; UPDATE `source_archived=true` (never DELETE); tenant+resource scoped; resume-chain-safe via `last_seen_at ≥ chainStartedAt`; truncated/suspicious snapshots refused (min-observed-ratio + surviving-overlap double guard) → **fail-closed exactly as required**. Evidence basis recorded in-file (live total_count=40; parent list 40 vs mirror 43; live 404s ×3). Idempotent on re-runs. ERP-origin instruments unaffected (overlay tables, never `parasut.checks`). Guard test fails CI if reconciliation is reverted.

## 10. RECONCILIATION_TARGET_CONTACT_IDS
REMOVED entirely (constant, sync-run backfill action, script allowlist/default). Generic replacements: admin-gated `resync{resource:"transaction_history",contactId}` accepting ANY numeric parent id + the pre-existing generic staleness sweep. New guard fails CI on any reintroduction of the identifier in non-test sources.

## 11. Customer-mirror files changed
`parasut-api/handlers.ts` (archived isolation ×2 sites, NULL-aware cheque read, stale comment), `CustomerDetailPage.tsx` (authoritative Tahsil Edilen), plus tests. Ledger contract (statement_order/trl_balance/type-map/single-model) preserved untouched — regression-proven by the pre-existing gate suite.

## 12–13. Tests & build (final gate at deploy SHA)
typecheck app+server exit 0 · **full suite 110 files / 1255 tests passed** · eslint 0 errors /15 warnings @cap15 · build green · bundle safeguard 334 files clean · targeted: handlers 56, customerLedger 25, invocation-gate matrix, reconciliation suites, write-api handlers, transaction-history — all green.

## 14. Commits
`72911f2` feat(sync): fail-closed execution-source gate · `f293c68` fix(mirror): KPI + isolation · `8449b2c` feat(sync): cheque deletion reconciliation + generic history refresh · `170ea69` docs(ledger): Phase 17 entry

## 15. Push
Pushed (no force) to `origin`; remote SHA verified equal to local.

## 16. Frontend deployment
VERIFIED — PRODUCTION: `python scripts/deploy_ftp.py --full` → **Uploaded 418 / Errors 0**; `erp.dayandisli.com` and `dayandisli.com` both serve the freshly built main chunk `index-C3MF46_N.js` containing the intended host + publishable key; bundle scan clean (no service-role material).

## 17. Edge Functions deployed (same SHA)
`parasut-write-api`, `parasut-api`, `parasut-sync-run` — each "Deployed Functions … " confirmed. NOT deployed (unmodified): `send-quotation-email`, `checks-api`, others.

## 18–19. Production manual-sync result
**BLOCKED — NOT PERFORMED.** No ERP admin credentials exist in this environment (`.env` carries only Paraşüt API + publishable keys; ERP login is email/password via Supabase Auth). Per §12/§18 the run STOPS here rather than bypassing authentication. Automatic sync left PAUSED. Operator steps: log into ERP as admin → CRM Müşteriler → click **Paraşüt ile Senkronize Et** (fires `parasut-write-api full-resync`) → expect summary dialog; server-side run appears in `parasut.sync_runs`.

## 20. PİNO parity (1011029161)
VERIFIED — PRODUCTION (mirror data layer, frozen since pause): **23 rows**; census 8/6/4/3/1/1 exact; debit **2,919,100.00**; credit **1,991,990.89**; newest-row closing **927,109.11** @2026-08-10; zero unknown types. Matches oracle digit-for-digit.

## 21. Other audited contacts
VERIFIED — PRODUCTION: BEKEM ÖZTEKNİK 1011029140 → 157,909.98 OK · MNG PLASTİK 1011029141 → 100,000.00 OK · TEKNİK İSTİF 1011029145 → 91,800.00 OK (ledger closing == contacts.trl_balance, == parent-observed figures).

## 22. Arbitrary-contact parity
VERIFIED — PRODUCTION: randomly selected **1018134551** (never used in design): 21 rows, 0 unknown types, Σdebit 601,200.00 − Σcredit 601,200.00 = closing 0 = card balance 0 → **PARITY-OK** (fully-settled account balancing exactly).

## 23. Screen/print parity
VERIFIED — TEST (single-model guarantee incl. print-blocking integrity gates). NOT VERIFIED — PRODUCTION (requires authenticated UI session; blocked per §19 above).

## 24. Security smoke tests (live production)
| Probe | Result |
|---|---|
| anonymous POST parasut-sync-run `{}` | **403 unauthorized_execution_source** (previously 200-paused) |
| forged `X-Sync-Trigger: scheduled`, no secret | **403 unauthorized_execution_source** |
| anonymous full-resync | **401** |
| anonymous transaction_history resync | **401** |
| browser direct parasut-schema access | guard-tested forbidden (RLS default-deny) |
| service-role/secret material in frontend bundle | CLEAN |

## 25. Remaining discrepancies
Ghost cheques remain mirrored (correct until first reconciled manual/scheduled checks sync archives them — now automatic on next complete snapshot); cheque-combining aggregates therefore still include them today. Two-clock disclosure on mixed screens unchanged (pre-existing).

## 26. NOT VERIFIED
Authenticated manual-sync end-to-end run (credentials blocker, §19); screen/print against live post-auth UI; cron-secret paused-response shape (secret not yet minted — operator step before any unpause); sync WRITE-path line-audit (pre-existing open item).

## 27. Rollback point
Pre-release remote state did not exist (first push of branch); rollback = redeploy prior frontend artifact + previous function versions via Dashboard/CLI from commit `18318da`. Automatic sync remains PAUSED throughout any rollback.
