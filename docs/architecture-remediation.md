# Architecture Remediation Ledger

Branch: `remediation/architecture-stabilization` (from `main` @ `18eeed8`)
Started: 2026-08-25
Rules of engagement: no production deployment, no production migrations/secrets changes, sync stays emergency-paused, no live Paraşüt writes, no real email, no FTP deploy. Financial behavior is frozen except for verified bugs.

---

## Phase 0 — Baseline (2026-08-25)

Environment:

| Item | Value |
|---|---|
| Node | v24.14.1 |
| npm | 11.11.0 |
| Python | 3.14.6 (deploy_ftp.py only) |
| Git | 2.53.0.windows.2 |
| Package manager in use | npm (CI: `npm ci`; DEPLOY bat: `npm install`; node_modules present from npm) |
| Lockfiles tracked | `package-lock.json`, `bun.lockb`, `deno.lock` (bun unused by any tooling) |

Working tree at start: 3 modified `supabase/.temp/*` machine-state files (tracked CLI state), 3 untracked audit report markdowns. No source modifications.

Baseline suite results (all run locally before any change):

| Check | Command | Result |
|---|---|---|
| App typecheck | `npm run typecheck` (`tsc -p tsconfig.app.json`) | ✅ PASS |
| Server typecheck | `npx tsc -p tsconfig.server.json --noEmit` | ❌ FAIL — 3 errors, all in test files (`upsert-resource-balance.test.ts:235`, `upsert-resource-typed-mapping-remaining.test.ts:298`, `upsert-resource-typed-mapping.test.ts:149`: `string` not assignable to `MirrorTable`) |
| Unit tests | `npm test` (vitest) | ✅ PASS — 105 files / 1239 tests, ~60s |
| Production build | `npm run build` (vite + nest-erp-build + bundle safeguard) | ✅ PASS — safeguard scanned 334 files, no forbidden markers |
| Lint | `npm run lint` | ❌ FAIL — 56 problems (32 errors, 24 warnings); reason CI uses `continue-on-error` |

CI config inspected: `.github/workflows/quality.yml` — node20, `npm ci`, typecheck (app only), vitest, build; lint non-blocking; **no deploy job**.

---

## Issue Register

Status vocabulary: OPEN → IN_PROGRESS → FIXED → DEFERRED (with reason) → WONTFIX (with justification).

### P1 — Critical production safety

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 1A-1 | Suspected unbounded retry/checkpoint loop can re-fail a poisoned row every cron tick with zero backoff (suspected outage mechanism, 2026-08-24 Auth outage) | CRITICAL | per-record error path counts errors but has no invocation-level retry budget/circuit breaker; resume policy can re-enter same page repeatedly across invocations | `server/parasut/sync-base.ts`, `server/parasut/sync-retry-governance.ts` (NEW), `supabase/functions/parasut-sync-run/index.ts` | **FIXED (9f7cfc2)**: persisted exponential-backoff ladder in sync_runs.request_metadata.retry_governance; circuit check BEFORE any side effect returns status "circuit_open" (zero Paraşüt/DB work); ladder attaches to the resource's resumable candidate regardless of resume-vs-restart (page-1-blocked chains restart, so both loops are governed); progress resets ladder; completion closes it; bypass flag for operator resyncs. Composition root: per-resource failure isolation — election losses/engine throws/threshold breaches no longer starve remaining resources or 500 the invocation. | FIXED | 18 new tests incl. incident-mechanism reproduction, containment at same-instant retry, doubling delay, self-healing after fault clears, healthy-backlog non-throttling; 5 checkpoint-failure tests re-anchored to real invariant (checkpoint never advances past failed page) | LOW-MED — sync still emergency-paused; engine behavior changes activate only on re-enable | git revert 9f7cfc2 |
| 1B-1 | No sync health observability; paused state invisible to operators; staleness drift undetectable while paused | HIGH | health only inferable from sync_runs rows; no machine-readable status surface | `server/parasut/sync-health.ts` (NEW), `supabase/functions/parasut-api/{handlers,index}.ts` | **FIXED (f8c2c29)**: pure model computing per-resource freshness/failure-streaks/retry-circuit state/hung runners/statement-refresh lag/pause visibility from one bounded 24h window query (≤200 rows); attached to parasut-api `sync-status` response behind existing `parasut.sync.view` authz; pause flag read from shared project secret (no writes from paused runner). Machine-readable JSON contract; UI surface deferred until a routed admin page exists (features/admin is dead code). | FIXED | 9 pure-model tests + 2 handler integration tests (company scoping, pause override) | LOW | git revert f8c2c29 |
| 1C-1 | `send-quotation-email`: no auth, no captcha, CORS `*` → open SMTP relay abuse vector | CRITICAL | function written before hardening pass that contact form received | `supabase/functions/send-quotation-email/{index,validation,validation.test}.ts`, `supabase/config.toml` | **FIXED (f7ee036)**: gateway verify_jwt=true + in-function active erp_users authorization (bare JWT from a shop customer is insufficient), origin allowlist (incl. erp subdomain), strict validation (recipient caps/format, CRLF-stripped subject cap, PDF magic-byte check, 10 MB ceiling, filename sanitization incl. traversal neutralization), per-user rolling rate limit (20/5min, per-instance), structured audit logging without bodies/recipient lists. Requires edge-function redeploy to take effect. Verified: zero active frontend callers today (only invoker is orphaned legacy quotation feature). | FIXED | 14 abuse/security tests running the exact production validator | LOW (no active callers; redeploy-gated) | git revert f7ee036 |

### P2 — CI and type safety

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 2-1 | CI never typechecks `server/` (strict config exists but unreferenced); baseline server check FAILS today | HIGH | root tsconfig solution file omits tsconfig.server.json; package.json typecheck script covers app only | `package.json`, `.github/workflows/quality.yml`, 3 test files with real type errors | fix 3 test-file errors; add `typecheck:server` script; | FIXED | tsc itself is the test | LOW | revert workflow/script change |
| 2-2 | Lint non-blocking; 32 errors/24 warnings debt; `no-unused-vars` disabled | MEDIUM | historical debt + deliberate disable during rapid AI-assisted development | `eslint.config.js`, various sources | **FIXED (413a432)**: all errors eliminated (21 `no-explicit-any` sites typed precisely, plus prefer-const/require-yield/no-useless-escape/unused-directives); lint now BLOCKING in CI via `eslint . --max-warnings 20` — new violations fail, baseline only shrinks. Ratchet tightened to 15 (2026-08-25 reconciliation): hook-deps warnings vanished with the legacy components deleted in Phases 7/11; remaining 15 are react-refresh notices on shadcn primitives/providers. Verified today: exit 0, 0 errors / 15 warnings. | eslint exit codes | LOW | revert workflow/config |

### P3 — Package/build consistency

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 3-1 | Three lockfiles (npm/bun/deno), no `packageManager` pin; bun.lockb unused drift risk | MEDIUM | scaffold history; deno.lock partially legit (edge functions import maps) | `package.json`, `bun.lockb`, `deno.lock`, docs | **FIXED**: verified zero tooling references to bun (workflows/bat/scripts) → `bun.lockb` removed; `deno.lock` KEPT — it legitimately pins esm.sh/npm Deno imports for edge functions; `packageManager: npm@11.11.0` + `engines.node >=20` pinned (CI uses node 20, local 24). | FIXED | clean install+build+test in CI on every push | LOW | git revert |

### P4 — Supabase client consolidation

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 4-1 | Client definitions: canonical `integrations/supabase/client.ts` + alias `lib/supabase.ts` + dead SSR factories `lib/client.ts`, `lib/server.ts`; `lib/supabaseClient.ts` deleted with Kargo (Phase 2 commit) | MEDIUM | Lovable scaffold + copy-paste aliasing during refactors | those files + orphaned importers | **FIXED (3dfe5e5 + 09dbdf4)**: dead SSR factories (`lib/client.ts`, `lib/server.ts`) and competing counters deleted; `supabaseClient.ts` alias gone (413a432); `lib/supabase.ts` deprecated then deleted together with its only consumer, the legacy quotation feature (Phase 7). Exactly ONE canonical client module remains, enforced by static guard `src/lib/architecture-supabase-client.test.ts` — any new createClient outside it fails CI. | grep + architecture guard test (Phase 15) | LOW | revert |

### P5 — Frontend data architecture

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 5A-1 | `features/erp/shared/erpApi.ts` god-module (3,405 lines, ~150 exports) | MEDIUM | accretion | erpApi.ts + all importers | **FIXED (6acb633 + d5593ec)**: investigation found only 3 importers — the 2 live ones use exactly 2 functions (`getCurrentERPUser` relocated verbatim to `shared/auth.ts`; `createAuditLog` already in `api/internal`), and the third was the dead admin suite. God-module DELETED in Phase 11 once that last consumer went; outcome exceeded plan (deletion instead of compat re-export layer). Guard test prevents auth code regressing onto it. | existing suite + route tests + guard | MED (broad import graph) → resolved | revert per-commit |
| 5B-1 | React Query vestigial (1 hook); ad-hoc loading/error everywhere | MEDIUM | historical | high-value pages first | OPEN (partially fixed 2b416c1): query-key convention established `[domain, entity-scope, permission-gate]` and dashboard open-check reminders migrated as second adoption domain, byte-equal UI. Reports domain still ad-hoc — adopt opportunistically when that surface next needs data-fetching work. | targeted component tests | LOW-MED | revert per-domain |
| 5C-1 | 86 tables hit directly from browser | MEDIUM | Supabase-direct architecture | classification doc + selected moves | **FIXED (f05d70f)**: all 84 browser-reached tables classified A–E with boundary policy in `docs/frontend-database-access-classification.md`. Verified zero `parasut.*` references from src (authoritative statement boundary holds); checkout already an Edge Function; platform/user-admin surfaces existed only in the dead admin suite (removed Phase 11). No unjustified direct hits requiring immediate moves; near-term move list documented. | per-move tests + static scan | MED → resolved | revert per-move |

### P6/P7/P8 — Data model generations

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 6-1 | Customer generations coexist: `parties` (canonical per manual SQL) vs `stakeholders` vs `customer_full/customers_full` bridge vs `customer_profile` | HIGH | successive rebuilds without retirement | customerFullService.ts, crm feature, seed, migrations | **FIXED (a06b813, 2d53f97, d5593ec, 4f0d045, 96affb4)**: full generation map + retirement strategy in `docs/database-generation-retirement.md` (incl. the finding that orders/sales_orders are NOT duplicates); legacy runtime readers deleted after import-graph proof (Phase 8 removed the dual-read bridge; Phase 11 removed remaining dead-suite mentions); writes to retired generations now frozen by `src/architecture-data-boundaries.test.ts` (Phase 15); guarded DROP migration prepared, review-gated, never auto-applied (`supabase/migrations-proposed/`). Tables themselves untouched per plan. | parity checks documented + guard tests | HIGH area → completed read-only-first as planned | n/a |
| 7-1 | Dual quote systems: `features/quotation` (legacy, unrouted, `quotations*` tables) vs `features/sales` (`quotes*` tables, routed) | MEDIUM | rebuild without decommission | features/quotation/**, features/sales/** | **FIXED (09dbdf4)**: authoritative = features/sales confirmed (routed `/apps/sales/quotes*`, quotes-family tables with security-definer numbering, grants fixed 20260815090000). Legacy `features/quotation/**` (17 files) deleted — unrouted, self-importing only, sole caller of send-quotation-email. Historical quotation DATA preserved; numbering/lifecycle mapping covered by the Phase 6 generation map. Hardened edge function kept for future sales-flow adoption. | route tests + suite | MED (PDF/email flows) → resolved with zero live callers | git revert / history retains |
| 13-1 | Dead `public.parasut_*` mirror generation still in prod schema | MEDIUM | superseded July 2026, never dropped | migration prep only | **FIXED (4f0d045)**: static dependency scan proves gen-1 tables referenced only by their own creation migration, generated types, comments, and four env-gated LOCAL-only scripts (deleted). Reviewable retirement migration `retire_public_parasut_gen1.sql` prepared under `supabase/migrations-proposed/`: aborts on live view/FK/function deps, archives rows to dated side tables, idempotent, can never auto-apply. DO NOT execute honored. Also fixed real bug: local runner counted rows against dead public schema while syncs write schema parasut. | static dependency scan | LOW until executed | n/a |

### P9/P10 — Shared logic & engine consistency

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 9-1 | Decimal math duplicated (server/erp/decimal.ts vs _shared/parasut-metrics.ts); staleness rule duplicated (frontend customerLedger.ts 0.005 vs sync-statement-staleness.ts 0.005); row types ≥3 places | MEDIUM | runtime boundaries (Deno fn / browser / engine) | see files | **FIXED (b348607), with recorded exception**: cross-boundary contract tests now prove equivalence instead of blind merging — one fixture vector set (canonical decimals, negatives, >2-digit fractions, Turkish-locale strings that MUST NOT parse, junk, scale overflow, huge sums) runs through BOTH decimal implementations; balance tolerance promoted to named `BALANCE_TOLERANCE` in both boundaries, pinned identical + behaviorally checked (values unchanged, byte-equal behavior). Row-type consolidation explicitly DEFERRED: intentional per-runtime separation, churn>benefit (documented in commit). | contract tests (`server/erp/decimal-contract.test.ts`) | FINANCIAL — highest care → zero behavior change | revert |
| 10-1 | Resource-order divergence: CLI execution-plan omits `checks`; production cron includes it | MEDIUM | two composition roots drifted | server/parasut/execution-* family, supabase/functions/parasut-sync-run/index.ts | **FIXED (0f71e8c)**: cron order declared authoritative (production-verified 2026-08-23); `DEFAULT_RESOURCE_ORDER` in sync-execution-plan.ts now equals it exactly; all runners (CLI plans, local runner, cron) consume the one constant. Divergence-guard test statically extracts the cron's RESOURCE_ORDER from parasut-sync-run/index.ts and pins it — silent drift now fails CI. | order divergence-guard test | LOW | revert |

### P11 — Dead/legacy code

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 11-1 | Verified-dead trees/files (~60+): src/calculator/**, src/features/admin/**, src/features/quotation/** (pending 7-1 decision), Kargo.tsx, dup Urunler/Iletisim pages, QuotePrintPage wrapper, dashboardData.ts, mockNotifications.ts, scripts/old_scripts/**, quotes.html, ebru mockup, patch files ×3, chats/, unused shadcn components | MEDIUM | no decommission discipline | listed targets | **FIXED (413a432, d5593ec, 72555b0)**: every listed target deleted after individual unreferenced proof — calculator (17 files), admin suite + erpModules nav registry, quotation feature (under 7-1), Kargo.tsx + generateKargoPdf (Kargo read `t.kargo.*` absent from every locale file — broken at runtime), dup pages, QuotePrintPage, dashboardData, mockNotifications, old_scripts (17 files), quotes.html, chats/, ebru mockup, design PDF, zero-importer shadcn components. Orphaned deps dropped (embla-carousel-react, recharts, input-otp, react-resizable-panels, vaul, cmdk); lockfile regenerated. Audit reports relocated to docs/audits/. All preserved in git history. | full suite + build after each batch | LOW once proven → proven | git revert / history retains |

### P12 — Supabase repo hygiene

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 12-1 | `supabase/.temp/*`, `.branches/` tracked (perpetually dirty) | LOW | missing gitignore entries | .gitignore, git rm --cached | **FIXED (ff3ff4e)**: untracked + ignored (`supabase/.temp/`, `supabase/.branches/`, plus `coverage/`). | none needed | NONE | git checkout of files |
| 12-2 | `manual/*.sql` hand-applied incl. DRAFTs; schema partially outside migration control; publishable-key literal embedded in cron migration `20260811120000:51` | MEDIUM-HIGH | urgency during incidents | supabase/manual/**, docs | **FIXED (ff3ff4e)**: `docs/manual-sql-reconciliation.md` gives authoritative per-file status (APPLIED-REPRESENTED / APPLIED-NOT-IN-MIGRATIONS / DRAFT), flags the two schema files as highest-priority migration-reconciliation targets, establishes the rule that no new manual SQL ships, and records the key-literal for rotation at the next natural secret-rotation window (no production secret changed). | doc review | LOW | n/a |

### P14/P15 — Deployment & guards

| # | Issue | Severity | Root cause | Files affected | Remediation plan | Status | Tests | Regression risk | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| 14-1 | Manual FTP deploy lacks manifest/checksum/rollback procedure/version identification | MEDIUM | tooling grew organically | scripts/deploy_ftp.py, DEPLOY/*.bat, new docs/deployment-and-rollback.md | **FIXED (b893f8d)**: `docs/deployment-and-rollback.md` runbook (topology, build-once/ship-frozen artifact rule, mandatory pre-deploy gates incl. dry-run diff review, post-deploy health checks via statement parity + sync health, explicit rollback triggers/procedure, DB never auto-rolled-back) + `scripts/make-release-manifest.mjs` pinning commit SHA, tool versions, dirty-tree flag and per-file SHA-256 into dist/release-manifest.json. NO actual deploy performed. | dry-run flag exercise only | LOW | revert |
| 15-1 | Architecture regression guards incomplete (client sprawl, statement bypass, SMTP relay, resource order, legacy-table callers, bundle secrets/demo) | MEDIUM | guards added opportunistically | src/App.apps-route.test.ts pattern, new guard tests | **FIXED (3dfe5e5, 0f71e8c, 96affb4)**: every mandated guard exists and runs in CI — client sprawl (`src/lib/architecture-supabase-client.test.ts`), statement/transaction bypass + retired-generation caller freeze + browser boundary (`src/architecture-data-boundaries.test.ts` — immediately caught 4 live violations on introduction), SMTP relay closure + Paraşüt write-path singularity + emergency-pause fail-safe default (`server/parasut/architecture-integration-guards.test.ts`), resource-order divergence (`sync-execution-plan.test.ts`), bundle secrets/demo (pre-existing vite build safeguard). Reverting any guarded phase now fails CI. | the tests themselves | LOW | revert |
| 17-1 | `parasut-sync-run` had NO execution-source classification: pause answered EVERY caller 200-paused with zero authentication; scheduled-source "proof" was a forgeable header + the PUBLIC publishable key → lifting the pause would have exposed sync/statement-refresh/backfill to anonymous callers. Manual ERP admin path (parasut-write-api resync/full-resync) verified healthy: deployed (probe: own 401+CORS vs control 404), JWT+erp_users-admin enforced server-side, same engine, concurrency-safe | CRITICAL (latent) | single global kill switch conflated "who may call" with "may automatic work proceed" | supabase/functions/parasut-sync-run/index.ts, server/parasut/sync-invocation-gate.ts (NEW), supabase/migrations-proposed/20260825100000_parasut_sync_cron_secret.sql (PREPARED NOT APPLIED), docs | **FIXED (code), activation operator-gated**: fail-closed gate (`gateScheduledInvocation`) rejects unproven sources with 403 BEFORE any credential/engine work; proven-scheduled callers still hit the emergency pause (default PAUSED unchanged); manual admin sync stays exclusively on parasut-write-api and may run despite the pause by design; cron jobs must adopt a real vault shared secret via the prepared migration during unpause (runbook §6). Guard tests pin ordering, paused-shape, single-manual-path contract. | sync-invocation-gate.test.ts decision matrix + architecture-integration-guards additions | LOW while paused; transitional cron-tick 403s until migration applied are harmless | git revert of function change; migration file is inert until hand-applied |

---

## Phase Log

### PHASE 0 — COMPLETE
- Branch created; baseline recorded above.
- Key discoveries beyond prior assessment:
  - Server strict typecheck FAILS today (3 test-file errors) — confirms invisibility.
  - Lint fails with 32E/24W — quantified for Phase 2 baselining.
  - All 1239 tests green; build green including leak guard.

### PHASE 1 — COMPLETE (production safety)
Commits: `9f7cfc2` (1A retry governance), `f8c2c29` (1B health model), `f7ee036` (1C relay closure).
Verification at each commit: app+server typecheck, full vitest suite, production build + bundle safeguard all green.
Final Phase-1 suite state: 107→108 files / 1257→1282 tests passing.
Notable design decisions recorded for review:
- Retry governance keys on the RESOURCE's resumable candidate, not the request fingerprint: chains blocked on page 1 restart rather than resume, so fingerprint-scoped ladders would never climb. Bypass flag covers legitimate operator overrides.
- Governance stamping is best-effort (swallowed failures) so it can never mask the original error or change run outcomes.
- Health snapshot is read-only from existing tables + shared secret; no new migrations; paused runner stays zero-side-effect.
- Quotation-email hardening is redeploy-gated; safe to merge now because no active caller exists.

### PHASE 16 — REGISTER RECONCILIATION (2026-08-25)
The Issue Register had drifted from reality: Phases 2–15 shipped and committed but only P1/P3 rows were ever updated. Every OPEN row was re-verified against its phase commit AND today's tree before its status changed:

| Row | Evidence checked on current tree |
|---|---|
| 2-1 | `npm run typecheck:server` → exit 0; wired blocking in quality.yml |
| 2-2 | `npm run lint` → exit 0, 0 errors / 15 warnings; ratchet tightened 20→15 |
| 4-1 | exactly one client module; guard test `src/lib/architecture-supabase-client.test.ts` present; `lib/supabase.ts` gone |
| 5A-1 / 5C-1 / 6-1 / 7-1 / 11-1 / 13-1 | deliverable docs exist under docs/; deleted trees verified absent (features/quotation, features/admin, calculator/, old_scripts/, chats/, ebru/); migrations-proposed/ present |
| 5B-1 | honestly PARTIAL — conventions + dashboard done; reports domain untouched → stays OPEN with progress note |
| 9-1 / 10-1 | decimal-contract.test.ts + BALANCE_TOLERANCE named constants; divergence guard at sync-execution-plan.test.ts |
| 12-1 / 12-2 / 14-1 / 15-1 | .temp untracked; manual-sql-reconciliation.md; deployment-and-rollback.md + manifest script; all mandated guard tests located |

Only remaining OPEN items after reconciliation: **5B-1** (React Query adoption in reports domain) and the execution of prepared retirement migrations, which are deliberately gated behind operator review by design.

### PHASE 17 — MANUAL-SYNC PATH INVESTIGATION & EXECUTION-SOURCE SEPARATION (2026-08-25)
Reported symptom: production "Cannot connect to API"; ERP admin manual sync button not executing. Investigation findings:
- **Config/connectivity layer healthy end-to-end**: `.env` contains all required names (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, PARASUT_USERNAME/PASSWORD/CLIENT_ID/CLIENT_SECRET/COMPANY_ID); production serves the SAME content-hashed bundle as a fresh local build (`index-KTS4X6II.js` on both hosts) with URL + publishable key correctly baked; auth health 200; parasut-api + parasut-write-api respond with their own 401+CORS shapes vs 404 control → deployed and reachable. The quoted error string exists in NO shipped source, bundle, or dependency → environmental/transient, not a repository defect.
- **Latent CRITICAL found instead**: parasut-sync-run classified no execution sources — anonymous callers got the same 200-paused as cron, and once unpaused would have been able to trigger full syncs (scheduled proof = forgeable header + public key).
- Fix per Phase-17 design: fail-closed `sync-invocation-gate.ts` (403 for unproven sources even while paused; proven-scheduled still pause-gated; manual admin stays exclusively on write-api's JWT+erp_users-admin path, allowed despite pause by design). Cron secret migration PREPARED under migrations-proposed/, never applied. No deploys performed; automatic sync remains PAUSED.



