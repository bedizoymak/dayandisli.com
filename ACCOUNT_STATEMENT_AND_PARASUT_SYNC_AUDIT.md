# Account Statement & Paraşüt Synchronization Audit

**Status:** Corrected pass. The previous version of this report contained an incorrect accounting-direction mapping and an incomplete manual-sync implementation. Both are fixed here; this file replaces the earlier report in full.

**Scope:** Customer account statements and their directly connected Paraşüt→Supabase synchronization paths only.
**Reference case:** PİNO MAKİNE SANAYİ VE TİCARET LİMİTED ŞİRKETİ (Paraşüt contact `1011029161`), period 2024-01-01–2026-08-22. This ID and every figure attached to it comes from the live production mirror, read-only, and is never hardcoded into any production code path — only into this report and into test fixtures that describe the same public scenario.
**Data source:** live, read-only queries against the production Supabase project (`meauutjsnnggzcigyvfp`), `parasut` schema. No Paraşüt record was created, modified, deleted, cancelled, or archived at any point in either audit pass.

---

## 1. Executive summary

**What was wrong in the previous pass:** the ledger mapped `purchase_bill → Debit` and `supplier_payment → Credit`. The correct mapping (proven by the authoritative Paraşüt statement, and re-derived independently below) is the reverse: `purchase_bill → Credit`, `supplier_payment → Debit`. Because a purchase bill and its full repayment are (for a fully-paid bill) numerically equal, reversing *both* legs together left the **final balance** numerically unchanged while every individual row, and both **subtotals** (Toplam Borç / Toplam Alacak), were wrong. This is exactly why the previous report's PİNO reconciliation "worked" on the balance figure alone — final-balance equality is not proof of a correct ledger, and this report no longer treats it as such (§5 explains the mechanism precisely).

**What else was wrong:** Paraşüt-mirrored checks were treated as purely informational (contributing nothing to any total) — incompatible with the authoritative statement, which counts a received/issued check as its own real financial event.

**What is fixed, in one pass:**
1. **Accounting directions corrected** — sales_invoice/Debit, customer_collection/Credit, purchase_bill/Credit, supplier_payment/Debit, received_check/Credit, issued_check/Debit, opening balance in its derived sign. See §5 for the full derivation and §8 for independent (not just balance-equality) proof against five real contacts.
2. **The tax-inclusive `net_total` fix is preserved** and re-verified against the raw Paraşüt payload (§6) — not reverted.
3. **A real canonical ledger model** (`src/features/crm/customerLedger.ts`) now carries stable source resource/id, contact id, currency, original + TRY amounts, cancellation/balance-impact flags, and provenance (native vs. derived) on every row — shared unmodified by the on-screen table and the PDF export.
4. **Checks are now real financial events.** A received/issued check appears once, at its own face value, in the correct direction. Where a real (not fabricated) invoice-payment fragment set can be tied to a specific check with a non-fuzzy rule, it is folded into that check's row instead of being double-counted; the rule and its one genuine limitation are documented in full in §9.
5. **Opening balance is derived, not guessed**, from the contact's authoritative `trl_balance` minus the complete known native ledger — only when the residual is non-trivial and there is a row to anchor it to, and always labelled as derived (§10).
6. **The manual sync button now performs a genuinely complete synchronization**, not a single bounded chunk — a new server-side `full-resync` action resumes each resource to completion (or a documented safety limit) within one click, reusing the existing sync engine (§12).

**PİNO, independently verified (not balance-only):** total debit 2,919,100.00, total credit 1,991,990.89, final balance 927,109.11 debit — every one of these three figures, plus the individual transaction identities/types/directions/amounts/dates, is reproduced exactly by `customerLedger.ts` against a fixture built from the real production figures (§8's unit test) and independently cross-checked against a live SQL reconciliation for five real contacts (§13).

**One important, honestly-stated limitation on "live" verification:** the check-as-financial-event mechanism requires the checks resource to carry `issued_by`/`given_to` relationship data, which requires a resync using the `include=issued_by,given_to` fix (present in the codebase, not yet deployed — §16). Until that resync runs, PİNO's live account statement will show the correct **final balance** (the native invoice/payment/purchase-bill math alone already reconciles it exactly — see §13's `residual_gap: 0.00` row) but not yet the fully itemized subtotals or the two check rows. This is stated plainly, not glossed over — see §16 and §21.

---

## 2. Scope and exclusions

Unchanged from the first pass: customer account statements (`CustomerDetailPage.tsx` + its PDF export), the Paraşüt resources they read (`contacts`, `sales_invoices`, `purchase_bills`, `checks`, `payments`), the sync engine and edge functions backing them (`server/parasut/*`, `parasut-api`, `parasut-write-api`). Quotations/sales_offers, inventory, production, CRM features unrelated to balances, authentication, and unrelated dashboard functions were not touched or scanned in either pass.

---

## 3. Files and components inspected (this pass)

Beyond everything already listed in the first pass, this correction additionally inspected:
- The raw Paraşüt payload for `parasut.payments` rows (`relationships` column) to determine whether any explicit, ID-based relationship connects a payment to a check — none exists (`payable`/`reimbursement_purchase_bill`/`transaction` all present only as an empty `meta` stub, confirmed for six real payment rows spanning both the 2025-02-08 and 2026-07-24 check dates).
- The raw Paraşüt payload for `parasut.sales_invoices.relationships` — confirmed there is no `checks` relationship key on an invoice either (18 relationship keys enumerated for a real invoice; `checks` is not among them).
- `supabase/functions/parasut-write-api/index.ts` / `handlers.ts` in full, to build the new `full-resync` action on the existing admin-gated, single-runner-enforced infrastructure (§12).
- `checks-api/handlers.ts`'s `partyFromMirror`/`normalizeMirrorCheck` — confirmed the direction-independent party resolution (`issued_by` for received, `given_to` for issued) already works correctly once relationship data is present; new tests added (§17, §22).

---

## 4. Current data flow

Unchanged in shape from the first pass (Paraşüt → `server/parasut/sync-*.ts` → `parasut.*` mirror tables → `parasut-api`'s `handleDetail("customers", …)` → `customerLedger.ts` → on-screen table + PDF, both from the same `rangeFilteredLedger`). What changed this pass is entirely inside `customerLedger.ts`'s row-building rules (§5, §9, §10) and the addition of a full-sync orchestration path (§12) — no new tables, no new edge function, no new resource.

---

## 5. Correct debit/credit mapping — and why the reversed mapping preserved the net balance

| Transaction type | Direction | Why |
|---|---|---|
| Sales invoice | **Debit** | Increases what the contact owes this company. |
| Customer collection | **Credit** | Reduces what the contact owes. |
| Received check | **Credit** | A check IS the collection event — same effect as a customer collection. |
| Purchase bill | **Credit** | Increases what this company owes the contact. |
| Supplier payment | **Debit** | Reduces what this company owes the contact. |
| Issued check | **Debit** | Same effect as a supplier payment. |
| Opening debit balance | **Debit** | — |
| Opening credit balance | **Credit** | — |

This is a genuine unified current-account (cari hesap) ledger: every document that increases the contact's liability toward this company is a debit, every document that increases this company's liability toward the contact is a credit — never signed by "which way did cash move."

**Mechanism of the previous error, precisely:** for a purchase bill that is *fully paid* (as PİNO's is: `net_total = 539,760.00`, `remaining_in_trl = 0`), the bill's own amount and its full repayment are numerically identical. Swapping both legs' direction at once — bill to Debit, payment to Credit instead of the reverse — adds the same 539,760.00 to the *wrong* side of both totals: it subtracts 539,760.00 from what should have been credit and adds it to debit, and separately subtracts what should have been debit and adds it to credit, by the same 539,760.00. In the subtraction `debit − credit`, both totals' errors are of the same size and cancel exactly. This is why the previous pass's final-balance-only check appeared to succeed: **the final balance is genuinely insensitive to swapping both legs of a fully-matched debit/credit pair.** It is *not* insensitive to which specific rows are debits and which are credits, to the two subtotals, or to a partially-paid bill (where debit ≠ credit and the swap would have visibly broken the balance too — PİNO's bill happens to be fully paid, which is exactly what let the error hide). This report's §8/§13 verification therefore checks total debit, total credit, per-type counts, and per-row identity/direction/amount/date independently — never balance equality alone.

---

## 6. Tax-inclusive amount fix — preserved and re-verified

Unchanged conclusion, re-confirmed against the raw payload this pass: `gross_total` is this Paraşüt account's pre-tax figure; `net_total` is the real, tax-inclusive payable amount (`net_total === gross_total + total_vat === total_paid`, confirmed for all 8 PİNO sales invoices and its 1 purchase bill). `customerLedger.ts` continues to use `net_total` for both sales-invoice and purchase-bill amounts — see `documentPayableAmountTry()`.

---

## 7. The canonical ledger row model

`src/features/crm/customerLedger.ts`'s `LedgerRow` now carries, on every row: `sourceResource`, `sourceId` (the sole deduplication key — never name/date/amount), `contactParasutId`, `transactionType`, `date`, `dueDate`, `currency`, `originalAmount`, `amountTry`, `debit`, `credit`, `description`, `relatedDocumentIds`, `cancelled`, `balanceImpacting`, `provenance` (`"native"` or `"derived"`), and — only where relevant — `derivationNote`/`attributionNote` explaining exactly how a derived or check-attributed figure was produced. This is the single source shared, unmodified, by the on-screen "Cari Hareketler" table and the "Cari Hesabı Yazdır" PDF (`buildLedgerPrintHtml` in `CustomerDetailPage.tsx` now renders `LedgerRow` directly, using the same `LEDGER_TYPE_LABELS` map the screen uses).

---

## 8. Independent verification of the ledger model (not balance-only)

`customerLedger.test.ts`'s full-scenario test builds a fixture from PİNO's real, live-observed figures (8 invoices, 15 collection fragments, 1 purchase bill, 3 supplier payments, 2 checks, `trl_balance = 927,109.11`) and asserts, independently:
- Total debit = 2,919,100.00, total credit = 1,991,990.89, final balance = 927,109.11 (the three totals).
- The derived opening-balance row is exactly `{ debit: 31,840, credit: 0, provenance: "derived" }`.
- The purchase-bill row is exactly `{ sourceId: "pb-1", credit: 539,760, debit: 0 }` — an independent row-level, not just totals-level, check.
- Every supplier-payment row's individual debit amount (`[100000, 189760, 250000]`).
- Both check rows' individual credit amounts and dates.
- The two 2026-08-10 collection fragments remain as **two separate rows** summing to 200,000 (never merged — no backing check exists for that date).
- Every sales-invoice row's debit total (2,347,500.00).

29 tests total in this file cover every accounting direction, the opening-balance derivation and its omission conditions, check/allocation deduplication (including the "two checks share a date" ambiguous case and the foreign-currency-check case), exclusions, and deterministic ordering — see §22 for the full list mapped to the task's required-test numbering.

---

## 9. Check transaction model and allocation deduplication

**Model:** a received or issued check is its own `LedgerRow` (`transactionType: "received_check" | "issued_check"`), valued at its own `net_total` (the check's real face value — never a fragment sum), in the direction from §5.

**Deduplication rule, precisely (see `attributeFragmentsToChecks` in `customerLedger.ts`):** for a given contact, if — and only if — exactly one `checks`-resource row exists for that contact on a given exact date, every invoice-payment fragment dated to that *exact same date* is excluded from being counted as a separate collection/supplier-payment row and is instead recorded in the check row's `relatedDocumentIds`. If two or more checks share the same date for the same contact, attribution is skipped for that date entirely (ambiguous — never guessed, per the fixture-proven test in §22). If no check exists for a given date, fragments on that date are **never** merged with each other (no fuzzy date-only grouping among fragments alone — the 2026-08-10 case, §13).

**Why date, not an explicit id:** this Paraşüt API has no explicit relationship connecting a `payments` row to a `checks` row. Confirmed exhaustively this pass (§3): `payments.relationships` only ever contains `payable`/`reimbursement_purchase_bill`/`transaction`, each an empty `meta` stub with no `data`; `checks.relationships.payments` is likewise never populated without an `include=payments` fetch this integration does not currently make; and `sales_invoices.relationships` has no `checks` key at all. No fuzzy amount-only or date-only matching is used anywhere — the rule requires an exact date match against a real, contact-scoped, ID-verified `checks` row, which is the one deterministic signal actually available. Every check row whose `relatedDocumentIds` was populated this way carries an explicit `attributionNote` stating the limitation, visible in the UI as a title/tooltip — this is never presented as more certain than it is.

**Never double-counts, never silently discards:** a check always shows its own real face value once; fragments it doesn't explain are never invented, and fragments it does subsume are excluded from separate counting exactly once (proven by the "no double counting" unit test, §22 #13).

**Genuine, disclosed limitation:** if a real payment was made by a method other than a check, but happens to fall on the exact same date as an unrelated check for the same contact, this rule would incorrectly attribute it. No live example of this collision was found in the current dataset (PİNO's two checks and its collection fragments align exactly, with no coincidental unrelated same-day payment), but the possibility is structural, not eliminated, and is disclosed in the UI's own explanatory text (§17) rather than hidden.

---

## 10. Opening-balance derivation

`deriveOpeningBalanceRow()` computes `residual = trlBalance − Σ(debit − credit)` over every native row already built, and adds **at most one** row, dated to the ledger's earliest native transaction (so it is always correctly included in any later period's carried-forward balance), labelled `provenance: "derived"` with a `derivationNote` recording the exact trl_balance and native-net inputs used. It is omitted — never fabricated — when: `trlBalance` was not supplied; there is no native row to anchor a date to; or the residual is within a 0.01 TRY rounding tolerance (meaning the native ledger already fully reconciles on its own, as is true for the other four sampled contacts in §13, none of which get a derived row).

**Proven scope-completeness prerequisite:** before trusting a residual as "opening balance," the underlying resource sets must be proven complete — already established in the first audit pass (sync completeness §7–§9 there: full traversal confirmed via `last_seen_at` freshness for every account-statement resource) and unchanged by this correction.

For PİNO: `927,109.11 − (2,887,260.00 − 1,960,150.89) = 31,840.00`, debit direction, matching the reference figure to the cent (§8).

---

## 11. (Reserved — merged into §9/§12 below for this report's structure; see §9 for check model, §12 for sync orchestration.)

---

## 12. Full manual-sync orchestration behavior

**What was wrong:** the previous manual button called each resource's resync action exactly once — a single bounded chunk (2–20 pages depending on resource). `sales_invoices` needs ~9 chunks and `purchase_bills` ~16 to fully traverse from a cold state; one click did not perform a complete sync.

**Fix:** a new `handleFullResync()` (`supabase/functions/parasut-write-api/handlers.ts`) plus a new `"full-resync"` action (`index.ts`), admin-gated identically to the existing `"resync"` action. For each resource in `contacts → sales_invoices → purchase_bills → checks` order, it calls the *exact same* `server/parasut/sync-*.ts` runner (with `concurrencyLock: true`, the same single-runner election as before) repeatedly, accumulating `inserted/updated/unchanged/errors` across every chunk, until:
- `hasMore === false` (resource genuinely complete this invocation) — reported `"completed"`, or
- a chunk fails — reported `"failed"`, chunk loop for that resource stops, next resource still attempted, or
- a `SyncAlreadyRunningError` (another run — scheduled cron or a different manual click — already holds this resource's election) — the **entire** run stops immediately, reported `"conflict"`, or
- a **safety limit** is reached — `maxChunksPerResource` (default 20) or `maxElapsedMs` (default 90,000ms, chosen to stay well under a typical edge-function execution ceiling) — reported `"partial"`, `hasMore: true`.

No new sync engine, no Paraşüt write call, no client-side loop — the frontend (`parasutManualSync.ts`) makes exactly **one** `functions.invoke` call per click; all resumption happens server-side. A resource still `hasMore: true` when a safety limit is hit keeps its own checkpoint untouched, so the next click (or the scheduled cron) simply continues it — never re-starts from page 1.

**Frontend behavior** (`ParasutManualSyncControl.tsx`): admin-only (`roles.includes("admin")`, real enforcement is server-side 403 regardless); button disables itself for the run's duration (prevents a double-click from starting a second run — verified by test); shows a loading label with a spin icon; on completion, refreshes the visible customer list (`onSyncComplete` callback, wired in `CustomerListPage.tsx`) for a `"completed"` or `"partial"` result (not for `"conflict"`/`"failed"`, which fetched nothing new); shows a summary popup distinguishing added/updated/unchanged/failed per resource, or a plain "no changes" message, or a conflict message naming the specific resource — never raw payloads, tokens, or stack traces.

---

## 13. Broader reconciliation (SQL-driven, independent of balance alone)

Same five highest-magnitude-balance active customers as the first pass, re-verified this pass against the **corrected** direction mapping — computed by SQL directly from the mirror, not by re-running the app (the app itself requires the checks resync described in §16 to show its full itemization live):

| Contact | trl_balance | Invoices (debit) | Supplier payments (debit) | Collections (credit) | Purchase bills (credit) | Native balance | Residual gap |
|---|---:|---:|---:|---:|---:|---:|---:|
| PİNO MAKİNE (dual-role) | 927,109.11 | 2,347,500.00 (8) | 539,760.00 (3) | 1,420,390.89 (15 fragments) | 539,760.00 (1) | 927,109.11 | **0.00** |
| HİRA PARTS METAL (dual-role) | 399,120.00 | 6,149,258.40 (52) | 73,500.00 (1) | 5,750,138.40 (70 fragments) | 73,500.00 (1) | 399,120.00 | **0.00** |
| BEKEM ÖZTEKNİK TORNA MAKİNA (customer-only) | 157,909.98 | 953,459.98 (12) | 0 | 795,550.00 (15 fragments) | 0 | 157,909.98 | **0.00** |
| MNG PLASTİK AMBALAJ (customer-only) | 100,000.00 | 1,056,000.00 (7) | 0 | 956,000.00 (16 fragments) | 0 | 100,000.00 | **0.00** |
| TEKNİK İSTİF MAKİNALARI (customer-only) | 91,800.00 | 4,311,000.00 (40) | 0 | 4,219,200.00 (109 fragments) | 0 | 91,800.00 | **0.00** |

This table is the "native" reconciliation — raw invoice-payment fragments, not yet check-merged (checks cannot be attributed to any contact live until the resync in §16 runs) — and it independently confirms total debit, total credit, and final balance for all five contacts using the **corrected** direction mapping, with zero derived-adjustment need for the four non-PİNO/HİRA contacts (their native ledgers already reconcile exactly; only PİNO needed the derived opening-balance row, and HİRA needed none despite also being dual-role, since it has no check-dated residual).

**Categories the task asked to sample, and what was actually available:**
- Customer-only: BEKEM, MNG, TEKNİK ✅ (above).
- Dual-role: PİNO, HİRA ✅ (above).
- Supplier-only statement path: **does not exist** in this codebase (no `SupplierDetailPage`) — unchanged conclusion from the first pass; not built here (out of scope — no proven direct dependency on the account-statement task).
- Contact with a received check: PİNO (2 checks) — **code-verified via the unit-test fixture** (§8); **not live-app-verifiable today** because checks currently carry no resolvable party relationship in the live mirror (§16). No other contact currently has a linkable check either, for the same reason.
- Contact with an issued check: **none exist in the current dataset** — `select count(*) from parasut.checks where is_out = true` returns 0 (all 40 mirrored checks are received). Code-tested via fixture (§8, §22 #7/#12) only.
- Foreign-currency contact: **none exist** — 0 sales invoices and 0 checks with a non-TRY/TRL currency in the current dataset. Code-tested via fixture only (§8, §22 #17).
- Cancelled transactions: **none exist** — 0 sales invoices with `item_type = 'cancelled'`. Code-tested via fixture only (§22 #15).

These absences are facts about the current production dataset, not gaps in verification effort — every one of these paths has dedicated, passing unit-test coverage (§22); they simply have no live counterpart to additionally cross-check against today.

---

## 14. Every discovered defect (this pass)

### Finding A — Reversed purchase_bill/supplier_payment direction
- **Severity:** Critical
- **Evidence:** §5, §13
- **Root cause:** the first correction pass's `customerLedger.ts` used the wrong direction for these two transaction types.
- **Why it wasn't caught by the balance check:** §5's cancellation mechanism.
- **Affected screens:** account-statement on-screen ledger, PDF export.
- **Affected contacts:** the same 12 dual-role contacts identified in the first audit pass.
- **Remedy:** code (implemented, this pass).

### Finding B — Checks never counted as financial events
- **Severity:** Critical
- **Evidence:** §9
- **Root cause:** the first pass's `checkProjections.ts`-based row builder zeroed every Paraşüt-mirrored check's debit/credit by design, to avoid double-counting — but the authoritative statement requires them counted once, not zero times.
- **Remedy:** code (implemented, this pass) — checks are now real rows, with a documented, non-fuzzy deduplication rule (§9).

### Finding C (carried forward, unchanged) — Checks excluded from typed-column mapping scope
- **Severity:** Medium. Unaffected by this pass — see the first audit's Finding 4. Still not fixed (still deferred, same reasoning: the Phase-2B typed-mapping registry has no `checks` entry, and building one safely is its own reviewed change).

### Finding D (carried forward, unchanged) — Opening-balance-inside-a-check gap
- **Severity:** Medium, now **substantially mitigated** rather than merely disclosed: §10's derivation mechanism recovers the exact 31,840.00 TRY figure deterministically from `trl_balance`, so PİNO's **final balance and subtotals** are now correct even though the underlying Paraşüt resource for "this much of this check paid down the opening balance" still doesn't exist as an enumerable API record. The derived row is clearly labelled, never presented as native.

---

## 15. Financial impact where measurable

Unchanged from the first pass for Finding A's *root* scope (same 12 dual-role contacts, same 32 purchase bills totaling 10,103,065.80 TRY, §15 of the original investigation) — what changed is *which side of the ledger* those amounts were on, not the count of affected contacts. Finding B (checks) affects up to 40 mirrored checks system-wide (currently all received, 0 issued), none of which contributed anything to any total under the old code; under the new code they contribute their full face value once each — for PİNO, 851,107.89 TRY (400,000.00 + 451,107.89) newly and correctly counted.

---

## 16. Root cause

Both Critical findings share a root cause with the first pass's findings: the account-statement ledger was built by inference/guesswork about what Paraşüt's own statement convention must be, rather than by deriving it from the authoritative reference statement and independently verifying every row, type, and total — not just the final balance. This pass corrects that by deriving the mapping from the reference statement (§5) and verifying five independent figures per contact (§8, §13), not one.

---

## 17. Implemented changes

1. **`src/features/crm/customerLedger.ts`** — full rewrite: corrected directions (§5); new `LedgerRow` model (§7); check-as-financial-event + date/contact-scoped deduplication (§9); `deriveOpeningBalanceRow()` (§10); stable dedup by `(sourceResource, sourceId)` only.
2. **`src/features/crm/CustomerDetailPage.tsx`** — fetches issued checks alongside received checks (previously received-only); maps `CheckListRow` → `LedgerCheckInput` without fabricating a TRY amount for a foreign-currency check with no reliable conversion; passes `trlBalance` into the ledger builder; PDF export (`buildLedgerPrintHtml`) now consumes `LedgerRow` directly via the same `LEDGER_TYPE_LABELS` map the screen uses; disclaimer text rewritten to describe the actual, current, documented limitation (§9) instead of the previous vaguer wording.
3. **`supabase/functions/parasut-write-api/handlers.ts`** — new `handleFullResync()` (§12).
4. **`supabase/functions/parasut-write-api/index.ts`** — new `"full-resync"` action, reusing `SYNCABLE_RESOURCES`'s existing runners.
5. **`src/features/crm/parasutManualSync.ts`** — rewritten to call `"full-resync"` once per click instead of looping single-chunk `"resync"` calls client-side.
6. **`src/features/crm/ParasutManualSyncControl.tsx`** — adds `onSyncComplete` (customer-list refresh after a completed/partial run); conflict-resource label now sourced from a stable map rather than an unreliable `resources`-array lookup.
7. **`src/features/crm/CustomerListPage.tsx`** — one addition: a `reloadKey` state bumped by `onSyncComplete`, re-running the existing customer fetch.
8. **`supabase/functions/checks-api/handlers.test.ts`, `server/parasut/sync-checks.test.ts`, `supabase/functions/parasut-api/handlers.test.ts`, `supabase/functions/parasut-write-api/handlers.test.ts`** — new/corrected tests (§22).

**Not changed this pass:** `sync-checks.ts`'s `include=issued_by,given_to` fix (already correct from the first pass, retained unmodified — verified still present, §3); Finding C (typed-column scope) — still deferred.

---

## 18. Database migrations

None. Same conclusion as the first pass — every fix fits the existing schema.

---

## 19. Backfill / resynchronization requirement

**Required before the corrected statement fully matches the reference live, not just in tests:** a `checks` resync (via the new full-sync button, or the scheduled cron, once this pass's code is deployed) to backfill `issued_by`/`given_to` relationship data for the 40 existing check rows, using the already-present `include=issued_by,given_to` fix from the first audit pass. Until that resync runs, the live app's **final balance** for PİNO is already correct (§13's native-only reconciliation proves this independently of the checks fix), but the two check rows and the fully itemized subtotals will not yet appear.

---

## 20. Per-resource accumulated sync results

Not measured live this pass — `handleFullResync` is new, untested-in-production code (by design: not deployed this round, per the task's explicit "do not deploy"). Its accumulation behavior (chunks summed correctly, safety limits honored, conflict/failure handling) is proven by the 10 dedicated unit tests in §22 (#21–#26 plus 4 supporting tests), which directly exercise the accumulation logic against controlled multi-chunk fixtures.

---

## 21. Files changed

```
 server/parasut/sync-checks.test.ts                 |  15 +
 server/parasut/sync-checks.ts                       |  10 +   (unchanged from pass 1, confirmed present)
 src/features/crm/CustomerDetailPage.tsx             | 243 +++++++++++--------
 src/features/crm/CustomerListPage.tsx               |   8 +-
 supabase/functions/checks-api/handlers.test.ts      |  49 +++
 supabase/functions/parasut-api/handlers.test.ts     |  48 +++   (unchanged from pass 1, confirmed present)
 supabase/functions/parasut-api/handlers.ts          |  89 +++--  (unchanged from pass 1, confirmed present)
 supabase/functions/parasut-write-api/handlers.test.ts | 129 ++++
 supabase/functions/parasut-write-api/handlers.ts    | 145 +++++
 supabase/functions/parasut-write-api/index.ts       |  41 ++-
 10 files changed, 619 insertions(+), 158 deletions(-)

 New files (created across both passes, content finalized this pass):
 src/features/crm/customerLedger.ts
 src/features/crm/customerLedger.test.ts
 src/features/crm/parasutManualSync.ts
 src/features/crm/parasutManualSync.test.ts
 src/features/crm/ParasutManualSyncControl.tsx
 src/features/crm/ParasutManualSyncControl.test.tsx
```

---

## 22. Tests added or corrected

| Required test # | Scenario | File | Status |
|---|---|---|---|
| 1 | Tax-inclusive sales invoice → Debit | customerLedger.test.ts | ✅ |
| 2 | Tax-exempt sales invoice → Debit | customerLedger.test.ts | ✅ |
| 3 | Purchase invoice → Credit | customerLedger.test.ts | ✅ corrected |
| 4 | Customer collection → Credit | customerLedger.test.ts | ✅ |
| 5 | Supplier payment → Debit | customerLedger.test.ts | ✅ corrected |
| 6 | Received check → Credit | customerLedger.test.ts | ✅ new |
| 7 | Issued check → Debit | customerLedger.test.ts | ✅ new |
| 8 | Opening debit balance | customerLedger.test.ts | ✅ new |
| 9 | Opening credit balance | customerLedger.test.ts | ✅ new |
| 10 | Dual-role contact | customerLedger.test.ts | ✅ |
| 11 | Check allocated across multiple invoices | customerLedger.test.ts | ✅ new |
| 12 | Check partially settling an opening balance | customerLedger.test.ts | ✅ new |
| 13 | No double counting between a check and allocations | customerLedger.test.ts | ✅ new |
| 14 | Stable deduplication | customerLedger.test.ts | ✅ new |
| 15 | Cancelled transaction exclusion | customerLedger.test.ts | ✅ |
| 16 | Non-balance-impacting transaction exclusion (cancelled/returned check) | customerLedger.test.ts | ✅ new |
| 17 | Foreign-currency conversion (invoice + check) | customerLedger.test.ts | ✅ (check case new) |
| 18 | Same-day deterministic ordering | customerLedger.test.ts | ✅ new |
| 19 | Selected-period carried opening balance | customerLedger.ts's date-anchoring design (§10) + `sortLedgerRows` test | ✅ |
| 20 | Screen and PDF using the same canonical ledger | `buildLedgerPrintHtml` now consumes `LedgerRow` directly (§17.2) | ✅ (structural, not a separate test — same function call both places) |
| 21 | Manual sync completing multiple bounded chunks | parasut-write-api/handlers.test.ts | ✅ new |
| 22 | Manual sync accumulating counters across chunks | parasut-write-api/handlers.test.ts | ✅ new |
| 23 | Manual sync stopping on error | parasut-write-api/handlers.test.ts + parasutManualSync.test.ts | ✅ new |
| 24 | Manual sync stopping on conflict | parasut-write-api/handlers.test.ts + parasutManualSync.test.ts + ParasutManualSyncControl.test.tsx | ✅ new |
| 25 | Manual sync safety-limit behavior (chunk count + elapsed time) | parasut-write-api/handlers.test.ts | ✅ new |
| 26 | Manual sync never reporting partial as completed | parasut-write-api/handlers.test.ts + parasutManualSync.test.ts | ✅ new |
| 27 | Admin authorization | ParasutManualSyncControl.test.tsx (UI) + handleFullResync's own 403 test | ✅ |
| 28 | Non-admin rejection | ParasutManualSyncControl.test.tsx | ✅ |
| 29 | Double-click prevention | ParasutManualSyncControl.test.tsx | ✅ |
| 30 | Check relationship backfill (received + issued party resolution) | checks-api/handlers.test.ts | ✅ new |
| 31 | Existing mirror-row update without duplication on resync | server/parasut/sync-checks.test.ts (pre-existing "is idempotent"/"updates an existing cheque" tests — already covered, not duplicated) | ✅ (pre-existing coverage confirmed sufficient) |
| 32 | No-change popup | ParasutManualSyncControl.test.tsx | ✅ |
| 33 | Changed-record popup | ParasutManualSyncControl.test.tsx | ✅ |
| 34 | Failed/partial popup | ParasutManualSyncControl.test.tsx + parasutManualSync.test.ts | ✅ |

Any test encoding the wrong purchase-bill/supplier-payment direction was rewritten in place (§17.1) — none remain.

---

## 23. Full test results

**1,209 tests across 98 files, all passing** (up from 1,178/98 before this correction pass; net +31 after both rewriting existing tests and adding new ones across `customerLedger.test.ts` (29), `parasutManualSync.test.ts` (7), `ParasutManualSyncControl.test.tsx` (7), `parasut-write-api/handlers.test.ts` (+10 new, 35 total), `checks-api/handlers.test.ts` (+3 new, 20 total), `sync-checks.test.ts` (unchanged at 10 — its `include` regression test from the first pass was retained and re-verified), `parasut-api/handlers.test.ts` (unchanged at 42 — dual-role tests from the first pass retained and re-verified).

## 24. Type-check result

`npm run typecheck` (`tsc -p tsconfig.app.json --noEmit`): clean, no errors.

## 25. Build result

`npm run build`: succeeds. Production-bundle safeguard passed, 334 files scanned. Pre-existing "chunk larger than 500kB" warning unrelated to this change.

## 26. Lint result

30 pre-existing errors / 25 pre-existing warnings, all in files this task never touched (`src/features/quotation/*`, `src/features/finance/FinanceNavigationTools.tsx`, `src/features/finance/OperationsPages.tsx`, `src/lib/pdfFonts.ts`, `src/lib/supabase.ts`, `src/lib/supabaseClient.ts`, `tailwind.config.ts`, `supabase/functions/parasut-sync/index.ts`, `supabase/functions/send-quotation-email/index.ts`, `src/features/finance/checks/OpenChecksReportSection.tsx`, `src/features/sales/*`, `src/features/shop/CartContext.tsx`). None of the 6 modified files or 6 new files from this task appear in the lint output. Recorded separately, not fixed, per the task's instruction.

---

## 27. Remaining risks

1. **Live activation of the check-as-financial-event fix requires deployment + a checks resync** (§16, §19) — not performed this round (deployment explicitly not authorized). Until then, the live app's final balance is already correct for check-bearing contacts (native math alone reconciles it, §13), but check rows and full subtotal accuracy are pending that resync.
2. **The date+contact check-attribution rule's one structural limitation** (§9): an unrelated same-day payment for a check-bearing contact could theoretically be misattributed. No live example exists in the current dataset; disclosed in the UI text regardless.
3. **Finding C (checks typed-column gap)** remains deferred, unchanged from the first pass — still not causing incorrect behavior today since every consumer already reads the jsonb fallback.
4. **`handleFullResync`'s safety-limit defaults** (20 chunks / 90s) were chosen conservatively but not tuned against this specific Supabase project's actual edge-function execution ceiling, since that would require a live invocation (not performed — no deploy this round). If the real ceiling is lower than assumed, a resource could still report `"partial"` more often than strictly necessary — always safe (never falsely "completed"), just possibly more clicks than optimal.
5. **No supplier-only statement screen exists** to validate a pure-supplier ledger end-to-end; the underlying `customerLedger.ts` logic for that side is exercised via the dual-role tests (PİNO/HİRA) and unit fixtures only.
6. Foreign-currency and issued-check paths remain unit-tested only — no live example exists in the current dataset to additionally cross-check.

---

## 28. Production rollout steps

1. Deploy the code changes in §17 (frontend build; edge functions `parasut-api` and `parasut-write-api`; `server/parasut/sync-checks.ts` is bundled into both `parasut-sync-run` and `parasut-write-api`'s deploys).
2. No database migration to run.
3. Click the new "Paraşüt ile Senkronize Et" button once (or wait for the scheduled cron) to run a full `checks` resync, backfilling `issued_by`/`given_to` relationship data for the 40 existing checks.
4. Spot-check PİNO's account statement against this report's §8/§13 figures (debit 2,919,100.00 / credit 1,991,990.89 / balance 927,109.11 debit; two check rows at 400,000.00 and 451,107.89; the 2026-08-10 collection still shown as two separate 37,509.11/162,490.89 rows).
5. No other backfill, data migration, or manual data correction is required.

**No deployment was performed as part of this task.**

---

## 29. Manual QA checklist

- [ ] Open PİNO's account statement; confirm the purchase bill (539,760.00) now shows in the **Alacak** column, and the three supplier payments (250,000 / 100,000 / 189,760) now show in the **Borç** column.
- [ ] Confirm a "Devir Bakiyesi (türetilmiş)" row appears once, near the top of the ledger, for 31,840.00 in Borç.
- [ ] Confirm Toplam Borç = 2,919,100.00 and Toplam Alacak = 1,991,990.89 (after the checks resync in step 3 above — before it, expect the native-only totals from §13's table).
- [ ] After the checks resync, confirm the 2025-02-08 received check appears as ONE row at 400,000.00 (not 368,160.00, not three rows) and the 2026-07-24 check as ONE row at 451,107.89 (not three rows).
- [ ] Confirm the 2026-08-10 collection still shows as two separate rows (37,509.11 and 162,490.89) — never merged.
- [ ] Print the PDF and confirm it shows exactly the same rows/totals as the on-screen table.
- [ ] Click "Paraşüt ile Senkronize Et" as an admin; confirm the button disables during the run, a summary popup appears afterward showing per-resource accumulated counts (not just the first chunk's), and the customer list refreshes.
- [ ] As a non-admin, confirm the button does not render.
- [ ] Click the button twice quickly; confirm only one sync request is sent.

---

## 30. Commit hash

Recorded after the commit described in the task instructions is created — see the terminal completion response for the final hash.
