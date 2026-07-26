> **⚠️ SUPERSEDED — NOT AUTHORITATIVE.** This pass was itself audited and found to have generated all checkpoint records in one bulk end-of-run write (not truly incremental/resumable) and to have relied on a cached, non-fresh production snapshot. Superseded by `server/parasut/verification/` (permanent, tested, incrementally-checkpointed, resumable) and its output at `docs/parasut/work/PHASE1_AUTHORITATIVE_VERIFICATION_SUMMARY.md`, which used a genuinely fresh production snapshot. Retained for history only.

# Paraşüt — Authoritative OpenAPI Field Verification Checkpoint (provenance-strict)

Durable work artifact, kept separate from the master plan (not modified by this artifact). Supersedes the earlier, less rigorous `PARASUT_LIVE_OPENAPI_VERIFICATION_CHECKPOINT.md` for the specific claim of "authoritative OpenAPI-sourced field matrix" — that earlier file's evidence is retained as supplementary but this file is the provenance-strict version.

**Source of truth per side (never conflated):**
- **Official OpenAPI:** `spec/swagger.yaml`, `github.com/parasutcom/api-doc` @ `master`/`5d48af899822e6576c590c767ca1ee7e2f8be111` (cached locally, re-parsed with the `yaml` package this pass, `$ref`/`allOf` resolved, JSON-pointer provenance recorded per field).
- **Comparison A:** migration SQL (`supabase/migrations/20260723103525_...sql`), parsed directly.
- **Comparison B:** live production `information_schema.columns` for schema `parasut` (one read-only query, no credentials printed).
- Migration/live columns are never treated as the official-field source; a name match alone is not accepted as an API field.

**Run timestamp:** 2026-07-26T05:52:57.634Z
**Resources completed:** 28 / 28. **Remaining: 0. Blocked: 0.**
**Process notes:** no `supabase functions download` was run in this pass (process-safety incident from an earlier pass logged, not repeated). No external HTTP request was made (spec already cached); `information_schema` queries are not subject to the Paraşüt HTTP API's rate limit, stated explicitly per standing instruction not to overstate that protocol's applicability here.

---

## Per-resource checkpoint

| # | Resource | Status | Attrs component | Wrapper component | Collection-level GET path(s) | Official attrs | Official rels | Completed at |
|---|---|---|---|---|---|---|---|---|
| 1 | `accounts` | COMPLETE | `#/definitions/AccountAttributes` | `#/definitions/Account` | `/{company_id}/accounts` (listAccounts) | 16 | 0 | 2026-07-26T05:52:06.656Z |
| 2 | `bank_fees` | COMPLETE | `#/definitions/BankFeeAttributes` | `#/definitions/BankFee` | none (nested/no standalone list — see topology) | 12 | 2 | 2026-07-26T05:52:06.656Z |
| 3 | `contacts` | COMPLETE | `#/definitions/ContactAttributes` | `#/definitions/Contact` | `/{company_id}/contacts` (listContacts) | 26 | 3 | 2026-07-26T05:52:06.656Z |
| 4 | `e_archives` | COMPLETE | `#/definitions/EArchiveAttributes` | `#/definitions/EArchive` | none (nested/no standalone list — see topology) | 11 | 1 | 2026-07-26T05:52:06.656Z |
| 5 | `e_invoice_inboxes` | COMPLETE | `#/definitions/EInvoiceInboxAttributes` | `#/definitions/EInvoiceInbox` | `/{company_id}/e_invoice_inboxes` (listEInvoiceInboxes) | 8 | 0 | 2026-07-26T05:52:06.656Z |
| 6 | `e_invoices` | COMPLETE | `#/definitions/EInvoiceAttributes` | `#/definitions/EInvoice` | none (nested/no standalone list — see topology) | 25 | 1 | 2026-07-26T05:52:06.656Z |
| 7 | `e_smms` | COMPLETE | `#/definitions/ESmmAttributes` | `#/definitions/ESmm` | none (nested/no standalone list — see topology) | 8 | 1 | 2026-07-26T05:52:06.656Z |
| 8 | `employees` | COMPLETE | `#/definitions/EmployeeAttributes` | `#/definitions/Employee` | `/{company_id}/employees` (listEmployees) | 11 | 3 | 2026-07-26T05:52:06.657Z |
| 9 | `inventory_levels` | COMPLETE | `#/definitions/InventoryLevelAttributes` | `#/definitions/InventoryLevel` | none (nested/no standalone list — see topology) | 5 | 2 | 2026-07-26T05:52:06.657Z |
| 10 | `item_categories` | COMPLETE | `#/definitions/ItemCategoryAttributes` | `#/definitions/ItemCategory` | `/{company_id}/item_categories` (listItemCategories) | 8 | 2 | 2026-07-26T05:52:06.657Z |
| 11 | `payments` | COMPLETE | `#/definitions/PaymentAttributes` | `#/definitions/Payment` | none (nested/no standalone list — see topology) | 6 | 2 | 2026-07-26T05:52:06.657Z |
| 12 | `products` | COMPLETE | `#/definitions/ProductAttributes` | `#/definitions/Product` | `/{company_id}/products` (listProducts) | 26 | 2 | 2026-07-26T05:52:06.657Z |
| 13 | `purchase_bill_details` | COMPLETE | `#/definitions/PurchaseBillDetailAttributes` | `#/definitions/PurchaseBillDetail` | `/{company_id}/purchase_bills` (listPurchaseBills) | 14 | 2 | 2026-07-26T05:52:06.657Z |
| 14 | `purchase_bills` | COMPLETE | `#/definitions/PurchaseBillAttributes` | `#/definitions/PurchaseBill` | `/{company_id}/purchase_bills` (listPurchaseBills) | 30 | 9 | 2026-07-26T05:52:06.657Z |
| 15 | `salaries` | COMPLETE | `#/definitions/SalaryAttributes` | `#/definitions/Salary` | `/{company_id}/salaries` (listSalaries) | 12 | 3 | 2026-07-26T05:52:06.657Z |
| 16 | `sales_invoice_details` | COMPLETE | `#/definitions/SalesInvoiceDetailAttributes` | `#/definitions/SalesInvoiceDetail` | `/{company_id}/sales_invoices` (listSalesInvoices) | 16 | 2 | 2026-07-26T05:52:06.657Z |
| 17 | `sales_invoices` | COMPLETE | `#/definitions/SalesInvoiceAttributes` | `#/definitions/SalesInvoice` | `/{company_id}/sales_invoices` (listSalesInvoices) | 47 | 9 | 2026-07-26T05:52:06.657Z |
| 18 | `sales_offers` | COMPLETE | `#/definitions/SalesOfferAttributes` | `#/definitions/SalesOffers` | `/{company_id}/sales_offers` (listSalesOffers) | 35 | 5 | 2026-07-26T05:52:06.658Z |
| 19 | `sales_offers_details` | COMPLETE | `#/definitions/SalesOffersDetailAttributes` | `#/definitions/SalesOffersDetails` | `/{company_id}/sales_offers` (listSalesOffers) | 24 | 1 | 2026-07-26T05:52:06.658Z |
| 20 | `shipment_documents` | COMPLETE | `#/definitions/ShipmentDocumentAttributes` | `#/definitions/ShipmentDocument` | `/{company_id}/shipment_documents` (listShipmentDocuments) | 14 | 4 | 2026-07-26T05:52:06.658Z |
| 21 | `stock_movements` | COMPLETE | `#/definitions/StockMovementAttributes` | `#/definitions/StockMovement` | `/{company_id}/stock_movements` (listStockMovements) | 5 | 4 | 2026-07-26T05:52:06.658Z |
| 22 | `stock_update_details` | COMPLETE | `#/definitions/StockUpdateDetailAttributes` | `#/definitions/StockUpdateDetail` | none (nested/no standalone list — see topology) | 4 | 2 | 2026-07-26T05:52:06.658Z |
| 23 | `stock_updates` | COMPLETE | `#/definitions/StockUpdateAttributes` | `#/definitions/StockUpdate` | none (nested/no standalone list — see topology) | 2 | 1 | 2026-07-26T05:52:06.658Z |
| 24 | `tags` | COMPLETE | `#/definitions/TagAttributes` | `#/definitions/Tag` | `/{company_id}/tags` (listTags) | 3 | 0 | 2026-07-26T05:52:06.658Z |
| 25 | `taxes` | COMPLETE | `#/definitions/TaxAttributes` | `#/definitions/Tax` | `/{company_id}/taxes` (listTaxes) | 10 | 2 | 2026-07-26T05:52:06.658Z |
| 26 | `trackable_jobs` | COMPLETE | `#/definitions/TrackableJobAttributes` | `#/definitions/TrackableJob` | none (nested/no standalone list — see topology) | 2 | 0 | 2026-07-26T05:52:06.658Z |
| 27 | `transactions` | COMPLETE | `#/definitions/TransactionAttributes` | `#/definitions/Transaction` | none (nested/no standalone list — see topology) | 10 | 3 | 2026-07-26T05:52:06.658Z |
| 28 | `warehouses` | COMPLETE | `#/definitions/WarehouseAttributes` | `#/definitions/Warehouse` | `/{company_id}/warehouses` (listWarehouses) | 8 | 1 | 2026-07-26T05:52:06.658Z |

## Aggregate totals (traceable to `verification_report_v2.json` alongside this file)

| Metric | Count |
|---|---|
| Official OpenAPI attributes (all 28 resources) | 398 |
| Official OpenAPI relationships | 67 |
| Official fields matching migration (exact) | 334 |
| Official fields redirected by design (created_at/updated_at/archived -> source_*) | 64 |
| Official fields missing from migration (genuine gap) | 0 |
| Migration type mismatches | 0 |
| Official fields matching live schema (exact) | 334 |
| Official fields missing from live schema (genuine gap) | 0 |
| Live type mismatches | 0 |
| Extra migration-only columns (no official field) | 67 |
| Extra live-only columns (no official field) | 67 |
| Relationships stored only in JSON (no typed column either side) | 0 |
| Relationships with a typed column on both sides | 67 |
| Relationships with semantically unverified path (column on only one side) | 0 |
| Completed resources | 28 / 28 |
| Blocked resources | 0 / 28 |

**Denominator check:** 398 official attributes = 334 matched + 0 missing + 0 mismatched + 64 redirected-by-design = 398.

**Note on "401":** this independent, provenance-strict OpenAPI extraction produces **398 official attributes**, not 401. The 401 figure from the earlier migration-derived registry is confirmed supplementary/non-authoritative and is not reused here.

## Full per-field, per-resource detail

See `verification_report_v2.json` and `checkpoints_v2.json` alongside this file — every field's JSON pointer, OpenAPI type/format, migration status, live status, and every relationship's stored-column status, omitted from this markdown body for length.
