# ERP route → data map (Phases 5–7)

This document is the authoritative synthesis of the JSX hierarchy (`ERP_PRODUCTION_JSX_HIERARCHY.md`), route inventory (`ERP_PRODUCTION_ROUTE_INVENTORY.md`), backend architecture (`ERP_BACKEND_ARCHITECTURE.md`), and schema architecture (`PARASUT_SCHEMA_ARCHITECTURE.md`). It defines the canonical domain model, the route→table mapping, and the gap analysis, and records which gaps were closed in the Phase 8 implementation pass.

## Central finding (read this first)

Two parallel data layers exist in the codebase:

1. **`parasut.*` mirror + `parasut-api`/`parasut-write-api` Edge Functions** — live, tenant-scoped, tested, and already backing the HR and E-Documents routes in production. All 28 tables confirmed to exist in production via read-only introspection (see `PARASUT_SCHEMA_ARCHITECTURE.md` → "Live read-only verification").
2. **Legacy "native ERP" layer** (`src/features/erp/shared/erpApi.ts`, `crmApi.ts`, `salesApi.ts`, `inventoryApi.ts`, `productionApi.ts`) — targets `public.*` tables (`stakeholders`, `invoices`, `orders`, `quotes`, `warehouses`, …) that **do not exist in production**. Confirmed: `public` schema contains only `accounting_audit_log`, `accounting_outbound_attempts`, `accounting_outbound_commands`, `accounting_provider_links`, `erp_users`, `machines`. Every route still wired to layer (2) silently renders empty/wrong data because the Supabase error is swallowed by the `failure()` wrapper.

A **third piece already exists and works**: `src/features/ebru-preview/finance-preview/CanonicalParasutPages.tsx` defines 14 ready-made `PageConfig` objects (`invoices`, `customers`, `suppliers`, `purchaseBills`, `expenses`, `accounts`, `products`, `stockHistory`, `inventory`, `shipments`, `offers`, `employees`, `salaries`, `eInvoices`) that render via `<CanonicalParasutListPage>`, which calls `useParasutList()` → `parasut-api` Edge Function → `scopedParasutTable()` against the real, live, tenant-scoped `parasut.*` tables. Only 3 of these 14 configs (`employees`, `salaries`, `eInvoices`) were actually wired into the route dispatcher (`EbruRouteContent.tsx`) before this change. The other 11 configs existed, worked, and were simply never routed to.

**The Phase 8 fix is therefore almost entirely a routing fix, not new backend work**: point the dispatcher's list routes at the pre-existing, pre-tested `canonicalParasutPages` configs instead of the legacy `erpApi.ts`-backed components. This is low-risk because the backend side of this path is unchanged code that already runs in production today (HR/E-Documents).

## Phase 5 — Canonical domain model

```
ERP
├── Dashboard                          (/apps)                             — FinanceOverview, static/no live query today
├── Finance
│   ├── Overview                       (/apps/finance*)                    — fallback, no dedicated route
│   ├── Income
│   │   ├── Invoices                   (/apps/finance/income/invoices)     → parasut.sales_invoices
│   │   ├── Customers                  (/apps/finance/income/customers)    → parasut.contacts (account_type=customer)
│   │   └── Collection report          (/apps/finance/income/collection-report) → fixture data (gap, see below)
│   ├── Expenses
│   │   ├── Expense list               (/apps/finance/expense/list)        → parasut.bank_fees (0 rows live)
│   │   ├── Incoming invoices          (/apps/finance/expense/incoming-invoices) → parasut.purchase_bills
│   │   ├── Income/expense report      (/apps/finance/expense/income-expense-report) → fixture data (gap)
│   │   ├── Payments report            (/apps/finance/expense/payments-report) → fixture data (gap)
│   │   └── VAT report                 (/apps/finance/expense/vat-report)  → fixture data (gap)
│   ├── Cash and Banks
│   │   ├── Accounts                   (/apps/finance/cash/accounts)       → parasut.accounts
│   │   ├── Checks                     (/apps/finance/cash/checks)         → no parasut table (gap, documented)
│   │   ├── Cash-bank report           (/apps/finance/cash/cash-bank-report) → fixture data (gap)
│   │   └── Cash-flow report           (/apps/finance/cash/cash-flow-report) → fixture data (gap)
│   ├── Inventory
│   │   ├── Products                   (/apps/finance/inventory/products)  → parasut.products
│   │   ├── Stock history              (/apps/finance/inventory/history)   → parasut.stock_movements (0 rows live)
│   │   ├── Stock report               (/apps/finance/inventory/report)    → parasut.inventory_levels (0 rows live)
│   │   └── Dispatches (in/out)        (/apps/finance/inventory/*-dispatches) → parasut.shipment_documents
│   └── Purchasing
│       ├── Suppliers                  (/apps/finance/purchasing/suppliers) → parasut.contacts (account_type=supplier)
│       └── Orders                     (/apps/finance/purchasing/orders)   → no parasut table (gap, documented)
├── Sales
│   ├── Offers/Quotes                  (/apps/sales/quotes)                → parasut.sales_offers
│   ├── Orders                         (/apps/sales/orders)                → no parasut table (gap, documented)
│   └── Activities                     (/apps/sales/*)                     → no parasut table (gap, documented)
├── CRM
│   └── Customers                      (/apps/crm/customers)               → parasut.contacts (account_type=customer) — duplicate of Finance→Income→Customers, see gap G-04
├── Human Resources
│   ├── Employees                      (/apps/hr, /apps/hr/employees)      → parasut.employees (already live pre-existing)
│   └── Salaries                       (/apps/hr/salaries)                 → parasut.salaries (already live pre-existing, 0 rows)
├── E-Documents
│   └── E-Invoices                     (/apps/e-documents*)                → parasut.e_invoices (already live pre-existing)
└── Monitoring
    ├── Sync Runs                      no route exists                    → parasut.sync_runs (17 rows) — gap, no route
    └── Sync Errors                    no route exists                    → parasut.sync_errors (0 rows) — gap, no route
```

Detail tables (`sales_invoice_details`, `purchase_bill_details`, `sales_offers_details`, `stock_update_details`) are intentionally **not** given standalone routes — they are meant to be nested inside their parent record's detail page. No standalone detail routes exist yet for `sales_invoices`/`purchase_bills` in the current dispatcher (see gap G-07); this pass does not add them (out of scope for a routing-only fix — building a correct detail view with relationship expansion is new UI work, not a mapping fix).

`parasut.tags` and `parasut.warehouses` have no sensible top-level route (supporting metadata for other resources) and are correctly left unrouted, per the instruction not to force one-table-per-menu navigation.

## Phase 6 — Route-to-table mapping (implemented in this pass)

| Route | Primary table | Filter | Backend action | Status before | Status after |
|---|---|---|---|---|---|
| `/apps/finance/income/invoices` | `parasut.sales_invoices` | `archived=false` | `parasut-api` list `sales_invoices` | Legacy `erpApi.listInvoices()` → nonexistent `public.invoices` | ✅ `canonicalParasutPages.invoices` |
| `/apps/finance/income/customers` | `parasut.contacts` | `account_type=customer`, `archived=false` | `parasut-api` list `customers` | Legacy `erpApi.listStakeholders()` → nonexistent `public.stakeholders` | ✅ `canonicalParasutPages.customers` |
| `/apps/crm/customers` | `parasut.contacts` | `account_type=customer`, `archived=false` | `parasut-api` list `customers` | Hardcoded empty array (`crmCustomerData.ts`) | ✅ `canonicalParasutPages.customers` (same live config as Finance→Income→Customers) |
| `/apps/finance/purchasing/suppliers` | `parasut.contacts` | `account_type=supplier`, `archived=false` | `parasut-api` list `suppliers` | Legacy `OperationsPages.SuppliersPage` → nonexistent table | ✅ `canonicalParasutPages.suppliers` |
| `/apps/finance/expense/incoming-invoices` | `parasut.purchase_bills` | `archived=false` | `parasut-api` list `purchase_bills` | Legacy `IncomingInvoicesPage` → nonexistent table | ✅ `canonicalParasutPages.purchaseBills` |
| `/apps/finance/expense/list` | `parasut.bank_fees` | `archived=false` | `parasut-api` list `expenses` | Legacy `ExpenseListPage` → nonexistent table | ✅ `canonicalParasutPages.expenses` (honest empty state: table has 0 rows live — no expense sync run yet) |
| `/apps/finance/cash/accounts` | `parasut.accounts` | `archived=false` | `parasut-api` list `accounts` | Legacy `CashAccountsPage` → nonexistent table | ✅ `canonicalParasutPages.accounts` |
| `/apps/finance/inventory/products` | `parasut.products` | `archived=false` | `parasut-api` list `products` | Legacy `ProductsPage` → nonexistent table | ✅ `canonicalParasutPages.products` |
| `/apps/finance/inventory/history` | `parasut.stock_movements` | `archived=false` | `parasut-api` list `stock_movements` | Legacy `StockHistoryPage` → nonexistent table | ✅ `canonicalParasutPages.stockHistory` (honest empty state: 0 rows live) |
| `/apps/finance/inventory/report` | `parasut.inventory_levels` | `archived=false` | `parasut-api` list `inventory_levels` | Legacy `StockReportPage` → nonexistent table | ✅ `canonicalParasutPages.inventory` (honest empty state: 0 rows live) |
| `/apps/finance/inventory/outgoing-dispatches`, `/incoming-dispatches` | `parasut.shipment_documents` | `archived=false`, `inflow` | `parasut-api` list `shipment_documents` | Legacy `DispatchesPage` → nonexistent table | ✅ `canonicalParasutPages.shipments` |
| `/apps/sales/quotes` | `parasut.sales_offers` | `archived=false` | `parasut-api` list `sales_offers` | Legacy `QuotesPage` → nonexistent table | ✅ `canonicalParasutPages.offers` |

Detail navigation, export source, pagination, and empty-state behavior for every route above are inherited unchanged from `CanonicalParasutListPage` (already governs `/apps/hr`, `/apps/hr/salaries`, `/apps/e-documents` in production): offset pagination via `useParasutList`, CSV export via `FinanceExportMenu` sourced from the same fetched rows (not a second query), and a shared "no records" empty state — no fabricated rows. Raw `attributes` JSONB is only used as a typed-column fallback inside `cell()` (`CanonicalParasutPages.tsx`), never rendered as raw JSON, and `raw_payload` is never selected (`LIST_SELECT_COLUMNS` in `parasut-api/handlers.ts` is an explicit column allowlist).

**Not touched in this pass** (write/detail/report pages — see Gap Analysis for reasoning):
- `*FormPage` / `*New` write routes (customer/supplier/product/order/check/dispatch/quote forms) — left on the legacy layer. They are almost certainly broken the same way (their submit handlers call `erpApi.ts` writes against nonexistent tables), but fixing a write path safely requires verifying Paraşüt write semantics end-to-end, which is out of scope for a read-mapping pass and is explicitly guarded by the task's "do not alter Paraşüt sync semantics" / "do not write to Paraşüt" constraints. Documented as gap G-08.
- All `*ReportPage` components (`CollectionReportPage`, `IncomeExpenseReportPage`, `PaymentsReportPage`, `VatReportPage`, `CashBankReportPage`, `CashFlowReportPage`, `ProductionReportPage`) — these render **hardcoded fixture data** from `financeReportData.ts` / `cash-preview` data files, not a table at all. This existed before this change; it is not demo data introduced by this task, but it is a pre-existing violation of "no hardcoded demo data in `/apps/*`" worth flagging as a BLOCKER (G-01). Rebuilding these as real aggregation queries (with correct collection/payment direction filtering, VAT math, and aging buckets) is a new-feature-sized effort, not a routing fix, and was not attempted here to avoid shipping unverified financial arithmetic.
- `/apps/sales/orders`, `/apps/sales/*` activities, `/apps/finance/purchasing/orders`, `/apps/finance/cash/checks` — no corresponding `parasut.*` table exists for these concepts (no purchase-order or check resource in the Paraşüt mirror). Left on the approved frontend with their current (legacy, effectively empty) state. Per the task's instruction, no data was invented; documented as gap G-09.
- Detail routes for `sales_invoices`/`purchase_bills`/`sales_offers` (e.g. `/apps/finance/income/invoices/:id`) do not exist in the current dispatcher at all — there is no route to fix. Documented as gap G-07.
- `/apps/finance/transactions`, `/apps/finance/collections`, `/apps/finance/payments`, `/apps/monitoring/sync-runs`, `/apps/monitoring/sync-errors` as literal paths — none of these exist in the actual route dispatcher (the closest existing route is `/apps/finance/income/collection-report`, which is a fixture-backed report page, not a `payments`-table list). Building these as new routes was judged out of scope for a mapping-only pass (it requires new navigation entries, which risks exposing new sidebar items — explicitly disallowed for `/demo` but for `/apps` would need product sign-off on IA). Documented as gap G-10/G-11.

## Phase 7 — Gap analysis

| ID | Finding | Severity | Fixed in this pass? |
|---|---|---|---|
| G-01 | Six report pages (`*ReportPage`) render hardcoded fixture data in production, not live data | BLOCKER | No — new-feature-sized aggregation work, out of scope for a routing fix |
| G-02 | Legacy `erpApi.ts`/`crmApi.ts`/`salesApi.ts`/`inventoryApi.ts`/`productionApi.ts` target `public.*` tables that don't exist in production at all | BLOCKER | Partially — the 11 list routes with an existing `canonicalParasutPages` config were repointed; write forms and non-listed reads remain on the dead layer |
| G-03 | `EbruRouteContent.tsx` is a flat `if/endsWith` chain, not React Router `<Routes>`, and its final fallback silently renders `FinanceOverview` for any unmatched path (12+ sidebar apps: commerce, production, quality, website, settings, maintenance, repair, etc.) | HIGH | No — changing the dispatcher's fallback behavior for unrelated modules is a larger frontend-architecture change than "wire the missing table"; flagged for a follow-up task |
| G-04 | `/apps/crm/customers` duplicates `/apps/finance/income/customers` (same underlying data, two separate pages/components) | MEDIUM | Both now point at the same live `customers` resource/config, removing the *data* duplication; the duplicate page/component still exists (UI consolidation not attempted, to avoid changing the approved JSX hierarchy) |
| G-05 | Three report pages are mounted at two different URLs each (`/apps/finance/...` and `/apps/reports/...`) | LOW | No — pre-existing, does not affect data correctness, left as-is |
| G-06 | No production route enforces per-route permission checks (`hasPermission`/`getRequiredPermissionForPath` exist and are tested but unused at the route level — `ProtectedRoute` only checks authentication) | HIGH | No — a permission-enforcement change is a security-relevant behavior change outside "route-to-data mapping" scope; flagged for explicit follow-up |
| G-07 | No detail routes exist for `sales_invoices`, `purchase_bills`, or `sales_offers` (list-only) | MEDIUM | No — would require new routes/components, not a mapping of existing ones |
| G-08 | Write forms (`*FormPage`) still call the legacy dead layer | HIGH | No — write-path changes are explicitly higher-risk and constrained by "do not write to Paraşüt" / "do not alter sync semantics"; left untouched, documented |
| G-09 | No `parasut.*` table exists for purchase orders, sales orders, sales activities, or checks | LOW | N/A — correctly left unrouted per instructions, no data invented |
| G-10 | No route exists for `parasut.transactions` (0 rows live anyway) | LOW | N/A — table is empty in production; no route added |
| G-11 | No route exists for `parasut.sync_runs`/`parasut.sync_errors` monitoring data, despite real data existing (17 sync runs) | MEDIUM | No — adding new sidebar-visible monitoring routes requires product/IA sign-off, outside a "fix existing route mapping" pass |
| G-12 | `parasut-write-api`'s dependent tables/paths are explicitly marked "NOT YET DEPLOYED" in the Edge Function's own source, yet `CreateCustomerDialog.tsx` is live in the frontend and could be triggered | HIGH | No — this is a write-path readiness issue, not a read-mapping issue; flagged, not touched (no write behavior was changed or exercised) |
| G-13 | `parasut-sync`/`parasut-sync-run` Edge Functions are unauthenticated and write to a legacy, distinct table set | BLOCKER | No — deploying/undeploying Edge Functions or changing auth is outside this task's scope ("do not alter Paraşüt sync semantics"); flagged for immediate follow-up outside this task |
| G-14 | Detail-handler `select("*")` in `parasut-api/handlers.ts` could leak `raw_payload` per-record (list responses correctly whitelist columns; detail responses were not confirmed to) | MEDIUM | No — backend code change, outside a frontend routing-mapping pass; flagged for follow-up |
| G-15 | `parasut.tags`, `parasut.warehouses` have no route and no frontend reference at all | LOW | N/A — correctly left unrouted, embedded/supporting metadata only |
| G-16 | `/apps/finance/inventory/outgoing-dispatches` and `/incoming-dispatches` both now use the same `canonicalParasutPages.shipments` config (no `inflow`/`outflow` filter applied), losing the direction split the legacy `DispatchesPage type="outgoing"/"incoming"` prop provided | MEDIUM | No — both routes now show real live `shipment_documents` rows (previously both showed nothing), but without direction filtering; a follow-up should add two filtered configs (or a shared config with an `inflow` filter param) |

## Live validation performed

- Read-only `information_schema`/`pg_stat_user_tables` queries against production (via `supabase db query --linked`) confirmed all 28 `parasut.*` tables exist and returned real row counts (see `PARASUT_SCHEMA_ARCHITECTURE.md`).
- Confirmed every resource key newly wired into the frontend (`customers`, `suppliers`, `products`, `sales_invoices`, `purchase_bills`, `accounts`, `sales_offers`, `bank_fees`, `inventory_levels`, `stock_movements`, `shipment_documents`) is present in `supabase/functions/parasut-api/handlers.ts`'s `LIST_RESOURCES` allowlist, so the already-deployed Edge Function accepts and correctly tenant-scopes every one of these calls.
- Full test suite (874 tests), `tsc --noEmit`, and `vite build` all pass with the new wiring; the production/ERP-boundary safeguard scripts pass.
- **Not performed**: a live, authenticated, browser-driven click-through of each route (HTTP 200 + rendered content + no console error) — this environment has no test-user session/credentials to drive an authenticated browser against `https://erp.dayandisli.com`. This is a real gap relative to the requested Phase 11 checklist; recommend a manual spot-check of the 11 changed routes immediately after deploy, focusing on `/apps/crm/customers`, `/apps/finance/purchasing/suppliers`, and `/apps/finance/income/invoices` (highest-traffic, previously silently broken).

## Explicit confirmations for this pass

- No `raw_payload` or raw JSON is rendered by any of the 11 routes changed — they render through `CanonicalParasutListPage`'s typed `cell()` formatter, identical to the pre-existing HR/E-Documents pages.
- No new Edge Function, migration, RLS policy, or write path was introduced. The dispatcher change only selects which already-shipped, already-live component renders for a given URL.
- No demo data or demo import was introduced into `/apps/*` — `/demo/*` was not touched.
- Every route above was chosen because a `parasut.*` table demonstrably exists in production (verified by read-only introspection), even where currently empty (bank_fees, stock_movements, inventory_levels) — those render the existing genuine "no records" empty state, not fabricated rows.
