# Final Engineering Report — Architecture Remediation

Branch: `remediation/architecture-stabilization` (from `main` @ `18eeed8`)
Period: 2026-08-25 (single-day remediation, Phases 0–16)
Terminal commit: `4d6b6d8`
Rules of engagement honored throughout: **no production deployment, no production migrations or secret changes, sync kept emergency-paused, no live Paraşüt writes, no real email sent, no FTP deploy.**

Ledger of record: `docs/architecture-remediation.md` (register fully reconciled against reality in Phase 16).

---

## 1. Completed Work

### P1 — Critical production safety
| Issue | Fix | Commit |
|---|---|---|
| 1A-1 Unbounded retry/checkpoint loop could re-fail a poisoned row every cron tick (suspected outage mechanism) | Persisted exponential-backoff ladder in `sync_runs.request_metadata.retry_governance`; circuit check BEFORE any side effect (`"circuit_open"` = zero Paraşüt/DB work); ladder keyed on the resource's resumable candidate so page-1-blocked chains are governed too; progress resets, completion closes, operator bypass flag; per-resource failure isolation at composition root | `9f7cfc2` |
| 1B-1 No sync health observability; paused state invisible | Pure model computing freshness/failure-streaks/circuit state/hung runners/staleness lag/pause visibility from one bounded ≤200-row query; attached to `parasut-api` `sync-status` behind existing authz; read-only, zero side effects while paused | `f8c2c29` |
| 1C-1 `send-quotation-email` open relay (no auth, no captcha, CORS `*`) | Gateway `verify_jwt=true` + in-function `erp_users` authorization, origin allowlist, strict validation (recipient caps, CRLF-stripped subject, PDF magic bytes, 10 MB ceiling, traversal-safe filenames), per-user rolling rate limit (20/5 min), audit logging without bodies. **Redeploy-gated — see Residual Risks R1.** | `f7ee036` |

### P2–P4 — CI, type safety, packaging, clients
- **2-1 / 2-2 (`413a432`)**: `typecheck:server` (strict) wired BLOCKING into CI — wiring surfaced and fixed 3 pre-existing test-file type errors. All 33 lint errors eliminated (incl. 21 precise `no-explicit-any` typings); lint made BLOCKING via `--max-warnings` ratchet, tightened **20→15** at reconciliation (`4d6b6d8`) after legacy deletions shrank debt.
- **3-1 (`4e9233a`)**: consolidated on npm; unused `bun.lockb` removed; `deno.lock` retained (legitimately pins Deno edge-function imports); `packageManager: npm@11.11.0`, `engines.node >=20`.
- **4-1 (`3dfe5e5`, completed `09dbdf4`)**: exactly ONE Supabase browser client module survives; dead SSR factories and both aliases deleted; static guard fails CI on any `createClient` outside the canonical file.

### P5 — Frontend data architecture
- **5A-1 (`6acb633` + `d5593ec`)**: 3,482-line `erpApi.ts` god-module investigated → only 2 functions used by live code → relocated verbatim → god-module DELETED with its last (dead) consumer. Outcome exceeded plan: deletion instead of compat layer.
- **5B-1 (`2b416c1`)**: query-key convention `[domain, entity-scope, permission-gate]` established; dashboard open-check reminders migrated to TanStack Query, byte-equal UI. **PARTIAL — see §2.**
- **5C-1 (`f05d70f`)**: all 84 browser-reached tables classified A–E with boundary policy (`docs/frontend-database-access-classification.md`). Verified: zero `parasut.*` refs from browser; checkout already an Edge Function.

### P6–P8 — Data-model generations
- **6-1 (`a06b813` + `2d53f97` + `d5593ec` + `96affb4`)**: full generation map + retirement strategy (`docs/database-generation-retirement.md`; includes the finding that orders/sales_orders are NOT duplicates). Legacy customer-table readers proven unreferenced and deleted; writes to retired generations frozen by guard tests.
- **7-1 (`09dbdf4`)**: dual quote system resolved — routed `features/sales` (quotes-family, security-definer numbering) confirmed authoritative; unrouted legacy `features/quotation/**` (17 files) deleted; historical data preserved; hardened email function kept for future adoption.
- **13-1 (`4f0d045`)**: gen-1 `public.parasut_*` mirror proven dead via dependency scan; review-gated retirement migration prepared under `supabase/migrations-proposed/` (aborts on dependencies, archives rows first, idempotent, can never auto-apply). **NOT executed, by design.**

### P9–P10 — Financial engine consistency (highest-care area)
- **9-1 (`b348607`)**: cross-boundary contract tests prove decimal-math equivalence between the three runtimes (one fixture vector set through BOTH implementations); balance tolerance promoted to named `BALANCE_TOLERANCE` in both boundaries, pinned identical — zero behavior change. Row-type consolidation explicitly DEFERRED (intentional per-runtime separation; churn > benefit).
- **10-1 (`0f71e8c`)**: single canonical `DEFAULT_RESOURCE_ORDER` (= production cron order, production-verified 2026-08-23) consumed by CLI plans, local runner and cron alike; divergence-guard test statically pins them — silent drift now fails CI.

### P11–P12 — Dead code & repo hygiene
- **11-1 (`d5593ec` + `72555b0`)**: every verified-dead target deleted after individual proof — calculator mini-app, admin suite (+ its nav registry), Kargo (runtime-broken: read locale keys that existed nowhere), duplicate pages, old_scripts ×17, prototypes/mockups/transcripts, zero-importer shadcn components; orphaned deps dropped; audit reports relocated to `docs/audits/`. All preserved in git history.
- **12-1 / 12-2 (`ff3ff4e`)**: CLI machine state untracked + ignored; `docs/manual-sql-reconciliation.md` gives authoritative per-file SQL status; rule set: no new manual SQL.

### P14–P15 — Deployment readiness & regression guards
- **14-1 (`b893f8d`)**: full deploy/rollback runbook (`docs/deployment-and-rollback.md`) + release-manifest tooling pinning commit SHA, tool versions, dirty-tree flag, per-file SHA-256. No deploy performed.
- **15-1 (`3dfe5e5`, `0f71e8c`, `96affb4`)**: every mandated architecture guard exists and runs in CI — client sprawl, statement/transaction bypass, retired-generation caller freeze (caught 4 live violations on introduction), Paraşüt write-path singularity, SMTP relay closure, emergency-pause fail-safe default, resource-order divergence, bundle secrets/demo. Reverting any guarded phase now fails CI.

### Phase 16 — Register reconciliation (`4d6b6d8`)
All register rows re-verified against their phase commits AND the current tree before status change; 14 rows closed with evidence annotations; 5B-1 honestly kept OPEN/partial.

---

## 2. Remaining OPEN Item

**5B-1 — React Query adoption beyond conventions (PARTIAL, intentionally left open)**
Done: key convention documented, second adoption domain (dashboard open-checks) migrated with identical rendered output.
Not done: reports domain still uses ad-hoc loading/error handling.
Disposition: pure maintainability item, zero correctness/financial risk; recommended to adopt opportunistically when the reports surface next needs data-fetching work rather than as a dedicated churn pass. Everything else in the register is FIXED; remaining actions are operator-gated (§6), not engineering debt.

---

## 3. Verification Evidence (all commands re-run at terminal commit `4d6b6d8`, 2026-08-25)

| Check | Command | Baseline (Phase 0) | Final |
|---|---|---|---|
| App typecheck | `npm run typecheck` | ✅ PASS | ✅ PASS (exit 0) |
| Server typecheck | `npm run typecheck:server` | ❌ FAIL — 3 errors | ✅ PASS (exit 0), **CI-blocking** |
| Unit tests | `npm test` | ✅ 105 files / 1239 tests | ✅ **109 files / 1231 tests** (net −8 = deleted dead-suite tests outweigh new guards; every removal individually proven) |
| Production build | `npm run build` (vite + nest-erp-build + safeguard) | ✅ 334 files | ✅ PASS (exit 0), safeguard scanned 334 files, no forbidden markers |
| Lint | `npx eslint . --max-warnings 15` | ❌ FAIL — 56 problems (32 E / 24 W), non-blocking in CI | ✅ exit 0 — **0 errors / 15 warnings**, **CI-blocking** at cap 15 (all remaining: react-refresh notices on shadcn primitives/providers) |

CI pipeline (`quality.yml`) order: install → typecheck (frontend) → typecheck (server) → test → build → lint (ratcheted). All gates blocking.

---

## 4. Commit List (chronological, `main..HEAD`)

| # | Commit | Phase | Summary |
|---|---|---|---|
| 1 | `9f7cfc2` | 1A | Retry governance: bound zero-progress loops via persisted backoff ladder |
| 2 | `f8c2c29` | 1B | Machine-readable sync-health snapshot on `sync-status` |
| 3 | `f7ee036` | 1C | Close quotation-email open relay |
| 4 | `413a432` | 2 | Server typecheck in CI; ratchet lint to zero errors |
| 5 | `4e9233a` | 3 | Consolidate on npm; drop bun.lockb; pin packageManager/engines |
| 6 | `3dfe5e5` | 4 | One canonical Supabase browser client + guard test |
| 7 | `6acb633` | 5A | Extract live auth API surface from erpApi god-module |
| 8 | `2b416c1` | 5B | Migrate open-check reminders to TanStack Query |
| 9 | `f05d70f` | 5C | Classify all 84 browser-reached tables A–E |
| 10 | `a06b813` | 6 | Full DB generation map + retirement strategy (planning-only) |
| 11 | `09dbdf4` | 7 | Remove orphaned legacy quotation feature; quotes family canonical |
| 12 | `2d53f97` | 8 | parties canonical — remove dead legacy service bridge |
| 13 | `b348607` | 9 | Cross-boundary contract tests for money + staleness primitives |
| 14 | `0f71e8c` | 10 | One canonical sync resource order — CLI matches production cron |
| 15 | `d5593ec` | 11 | Remove verified-dead trees/junk/orphaned deps; erpApi deleted |
| 16 | `72555b0` | 11+ | Relocate audit reports to docs/audits/ |
| 17 | `ff3ff4e` | 12 | Untrack CLI machine state; reconcile manual SQL |
| 18 | `4f0d045` | 13 | Gen-1 public mirror retirement prep (guarded, review-gated) |
| 19 | `b893f8d` | 14 | Deploy + rollback runbook; release manifest tooling |
| 20 | `96affb4` | 15 | Enforce write-path singularity, relay closure, legacy-table freeze |
| 21 | `4d6b6d8` | 16 | Register reconciliation vs phases 2–15; lint ratchet 20→15 |

---

## 5. Residual Risks

| # | Risk | Severity | Mitigation / Status |
|---|---|---|---|
| R1 | **SMTP relay hardening is dormant in production** until Supabase edge functions are redeployed — the vulnerable function version is still what production runs | HIGH until redeploy | Zero active callers exist (sole invoker deleted with legacy quotation feature), so practical attack surface is limited; closure activates on first redeploy (§6, action 2) |
| R2 | Sync-engine behavior changes (retry governance, canonical order, health model) have never run against live Paraşüt — they activate only when sync is re-enabled | MEDIUM | Emergency-pause default is fail-safe PAUSED and guard-tested; circuit breaker returns `"circuit_open"` before any side effect; observe first cron ticks post-unpause (§7, step 5) |
| R3 | Dead gen-1 `public.parasut_*` tables remain in prod schema until the prepared migration is hand-executed | LOW | Guarded migration aborts on any live dependency and archives rows before drop; cannot auto-apply |
| R4 | Two schema files remain APPLIED-NOT-IN-MIGRATIONS — schema partially outside migration control | MEDIUM-HIGH (longstanding) | Documented in `docs/manual-sql-reconciliation.md` as top reconciliation targets; rule "no new manual SQL" in force |
| R5 | Publishable-key literal embedded in cron migration history `20260811120000:51` | LOW (publishable by design) | Recorded for rotation at next natural secret-rotation window; deliberately NOT changed during remediation |
| R6 | 15 lint warnings remain (react-refresh on shadcn primitives/context providers) | COSMETIC | Capped and shrinking-by-policy; no runtime impact |
| R7 | Reports domain still ad-hoc data fetching (open item 5B-1) | LOW | Maintainability only; no correctness or financial impact |
| R8 | Node skew: CI on 20, local dev on 24 | LOW | `engines.node >=20` pinned; suite green on both |

---

## 6. Operator-Gated Actions (explicitly NOT performed during remediation)

1. **Push / merge branch to `main`** — owner review required (21 commits above).
2. **Redeploy Supabase edge functions** (`parasut-api`, `parasut-sync-run`, `send-quotation-email`) — activates 1C hardening + the sync-run composition-root/retry/health changes. Highest-priority action because of R1.
3. **Un-pause Paraşüt sync** — only after step 2 and a post-deploy health check; remove pause flag deliberately, watch first cron invocation for governance stamping + closed circuit.
4. **Review and hand-execute `supabase/migrations-proposed/retire_public_parasut_gen1.sql`** in a maintenance window, after parity checks; it aborts on dependencies and archives rows first, but execution is a human decision.
5. **Reconcile the two APPLIED-NOT-IN-MIGRATIONS schema files** into migration control.
6. **Rotate the publishable-key literal** at the next natural secret-rotation window.

---

## 7. Production Rollout Order (per `docs/deployment-and-rollback.md`)

1. Merge/push branch; confirm CI green on `main` (all six gates).
2. Build ONCE from the release commit; generate `dist/release-manifest.json` via `scripts/make-release-manifest.mjs` (commit SHA + per-file SHA-256); ship the frozen artifact via the existing FTP path.
   *Frontend changes carry zero DB/schema coupling — safe first.*
3. Redeploy the three edge functions (action 2 above). Sync stays paused; `parasut-sync-run` changes remain dormant until unpause.
4. Post-deploy verification: statement parity spot-check + read `sync-status` health snapshot (read-only); confirm quotation-email rejects unauthenticated/foreign-origin probes.
5. Soak period (recommended ≥24 h) watching abuse/rate-limit logs — expect silence (function currently has zero callers).
6. Un-pause sync (action 3): watch first cron tick end-to-end — expect accounts-first ordering, retry-governance metadata stamped, circuit closed, health snapshot populated.
7. Later, separately and deliberately: execute the retirement migration (action 4) during a maintenance window, followed by schema-file reconciliation (action 5) and key rotation (action 6).

---

## 8. Rollback Plan

| Layer | Procedure |
|---|---|
| Frontend artifact | Redeploy previous frozen `dist/` + its manifest (build-once rule means the prior artifact is verifiable by checksum) |
| Source regression | Per-phase `git revert <hash>` — every phase was independently revertible by design (see Regression-risk column per register row); architecture guards will flag if a revert re-opens a guarded violation, which is the intended signal |
| Edge functions | Redeploy prior tagged function version; gateway JWT config rolls back with it (returns relay exposure — do only if the hardened path itself malfunctions) |
| Database | **Never auto-rolled-back.** Retirement migration is abort-on-dependency, archives rows to dated side tables pre-drop, idempotent — recovery = restore archived tables |
| Sync engine | Fail-safe default is PAUSED: any doubt → re-set pause flag; `"circuit_open"` status and bypass flag allow operator-controlled resync without code rollback |
| Financial primitives | Contract tests pin cross-boundary equivalence; any rollback of `b348607` removes the tripwire but changes no runtime behavior (values byte-equal before/after) |

---

*Report generated at reconciliation commit `4d6b6d8`. Ledger: `docs/architecture-remediation.md`. Runbook: `docs/deployment-and-rollback.md`. SQL reconciliation: `docs/manual-sql-reconciliation.md`.*
