# Phase 4 Result

## Created Files

- `docs/PHASE_4_PARASUT_SYNC_ENGINE.md`
- `docs/phase-results/PHASE_4_RESULT.md`
- `scripts/run-parasut-sync-local.mjs`
- `server/parasut/auth.ts`
- `server/parasut/client.ts`
- `server/parasut/sync-accounts.ts`
- `server/parasut/sync-base.ts`
- `server/parasut/sync-contacts.ts`
- `server/parasut/sync-engine.test.ts`
- `server/parasut/sync-products.ts`
- `server/parasut/sync-purchase-bills.ts`
- `server/parasut/sync-sales-invoices.ts`
- `server/parasut/types.ts`
- `server/parasut/upsert-resource.ts`
- `tsconfig.server.json`

## Modified Files

None of the files that existed before Phase 4 were modified.

## Implementation

The local-only server adapter now supports OAuth acquisition and refresh,
read-only GET requests, bounded pagination, exponential retry and rate-limit
handling, canonical payload hashing, idempotent mirror upserts, sync-run
metadata, and sanitized error records.

Top-level resources:

- contacts
- products
- sales invoices
- purchase bills
- accounts

Confirmed included resources:

- payments
- sales invoice details
- purchase bill details

## Local Sync Validation

All five top-level resources completed against local Supabase only. Completed
second passes reported:

| Resource | Pages | Observed | Unchanged | Errors |
| --- | ---: | ---: | ---: | ---: |
| contacts | 17 | 417 | 417 | 0 |
| products | 96 | 2,378 | 2,378 | 0 |
| sales invoices | 17 | 2,395 | 2,395 | 0 |
| purchase bills | 29 | 3,165 | 3,165 | 0 |
| accounts | 1 | 3 | 3 | 0 |

Observed invoice totals include confirmed included resources. The second pass
inserted no records, providing local idempotency evidence. Mocked tests prove
that a changed payload hash replaces the stored source snapshot.

The initial combined command was terminated by its command-session timeout
during purchase-bill processing. Separate purchase-bill and account executions
then completed successfully. A force-terminated process may leave a local
sync-run row in `running` status.

## Validation Results

- `npm run typecheck`: passed
- `npm run test`: passed, 6 files and 139 tests
- `npm run build`: passed
- `npx tsc -p tsconfig.server.json`: passed
- `npx eslint server/parasut scripts/run-parasut-sync-local.mjs`: passed
- `npm run lint`: failed on the existing repository backlog with 32 errors and
  40 warnings; no focused Phase 4 lint findings

## Production Status

Production was not contacted or modified. No remote migration was run. No
Paraşüt write endpoint was called. No commit or push was performed.

## Remaining Unknowns

- A durable scheduler and production-safe secret boundary are not designed.
- Incremental cursors and resumable page checkpoints do not exist.
- Process interruption recovery for stale `running` sync runs is not automated.
- Full-scale performance currently uses per-resource lookup and write calls.
- Included-resource deletion or disappearance semantics need a retention policy.
- Paraşüt rate-limit headers and long-running production throughput need
  controlled staging evidence.

## Exact Phase 5 Prompt

```text
# PHASE 5 — HARDEN PARASUT SYNC OPERATIONS AND RESUME MODEL

Read and strictly follow docs/ENGINEERING_CONSTITUTION.md and the Phase 0-4
Paraşüt mirror documents and result files.

Scope is design and local-only implementation for operational hardening.

Implement:
- stale sync-run recovery
- resumable per-resource page checkpoints
- explicit full-sync versus incremental-sync contracts
- bounded batch concurrency without changing payload meaning
- deterministic deletion/disappearance observation metadata
- mocked tests for interruption, resume, retries, and partial failures
- local-only validation against the existing mirror tables

Do not map mirror data into ERP domains.
Do not call Paraşüt write endpoints.
Do not apply remote migrations or modify production.
Do not commit or push.
Keep documentation and code in English and user-facing UI in Turkish.

Create:
- docs/PHASE_5_PARASUT_SYNC_OPERATIONAL_HARDENING.md
- docs/phase-results/PHASE_5_RESULT.md

Export only Phase 5 created or modified files using the phase export rule.
```
