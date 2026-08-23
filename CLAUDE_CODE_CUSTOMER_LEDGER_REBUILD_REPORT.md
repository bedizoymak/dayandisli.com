# Customer Ledger Rebuild — Implementation Report

Continuously updated per `CLAUDE_CODE_AUTHORITATIVE_CUSTOMER_LEDGER_REBUILD.md`. This session already contains extensive prior work on this exact ledger (P0–P4 fixes, documented in earlier conversation turns, not in a file) — this report treats that prior work as the CURRENT PRODUCTION STATE to be verified against this new contract, not as ground truth to be assumed correct. Every claim below is checked against live production data or source, not assumed from memory.

---

## [2026-08-23 19:20 UTC] Report initialized, beginning investigation
- Status: discovered
- Exact files/tables/endpoints touched or inspected: none yet — this entry only initializes the report.
- Evidence: master prompt file read in full.
- Decision and reason: before writing any code, verify empirically whether the CURRENT production implementation (built earlier this session) already satisfies this contract's hard rules, since several rules appear to conflict with prior work in this same session:
  - Contract rule 4: `ORDER BY statement_order DESC` (newest first), "Never sort by date, and never use date as a tie-breaker."
  - Prior work this session (commit `62b9fb8`) explicitly made `transaction_date` the PRIMARY sort key (to fix a real backdated-transaction ordering bug), with `statement_order` only as a tiebreak — the opposite of what this contract demands.
  - Contract rule 7: statement side determined ONLY by `transactions.transaction_type` via a fixed side-map.
  - Prior work this session (commit `9af8b2b`) explicitly REMOVED type-based side derivation and replaced it with delta-of-`trl_balance`-between-consecutive-rows, per explicit prior instruction in this same conversation.
  These are real, direct conflicts between this contract and already-shipped, already-reconciliation-verified code. Both will be resolved by empirical testing against the PİNO gate (below), not by assumption in either direction.
- What was intentionally not changed: nothing yet.
- Next concrete action: read the current customer-detail component, ledger query path, and Paraşüt sync path; then verify PİNO's live numbers against the contract's exact gate (23 rows, 2,919,100.00 / 1,991,990.89 / 927,109.11, and the row-type census) using both (a) the currently-deployed logic and (b) a raw reconstruction using the contract's own stated rules, to see whether they already agree.

## [2026-08-23 19:24 UTC] PİNO reconciliation gate reconstructed directly from Supabase — EXACT MATCH using the contract's type-based side map
- Status: tested
- Exact files/tables/endpoints touched or inspected: live read-only SQL against `parasut.transaction_history_items` LEFT JOIN `parasut.transactions`, filtered to `contact_parasut_id = '1011029161'`.
- Evidence: fetched all 23 rows (`statement_order` -22..0) with `transaction_type`, `amount_in_trl`, `debit_amount`, `credit_amount`, `trl_balance`. Applying the contract's exact mandatory side map (rule 8) by hand:
  - Row-type census: sales_invoice=8, contact_credit=6, check_in=4, contact_debit=3, purchase_bill=1, contact_opening_balance_debit=1 — **exactly matches the contract's stated census, 23/23**.
  - Sum of debit-side rows (sales_invoice + contact_debit + contact_opening_balance_debit) = **2,919,100.00** — exact match.
  - Sum of credit-side rows (check_in + contact_credit + purchase_bill) = **1,991,990.89** — exact match.
  - `trl_balance` at `statement_order = 0` = **927,109.11** — exact match, and this is the authoritative field read directly, not recomputed.
  - Confirmed live: `debit_amount` and `credit_amount` are BOTH populated (identical, non-null) on several `contact_debit` rows (e.g. statement_order -20: type `contact_debit`, debit_amount=250000, credit_amount=250000) — this is the exact hazard rule 7 warns about; the type-based side map is the only reliable signal, not inferable from which of debit/credit_amount is populated.
- Decision and reason: the contract's type-based side map produces the exactly-correct PİNO gate using real production data. This is proof, not assumption, that side-by-transaction_type is the correct mechanism — proceeding to implement it in the read model.
- What was intentionally not changed: no code touched yet, this is a pure data verification pass.
- Next concrete action: determine the side for transaction types NOT in the contract's 6-item mandatory map but observed in live data.

## [2026-08-23 19:26 UTC] Two transaction types exist in production outside the contract's mandatory map — resolved from observed evidence, not guessed
- Status: discovered
- Exact files/tables/endpoints touched or inspected: `select transaction_type, count(*) from parasut.transaction_history_items join parasut.transactions ... group by 1` across all synced contacts (not just PİNO).
- Evidence: company-wide census found 8 distinct `transaction_type` values, not 6: `contact_debit` (816), `purchase_bill` (807), `contact_credit` (619), `sales_invoice` (436), `check_in` (35), **`check_out` (6)**, `contact_opening_balance_debit` (3), **`contact_opening_balance_credit` (1)**. The contract's mandatory map (rule 8) does not mention `check_out` or `contact_opening_balance_credit`.
  - `check_out`: inspected 2 contacts with consecutive (no intervening row) `statement_order` pairs. Contact `1013210707`, order -9→-8: prev balance -117200, new balance -80200, delta = **+37000**, exactly matching `amount_in_trl` = 37000. Order -8→-7: delta = **+100000**, exactly matching `amount_in_trl` = 100000. Positive delta = same direction as every confirmed DEBIT type. **Evidence-based conclusion: `check_out` is DEBIT.**
  - `contact_opening_balance_credit`: only 1 row in production, contact `1030649361`, `statement_order = -17`, confirmed via `min(statement_order) = -17, count = 18` to be that contact's first-ever history row (so `previous_balance = 0` applies). `trl_balance = -740000`, delta from 0 = **-740000**, negative = same direction as every confirmed CREDIT type. Also matches its own name (opposite of `contact_opening_balance_debit`). **Evidence-based conclusion: `contact_opening_balance_credit` is CREDIT.**
- Decision and reason: implementing the full 8-type map (not the contract's literal 6) since these 2 additional types are real, observed, currently-live data — silently treating them as "unmapped integrity errors" would be factually wrong now that their side is evidence-backed, and would make every already-synced contact holding one of these types (customers, not just internal test data) fail closed for no reason. Any transaction_type beyond these 8 remains an explicit, visible unmapped-integrity error per rule 8 — never guessed.
- What was intentionally not changed: the contract's literal 6-entry table is not edited; this finding is additive, backed by fresh evidence, and documented here per rule 8's own instruction ("must be explicitly mapped from observed Paraşüt evidence").
- Next concrete action: read the current customer-detail component and ledger backend (`supabase/functions/parasut-api/handlers.ts`, `src/features/crm/customerLedger.ts`, `src/features/crm/CustomerDetailPage.tsx`) to compare against every hard rule before changing anything.

## [2026-08-23 19:40 UTC] Existing implementation compared against every hard rule — root cause of "not synchronized" identified, gaps identified
- Status: discovered
- Exact files/tables/endpoints touched or inspected: `supabase/functions/parasut-api/handlers.ts` (`fetchAuthoritativeStatement`, `resolveDisplayDescription`), `src/features/crm/customerLedger.ts` (`buildAuthoritativeLedgerRows`, `statementWarning`), `src/features/crm/CustomerDetailPage.tsx` (screen table + print).
- Evidence / rule-by-rule comparison:
  - Rule 1–3 (canonical source, full pagination, `transaction_history_items` as row source): already correct — `fetchAuthoritativeStatement` reads `parasut.transaction_history_items` exclusively (`.range(0, 24999)`, no invoice-only reconstruction anywhere in the path).
  - Rule 4 (order by `statement_order`, never date): **violated**. Current query ordered by `transaction_date` primary, `statement_order` only as tiebreak (a deliberate change made earlier in this session's own history, for a different reason). Fixed this session (see next entry).
  - Rule 5 (`trl_balance` displayed directly, never recomputed): already correct — `trlBalance: Number(historyRow.trl_balance ?? 0)` is a direct passthrough.
  - Rule 6 (closing balance = `trl_balance` at the newest row, validated against `contacts.trl_balance`): already correct — `fetchAuthoritativeStatement` already asserts this (`contact_balance_mismatch` diagnostic) and P1 (from earlier work) already blocks printing when it fails.
  - Rule 7 (side from `transaction_type` only, `amount_in_trl` is the amount): **violated**. Current code derived debit/credit from the delta between consecutive `trlBalance` values, and used `amountInTrl ?? debitAmount ?? creditAmount` as a fallback chain rather than `amount_in_trl` directly. Fixed this session (see next entry) — also empirically the correct fix, since real data has both `debit_amount` and `credit_amount` populated on the same `contact_debit` row (see the PİNO evidence entry above), which the fallback chain could not distinguish.
  - Rule 8 (mandatory side map; unmapped type = visible integrity error): **partially missing**. No explicit map existed (delta-derivation made one moot); no unmapped-type handling existed at all. Fixed this session (see next entry), including the 2 evidence-based additions to the map (`check_out`, `contact_opening_balance_credit`).
  - Rule 9 (LEFT JOINs, missing linked doc must not remove a row): already correct — `historyRows.map(...)` always produces one row per history item regardless of whether `transaction`/`check`/`sales_invoices` lookups succeed; a missing `transaction` only adds a `missing_transaction:` diagnostic, it never filters the row out.
  - Rule 10 (never filter by a linked document's archive state): already correct — none of the `sales_invoices`/`purchase_bills`/`checks`/`opening_balances`/`payments` lookups in `fetchAuthoritativeStatement` filter by `source_archived`; only the top-level `transaction_history_items` query does (`.eq("source_archived", false)`, which is filtering the ledger set itself, not a linked document — consistent with "Paraşüt defines the ledger set server-side").
  - Rule 11 (null `statement_order`/`trl_balance` must fail closed, not render partial): **missing**. No such check existed. Added this session (see next entry).
  - Description rules: already correct — invoice_no as primary description, check bank/serial composition, opening-balance description, contact debit/credit fallback to `transactions.description` — all already implemented from earlier work this session and verified against the PİNO row-type census above (8 sales_invoice rows all showed real invoice numbers, not raw descriptions).
- "Why does the UI say not synchronized even though the mirror exists" — root cause already identified and fixed earlier in this session (a structural gap: `transaction_history_items` was never part of the automatic sync cron; fixed by adding a dedicated statement-refresh cron job). Verified live just now: 75 of 441 active contacts still have zero `transaction_history_items` rows (`historyRows.length === 0` → `status: "unavailable"` → the exact "Paraşüt işlem geçmişi henüz senkronize edilmedi" message), draining automatically at a measured ~5 contacts/minute with zero errors — this is the correct, honest state for a contact not yet reached by the ongoing backfill, not a bug. PİNO itself (the mandatory reference customer) has been fully synced this whole time.
- Decision and reason: this "rebuild" contract's core architecture (authoritative `transaction_history_items` source, direct `trl_balance` display, LEFT JOIN chain, closing-balance validation) was already correctly built by earlier work in this session — this pass is a targeted correction of the specific rules that earlier work got wrong or left incomplete (ordering direction/tiebreak, side-determination mechanism, unmapped-type handling, null-integrity gate), not a ground-up rewrite.
- What was intentionally not changed: the sync/mirror-population path itself (already correct and already draining the backlog automatically); the join chain structure; the description-resolution logic; tenant isolation (`activeCompanyId` scoping via `scopedParasutTable`, unchanged).
- Next concrete action: implement and typecheck the 4 identified fixes (ordering, side-map, null-integrity gate, screen display direction), then re-run the PİNO reconciliation gate against the new code path before touching tests.

## [2026-08-23 19:52 UTC] Four fixes implemented
- Status: changed
- Exact files/tables/endpoints touched: `supabase/functions/parasut-api/handlers.ts`, `src/features/crm/customerLedger.ts`, `src/features/crm/CustomerDetailPage.tsx`.
- Evidence: `npx tsc --noEmit` (ad hoc, matching this file's Deno-free structural style) and `npm run typecheck` both clean after each change.
- Decision and reason (per fix):
  1. **Ordering**: removed the `transaction_date` primary sort; query now orders by `statement_order` ascending only (rule 4). Also removed the now-meaningless `date_regression` diagnostic (it validated an ordering assumption the contract explicitly rejects) and added the rule-11 null-integrity gate (`statement_order`/`trl_balance` null on any row → `status: "unavailable"` with a `sync_integrity_failure` diagnostic, before any row is built).
  2. **Side map**: `movementFromBalanceDelta` (trlBalance-delta-based) replaced with `movementFromTransactionType` (rule 7/8's fixed 8-type map — the contract's 6 plus 2 evidence-based additions). `amount` now reads `amount_in_trl` directly, no fallback chain.
  3. **Unmapped-type integrity error**: a `LedgerRow.unmapped: boolean` field added; an unmapped row gets a visible `⚠ Eşlenmemiş işlem türü (...)` description instead of a silent zero, and `statementWarning` now also fires (blocking print, via the existing P1 mechanism) whenever any row is unmapped.
  4. **Screen display direction**: the on-screen table now iterates `[...rangeFilteredLedger.rows].reverse()` (newest-first, rule 4's default) while the underlying array, totals, carry-forward math, and print output are untouched (still oldest-first — the contract's explicit "classic print layout" exception). The carry-forward anchor row moved from the top to the bottom of the screen table to stay semantically the oldest anchor in a newest-first list.
- What was intentionally not changed: `resolveDisplayDescription`, the join/fetch structure, `statementWarning`'s reconciliation-mismatch check (still valid, now arguably a stronger check since type-based sums no longer trivially telescope to the balance by construction).
- Next concrete action: re-run the PİNO reconciliation gate against this new code (live SQL reconstruction already proved the target math; now confirming the actual TypeScript code path produces identical output), then update/add tests.

## [2026-08-23 20:25 UTC] PİNO gate passes through the actual code path (not just hand-verified SQL) + all 4 reference customers reconciled
- Status: tested
- Exact files/tables/endpoints touched: `src/features/crm/customerLedger.test.ts` (updated the one test that asserted the old delta-derivation behavior; added the mandatory PİNO gate test suite using the exact 23 live rows recorded above, plus a type-map completeness test and a debit_amount/credit_amount-both-populated regression test), then live SQL against the three other mandatory reference contacts.
- Evidence:
  - `npx vitest run src/features/crm/customerLedger.test.ts` — **19/19 passed**, including: exactly 23 rows/no duplicates; row-type census exactly 8/6/4/3/1/1; totals exactly 2,919,100.00 / 1,991,990.89 / 927,109.11; zero unmapped rows; `statementWarning` null (no false-positive integrity warning); `statement_order` preserved with no date-based reordering; print rows identical to screen rows.
  - Live SQL reconstruction (same type-based side map, same LEFT JOIN chain) against the other 3 mandatory reference contacts:

    | Contact | Rows | Debit | Credit | Closing | Unmapped |
    |---|---|---|---|---|---|
    | HİRA PARTS (1010743830) | 113 | 6,222,758.40 | 5,823,638.40 | 399,120.00 | 0 |
    | BEKEM ÖZTEKNİK (1011029140) | 21 | 953,459.98 | 795,550.00 | 157,909.98 | 0 |
    | bediz test (1068984956) | 2 | 1,000,000.00 | 1,000,000.00 | 0.00 | 0 |

    All three match exactly the totals independently verified earlier in this work (before this rebuild pass), under the contract's type-based side map — zero unmapped transaction types across all currently-synced production data for all 4 mandatory reference contacts.
- Decision and reason: both the isolated TypeScript unit tests (PİNO, using the exact production row data) and a live, independent SQL reconstruction (HİRA/BEKEM/bediz test) agree with the contract's required numbers. This is the PİNO reconciliation gate and the "other three supplied customer statements" step, both satisfied with evidence.
- What was intentionally not changed: no mapping rule was adjusted to fit any individual customer — the same 8-type map produced correct, exact results for all 4 contacts without per-customer special-casing.
- Next concrete action: run the full test suite, `npx tsc --noEmit`, `npm run typecheck`, and `npm run build` before any commit.

## [2026-08-23 20:30 UTC] All quality gates pass
- Status: tested
- Exact files/tables/endpoints touched: none new — verification only. Also updated 2 pre-existing tests in `supabase/functions/parasut-api/handlers.test.ts` that asserted the now-intentionally-removed `date_regression` diagnostic, and added a new test there for the rule-11 null-integrity gate.
- Evidence:
  - `npm ci` — clean, 550 packages, no errors (only pre-existing `npm audit` advisory warnings, unrelated to this change).
  - `npx tsc --noEmit -p tsconfig.app.json` — clean.
  - `npm run typecheck` — clean.
  - `npx vitest run` (full suite) — **104 test files, 1229 tests, all passed** (includes the 19-test PİNO gate suite and the updated/new handlers.test.ts tests).
  - `npm run build` — succeeded, `dist/index.html` and `dist/erp/index.html` both produced, "Production bundle safeguard passed (334 files scanned)".
- Decision and reason: every gate the contract requires (step 8) is green. Proceeding to commit/push (step 9), then deploying only the two files this change actually touches (`supabase/functions/parasut-api/handlers.ts` as an Edge Function; the frontend for `src/features/crm/customerLedger.ts` + `src/features/crm/CustomerDetailPage.tsx`).
- What was intentionally not changed: nothing beyond the files already listed in this report — no unrelated fixes, no other pages, no schema/migration changes (none were required — `parasut.transaction_history_items`, `parasut.transactions`, and every other table this contract's mapping needs already existed and already had the required fields, per the field-by-field verification in the earlier entries).
- Next concrete action: commit, push, deploy the `parasut-api` Edge Function and the frontend, then verify both production URLs.
