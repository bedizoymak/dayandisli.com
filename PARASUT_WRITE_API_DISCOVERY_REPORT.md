# Paraşüt Write API Discovery Report — Contact Creation

Source: Paraşüt's own official OpenAPI 2.0 (Swagger) specification, fetched read-only from `https://raw.githubusercontent.com/parasutcom/api-doc/master/spec/swagger.yaml` (the source repo behind `https://apidocs.parasut.com/`). No request was sent to `api.parasut.com` during this discovery pass — every fact below is quoted or paraphrased directly from the spec document itself, not inferred from the GET response shapes already mirrored in `parasut.contacts`.

## Endpoint

- **Method**: `POST`
- **Path**: `/{company_id}/contacts` (full URL: `https://api.parasut.com/v4/{company_id}/contacts`, i.e. `https://api.parasut.com/v4/666034/contacts` for this production company)
- **operationId**: `createContact`
- Query parameter `include` (optional): which relationships to return inline — *"Available: category, contact_portal, contact_people"*.

## Authentication

- `Authorization: Bearer {access_token}` header, exactly as already implemented in `server/parasut/auth.ts`/`client.ts` for GET requests — no separate write-scope token type is documented.

## Content-Type

Spec (translated from Turkish): *"When sending requests you must send `application/json` or `application/vnd.api+json` as the `Content-Type` header."* Either is accepted.

## Rate Limit

Documented explicitly: **10 requests per 10 seconds**, company-wide (not distinguished by GET vs POST). The existing `ParaşütClient`'s retry/backoff logic (`RETRYABLE_STATUS` including 429) already handles this class of response; nothing write-specific needs to change there.

## Request Body Shape (JSON:API)

```json
{
  "data": {
    "type": "contacts",
    "attributes": {
      "name": "string, REQUIRED",
      "account_type": "customer | supplier, REQUIRED",
      "email": "string (email format), optional",
      "short_name": "string, optional",
      "contact_type": "person | company, optional",
      "tax_office": "string, optional",
      "tax_number": "string, optional",
      "district": "string, optional",
      "postal_code": "string, optional",
      "city": "string, optional",
      "country": "string, optional",
      "address": "string, optional",
      "phone": "string, optional",
      "fax": "string, optional",
      "is_abroad": "boolean, optional",
      "archived": "boolean, optional",
      "iban": "string, optional",
      "untrackable": "boolean, optional",
      "invoicing_preferences": { "e_document_accounts": "integer[], optional" }
    },
    "relationships": {
      "category": { "data": { "id": "string", "type": "item_categories" } },
      "contact_people": { "data": [{ "id": "string", "type": "contact_people", "attributes": "ContactPersonAttributes" }] }
    }
  }
}
```

**Explicitly documented rule for new records** (spec, translated): *"When creating a new record, the `ID` parameter of the relevant record should be sent empty or not sent at all."* — i.e. `data.id` must be omitted for a create request. This is a hard requirement, not a convention.

### Required attributes (per the spec's own `required` list on `ContactAttributes`)

- `name` (string)
- `account_type` (string, enum: `customer` | `supplier` — exactly the two values already confirmed present in the real synced mirror data, see `PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md` §25)

### Optional attributes

Every other `ContactAttributes` field listed above. Fields marked `readOnly: true` in the spec (`balance`, `trl_balance`, `usd_balance`, `eur_balance`, `gbp_balance`, `created_at`, `updated_at`) must never be sent in a create request — they are server-computed.

### Relationships

Both `category` and `contact_people` are optional on create. No relationship is required to create a minimal contact — confirms a customer can be created with only `name` + `account_type`.

## Response

- **Success status**: `201 Created`
- **Body**: `{ "data": Contact, "included": [...] }` where `Contact = { id: string, type: "contacts", attributes: ContactAttributes, relationships: {...} }` — the same `Contact` schema the GET endpoints already return, confirming the create response shape matches the mirror's existing row-mapping code path with no new parsing logic needed.
- **`id` field**: `data.id`, a string (matches the existing `parasut_id: text` column convention already used throughout `parasut.*`).

## Error Response Format

Documented response codes: `400`, `401`, `403`, `404`, `422` (validation), each with body shape:

```json
{ "errors": [{ "title": "string", "detail": "string" }] }
```

No `code` field, no per-attribute field-path breakdown documented beyond `title`/`detail` free text. This is a materially different (flatter) shape than the mirror's own `parasut.sync_errors.error_code`/`sanitized_message` columns — a write-path error handler must not assume a `code` field exists.

## Duplicate Behavior

**Not documented in the spec.** No explicit uniqueness constraint (e.g. on `tax_number` or `email`) is described for the create-contact endpoint. This must be treated as unconfirmed — the write path must not assume Paraşüt will reject or dedupe a contact with a tax number/email matching an existing contact. (Operationally: the outbound command handler's own audit trail, not a Paraşüt-side guarantee, is the only defense against accidental duplicate submission from the ERP side — see idempotency requirements in `ACCOUNTING_PROVIDER_ARCHITECTURE.md`'s write-contract design.)

## Archive Behavior

`archived: boolean` is a regular (non-required) `ContactAttributes` field, settable on create like any other optional attribute. No separate archive/unarchive endpoint is referenced in this section of the spec. Not exercised or further confirmed this pass (this phase implements creation only, per instruction — archive/delete are explicitly out of scope).

## What Remains Unconfirmed

- Real-world validation error wording/detail content (only the schema shape is documented, not actual Paraşüt validation messages — those would only be observed from a real request, which was not sent).
- Duplicate-detection behavior (undocumented, as noted above).
- Whether `tax_number` format is validated server-side (Turkish TC kimlik no / vergi no checksum) — not stated in the spec.

## Explicitly Not Done This Pass

- No POST request was sent to `api.parasut.com` at any point during this discovery.
- No production write occurred.
- No credential value is referenced in this document.
