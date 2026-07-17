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
current_phase_id: 008
current_phase_name: Bidirectional Customer Update
current_phase_status: READY
last_completed_phase: 007
next_phase_after_success: 009
architecture_version: 2.3.0
adr_created_or_updated:
  - "docs/adr/ADR-001-read-write-provider-split-and-outbound-command-architecture.md"
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
| 007 | Bidirectional Customer Creation MVP | COMPLETE | Yes (migration applied; Edge Function deployed + ACTIVE; frontend deployed; one real customer created in production Paraşüt via the authenticated admin path, GET-verified, mirrored, confirmed in ERP customer list; write flag OFF) |
| 008 | Bidirectional Customer Update | READY | Yes |
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
status: COMPLETE
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
status: COMPLETE
started_at: "2026-07-16T12:08:00Z"
completed_at: "2026-07-16T20:15:00Z"
production_modified: true
migration_applied: true
migration_applied_at: "2026-07-16T~18:12:00Z"
edge_function_deployed: true
edge_function_status: ACTIVE
accounting_write_enabled_flag: false
frontend_deployed: true
frontend_deploy_evidence: "scripts/deploy_ftp.py --diff then --checksum (established script, no new command invented): 191 uploaded / 0 errors, then found+fixed a recurrence of the documented stale-index.html tool defect via the script's own --checksum mode (1 uploaded, 0 errors). Re-verified via direct FTP fetch: /erp/index.html references the current bundle, no /erp/erp path. A subsequent rebuild with no source changes correctly showed 0 uploaded / 288 unchanged under --checksum, confirming the deployed bundle is current and the tool's content comparison is now trustworthy for this state."
test_customer_created: true
command_id: "3d853d03-9349-4975-9972-7d911eb81dde"
idempotency_key: "phase007-create-customer-erp-write-test-customer-001"
test_customer_name: "ERP WRITE TEST CUSTOMER 001"
provider_resource_id: "1067485894"
paraşüt_post_count: 1
outbound_attempt_count: 1
get_verification: "verified — ParasutContactVerifier confirmed id/type/account_type/name server-side as part of the command flow (verification_status: verified)"
mirror_back_verification: "confirmed — command status: mirrored_back; parasut.contacts row exists with parasut_id=1067485894, company_id=54b50745-89e0-4b97-adb6-4f2426fa2a2f, parasut_company_id=666034, account_type=customer, name='ERP WRITE TEST CUSTOMER 001', short_name=ERPTEST001 (all queried directly from production via supabase db query --linked)"
erp_ui_verification: "Confirmed via the real authenticated admin session calling the deployed parasut-api 'list' action (the same call the frontend itself makes): total=1 matching a search for the test customer's name, and the row is present. This is a real authenticated-API confirmation, not a rendered-browser screenshot — a rendered visual load was not possible in this environment (no general internet egress; FTP and the Supabase API only)."
parasut_ui_verification: "REQUIRES HUMAN CONFIRMATION — this environment has no browser tool; visual confirmation in the Paraşüt web UI was not performed and is not falsely claimed."
duplicate_check: "None. accounting_outbound_commands: exactly 1 row for this idempotency key. accounting_outbound_attempts: exactly 1 row (http_status 201, result_classification success). accounting_provider_links: exactly 1 row. parasut.contacts: exactly 1 row matching the test customer's name (count query)."
audit_check: "6 lifecycle events recorded (command_created, validated, sending, sent, verified_in_provider, mirrored_back), each inspected directly — no secret, token, or credential value present in any detail payload."
uncertain_result_handling: "A client-side read timeout (30s) occurred while waiting for the HTTPS response from the authenticated create-customer call — this was correctly treated as an uncertain outcome per instruction: ACCOUNTING_WRITE_ENABLED was immediately set back to false, no retry was attempted, and the actual server-side state was checked read-only. The server had in fact completed the full flow successfully (~39s end-to-end, longer than the 30s client timeout) before the client gave up waiting — the uncertainty was a client-timeout artifact, not a real ambiguous provider outcome, and was resolved by evidence, not by guessing or retrying."
tests: "565/565 passing repo-wide. 1 pre-existing, unrelated failing suite (scripts/old_scripts/run-parasut-sync-local.test.ts) — recorded as technical debt, not touched, per explicit instruction."
build: "tsc --noEmit clean. eslint clean. npm run build succeeds. madge --circular: only the pre-existing, unrelated sync-observability.ts > types.ts cycle remains. deno check clean on every changed Deno-targeted file."
security: "No secret found in dist/, src/, any committed file, or any audit_log/attempt row for the real test command. The 5 PARASUT_* secrets and the admin test credentials were never printed to any log/transcript/output at any point — all read from git-ignored .env.local by name only, values consumed programmatically. account_type hardcoded to 'customer' in the Paraşüt mapper. accounting.contacts.create explicitly excluded from the finance role's wildcard match. anon/authenticated confirmed to have zero grants on all 4 outbound tables; service_role confirmed rolbypassrls=true."
production_pre_apply_audit_finding: "Before applying, the migration's company_id column carried a stale placeholder FK (references public.erp_users(id)), never revisited before approval. A production information_schema/pg_constraint query confirmed no table in this schema enforces a company_id FK anywhere — removed to match that convention before applying. See docs/RISK_REGISTER.md R-005."
this_pass_summary: "Frontend deployed and verified (incl. fixing a real recurrence of the stale-index.html tool defect). Authenticated as a real ERP admin via the Supabase Auth REST API (no browser tool available in this environment) and confirmed, live, that the UI-availability guard correctly reports unavailable when the write flag is false and available when true. Executed exactly one real customer-creation request through that authenticated session — the only Paraşüt POST sent this phase. Handled a client-side timeout as an uncertain result exactly per instruction (closed the gate, did not retry, verified via read-only queries) and confirmed the actual outcome was a full, clean success: mirrored_back, GET-verified, one attempt, one provider link, present in the ERP customer list, no duplicate anywhere. ACCOUNTING_WRITE_ENABLED left false as the final, safer state (re-enabling it was correctly declined as a separate action beyond the single authorized test window)."
blockers: []
rollback_status: "The forward migration is applied; supabase/migrations/20260716130000_accounting_outbound_commands.sql is the canonical, versioned copy. docs/migration-proposals/20260716130000_accounting_outbound_commands.rollback.sql is validated and ready if ever needed. One real production customer record now exists (parasut_id 1067485894) — the rollback script does not delete real Paraşüt contacts, only this schema's own tracking of them, per its own documented scope."
production_verification_plan: "Superseded by this pass's actual execution — see BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md and docs/ACCOUNTING_OUTBOUND_OPERATIONS_RUNBOOK.md for the operational reference going forward."
files_changed:
  - "supabase/functions/_shared/accounting-outbound-repository.ts(+test) (closed TD-003: 23505 unique-violation catch-and-retry in findOrCreateCommand, new OutboundRepositoryError)"
  - "supabase/functions/parasut-write-api/handlers.ts(+test) (new computeCustomerCreateAvailability read-only status check), index.ts (new customer-create-availability action, wired before any PARASUT_* credential is read)"
  - "src/features/erp/parasut/components/CreateCustomerDialog.tsx(+test) (hidden until server-confirmed available, not just client-permission-gated)"
  - "supabase/migrations/20260716130000_accounting_outbound_commands.sql (new — canonical applied copy, FK-corrected); supabase/config.toml (registered parasut-write-api function config)"
  - "supabase/functions/parasut-write-api/handlers.test.ts (fixed real import-depth bug found by deno check this pass)"
  - "src/features/erp/shared/permissions.ts (new permissions + OUTBOUND_WRITE_ONLY_PERMISSIONS exclusion) + permissionMatrix.test.ts (new coverage)"
  - "server/erp/providers/accounting-provider.ts, unimplemented-accounting-provider.ts(+test), parasut-accounting-provider.ts(+test) (capability model: contacts now {read,create,update,archive,delete})"
  - "server/erp/providers/customer-write-provider.ts, parasut-customer-write-provider.ts(+test) (write contract + Paraşüt mapping)"
  - "server/erp/providers/parasut-contact-verifier.ts(+test), parasut-contacts-only-sync.ts(+test) (new)"
  - "server/erp/commands/create-customer-command.ts(+test) (full lifecycle, idempotency, concurrency test added this pass)"
  - "server/parasut/write-client.ts(+test) (429/500/timeout classification tests added this pass)"
  - "supabase/functions/_shared/accounting-outbound-repository.ts(+test) (new)"
  - "supabase/functions/parasut-write-api/{index.ts,handlers.ts}(+tests) (new; not deployed)"
  - "src/features/erp/parasut/api/write-client.ts (new), client.test.ts (updated confinement tests)"
  - "src/features/erp/parasut/components/CreateCustomerDialog.tsx(+test), ParasutListPage.tsx, pages/ContactListPage.tsx, pages/CustomersPage.tsx (frontend, not deployed)"
  - "src/test/setup.ts (added afterEach(cleanup) — repo-wide test-harness fix, see docs/LESSONS_LEARNED.md)"
  - "docs/migration-proposals/20260716130000_accounting_outbound_commands.sql + .rollback.sql (4 tables now)"
  - "docs/adr/ADR-001-read-write-provider-split-and-outbound-command-architecture.md (new)"
  - "docs/TECHNICAL_DEBT.md, docs/RISK_REGISTER.md, docs/LESSONS_LEARNED.md (new)"
  - "docs/ACCOUNTING_OUTBOUND_OPERATIONS_RUNBOOK.md (new)"
  - "BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md (rewritten), ACCOUNTING_PROVIDER_ARCHITECTURE.md, ERP_BUSINESS_ARCHITECTURE.md, PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md (updated)"
self_review_gate:
  duplicated_code: "No — reused syncContacts, ParaşütClient, TokenManager, company-scope.ts unchanged."
  violated_architecture: "No — followed §3.3 Write Rule exactly."
  could_be_simplified: "Per-capability boilerplate exists by design; tracked as TD-002, not fixed (isolation was the deliberate tradeoff)."
  reused_existing_code: "Yes — see duplicated_code."
  introduced_technical_debt: "TD-001 and TD-002 remain open (documented, deliberate). TD-003 and TD-004 are now CLOSED this pass — see docs/TECHNICAL_DEBT.md."
  future_providers_can_reuse: "Partially — CustomerWriteProvider/write-client pattern is reusable per-provider; the command-lifecycle machinery is not yet extracted into a shared runner (TD-002)."
  rollback_complete: "Yes — .rollback.sql covers all 4 tables in dependency order."
  tenant_isolation_preserved: "Yes — company_id scoping throughout; cross-tenant idempotency-key test added."
  security_preserved: "Yes — see security field above; R-002 wildcard risk caught and fixed this phase."
  n_plus_1_queries: "None introduced — single findOrCreateCommand + single upsert per command."
  unnecessary_api_calls: "None — one POST, one GET verify, one contacts-only sync per command."
  exposed_provider_logic_to_erp_services: "No — CreateCustomerCommandHandler depends only on abstract interfaces."
  wrote_directly_to_mirror_table: "No — mirror only ever updated via the existing, unmodified syncContacts()."
  left_production_verification_unproven: "Yes, deliberately — real Paraşüt write requires explicit authorization not yet given; documented as a blocker, not hidden."
  hidden_coupling: "No — every dependency is constructor-injected."
  migration_without_rollback: "No — rollback.sql validated and ready; the applied migration and its rollback are consistent."
  frontend_secret_added: "No — grep of dist/ confirmed clean this pass too."
  suppressed_failing_test: "No — the one deno-check failure found this pass (handlers.test.ts import depth) was fixed at its root cause, not skipped or excluded."
  blocker_incorrectly_marked_external: "No — frontend deployment is now complete. The remaining blocker (the real test customer requires a real authenticated admin session, which this agent does not have and correctly declined to obtain by browsing user records outside its authorized scope) is genuinely external, not an implementation gap."
```

### Completion Rule Applied

```yaml
phase_007: COMPLETE
phase_008: READY
blocker: none
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
---

# 20. AUTONOMOUS CONTINUATION RULE

Claude must continue implementing every task that does not require:
- irreversible production writes
- production database migration application
- production deployment
- unavailable external credentials
- mandatory human verification
- an external business decision that cannot be inferred safely

A phase must never be marked `PARTIAL` while implementation work remains that can be completed safely.

`PARTIAL` is allowed only when the remaining blocker is external and cannot be resolved from repository context, tests, documentation, migrations, connected tools, or existing architecture.

Before marking a phase `PARTIAL`, Claude must verify that all safely completable work has been finished, including code, tests, API contracts, frontend implementation, migration proposals, rollback proposals, documentation, security review, deployment preparation, and the production verification plan.

---

# 21. QUESTION BUDGET

The repository is the primary source of truth.

Claude must not ask implementation questions that can be answered by reading:
- source code
- migrations
- tests
- documentation
- phase reports
- git history
- existing conventions
- existing provider contracts
- existing deployment scripts

Questions are allowed only when:
- an external business rule is genuinely unknown
- an irreversible production action requires explicit authorization
- a required credential or permission is unavailable
- human-only visual verification is mandatory
- two business outcomes are equally valid and cannot be inferred safely

When a question is unavoidable, ask only the minimum necessary question.

---

# 22. ARCHITECTURE FREEZE AND VERSIONING

Every architecture modification must update:
- `architecture_version`
- affected modules
- backward-compatibility impact
- migration impact
- provider impact
- tenant-isolation impact
- rollback impact
- relevant documentation

Architecture changes must not be hidden inside feature work.

A change is architectural when it affects layer boundaries, provider contracts, repository contracts, database ownership, API ownership, command flow, authentication, authorization, tenant isolation, deployment topology, synchronization semantics, or outbound semantics.

---

# 23. ARCHITECTURE DECISION RECORDS

Major architectural decisions must create or update an ADR under:

`docs/adr/`

Naming convention:

`ADR-001-<short-title>.md`

Each ADR must include:
- status
- context
- decision
- alternatives considered
- consequences
- affected modules
- migration impact
- rollback impact
- provider impact
- tenant-isolation impact
- security impact
- date
- architecture version

---

# 24. DEFINITION OF DONE

A phase may be marked `COMPLETE` only when all applicable items are satisfied:
- implementation completed
- architecture rules preserved
- tenant isolation verified
- authorization verified
- RLS verified where relevant
- tests added and passed
- TypeScript passed
- Deno checks passed where relevant
- lint passed
- production build passed
- migration validated
- rollback validated
- deployment validated
- production verification completed
- documentation updated
- ADR updated where required
- technical debt recorded
- risks recorded
- lessons learned recorded
- phase system updated
- next phase status updated
- no secrets exposed
- no fabricated success claims

If an item is not applicable, the phase result must state why.

---

# 25. TECHNICAL DEBT REGISTER

Maintain:

`docs/TECHNICAL_DEBT.md`

Every phase must add or update entries for temporary workarounds, skipped refactors, known test gaps, performance issues, deployment issues, architecture compromises, provider limitations, data-quality limitations, and observability gaps.

Each item must include:
- ID
- title
- severity
- affected modules
- reason
- risk
- recommended fix
- target phase
- status

---

# 26. RISK REGISTER

Maintain:

`docs/RISK_REGISTER.md`

Every phase must evaluate:
- technical risks
- data risks
- security risks
- tenant-isolation risks
- provider risks
- deployment risks
- rollback risks
- operational risks
- accounting risks
- audit risks

Each risk must include:
- ID
- description
- likelihood
- impact
- mitigation
- owner
- status
- related phase

---

# 27. SELF-REVIEW GATE

Before completing any phase, Claude must perform a self-review:

- Did I duplicate code?
- Did I violate architecture?
- Can this be simplified?
- Did I reuse existing code?
- Did I introduce technical debt?
- Can future providers reuse this?
- Is rollback complete?
- Is tenant isolation preserved?
- Is security preserved?
- Did I add any N+1 query?
- Did I add unnecessary API calls?
- Did I expose provider-specific logic to ERP services?
- Did I write directly to a mirror table?
- Did I leave production verification unproven?
- Did I introduce hidden coupling?
- Did I create a migration without rollback?
- Did I add a frontend secret?
- Did I suppress any failing test?
- Did I incorrectly mark a blocker as external?

Any failed item must be fixed or recorded explicitly.

---

# 28. PERFORMANCE BUDGET

Do not introduce:
- N+1 queries
- unnecessary API requests
- unbounded list loading
- full-table scans without justification
- repeated mirror reads for the same request
- duplicate provider calls
- duplicate synchronization runs
- avoidable frontend recalculations
- large client-side aggregation when server-side aggregation is available

Required practices:
- server-side pagination
- deterministic sorting
- batching where safe
- cache reuse
- typed aggregation services
- provider traffic minimization
- explicit rate-limit handling
- bounded retries
- timeout handling
- observability for slow operations

---

# 29. LESSONS LEARNED

Maintain:

`docs/LESSONS_LEARNED.md`

Every phase must record:
- what worked
- what failed
- what was unexpectedly difficult
- provider-specific discoveries
- database discoveries
- deployment discoveries
- testing discoveries
- security discoveries
- what must not be repeated
- reusable patterns
- future improvements

Claude must read relevant lessons before starting a related phase.

---

# 30. FUTURE PHASE BACKLOG

Claude may add future phases when meaningful work is discovered.

Each new phase must include:
- unique ID
- title
- dependency
- reason
- production impact
- architecture impact
- acceptance criteria
- status

New phases must be added to the registry without deleting history.

---

# 31. PROJECT CONSTITUTION

The following rules are permanent unless superseded by a documented ADR and architecture-version change:

- UI language is Turkish.
- Source code, technical documentation, prompts, and internal identifiers are English unless existing conventions require otherwise.
- ERP architecture is provider-independent.
- `parasut.*` is a faithful mirror.
- Mirror tables never receive direct ERP-originated writes.
- All outbound writes go through provider contracts.
- All outbound writes require durable audit.
- All outbound writes require idempotency.
- Uncertain writes are never retried blindly.
- GET verification is mandatory after provider writes when supported.
- Mirror-back verification is mandatory.
- Tenant isolation is mandatory.
- RLS is mandatory for tenant-owned tables.
- Frontend-supplied company identifiers are never trusted.
- Service-role keys never enter frontend bundles.
- Provider secrets never enter database payloads or logs.
- Rollback is mandatory for production schema changes.
- Production success is never claimed without evidence.
- Browser verification is never claimed without browser evidence.
- Provider UI visibility is never claimed without visual evidence.
- Full deploy is forbidden unless explicitly authorized.
- Incremental deploy must verify changed files and zero errors.
- Existing architecture is reused before new abstractions are created.
- Duplicate implementations are forbidden.
- Technical debt, risks, and lessons learned must be maintained.
- Claude must update this file after every phase.

---

# 32. PHASE COMPLETION EVIDENCE TEMPLATE

Every phase execution result must include:

```yaml
phase_id:
phase_name:
status:
started_at:
completed_at:
architecture_version_before:
architecture_version_after:
production_modified:
migration_applied:
rollback_validated:
edge_function_deployed:
frontend_deployed:
provider_write_performed:
provider_resource_id:
provider_get_verification:
mirror_back_verification:
erp_ui_verification:
provider_ui_verification:
tests:
build:
lint:
deno:
typescript:
security:
tenant_isolation:
performance:
technical_debt_added:
risks_added:
lessons_learned_added:
adr_created_or_updated:
blockers:
files_changed:
next_phase:
```
