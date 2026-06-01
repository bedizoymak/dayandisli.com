# Phase 8 Finance and Accounting Workflows Report

Date: 2026-06-01  
Scope: finance, accounting, invoicing, expense management, cash and bank foundation.  
Constraints followed: no permissions, no advanced BI/reporting, no payroll, no duplicate tables, no duplicate APIs.

## Implemented Workflows

### Invoicing

Implemented on the existing `/invoices` screen:

- Faturalar
- Taslak Faturalar
- Gönderilen Faturalar
- Tahsil Edilen Faturalar
- Geciken Faturalar
- İptal Edilen Faturalar
- Invoice lifecycle status updates.
- Customer/cari linkage through `stakeholder_id`.
- Order linkage where available by writing the selected sales order reference into invoice notes.
- Search by invoice number, cari name, and notes.
- Type filter for sales/purchase invoices.
- Due-date based overdue invoice view.
- Invoice notes.

### Accounting

Implemented on the existing `/finans` accounting/finance screen:

- Hesap Planı foundation.
- Muhasebe Fişleri derived from existing financial transactions.
- Yevmiye Kayıtları derived from existing debit/credit transaction fields.
- Finansal Hareketler using existing transaction table UI.
- Cari Hesaplar using existing parties/cari structures.
- Dönemsel Hareketler derived from transaction dates.
- Search by cari, reference, and description.
- Account type filtering for official/operational tracking.
- Transaction history visibility.

### Expense Management

Implemented on the existing `/payments` screen:

- Gider Kategorileri.
- Gider Kayıtları.
- Gider Talepleri.
- Onay Bekleyen Giderler.
- Ödeme Durumları.
- Expense categorization through structured text in the existing payment description field.
- Expense lifecycle foundation using account assignment and request/approval-ready views.
- Notes through payment descriptions.
- Search and filters.

### Cash and Bank Foundation

Implemented on the existing `/payments` screen:

- Kasa Hesapları.
- Banka Hesapları.
- Para Girişleri.
- Para Çıkışları.
- Transfer Hareketleri.
- Simple financial account creation using existing `financial_accounts`.
- Cash/bank movement visibility through existing `payments`.
- Transfer-ready foundation through payment descriptions containing transfer metadata.

## Finance Architecture

The Phase 8 finance architecture continues to use the two existing finance layers already present in the repo:

- ERP finance tables:
  - `financial_accounts`
  - `invoices`
  - `payments`

- Existing operational finance/cari tables:
  - `parties`
  - `financial_transactions`
  - `payment_documents`

No new tables were added. No second accounting model was introduced.

## Accounting Architecture

Accounting views are derived from the existing transaction model:

- Account plan is a lightweight operational mapping for common Turkish account categories.
- Accounting vouchers are shown from `financial_transactions`.
- Journal rows are shown from `financial_transactions.transaction_type`.
- Cari balances are calculated from existing finance transaction helpers.
- Period summaries are grouped by transaction month.

This keeps the architecture ready for formal ledgers later without inventing parallel accounting records now.

## Expense Architecture

Expense workflows reuse `payments` where:

- `payment_type = payment` represents money out.
- `description` stores category and notes.
- Missing `financial_account_id` represents request/account-assignment pending state.
- Assigned financial account represents payment-ready or paid operational state.

This is intentionally simple and future-ready for a dedicated expense request table later.

## Supabase Table Mapping

### `invoices`

Used for:

- Invoice lifecycle.
- Draft/sent/paid/partial/cancelled statuses.
- Customer/cari linkage.
- Due-date overdue tracking.
- Notes and order reference storage.

### `payments`

Used for:

- Collections.
- Payments.
- Expense records.
- Cash and bank money movements.
- Transfer-ready movement labeling.
- Invoice payment relationship through `related_invoice_id` where available.

### `financial_accounts`

Used for:

- Cash accounts.
- Bank accounts.
- Account balance foundation.
- Multi-bank readiness.

### `financial_transactions`

Used for:

- Accounting vouchers.
- Journal entries.
- Financial movements.
- Period movement summaries.

### `parties`

Used for:

- Cari accounts.
- Customer/supplier balances.

### `payment_documents`

Still used by existing finance pages for cheque/promissory note tracking.

## Workflow Diagrams

### Sales to Invoice

```text
Satış Siparişi
  -> Fatura
  -> Gönderildi / Kısmi / Tahsil Edildi
```

### Invoice to Collection

```text
Fatura
  -> Tahsilat
  -> Kasa/Banka Hareketi
  -> Cari Hesap Güncelleme Temeli
```

### Expense to Payment

```text
Gider Talebi
  -> Onay Bekleyen Gider
  -> Ödeme
  -> Kasa/Banka Çıkışı
```

### Cash/Bank to Financial Movement

```text
Kasa/Banka
  -> Para Girişi / Para Çıkışı / Transfer
  -> Finansal Hareket
  -> Dönemsel İzleme
```

## Remaining Gaps

- Invoices do not yet have a real `sales_order_id` column; order linkage is stored in notes for now.
- There is no dedicated expense request table.
- There is no dedicated account plan table.
- Payment reconciliation is not implemented.
- Tax calculation automation is not implemented.
- E-invoice integration is not implemented.
- Advanced accounting reports are not implemented.
- Multi-currency revaluation is not implemented.
- Payroll is intentionally not implemented.

## Risks

- Supabase generated types are still stale from Phase 6; several ERP finance APIs still require casts.
- Using invoice notes for order linkage is a bridge, not a final relational model.
- Using payment descriptions for expense category/transfer metadata is simple but should become structured before audit-heavy use.
- Formal accounting needs stronger debit/credit constraints before production accounting closure.
- Account balances are not automatically reconciled across every payment flow yet.

## Recommendations

- Add relational columns or link tables for invoice-to-order relationships.
- Add an `expense_requests` table before approval workflows.
- Add a formal `chart_of_accounts` table before statutory accounting expansion.
- Add payment reconciliation fields for bank statement matching.
- Add tax fields and e-invoice metadata before e-invoice integrations.
- Regenerate Supabase types before deeper finance refactors.

## Proposed Phase 9 Scope

Recommended Phase 9: relational finance hardening and workflow approvals.

Suggested scope:

- Invoice-to-sales-order link table or column.
- Dedicated expense request lifecycle table.
- Chart of accounts table.
- Payment reconciliation foundation.
- Bank statement import-ready structure.
- Tax calculation fields.
- E-invoice metadata foundation.
- Continue Turkish UI audit.

Deferred beyond Phase 9:

- Permissions and approval enforcement.
- Advanced BI/reporting.
- Payroll.
- Full statutory accounting close.
- Full e-invoice provider integration.

## Validation

Command:

```bash
npm run build
```

Result:

- Passed.

Known warnings remain:

- Browserslist/caniuse-lite data is stale.
- `pdfjs-dist` eval warning.
- Main bundle exceeds Vite's 500 kB chunk warning threshold.

