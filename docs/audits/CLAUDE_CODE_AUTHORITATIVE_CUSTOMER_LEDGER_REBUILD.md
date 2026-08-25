# Authoritative Paraşüt Customer Ledger Rebuild

## Mission

Rebuild the ERP customer ledger/account-statement data path so that it follows the same authoritative data model as Paraşüt. This is a financial correctness task. Do not patch the current frontend calculation, invoice list, or cached UI data to make a screen look correct.

The ERP must render customer statements from Paraşüt's canonical transaction-history data, preserve Paraşüt order and balances, and visibly fail closed when the mirror is incomplete.

## Scope and exclusions

In scope only:

- Customer detail page ledger / `Müşteri Hareketleri` / account statement.
- Paraşüt transaction-history sync, Supabase mirror mapping, secure ERP read model, statement print/export only if it currently consumes the broken ledger model.
- Reconciliation for the four provided customer statement PDFs, with PİNO Makine mandatory first reference.

Out of scope:

- Quotes, checks module UI, invoices list UI, suppliers, dashboard, unrelated routing, visual redesign, Paraşüt write operations, migrations unrelated to the ledger, or broad refactoring.
- Do not alter production data manually and do not delete/recreate existing mirror data.

## Hard financial rules

1. The canonical source is the Paraşüt customer transaction-history endpoint:

   ```text
   GET /v4/{company_id}/contacts/{contact_id}/transaction_history_items
   ```

2. Fetch all pages. The observed source contract uses JSON:API and returns `data`, `included`, and `meta` with `current_page`, `total_pages`, `total_count`, and `per_page`.

3. The ERP statement row source is `parasut.transaction_history_items`, never an invoice-only reconstruction.

4. Preserve Paraşüt ordering exactly:

   ```sql
   ORDER BY statement_order DESC -- newest first, same direction as Paraşüt UI
   ```

   Use `ASC` only for an explicitly requested classic oldest-first print layout. Never sort by `date`, and never use date as a tie-breaker.

5. `transaction_history_items.trl_balance` is the authoritative post-row TRY running balance. Display it directly. Do not recompute it from invoices, payments, checks, or frontend arithmetic.

6. Closing balance is the `trl_balance` at `statement_order = 0` (newest row) and must equal `parasut.contacts.trl_balance` as a validation assertion.

7. `transactions.amount_in_trl` is the statement amount. Statement side is determined only by `transactions.transaction_type`; never infer the side from `debit_amount` or `credit_amount` because both can be populated on contact movements.

8. Mandatory side map:

   ```text
   Debit / Borç:
   - sales_invoice
   - contact_debit
   - contact_opening_balance_debit

   Credit / Alacak:
   - check_in
   - contact_credit
   - purchase_bill
   ```

   Any other transaction type must be explicitly mapped from observed Paraşüt evidence or rendered as an unmapped, visible integrity error. Do not guess.

9. All linked-document joins are `LEFT JOIN`s. A missing linked document must not remove a ledger row; render its date, transaction type and amount with an empty/fallback description and report the missing relation.

10. Never filter ledger rows by a linked document's archive state. Paraşüt defines the ledger set server-side. Archive/cancellation may be shown as a marker, but local filtering would desynchronise totals.

11. If any row for a requested customer has a null/missing `statement_order` or `trl_balance`, do not render a partial statement. Show a clear sync-integrity state and direct the operator to a safe resync path.

## Authoritative Supabase mapping

Use the mirror below. Verify each field against the actual production schema and current sync implementation before changing anything.

```text
parasut.transaction_history_items
  contact_parasut_id          statement filter
  parasut_id                  canonical ledger-row identity
  transaction_parasut_id      join to transactions
  statement_order             authoritative order
  transaction_date            display date only
  trl_balance                 authoritative TRY running balance
  usd_balance/eur_balance/gbp_balance

parasut.transactions
  parasut_id
  transaction_type            statement side + label source
  date
  amount_in_trl               statement amount
  description                 fallback description
  debit_amount/debit_currency/credit_amount/credit_currency  informational only
  sales_invoice_parasut_id
  purchase_bill_parasut_id
  check_parasut_id
  opening_balance_parasut_id
  reimbursement_purchase_bill_parasut_id
  contact_transfer_parasut_id

parasut.sales_invoices
  parasut_id, invoice_no, issue_date, currency, exchange_rate,
  net_total, description, item_type, source_archived

parasut.purchase_bills
  parasut_id, invoice_no, issue_date, currency, exchange_rate,
  net_total, description, item_type, source_archived

parasut.checks
  parasut_id, bank_identifier, bank_name, serial_number,
  issue_date, due_date, payment_status, is_in

parasut.opening_balances
  parasut_id, net_total, issue_date, description, debit_credit_type

parasut.contacts
  parasut_id, name, short_name, tax_number, tax_office,
  address, city, district, balance, trl_balance
```

Required join chain:

```text
transaction_history_items
  LEFT JOIN transactions
  LEFT JOIN sales_invoices
  LEFT JOIN purchase_bills
  LEFT JOIN checks
  LEFT JOIN opening_balances
```

## Description and presentation rules

- Sales invoice: use `sales_invoices.invoice_no` as primary description.
- Purchase bill: use `purchase_bills.invoice_no` as primary description.
- Received check: compose `coalesce(bank_name, bank_identifier)` and `serial_number` when available.
- Opening balance: use `opening_balances.description`.
- Contact debit/credit: use `transactions.description` as fallback; do not invent a linked invoice.
- UI labels are a translation of `transaction_type`, not an independent data source.

## Date ranges, accounts, print and export

- The live ledger-list endpoint has no observed date or bank-account row filter. Do not pretend that account selection changes statement rows.
- Paraşüt's statement PDF generation uses:

  ```text
  POST /v4/{company_id}/contacts/{contact_id}/tx_history_pdf
  ```

  with observed options `from`, `to`, `show_descriptions`, `show_details`, `account_ids`.

- `account_ids` selects IBANs printed on the PDF; it does not filter statement rows.
- Paraşüt backend regenerates the PDF asynchronously from filters; it does not accept browser-supplied rows. Our ERP must produce its own statement/PDF from the authoritative Supabase mirror; do not proxy or store ephemeral Paraşüt signed export URLs.
- For a date-filtered ERP statement, do not invent an opening balance. Determine it from the authoritative prior ledger row only after proving the exact filter semantics against Paraşüt; otherwise mark this capability as not yet supported.

## Mandatory PİNO reconciliation gate

Reference customer:

```text
PİNO MAKİNE SANAYİ VE TİCARET LİMİTED ŞİRKETİ
contact_id: 1011029161
company_id: 666034
```

Before deployment, prove all of these from both Paraşüt source/mirror and the ERP read model:

```text
Rows:            23
Debit:            2,919,100.00 TRY
Credit:           1,991,990.89 TRY
Closing balance:    927,109.11 TRY
```

PİNO row-type census:

```text
sales_invoice:                 8
contact_credit:                6
check_in:                      4
contact_debit:                 3
purchase_bill:                 1
contact_opening_balance_debit: 1
total:                        23
```

Important correction: an invoice-and-collection-only implementation misses **9 of 23 rows** for PİNO: 3 `contact_debit`, 1 opening balance, 1 purchase bill and 4 received checks. It is not acceptable to call this a five-row gap.

## Investigation and implementation sequence

1. Read the current customer-detail component, current ledger query/API path, Paraşüt sync path, database schema, RLS/grants and existing tests.
2. Identify why the UI currently says transaction history is not synchronized even though the authoritative mirror exists; document the exact broken query, filter, route-ID mismatch, RLS issue, or missing sync resource before modifying it.
3. Implement the smallest secure server/read-model path that exposes only a complete authoritative statement for the requested tenant/customer. Do not expose `parasut` tables directly to the browser.
4. Repair/extend sync only if actual field/data gaps are proven. Preserve idempotency, tenant isolation and no-write-to-Paraşüt behavior.
5. Wire the customer card to the new model. Preserve existing page visual design unless a functional integrity state needs to be shown.
6. Add focused tests for mapping, ordering, missing relations, transaction-type side map, incomplete-sync state, tenant isolation and PİNO reconciliation.
7. Test the other three supplied customer statement PDFs after PİNO. Report each matching/mismatching row and total; do not change mapping rules merely to fit an individual customer.
8. Run `npm ci`, `npx tsc --noEmit`, `npm run typecheck`, relevant tests, full test suite and `npm run build`.
9. Commit/push only after the gates pass. Deploy only after a clean, evidence-backed report.

## Required continuous implementation report

Create and update this separate root-level file throughout the work:

```text
CLAUDE_CODE_CUSTOMER_LEDGER_REBUILD_REPORT.md
```

Do not put this report inside the implementation prompt file. It is the only status artifact that will be handed back for review.

After each meaningful discovery, code change, test result, blocker or deployment action, append a timestamped entry containing:

```text
## [timestamp] Short action title
- Status: discovered | changed | tested | blocked | deployed
- Exact files/tables/endpoints touched or inspected
- Evidence: observed data, query result, test result or source path
- Decision and reason
- What was intentionally not changed
- Next concrete action
```

The report must finish with:

1. Root cause of the original empty customer ledger.
2. Exact production data path now used by the ERP.
3. Paraşüt-to-Supabase field map actually implemented.
4. Reconciliation table for PİNO and the other three supplied statements.
5. Test/build/CI/deploy results.
6. Remaining limitations, explicitly labelled as `NOT VERIFIED` or `BLOCKED`.
7. Commit SHA, deploy status and production URLs checked.

## Non-negotiable safety constraints

- No Paraşüt mutations.
- No direct browser access to protected mirror tables.
- No guessed matching by customer name, amount or date.
- No hardcoded customer rows/totals.
- No fallback to mock data.
- No silent partial ledger.
- Do not remove unrelated user changes from the worktree.
