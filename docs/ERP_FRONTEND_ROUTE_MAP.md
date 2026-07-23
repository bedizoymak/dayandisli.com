# ERP frontend route migration map

`src/features/ebru-demo/**` is the immutable golden implementation. Canonical
routes are rendered by `src/features/ebru-preview/EbruPreviewPage.tsx` and
`EbruRouteContent.tsx`.

| Demo route | Canonical production route | Demo component | Current production component | Migration status |
|---|---|---|---|---|
| `/apps/demo` | `/apps` | `EbruPreviewPage` dashboard | `EbruPreviewPage` live dashboard | Migrated |
| `/apps/demo/finance` | `/apps/finance` | `FinanceOverview` | `FinanceOverview` | Migrated, live dashboard adapter |
| `/apps/demo/finance/income/invoices` | `/apps/finance/income/invoices` | `InvoiceListPage` | `CanonicalParasutListPage(invoices)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/income/invoices/new` | `/apps/finance/income/invoices/new` | `SalesInvoiceForm` | `SalesInvoiceForm` | Presentation matched; approved write path retained |
| `/apps/demo/finance/income/customers` | `/apps/finance/income/customers` | `CustomerListPage` | `CanonicalParasutListPage(customers)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/income/customers/new` | `/apps/finance/income/customers/new` | `CustomerFormPage` | `CustomerFormPage` | Presentation matched; approved write path retained |
| `/apps/demo/finance/income/collection-report` | `/apps/finance/income/collection-report` | `CollectionReportPage` | `CanonicalFinanceReportPage(collections)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/finance/expense/list` | `/apps/finance/expense/list` | `ExpenseListPage` | `CanonicalParasutListPage(expenses)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/expense/list/new/invoice` | `/apps/finance/expense/list/new/invoice` | `ExpenseInvoicePage` | `ExpenseInvoicePage` | Presentation matched; approved write path retained |
| `/apps/demo/finance/expense/list/new/payroll` | `/apps/finance/expense/list/new/payroll` | `SimpleExpenseForm` | `SimpleExpenseForm(payroll)` | Presentation matched |
| `/apps/demo/finance/expense/list/new/tax` | `/apps/finance/expense/list/new/tax` | `SimpleExpenseForm` | `SimpleExpenseForm(tax)` | Presentation matched |
| `/apps/demo/finance/expense/list/new/bank-expense` | `/apps/finance/expense/list/new/bank-expense` | `SimpleExpenseForm` | `SimpleExpenseForm(bank)` | Presentation matched |
| `/apps/demo/finance/expense/list/new/other` | `/apps/finance/expense/list/new/other` | `SimpleExpenseForm` | `SimpleExpenseForm(other)` | Presentation matched |
| `/apps/demo/finance/expense/list/new/accommodation` | `/apps/finance/expense/list/new/accommodation` | `ExpenseInvoicePage` | `ExpenseInvoicePage(accommodation)` | Presentation matched |
| `/apps/demo/finance/expense/incoming-invoices` | `/apps/finance/expense/incoming-invoices` | `IncomingInvoicesPage` | `CanonicalParasutListPage(purchaseBills)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/expense/income-expense-report` | `/apps/finance/expense/income-expense-report` | `IncomeExpenseReportPage` | `CanonicalFinanceReportPage(incomeExpense)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/finance/expense/payments-report` | `/apps/finance/expense/payments-report` | `PaymentsReportPage` | `CanonicalFinanceReportPage(payments)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/finance/expense/vat-report` | `/apps/finance/expense/vat-report` | `VatReportPage` | `CanonicalFinanceReportPage(vat)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/finance/inventory/products` | `/apps/finance/inventory/products` | `ProductsPage` | `CanonicalParasutListPage(products)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/inventory/products/new` | `/apps/finance/inventory/products/new` | `ProductFormPage` | `ProductFormPage` | Presentation matched; approved write path retained |
| `/apps/demo/finance/inventory/outgoing-dispatches` | `/apps/finance/inventory/outgoing-dispatches` | `DispatchesPage(outgoing)` | `CanonicalParasutListPage(shipments)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/inventory/outgoing-dispatches/new` | `/apps/finance/inventory/outgoing-dispatches/new` | `DispatchFormPage(outgoing)` | `DispatchFormPage(outgoing)` | Presentation matched |
| `/apps/demo/finance/inventory/incoming-dispatches` | `/apps/finance/inventory/incoming-dispatches` | `DispatchesPage(incoming)` | `CanonicalParasutListPage(shipments)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/inventory/incoming-dispatches/new` | `/apps/finance/inventory/incoming-dispatches/new` | `DispatchFormPage(incoming)` | `DispatchFormPage(incoming)` | Presentation matched |
| `/apps/demo/finance/inventory/history` | `/apps/finance/inventory/history` | `StockHistoryPage` | `CanonicalParasutListPage(stockHistory)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/inventory/report` | `/apps/finance/inventory/report` | `StockReportPage` | `CanonicalParasutListPage(inventory)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/purchasing/suppliers` | `/apps/finance/purchasing/suppliers` | `SuppliersPage` | `CanonicalParasutListPage(suppliers)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/purchasing/suppliers/new` | `/apps/finance/purchasing/suppliers/new` | `SupplierFormPage` | `SupplierFormPage` | Presentation matched; approved write path retained |
| `/apps/demo/finance/purchasing/orders` | `/apps/finance/purchasing/orders` | `OrdersPage` | `CanonicalParasutListPage(purchaseBills)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/purchasing/orders/new` | `/apps/finance/purchasing/orders/new` | `OrderFormPage` | `OrderFormPage` | Presentation matched |
| `/apps/demo/finance/cash/accounts` | `/apps/finance/cash/accounts` | `CashAccountsPage` | `CanonicalParasutListPage(accounts)` | Migrated, live Paraşüt adapter |
| `/apps/demo/finance/cash/checks` | `/apps/finance/cash/checks` | `ChecksPage` | `ChecksPage` | Presentation matched; no Paraşüt check-list resource |
| `/apps/demo/finance/cash/checks/new` | `/apps/finance/cash/checks/new` | `CheckFormPage` | `CheckFormPage` | Presentation matched |
| `/apps/demo/finance/cash/cash-bank-report` | `/apps/finance/cash/cash-bank-report` | `CashBankReportPage` | `CanonicalFinanceReportPage(cash)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/finance/cash/cash-flow-report` | `/apps/finance/cash/cash-flow-report` | `CashFlowReportPage` | `CanonicalFinanceReportPage(cash)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/crm/customers` | `/apps/crm/customers` | CRM `CustomerListPage` | `CanonicalParasutListPage(customers)` | Migrated, live Paraşüt adapter |
| `/apps/demo/crm/customers/new` | `/apps/crm/customers/new` | CRM `CustomerFormPage` | CRM `CustomerFormPage` | Presentation matched; approved write path retained |
| `/apps/demo/crm/customers/:id` | `/apps/crm/customers/:id` | `CustomerDetailPage` | `CustomerDetailPage` | Migrated, live customer adapter |
| `/apps/demo/crm/customers/:id/edit` | `/apps/crm/customers/:id/edit` | `CustomerFormPage(edit)` | `CustomerFormPage(edit)` | Presentation matched; approved write path retained |
| `/apps/demo/sales/quotes` | `/apps/sales/quotes` | `QuotesPage` | `CanonicalParasutListPage(offers)` | Migrated, live Paraşüt adapter |
| `/apps/demo/sales/quotes/new` | `/apps/sales/quotes/new` | `QuoteFormPage` | `QuoteFormPage` | Presentation matched; approved write path retained |
| `/apps/demo/sales/quotes/:id` | `/apps/sales/quotes/:id` | `QuoteDetailPage` | `QuoteDetailPage` | Presentation matched |
| `/apps/demo/sales/quotes/:id/edit` | `/apps/sales/quotes/:id/edit` | `QuoteFormPage` | `QuoteFormPage` | Presentation matched |
| `/apps/demo/sales/quotes/:id/print` | `/apps/sales/quotes/:id/print` | `QuotePrintPage` | `QuotePrintPage` | Presentation matched |
| `/apps/demo/sales/orders` | `/apps/sales/orders` | `SalesOrdersPage` | `SalesOrdersPage` | Presentation matched |
| `/apps/demo/sales/orders/new` | `/apps/sales/orders/new` | `SalesOrderFormPage` | `SalesOrderFormPage` | Presentation matched |
| `/apps/demo/sales/activities` | `/apps/sales/activities` | `SalesActivitiesPage` | `SalesActivitiesPage` | Presentation matched |
| `/apps/demo/reports/collections` | `/apps/reports/collections` | `CollectionReportPage` | `CanonicalFinanceReportPage(collections)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/reports/income-expense` | `/apps/reports/income-expense` | `IncomeExpenseReportPage` | `CanonicalFinanceReportPage(incomeExpense)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/reports/cash-bank` | `/apps/reports/cash-bank` | `CashBankReportPage` | `CanonicalFinanceReportPage(cash)` | Migrated, live Paraşüt report adapter |
| `/apps/demo/reports/production` | `/apps/reports/production` | `ProductionReportPage` | `ProductionReportPage` | Presentation matched; no live production-report repository |

## Canonical routes without a demo counterpart

| Canonical route | Classification |
|---|---|
| `/apps/hr`, `/apps/hr/employees` | Production-only Paraşüt employee list; uses the canonical Ebru live-list presentation |
| `/apps/hr/salaries` | Production-only Paraşüt salary list; uses the canonical Ebru live-list presentation |
| `/apps/e-documents`, `/apps/e-documents/invoices` | Production-only Paraşüt e-document list; uses the canonical Ebru live-list presentation |
| `/apps/commerce` | No implemented domain repository; canonical shell/approved empty overview |
| `/apps/production` | No implemented production repository; canonical shell/approved empty overview |
| `/apps/quality` | No implemented quality repository; canonical shell/approved empty overview |
| `/apps/maintenance` | No implemented maintenance repository; canonical shell/approved empty overview |
| `/apps/website` | No ERP repository; canonical shell/approved empty overview |
| `/apps/settings` | Settings link remains outside the ERP route content |

