# Accounting Provider Architecture

Status: **Architecture only** — the `AccountingProvider` contract, one working adapter (`ParasutAccountingProvider`, itself still awaiting a real Supabase-backed mirror repository — see `ERP_BUSINESS_ARCHITECTURE.md` "Remaining Work"), six unimplemented provider skeletons, and a registry all exist and are unit-tested. No live database code was added, `parasut.*` and the sync engine are untouched, and nothing writes back to any accounting system.

**Update — Phase 007 complete end-to-end (see `docs/DAYANDISLI_PHASE_SYSTEM_V3.md` and `BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md` for the authoritative, current version of this work):** the write path now includes a working ERP API (`supabase/functions/parasut-write-api`) and ERP frontend (`CreateCustomerDialog`), a 4-table migration proposal (adding `accounting_audit_log` to the 3 tables below), and a full test matrix (permission/tenant/feature-flag/timeout/429/500/concurrency). Nothing has been deployed or applied to production. Superseded detail: `ProviderCapabilities.contacts` is now `{read, create, update, archive, delete}` instead of a flat boolean — Paraşüt reports `{read:true, create:true, update:false, archive:false, delete:false}`. `CustomerWriteProvider`'s field names were finalized to `docs/DAYANDISLI_PHASE_SYSTEM.md` §8.4 exactly (`ProviderWriteContext` now carries `providerCompanyId`/`requestedByUserId`/`idempotencyKey`/`commandId`; `CreateCustomerProviderResult` is provider-neutral with no raw payload). The write client moved to `server/parasut/write-client.ts` (sibling to the existing read-only client, not under `server/erp/`). Superseded text below, retained for history:

**Update — Bidirectional Customer Creation MVP (write path, code-complete, not yet executed):** `AccountingProvider` is now split into a zero-mutation `AccountingReadProvider` plus a separate, narrowly-scoped `CustomerWriteProvider` contract (`server/erp/providers/customer-write-provider.ts`) that grants exactly one capability — creating a customer — and nothing else. The full write path is built and unit-tested end to end: `ParasutContactWriteHttpClient` (real HTTP POST client, built strictly against Paraşüt's own published OpenAPI contract — see `PARASUT_WRITE_API_DISCOVERY_REPORT.md` — never against inferred field names), `ParasutCustomerWriteProvider` (maps ERP input onto it, `account_type` always hardcoded to `"customer"`, never caller-controlled), and `CreateCustomerCommandHandler` (`server/erp/commands/create-customer-command.ts`, durable command lifecycle `validated → submitted → provider_accepted → awaiting_mirror → mirrored_back`/`failed`, with a full audit trail at every transition, redacted through `redactForAudit()`). **No real POST has been sent to Paraşüt** — every test uses a fake HTTP client. A migration proposal for the durable `public.erp_outbound_commands`/`public.erp_audit_log` tables exists at `docs/migration-proposals/20260716120000_erp_outbound_commands.sql`, unapplied. The handler is structurally incapable of writing to `parasut.contacts` — `confirmMirrored()` only ever flips a command's own status, gated on a real contacts-only GET sync separately confirming the row exists in the mirror; there is no mirror-table dependency anywhere in its constructor.

## Why this exists

`ERP_BUSINESS_ARCHITECTURE.md` established that ERP Services must never read `parasut.*` directly. That alone doesn't guarantee the ERP is accounting-software-agnostic — a service could still be written assuming *Paraşüt's specific* data shape even while going through a repository interface. This phase closes that gap: every ERP Service now depends on exactly one shared contract, `AccountingProvider`, and nothing else. Swapping the accounting system a company uses becomes "register a different provider," not "rewrite the business logic."

## Architecture

```
ERP UI                          (React — unchanged, not touched this phase)
    ↓
ERP API                         (not built yet — future phase)
    ↓
ERP Services                    (CustomerService, SupplierService, ProductService, FinanceService, AnalyticsService)
    ↓
AccountingProvider               (server/erp/providers/accounting-provider.ts — the ONLY type a service imports)
    ↓
Provider Implementation          (ParasutAccountingProvider today; LogoAccountingProvider etc. are skeletons)
    ↓
Mirror Repository                (ParasutMirrorRepository — the "existing ERP repositories" composed into one port; no real implementation yet)
    ↓
Provider Mirror                  (parasut.* — untouched, permanently read-only, per ERP_BUSINESS_ARCHITECTURE.md)
```

**Non-negotiable rules** (enforced this phase, see "Validation" below):

1. No ERP Service imports a concrete provider module (`parasut-accounting-provider.ts`, `logo-accounting-provider.ts`, etc.) — only `accounting-provider.ts`, the contract.
2. No provider file imports React, JSX/TSX, or anything under `src/`.
3. No circular dependencies anywhere in `server/erp/` (verified with `madge --circular`).
4. Providers never write to their underlying accounting system. `AccountingProvider` has zero mutation methods — by construction, not by convention (there is no `save`/`update`/`create` method to accidentally call).
5. AI features call ERP Services only, never a provider directly (see "AI Layer" below) — same reasoning as rule 1, one level up.

## The Provider Contract

`server/erp/providers/accounting-provider.ts` defines `AccountingProvider`, composed of:

- **Metadata & lifecycle** (never throws): `getMetadata()` (`{ id, name, version }`), `getCapabilities()` (which of the 9 resource families this provider supports), `getHealthStatus()` (async; a provider ping, never leaks a raw error/stack trace through the returned `message`).
- **Resource access**: `getAccounts`, `getCustomerProfile`/`getCustomerInvoices`/`getCustomerPayments`, `getSupplierProfile`/`getSupplierBills`/`getSupplierPayments`, `getProduct`/`getProductSalesLineItems`/`getProductPurchaseLineItems`, `getAllReceivableDocuments`/`getAllPayableDocuments` (company-wide, for `FinanceService`).
- **Provider-level snapshots**: `getDashboardSnapshot()`, `getReportsSnapshot()`, `getSyncStatus()` — deliberately raw/minimal, distinct from `AnalyticsService`'s computed `FinanceDashboardResult`. A provider exposes what the underlying accounting system itself considers its dashboard/sync state; turning that into ERP business intelligence is the Services layer's job, not the provider's.

Every method signature uses the ERP's own domain types (`CustomerProfile`, `MirrorDocument`, `MirrorPayment`, etc. — all in `server/erp/types.ts`), never a provider-specific shape. `CustomerProfile`/`SupplierProfile`/`ProductProfile` live in `types.ts` specifically so neither the provider contract nor any service file has to import from another service file to get them — that avoided a real circular-dependency bug caught during this phase (see "What went wrong and got fixed" below).

### Why `getCustomerProfile` and `getSupplierProfile` are separate methods

Paraşüt's `contacts` mirror has a single `account_type` field taking exactly one of two values — confirmed against all 435 real production contacts (162 `customer`, 273 `supplier`, zero `both`, zero unknown; see `PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md` §25). It would have been possible to define one `getContact(id)` method instead of two, but `CustomerService` and `SupplierService` originally both needed a method they each called `getContact` with *different* return types (`CustomerProfile` vs `SupplierProfile`) — merging those into one interface member is a real TypeScript signature conflict, not just a style question. Splitting them into `getCustomerProfile`/`getSupplierProfile` is the correct fix and also makes the contract self-documenting: a future provider without Paraşüt's "always exactly one role" guarantee can implement both methods however its own data model requires, without the ERP layer needing to change.

## Provider Adapter: `ParasutAccountingProvider`

`server/erp/providers/parasut-accounting-provider.ts` implements `AccountingProvider` in full. Per this phase's explicit instruction, it "internally consumes the existing ERP repositories" — concretely, it takes one constructor-injected `ParasutMirrorRepository` (a single port composing the same resource-family methods `CustomerService`/`SupplierService`/`ProductService`/`FinanceService` already needed) and every `AccountingProvider` method is a 1:1 delegation to it. `getHealthStatus()` additionally calls the repository's `ping()` and converts any exception into a generic, safe message — never surfacing the underlying error (which could contain a connection string, internal hostname, or similar) through the public contract; this is tested explicitly (`parasut-accounting-provider.test.ts` asserts a thrown error containing `"password="` never reaches the returned health message).

**`ParasutMirrorRepository` has no real implementation yet.** Every test constructs an in-memory fake satisfying the interface. The real, Supabase-backed implementation (querying `parasut.*` via `scopedParasutTable`, exactly like `supabase/functions/parasut-api/handlers.ts` already does) is deferred — see "Remaining Work".

## Future Providers (skeletons only, per instruction)

`server/erp/providers/unimplemented-accounting-provider.ts` defines `UnimplementedAccountingProvider`, an abstract base every skeleton extends. Every data-access method **returns a rejected `Promise` with a typed `ProviderNotImplementedError`** — never empty arrays, never `null` presented as "no data," because a caller must be able to tell "this provider isn't built yet" apart from "this company genuinely has zero accounts." `getCapabilities()` reports every capability as `false`; `getHealthStatus()` reports `healthy: false` without throwing (metadata/lifecycle methods are intentionally exception-free, per the contract's own doc comments).

Six one-file skeletons extend it, each ~10 lines, each only setting its own `{ id, name, version }`:

| File | Class | Provider id |
|---|---|---|
| `logo-accounting-provider.ts` | `LogoAccountingProvider` | `logo` |
| `mikro-accounting-provider.ts` | `MikroAccountingProvider` | `mikro` |
| `netsis-accounting-provider.ts` | `NetsisAccountingProvider` | `netsis` |
| `sap-business-one-accounting-provider.ts` | `SAPBusinessOneAccountingProvider` | `sap_business_one` |
| `luca-accounting-provider.ts` | `LucaAccountingProvider` | `luca` |
| `eta-accounting-provider.ts` | `ETAAccountingProvider` | `eta` |

None of these were implemented, per instruction — they exist to prove the contract is genuinely provider-agnostic (a fresh provider needs zero ERP Service changes to slot in) and to give the registry something real to register in tests.

## Provider Registration & Resolution

`server/erp/providers/accounting-provider-registry.ts` — `AccountingProviderRegistry`:

- `register(provider)` — keyed by the provider's own `getMetadata().id`.
- `resolve(providerId)` — throws a typed `UnknownProviderError` rather than returning `undefined`; a caller resolving "the active provider for this tenant" must never silently end up with no provider at all.
- `has(providerId)`, `listMetadata()`, `getCapabilities(providerId)`.

The registry is the *only* place in the ERP business layer allowed to hold references to multiple concrete providers simultaneously. ERP Services never see it — by the time a service is constructed, it already has one resolved `AccountingProvider` injected. Wiring "read `company_settings.active_accounting_provider`, resolve it from the registry, construct the services" is composition-root code that belongs in the future ERP API layer, not in this phase.

## Tenant Settings (architecture only — no migration, no table)

`server/erp/providers/company-settings.ts` defines the target shape only:

```ts
interface CompanySettings {
  companyId: string;
  activeAccountingProvider: string;   // must match a registered ProviderMetadata.id
  providerConfig: Record<string, unknown>; // non-secret operational config ONLY
  featureFlags: Record<string, boolean>;
  updatedAt: string;
}
```

**Hard rule, stated in the file's own doc comment**: `providerConfig` must never hold a credential. API keys/OAuth tokens/passwords stay in environment variables or a secrets manager — exactly like `PARASUT_CLIENT_SECRET` does today — never in a queryable table. When this becomes a real `public.company_settings` table in a later phase, the draft migration goes under `docs/migration-proposals/` first, per this repo's established migration-safety convention (`ERP_BUSINESS_ARCHITECTURE.md`, `PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md` §14b) — never written directly into `supabase/migrations/` without explicit approval.

Also defined: `EffectiveProviderCapabilities` — the intersection of what a provider can actually do (`ProviderCapabilities`, self-reported) and what a tenant has chosen to enable (`featureFlags`). Neither alone is sufficient: a capability the provider doesn't support must never be shown regardless of feature flags, and a flag can turn off a supported capability for a specific tenant.

## ERP Service Refactoring

Every service's constructor now accepts a narrow, structurally-typed slice of `AccountingProvider` (e.g. `CustomerRepository = Pick<AccountingProvider, "getCustomerProfile" | "getCustomerInvoices" | "getCustomerPayments">`), rather than the full 15-method interface. This is the Interface Segregation Principle applied deliberately: a real `ParasutAccountingProvider` (or any future provider) satisfies every one of these narrow types automatically because it implements the full `AccountingProvider`, so **at runtime, all five services can and should share one injected provider instance** — but at compile time and in tests, each service only has to declare (and each test only has to fake) the 3-4 methods it actually uses. No behavior changed; only the dependency's declared type did. `AnalyticsService` additionally gained a real constructor dependency it didn't have before (`FinanceRepository`, i.e. an `AccountingProvider` slice) and a new async `getDashboard(now)` method that fetches fresh data itself; its previous pure `buildDashboard(financeSummary, now)` compositor is kept as a standalone exported function for cases where a `FinanceSummary` is already available (e.g. from a future cache).

## AI Layer

Unchanged in principle from `ERP_BUSINESS_ARCHITECTURE.md`, now provider-explicit:

```
LLM  →  ERP Services  →  AccountingProvider  →  Mirror Repository  →  Provider Mirror
```

An AI feature calling `CustomerService.getAnalytics(id)` gets identical typed output (`CustomerAnalyticsResult`) regardless of which accounting system is active behind the scenes — it never needs to know, and must never be given a provider reference directly.

## Validation

Confirmed this phase, mechanically (not just by inspection):

| Check | Method | Result |
|---|---|---|
| No ERP Service imports a concrete/provider-specific module | `grep` for provider filenames under `server/erp/services/` | 0 matches — services only import `accounting-provider.ts` |
| No provider imports React/JSX/TSX/`src/` | `grep` for `react`/`@/`/`useState`/etc. under `server/erp/` | 0 matches |
| No circular dependencies | `npx madge --circular --extensions ts server/erp` | **Found 3, fixed, re-verified 0.** See below. |
| No provider-specific logic inside ERP Services | Code review — every service function operates on `MirrorDocument`/`MirrorPayment`/etc., never a Paraşüt attribute key | Confirmed |
| Type/compile safety | `deno check` (all 23 new/changed files) + `tsc --noEmit` | Both clean |
| Behavior | `vitest run` | 476/476 passing repo-wide (80 in `server/erp/`) |

### What went wrong and got fixed

`madge` caught a real circular dependency this phase introduced and would otherwise have shipped: `accounting-provider.ts` initially imported `CustomerProfile`/`SupplierProfile`/`ProductProfile` *from the service files* (`customer-service.ts` etc.), while those same service files import `AccountingProvider` back from `accounting-provider.ts` — a genuine cycle. Fixed by moving those three profile types into the shared `types.ts` (which nothing service-specific depends on upward), so both the contract and the services depend downward on it without depending on each other. This is exactly the kind of mistake a stated "no circular dependencies" rule exists to catch — it was caught by tooling, not assumed away.

A second real bug, caught by the skeleton providers' own tests: `UnimplementedAccountingProvider`'s capability methods originally `throw`ed synchronously instead of returning a rejected `Promise`, so `await expect(provider.getAccounts()).rejects.toBeInstanceOf(...)` failed — the exception escaped before the `Promise`-based assertion could catch it. Every `AccountingProvider` method is declared `async`/`Promise`-returning; a synchronous throw breaks that contract for any caller using `.catch()` or `try { await ... }`. Fixed by returning `Promise.reject(...)` instead.

## Remaining Work

1. **Real `ParasutMirrorRepository` implementation.** Supabase-backed, querying `parasut.*` through the same `scopedParasutTable`/tenant-isolation pattern already proven in `supabase/functions/parasut-api/handlers.ts`. Still blocked on the same unresolved `sales_invoice_details`/`purchase_bill_details` field-mapping question noted in `ERP_BUSINESS_ARCHITECTURE.md`.
2. **`public.company_settings` migration** — draft under `docs/migration-proposals/` first; no secrets, ever.
3. **Composition root** — the future ERP API's startup code that reads `company_settings.active_accounting_provider`, resolves it via `AccountingProviderRegistry`, and constructs the five ERP Services with that one provider instance.
4. **ERP API endpoints** (`GET /erp/customer/:id`, etc.) — per `ERP_BUSINESS_ARCHITECTURE.md`, still not built.
5. **Migration strategy for switching providers** — out of scope to design in detail until a second real provider exists; the contract makes it *possible*, but the actual "move company X from Paraşüt to Logo" data-migration playbook is future work once there's a second implemented provider to migrate to.
6. **Tenant-isolation integration tests** once a real repository exists — proving `ParasutAccountingProvider` never returns another company's data, mirroring the rigor already established in `handlers.test.ts`.

## Migration Strategy (preview, not designed in full)

Switching a company's active provider will eventually mean: (a) the new provider must independently sync into its own mirror (no bidirectional data flow between providers, ever), (b) `company_settings.active_accounting_provider` flips once the new mirror is verified populated and healthy (`getHealthStatus()`), (c) ERP Services immediately start reading from the new provider on the next request — no code change, no redeploy, because they only ever depended on the `AccountingProvider` contract. What this phase does NOT define: historical-data reconciliation between two providers' mirrors, or how `public.*` ERP-owned data (notes, tags, scores) that references old-provider ids should be re-linked. Both are real problems for whenever a second provider actually gets implemented, not invented speculatively here.
