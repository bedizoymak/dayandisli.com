# Phase 0 — Paraşüt Mirror Architecture

## Objective

Define the read-only Paraşüt mirror layer that will preserve external accounting
resources before any ERP domain mapping is designed.

This phase does not design CRM partners, stakeholders, Sales domain records,
Purchasing domain records, Inventory records, or any other ERP business table.
The mirror layer is an external-source snapshot boundary only.

## Constitutional Boundary

The Engineering Constitution establishes the following rules:

- Paraşüt integration is read-only.
- Synchronization direction is Paraşüt to DAYAN ERP only.
- Paraşüt data must first be stored in mirror tables.
- Mirror tables must preserve Paraşüt structure as closely as possible.
- Mirror tables are not ERP business-domain tables.
- ERP domain modeling and ownership decisions happen after the mirror layer.
- Browser code must never access Paraşüt credentials.

No Paraşüt write operation belongs in this architecture.

## Files Inspected

### Governance

- `docs/ENGINEERING_CONSTITUTION.md`

### Discovery Scripts

- `tools/parasut/parasut-readonly-discovery.mjs`
- `tools/parasut/parasut-relationship-discovery.mjs`
- `tools/parasut/parasut-purchase-bill-discovery.mjs`
- `tools/parasut/parasut-smoke-test.mjs`

### Discovery Reports and Status Files

- `tools/parasut/discovery/README.md`
- `tools/parasut/discovery/discovery-status.json`
- `tools/parasut/discovery/relationship-checks/README.md`
- `tools/parasut/discovery/relationship-checks/relationship-check-status.json`
- `tools/parasut/discovery/purchase-bill-checks/README.md`
- `tools/parasut/discovery/purchase-bill-checks/purchase-bill-check-status.json`

### Sanitized Resource Samples

- `tools/parasut/discovery/me.json`
- `tools/parasut/discovery/contacts.json`
- `tools/parasut/discovery/products.json`
- `tools/parasut/discovery/sales-invoices.json`
- `tools/parasut/discovery/accounts.json`
- `tools/parasut/discovery/payments.json`
- `tools/parasut/discovery/purchase-invoices.json`
- `tools/parasut/discovery/relationship-checks/contact-detail.json`
- `tools/parasut/discovery/relationship-checks/sales-invoice-detail.json`
- `tools/parasut/discovery/relationship-checks/sales-invoice-include-contact.json`
- `tools/parasut/discovery/relationship-checks/sales-invoice-include-details.json`
- `tools/parasut/discovery/relationship-checks/sales-invoice-include-payments.json`
- `tools/parasut/discovery/relationship-checks/sales-invoice-include-all.json`
- `tools/parasut/discovery/purchase-bill-checks/purchase-bills.json`
- `tools/parasut/discovery/purchase-bill-checks/purchase-bills-include-spender.json`
- `tools/parasut/discovery/purchase-bill-checks/purchase-bill-detail.json`
- `tools/parasut/discovery/purchase-bill-checks/purchase-bill-include-spender.json`
- `tools/parasut/discovery/purchase-bill-checks/purchase-bill-include-details.json`
- `tools/parasut/discovery/purchase-bill-checks/purchase-bill-include-payments.json`
- `tools/parasut/discovery/purchase-bill-checks/purchase-bill-include-all.json`

All inspected samples are sanitized. No environment files, tokens, passwords, or
raw personal data were copied into this document.

## Confirmed Paraşüt Resources

| Resource | Collection or detail evidence | Status |
| --- | --- | --- |
| `me` | `GET /v4/me` | Confirmed |
| `contacts` | Collection and one detail | Confirmed |
| `products` | Collection | Confirmed |
| `sales_invoices` | Collection, detail, and includes | Confirmed |
| `sales_invoice_details` | Included by Sales invoice | Confirmed as included resource |
| `purchase_bills` | Collection, detail, and includes | Confirmed |
| `purchase_bill_details` | Included by purchase bill | Confirmed as included resource |
| `payments` | Included by Sales invoices and purchase bills | Confirmed as included resource |
| `accounts` | Collection | Confirmed |

The standalone path `GET /v4/{company_id}/payments` returned HTTP 404. Payments
are therefore confirmed through document includes, not as a confirmed top-level
collection endpoint.

The path `GET /v4/{company_id}/purchase_invoices` returned HTTP 404. The
official and successfully tested purchase resource is `purchase_bills`.

## Confirmed Resource Relationships

### Contacts

Observed relationships include:

- `category`
- `price_list`
- `contact_portal`
- `last_sales_invoice`
- `contact_people`
- `activities`
- `e_invoice_inboxes`
- `sharings`
- `tags`
- `comments`
- `operated_by`

### Products

Observed relationships include:

- `category`
- `inventory_levels`
- `warehouses`
- `stock_updates`
- `tags`
- `comments`
- `operated_by`

### Sales Invoices

Observed relationships include:

- `contact`
- `details`
- `payments`
- `category`
- `tags`
- `activities`
- `refund_of`
- `refunds`
- `sharings`
- `active_e_document`
- `recurrence_of`
- `shipment_documents`
- `sales_offer`
- `price_list`
- `operated_by`
- additional e-document relationships

The documented includes `contact`, `details`, and `payments` returned HTTP 200.
Their relationship identifiers and included resources were present in the
sampled invoice.

### Sales Invoice Details

Observed relationships include:

- `invoice`
- `product`
- `warehouse`
- `custom_requirement_infos`
- `medicine_and_medical_device`

### Purchase Bills

Observed relationships include:

- `spender`
- `supplier`
- `details`
- `payments`
- `reimbursement_payments`
- `pay_to`
- `category`
- `tags`
- `activities`
- `refund_of`
- `refunds`
- `recurrence_of`
- `shipment_documents`
- `active_e_document`
- `operated_by`

The documented includes `spender`, `details`, and `payments` returned HTTP 200.
The sampled `spender` relationship was null, while details and payments were
populated.

### Purchase Bill Details

Observed relationships include:

- `invoice`
- `product`
- `warehouse`

### Payments

Observed relationships include:

- `payable`
- `transaction`
- `reimbursement_purchase_bill`

### Accounts

The observed relationship is:

- `company`

## Mirror Design Principles

1. Store one row per Paraşüt JSON:API resource identifier.
2. Scope every resource by Paraşüt company ID.
3. Preserve the JSON:API resource type without translating it to an ERP domain.
4. Preserve attributes and relationships as JSONB.
5. Preserve included data and the complete resource payload for replay and
   future mapping analysis.
6. Extract only stable synchronization metadata into dedicated columns.
7. Treat source timestamps as source facts, not ERP timestamps.
8. Upsert deterministically by Paraşüt company, resource type, and resource ID.
9. Detect changed payloads with a deterministic hash.
10. Never delete mirror records merely because they disappear from one page.
11. Preserve archived states from Paraşüt.
12. Do not add CRM, Sales, Purchasing, Inventory, or Finance foreign keys during
    mirror implementation.

## Common Mirror Record Shape

Each resource-specific mirror table should generally contain:

```text
id
parasut_id
parasut_company_id
resource_type
attributes
relationships
included
raw_payload
source_created_at
source_updated_at
synced_at
payload_hash
created_at
updated_at
```

Recommended meanings:

| Column | Meaning |
| --- | --- |
| `id` | Internal mirror row identifier |
| `parasut_id` | JSON:API `data.id` |
| `parasut_company_id` | Paraşüt company scope |
| `resource_type` | JSON:API `data.type` |
| `attributes` | Exact JSON:API attributes object |
| `relationships` | Exact JSON:API relationships object |
| `included` | Included resources returned with the source request |
| `raw_payload` | Complete resource-level source snapshot |
| `source_created_at` | Parsed source `created_at`, when present |
| `source_updated_at` | Parsed source `updated_at`, when present |
| `synced_at` | Time the mirror accepted the snapshot |
| `payload_hash` | Deterministic hash of the canonical source snapshot |
| `created_at` | Mirror row creation time |
| `updated_at` | Mirror row update time |

`attributes`, `relationships`, `included`, and `raw_payload` should be JSONB.
The first implementation should avoid projecting numerous resource attributes
into columns before pagination, filtering, nullability, and schema variability
are better understood.

## Proposed Mirror Tables

### Initial Confirmed Tables

```text
parasut_contacts
parasut_products
parasut_sales_invoices
parasut_sales_invoice_details
parasut_purchase_bills
parasut_purchase_bill_details
parasut_payments
parasut_accounts
```

These names correspond to confirmed JSON:API resource types or confirmed
collection resources.

### Optional Synchronization Control Tables

```text
parasut_sync_runs
parasut_sync_cursors
parasut_sync_errors
```

These tables are operational mirror infrastructure, not ERP domain tables.

`parasut_sync_runs` should record resource, company, start/end time, page counts,
record counts, status, and sanitized error summaries.

`parasut_sync_cursors` should record the last approved pagination or incremental
cursor per company and resource. It must not assume an `updated_at` filter until
that filter is officially verified.

`parasut_sync_errors` should contain sanitized technical errors and source
identifiers only. It must never contain credentials or unnecessary personal
payloads.

### Deferred Tables Requiring More Discovery

The following resource names were observed as relationships or documented
includes but have not been sufficiently inspected as independent resources:

```text
parasut_warehouses
parasut_categories
parasut_tags
parasut_inventory_levels
parasut_stock_updates
parasut_contact_people
parasut_transactions
```

They should not be created merely because their names appeared in relationship
metadata. Phase 1 must include only tables supported by confirmed payload
evidence, unless additional read-only discovery is completed first.

## Identity and Uniqueness

The durable mirror identity should be:

```text
parasut_company_id + resource_type + parasut_id
```

A unique constraint should eventually enforce this identity in each table or in
a shared mirror resource registry.

Names, invoice numbers, tax numbers, product codes, account numbers, emails,
phones, and dates are not durable external identifiers.

No uniqueness or deduplication rule from an ERP domain should be applied in the
mirror. If Paraşüt contains two distinct resource IDs with similar attributes,
the mirror must preserve both resources.

## Relationship Preservation

Relationships should first be retained exactly in the `relationships` JSONB
column. Resource-specific extracted relationship ID columns may be introduced
later only when they improve synchronization reliability without changing
source meaning.

Examples of confirmed source relationships:

```text
sales_invoices.contact -> contacts
sales_invoices.details -> sales_invoice_details
sales_invoices.payments -> payments
purchase_bills.details -> purchase_bill_details
purchase_bills.payments -> payments
purchase_bills.spender -> unresolved when null
sales_invoice_details.product -> products
sales_invoice_details.warehouse -> warehouses
purchase_bill_details.product -> products
purchase_bill_details.warehouse -> warehouses
```

Null relationships must remain null. They must not be replaced with inferred
ERP entities.

Included resources should be upserted into their own confirmed mirror table and
also retained in the parent request snapshot for traceability.

## Data Retention and Privacy

Production mirror payloads will contain accounting and personal data. The
implementation phase must establish:

- restricted server-side ingestion
- tenant-aware access
- no anonymous access
- no credentials in payload or error storage
- sanitized application logs
- encrypted transport
- backup and retention expectations
- controlled access to raw payloads

Discovery sample sanitization is not a substitute for database security.

## Synchronization Direction

The only allowed flow is:

```text
Paraşüt API
  -> server-side read-only adapter
  -> Paraşüt mirror tables
  -> later mapping processes
  -> future ERP domain tables
```

The mirror importer may authenticate, refresh tokens, and issue GET requests.
It must not issue POST, PUT, PATCH, or DELETE requests to Paraşüt.

## Unknowns

1. Pagination ordering and stability have not been verified.
2. Official incremental filtering by `updated_at` has not been verified.
3. API rate limits and retry headers have not been documented locally.
4. Token refresh behavior and long-running synchronization behavior remain
   untested.
5. Deleted-resource detection is unknown.
6. Archived-resource synchronization policy is not finalized.
7. A standalone payments collection endpoint has not been confirmed.
8. A populated purchase bill `spender` relationship has not been observed.
9. The semantic difference between purchase bill `spender` and `supplier`
   remains unresolved.
10. Nested `details.product` and `details.warehouse` includes have not been
    validated locally.
11. Independent collection endpoints for warehouses, categories, tags,
    inventory levels, stock updates, contact people, and transactions have not
    been confirmed by the current samples.
12. The `/v4/me` payload is confirmed but does not yet justify a permanent
    business mirror table; it may belong to connection metadata instead.
13. Payload-size limits and JSONB storage growth have not been measured.
14. Full-snapshot retention versus latest-snapshot-only retention is undecided.
15. RLS and service-account access design belong to the implementation phase
    and require inspection of the repository's current integration patterns.

## Phase 0 Decision

The mirror architecture is ready for database design limited to the eight
confirmed resource tables and optional synchronization-control infrastructure.

ERP domain modeling is explicitly deferred. No CRM partner, stakeholder,
customer, supplier, product master, Sales invoice, purchase document, payment,
inventory, or financial domain table should be designed or changed in the next
phase.

## Exact Phase 1 Prompt

```md
Read and strictly follow `/docs/ENGINEERING_CONSTITUTION.md`.

# PHASE 1 — PARASUT MIRROR DATABASE DESIGN

This phase is database design only.

Do NOT implement application code.
Do NOT modify ERP domain tables.
Do NOT design CRM partners or stakeholders.
Do NOT map mirror records into CRM, Sales, Purchasing, Inventory, or Finance.
Do NOT apply migrations.
Do NOT change production.
Do NOT commit.
Do NOT push.

Use:

- `docs/PHASE_0_PARASUT_MIRROR_ARCHITECTURE.md`
- the sanitized files under `tools/parasut/discovery/`
- the existing repository migration and RLS conventions

## Objective

Produce the exact PostgreSQL design for the Paraşüt read-only mirror layer while
preserving Paraşüt JSON:API resources as closely as possible.

## Required Design Scope

Design these confirmed mirror tables:

- `parasut_contacts`
- `parasut_products`
- `parasut_sales_invoices`
- `parasut_sales_invoice_details`
- `parasut_purchase_bills`
- `parasut_purchase_bill_details`
- `parasut_payments`
- `parasut_accounts`

Assess, but do not automatically require:

- `parasut_sync_runs`
- `parasut_sync_cursors`
- `parasut_sync_errors`

For each table define:

1. Columns and PostgreSQL types
2. Primary key
3. Paraşüt external identity constraint
4. JSONB payload columns
5. Source timestamp handling
6. Payload hash behavior
7. Relationship preservation strategy
8. Included-resource upsert strategy
9. Archive and deletion handling
10. Indexes
11. RLS policy design
12. Service-side ingestion permissions
13. Retention and privacy considerations

The durable source identity must be based on:

`parasut_company_id + resource_type + parasut_id`

Do not use names, tax numbers, invoice numbers, product codes, email addresses,
phone numbers, or account numbers as external identity.

Null relationships must remain null.
Do not infer ERP entities.
Do not deduplicate separate Paraşüt IDs.
Do not create tables for unconfirmed resources without documenting the missing
evidence.

## Required Output

Create:

`docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`

Include:

- Objective
- Starting Findings
- Files Inspected
- Confirmed Resource Matrix
- Table Designs
- Identity and Uniqueness
- Relationship Strategy
- Included Resource Strategy
- Synchronization Metadata
- Index Strategy
- RLS Design
- Privacy and Retention
- Migration Ordering
- Test Plan
- Unknowns
- Exact Phase 2 Prompt

Documentation must be English.
No implementation or database operation is allowed in this phase.
```
