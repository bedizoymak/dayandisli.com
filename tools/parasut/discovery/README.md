# Paraşüt API Read-Only Discovery

Discovery date: June 13, 2026  
Company ID: `666034`

## 1. Authentication Result

OAuth password-grant authentication succeeded. Tokens were held in memory only and were not written to files or printed.

The requested `tools/parasut/.env` file was not present. The existing ignored repository-root `.env` contained the required variable names and was used without displaying values.

## 2. Available Resources Tested

All requests used page 1 and page size 5 where pagination applies.

| Resource | Result | Sample count |
| --- | --- | --- |
| `/v4/me` | HTTP 200 | 1 |
| `/v4/666034/contacts` | HTTP 200 | 5 |
| `/v4/666034/products` | HTTP 200 | 5 |
| `/v4/666034/sales_invoices` | HTTP 200 | 5 |
| `/v4/666034/purchase_invoices` | HTTP 404 | 0 |
| `/v4/666034/payments` | HTTP 404 | 0 |
| `/v4/666034/accounts` | HTTP 200 | 3 |

No alternate endpoint was guessed or called.

## 3. Fields Observed per Resource

### Me

Observed user fields include confirmation and contract states, timestamps, two-factor status, and redacted identity fields. Relationships: `profile`, `user_roles`.

### Contacts

Observed business fields include:

- `account_type`, `contact_type`, `archived`
- balances by currency, opening balance, term days
- invoicing preferences and exchange-rate type
- foreign-contact and tracking indicators
- timestamps
- redacted identity, tax, address, communication, and bank fields

Sample values showed `contact_type=company` and both `account_type=customer` and `account_type=supplier`.

### Products

Observed fields include:

- product code, barcode, GTIN, GTIP, unit
- list and buying prices/currencies
- VAT and excise-duty fields
- inventory tracking, initial/current/critical stock
- Sales and purchase invoice-detail counts
- archived state and timestamps
- redacted product name and media fields

All five sampled products had inventory tracking enabled.

### Sales Invoices

Observed fields include:

- invoice number/series/type, issue date, due date, order and shipment references
- currency, exchange rate, gross/net/tax/discount totals
- payment status, total paid, remaining balance
- e-document, withholding, refund, recurrence, and archival fields
- redacted customer, tax, billing, shipment, note, and description fields

The sample contained invoice records with paid status.

### Purchase Invoices

The requested path returned HTTP 404. No fields were observed.

### Payments

The requested path returned HTTP 404. No fields were observed.

### Accounts

Observed fields include:

- `account_type`, currency, balance, overdraft limit
- archived and extract-display states
- bank integration state/type
- usage and timestamps
- redacted account, bank, branch, IBAN, and associate fields

Sample account types included cash and bank accounts in TRL.

## 4. Relationship Fields Observed

| Resource | Relationship names |
| --- | --- |
| Me | `profile`, `user_roles` |
| Contacts | `category`, `price_list`, `contact_portal`, `last_sales_invoice`, `contact_people`, `activities`, `e_invoice_inboxes`, `sharings`, `tags`, `comments`, `operated_by` |
| Products | `category`, `inventory_levels`, `warehouses`, `stock_updates`, `tags`, `comments`, `operated_by` |
| Sales invoices | `contact`, `details`, `payments`, `category`, `tags`, `activities`, `refund_of`, `refunds`, `sharings`, `active_e_document`, `recurrence_of`, `shipment_documents`, `sales_offer`, `price_list`, `operated_by`, `e_document_note_accounts`, `custom_requirement_infos`, `failed_e_invoice` |
| Accounts | `company` |

The sampled list responses returned relationship objects with empty `meta` only. They did not include relationship `data`, links, or top-level `included` resources.

## 5. How Contacts Map to ERP Partners

Paraşüt contacts should map to the single CRM partner master record required by the Engineering Constitution:

- Paraşüt `contact_type=company` maps to an organization partner.
- `account_type=customer` sets ERP `is_customer=true`.
- `account_type=supplier` sets ERP `is_supplier=true`.
- One ERP partner must retain both roles if Paraşüt or combined source evidence indicates both.
- Paraşüt contact ID is the stable source identifier; names, tax numbers, email, or phone must not be the primary key.
- Tax number may support reviewed matching, but must remain protected personal/business data.

## 6. How Sales Invoices Identify Customers

Sales invoices expose a `contact` relationship and duplicate selected contact classification/tax/billing fields in invoice attributes. The list response did not expose the related contact ID.

Recommended resolution order:

1. Use the invoice `contact` relationship ID when available through a documented include or detail response.
2. Resolve that ID through the Paraşüt contact external-ID mapping.
3. Treat copied invoice identity fields as historical snapshot data, not partner identity.

The exact include/detail request required to expose the relationship ID remains unverified.

## 7. How Purchase Invoices Identify Suppliers

No conclusion can be drawn from the requested endpoint because `/purchase_invoices` returned HTTP 404.

The expected integration model is a supplier contact relationship resolved through the same partner external-ID mapping, but the correct Paraşüt resource name and payload structure must be confirmed from official API documentation or an approved read-only follow-up.

## 8. Required ERP External ID Fields

Use a source-scoped external identity rather than adding ambiguous global IDs:

- `integration_source`: `parasut`
- `external_company_id`: `666034`
- `external_resource_type`: contacts, products, sales invoices, purchase document, payment, or account
- `external_resource_id`: Paraşüt JSON:API `data.id`
- `external_updated_at`: source timestamp where available
- `last_synced_at`
- `sync_status`
- `source_payload_hash` or equivalent change fingerprint

For partners specifically, enforce uniqueness across:

```text
integration_source + external_company_id + external_resource_type + external_resource_id
```

Do not use tax number, email, phone, or name as the durable external identifier.

## 9. Recommended CRM Sync Model

1. Import contacts into the CRM partner master.
2. Upsert by the source-scoped Paraşüt contact ID.
3. Merge customer and supplier capabilities into role flags on one partner.
4. Keep contact people as child contacts, not duplicate companies.
5. Preserve Paraşüt values as source snapshots and maintain ERP ownership of ERP-specific fields.
6. Use incremental reads based on `updated_at` plus stable pagination.
7. Store synchronization audit records and deterministic conflict outcomes.
8. Keep the first implementation read-only from Paraşüt until ownership and conflict rules are approved.

## 10. Risks and Unknowns

- The correct purchase-invoice endpoint is unknown.
- The requested payments endpoint does not exist at the tested path.
- List responses did not expose relationship IDs, so invoice-to-contact linkage is not yet proven.
- Pagination ordering and incremental-filter semantics were not tested.
- Rate limits, token refresh behavior, and permission scopes were not tested.
- Deleted/archived record handling needs a defined policy.
- Product, account, and currency mapping rules are not approved.
- Existing `tools/parasut/parasut-contacts-preview.json` predates this run and was not modified or used as a sanitized discovery artifact.
- No ERP schema or synchronization code should be designed until the missing endpoint and relationship semantics are confirmed.

## Safety Statement

This discovery performed OAuth authentication and GET requests only. It created no Paraşüt records, performed no update or delete, and made no ERP database, migration, schema, RLS, RPC, commit, or push change.
