> **⚠️ SUPERSEDED — NOT AUTHORITATIVE.** This was a provisional pass, later audited and found to contain a real classification bug (relationship-backed columns mislabeled as "extra columns"). Superseded by the permanent, tested implementation in `server/parasut/verification/` and its output at `docs/parasut/work/PHASE1_AUTHORITATIVE_VERIFICATION_SUMMARY.md`. Retained for history only — do not cite this file as evidence.

# Paraşüt — Live OpenAPI Three-Way Field Verification Checkpoint

**Separate from the master plan** (`docs/parasut/PARASUT_PROFESSIONAL_INTEGRATION_MASTER_PLAN.md`) — this is a durable, standalone evidence artifact for the resource-by-resource verification requested in this pass. The master plan has not been modified.

**Methodology (source of truth for each side, per instruction):**
- **Official OpenAPI source:** `spec/swagger.yaml`, `github.com/parasutcom/api-doc`, branch `master`, commit `5d48af899822e6576c590c767ca1ee7e2f8be111` (already cached locally from an earlier pass — re-parsed fresh this pass with the `yaml` package, not reused as pre-extracted JSON). Two schema families per resource: `<Name>Attributes` (attribute fields) and the plain wrapper schema `<Name>` (documents `relationships`, evidence for path verification).
- **Comparison side A:** `supabase/migrations/20260723103525_parasut_full_apidocs_schema_expansion.sql`, parsed directly from the file text.
- **Comparison side B:** live production `information_schema.columns` for schema `parasut`, retrieved via one read-only `supabase db query --linked` metadata call (no credentials/tokens/status JSON printed).
- Migration-derived columns are **never** treated as official API attributes — they are one comparison target, not the source.

**Run timestamp:** 2026-07-26T05:46:41.464Z
**Resources completed:** 28 / 28
**Resources remaining:** 0
**Errors / rate-limit events:** none (no external HTTP request was made this pass — the OpenAPI spec was already cached from a prior fetch, and Postgres `information_schema` queries are not subject to the Paraşüt API's HTTP rate limits; both facts stated explicitly per the instruction not to overstate applicability of the 429/backoff protocol)

---

## Per-resource ledger

| # | Resource | Topology | Official schema evidence | Official attrs | Official rels | Exact matches | Type mismatches | Missing migration | Missing live | Extra migration/live (intentional redirect) | Relationship paths verified from spec | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `accounts` | direct-list | `#/definitions/AccountAttributes` + `#/definitions/Account` | 16 | 0 | 13 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 0 | 0 verified | COMPLETE |
| 2 | `bank_fees` | unsupported-live-404 | `#/definitions/BankFeeAttributes` + `#/definitions/BankFee` | 12 | 2 | 9 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 2 | 2 verified | COMPLETE |
| 3 | `contacts` | direct-list | `#/definitions/ContactAttributes` + `#/definitions/Contact` | 26 | 3 | 23 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 3 | 3 verified, 1 reclassified attr | COMPLETE |
| 4 | `e_archives` | unsupported-live-404 | `#/definitions/EArchiveAttributes` + `#/definitions/EArchive` | 11 | 1 | 9 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 1 | 1 verified | COMPLETE |
| 5 | `e_invoice_inboxes` | direct-list | `#/definitions/EInvoiceInboxAttributes` + `#/definitions/EInvoiceInbox` | 8 | 0 | 6 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 0 | 0 verified | COMPLETE |
| 6 | `e_invoices` | direct-list | `#/definitions/EInvoiceAttributes` + `#/definitions/EInvoice` | 25 | 1 | 23 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 1 | 1 verified | COMPLETE |
| 7 | `e_smms` | unsupported-live-404 | `#/definitions/ESmmAttributes` + `#/definitions/ESmm` | 8 | 1 | 6 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 1 | 1 verified | COMPLETE |
| 8 | `employees` | direct-list | `#/definitions/EmployeeAttributes` + `#/definitions/Employee` | 11 | 3 | 8 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 3 | 3 verified | COMPLETE |
| 9 | `inventory_levels` | nested-singular-parent | `#/definitions/InventoryLevelAttributes` + `#/definitions/InventoryLevel` | 5 | 2 | 3 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 2 | 2 verified | COMPLETE |
| 10 | `item_categories` | direct-list | `#/definitions/ItemCategoryAttributes` + `#/definitions/ItemCategory` | 8 | 2 | 6 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 2 | 2 verified | COMPLETE |
| 11 | `payments` | nested-included | `#/definitions/PaymentAttributes` + `#/definitions/Payment` | 6 | 2 | 4 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 2 | 2 verified | COMPLETE |
| 12 | `products` | direct-list | `#/definitions/ProductAttributes` + `#/definitions/Product` | 26 | 2 | 23 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 2 | 2 verified | COMPLETE |
| 13 | `purchase_bill_details` | nested-included | `#/definitions/PurchaseBillDetailAttributes` + `#/definitions/PurchaseBillDetail` | 14 | 2 | 12 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 2 | 2 verified | COMPLETE |
| 14 | `purchase_bills` | direct-list | `#/definitions/PurchaseBillAttributes` + `#/definitions/PurchaseBill` | 30 | 9 | 27 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 9 | 9 verified | COMPLETE |
| 15 | `salaries` | direct-list | `#/definitions/SalaryAttributes` + `#/definitions/Salary` | 12 | 3 | 9 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 3 | 3 verified | COMPLETE |
| 16 | `sales_invoice_details` | nested-included | `#/definitions/SalesInvoiceDetailAttributes` + `#/definitions/SalesInvoiceDetail` | 16 | 2 | 14 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 2 | 2 verified | COMPLETE |
| 17 | `sales_invoices` | direct-list | `#/definitions/SalesInvoiceAttributes` + `#/definitions/SalesInvoice` | 47 | 9 | 44 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 9 | 9 verified, 2 reclassified attr | COMPLETE |
| 18 | `sales_offers` | direct-list | `#/definitions/SalesOfferAttributes` + `#/definitions/SalesOffers` | 35 | 5 | 34 | 0 | 1 (redirected: created_at/updated_at/archived -> source_*) | 1 (same) | 5 | 5 verified | COMPLETE |
| 19 | `sales_offers_details` | nested-included-unregistered | `#/definitions/SalesOffersDetailAttributes` + `#/definitions/SalesOffersDetails` | 24 | 1 | 22 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 1 | 1 verified | COMPLETE |
| 20 | `shipment_documents` | direct-list | `#/definitions/ShipmentDocumentAttributes` + `#/definitions/ShipmentDocument` | 14 | 4 | 11 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 4 | 4 verified | COMPLETE |
| 21 | `stock_movements` | unsupported-live-500 | `#/definitions/StockMovementAttributes` + `#/definitions/StockMovement` | 5 | 4 | 3 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 4 | 4 verified | COMPLETE |
| 22 | `stock_update_details` | nested-included-blocked | `#/definitions/StockUpdateDetailAttributes` + `#/definitions/StockUpdateDetail` | 4 | 2 | 2 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 2 | 2 verified | COMPLETE |
| 23 | `stock_updates` | unsupported-live-500 | `#/definitions/StockUpdateAttributes` + `#/definitions/StockUpdate` | 2 | 1 | 0 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 1 | 1 verified | COMPLETE |
| 24 | `tags` | direct-list | `#/definitions/TagAttributes` + `#/definitions/Tag` | 3 | 0 | 1 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 0 | 0 verified | COMPLETE |
| 25 | `taxes` | direct-list | `#/definitions/TaxAttributes` + `#/definitions/Tax` | 10 | 2 | 7 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 2 | 2 verified | COMPLETE |
| 26 | `trackable_jobs` | nested-single-record | `#/definitions/TrackableJobAttributes` + `#/definitions/TrackableJob` | 2 | 0 | 2 | 0 | 0 (redirected: created_at/updated_at/archived -> source_*) | 0 (same) | 0 | 0 verified | COMPLETE |
| 27 | `transactions` | nested-single-record | `#/definitions/TransactionAttributes` + `#/definitions/Transaction` | 10 | 3 | 8 | 0 | 2 (redirected: created_at/updated_at/archived -> source_*) | 2 (same) | 3 | 3 verified | COMPLETE |
| 28 | `warehouses` | direct-list | `#/definitions/WarehouseAttributes` + `#/definitions/Warehouse` | 8 | 1 | 5 | 0 | 3 (redirected: created_at/updated_at/archived -> source_*) | 3 (same) | 1 | 1 verified | COMPLETE |

**Totals:** official attributes 398, exact matches 334, type mismatches 0, verified relationship paths 67.

## Notable corrections made mechanically during this pass

1. **`payments.currency`**: the official spec (`PaymentAttributes.currency`) declares JSON Schema `type: number` (description "Para birimi") — this is the **only** currency field across all 28 resources the API itself defines as numeric. The migration's `numeric` PG type for this column **matches the official contract exactly**. The prior classification of this as a migration typo/defect is retracted — it was never a defect.
2. **Timestamptz false-positive**: an early run of this pass's own comparison script flagged 8 fields as type mismatches purely because it didn't recognize `timestamptz` and `timestamp with time zone` as the same PostgreSQL type (they are — the former is a built-in alias for the latter). Fixed in the comparison tool; re-run confirms 0 genuine type mismatches across all 401→398 official/migration-compared fields.
3. **3 fields reclassified from "relationship" to "attribute"**: `contacts.invoicing_preferences`, `sales_invoices.payer_tax_numbers`, `sales_invoices.e_document_accounts` were tagged "relationship" by an earlier heuristic (name-matching against a hardcoded list). The official spec confirms all three are genuine **attributes** (present in the `*Attributes` schema, not in the wrapper's `relationships` object). Corrected — 0 genuinely unverified relationship paths remain; 67 relationship paths across all resources are now positively verified against real wrapper-schema evidence (previously only inferred from a naming convention).

## Full per-field detail (JSON, machine-readable, not duplicated in the master plan)

See `verification_report.json` alongside this file for the complete per-field breakdown (official field list with JSON Schema type/format, exact-match list, relationship verification per column with cited spec path, extra/missing column lists) — omitted from this markdown body for length; every number in the table above is drawn directly from it.
