# Bidirectional Customer Creation Architecture (Phase 007)

Status: **Code-complete end-to-end (backend write path, ERP API, ERP frontend) and unit-tested, including the idempotency-race fix (TD-003, closed) and the server-backed UI availability guard. Migration APPLIED to production. Edge Function DEPLOYED and ACTIVE (v5) with all 5 `PARASUT_*` secrets provisioned (TD-004, closed). `ACCOUNTING_WRITE_ENABLED=false` (deliberately closed pending frontend deployment). Frontend NOT yet deployed — blocked on missing FTP deploy credentials in this environment. No real production write performed.** See `docs/DAYANDISLI_PHASE_SYSTEM_V3.md` §8/§32 for the authoritative execution result and blockers.

## What this phase builds

The first real bidirectional accounting feature — creating a customer from the ERP that becomes a real Paraşüt contact — following the permanent write path defined in `docs/DAYANDISLI_PHASE_SYSTEM_V3.md` §3.3:

```
ERP UI → ERP API → Command Handler → Durable Outbound Command → AccountingProvider Write Contract
  → Provider Write Client → Provider API → GET Verification → Provider-Specific Sync → Mirror → ERP UI
```

## Components

| Layer | File | Purpose |
|---|---|---|
| Write contract | `server/erp/providers/customer-write-provider.ts` | `CustomerWriteProvider`, `ProviderWriteContext`, `CreateCustomerInput`, `CreateCustomerProviderResult`, `ProviderWriteError` — provider-neutral, exact field names per §8.4. |
| Dedicated Paraşüt write client | `server/parasut/write-client.ts` | `ParasutContactWriteHttpClient` — the ONLY code allowed to POST to `api.parasut.com`. One method (`createContact`), hardcoded `/contacts` endpoint, 15s timeout via `AbortController`, no retry. `isKnownOutcomeError()` distinguishes a real HTTP response (any status, incl. 429/500) from a timeout/no-response (`httpStatus: 0`). |
| Paraşüt write provider | `server/erp/providers/parasut-customer-write-provider.ts` | Maps `CreateCustomerInput` → confirmed Paraşüt attributes (`short_name`, `account_type` always hardcoded `"customer"`); `country`/`currency`/`paymentTermDays` have no confirmed Paraşüt field and are silently dropped (documented in `docs/TECHNICAL_DEBT.md`). |
| GET verifier | `server/erp/providers/parasut-contact-verifier.ts` | `ParasutContactVerifier` — read-only, reuses the existing GET client contract; verifies id/type/account_type/name per §8.14; never throws. |
| Contacts-only sync adapter | `server/erp/providers/parasut-contacts-only-sync.ts` | `ParasutContactsOnlySync` — wraps the existing, unmodified `syncContacts()` (`server/parasut/sync-contacts.ts`), never a full sync. |
| Command handler | `server/erp/commands/create-customer-command.ts` | `CreateCustomerCommandHandler` — full lifecycle `draft → validated → sending → sent → verified_in_provider → mirrored_back` / `failed` / `unknown_result`; idempotency-key dedup via `findOrCreateCommand`; attempt logging; provider-link upsert; full audit trail. |
| Provider capability model | `server/erp/providers/accounting-provider.ts` | `ProviderCapabilities.contacts` is `{read, create, update, archive, delete}`. Paraşüt reports `{read:true, create:true, update:false, archive:false, delete:false}`. All skeleton providers report all-false. |
| Repositories (Supabase) | `supabase/functions/_shared/accounting-outbound-repository.ts` | `SupabaseCommandRepository`, `SupabaseAttemptRepository`, `SupabaseProviderLinkRepository`, `SupabaseAuditRepository` — real implementations of the four repository ports the command handler depends on. |
| Edge Function (write) | `supabase/functions/parasut-write-api/{index.ts,handlers.ts}` | The only write-capable Edge Function. `handlers.ts` is platform-agnostic and unit-tested directly with Vitest; `index.ts` is the thin Deno composition root (auth, permission check, capability/feature-flag guard, DI wiring). **Not deployed** — see Deployment Status below. |
| Frontend write client | `src/features/erp/parasut/api/write-client.ts` | `callParasutWriteApi()` — the only client-side path to `parasut-write-api`, structurally proven (via `client.test.ts`) never to call the read-only `parasut-api` function. |
| Frontend dialog | `src/features/erp/parasut/components/CreateCustomerDialog.tsx` | Permission-gated (`accounting.contacts.create`), full form, mandatory confirmation checkbox with the exact required Turkish text, one `idempotencyKey` generated per dialog session and reused on retry, distinct UI states for success / unknown-result / partial / error. |
| Migration proposal | `docs/migration-proposals/20260716130000_accounting_outbound_commands.sql` (+ `.rollback.sql`) | **4 tables**: `accounting_outbound_commands`, `accounting_outbound_attempts`, `accounting_provider_links`, and `accounting_audit_log` (append-only lifecycle event log backing `AuditRepository` — added beyond §8.6's 3-table list because the durable-audit requirement in §31 needs a dedicated table distinct from HTTP-level "attempts"). Drafted, **not applied**. |
| Write-contract discovery | `PARASUT_WRITE_API_DISCOVERY_REPORT.md` | Confirmed against Paraşüt's own published OpenAPI spec — no POST sent during discovery. |

## Command lifecycle (implemented exactly)

```
findOrCreateCommand (idempotency dedup on company+provider+operation+key; DB unique constraint is the real concurrency guard)
  → command_created (audit)
  → validated (or failed, if input invalid)
  → sending
  → provider.createCustomer() called
      ├─ success → sent (provider_resource_id persisted immediately)
      │     → verifier.verifyContact() [GET]
      │         ├─ verified → verified_in_provider
      │         │     → contactsSync.syncAndCheck() [contacts-only GET sync + mirror lookup]
      │         │         ├─ found → provider link upserted → mirrored_back
      │         │         └─ not found → unknown_result (mirror_status: pending)
      │         └─ not verified → unknown_result (verification_status: failed)
      ├─ validation/config error (4xx with a response) → failed
      └─ unknown outcome (timeout/no response, httpStatus 0) → unknown_result (never "failed", never retried automatically)
```

Repeating the same idempotency key returns the existing command unchanged and records an `idempotent_replay` audit event — the write provider is never called a second time. Under genuine concurrent submission (two simultaneous requests, same key), only one call to the write provider is expected to win; see the concurrency test in `server/erp/commands/create-customer-command.test.ts`.

## Permission model

`accounting.contacts.create` and `accounting.outbound.view` are permission-catalog entries in `src/features/erp/shared/permissions.ts`. Both are explicitly excluded from the `finance` role's wildcard `accounting.*` prefix match (`OUTBOUND_WRITE_ONLY_PERMISSIONS`) — granted only to `admin`, `system.manage`, or an explicit per-user grant. See `src/features/erp/parasut/permissionMatrix.test.ts` for the regression coverage (finance denied, admin granted, explicit grant granted, every other role denied).

## Deployment status

Per the Production Policy in `docs/DAYANDISLI_PHASE_SYSTEM_V3.md`, each irreversible step below was performed only after explicit, in-conversation authorization:

1. ~~Applying `20260716130000_accounting_outbound_commands.sql` to production~~ — **done**, with a real FK defect (placeholder pointing `company_id` at `erp_users(id)`) found and corrected before applying; see `docs/RISK_REGISTER.md` R-005.
2. ~~Deploying `parasut-write-api`~~ — **done**, confirmed ACTIVE, now version 5 (includes the TD-003 idempotency-race fix and the availability-guard action).
3. ~~Provisioning `PARASUT_CLIENT_ID`/`PARASUT_CLIENT_SECRET`/`PARASUT_USERNAME`/`PARASUT_PASSWORD`/`PARASUT_COMPANY_ID` as `parasut-write-api` Edge Function secrets~~ — **done**, via a restricted temp env file deleted immediately after use; see `docs/TECHNICAL_DEBT.md` TD-004 (closed).
4. Setting `ACCOUNTING_WRITE_ENABLED=true` — **deliberately deferred**, kept `false` until immediately before the one controlled test, per the operations runbook.
5. Deploying the frontend (`CreateCustomerDialog`, `CustomersPage` changes) — **blocked**: the established `scripts/deploy_ftp.py` incremental deploy requires `DAYAN_FTP_HOST`/`DAYAN_FTP_USER`/`DAYAN_FTP_PASS`, none of which exist in this environment (`.env`, `.env.local`, or the shell).
6. Creating the one real, permanent "ERP WRITE TEST CUSTOMER 001" contact in the customer's live production Paraşüt account (§8.18) and visually confirming it in the Paraşüt web UI — **not yet performed**, blocked on step 5.

All code, tests, migration, rollback plan, and documentation required to complete the remaining steps safely are in place — see `docs/DAYANDISLI_PHASE_SYSTEM_V3.md` for the phase completion evidence and the production verification plan.

## Security properties verified

- No ERP Service imports the write path (`grep` re-confirmed this pass).
- `redactForAudit()` (`server/erp/commands/audit-trail.ts`) tested against literal Bearer-token and `sb_secret_` patterns, plus any object key that looks credential-shaped.
- `ParasutCustomerWriteProvider`/`ParasutContactWriteHttpClient` never return the raw Paraşüt response to a caller — only the provider-neutral `CreateCustomerProviderResult` shape.
- `account_type` is hardcoded to `"customer"` in the mapper — never taken from caller input, so this write path cannot be used to create a supplier.
- No secret string found in `dist/` after a production build (re-confirmed this pass via `grep -rI "SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_" dist/`).
- `parasut-api` (read-only function) re-confirmed to never import the write client or mention write-path symbols (`client.test.ts`).
