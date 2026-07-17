# ERP Business Architecture

Status: **Foundation phase** — architecture and service layer only. No public ERP tables, no ERP API endpoints, no cache, and no frontend wiring exist yet (see "Remaining Work"). This document defines the permanent layering the rest of the ERP is built on.

**Superseded/extended by `ACCOUNTING_PROVIDER_ARCHITECTURE.md`**: the sections below describe services depending on per-service "ERP repository" interfaces (`CustomerRepository`, etc.). As of the provider-abstraction phase, those interfaces are now typed as narrow slices (`Pick<...>`) of a single shared `AccountingProvider` contract, so the ERP layer is no longer implicitly Paraşüt-only. The layering rule, service responsibilities, and known limitations described here are unchanged and still accurate — only the exact repository type names moved. Read that document for the provider contract, registry, and future-provider details.

**Further extended by `BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md`** (Phase 007, see `docs/DAYANDISLI_PHASE_SYSTEM_V3.md`): the read-only `AccountingProvider` from the provider-abstraction phase now has a sibling write contract (`CustomerWriteProvider`), a durable outbound-command handler, a proposed `public.accounting_outbound_commands`/`accounting_outbound_attempts`/`accounting_provider_links`/`accounting_audit_log` schema, a dedicated write-capable Edge Function (`supabase/functions/parasut-write-api`), and a permission-gated ERP frontend form — the first real, code-complete instance of the "ERP Services → public.*" arrow in this document's original layering diagram. Migration application, Edge Function deployment, frontend deployment, and the one real production test customer remain pending explicit user authorization.

## Why this layer exists

The Paraşüt module (`PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md`) is a read-only accounting mirror: it copies Paraşüt's JSON:API resources into `parasut.*` verbatim and exposes them through `parasut-api` for direct display (lists, detail pages, basic reports). That was the right design for "show me my Paraşüt data" — but it means every ERP page that wants business intelligence (customer risk, supplier scoring, product margin, growth trends) would otherwise have to read `parasut.*` shapes directly and recompute logic in React. That does not scale, is not testable in isolation, is not reusable by a future AI layer, and — critically — creates code that silently breaks the moment Paraşüt's API shape changes or the ERP later needs data Paraşüt doesn't have.

The fix is a permanent layering rule:

```
parasut.*                    (Mirror Layer — Paraşüt accounting mirror, read-only, GET-only, never touched by business logic)
    ↓
ERP Services                 (this document — pure, typed, testable business logic; the ONLY thing that reads mirror + ERP-owned tables)
    ↓
public.*                     (ERP-owned tables — business data with no Paraşüt equivalent: notes, tags, scores, settings)
    ↓
ERP API                      (typed HTTP endpoints — the ONLY thing the frontend calls for business pages)
    ↓
ERP UI                       (React — renders typed results only; no SQL, no business calculation, ever)
```

**Non-negotiable rules** (carried forward from the Paraşüt module's own hard-won lessons, see its report §14/§0c):

1. `parasut.*` is permanently stable, read-only infrastructure. Nothing in this document, or anything built on top of it, ever writes to `parasut.*`, ever calls the real Paraşüt API, and ever adds bidirectional sync. The mirror sync engine (`server/parasut/sync-*.ts`) is untouched by this work.
2. ERP UI pages never query `parasut.*` or `public.*` directly. They call ERP API endpoints, which call ERP Services, which are the only code allowed to read the mirror.
3. Money is never summed in floating point. All services use `server/erp/decimal.ts` (fixed-point bigint, independent implementation from the Paraşüt module's own `parasut-metrics.ts` — see "Why not reuse parasut-metrics.ts" below).
4. Currencies are never combined. Every monetary result is `CurrencyAmount[]`, grouped, never summed across currencies.
5. Nothing is fabricated. When a metric can't be reliably calculated from available data (see `SupplierAnalyticsResult.averageLeadTimeDays`, `ProductAnalyticsResult.grossMargin`, `GrowthMetric.growthPercent`), the typed result is `null` with a doc comment explaining why — never a guessed number, never a silent zero.

### Why not reuse `parasut-metrics.ts`?

`supabase/functions/_shared/parasut-metrics.ts` already has decimal-safe math and currency grouping, and it would have been less code to import it. It was deliberately **not** reused: the objective for this phase is explicitly "the ERP must NEVER depend on Paraşüt's internal business logic" — if the Paraşüt module is ever replaced, deprecated, or its metrics module refactored for Paraşüt-specific reasons, the ERP business layer must not break or need to change. `server/erp/decimal.ts` and `server/erp/aggregation.ts` are the ERP's own copies of the same well-tested pattern, intentionally duplicated once rather than shared, to keep the dependency arrow pointing one way only: ERP Services depend on nothing Paraşüt-specific.

## Current state: what exists today

### `server/erp/` — the business service layer (this phase)

| File | Purpose |
|---|---|
| `decimal.ts` | Fixed-point decimal arithmetic (parse/format/sum/subtract/multiply), independent of the Paraşüt module. |
| `aggregation.ts` | Generic `groupSumByCurrency` and `buildMonthlyTrend` helpers, shared by every service. |
| `types.ts` | The ERP's own domain model — `CustomerAnalyticsResult`, `SupplierAnalyticsResult`, `ProductAnalyticsResult`, `FinanceSummary`, `FinanceDashboardResult`, and the generic mirror-input "port" shapes (`MirrorDocument`, `MirrorPayment`, `MirrorLineItem`, `MirrorAccount`) that repository adapters must satisfy. |
| `services/customer-service.ts` | `CustomerService` — profile, turnover, outstanding balance, last invoice, sales trend, payment behavior. |
| `services/supplier-service.ts` | `SupplierService` — purchase history, payment history, supplier score. `averageLeadTimeDays` is permanently `null` — see "Known limitations" below. |
| `services/product-service.ts` | `ProductService` — sales/purchase quantity, turnover, gross margin (only when a same-currency cost basis is known), movement history. |
| `services/finance-service.ts` | `FinanceService` — company-wide receivables/payables/overdue/cash position/monthly summaries. |
| `services/analytics-service.ts` | `AnalyticsService` — composes `FinanceSummary` into dashboard KPI cards, growth metrics, and a labeled gross-profit *estimate*. |

Every service follows the same shape: a **repository interface** (the "port" — e.g. `CustomerRepository`) describing exactly what mirror data it needs in the ERP's own type shapes, a set of **exported pure functions** (`computeTurnover`, `computeOverdueReceivables`, etc.) that do the actual calculation and are unit-tested with fixture data, and a thin **service class** that composes the pure functions after fetching from the repository. This mirrors the pattern already proven in this codebase by `supabase/functions/_shared/parasut-metrics.ts` — zero Deno-specific imports, so every service file passes both `deno check` and `vitest` unchanged, ready to run inside a future Edge Function exactly as-is.

**50 unit tests** cover every pure computation function across all five services (`server/erp/**/*.test.ts`), using realistic fixture data (not mocks of a database) — see "Testing" below.

### What does NOT exist yet (by design — see "Remaining Work")

- **No repository adapters.** Every `*Repository` interface (`CustomerRepository`, `SupplierRepository`, etc.) has zero real implementations. Nothing in this phase queries `parasut.*` or any live database. Tests use in-memory fixture objects satisfying the interface.
- **No `public.*` ERP-owned tables.** No migration exists yet for `customer_notes`, `customer_tags`, `supplier_scores`, `customer_scores`, `risk_levels`, `product_categories`, `production_settings`, `forecast_settings`, `erp_notifications`, `approval_rules`, or `user_preferences`.
- **No ERP API.** No `GET /erp/customer/:id` etc. endpoints exist. No new Edge Function was created.
- **No cache layer.**
- **No frontend wiring.** The existing Paraşüt UI pages are untouched and continue to call `parasut-api` directly for their existing (accounting-mirror-display) purpose — that is correct and unchanged. This business layer is additive, for a *different* class of page (business intelligence), not a replacement.

## Known limitations (documented, not silently assumed away)

- **`SupplierAnalyticsResult.averageLeadTimeDays` is permanently `null`.** Computing supplier lead time requires purchase-order and goods-receipt dates, neither of which exist in the current `parasut.purchase_bills` mirror (only `issue_date`/`due_date`, which are billing dates, not fulfillment dates). This cannot be fixed by better code — it needs a new data source (see "Future MRP Layer").
- **`ProductAnalyticsResult.grossMargin` requires a same-currency cost basis.** Paraşüt's confirmed `products.buying_price`/`buying_currency` attributes (see `PARASUT_API_DISCOVERY_REPORT.md`) are used as the cost basis; margin is `null` when unknown or when the sale currency differs from the buying currency (no fabricated exchange-rate conversion, consistent with the Paraşüt reports module's existing rule).
- **`MirrorLineItem`'s exact field mapping is unverified.** `sales_invoice_details`/`purchase_bill_details` attribute key names were never discovery-captured against a real Paraşüt API response (only the parent `sales_invoices`/`purchase_bills` attributes were). `ProductService`'s repository port defines the ERP's *own* required shape (`quantity`, `unitPrice`, `netTotal`, `currency`, `date`); the future repository adapter must map real mirror columns onto it — do not assume Paraşüt's real field names match without checking.
- **`GrowthMetric.growthPercent` is `null` when the prior period had zero activity** — division-by-zero would otherwise silently produce `Infinity` or a fabricated `0%`.
- **`FinanceDashboardResult.grossProfitEstimate` is explicitly labeled an estimate** — sales net minus purchase net, with no overhead, COGS timing, or partial-shipment precision. Same honesty convention as the Paraşüt module's monthly VAT estimate (`computeMonthlyVatEstimate` in `parasut-metrics.ts`).

## Testing

All 50 tests are pure-function unit tests against fixture data — no database, no mocked Supabase client, matching the project's established preference (see the Paraşüt module's `parasut-metrics.test.ts`) for testing business logic as plain input→output rather than through an I/O layer. Each service class itself (`CustomerService`, `SupplierService`, `ProductService`, `FinanceService`) also has a small number of composition tests using an in-memory fixture object satisfying its repository interface, confirming the class correctly wires the pure functions together — not testing a real database.

**Not yet added** (deferred to the next phase, once real adapters exist): integration tests against a real/fake Supabase client, tenant-isolation tests (this phase has no per-tenant data access at all yet — every function takes already-scoped input), and API-level tests (no API exists yet).

## Future AI Layer

Every service result type (`CustomerAnalyticsResult`, `SupplierAnalyticsResult`, `ProductAnalyticsResult`, `FinanceDashboardResult`) is a small, fully-typed, JSON-serializable object with no UI concerns — designed so a future AI/LLM-driven feature (e.g. "explain this customer's risk", "suggest a reorder point") can consume these exact typed results as tool-call output without any adapter code. The rule that nothing is fabricated (nulls instead of guesses) matters doubly here: an AI feature reasoning over these results must be able to trust that a non-null field is real, calculated data.

## Future MRP Layer

Manufacturing/production data (work orders, BOMs, lead times, capacity) has no Paraşüt equivalent and would live entirely in new `public.*` tables, consumed by new services following this exact same pattern (repository port + pure functions + thin service class). `SupplierAnalyticsResult.averageLeadTimeDays` is the clearest current placeholder for this — once a receiving/goods-receipt table exists, a `LeadTimeService` (or an extension to `SupplierService`) can compute it for real instead of returning `null`.

## Remaining Work (next phases, in order)

1. **Repository adapters.** Implement the real Supabase-backed adapters for each `*Repository` interface (likely a new `server/erp/adapters/` or directly in a new Edge Function's handler layer, following the exact `scopedParasutTable`/`SupabaseAdminLike` pattern already proven in `supabase/functions/parasut-api/handlers.ts`) — including resolving `MirrorLineItem`'s real field mapping against actual `sales_invoice_details`/`purchase_bill_details` data (see "Known limitations" above).
2. **`public.*` ERP-owned tables.** Draft migrations (under `docs/migration-proposals/` first, per this repo's migration-safety convention — never directly in `supabase/migrations/` without explicit approval) for `customer_notes`, `customer_tags`, `supplier_scores`, `customer_scores`, `risk_levels`, `product_categories`, `production_settings`, `forecast_settings`, `erp_notifications`, `approval_rules`, `user_preferences`.
3. **ERP API.** A new Edge Function (e.g. `erp-api`, sibling to `parasut-api`) exposing `GET /erp/customer/:id`, `GET /erp/customer/:id/analytics`, `GET /erp/product/:id`, `GET /erp/product/:id/analytics`, `GET /erp/supplier/:id`, `GET /erp/dashboard`, `GET /erp/finance` — thin routing over these same services, with the same tenant-isolation discipline (`resolveCompanyScope`) already proven in `parasut-api`.
4. **Cache layer.** Once the ERP API exists and is measurably slow/repeated, introduce caching (likely a `public.erp_analytics_cache` table populated by the sync engine or a scheduled recompute, read by the API) — premature before real usage patterns are known.
5. **Frontend wiring.** New ERP business pages (customer 360, supplier scorecards, product profitability) consuming the ERP API exclusively — never `parasut-api` directly for business-intelligence pages.
6. **Integration/tenant tests.** Once adapters exist, add tests proving no cross-company data ever reaches a service result — mirroring the rigor already established in `supabase/functions/parasut-api/handlers.test.ts`.
