# Paraşüt sync engine — resumable, page-batched design

This documents the fix for large `parasut.*` mirror syncs (`sales_invoices`, `purchase_bills`, previously also `products`) being killed mid-run by the platform's Edge Function execution timeout, leaving `parasut.sync_runs` rows stuck in `status = "running"` forever and blocking every subsequent attempt via `SyncAlreadyRunningError`.

## Root cause (confirmed via read-only production investigation, see prior session)

- `syncCollection` (`server/parasut/sync-base.ts`) looped through **every** page of a resource in a single Edge Function invocation, with no bound.
- `sales_invoices`/`purchase_bills` are fetched with `include: [...]` relationship expansion — each page is far heavier than a bare list page — combined with real record volumes (436/767 parents, 1,347/1,807 detail rows), this reliably exceeded the invocation's execution budget.
- The resumable/recovery primitives (`sync-checkpoint.ts`, `sync-resume-policy.ts`, `sync-run-recovery.ts`) already existed, fully unit-tested — but were **never wired into `syncCollection`**, so none of it took effect in production.

## Chunking strategy (Phase 2/5)

`SyncResourceOptions.maxPagesPerInvocation` bounds how many pages a single invocation fetches before it stops, persists a `"partial"` run with `hasMore: true`, and returns — the caller (the frontend's continuation loop, see below) invokes `resync` again, which resumes from the checkpoint.

| Resource | `maxPagesPerInvocation` | Why |
|---|---|---|
| `sales_invoices` | 2 | `include: ["contact","details","payments"]` — heaviest per-page cost; the resource that was actually failing |
| `purchase_bills` | 2 | `include: ["supplier","spender","details","payments"]` — same reasoning |
| `products` | 8 | No include-expansion, but 2,484 rows (~100 pages) and had its own orphaned "running" row historically |
| `accounts` | 10 | Trivially small (3 rows) — generous bound purely for defensive consistency |
| `contacts` | 20 | No include-expansion; proven, consistent 18-page/435-record completions. Bounded anyway for safety margin, at no behavioral cost today |

No two-stage parent/detail fetch was implemented (Phase 5's "or use smaller page sizes when includes are required" alternative was chosen instead) — Paraşüt's `include` parameter already returns details/payments/contact in the *same* paginated response as the parent (`document.included`), so there is no separate child-fetch step to split; the existing `storeIncluded()` already persists included detail/payment rows per page, independent of whether the parent's own upsert for that page succeeds or fails (per-resource `try/catch` inside the page loop, unchanged). Bounding the page count per invocation was the correct, minimal fix for this API shape.

## Checkpoint contract (Phase 3)

Unchanged from the pre-existing (but previously unused) design in `sync-checkpoint.ts`/`sync-resume-policy.ts`:

- Every `sync_runs.request_metadata.resume` object carries: `contract_version`, `source_run_id`, `resource_type`, `endpoint`, `include`, `page_size`, `last_completed_page`.
- `advanceCheckpointMetadata()` is called, and `persistCheckpoint()` (an `UPDATE ... WHERE status='running'`) is awaited, **only after** a page's records are fully upserted — never before.
- On the next `resync` call, `findLatestResumableRun()` (new, `sync-base.ts`) fetches the most recent `"failed"` or `"partial"` run for the exact `(company, resource)`; `decideSyncResume()` (existing, now wired in) re-validates the source run's identity and request fingerprint (endpoint/include/page_size must match exactly) before trusting it, and computes `startPage = last_completed_page + 1`. Any mismatch or invalid/missing checkpoint safely falls back to `startPage = 1` ("restart").
- `getPaginated()` (`server/parasut/client.ts`) gained a `startPage` parameter so a resumed run actually skips already-committed pages instead of re-fetching them (still safe either way, since every upsert is idempotent — this is a performance/rate-limit improvement, not a correctness requirement).

## Stale-run recovery (Phase 4)

`recoverStaleRuns()` (existing, now called at the top of every `syncCollection` invocation, company-scoped) was fixed in two ways:

1. **Heartbeat, not `started_at`.** The stale check now uses `updated_at < cutoff` instead of `created_at < cutoff`. `parasut.sync_runs` already has an `erp_set_updated_at` trigger firing on every `UPDATE` (confirmed via migration `20260713120000_parasut_mirror_schema_foundation.sql`), so `updated_at` is touched by every `persistCheckpoint`/`completeRun` call — a long-lived run that's still actively checkpointing is never mistaken for stale, only a genuinely dead one (no progress for the full threshold) is.
2. **Recovered as `"partial"`, not `"failed"`.** `decideSyncResume()` treats `"partial"` as immediately resumable (clean checkpoint, no drift-risk gate); `"failed"` requires `acceptPageDriftRisk`. A recovered run's checkpoint is exactly as trustworthy as a clean bounded stop, so it gets the same treatment. `recoveryMetadata()` also now prefers the dead run's own `request_metadata.resume.last_completed_page` (kept current by every checkpoint persist) over `page_count` (only ever written once, by `completeRun`, which never ran for a run stuck in `"running"`).

This call is best-effort/non-fatal (wrapped in `try { } catch { }`) — a database double that doesn't implement `.is()`/`.lt()` (as in this repo's existing hand-rolled test fakes) degrades to "no stale runs recovered" rather than breaking the sync itself. In production, the real Supabase client always supports these calls.

## Reconciliation safety (Phase 10)

Reconciliation (`reconcileMissingResources`) only ever runs when a run finishes with `status === "completed"` **and** `hasMore === false` — never for a bounded partial stop, a run with any page error, or a run still mid-chain.

The trickier correctness issue: a run that *resumes* across several invocations and *then* reaches natural completion must not archive records it never re-observed simply because they were only seen by an *earlier* invocation in the same logical chain (an in-memory "observed this invocation" set would be wrong here). Fixed by using `last_seen_at` (already stamped on every insert/update by `upsertResource`, unconditionally) as a durable, cross-invocation watermark instead: `chain_started_at` is set once, on the very first invocation of a logical run, and carried forward unchanged through every resume (stored in `request_metadata.chain_started_at`). Reconciliation compares each previously-active mirror row's `last_seen_at` against `chain_started_at` — a row touched by *any* invocation in the chain (this one or an earlier one) is correctly counted as observed; only rows the whole chain never touched are archive candidates. Combined with the existing `evaluateReconciliationEligibility()` ratio guard (skips archival if the observed set looks suspiciously small relative to what was previously active), this is safe by construction — reconciliation is never a race with itself across invocations.

## Error observability (Phase 6)

`enforceSingleRunner()`'s call moved from *before* `syncCollection`'s `try` block to *inside* it. A lost concurrency election (`SyncAlreadyRunningError`) now flows through the same `catch` that already calls `recordError()` (writes a sanitized diagnostic to `parasut.sync_errors`) and `completeRun(..., "failed")`, instead of bypassing both entirely as before — this is why `parasut.sync_errors` was empty even for `"failed"` runs prior to this fix.

## API response contract (Phase 7)

`parasut-write-api`'s `resync` action already converted `SyncAlreadyRunningError` into a proper `409` with a clear Turkish message (`handleResync`/`index.ts` — this part was already correct, contrary to initial assumption; the generic "Edge Function returned a non-2xx status code" the user saw came from the *unrecoverable platform-timeout kill itself*, which no `catch` block can ever see — exactly what bounded batching prevents structurally). `ResyncContactsResponse` gained `hasMore`, `resumed`, `pagesProcessedThisInvocation`, `totalPagesProcessed`, and `resumeAfterSeconds` so the frontend can show real progress instead of a single opaque result.

## Frontend continuation (Phase 8)

`SyncButton` (`CanonicalParasutPages.tsx`) now loops client-side: while `response.hasMore`, show a progress message ("kaldığı yerden sürdürüldü" on the first resumed batch, "N sayfa işlendi, devam ediliyor" otherwise), wait `resumeAfterSeconds`, and call `resync` again — capped at `MAX_CONTINUATIONS_PER_CLICK = 60` invocations per click (never an infinite loop; hitting the cap is a soft stop, not a failure, since the server-side checkpoint remains valid for the next click). Query-cache invalidation happens only once, after the *final* completing batch — not after every intermediate partial batch. A 409 ("zaten devam ediyor") stops the loop immediately with an informational toast rather than being treated as a failure. No CSS classes or button markup changed — only the button's dynamic label text and internal async logic.
