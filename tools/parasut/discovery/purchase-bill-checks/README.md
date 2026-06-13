# Paraşüt Purchase Bill Official Endpoint Discovery

Discovery date: June 13, 2026  
Mode: Official-documentation review and read-only GET requests

Official sources:

- `https://apidocs.parasut.com/index`
- `https://apidocs.parasut.com/swagger.json`

## 1. Official Endpoint

Confirmed:

```text
GET /v4/{company_id}/purchase_bills
GET /v4/{company_id}/purchase_bills/{id}
```

The official Swagger definition names the resource `purchase_bills`.

For both collection and detail GET operations, the documented include values are:

```text
category
spender
details
details.product
details.warehouse
payments
payments.transaction
tags
recurrence_plan
active_e_document
pay_to
```

The supplier-oriented documented relationship is `spender`, not `contact`.

## 2. Collection Response

Request:

```text
GET /v4/666034/purchase_bills?page[number]=1&page[size]=5
```

Result: HTTP 200 with five `purchase_bills` records.

Observed bill fields cover:

- invoice number, issue date, due date, item type, detailed/basic status
- currency and exchange rate
- gross, net, tax, discount, paid, and remaining totals
- payment status, archived status, recurrence, shipment, and e-invoice count
- protected descriptions, notes, and attachment/sharing fields

A second official request with `include=spender` also returned HTTP 200.

## 3. Detail Response

Request:

```text
GET /v4/666034/purchase_bills/{id}
```

Result: HTTP 200.

The detail resource exposes relationships including:

- `spender`
- `supplier`
- `details`
- `payments`
- `reimbursement_payments`
- `pay_to`
- category, tags, activities, refunds, recurrence, shipment, and e-document relationships

Without includes, relationship linkage data was not populated.

## 4. Working Include Parameters

All tested documented include patterns returned HTTP 200:

| Include | Result |
| --- | --- |
| `include=spender` | Valid; sampled relationship was null |
| `include=details` | Valid; returned purchase bill detail linkage and included detail |
| `include=payments` | Valid; returned payment linkage and included payment |
| `include=spender,details,payments` | Valid; returned available detail and payment resources |

The collection request with `include=spender` also returned HTTP 200.

## 5. Supplier/Contact Relationship ID

The official supplier-oriented include is `spender`.

However, all five sampled collection records returned:

```text
relationships.spender.data = null
```

The selected detail record also returned a null `spender`, and no included supplier/contact resource.

Therefore:

- relationship name and include syntax: confirmed
- supplier/contact external ID availability in a populated record: not confirmed
- whether `supplier` is a legacy, derived, or separately includable relationship: not established by the official include list or sample

## 6. Line Details

Available.

`include=details` returned:

- relationship type `purchase_bill_details`
- stable detail IDs
- an included detail resource

Observed detail fields include quantity, unit price, net total, discounts, VAT, withholding, excise/communications/accommodation tax fields, and timestamps. Protected descriptions were masked.

Detail relationships include:

- `invoice`
- `product`
- `warehouse`

Nested product and warehouse includes are officially documented but were not required or tested in this task.

## 7. Payments

Available.

`include=payments` returned:

- payment relationship IDs
- included `payments` resources

Observed payment fields include amount, TRL amount, currency, date, due date, matched amount, paid currency, and timestamps. Protected notes were masked.

Payment relationships include:

- `payable`
- `transaction`
- `reimbursement_purchase_bill`

## 8. CRM Partner Model Impact

CRM remains the sole owner of partner master data.

The intended purchase synchronization boundary is:

1. Resolve Paraşüt purchase bill `spender` to a Paraşüt contact ID.
2. Resolve that external contact ID to the existing ERP partner.
3. Set or retain `is_supplier=true` on the single partner record.
4. Purchasing references the CRM partner and must not create a duplicate supplier.
5. Purchase bill snapshot fields must not overwrite CRM partner identity without approved conflict rules.

This model is architecturally correct, but the sampled records cannot yet prove the populated `spender` resource type or ID.

## 9. CRM Migration Design Decision

CRM partner external-identity design can proceed at a conceptual level because contacts and Sales invoice linkage are already proven.

Final migration design for purchase bill synchronization should not start yet because no sampled purchase bill contains a supplier/spender ID. The remaining read-only evidence needed is one purchase bill with a populated `spender` relationship.

Recommended next step:

1. Identify a known supplier-linked purchase bill in Paraşüt without exposing its data.
2. Fetch that bill with the documented `include=spender`.
3. Confirm the included resource type is compatible with Paraşüt contacts and capture only its structural ID/type evidence.
4. Optionally verify documented nested `details.product` and `details.warehouse` relationships before Purchasing/Inventory mapping design.

## Safety Statement

This discovery used the public official API specification, OAuth authentication, and GET requests only. It performed no Paraşüt create, update, delete, payment, archive, cancellation, or recovery operation. It made no ERP source, database, migration, schema, RLS, RPC, commit, or push change.
