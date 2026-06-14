# Phase 1 — Paraşüt Mirror Database Design

## Objective

Define the PostgreSQL architecture for a read-only Paraşüt mirror layer that
preserves confirmed JSON:API resources without introducing ERP domain meaning.

This document is a design specification only. It does not create migrations,
tables, policies, application code, domain mappings, or Paraşüt writes.

## Starting Findings

Phase 0 established these boundaries:

- Paraşüt is the official accounting source.
- Synchronization is one-way: Paraşüt to DAYAN ERP.
- External data must enter mirror tables before any domain mapping.
- Mirror rows preserve source resources, including apparent duplicates.
- The durable identity is `parasut_company_id + resource_type + parasut_id`.
- JSON:API attributes, relationships, included resources, and raw payloads must
  remain available for later mapping and audit.
- CRM, Sales, Purchasing, Inventory, and Finance ownership is out of scope.

Eight resource types have enough evidence for mirror table design. Other
relationship names remain deferred until their payloads are confirmed.

## Files Inspected

### Governance and Architecture

- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/PHASE_0_PARASUT_MIRROR_ARCHITECTURE.md`

### Paraşüt Discovery

- `tools/parasut/parasut-readonly-discovery.mjs`
- `tools/parasut/parasut-relationship-discovery.mjs`
- `tools/parasut/parasut-purchase-bill-discovery.mjs`
- `tools/parasut/discovery/README.md`
- `tools/parasut/discovery/discovery-status.json`
- all sanitized JSON files under `tools/parasut/discovery/`
- all sanitized files under `tools/parasut/discovery/relationship-checks/`
- all sanitized files under `tools/parasut/discovery/purchase-bill-checks/`

### Repository Database Conventions

- `supabase/migrations/20260517153000_erp_core_schema.sql`
- `supabase/migrations/20260603120000_phase24_multi_company_branch_enterprise_foundation.sql`
- `supabase/migrations/20260603123000_phase25_tenant_isolation_rls_data_safety.sql`
- `supabase/migrations/20260603130000_phase26_supabase_production_security_governance.sql`
- `supabase/migrations/20260603143000_phase29_persisted_observability_alert_workflow.sql`
- `supabase/migrations/20260613052204_production_rpc_rls_prerequisites.sql`

The repository convention is `uuid` primary keys using `gen_random_uuid()`,
`timestamptz` audit columns, JSONB for flexible data, the
`public.erp_set_updated_at()` trigger, enabled RLS, and company membership
checks through `public.company_memberships`.

## Confirmed Resource Matrix

| Mirror table | JSON:API type | Evidence | Collection strategy |
| --- | --- | --- | --- |
| `parasut_contacts` | `contacts` | Collection and detail | Direct collection |
| `parasut_products` | `products` | Collection | Direct collection |
| `parasut_sales_invoices` | `sales_invoices` | Collection, detail, includes | Direct collection |
| `parasut_sales_invoice_details` | `sales_invoice_details` | Included resource | Parent invoice includes |
| `parasut_purchase_bills` | `purchase_bills` | Collection, detail, includes | Direct collection |
| `parasut_purchase_bill_details` | `purchase_bill_details` | Included resource | Parent bill includes |
| `parasut_payments` | `payments` | Included resource | Parent document includes |
| `parasut_accounts` | `accounts` | Collection | Direct collection |

`purchase_invoices` is not a valid confirmed resource. The tested endpoint
returned HTTP 404. `purchase_bills` is the confirmed resource.

The standalone `payments` collection endpoint is not confirmed. Payments must
initially be mirrored from included resources.

## Common Resource Table Shape

All eight resource tables should use the same base columns:

| Column | PostgreSQL type | Nullability/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `default gen_random_uuid()` | Internal mirror identifier |
| `company_id` | `uuid` | not null, FK to `companies(id)` | DAYAN tenant ownership |
| `parasut_id` | `text` | not null | JSON:API resource ID |
| `parasut_company_id` | `text` | not null | Paraşüt company scope |
| `resource_type` | `text` | not null | Exact JSON:API resource type |
| `attributes` | `jsonb` | not null, default `{}` | Exact source attributes object |
| `relationships` | `jsonb` | not null, default `{}` | Exact source relationships object |
| `included` | `jsonb` | not null, default `[]` | Included resources attached to the request |
| `raw_payload` | `jsonb` | not null | Complete resource-level JSON:API snapshot |
| `source_created_at` | `timestamptz` | null | Parsed source creation timestamp |
| `source_updated_at` | `timestamptz` | null | Parsed source update timestamp |
| `source_archived` | `boolean` | null | Source archive state when explicitly present |
| `first_seen_at` | `timestamptz` | not null, default `now()` | First successful observation |
| `last_seen_at` | `timestamptz` | not null, default `now()` | Most recent successful observation |
| `synced_at` | `timestamptz` | not null, default `now()` | Time current snapshot was accepted |
| `payload_hash` | `text` | not null | Hash of canonical source resource |
| `created_at` | `timestamptz` | not null, default `now()` | Database row creation |
| `updated_at` | `timestamptz` | not null, default `now()` | Database row update |

### Refinements to the Recommended Shape

`company_id` is required in addition to `parasut_company_id`. The former
enforces DAYAN tenant access; the latter preserves external source identity.
They have different responsibilities and must not be conflated.

`source_archived`, `first_seen_at`, and `last_seen_at` are recommended stable
operational projections. They do not add ERP meaning.

No `branch_id` is recommended. Paraşüt company resources are mirrored at the
company integration boundary, and no verified source branch mapping exists.

The initial migration should add a check constraint fixing each table's
`resource_type` to its confirmed JSON:API type. This prevents accidental
cross-resource insertion while retaining the type in every row.

## Table Designs

### `parasut_contacts`

**Purpose:** Preserve Paraşüt `contacts` resources exactly. It does not define
CRM partners, customers, or suppliers.

Use the common resource shape with:

```text
resource_type = 'contacts'
```

External identity:

```text
unique (parasut_company_id, resource_type, parasut_id)
```

Observed attributes include account/contact classification, balances, terms,
tax and communication data, addresses, bank data, archive state, and source
timestamps. All remain in `attributes`.

Observed relationships such as `category`, `contact_people`, `tags`, and
`last_sales_invoice` remain in `relationships`. No CRM foreign key is allowed.

Recommended indexes:

- unique B-tree on external identity
- B-tree on `(company_id, source_updated_at)`
- B-tree on `(company_id, last_seen_at)`
- partial B-tree on `(company_id, source_archived)` where archived is true

Privacy classification: high. Contact payloads can contain names, tax numbers,
addresses, email, phone, IBAN, and balance information.

### `parasut_products`

**Purpose:** Preserve Paraşüt `products` resources without defining an ERP
inventory item or commerce product.

Use the common resource shape with:

```text
resource_type = 'products'
```

External identity uses the common three-part unique constraint.

Product codes, barcodes, names, prices, tax rates, and stock figures stay in
`attributes`; none are mirror identity fields.

Relationships to `warehouses`, `inventory_levels`, `stock_updates`, categories,
and tags remain JSONB because those related tables are not confirmed for this
phase.

Recommended indexes:

- unique B-tree on external identity
- B-tree on `(company_id, source_updated_at)`
- B-tree on `(company_id, last_seen_at)`
- partial B-tree on archived rows

Privacy classification: medium. Commercial pricing and stock information are
confidential even when personal data is absent.

### `parasut_sales_invoices`

**Purpose:** Preserve Paraşüt `sales_invoices` header resources and their
source relationships.

Use the common resource shape with:

```text
resource_type = 'sales_invoices'
```

Invoice numbers and dates are attributes, not durable identities.

The `contact`, `details`, and `payments` relationship objects must remain
unchanged in `relationships`. Parent request `included` must preserve the
included snapshot returned by Paraşüt.

Recommended indexes:

- unique B-tree on external identity
- B-tree on `(company_id, source_updated_at)`
- B-tree on `(company_id, last_seen_at)`
- partial B-tree on archived rows
- optional expression index on `(attributes ->> 'issue_date')` only after a
  measured mirror-query need is demonstrated

Privacy classification: high. Invoice snapshots may contain tax, billing,
shipment, communication, notes, and financial data.

### `parasut_sales_invoice_details`

**Purpose:** Preserve included `sales_invoice_details` resources.

Use the common resource shape with:

```text
resource_type = 'sales_invoice_details'
```

The source `invoice`, `product`, and `warehouse` relationship identifiers stay
inside `relationships`. No foreign keys to ERP invoice, product, or warehouse
tables are permitted.

The table may receive the same detail from multiple parent synchronization
requests. Upsert by external identity and compare `payload_hash`.

Recommended indexes:

- unique B-tree on external identity
- B-tree on `(company_id, source_updated_at)`
- B-tree on `(company_id, last_seen_at)`
- optional expression index for the source invoice relationship ID only after
  its exact JSON shape is validated across multiple samples

Privacy classification: medium to high because descriptions and financial line
values can be sensitive.

### `parasut_purchase_bills`

**Purpose:** Preserve Paraşüt `purchase_bills` header resources.

Use the common resource shape with:

```text
resource_type = 'purchase_bills'
```

The `spender`, `supplier`, `details`, `payments`, and other relationship
objects remain unchanged. A null `spender` remains JSON null and must not be
inferred from invoice text, tax information, or another relationship.

Recommended indexes:

- unique B-tree on external identity
- B-tree on `(company_id, source_updated_at)`
- B-tree on `(company_id, last_seen_at)`
- partial B-tree on archived rows
- optional issue-date expression index only after measured need

Privacy classification: high because supplier, invoice, notes, attachment, and
financial information may be present.

### `parasut_purchase_bill_details`

**Purpose:** Preserve included `purchase_bill_details` resources.

Use the common resource shape with:

```text
resource_type = 'purchase_bill_details'
```

The source relationships to `invoice`, `product`, and `warehouse` remain JSONB.
No Purchasing or Inventory foreign keys are allowed.

Recommended indexes:

- unique B-tree on external identity
- B-tree on `(company_id, source_updated_at)`
- B-tree on `(company_id, last_seen_at)`

Privacy classification: medium to high.

### `parasut_payments`

**Purpose:** Preserve `payments` resources included by Sales invoices and
purchase bills.

Use the common resource shape with:

```text
resource_type = 'payments'
```

The source relationships `payable`, `transaction`, and
`reimbursement_purchase_bill` remain in `relationships`. The mirror must accept
the same payment from multiple parent documents without duplication.

The absence of a confirmed standalone collection means completeness cannot be
assumed. A row means "observed through a confirmed include," not "all Paraşüt
payments are mirrored."

Recommended indexes:

- unique B-tree on external identity
- B-tree on `(company_id, source_updated_at)`
- B-tree on `(company_id, last_seen_at)`

Privacy classification: high because amounts, dates, notes, and financial
relationships are present.

### `parasut_accounts`

**Purpose:** Preserve Paraşüt `accounts` resources without creating ERP Finance
accounts.

Use the common resource shape with:

```text
resource_type = 'accounts'
```

Account type, currency, balance, bank data, IBAN, archive state, and source
timestamps remain in `attributes`. The source `company` relationship remains
in `relationships`.

Recommended indexes:

- unique B-tree on external identity
- B-tree on `(company_id, source_updated_at)`
- B-tree on `(company_id, last_seen_at)`
- partial B-tree on archived rows

Privacy classification: critical. Access must be limited because bank account,
IBAN, balance, and integration-state data may be stored.

## Identity and Uniqueness Strategy

Every resource table must enforce:

```text
unique (parasut_company_id, resource_type, parasut_id)
```

`company_id` is intentionally excluded from the source identity because the
same external Paraşüt company must not be linked to multiple DAYAN tenants
silently. The future implementation should additionally enforce a connection
ownership rule through a dedicated connection configuration or a validated
mapping. Until such a table is designed, ingestion must verify the mapping
before every upsert.

Names, tax numbers, invoice numbers, product codes, emails, phones, account
numbers, and dates must never participate in source identity.

Separate Paraşüt IDs must remain separate rows, even when their attributes look
duplicated.

## Relationship Strategy

Phase 2 should preserve the complete JSON:API relationship object:

```json
{
  "data": {
    "type": "contacts",
    "id": "external-id"
  },
  "links": {},
  "meta": {}
}
```

No inferred relationship may be written. Missing data remains missing; null
remains null; an empty relationship object remains empty.

Initially, relationship identifiers should not be projected into dedicated
columns. Projection should occur only after:

1. the relationship has been observed across representative records,
2. its cardinality is known,
3. its query value is demonstrated, and
4. projection does not replace the original JSONB object.

Mirror tables must not reference ERP domain tables. Foreign keys between mirror
tables are also deferred initially because included-resource completeness and
load ordering are not guaranteed. Source linkage is preserved even when the
related mirror row has not yet been observed.

## Included-Resource Strategy

For each successful API response:

1. Store the parent resource snapshot in its resource table.
2. Preserve the request's relevant `included` array in the parent's `included`
   column for request-level traceability.
3. Route each included resource by its exact JSON:API `type`.
4. Upsert only included types with confirmed mirror tables.
5. Retain unconfirmed included types in the parent snapshot without creating a
   speculative table.
6. Calculate each included resource's own canonical payload hash.
7. Update `last_seen_at` even when the payload hash is unchanged.
8. Update payload columns and `synced_at` only when the canonical source
   snapshot changes.

An included resource must not be rewritten to contain parent context that was
not present in its own source resource.

## Synchronization Metadata

### `parasut_sync_runs`

Recommended for Phase 2 because safe imports need auditable run boundaries.

Proposed columns:

```text
id uuid primary key
company_id uuid not null
parasut_company_id text not null
resource_type text not null
trigger_type text not null
status text not null
started_at timestamptz not null
completed_at timestamptz null
page_count integer not null default 0
records_observed integer not null default 0
records_inserted integer not null default 0
records_updated integer not null default 0
records_unchanged integer not null default 0
error_count integer not null default 0
request_metadata jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

No tokens, credentials, raw authorization headers, or unrestricted response
payloads may be stored.

### `parasut_sync_cursors`

Deferred until official incremental-filter or stable pagination behavior is
verified. Designing a cursor around an unverified ordering would create false
completeness guarantees.

### `parasut_sync_errors`

Recommended for Phase 2 with sanitized diagnostics:

```text
id uuid primary key
sync_run_id uuid not null
company_id uuid not null
parasut_company_id text not null
resource_type text not null
parasut_id text null
http_status integer null
error_code text null
sanitized_message text not null
retryable boolean not null default false
occurred_at timestamptz not null default now()
created_at timestamptz not null default now()
```

Errors must not store tokens, passwords, raw headers, complete personal
payloads, or unsanitized response bodies.

## Payload Hash Behavior

Use a deterministic SHA-256 hex digest calculated server-side over a canonical
JSON representation of:

```text
type + id + attributes + relationships
```

Exclude transport-only fields, local timestamps, `included`, pagination
metadata, and object-key ordering. `included` is excluded because the same
resource may be fetched with different include sets without changing the
resource itself.

Hash behavior:

- First observation inserts the snapshot and hash.
- Matching hash updates only `last_seen_at`.
- Changed hash updates source payload columns, source timestamps, `synced_at`,
  `last_seen_at`, and `payload_hash`.
- A source timestamp moving backward does not automatically reject the payload;
  it creates a synchronization warning for investigation.

## Archive and Deletion Handling

When an explicit source `archived` attribute exists, copy it to
`source_archived` and preserve the original value in `attributes`.

Absence from a page is not deletion evidence. The importer must not delete or
archive rows merely because they were not returned by one run.

Until Paraşüt deletion semantics are confirmed:

- no physical deletion,
- no inferred deletion,
- no inferred archive,
- preserve the latest verified snapshot,
- use `last_seen_at` to identify stale candidates,
- require explicit source evidence before changing lifecycle state.

## Index Strategy

Every confirmed resource table should receive:

```text
unique (parasut_company_id, resource_type, parasut_id)
index (company_id, source_updated_at desc)
index (company_id, last_seen_at desc)
```

Tables with observed archive state should receive:

```text
partial index (company_id, source_archived)
where source_archived = true
```

Do not add broad GIN indexes to all JSONB columns initially. They increase write
and storage cost. Add targeted expression or GIN indexes only after real mirror
queries are measured.

Synchronization tables should index:

- runs by `(company_id, resource_type, started_at desc)`
- errors by `(sync_run_id, occurred_at)`
- errors by `(company_id, resource_type, occurred_at desc)`

## RLS Design

RLS must be enabled on every mirror and synchronization table.

### Authenticated Reads

Authenticated tenant members may read mirror rows only when an active
`company_memberships` record matches the row's `company_id`.

The mirror is company-scoped, not branch-scoped. Branch-limited members should
not automatically receive raw accounting mirror access. The safer initial
policy is:

- active company-wide members (`branch_id is null`) may read when separately
  authorized for integration/accounting administration;
- active admins may read;
- ordinary branch users receive no raw mirror-table access.

Because the current schema does not expose a confirmed integration permission
claim suitable for SQL policy evaluation, Phase 2 should default to admin-only
authenticated reads rather than invent a permission model.

### Writes

Do not create authenticated INSERT, UPDATE, or DELETE policies.

Browser clients must not write mirror records. No anonymous policies are
allowed. Direct deletion remains prohibited.

### Service Access

Server-side ingestion may use a protected Supabase service-role credential,
which bypasses RLS. This is acceptable only inside a trusted server process,
Edge Function, or controlled job. The credential must never be exposed to Vite
or browser code.

## Service-Role Ingestion Model

The ingestion boundary should:

1. Load Paraşüt and Supabase credentials only on the server.
2. Verify the configured DAYAN `company_id` and Paraşüt company ID mapping.
3. Authenticate to Paraşüt and use GET requests only.
4. Start a `parasut_sync_runs` record.
5. Fetch a bounded resource page with explicit include parameters.
6. Validate JSON:API type and ID.
7. Canonicalize and hash each resource.
8. Upsert by external identity.
9. Route confirmed included resources to their own mirror tables.
10. Record sanitized failures.
11. Complete the run with counts and status.

The service role must not be used by frontend code, and the ingestion adapter
must not contain any Paraşüt write method.

## Privacy and Retention Model

Mirror data can contain personal, tax, banking, commercial, and accounting
information. Required controls:

- no anonymous access,
- least-privilege authenticated reads,
- server-only ingestion,
- no credentials in tables or logs,
- sanitized error messages,
- encrypted transport,
- backup access controls,
- auditable synchronization runs,
- documented retention and deletion governance.

Recommended initial retention:

- retain the latest resource snapshot indefinitely while integration is active;
- retain synchronization-run summaries for at least 12 months;
- retain sanitized errors for 90 days unless compliance requires longer;
- do not retain every historical raw payload version in Phase 2.

Historical snapshot versioning may be designed later if accounting audit
requirements justify its storage and privacy cost.

## Future Migration Ordering

Phase 2 should use one additive migration in this order:

1. Validate prerequisites: `companies`, `company_memberships`,
   `erp_set_updated_at()`, and UUID generation.
2. Create `parasut_sync_runs`.
3. Create the eight confirmed resource tables.
4. Create `parasut_sync_errors`.
5. Add check and external identity constraints.
6. Add indexes.
7. Add `updated_at` triggers.
8. Enable RLS on every new table.
9. Add admin/company-wide read policies.
10. Add no browser write policies.
11. Grant no access to `anon`.
12. Verify service-role ingestion locally without calling Paraşüt.

`parasut_sync_cursors` remains deferred until cursor semantics are confirmed.

No production application is part of Phase 2 unless explicitly requested in a
later approval.

## Test Plan

### Migration Tests

- Migration applies to a clean local Supabase database.
- All required tables, columns, defaults, and constraints exist.
- Every resource table fixes the correct `resource_type`.
- Duplicate external identity is rejected.
- The same `parasut_id` is allowed for different resource types or Paraşüt
  companies.
- Separate Paraşüt IDs with identical payloads remain separate rows.

### Payload Tests

- Attributes, relationships, included resources, and raw payload round-trip.
- Null relationships remain null.
- Empty relationships remain empty.
- Canonical hashing is stable across JSON object key order.
- Different include sets do not alter the resource payload hash.
- Changed attributes or relationships alter the hash.
- Matching hashes update `last_seen_at` without rewriting the snapshot.

### Included-Resource Tests

- Sales invoice contact, detail, and payment resources route correctly.
- Purchase bill detail and payment resources route correctly.
- The same included payment is idempotent across parent requests.
- Unknown included resource types remain in parent JSON but create no table row.

### Lifecycle Tests

- Explicit archived values are preserved.
- Missing records are not deleted or archived.
- Backward source timestamps raise a warning instead of silently overwriting.

### RLS Tests

- Anonymous users cannot select or write.
- Ordinary authenticated users cannot write.
- Cross-company reads are denied.
- Approved company-wide administrators can read their company.
- Branch-only members cannot read raw mirror data by default.
- Service-role ingestion succeeds in a server-only test.

### Safety Tests

- No credential fields exist in synchronization tables.
- Sanitized errors do not contain authorization headers or tokens.
- No mirror table has an ERP domain foreign key.
- No Paraşüt POST, PUT, PATCH, or DELETE operation exists.

## Unknowns

1. Stable pagination ordering is unverified.
2. Incremental `updated_at` filtering is unverified.
3. Rate-limit and retry semantics are unverified.
4. Token refresh under long-running synchronization is untested.
5. Source deletion behavior is unknown.
6. A complete standalone payments collection is unavailable at the tested path.
7. A populated purchase bill `spender` relationship has not been observed.
8. The distinction between `spender` and `supplier` remains unresolved.
9. Nested product and warehouse includes require more evidence.
10. Warehouses, categories, tags, contact people, activities, inventory levels,
    stock updates, and transactions remain unconfirmed as independent mirror
    resources.
11. A dedicated integration permission suitable for RLS is not yet confirmed.
12. Long-term historical raw-payload retention is not approved.
13. Expected data volume and JSONB growth are not measured.
14. The authoritative mapping between DAYAN company IDs and Paraşüt company IDs
    needs a later connection-configuration design.

## Exact Phase 2 Implementation Prompt

```md
Read and strictly follow `/docs/ENGINEERING_CONSTITUTION.md`.

# PHASE 2 — IMPLEMENT PARASUT MIRROR DATABASE FOUNDATION

## Scope

Implement only the database foundation designed in:

- `docs/PHASE_0_PARASUT_MIRROR_ARCHITECTURE.md`
- `docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`

Do NOT implement Paraşüt HTTP synchronization.
Do NOT call Paraşüt.
Do NOT modify ERP domain tables.
Do NOT design or modify CRM partners or stakeholders.
Do NOT map mirror data into CRM, Sales, Purchasing, Inventory, or Finance.
Do NOT create browser access to Paraşüt.
Do NOT apply anything to production.
Do NOT commit or push unless separately requested.

## Required Work

1. Create documentation first:

   `docs/PHASE_2_PARASUT_MIRROR_DATABASE_IMPLEMENTATION.md`

2. Create one additive Supabase migration containing:

   - `parasut_sync_runs`
   - `parasut_contacts`
   - `parasut_products`
   - `parasut_sales_invoices`
   - `parasut_sales_invoice_details`
   - `parasut_purchase_bills`
   - `parasut_purchase_bill_details`
   - `parasut_payments`
   - `parasut_accounts`
   - `parasut_sync_errors`

3. Use the exact common columns, external identity constraints, resource-type
   checks, indexes, updated-at triggers, and retention-neutral structure from
   the Phase 1 design.

4. Enable RLS on every new table.

5. Add no anonymous policies and no authenticated write policies.

6. Permit authenticated reads only for active company-wide administrators
   following current repository tenant-membership and admin conventions.

7. Keep service-role ingestion possible without exposing service credentials.

8. Do not create `parasut_sync_cursors` yet.

9. Add local database tests proving:

   - clean migration application
   - external identity uniqueness
   - separate source IDs remain separate
   - JSONB and null relationship preservation
   - RLS anonymous denial
   - cross-company denial
   - authenticated browser write denial
   - approved admin read behavior

10. Regenerate Supabase types locally if the repository workflow requires it.

## Safety

- Local Supabase only.
- No production database operation.
- No Paraşüt API request.
- No credentials or personal payloads in tests.
- No destructive migration.
- Documentation and source code must be English.
- Existing user-facing Turkish text must remain unchanged.

## Validation

Run:

`npm run typecheck`
`npm run test`
`npm run build`
`npm run lint`

Run local migration and RLS verification only after confirming the database
target is `127.0.0.1` or `localhost`.

## Required Result File

Create:

`docs/phase-results/PHASE_2_RESULT.md`

Report migration file, tables created, policies, tests, validation, production
status, and remaining unknowns.
```
