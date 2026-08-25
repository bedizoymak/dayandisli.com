# Paraşüt Customer Mirror — Implementation Report

Date: 2026-08-25 · Branch: `remediation/architecture-stabilization` · Scope: customer/contact financial mirror ONLY
Mode: no deploy, no push, no migration executed, automatic sync untouched (still PAUSED).

---

## 1. Evidence files read (complete, before any code change)

| File | Content |
|---|---|
| `docs/2.0/CLAUDE_CODE_ERP_2_BACKEND_TRUTH_AUDIT.md` (926 lines) | Backend Truth Audit, Pass 1 + Pass 2 (read-only DB + two authorized live-API GETs) |
| `docs/2.0/ERP 2.0 - Paraşüt Parent Mirror Blueprint and Audit.docx` (853 extracted paragraphs) | Browser blueprint Passes 1–3 incl. C.0 precedence rule, C.7 contract, Sections A–E |
| Current tree | `supabase/functions/parasut-api/handlers.ts` (statement/detail/summaries), `customerLedger.ts`, `CustomerDetailPage.tsx`, `checksApi.ts`, `checks-api/*`, `upsert-resource.ts`, `fakeSupabaseAdmin.ts`, both test suites |

## 2. Conflicts between browser inference and backend truth

| # | Browser inference | Backend truth | Resolution per §0 precedence |
|---|---|---|---|
| K1 | Statement = "view over documents/settlements/cheques unioned" (blueprint §2.2, withdrawn in its own Pass 2) | `transaction_history_items` is a first-class mirrored table; read directly | Backend wins — already implemented as direct read |
| K2 | Running balance possibly computed in read model (C.2.2 "NOT VERIFIED which") | `trl_balance` stored per row and returned verbatim | Backend wins — mirror carries it verbatim; nothing recomputes it |
| K3 | Cheque endorsement/custody storage claims | No endorsement chain exists; custody list-only; checks carry NO archived attribute at all → `source_archived` stays NULL on every live cheque (production query: 43/43 NULL) | Backend wins; NULL ≠ false semantics honored everywhere |
| K4 | "169 vs 163 customer gap" suspected ingestion defect | Live totals reconcile 440=440 post-sync-era | Staleness, not defect (per audit; not re-litigated here) |
| K5 | Three unmatched cheques suspected ERP contamination | PARENT-DELETED BUT STILL MIRRORED (live API 404 ×3) | Deletion-reconciliation sync gap; NOT fixable at read layer |

## 3. Current data path discovered

`/apps/finance/income/customers` → `/apps/crm/customers/{contactId}` → `CustomerDetailPage.tsx`
→ `supabase.functions.invoke("parasut-api", {action:"detail", resource:"customers", parasutId})`
→ gateway JWT (`verify_jwt=true`) → handler authz (`erp_users`, company scope) →
`fetchAuthoritativeStatement()` → `parasut.transaction_history_items` (scoped by `parasut_company_id`+company_id, `source_archived=false`, ORDER BY `statement_order` ASC) → join `parasut.transactions` (+`checks`, `payments` as linkage) → normalized statement JSON →
`buildAuthoritativeLedgerRows()` → screen table + KPI tiles + date-range print window (`buildLedgerPrintHtml`) — one model.
Cheque panel flows separately through `checks-api` (`listAllChecks`) with the correct `.or("false|null")` idiom.

## 4. Exact root causes of the current mismatch

1. **KPI formula defect** (audit §C confirmed): `Tahsil Edilen` summed `parasut.payments` allocations (1-to-many linkage) against ledger debits → identity broke by exactly the allocation-vs-movement delta (571.600,00 / 273.200,00 specimens).
2. **Inconsistent archived filtering**: `fetchDocumentsAndChecks` had none (archived bill counted in payables totals AND `document_count`); `handleDetail("customers")` cheques used `eq(false)` against an all-NULL column (always-empty payload).
3. **Sync gap (reported, not compensated)**: `syncChecks()` deliberately lacks deletion reconciliation and Paraşüt checks expose no archived attribute → ghost cheques are data-layer-indistinguishable from live ones; aggregates cannot exclude them generically without inventing a filter that would hide real cheques.

## 5. Authoritative statement contract (implemented & preserved)

`transaction_history_items` defines row population · `statement_order` defines order (never date) · `trl_balance` defines running balance (never recomputed) · `transactions` define identity/type/side via fixed map · linked docs/checks/opening-balances are detail sources only · missing linkage degrades to null display fields, never drops a row · missing order/balance or duplicate/missing transaction identity fails closed.

## 6. Supabase tables actually used

`parasut.transaction_history_items` · `parasut.transactions` · `parasut.checks` · `parasut.payments` · `parasut.sales_invoices` · `parasut.purchase_bills` · `parasut.opening_balances` · `parasut.contacts` · `parasut.sync_runs`. All service-role, RLS default-deny for anon/authenticated. Browser touches none of them directly (guard-tested).

## 7. Transaction-type mapping (fixed map, never inferred)

Debit: `sales_invoice`, `contact_debit`, `contact_opening_balance_debit`, `check_out`.
Credit: `check_in`, `contact_credit`, `purchase_bill`, `contact_opening_balance_credit`.
Prefix rule: `contact_transfer*`. Anything else → visible unmapped integrity error (⚠ row text, warning banner, print gate). Amount is ALWAYS `transactions.amount_in_trl` verbatim.

## 8. Ordering source

`statement_order` ASC (server SQL literal) → positional index → frontend stable re-sort by that index. Date is display-only.

## 9. Running-balance source

Parent's stored `trl_balance`, coerced to Number only. Closing balance = last row's balance. Frontend `Σdebit − Σcredit` exists solely for KPI/print footer reconciliation against it.

## 10. Source-isolation rules

Every statement row carries `provenance.source="parasut"`; allocations carry `balanceImpacting:false`; no `erp.*` financial table participates in any Paraşüt-facing figure; archived documents excluded from aggregates; checks use the documented NULL-aware filter; the customers-list aggregates consume only server-side parasut reads.

## 11. Files changed (this task)

- `supabase/functions/parasut-api/handlers.ts` — F1 NULL-aware cheque filter in customer detail (restores always-empty payload); F2 archived exclusion + NULL-aware cheque filter in receivables/payables summaries (fixes counts too); F3 stale ordering comment corrected.
- `src/features/crm/CustomerDetailPage.tsx` — F4 `Tahsil Edilen` now derived from authoritative statement credits; payments-allocation sum removed; derivation documented inline.
- Tests: `handlers.test.ts` (+2 regressions, 1 stale expectation corrected), `customerLedger.test.ts` (+4 generic-contract tests).
- (Prior same-session work, separate concern: `parasut-sync-run/index.ts`, `sync-invocation-gate.*`, guards, migrations-proposed cron-secret, runbook §6, remediation ledger.)

## 12. Legacy calculations removed/bypassed

`collectedTotal = Σ payments.amount` deleted from the KPI path (the exact audit blocker #3 defect). No other legacy path touched; nothing deleted from any database.

## 13. PİNO reconciliation (1011029161) — TEST ORACLE ONLY

VERIFIED — TEST: existing mandatory gate asserts **23 rows**, census `sales_invoice 8 / contact_credit 6 / check_in 4 / contact_debit 3 / purchase_bill 1 / contact_opening_balance_debit 1`, debit **2,919,100.00**, credit **1,991,990.89**, closing **927,109.11**, zero unmapped, print parity. After this task's changes: still green. With the corrected tile, header now reconciles identically: 2.919.100,00 − 1.991.990,89 = 927.109,11 = `contacts.trl_balance`.

## 14. Other audited contacts

VERIFIED — PARAŞÜT UI + BACKEND (audits): TEKNİK İSTİF 1011029145 / BEKEM ÖZTEKNİK 1011029140 / MNG PLASTİK 1011029141 balances matched parent exactly; the generic engine adds no contact-specific branch, so their behavior reduces to the same tested map/order/balance rules. The former 273.200,00 tile contradiction disappears under the new derivation (same formula class as the PİNO case, covered by the generic identity test).

## 15. Arbitrary-contact validation

VERIFIED — TEST: new "generic mirror contract" suite runs a full 8-row synthetic statement (every movement type incl. both opening-balance directions) for contact **9900000001** — an id chosen after design, absent from all fixtures: order preservation, verbatim closing balance, KPI identity, allocation-invariance, cross-contact independence (shared legal identity stays separate), unknown-type fail-visible. Server-side: tenant-isolation and per-company summary suites already exercise arbitrary ids ("500"/"600"/"900" across two companies).

## 16. Screen/print parity

VERIFIED — TEST (pre-existing, still green): identical transaction ids, order, amounts, balances, totals between screen rows and `buildLedgerPrintRows`; print blocked whenever `statementWarning` fires (stale/mismatch/unmapped/incomplete).

## 17. Verification evidence (all run after final edit)

| Gate | Result |
|---|---|
| Targeted: handlers.test.ts | 56/56 ✅ |
| Targeted: customerLedger.test.ts | 25/25 ✅ |
| Full Vitest suite | **110 files / 1253 tests passed** ✅ |
| `npm run typecheck` (app) | exit 0 ✅ |
| `npm run typecheck:server` | exit 0 ✅ |
| `eslint . --max-warnings 15` | 0 errors / 15 warnings ✅ |
| `npm run build` + bundle safeguard | green, 334 files scanned ✅ |

Customer-specific production scan: **zero** customer ids/names/acceptance amounts in non-test production sources. Two pre-existing comment mentions (sign-convention note; audit reference) and one pre-existing SYNC-side operator backfill allowlist (`RECONCILIATION_TARGET_CONTACT_IDS` in `sync-transaction-history.ts`) found and REPORTED below — not logic added by this task, sync untouched per §13.

## 18. Remaining discrepancies

1. Ghost-cheque contamination of *cheque-combining* aggregates (customers-list Tahsil Edilecek/Gecikmiş, dashboard cards) persists until the sync engine gains checks deletion reconciliation — a proven sync gap, deliberately not papered over (§13).
2. Customer-detail statement mixes two sync clocks (statement-refresh vs six-resource) — pre-existing, disclosed by banner text only for the statement clock (audit §D.3); UI disclosure improvement left out of this narrow scope.

## 19. NOT VERIFIED items

- Sync WRITE path fidelity for `statement_order`/`trl_balance` (stored live values match parent per audit; writer source not line-audited).
- Live Paraşüt-side state of any record today (no sync, no live calls this session).
- Whether any second consumer of `transaction_history_items` exists outside `handlers.ts` + sync engine (repo scan found none).
- Full per-role parent-vs-mirror id-set reconciliation ("Müşteriler" filtered view).

## 20. Production actions still required (operator-gated; none performed)

1. Redeploy edge functions (activates the handler fixes; also the Phase-17 invocation gate).
2. Resume-sync prerequisites when ever unpausing: checks deletion reconciliation FIRST (audit blocker #1), then cron-secret migration + secret mirroring per runbook §6.
3. Optionally parameterize/remove `RECONCILIATION_TARGET_CONTACT_IDS` during that sync work so backfill tooling carries no hardcoded contacts.

---

### Stop condition assessment

A random Paraşüt contact now flows through one canonical, contract-bound path: parent-ordered rows, parent-supplied balances, fixed type→side mapping with fail-visible integrity states, single screen/KPI/print model, zero customer-specific code. Completion claimed on that basis only.
