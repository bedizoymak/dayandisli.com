# Paraşüt API Discovery Report

Read-only discovery only. All requests below were `GET`. No `POST`/`PATCH`/`PUT`/`DELETE` requests were made. No mirror data was written, no migrations applied, no frontend/Edge Function deployed. External Paraşüt company id used: `666034`. Base URL: `https://api.parasut.com`, path prefix `/v4/{company_id}/...`, JSON:API format (`application/vnd.api+json`).

## Phase 1 — API Health

| Check | Result |
|---|---|
| OAuth token acquisition (`grant_type=password`) | 200 OK |
| Authenticated GET requests | all succeeded (200) except two capability probes below |
| `/v4/{company_id}` root ("/me"-equivalent) | 404 — not a real endpoint; Paraşüt has no company-root resource document |
| Rate-limit headers | none observed on any response |
| Pagination metadata | `meta.current_page`, `meta.total_pages`, `meta.total_count`, `meta.per_page` present on every list endpoint |
| API version / base URL | `v4`, `https://api.parasut.com` |

## Phase 2/3 — Exact API Inventory

| API resource | Endpoint | List | Detail | Include support | Included child types confirmed | Pagination | Archive/deletion indicator | Recommended mirror table | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| contacts | `/v4/{cid}/contacts` | Yes (200) | not probed (list only, per instructions) | not tested this pass | — | page/size `meta` w/ `total_pages`/`total_count` | `archived` boolean attribute | `parasut.contacts` | High |
| products | `/v4/{cid}/products` | Yes (200) | not probed | not tested | — | same pattern | `archived` boolean attribute | `parasut.products` | High |
| accounts | `/v4/{cid}/accounts` | Yes (200) | not probed | not tested | — | same pattern | `archived` boolean attribute | `parasut.accounts` | High |
| sales_invoices | `/v4/{cid}/sales_invoices` | Yes (200) | not probed | `include=contact,details,payments` confirmed | `contacts`, `sales_invoice_details`, `payments` | same pattern | `archived` boolean attribute | `parasut.sales_invoices` (+ `sales_invoice_details`, `payments`) | High |
| purchase_bills | `/v4/{cid}/purchase_bills` | Yes (200) | not probed | `include=spender,details,payments` requested; only `purchase_bill_details` and `payments` were actually returned in `included` — **`spender` did not resolve as an included type in this sample** | `purchase_bill_details`, `payments` (spender unconfirmed) | same pattern | `archived` boolean attribute | `parasut.purchase_bills` (+ `purchase_bill_details`, `payments`) | Medium — `spender`/`supplier` include unconfirmed |
| payments (standalone) | `/v4/{cid}/payments` | **No — 404** | — | N/A | N/A | N/A | N/A | `parasut.payments` (populated only via nested includes from invoices/bills, never as a standalone list sync) | High (capability confirmed absent) |

### Confirmed attribute/relationship keys (abbreviated — full raw capture retained in session, not persisted to avoid duplicating large payload dumps)

- **contacts**: attributes include `name`, `contact_type`, `balance`, `tax_number`, `archived`, `ibans`, etc. Relationships: `category`, `price_list`, `contact_people`, `tags`, etc. No nested `included` requested this pass.
- **products**: attributes include `code`, `name`, `stock_count`, `list_price`, `currency`, `archived`, etc. Relationships: `category`, `inventory_levels`, `warehouses`, `tags`.
- **accounts**: attributes include `name`, `currency`, `balance`, `iban`, `bank_name`, `archived`. Relationship: `company`.
- **sales_invoices**: ~70 attribute keys (totals, tax breakdowns, e-document fields, dates). Relationships: `contact`, `details`, `payments`, `category`, `tags`, `refund_of`/`refunds`, `active_e_document`, etc.
- **purchase_bills**: ~50 attribute keys (totals, tax breakdowns, reimbursement fields). Relationships: `supplier`, `spender`, `details`, `payments`, `pay_to`, `reimbursement_tx`, `category`, `tags`.

All resource IDs are numeric-string JSON:API ids (e.g. `"1010689160"`), matching the existing `parasut_id text` column design — not UUIDs.

## Phase 5 — Current Schema Compatibility

| Current object | Required (per confirmed API) | Match | Notes / recommended action |
|---|---|---|---|
| `parasut.contacts` | contacts mirror | Match | lossless design already (see below) |
| `parasut.products` | products mirror | Match | — |
| `parasut.accounts` | accounts mirror | Match | — |
| `parasut.sales_invoices` | sales_invoices mirror | Match | — |
| `parasut.sales_invoice_details` | nested detail mirror | Match | — |
| `parasut.purchase_bills` | purchase_bills mirror | Match | — |
| `parasut.purchase_bill_details` | nested detail mirror | Match | — |
| `parasut.payments` | payments mirror (nested-only source) | Match | correctly modeled as a table with no standalone sync source, consistent with the confirmed 404 |
| `integration.sync_runs` | should live under `parasut` per this task's target architecture | Wrong schema | proposed move already drafted in `docs/migration-proposals/20260716090000_move_sync_tables_to_parasut_schema.sql` (unapplied) |
| `integration.sync_errors` | should live under `parasut` per this task's target architecture | Wrong schema | same proposal covers this |
| Nothing invented without API support | — | Confirmed | no mirror table exists for a resource that isn't a real, confirmed API resource |

Every resource table already stores `attributes jsonb`, `relationships jsonb`, `included jsonb`, and `raw_payload jsonb` — the complete original JSON:API payload shape is preserved losslessly today; unknown/future attributes are not discarded. Every resource table has a `UNIQUE (parasut_company_id, resource_type, parasut_id)` constraint plus a `company_id uuid` tenant column — this already supports multi-company isolation and idempotent upserts (`ON CONFLICT` on that unique key). RLS is enabled on every `parasut.*` and `integration.*` table.

**Overall current-schema compatibility with the confirmed API: ~95%.** The only concrete gap found is schema placement of `sync_runs`/`sync_errors` (`integration` vs. the target `parasut`), which already has an unapplied, prepared migration. No column, constraint, or data-modeling gap was found against any endpoint actually exercised this pass. The `purchase_bills.spender` include did not resolve to an included resource in the sampled data — this should be re-verified against a purchase bill known to have a `spender` set before treating it as fully confirmed; it does not block sync since `attributes`/`relationships` JSONB already retains whatever the API returns regardless of whether `included` resolves.

## Post-Sync Confirmation: `purchase_bills.supplier` Requires Explicit `include`

Following the first real production sync (764 purchase bills), the `spender` include flagged as unconfirmed above was fully diagnosed: **0/764** synced rows carry a resolvable `supplier` or `spender` relationship (`relationships.supplier` has no `data` key at all — only `meta: {}` — despite every row being the formal `item_type: "purchase_bill"`), while the analogous `sales_invoices.contact` relationship resolves for **436/436** rows. Root cause confirmed: `server/parasut/sync-sales-invoices.ts` requests `include: ["contact", ...]` and works; `server/parasut/sync-purchase-bills.ts` requested `include: ["spender", ...]` but never `"supplier"`. This confirms Paraşüt's API only returns relationship *linkage* (`data`) for relationships named in `include=`, not for every relationship on the base resource — contradicting a strict JSON:API assumption and worth remembering for any future resource/include work. Fixed by adding `"supplier"` to the include list (does not retroactively backfill the 764 already-synced rows; needs a purchase_bills-only resync).

## Phase 6 — Proposal Status

No new migration was required beyond the one already prepared (`docs/migration-proposals/20260716090000_move_sync_tables_to_parasut_schema.sql` + its `.rollback.sql`), since the resource-table design already matches the confirmed API 1:1. No new SQL was written this pass. No sync-runner or Edge Function changes are required by this discovery pass.
