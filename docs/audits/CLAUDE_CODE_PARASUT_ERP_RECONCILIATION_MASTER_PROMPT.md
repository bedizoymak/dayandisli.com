# Claude Code Master Prompt — Paraşüt ↔ Supabase ↔ ERP Cari Ekstre Reconciliation

## Role and execution mode

Act as the senior backend/data/frontend engineer responsible for completing this production correction end to end in the existing `dayandisli.com` repository.

Start immediately. Do not return a plan and stop. Inspect the repository, create a short internal execution plan, then implement every phase in order until the acceptance matrix passes or an external access restriction makes a specific item impossible.

This is one continuous multi-phase task. Do not ask for approval between phases. Make safe, incremental commits after each independently valid phase. Never discard or overwrite unrelated user changes in the working tree.

## Non-negotiable golden rules

1. Paraşüt is the authoritative financial source. Supabase and ERP must reproduce Paraşüt exactly.
2. Do not write to, modify or delete any record in Paraşüt.
3. Do not create synthetic financial movements to force balances to match.
4. Completely remove the current derived `Devir Bakiyesi (türetilmiş)` balancing plug. Never replace it with another formula such as `contact.trl_balance - reconstructed rows`.
5. Checks must remain visible in customer activity and must continue to count as collections/payments. Do not remove checks from the cari ekstre.
6. One real Paraşüt financial event must affect the running balance exactly once.
7. The stable identity is `transaction.id`. Never deduplicate or associate movements using date, amount, description or array position.
8. Payment/allocation records are subordinate details of a transaction. They must not create additional balance-impacting rows.
9. Preserve the existing frontend design, route structure, component styling and user workflow. This task is data correctness and routing, not a visual redesign.
10. Preserve check serial number, bank, due date, status, remaining amount and linked-invoice traceability.
11. Both screen and print/PDF must use the same correct ledger row set and totals.
12. Every database change must be expressed as a versioned migration. Never manually patch production data without a migration/backfill mechanism.
13. Do not expose service-role keys, Paraşüt tokens or secrets in logs, tests, browser bundles or commits.
14. Follow existing repository conventions, existing auth/RLS model, Edge Function patterns and deployment conventions.
15. Run the relevant tests, type checks and production build. Fix failures caused by this work. Do not suppress tests or weaken assertions.

## Confirmed diagnosis — treat these as established facts

The previous read-only browser investigation proved the following against live Paraşüt, Supabase and the shipped ERP bundle.

### Authoritative account-statement API

Paraşüt exposes a ready-made per-contact statement:

```text
GET /v4/{company_id}/contacts/{contact_id}/transaction_history_items
  ?include=transaction.sales_invoice,
           transaction.purchase_bill,
           transaction.reimbursement_purchase_bill,
           transaction.opening_balance,
           transaction.check,
           transaction.contact_transfer
  &page[size]=...
  &page[number]=...
```

The response contains:

- `data[]` transaction history items;
- each item’s authoritative running balances, including `attributes.trl_balance`;
- a relationship to one real `transaction`;
- included transactions and linked invoices, purchase bills, checks, opening balances and transfers.

Paraşüt itself renders one statement row per transaction. This endpoint—not reconstruction from invoices, allocations and checks—is the authoritative source for the customer running ledger.

### Stable model

```text
contact
  -> transaction_history_item
     -> transaction (stable transaction.id)
        -> sales_invoice
        -> purchase_bill
        -> reimbursement_purchase_bill
        -> opening_balance
        -> check
        -> contact_transfer
        -> payments / allocations (non-balance-impacting children)
```

Observed transaction types include:

- `sales_invoice`
- `purchase_bill`
- `check_in`
- `check_out`
- `contact_credit`
- `contact_debit`
- `contact_opening_balance_debit`
- `contact_opening_balance_credit`

Do not assume this list is exhaustive. Preserve unknown types safely and surface them with traceable metadata rather than dropping them silently.

### Existing sync defects

- Production sync has only six registered resources: `accounts`, `checks`, `contacts`, `products`, `purchase_bills`, `sales_invoices`.
- Across 14,344 historical sync runs there was no `transactions` or `payments` resource run.
- `parasut.transactions` exists but is empty because the resource was never requested.
- `payments` rows are only side-loaded from invoice/bill `included` arrays.
- Side-loaded payment relationships contain meta-only stubs; `payable` and `transaction` IDs are not present.
- Checks are requested with `include=[issued_by,given_to]` only. Their transaction/payment identity is unavailable in the current mirror.
- No `opening_balances` mirror table exists and opening balances are not synchronized.

### Existing frontend defects

- `CustomerDetailPage` reconstructs the ledger from invoices, bills, payments and checks.
- Check/allocation suppression is date-based and only runs when a date has exactly one check.
- Multiple checks on the same date are therefore counted again as both allocation rows and check rows.
- One real collection can be split into multiple ledger rows when it has multiple allocations.
- A derived opening-balance plug forces the closing total to match `contacts.trl_balance`, hiding all row-level errors.
- Screen and print/PDF share the same incorrect transformed row array.

## Primary implementation decision

Implement the transaction as the single balance-impacting ledger row.

- Exactly one rendered balance-impacting row per Paraşüt `transaction.id`.
- A `check_in` transaction renders as `Alınan Çek` and is the collection/credit movement.
- A `check_out` transaction renders as `Verilen Çek` and is the payment/debit movement.
- A `contact_credit` renders as one `Tahsilat` row even if it has multiple invoice allocations.
- A `contact_debit` renders as one `Tedarikçi Ödemesi` row even if it has multiple allocations.
- Opening balances render only from authentic `contact_opening_balance_*` transactions linked to a real Paraşüt opening-balance ID.
- Allocations may be shown as expandable/read-only child details linking the transaction to invoices/bills/opening balances. They contribute zero to the running balance.
- Use the history item’s authoritative `trl_balance` for validation and display consistency. If the locally computed running balance differs, show a clear reconciliation warning; do not insert any balancing row.

## Phase 0 — repository and safety baseline

1. Locate and read all applicable `AGENTS.md`, repository instructions and existing master-plan documentation.
2. Inspect `git status`, current branch, recent commits and remotes. Preserve unrelated changes.
3. Locate:
   - Paraşüt sync resource registry and pagination engine;
   - sync migrations and mirror schema;
   - `parasut-api` Edge Function and `customers/detail` route;
   - current customer-detail data types/providers;
   - `CustomerDetailPage` ledger transformation;
   - print/PDF statement builder;
   - existing tests for sync, Edge Functions, customer detail and accounting directions.
4. Record the exact current data path from Paraşüt API to Supabase to ERP before changing it.
5. Run the narrow baseline tests and note pre-existing failures separately.

Deliverable: a short repository-grounded implementation map in the engineering log/commit message, followed immediately by Phase 1 implementation.

## Phase 1 — design the mirror schema and migration

Design the smallest normalized schema that preserves the authoritative statement and stable identities. Reuse existing `parasut.transactions` if compatible; extend it rather than creating redundant competing tables.

At minimum persist:

### Transactions

- Paraşüt transaction ID as unique stable key;
- contact Paraşüt ID;
- transaction type;
- transaction date/time where supplied;
- description;
- `amount_in_trl`;
- original debit/credit amounts and currencies;
- unmatched debit/credit amount where supplied;
- linked check ID;
- linked sales invoice ID;
- linked purchase bill ID;
- linked reimbursement purchase bill ID;
- linked opening balance ID;
- linked contact transfer ID;
- raw relationships and raw payload;
- source timestamps, `last_seen_at`, `synced_at` and archival/tombstone semantics consistent with existing mirror tables.

### Transaction history items

Persist the contact-specific statement ordering and authoritative running balances. Use either a dedicated table or a rigorously justified equivalent representation. It must support:

- contact ID;
- transaction ID;
- stable history item ID if distinct;
- authoritative row order/date;
- `trl_balance`, `usd_balance`, `eur_balance`, `gbp_balance`;
- raw payload;
- sync timestamps;
- uniqueness preventing duplicate rows for the same statement item.

### Opening balances

Create a `parasut.opening_balances` mirror table if the resource objects cannot be safely and queryably preserved through transactions alone. Persist at least:

- opening-balance ID;
- currency;
- description;
- issue date;
- debit/credit type;
- net total;
- remaining;
- contact relationship if supplied/recoverable;
- raw payload and timestamps.

### Allocations

Do not depend on currently null typed columns. If the authoritative transaction response supplies transaction-to-payment/payable relationships, persist those identities. Prefer extending the existing payments model with real `transaction_parasut_id` and `payable_parasut_id` over creating duplicate payment rows. Enforce idempotency.

Migration requirements:

- indexes for contact/date/order and transaction joins;
- foreign keys where they will not break mirror ingestion order; otherwise document deferred integrity strategy;
- RLS/grants matching existing read-only Paraşüt mirror access;
- no destructive rewrite of existing financial tables;
- reversible/down-safe design where repository convention supports it;
- migration tests or schema assertions.

Commit Phase 1 only after migration/static checks pass.

## Phase 2 — implement authoritative synchronization

Inspect the actual Paraşüt client abstraction and implement the safest supported sync path.

### Required behavior

1. Register the missing transaction/history synchronization in the same engine used by existing resources.
2. Fetch all pages; never assume 25 records is complete.
3. Use resumable pagination/checkpoint behavior consistent with existing sync runs.
4. Upsert idempotently by stable Paraşüt IDs.
5. Persist the contact relationship and linked resource IDs.
6. Preserve raw payloads for auditability.
7. Record resource-level sync runs, observed/inserted/updated/error counts and page metadata.
8. Handle partial failure without deleting last-known-good statement rows.
9. Avoid N+1 contact requests if the Paraşüt `transactions` endpoint can provide a complete bulk source with contact relationships.
10. However, do not sacrifice the authoritative statement order and per-row running balances exposed by `transaction_history_items`.

### Required investigation inside implementation

Determine from existing API client behavior and safe read calls whether:

- `/transactions` supports complete pagination and contact relationships suitable for bulk sync;
- `transaction_history_items` must be synchronized per contact to preserve authoritative order/balances;
- a hybrid is required: bulk transactions plus per-contact history items.

Choose and document the design based on observed API responses, not assumptions. A likely correct design is bulk transaction ingestion plus per-contact history-item ingestion for statement order and balance assertions, but adapt to the proven API contract.

### Scope and credit control

Do not immediately perform an uncontrolled all-contact historical backfill. Implement bounded/resumable backfill mechanics first. For validation, synchronize only the four target contacts unless existing safe tooling makes the same API call inherently broader. Report estimated request/page count before any full production backfill.

Target contacts:

- PİNO MAKİNE — `1011029161`
- HİRA PARTS — `1010743830`
- BEKEM ÖZTEKNİK — `1011029140`
- bediz test — `1068984956`

Add unit/contract tests using captured representative fixtures with secrets removed. Fixtures must cover opening balance, multiple checks on one date, multiple allocations under one transaction, unallocated check, independent debit and independent credit.

Commit Phase 2 after sync tests pass.

## Phase 3 — backend customer-detail route

Extend the existing `parasut-api` customer detail response rather than creating a disconnected duplicate endpoint unless repository architecture clearly requires a new resource.

Return a typed authoritative statement collection containing, at minimum:

- transaction ID;
- history item ID/order;
- transaction type;
- date;
- description;
- debit amount;
- credit amount;
- currency/original amount metadata;
- authoritative `trl_balance`;
- linked resource IDs;
- check metadata: ID, serial, bank, issue date, due date, payment status, cashed/transferred flags, remaining amount;
- allocation details and payable links, explicitly marked non-balance-impacting;
- source/provenance fields sufficient to prove every row comes from Paraşüt.

Backend requirements:

- query by exact contact ID;
- deterministic ordering matching Paraşüt;
- no pagination truncation;
- no duplicate transaction IDs;
- preserve existing response fields temporarily if other UI consumers need them;
- introduce a typed versioned response or compatibility adapter when necessary;
- emit a reconciliation status comparing final history balance with `contacts.trl_balance`;
- never fabricate a movement when the history is incomplete;
- if history is unavailable/incomplete, return an explicit diagnostic state rather than silently falling back to the old reconstructed ledger.

Add Edge Function/data-access tests for all four contact shapes and unknown transaction types.

Commit Phase 3 after route tests pass.

## Phase 4 — frontend cari ekstre transformation

Replace the current document/allocation/check reconstruction with the authoritative statement collection.

Delete, do not patch:

- the date-based check/allocation attribution function;
- the `if (list.length !== 1) continue` behavior;
- all date/amount heuristics used for financial identity;
- the derived `Devir Bakiyesi (türetilmiş)` calculation and row;
- emission of one balance-impacting row per allocation fragment.

Implement:

1. One balance-impacting row per unique `transaction.id`.
2. Transaction-type-to-accounting-direction mapping grounded in Paraşüt:
   - sales invoice → Borç;
   - purchase bill → Alacak;
   - supplier payment / `contact_debit` → Borç;
   - customer collection / `contact_credit` → Alacak;
   - received check / `check_in` → Alacak;
   - issued check / `check_out` → Borç;
   - opening balance direction according to its native debit/credit transaction type.
3. Authentic opening-balance label without the word `türetilmiş` and with its Paraşüt source ID/provenance.
4. Check rows retaining serial, bank, maturity date, status, remaining/cashed information.
5. Allocation/invoice traceability as expandable detail or existing-style subordinate content that contributes zero to totals and running balance.
6. Independent collections/payments as single rows even when they have several allocations.
7. A visible reconciliation warning when:
   - duplicate/missing transaction IDs are detected;
   - computed closing balance differs from final history `trl_balance`;
   - final history balance differs from `contacts.trl_balance`;
   - sync data is partial/stale/incomplete.
8. No warning when fully reconciled.

Do not redesign the page. Reuse existing table, badges, typography, sorting and responsive behavior. Change only what is necessary to communicate correct provenance, allocation detail and reconciliation state.

The statement order must match Paraşüt. If a UI sort is offered, running balances must remain mathematically tied to the chronological sequence; do not show a misleading running balance after arbitrary sorting.

Add focused frontend tests for row identity, directions, totals, duplicate prevention, warning behavior and exact descriptions.

Commit Phase 4 after frontend tests pass.

## Phase 5 — print/PDF parity

Refactor the print/PDF builder to consume exactly the same final authoritative view model as the screen.

Requirements:

- identical transaction IDs, row count, order, debit/credit amounts, running balances and totals;
- no derived opening balance;
- no duplicated allocation/check rows;
- check serial, bank, due date and status preserved;
- authentic opening-balance description preserved;
- reconciliation warning included prominently if the screen has one;
- allocations may appear as subordinate detail but must not alter totals;
- customer-facing output must not claim full reconciliation when data is incomplete.

Add a deterministic print-model test or snapshot that compares screen view-model rows with print rows field by field.

Commit Phase 5 after parity tests pass.

## Phase 6 — controlled backfill and data verification

Use the implemented bounded sync/backfill mechanism for only the four target contacts first. Do not mutate Paraşüt.

Before running any production-affecting Supabase migration or backfill, follow the repository’s established deployment process and safety checks. If credentials/environment are unavailable, complete the code/migration/tests and provide exact commands rather than inventing success.

After sync, verify directly in Supabase:

- transaction/history rows exist for all four contacts;
- each history item links to exactly one transaction;
- PİNO opening balance and bediz test independent supplier payment exist with exact IDs;
- multiple same-date checks have distinct transaction IDs;
- no duplicate history items;
- final authoritative history balance matches `contacts.trl_balance`;
- opening-balance and check metadata are populated;
- sync runs report accurate counts and no silent errors.

Do not perform the full-company backfill until the four-contact reconciliation is proven and the request/page estimate is documented.

Commit any required bounded-backfill tooling separately.

## Phase 7 — mandatory acceptance matrix

The following values are authoritative and must pass exactly to the kuruş.

### PİNO MAKİNE — `1011029161`

- Total Borç: `2,919,100.00 TRY`
- Total Alacak: `1,991,990.89 TRY`
- Closing balance: `927,109.11 TRY Borç`
- Balance-impacting statement rows: exactly `23`
- Exactly one authentic opening-balance row:
  - transaction `1113769850`
  - opening balance `1001079721`
  - date `2024-01-01`
  - description `Firmanın borcu var`
  - Borç `31,840.00 TRY`
- Received check `1000608751`, transaction `1113788767`, amount `400,000.00 TRY`, must be one row.
- Its four allocations total exactly `400,000.00`: `31,840.00 + 86,400.00 + 71,520.00 + 210,240.00` and do not alter the balance separately.
- On `2025-12-02`, exactly two received-check rows:
  - transaction `1179268982`, check `1000960165`, `73,345.00`;
  - transaction `1179269242`, check `1000960167`, `17,858.00`.
- No additional `Tahsilat` rows for those two check movements.
- The `2026-08-10` collection is one row:
  - transaction `1245892816`
  - `200,000.00 TRY`
  - its `162,490.89 + 37,509.11` allocations are details only.
- No synthetic `123,043.00` opening row.

### HİRA PARTS — `1010743830`

- Total Borç: `6,222,758.40 TRY`
- Total Alacak: `5,823,638.40 TRY`
- Closing balance: `399,120.00 TRY Borç`
- No opening-balance row unless the live authoritative history explicitly supplies one.
- Purchase invoice `HRP2025000000015` appears as Alacak `73,500.00`.
- Its supplier payment appears as Borç `73,500.00`.
- Determine and assert the exact Paraşüt transaction row count during controlled validation; record it in the test fixture/report rather than leaving it unverified.
- Existing correct dual-role customer/supplier behavior must remain correct.

### BEKEM ÖZTEKNİK — `1011029140`

- Total Borç: `953,459.98 TRY`
- Total Alacak: `795,550.00 TRY`
- Closing balance: `157,909.98 TRY Borç`
- Balance-impacting statement rows: exactly `21`
- No opening-balance row.
- On `2025-03-24`, exactly two received-check rows of `125,000.00` with distinct identities:
  - transaction `1122348804`, check `1000654010`;
  - transaction `1122350043`, check `1000654014`.
- On `2026-03-16`, exactly two received-check rows:
  - transaction `1206052687`, check `1001106563`, `100,000.00`;
  - transaction `1206053752`, check `1001106579`, `82,400.00`.
- No extra Tahsilat/allocation rows on those dates.
- No synthetic `432,400.00` opening row.

### bediz test — `1068984956`

- Total Borç: `1,000,000.00 TRY`
- Total Alacak: `1,000,000.00 TRY`
- Closing balance: `0.00 TRY`
- Balance-impacting statement rows: exactly `2`
- Row 1:
  - transaction `1249095985`
  - type `contact_debit`
  - date `2026-08-22`
  - Borç `1,000,000.00`
  - label as supplier payment
  - unmatched debit amount `1,000,000.00`
- Row 2:
  - transaction `1249096023`
  - check `1001339640`
  - type `check_in`
  - Alacak `1,000,000.00`
  - maturity `2026-08-31`
  - unpaid status preserved
- No opening-balance row.

### Global assertions

1. Every balance-impacting rendered row carries a non-null Paraşüt transaction ID.
2. No two rendered rows share a transaction ID.
3. Screen and print/PDF contain the same balance-impacting transaction IDs in the same order.
4. Computed closing balance equals both the final history item `trl_balance` and `contacts.trl_balance`.
5. Any mismatch produces a visible warning and never a synthetic row.
6. Allocation details do not contribute to debit, credit or balance totals.
7. Sum of allocations equals transaction amount minus unmatched amount where the source contract supports that equation; handle currency/exchange-rate semantics explicitly.
8. Same-date and same-amount checks remain distinct by transaction ID.
9. Unknown transaction types are not silently discarded.
10. No current hardcoded/demo financial data is introduced.

## Phase 8 — complete regression and quality gates

Run all relevant checks available in the repository, including:

- migration/schema tests;
- sync mapper and pagination tests;
- Edge Function/data-access tests;
- frontend unit/component tests;
- TypeScript type check;
- lint where configured;
- production build;
- any existing Paraşüt contract/scope-confinement tests;
- tests proving no write capability was added to the read-only reconciliation path.

Then search the repository for remnants of:

- `Devir Bakiyesi (türetilmiş)`;
- carry-forward balancing formulas;
- date-only check matching;
- `list.length !== 1` dedup logic;
- allocation rows affecting the account-statement totals.

Remove obsolete code and update affected documentation/types without unrelated refactoring.

## Phase 9 — final engineering report

Finish with a concise but evidence-backed report containing:

1. Root cause and final architecture.
2. Exact files and migrations changed.
3. Database objects added/altered.
4. Sync resources/endpoints registered and pagination strategy.
5. Backend response changes.
6. Frontend and print/PDF behavior changes.
7. Four-contact reconciliation table with actual observed row counts/totals.
8. Test/build commands and results.
9. Commit hashes in order.
10. Any deployment/backfill commands still requiring an authorized environment.
11. Estimated request/page count for a full-company backfill.
12. Remaining risks or explicitly unverified items.

Do not claim a production deployment, backfill or live verification unless it was actually executed and observed. If blocked, leave the repository in a tested, committed, deployment-ready state and provide the exact next command.

## Definition of done

This task is done only when:

- the transaction-based source is implemented end to end;
- authentic opening balances and independent payments are supported;
- checks remain visible and count exactly once;
- synthetic carry-forward rows and date heuristics are gone;
- screen and print/PDF agree;
- all four customer acceptance cases pass exactly;
- tests and production build pass;
- work is committed in safe incremental commits;
- the final report identifies any operation not actually performed.

Begin now with Phase 0 and continue through every phase without waiting for further instruction.
