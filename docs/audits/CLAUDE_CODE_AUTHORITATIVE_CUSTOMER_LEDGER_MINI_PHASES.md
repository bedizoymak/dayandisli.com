# CLAUDE CODE — AUTHORITATIVE CUSTOMER LEDGER MINI PHASES

Repository:
`C:\Users\Bediz\Documents\dayandisli.com`

## Goal

Complete the customer ledger and print output using Paraşüt's authoritative transaction-history data already mirrored in Supabase. The implementation must remain generic, dynamic, and valid for every contact.

## Verified source contract

Paraşüt uses this internal endpoint:

```http
GET /v4/{company_id}/contacts/{contact_id}/transaction_history_items
```

Includes:

```text
transaction.sales_invoice
transaction.purchase_bill
transaction.reimbursement_purchase_bill
transaction.opening_balance
transaction.check
transaction.contact_transfer
```

Supabase source chain:

```text
parasut.transaction_history_items
→ parasut.transactions
→ parasut.opening_balances / sales_invoices / purchase_bills / checks / payments
→ parasut.contacts.trl_balance
```

Verified production evidence for PİNO (`1011029161`), used only as acceptance evidence:

```text
PDF rows: 23
DB rows: 23
Row mismatches: 0
Total debit: 2,919,100.00
Total credit: 1,991,990.89
Closing balance: 927,109.11 debit
Opening transaction: 1113769850
Opening balance resource: 1001079721
```

## Non-negotiable rules

- Never add contact-specific logic or hardcoded financial data.
- Do not reconstruct the ledger from invoice/payment dates.
- One displayed balance movement per `transaction.id`.
- Use `statement_order` for authoritative ordering.
- Use each history item's authoritative `trl_balance` directly.
- Do not treat payment allocations as separate balance movements.
- Do not sum both raw transaction sides to produce ledger totals. Some contact transactions contain equal debit and credit amounts. Determine the displayed movement from consecutive authoritative running balances, while preserving the transaction identity and linked resource.
- Read descriptions and metadata dynamically from linked resources.
- Missing metadata must be omitted, never invented.
- Do not write to Paraşüt or Supabase.
- Do not deploy.
- Keep each phase minimal and commit it separately.

## Mini Phase 1 — Confirm the existing financial path

Trace the current backend → statement response → screen → print path.

If it already follows the verified source contract, do not rewrite it. Remove or replace only any remaining derived opening-balance, date-matching, allocation-row, or raw-double-sided-total logic.

The current PİNO values must remain unchanged.

Commit and continue.

## Mini Phase 2 — Complete dynamic row metadata

Use linked Supabase resources to populate, when available:

- Invoice number and description
- Invoice line details
- Opening-balance description
- Check bank name, serial number, due date, and status
- Payment description
- Contact-transfer description
- Unknown transaction type without hiding the row

The screen and print output must consume the same normalized row model.

Do not hardcode the known PİNO checks or banks.

Commit and continue.

## Mini Phase 3 — Fix the print document

Fix only the print/output defects:

- Replace `Page 0 / 0` with correct page numbering.
- Prevent the application from printing duplicate internal page numbering.
- Remove application-controlled debug/blob URL text from the printable document.
- Keep browser-controlled headers/footers outside application logic; do not claim CSS can override the user's browser print-header setting.
- Preserve all financial rows and totals.

Commit and stop.

## Final report

Report only:

- Root causes fixed
- Changed files
- Commit hashes by mini phase
- Confirmation that no customer-specific logic was added
- Confirmation that PİNO remains 23 rows with `2,919,100.00 / 1,991,990.89 / 927,109.11`
- Confirmation that no deploy or write operation was performed

