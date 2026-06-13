# Paraşüt Relationship and Endpoint Discovery

Discovery date: June 13, 2026  
Mode: Read-only GET requests  
Source IDs: Selected from previously sanitized contact and Sales invoice samples

## 1. Contact Detail Structure

`GET /v4/666034/contacts/{id}` returned HTTP 200.

The detail resource remains JSON:API type `contacts`. Its observed attributes match the list resource and cover:

- partner classification: `account_type`, `contact_type`
- lifecycle: `archived`, `untrackable`, timestamps
- balances: TRL, USD, EUR, GBP, opening and current balance
- commercial settings: term days, exchange-rate type, invoicing preferences
- protected identity, tax, communication, address, and bank fields

Relationship names:

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

Without an `include` parameter, these relationship objects contained empty metadata and no linkage IDs.

## 2. Sales Invoice Detail Structure

`GET /v4/666034/sales_invoices/{id}` returned HTTP 200.

The detail resource remains JSON:API type `sales_invoices`. It exposes:

- invoice identity, series, dates, order and shipment references
- currency and exchange rate
- gross, net, tax, withholding, discount, paid, and remaining totals
- payment and document status
- refund, recurrence, e-document, archival, and sharing fields
- protected customer, tax, billing, shipment, note, and description snapshots

Relationship names include:

- `contact`
- `details`
- `payments`
- `category`
- `refund_of`, `refunds`
- `shipment_documents`
- `sales_offer`
- `price_list`
- `activities`, `tags`, `sharings`
- e-document and operator relationships

Without `include`, the `contact`, `details`, and `payments` relationships did not contain linkage data.

## 3. Include Parameters That Work

All requested include patterns returned HTTP 200:

| Include | Relationship linkage | Included resources |
| --- | --- | --- |
| `include=contact` | One `contacts` ID | One contact |
| `include=details` | Sales invoice detail IDs | One sampled detail |
| `include=payments` | Payment IDs | One sampled payment |
| `include=contact,details,payments` | All three linkage sets | One contact, one detail, one payment in the sampled invoice |

Included counts describe the selected sample only and are not cardinality guarantees for other invoices.

## 4. Contact Relationship ID Availability

Yes. With `include=contact`:

- `data.relationships.contact.data` contains a JSON:API resource identifier with type `contacts` and an ID.
- The top-level `included` array contains the corresponding full contact resource.

The combined include behaves the same way.

This establishes a deterministic Sales invoice to Paraşüt contact link without matching on names, tax numbers, email addresses, or invoice snapshot fields.

## 5. Payments Through Include

Yes. With `include=payments`:

- `data.relationships.payments.data` contains payment resource IDs.
- The top-level `included` array contains `payments` resources.

Observed payment attributes include amount, TRL amount, currency, date, due date, matched amount, paid currency, notes, and timestamps. Payment relationships include:

- `payable`
- `transaction`
- `reimbursement_purchase_bill`

The standalone `/payments` collection path previously returned HTTP 404, but invoice-scoped payments are accessible through Sales invoice inclusion.

## 6. Remaining Purchase Invoice Unknowns

Searching existing sanitized local discovery files found only:

- generic `purchase` references
- the already tested `purchase_invoices` resource name

No alternate purchase resource name was discovered locally.

The payment relationship name `reimbursement_purchase_bill` is evidence that Paraşüt uses the term `purchase_bill` in at least one relationship, but this discovery did not call or validate a `purchase_bills` endpoint. It must not yet be treated as a confirmed collection resource.

Still unknown:

- correct purchase document collection and detail paths
- supplier relationship name and include syntax
- purchase detail/product relationships
- purchase payment accessibility
- archive, refund, and reimbursement behavior

## 7. Exact CRM Partner Sync Impact

The Sales-to-CRM ownership boundary is now clear:

1. CRM imports/upserts Paraşüt contacts as the single ERP partner master.
2. The Paraşüt contact ID is stored as the source-scoped external partner ID.
3. Sales invoice synchronization requests `include=contact`.
4. Sales resolves `relationships.contact.data.id` through the CRM partner external-ID mapping.
5. Sales stores a foreign key to the existing ERP partner and must not create a duplicate customer.
6. Included contact data may refresh the CRM source snapshot, but CRM owns merge and conflict rules.
7. Invoice billing/tax/contact attributes remain immutable invoice snapshots and must not replace partner master data.
8. `account_type` contributes customer/supplier role flags, while one ERP partner may retain multiple roles under the Engineering Constitution.

This removes the need for fuzzy customer matching in Sales invoice import.

## 8. Recommended Next Step Before Migration Design

Perform one more approved read-only documentation and endpoint discovery pass focused on Paraşüt purchase bills:

1. Confirm the official collection resource name from Paraşüt API documentation.
2. Fetch one collection page only after the path is documented.
3. Fetch one detail with documented supplier, details, and payments includes.
4. Verify supplier contact ID, line product IDs, and payment IDs.
5. Confirm pagination, updated-time filtering, archived behavior, and rate-limit headers for contacts and invoices.
6. Produce a complete external-identity and ownership matrix.

Only after those facts are confirmed should CRM/Sales/Purchasing database design begin. No migration design or implementation was performed in this task.

## Safety Statement

This run used OAuth authentication and six GET requests only. It performed no Paraşüt create, update, or delete; no ERP source change; no database, migration, schema, RLS, or RPC operation; and no commit or push.
