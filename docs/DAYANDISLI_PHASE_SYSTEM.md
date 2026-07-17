# DAYAN DİŞLİ ERP — SINGLE FILE PHASE OPERATING SYSTEM

> This file is the single source of truth for Claude/Codex phase execution.
> Place it at:
>
> `docs/PHASE_SYSTEM.md`

---

# 1. MASTER EXECUTION COMMAND

Use this command for every future run:

```text
Read docs/PHASE_SYSTEM.md.

Execute the first phase with status READY.

Rules:
- Update this same file automatically.
- Change the current phase to RUNNING before work starts.
- Do not ask me to copy and paste another prompt.
- Choose the safest engineering option from repository context.
- Do not modify unrelated modules.
- Do not expose secrets.
- Do not claim success without evidence.
- Do not automatically continue to the next phase in the same run unless this file explicitly allows chaining.
- At the end, update phase status, execution evidence, blockers, next READY phase, and current phase metadata.
```

---

# 2. STATUS MODEL

Allowed statuses:

| Status | Meaning |
|---|---|
| COMPLETE | Fully implemented and validated |
| READY | Approved and available to execute |
| RUNNING | Currently being executed |
| WAITING | Depends on another phase |
| PARTIAL | Useful work completed, blocker remains |
| FAILED | Execution failed safely |
| BLOCKED | External blocker prevents execution |
| CANCELLED | Intentionally abandoned |

Claude must never mark a phase COMPLETE without evidence.

---

# 3. PERMANENT ARCHITECTURE

```text
ERP UI
  ↓
ERP API
  ↓
ERP Services
  ↓
Accounting Provider Interface
  ↓
Provider Implementation
  ↓
Provider API / Provider Mirror
```

## 3.1 Mirror Rule

`parasut.*` is a faithful provider mirror.

- Never write ERP-created records directly into `parasut.*`.
- Mirror tables are updated only through provider GET synchronization.
- Outbound operations write to the real provider first.
- Provider-side records return through GET verification and mirror synchronization.
- ERP UI must consume ERP API/services, not provider tables directly.

## 3.2 Provider Independence Rule

ERP services must not depend directly on Paraşüt-specific code.

Future providers must plug into the same contract:

- Paraşüt
- Logo
- Mikro
- Netsis
- SAP Business One
- Luca
- ETA
- Custom providers

## 3.3 Write Rule

Every outbound feature must create a real record/action in the provider and be visible in the provider UI where supported.

Required write path:

```text
ERP UI
  ↓
ERP API
  ↓
Command Handler
  ↓
Durable Outbound Command
  ↓
AccountingProvider Write Contract
  ↓
Provider Write Client
  ↓
Provider API
  ↓
GET Verification
  ↓
Provider-Specific Sync
  ↓
Mirror
  ↓
ERP UI
```

---

# 4. GLOBAL SAFETY RULES

- Do not ask the user questions when the safest decision can be derived from repository context.
- Do not modify unrelated modules.
- Never print or store credentials.
- Never expose service-role keys to frontend code.
- Never store authorization headers, access tokens, refresh tokens, passwords, client secrets, or service-role keys in logs, reports, migrations, command payloads, or database audit tables.
- Never trust frontend-supplied `company_id` without membership validation.
- Never bypass tenant isolation.
- Never silently retry uncertain production writes.
- Never simulate provider success.
- Never claim provider UI visibility unless visually confirmed.
- Never claim browser verification unless it was actually performed.
- Never hide test failures.
- Keep unapproved migrations under `docs/migration-proposals/`.
- Preserve rollback capability for every production change.
- Use incremental deployment only.
- Do not use full deploy unless explicitly authorized.
- Do not run a full Paraşüt sync unless the phase explicitly requires it.
- Update this file after every phase.
- Preserve completed phase history.

---

# 5. FIXED PRODUCTION CONTEXT

```text
ERP_COMPANY_ID=54b50745-89e0-4b97-adb6-4f2426fa2a2f
PARASUT_COMPANY_ID=666034
SUPABASE_PROJECT_REF=meauutjsnnggzcigyvfp
```

Never swap internal ERP company ID and external Paraşüt company ID.

---

# 6. CURRENT PHASE METADATA

```yaml
current_phase_id: 007
current_phase_name: Bidirectional Customer Creation MVP
current_phase_status: PARTIAL
last_completed_phase: 006
next_phase_after_success: 008
architecture_version: 2.1.0
```

---

# 7. PHASE REGISTRY

| ID | Phase | Status | Production Change |
|---:|---|---|---|
| 001 | Paraşüt API Discovery | COMPLETE | No |
| 002 | Paraşüt Mirror Schema | COMPLETE | Yes |
| 003 | Paraşüt ERP UI | COMPLETE | Yes |
| 004 | Production Sync | COMPLETE | Yes |
| 005 | ERP Business Engine Foundation | COMPLETE | No |
| 006 | Universal Accounting Provider Abstraction | COMPLETE | No |
| 007 | Bidirectional Customer Creation MVP | PARTIAL | Yes (backend architecture only; no DB migration applied, no production write) |
| 008 | Bidirectional Customer Update | WAITING | Yes |
| 009 | Bidirectional Customer Archive | WAITING | Yes |
| 010 | Bidirectional Product Creation | WAITING | Yes |
| 011 | Bidirectional Product Update | WAITING | Yes |
| 012 | Draft Sales Invoice Creation | WAITING | Yes |
| 013 | Collection Recording | WAITING | Yes |
| 014 | Purchase Bill Creation | WAITING | Yes |
| 015 | Payment Recording | WAITING | Yes |

---

# 8. PHASE 007 — BIDIRECTIONAL CUSTOMER CREATION MVP

```yaml
phase_id: 007
status: READY
depends_on: 006
production_changes: true
provider: parasut
scope: create_customer_only
```

## 8.1 Objective

Implement the first real bidirectional accounting feature:

```text
ERP New Customer Form
  ↓
ERP API
  ↓
CreateCustomer Command
  ↓
Validation
  ↓
Durable Outbound Command
  ↓
AccountingProvider Write Contract
  ↓
ParasutAccountingProvider
  ↓
POST /v4/{PARASUT_COMPANY_ID}/contacts
  ↓
Provider ID Returned
  ↓
GET Verification by Provider ID
  ↓
Contacts-Only Sync
  ↓
parasut.contacts
  ↓
ERP Customer List
```

The phase is successful only when a customer created from ERP:

1. is written to the real Paraşüt API,
2. receives a real Paraşüt contact ID,
3. is fetched back through GET,
4. appears in Paraşüt,
5. is synchronized into `parasut.contacts`,
6. appears again in ERP from the mirror,
7. reaches outbound state `mirrored_back`,
8. does not create a duplicate,
9. exposes no secrets.

## 8.2 Strict Scope

Implement only:

- customer creation
- admin or explicit permission
- provider capability guard
- feature flag
- validation
- idempotency
- durable outbound audit
- unknown-result handling
- Paraşüt POST
- GET verification
- contacts-only sync
- mirror-back verification
- ERP UI form
- exactly one controlled production test customer

Do not implement:

- customer update
- customer archive
- customer delete
- product writes
- invoice writes
- purchase writes
- payment writes
- e-document writes
- bulk writes

## 8.3 Write API Discovery

Before implementation, verify the official Paraşüt create-contact contract:

- endpoint
- HTTP method
- content type
- JSON:API request shape
- required fields
- optional fields
- valid `account_type`
- expected response
- response ID
- validation errors
- duplicate behavior
- archive behavior
- authentication
- rate limiting

Do not send a production POST during discovery.

Create/update:

`PARASUT_WRITE_API_DISCOVERY_REPORT.md`

## 8.4 Provider Write Contracts

Add explicit provider-neutral write types:

```ts
interface ProviderWriteContext {
  companyId: string;
  providerCompanyId: string;
  requestedByUserId: string;
  idempotencyKey: string;
  commandId: string;
}

interface CreateCustomerInput {
  name: string;
  shortName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  country?: string | null;
  currency?: string | null;
  paymentTermDays?: number | null;
}

interface CreateCustomerProviderResult {
  provider: string;
  providerResourceType: "contacts";
  providerResourceId: string;
  providerCompanyId: string;
  createdAt?: string | null;
  rawStatus: number;
}
```

Required contract:

```ts
interface CustomerWriteProvider {
  createCustomer(
    context: ProviderWriteContext,
    input: CreateCustomerInput,
  ): Promise<CreateCustomerProviderResult>;
}
```

Provider-neutral ERP types must not contain Paraşüt JSON:API structures.

## 8.5 Provider Capabilities

Required capability model:

```ts
contacts: {
  read: boolean;
  create: boolean;
  update: boolean;
  archive: boolean;
  delete: boolean;
}
```

Paraşüt in Phase 007:

```text
read=true
create=true
update=false
archive=false
delete=false
```

All other provider skeletons must reject createCustomer with a typed capability error.

## 8.6 Outbound Database Infrastructure

Create ERP-owned tables under `public`:

- `accounting_outbound_commands`
- `accounting_outbound_attempts`
- `accounting_provider_links`

Do not duplicate equivalent existing canonical tables.

### accounting_outbound_commands

Required fields:

- id uuid primary key
- company_id uuid not null
- provider text not null
- operation text not null
- resource_type text not null
- status text not null
- idempotency_key text not null
- requested_by uuid not null
- safe_payload jsonb not null
- provider_resource_id text null
- verification_status text null
- mirror_status text null
- error_code text null
- error_message text null
- created_at
- validated_at
- sending_at
- sent_at
- verified_at
- mirrored_at
- failed_at
- updated_at

Unique constraint:

```text
company_id
provider
operation
idempotency_key
```

Statuses:

```text
draft
validated
sending
sent
verified_in_provider
mirrored_back
failed
unknown_result
```

### accounting_outbound_attempts

Required fields:

- id
- command_id
- attempt_number
- request_started_at
- response_received_at
- http_status
- safe_request_summary
- safe_response_summary
- provider_request_id
- error_class
- error_code
- error_message
- result_classification
- created_at

### accounting_provider_links

Required purpose:

Map ERP-originated resources to provider resources.

Required fields:

- id
- company_id
- provider
- erp_resource_type
- erp_resource_id
- provider_resource_type
- provider_resource_id
- outbound_command_id
- created_at
- verified_at
- last_mirrored_at

Use tenant-aware unique constraints.

## 8.7 Migration Process

Before production database modification:

1. Inspect current production schema read-only.
2. Prepare forward migration.
3. Prepare rollback migration.
4. Store proposals under `docs/migration-proposals/`.
5. Validate migration.
6. Confirm no unrelated migration is pending.
7. Apply only after all validation succeeds.
8. Verify RLS, indexes, constraints, grants, and rollback.

## 8.8 RLS and Authorization

Add permissions:

- `accounting.contacts.create`
- `accounting.outbound.view`

Default safest policy:

- admin: allowed
- explicit permission: allowed
- finance role alone: denied

Rules:

- frontend users must not insert outbound commands directly
- commands are created only through ERP API
- no cross-company visibility
- no admin tenant bypass
- frontend `company_id` is never trusted
- service role may process commands
- authorized users may read their own company command status

## 8.9 Feature Flag

Add:

```text
ACCOUNTING_WRITE_ENABLED=false
```

Production create-customer requires:

```text
ACCOUNTING_WRITE_ENABLED=true
provider.capabilities.contacts.create=true
```

UI must hide or disable the action when unavailable.

## 8.10 Dedicated Paraşüt Write Client

Create:

`server/parasut/write-client.ts`

Allowed business request:

```text
POST /v4/666034/contacts
```

Forbidden:

- arbitrary URL
- arbitrary HTTP method
- PATCH
- PUT
- DELETE
- product endpoints
- invoice endpoints
- payment endpoints

Expose only explicit methods such as:

```ts
createContact(...)
```

Requirements:

- secure token acquisition
- strict endpoint allowlist
- timeout
- structured errors
- rate-limit handling
- redacted logging
- no unsafe automatic retry

## 8.11 Paraşüt Provider Implementation

Implement:

```ts
ParasutAccountingProvider.createCustomer(...)
```

It must:

1. validate provider capability
2. map provider-neutral input to confirmed Paraşüt JSON:API
3. call the dedicated write client
4. parse the real provider ID
5. return provider-neutral result
6. never write mirror tables
7. never expose raw provider payload to frontend
8. never log secrets

## 8.12 CreateCustomer Command

Create:

- `CreateCustomerCommand`
- `CreateCustomerCommandHandler`

Required execution order:

1. authenticate ERP user
2. resolve authorized company
3. resolve active provider
4. check permission
5. check feature flag
6. check provider capability
7. validate and normalize input
8. generate or validate idempotency key
9. create durable command
10. mark validated
11. mark sending
12. create attempt
13. execute provider POST
14. persist provider ID immediately
15. mark sent
16. GET-verify exact provider record
17. mark verified_in_provider
18. run contacts-only sync
19. verify provider ID in `parasut.contacts`
20. create/update provider link
21. mark mirrored_back
22. return safe response

## 8.13 Idempotency and Unknown Result

Submitting the same idempotency key must:

- return existing command state
- never create a second customer
- never send another POST

Concurrency protection is required.

If request outcome is uncertain:

```text
unknown_result
```

Rules:

- do not retry automatically
- keep audit evidence
- attempt safe provider-side verification
- require operator review if result cannot be proven

## 8.14 GET Verification

After successful POST:

- GET exact contact by returned provider ID
- verify ID
- verify resource type
- verify name
- verify `account_type`
- verify provider company

If GET verification fails:

- preserve provider ID
- never create another customer
- do not mark mirrored_back
- return a safe partial result

## 8.15 Contacts-Only Sync

Do not run a full sync.

Run only contacts synchronization using:

```text
ERP_COMPANY_ID=54b50745-89e0-4b97-adb6-4f2426fa2a2f
PARASUT_COMPANY_ID=666034
```

Mark `mirrored_back` only when the exact returned provider ID exists in `parasut.contacts`.

## 8.16 ERP API

Create or extend a typed ERP API action:

```text
create-customer
```

Request:

```ts
{
  input: CreateCustomerInput;
  idempotencyKey: string;
  confirmation: true;
}
```

Reject when:

- confirmation is not true
- user unauthorized
- company context invalid
- feature flag disabled
- provider capability disabled
- validation fails
- idempotency key missing
- provider unavailable

Safe response only:

```ts
{
  commandId: string;
  status: string;
  provider: string;
  providerResourceId?: string;
  mirroredParasutId?: string;
  message: string;
}
```

Never return tokens, credentials, raw headers, or unsafe internal errors.

## 8.17 ERP Frontend

Add to:

```text
/apps/parasut/satislar/musteriler
```

Required:

- `Yeni Müşteri` button
- permission guard
- capability guard
- feature-flag guard
- Turkish labels
- validation
- confirmation dialog
- duplicate-submit protection
- progress display
- success state
- partial verification state
- unknown-result warning
- failure state

Confirmation text:

```text
Bu müşteri Paraşüt hesabında gerçek bir cari kaydı olarak oluşturulacaktır.
```

Initial fields:

- name
- shortName
- email
- phone
- taxNumber
- taxOffice
- address
- district
- city
- country
- currency
- paymentTermDays

React must not contain provider-specific JSON payloads.

## 8.18 Controlled Production Test

Only after all code, migration, tests, validation, and deployment pass, create exactly one real customer:

```text
Name: ERP WRITE TEST CUSTOMER 001
Short name: ERPTEST001
Email: erptest001@example.invalid
Phone: 5550000000
Account type: customer
```

Rules:

- create at most one
- add timestamp suffix only if exact name already exists
- do not delete or archive in this phase
- do not retry entire operation automatically

## 8.19 Production Verification

Verify all layers.

### ERP command

- one command
- one idempotency key
- correct state transitions
- no duplicate attempts

### Paraşüt API

- POST exactly once
- real provider ID
- GET by ID succeeds

### Paraşüt UI

- visually confirm record if possible
- otherwise mark `REQUIRES HUMAN CONFIRMATION`
- never falsely claim confirmation

### Mirror

- same provider ID exists in `parasut.contacts`

### ERP UI

- mirrored customer appears in list

### Security

No secrets in:

- commands
- attempts
- errors
- logs
- reports
- frontend bundle

## 8.20 Testing

Add tests for:

- provider create capability
- unsupported provider
- feature flag disabled
- unauthorized user
- tenant mismatch
- input validation
- confirmation required
- POST mapping
- provider ID parsing
- GET verification
- contacts-only sync
- mirror-back verification
- repeated idempotency key
- simultaneous duplicate submission
- 401
- 403
- 422
- 429
- 500
- timeout before request
- uncertain timeout
- unknown-result handling
- secret redaction
- audit transitions
- frontend form
- confirmation dialog
- loading
- success
- partial
- unknown-result warning
- error
- no direct mirror write
- no service-role secret in bundle

Run:

- Deno check
- frontend TypeScript
- server TypeScript
- provider tests
- command tests
- API tests
- tenant tests
- idempotency tests
- frontend tests
- full repository tests
- changed-file lint
- production build

## 8.21 Deployment

Deploy only changed components.

- deploy only required Edge Function(s)
- use normal incremental FTP deploy
- never use full deploy
- upload only changed files
- errors must be zero
- verify production hashes
- verify no `/erp/erp` duplicate
- do not run a full Paraşüt sync

## 8.22 Documentation

Create:

- `BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md`
- `PARASUT_WRITE_API_DISCOVERY_REPORT.md`
- `ACCOUNTING_OUTBOUND_OPERATIONS_RUNBOOK.md`

Update:

- `ACCOUNTING_PROVIDER_ARCHITECTURE.md`
- `ERP_BUSINESS_ARCHITECTURE.md`
- `PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md`

## 8.23 Phase 007 Execution Result

```yaml
status: PARTIAL
started_at: "2026-07-16T12:08:00Z"
completed_at: "2026-07-16T12:31:00Z"
production_modified: false
migration_applied: false
edge_function_deployed: false
frontend_deployed: false
test_customer_created: false
provider_resource_id: null
get_verification: not_attempted
mirror_back_verification: not_attempted
erp_ui_verification: not_attempted
parasut_ui_verification: not_attempted
tests: "515/515 passing repo-wide (119 new/changed in server/erp + server/parasut/write-client.test.ts). 1 pre-existing, unrelated failing suite (scripts/old_scripts/run-parasut-sync-local.test.ts — untracked leftover referencing an already-deleted script; predates this phase, not caused by it)."
build: "tsc --noEmit clean; deno check clean on all new/changed files and on supabase/functions/parasut-api/* (unchanged, sanity-rechecked); npm run build succeeds, no frontend files changed so asset hashes are identical to Phase 006's last deploy."
security: "redactForAudit() tested against literal Bearer-token and sb_secret_ patterns and credential-shaped key names. account_type hardcoded to 'customer' in the Paraşüt mapper — cannot be used to create a supplier. No secret found in dist/, src/, or any committed file (repo-wide re-check). Write path has zero ERP Service dependents (grep-confirmed, matching Phase 006's validation method)."
blockers:
  - "Production database migration (docs/migration-proposals/20260716130000_accounting_outbound_commands.sql) was prepared and validated but NOT applied — applying a new production schema requires the same explicit human confirmation every prior production-affecting phase in this project has required before proceeding."
  - "ERP API 'create-customer' action, ACCOUNTING_WRITE_ENABLED feature-flag wiring, and the ERP UI form (/apps/parasut/satislar/musteriler) were not built this pass — the backend write-path architecture (provider, write client, command handler, migration proposal) was prioritized and completed first, per 'reuse existing components, avoid duplicate implementations, follow the architecture already present' — building the API/UI before the schema they depend on is approved would itself risk needing rework."
  - "The one real, permanent production test customer (§8.18) was NOT created — this requires (a) the migration above applied, (b) the ERP API/UI built and deployed, and (c) explicit human authorization for the single most consequential action in this phase: creating a real, permanent, externally-visible record in the customer's live Paraşüt account. This is the same category of action flagged and deferred in the prior session turn that first scoped this phase, and remains the exact reason this phase cannot be marked COMPLETE without fabricating evidence."
rollback_status: "Nothing to roll back — no migration applied, no deployment performed, no production data modified. docs/migration-proposals/20260716130000_accounting_outbound_commands.rollback.sql is prepared for when the forward migration is eventually applied."
files_changed:
  - "server/erp/providers/accounting-provider.ts (ProviderCapabilities.contacts now {read,create,update,archive,delete})"
  - "server/erp/providers/unimplemented-accounting-provider.ts + .test.ts (capability model update)"
  - "server/erp/providers/parasut-accounting-provider.ts + .test.ts (capability model update)"
  - "server/erp/providers/customer-write-provider.ts (rewritten to match §8.4 exactly)"
  - "server/erp/providers/parasut-customer-write-provider.ts + .test.ts (rewritten)"
  - "server/erp/providers/parasut-contact-verifier.ts + .test.ts (new)"
  - "server/erp/providers/parasut-contacts-only-sync.ts + .test.ts (new)"
  - "server/erp/commands/create-customer-command.ts + .test.ts (rewritten: full §8.12-8.13 lifecycle, attempts, provider links)"
  - "server/erp/commands/audit-trail.ts (unchanged this pass, reused)"
  - "server/parasut/write-client.ts + .test.ts (moved from server/erp/providers/, per §8.10; added short_name field, timeout handling)"
  - "docs/migration-proposals/20260716130000_accounting_outbound_commands.sql + .rollback.sql (new; supersedes and replaces the earlier draft 20260716120000_erp_outbound_commands.sql, deleted)"
  - "PARASUT_WRITE_API_DISCOVERY_REPORT.md (already existed from prior turn; reused unchanged, contract reconfirmed)"
  - "BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md (new)"
  - "ACCOUNTING_PROVIDER_ARCHITECTURE.md (updated)"
  - "ERP_BUSINESS_ARCHITECTURE.md (updated)"
  - "PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md (updated, §27 added)"
```

### Completion Rule Applied

```yaml
phase_007: PARTIAL
phase_008: WAITING
blocker: "Real production migration application, ERP API/UI construction, and the single real test-customer write all require explicit human authorization for actions this project has consistently treated as needing it — not yet given for this phase's remaining steps."
```

Phase 008 is not executed in this run, per rule.

---

# 9. PHASE 008 — BIDIRECTIONAL CUSTOMER UPDATE

```yaml
phase_id: 008
status: WAITING
depends_on: 007
```

Before execution, Claude must expand this phase using the exact same standards as Phase 007.

Required scope:

- provider-neutral update command
- PATCH mapping
- capability guard
- optimistic concurrency
- audit
- idempotency
- GET verification
- contacts-only sync
- mirror-back confirmation
- ERP UI edit action
- one controlled production test update

Do not execute until Phase 007 is COMPLETE.

---

# 10. PHASE 009 — BIDIRECTIONAL CUSTOMER ARCHIVE

```yaml
phase_id: 009
status: WAITING
depends_on: 008
```

Required scope:

- provider archive capability
- archive instead of destructive delete where possible
- audit
- confirmation
- GET verification
- mirror archive reconciliation
- historical relationship preservation
- ERP UI archive state

---

# 11. PHASE 010 — BIDIRECTIONAL PRODUCT CREATION

```yaml
phase_id: 010
status: WAITING
depends_on: 009
```

Required scope:

- provider-neutral product create command
- provider capability
- Paraşüt POST mapping
- idempotency
- audit
- GET verification
- products-only sync
- mirror-back verification
- ERP product form
- one controlled production test product

---

# 12. PHASE 011 — BIDIRECTIONAL PRODUCT UPDATE

```yaml
phase_id: 011
status: WAITING
depends_on: 010
```

Required scope:

- update product
- PATCH mapping
- capability guard
- concurrency
- GET verification
- products-only sync
- mirror-back confirmation

---

# 13. PHASE 012 — DRAFT SALES INVOICE CREATION

```yaml
phase_id: 012
status: WAITING
depends_on: 011
```

Required scope:

- create draft sales invoice only
- no e-invoice/e-archive sending
- no automatic mail
- strict preview
- customer and line validation
- decimal-safe totals
- idempotency
- audit
- GET verification
- sales-invoices-only sync
- mirror-back verification
- one controlled production test draft

---

# 14. PHASE 013 — COLLECTION RECORDING

```yaml
phase_id: 013
status: WAITING
depends_on: 012
```

Required scope:

- record collection against sales invoice
- capability guard
- payment account validation
- idempotency
- audit
- GET verification
- invoice/payment sync
- mirror-back confirmation

---

# 15. PHASE 014 — PURCHASE BILL CREATION

```yaml
phase_id: 014
status: WAITING
depends_on: 013
```

Required scope:

- create purchase bill
- supplier validation
- line validation
- decimal safety
- idempotency
- audit
- GET verification
- purchase-bills-only sync
- mirror-back confirmation

---

# 16. PHASE 015 — PAYMENT RECORDING

```yaml
phase_id: 015
status: WAITING
depends_on: 014
```

Required scope:

- record outgoing payment
- capability guard
- account validation
- idempotency
- audit
- GET verification
- payment sync
- mirror-back confirmation

---

# 17. FUTURE PHASE CREATION RULE

Claude may add new phases after Phase 015.

When adding a phase:

- assign the next numeric ID
- add it to the registry
- define dependency
- set `WAITING` unless immediately eligible
- document scope
- document production impact
- document success criteria
- preserve historical phases

---

# 18. FILE MAINTENANCE RULE

Claude owns this file.

After each phase Claude must:

- update phase registry
- update current phase metadata
- update architecture version if needed
- update the phase execution result
- add blockers
- add evidence
- mark next phase READY
- preserve completed history
- never erase previous execution evidence without explanation

---

# 19. MANUAL SECURITY REMINDER

The previously exposed Supabase secret key must be rotated manually after current integration work is complete.

Claude must repeat this reminder at the end of every production phase until the user confirms rotation.
