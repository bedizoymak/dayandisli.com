# ERP Production Route Inventory (`/apps/*`)

Ground truth for this table is `src/features/ebru-preview/EbruRouteContent.tsx:53-119`, the linear
`routePath.endsWith(...)` dispatch function that actually decides what renders under
`src/features/ebru-preview/EbruPreviewPage.tsx` (mounted at `Route path="/apps/*"`, `src/App.tsx:140`).
`src/features/erp/apps/applicationRegistry.ts` (`erpApplications[]`) is **not** consulted by this dispatcher —
it is only used to build the permission catalog in `src/features/erp/shared/permissions.ts`. `/demo/*`
(`src/features/ebru-demo/**`) is a structurally near-identical, separate copy of this UI and is listed only in
the "Has Demo Equivalent" column.

**Repeating patterns, documented once:**

- **Paraşüt-backed list/detail pages** (`InvoiceListPage`, `CustomerListPage`, `ProductsPage`, `SuppliersPage`,
  `OrdersPage`, `ChecksPage`, `CashAccountsPage`, `DispatchesPage`, `StockHistoryPage`, `StockReportPage`,
  `QuotesPage`, `SalesOrdersPage`, etc.) all call `useParasutList(resource, params)`
  (`src/features/erp/parasut/api/queries.ts:42`) → `src/features/erp/parasut/api/client.ts` → Supabase Edge
  Function `parasut-api`, which mirrors live Paraşüt accounting data into Supabase tables. These are Live (Y),
  not empty-by-design, and use their own bespoke component per resource (not the generic adapter).
- **The generic-adapter family** (`CanonicalParasutListPage`, `src/features/ebru-preview/finance-preview/CanonicalParasutPages.tsx:197`)
  is a single config-driven table component reused for `/apps/hr`, `/apps/hr/employees`, `/apps/hr/salaries`,
  `/apps/e-documents`, `/apps/e-documents/invoices` — each just swaps in a `PageConfig` from
  `canonicalParasutPages` (`CanonicalParasutPages.tsx:74-89`) and calls the same `useParasutList`. Live data,
  read-only in the UI shown (no create/edit form wired for these three resources), generic adapter = Y.
- **Report pages** (`CollectionReportPage`, `IncomeExpenseReportPage`, `CashBankReportPage`) are each mounted
  at *two* different URLs — once under `/apps/finance/...` and again under `/apps/reports/...` — same
  component instance, so the `/apps/reports/*` row is marked "Duplicates Another Route: Y".
- **"New" / "Edit" sub-routes** (`.../new`, `.../:id/edit`) render a form component instead of a list; they
  are Write-Enabled and call `src/features/erp/parasut/api/write-client.ts` → Edge Function `parasut-write-api`.
- **Top-level app stubs** (`/apps/commerce`, `/apps/production`, `/apps/quality`, `/apps/website`,
  `/apps/settings`, `/apps/maintenance`, `/apps/repair`, `/apps/purchasing`, `/apps/inventory`,
  `/apps/accounting`, `/apps/invoicing`, `/apps/expenses`) have no matching `if` branch in
  `EbruRouteContent.tsx` and silently fall through to the final `return <FinanceOverview />;`
  (`EbruRouteContent.tsx:118`). They are documented once here as "stub — falls to FinanceOverview default."

| Route Path | Route Params | Page Title | Nav Group | Current Component (file:line) | Backend Action/Hook | Data Source | Live Data | Empty By Design | Uses Generic Adapter | Lacks Logical Table Mapping | Duplicates Another Route | Has Demo Equivalent | Read-Only / Write-Enabled |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| /apps | — | Dashboard | Dashboard | `EbruPreviewPage.tsx:835-989` (inline) | `useParasutDashboard()` (`parasut/api/queries.ts:30`) + `useMarketData()` (`market-data/useMarketData.ts`) | Paraşüt mirror (collections/payments/accounts) + market-data Edge Function | Y | N | N | N | N | Y (`ebru-demo` root) | Read-Only |
| /apps/finance | — | Muhasebe ve Finans (overview) | Finance | `finance-preview/FinanceOverview.tsx:81` | none | `financeOverviewData` static object (`financePreviewData.ts:167-212`) | N | Y (placeholder "—" values by design) | N | Y | N | Y | Read-Only |
| /apps/finance/income/invoices | — | Faturalar | Finance / Income | `finance-preview/FinanceIncomePages.tsx:159` `InvoiceListPage` | `useParasutList("sales_invoices", …)` | Paraşüt `sales_invoices` mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/finance/income/invoices/new | — | Yeni Fatura | Finance / Income | `finance-preview/FinanceInvoicePages.tsx:11` `SalesInvoiceForm` | `write-client.ts` → `parasut-write-api` | Paraşüt `sales_invoices` (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/income/customers | — | Müşteriler | Finance / Income | `finance-preview/FinanceIncomePages.tsx:286` `CustomerListPage` | `useParasutList("customers", …)` | Paraşüt `customers` mirror | Y | N | N | N | Y (see /apps/crm/customers, static-empty duplicate) | Y | Read-Only |
| /apps/finance/income/customers/new | — | Yeni Müşteri | Finance / Income | `finance-preview/FinanceIncomePages.tsx:390` `CustomerFormPage` | `write-client.ts` | Paraşüt `customers` (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/income/collection-report | — | Tahsilat Raporu | Finance / Income | `finance-preview/FinanceIncomePages.tsx:538` `CollectionReportPage` | `useParasutReports()` (`parasut/api/queries.ts:107`) | Paraşüt reports mirror | Y | N | N | N | Y (`/apps/reports/collections` — same component) | Y | Read-Only |
| /apps/finance/expense/list | — | Gider Listesi | Finance / Expenses | `finance-preview/FinanceExpensePages.tsx:170` `ExpenseListPage` | `useParasutList("bank_fees", …)` | Paraşüt `bank_fees` mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/finance/expense/list/new/invoice | — | Yeni Alış Faturası | Finance / Expenses | `finance-preview/FinanceExpensePages.tsx:421` `ExpenseInvoicePage` | `write-client.ts` | Paraşüt `purchase_bills` (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/expense/list/new/payroll | — | Bordro Gideri | Finance / Expenses | `finance-preview/FinanceExpensePages.tsx:515` `SimpleExpenseForm type="payroll"` | `write-client.ts` | Paraşüt expense (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/expense/list/new/tax | — | Vergi Gideri | Finance / Expenses | `FinanceExpensePages.tsx:515` `SimpleExpenseForm type="tax"` | `write-client.ts` | Paraşüt expense (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/expense/list/new/bank-expense | — | Banka Masrafı | Finance / Expenses | `FinanceExpensePages.tsx:515` `SimpleExpenseForm type="bank"` | `write-client.ts` | Paraşüt `bank_fees` (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/expense/list/new/other | — | Diğer Gider | Finance / Expenses | `FinanceExpensePages.tsx:515` `SimpleExpenseForm type="other"` | `write-client.ts` | Paraşüt expense (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/expense/list/new/accommodation | — | Konaklama Gideri | Finance / Expenses | `FinanceExpensePages.tsx:421` `ExpenseInvoicePage accommodation` | `write-client.ts` | Paraşüt expense (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/expense/incoming-invoices | — | Gelen Faturalar | Finance / Expenses | `finance-preview/FinanceExpensePages.tsx:273` `IncomingInvoicesPage` | `useParasutList("purchase_bills", …)` | Paraşüt `purchase_bills` mirror | Y | N | N | N | Y (`/apps/parasut/alislar/faturalar` legacy path redirects here) | Y | Read-Only |
| /apps/finance/expense/income-expense-report | — | Gelir-Gider Raporu | Finance / Expenses | `finance-preview/FinanceReportPages.tsx:145` `IncomeExpenseReportPage` | `useParasutReports()` | Paraşüt reports mirror | Y | N | N | N | Y (`/apps/reports/income-expense` — same component) | Y | Read-Only |
| /apps/finance/expense/payments-report | — | Ödemeler Raporu | Finance / Expenses | `finance-preview/FinanceReportPages.tsx:212` `PaymentsReportPage` | `useParasutReports()` | Paraşüt reports mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/finance/expense/vat-report | — | KDV Raporu | Finance / Expenses | `finance-preview/FinanceReportPages.tsx:254` `VatReportPage` | `useParasutReports()` | Paraşüt reports mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/finance/inventory/products | — | Hizmet ve Ürünler | Finance / Inventory | `finance-preview/OperationsPages.tsx:134` `ProductsPage` | `useParasutList("products", …)` | Paraşüt `products` mirror | Y | N | N | N | Y (also `/apps/parasut/urunler` legacy redirect) | Y | Read-Only |
| /apps/finance/inventory/products/new | — | Yeni Ürün / Hizmet | Finance / Inventory | `finance-preview/OperationsPages.tsx:158` `ProductFormPage` | `write-client.ts` | Paraşüt `products` (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/inventory/outgoing-dispatches | — | Giden İrsaliyeler | Finance / Inventory | `finance-preview/OperationsPages.tsx:271` `DispatchesPage type="outgoing"` | `useParasutList("shipment_documents", …)` | Paraşüt `shipment_documents` mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/finance/inventory/incoming-dispatches | — | Gelen İrsaliyeler | Finance / Inventory | `OperationsPages.tsx:271` `DispatchesPage type="incoming"` | `useParasutList("shipment_documents", …)` | Paraşüt `shipment_documents` mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/finance/inventory/outgoing-dispatches/new | — | Yeni Giden İrsaliye | Finance / Inventory | `finance-preview/OperationsPages.tsx:298` `DispatchFormPage type="outgoing"` | `write-client.ts` | Paraşüt shipment (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/inventory/incoming-dispatches/new | — | Yeni Gelen İrsaliye | Finance / Inventory | `OperationsPages.tsx:298` `DispatchFormPage type="incoming"` | `write-client.ts` | Paraşüt shipment (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/inventory/history | — | Stok Geçmişi | Finance / Inventory | `finance-preview/OperationsPages.tsx:384` `StockHistoryPage` | `useParasutList("stock_movements", …)` | Paraşüt `stock_movements` mirror | Y | N | N | N | Y (also `/apps/parasut/stok/hareketler` legacy redirect) | Y | Read-Only |
| /apps/finance/inventory/report | — | Stoktaki Ürünler Raporu | Finance / Inventory | `finance-preview/OperationsPages.tsx:401` `StockReportPage` | `useParasutList("inventory_levels", …)` | Paraşüt `inventory_levels` mirror | Y | N | N | N | Y (also `/apps/parasut/stok/mevcut` legacy redirect) | Y | Read-Only |
| /apps/finance/purchasing/suppliers | — | Tedarikçiler | Finance / Purchasing | `finance-preview/OperationsPages.tsx:456` `SuppliersPage` | `useParasutList("suppliers", …)` | Paraşüt `suppliers` mirror | Y | N | N | N | Y (also `/apps/parasut/alislar/tedarikciler` legacy redirect; `erp/parasut/pages/SuppliersPage.tsx` is an unreachable duplicate impl.) | Y | Read-Only |
| /apps/finance/purchasing/suppliers/new | — | Yeni Tedarikçi | Finance / Purchasing | `finance-preview/OperationsPages.tsx:477` `SupplierFormPage` | `write-client.ts` | Paraşüt `suppliers` (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/purchasing/orders | — | Siparişler | Finance / Purchasing | `finance-preview/OperationsPages.tsx:520` `OrdersPage` | `useParasutList` (purchase orders resource) | Paraşüt mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/finance/purchasing/orders/new | — | Yeni Sipariş | Finance / Purchasing | `finance-preview/OperationsPages.tsx:541` `OrderFormPage` | `write-client.ts` | Paraşüt (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/cash/accounts | — | Kasa ve Bankalar | Finance / Cash | `finance-preview/FinanceReportPages.tsx:322` `CashAccountsPage` | `useParasutList("accounts", …)` | Paraşüt `accounts` mirror | Y | N | N | N | Y (also `/apps/parasut/kasa-banka` legacy redirect) | Y | Read-Only |
| /apps/finance/cash/checks | — | Çekler | Finance / Cash | `finance-preview/FinanceReportPages.tsx:357` `ChecksPage` | `useParasutList` (checks resource) | Paraşüt mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/finance/cash/checks/new | — | Yeni Çek | Finance / Cash | `finance-preview/OperationsPages.tsx:622` `CheckFormPage` | `write-client.ts` | Paraşüt (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/finance/cash/cash-bank-report | — | Kasa / Banka Raporu | Finance / Cash | `finance-preview/FinanceReportPages.tsx:387` `CashBankReportPage` | `useParasutReports()` | Paraşüt reports mirror | Y | N | N | N | Y (`/apps/reports/cash-bank` — same component) | Y | Read-Only |
| /apps/finance/cash/cash-flow-report | — | Nakit Akış Raporu | Finance / Cash | `finance-preview/FinanceReportPages.tsx:444` `CashFlowReportPage` | `useParasutReports()` | Paraşüt reports mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/crm/customers | — | Müşteriler (CRM) | CRM | `crm-preview/CustomerListPage.tsx:28` `CrmCustomerListPage` | none — reads `crmCustomers` | `crmCustomerData.ts:3`: `export const crmCustomers = []` (hard-coded empty array) | N | Y (unintentional — no query wired, not a designed empty state) | N | Y | Y (`/apps/finance/income/customers` shows the same "customers" concept, live) | Y | Read-Only |
| /apps/crm/customers/new | — | Yeni Müşteri (CRM) | CRM | `crm-preview/CustomerFormPage.tsx:5` `CrmCustomerFormPage` | none | static defaults (`crmCustomerData.ts:4`) | N | Y | N | Y | Y (`/apps/finance/income/customers/new` is the live equivalent) | Y | Write-Enabled (local state only; no confirmed backend submit traced) |
| /apps/crm/customers/:id/edit | id | Müşteri Düzenle (CRM) | CRM | `crm-preview/CustomerFormPage.tsx:5` `CrmCustomerFormPage edit` | none | static | N | Y | N | Y | Y | Y | Write-Enabled (unconfirmed backend) |
| /apps/crm/customers/:id | id | Müşteri Detayı (CRM) | CRM | `crm-preview/CustomerDetailPage.tsx:19` `CustomerDetailPage` | none (reads static collection/summary arrays, all empty) | `crmCustomerData.ts` static arrays | N | Y | N | Y | Y (CRM customer detail duplicates Paraşüt customer, which has no detail page here) | Y | Read-Only |
| /apps/sales/quotes | — | Teklifler | Sales | `sales-preview/SalesListPages.tsx:87` `QuotesPage` | `useParasutList("sales_offers", …)` | Paraşüt `sales_offers` mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/sales/quotes/new | — | Yeni Teklif | Sales | `sales-preview/QuotePages.tsx:31` `QuoteFormPage` | `write-client.ts` | Paraşüt `sales_offers` (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/sales/quotes/:id/edit | id | Teklif Düzenle | Sales | `sales-preview/QuotePages.tsx:31` `QuoteFormPage` | `write-client.ts` | Paraşüt `sales_offers` (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/sales/quotes/:id | id | Teklif Detayı | Sales | `sales-preview/QuotePages.tsx:353` `QuoteDetailPage` | `useParasutList` (single-record lookup) | Paraşüt `sales_offers` mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/sales/quotes/:id/print | id | Teklif Yazdır (PDF) | Sales | `sales-preview/pdf/QuotePrintPage.tsx:8` → `pdf/QuoteDocument.tsx:9` | reads quote detail data | Paraşüt `sales_offers` mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/sales/orders | — | Siparişler | Sales | `sales-preview/SalesListPages.tsx:178` `SalesOrdersPage` | `useParasutList` (orders subset) | Paraşüt mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/sales/orders/new | — | Yeni Sipariş | Sales | `sales-preview/QuotePages.tsx:496` `SalesOrderFormPage` | `write-client.ts` | Paraşüt (write) | Y | N | N | N | N | Y | Write-Enabled |
| /apps/sales/activities | — | Satış Faaliyetleri | Sales | `sales-preview/SalesListPages.tsx:214` `SalesActivitiesPage` (also default for any unmatched `/sales/*` suffix) | `useParasutList` (activity subset) | Paraşüt mirror | Y | N | N | N | N | Y | Read-Only |
| /apps/reports/collections | — | Tahsilat Raporu | Reports | `finance-preview/FinanceIncomePages.tsx:538` `CollectionReportPage` | `useParasutReports()` | Paraşüt reports mirror | Y | N | N | N | Y (`/apps/finance/income/collection-report`) | Y | Read-Only |
| /apps/reports/income-expense | — | Gelir-Gider Raporu | Reports | `finance-preview/FinanceReportPages.tsx:145` `IncomeExpenseReportPage` | `useParasutReports()` | Paraşüt reports mirror | Y | N | N | N | Y (`/apps/finance/expense/income-expense-report`) | Y | Read-Only |
| /apps/reports/cash-bank | — | Kasa-Banka Raporu | Reports | `finance-preview/FinanceReportPages.tsx:387` `CashBankReportPage` | `useParasutReports()` | Paraşüt reports mirror | Y | N | N | N | Y (`/apps/finance/cash/cash-bank-report`) | Y | Read-Only |
| /apps/reports/production | — | Üretim Raporu | Reports | `reports-preview/ProductionReportPage.tsx:38` `ProductionReportPage` | see file (not a `useParasutList` call — production domain has no Paraşüt mirror; check internal query) | production dataset (non-Paraşüt) | Unconfirmed — treat as N pending direct trace | N | N | N | N | Y | Read-Only |
| /apps/hr or /apps/hr/employees | — | Çalışanlar | HR | `finance-preview/CanonicalParasutPages.tsx:197` `CanonicalParasutListPage` config `employees` (`:86`) | `useParasutList("employees", …)` | Paraşüt `employees` mirror | Y | N | Y | N | Y (also `/apps/parasut/ik/calisanlar` legacy redirect) | Y | Read-Only |
| /apps/hr/salaries | — | Maaşlar | HR | `CanonicalParasutPages.tsx:197` config `salaries` (`:87`) | `useParasutList("salaries", …)` | Paraşüt `salaries` mirror | Y | N | Y | N | Y (also `/apps/parasut/ik/maaslar` legacy redirect) | Y | Read-Only |
| /apps/e-documents or /apps/e-documents/invoices | — | E-Faturalar | E-Documents | `CanonicalParasutPages.tsx:197` config `eInvoices` (`:88`) | `useParasutList("e_invoices", …)` | Paraşüt `e_invoices` mirror | Y | N | Y | N | N | N (no `ebru-demo` equivalent found) | Read-Only |
| /apps/commerce | — | E-Ticaret | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional — module has no dedicated page) | N | Y | Y (identical fallback to every other stub row) | N | Read-Only |
| /apps/production | — | Üretim | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y | N | Read-Only |
| /apps/quality | — | Kalite ve Bakım Yönetimi | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y | N | Read-Only |
| /apps/website | — | Web Sitesi | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y | N | Read-Only |
| /apps/settings | — | Ayarlar | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y | N | Read-Only |
| /apps/maintenance | — | Bakım | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y | N | Read-Only |
| /apps/repair | — | Tamir | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y | N | Read-Only |
| /apps/purchasing | — | Satın Alma (top-level) | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y (real content lives at `/apps/finance/purchasing/*`) | N | Read-Only |
| /apps/inventory | — | Stok (top-level) | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y (real content lives at `/apps/finance/inventory/*`) | N | Read-Only |
| /apps/accounting | — | Muhasebe (top-level) | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y (real content lives at `/apps/finance/*`) | N | Read-Only |
| /apps/invoicing | — | Faturalama (top-level) | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y (real content lives at `/apps/finance/income/invoices`) | N | Read-Only |
| /apps/expenses | — | Giderler (top-level) | (stub) | `finance-preview/FinanceOverview.tsx:81` (fallback) | none | static placeholder | N | Y (unintentional) | N | Y | Y (real content lives at `/apps/finance/expense/*`) | N | Read-Only |
| /apps/parasut/* | — | (legacy redirect) | — | `App.tsx:138` `LegacyParasutRedirect` → `resolveLegacyParasutRoute()` (`App.tsx:71`, table `App.tsx:55-69`) | none (client-side `<Navigate>`) | n/a | n/a | n/a | n/a | n/a | Y (rewrites into one of the `/apps/finance/...` or `/apps/hr/...` rows above) | n/a | n/a |
| /apps/ebru-preview/* | — | (legacy redirect) | — | `App.tsx:137` `Navigate to="/apps"` | none | n/a | n/a | n/a | n/a | n/a | Y (`/apps`) | n/a | n/a |

## Notes on gaps found

- Twelve sidebar/registry-listed top-level applications (`commerce`, `production`, `quality`, `website`,
  `settings`, `maintenance`, `repair`, and the bare `purchasing`/`inventory`/`accounting`/`invoicing`/`expenses`
  variants) have zero matching logic in `EbruRouteContent.tsx` and silently render the Finance Overview screen.
  None of them are marked `status: "planned"` anywhere visible to the end user — there is no "coming soon" state.
- `/apps/crm/customers*` is a fully separate, statically-empty implementation of "customers" that coexists with
  the live Paraşüt-backed `/apps/finance/income/customers*` — a genuine duplicate data model, not just a
  duplicate route alias.
- `src/features/erp/parasut/pages/*.tsx` (24 files: `SuppliersPage`, `CustomersPage`, `ProductsPage`,
  `SalesInvoicesPage`, `DashboardPage`, `ReportsPage`, `SyncPage`, etc.) and `ParasutLayout.tsx` are unreachable
  in production — `/apps/parasut/*` always redirects away before they can mount.
- No route component under `/apps/*` calls `getRequiredPermissionForPath` / `hasPermission`
  (`src/features/erp/shared/permissions.ts`) — permission data exists and is unit-tested but is not enforced
  at the page level, only at the coarse `ProtectedRoute` (authenticated vs. not) level.
