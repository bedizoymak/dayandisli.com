# Accounting Outbound Operations Runbook

Covers the bidirectional customer-creation write path (Phase 007). See `BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md` for the architecture and `docs/DAYANDISLI_PHASE_SYSTEM_V3.md` §8 for the phase spec this runbook implements.

## Preconditions before this feature can go live

1. ~~`docs/migration-proposals/20260716130000_accounting_outbound_commands.sql` reviewed and applied to production~~ — **done** (2026-07-16; canonical copy now at `supabase/migrations/20260716130000_accounting_outbound_commands.sql`; creates `accounting_outbound_commands`, `accounting_outbound_attempts`, `accounting_provider_links`, `accounting_audit_log`; `company_id` FK placeholder corrected at apply time, see `docs/RISK_REGISTER.md` R-005).
2. ~~`supabase/functions/parasut-write-api` deployed~~ — **done**, confirmed ACTIVE.
3. Environment variables present in the Edge Function's runtime: `SUPABASE_URL` ✅, `SUPABASE_ANON_KEY` ✅, `SUPABASE_SERVICE_ROLE_KEY` ✅, `ACCOUNTING_WRITE_ENABLED` ✅, and `PARASUT_CLIENT_ID`/`PARASUT_CLIENT_SECRET`/`PARASUT_USERNAME`/`PARASUT_PASSWORD`/`PARASUT_COMPANY_ID` ✅ — **all provisioned** (see `docs/TECHNICAL_DEBT.md` TD-004, closed).
4. `ACCOUNTING_WRITE_ENABLED=false` until the operator is ready — this is the kill switch; setting it to `false` at any time immediately disables all writes without a deploy (checked first in `assertCreateCustomerAllowed`, before the provider capability check). **Currently `false` in production** (deliberately closed pending frontend deployment — see blocker below).
5. Frontend deployed with the "Yeni Müşteri" button visible only to users for whom the server's `customer-create-availability` action reports `available: true` (not just client-side permission — see `ADR-001` addendum 2) — **blocked**: the established `scripts/deploy_ftp.py` incremental deploy requires `DAYAN_FTP_HOST`/`DAYAN_FTP_USER`/`DAYAN_FTP_PASS`, none of which are present in this environment.

## Turning the feature on

1. ~~Apply the migration.~~ Done.
2. ~~Deploy `parasut-write-api`.~~ Done (currently version 5, includes the TD-003 fix and the availability-guard action).
3. ~~Provision the five `PARASUT_*` secrets.~~ Done.
4. Deploy the frontend — **blocked on missing FTP credentials**, see precondition 5 above.
5. Set `ACCOUNTING_WRITE_ENABLED=true` — do this immediately before the one-time test, not before, and set it back to `false` immediately if the test does not cleanly succeed.
6. Grant `accounting.contacts.create` (and `accounting.outbound.view` for read access to the audit trail, if a dedicated admin UI is later built) to the specific admin user who will run the first production test.
7. Perform the one-time production verification test (see below) before opening access to any other user.

## Turning the feature off (incident response)

Set `ACCOUNTING_WRITE_ENABLED=false` in the Edge Function's environment and redeploy (or use the platform's env-var hot-reload if available). This is the fastest, least destructive way to stop all new customer-creation writes; it does not affect in-flight commands already in `sending`/`sent` state, which must be resolved manually (see "Handling `unknown_result`" below).

## Handling `unknown_result` commands

A command reaches `unknown_result` when:
- The Paraşüt API request timed out or the response was never received (`httpStatus: 0`) — the contact **may or may not** have been created.
- The GET verification step could not confirm the created contact.
- The contacts-only mirror sync did not find the record within its check window.

**Do not retry these automatically.** Operator procedure:
1. Query `accounting_outbound_commands` for the command row; note `provider_resource_id` if present (it is persisted immediately after a successful POST, before verification).
2. If `provider_resource_id` is present, manually check the Paraşüt web UI for a contact with that id.
   - If found and correct: manually mark the command `mirrored_back` (direct SQL update) and let the next scheduled `syncContacts()` pull it into the mirror normally.
   - If found but incorrect, or not found: escalate — do not attempt an automated fix.
3. If `provider_resource_id` is absent, the POST itself never got a confirmed response. Check the Paraşüt account for any newly created contact matching the command's `safePayload.name` around the command's `created_at` timestamp before concluding whether a duplicate exists.
4. Never issue a second `createCustomer` call reusing the same idempotency key expecting a different outcome — the command handler will just return the existing (`unknown_result`) record, not retry.

## Auditing

Every lifecycle transition is recorded in `accounting_audit_log` (`command_created`, `validated`, `sending`, `sent`, `verified_in_provider`, `mirrored_back`, `failed`, `unknown_result`, `idempotent_replay`), each tied to `command_id`, `company_id`, and `actor_user_id`. This table is append-only (`grant select, insert` only, no update/delete) — read access is gated behind `accounting.outbound.view`.

## Rollback

`docs/migration-proposals/20260716130000_accounting_outbound_commands.rollback.sql` drops all four tables in dependency order. Only run this if the feature is being fully decommissioned — it destroys the audit trail. Prefer the kill switch above for any incident that doesn't require removing the schema itself.

## Known limitations (see `docs/TECHNICAL_DEBT.md` for detail)

- `country`, `currency`, and `paymentTermDays` from `CreateCustomerInput` have no confirmed Paraşüt contact field and are silently dropped by the mapper.
- Only customer creation is supported — update/archive/delete are not implemented (Paraşüt capability flags for these are `false`).
- The command handler's idempotency guarantee under true concurrent submission relies on the database's unique constraint on `(company_id, provider, operation, idempotency_key)`; the in-memory test suite simulates but cannot fully replace a real concurrent-load test against the deployed function.
