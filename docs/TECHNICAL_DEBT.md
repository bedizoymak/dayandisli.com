# Technical Debt Register

Tracks known, deliberate gaps — not bugs. Each entry states what's missing, why it was accepted, and what would need to happen to close it.

## TD-001: Dropped fields in `CreateCustomerInput` → Paraşüt mapping

`country`, `currency`, and `paymentTermDays` are accepted by the ERP's `CreateCustomerInput` (§8.4) but have no confirmed field in Paraşüt's `contacts` write contract per `PARASUT_WRITE_API_DISCOVERY_REPORT.md`. `server/erp/providers/parasut-customer-write-provider.ts`'s mapper silently drops them rather than guessing an unconfirmed field name.

**Why accepted:** guessing a field name and sending it would risk either a rejected request or, worse, being silently accepted into the wrong field. Confirmed-contract-only was an explicit constraint carried over from the write-API discovery phase.

**Closing it:** re-run discovery against Paraşüt's live sandbox (not just the published OpenAPI spec) to confirm whether these fields exist under different names (e.g. `currency` might map to `contact_currency` or similar), or confirm they genuinely have no equivalent and remove them from `CreateCustomerInput` instead.

## TD-002: Per-capability boilerplate for each new write operation

Per [[ADR-001-read-write-provider-split-and-outbound-command-architecture]], each write capability (so far: `createCustomer`) requires its own provider interface, its own command-status semantics, and its own repository wiring. This is intentional isolation, not accidental duplication, but it means a future "update customer" or "create invoice" capability cannot reuse the `CreateCustomerCommandHandler` machinery directly — it needs its own handler following the same pattern.

**Why accepted:** the isolation benefit (a consumer can never be handed broader write access than it needs) was judged worth the duplication cost at this scale (one capability so far).

**Closing it:** if a third or fourth write capability is added, consider extracting the common lifecycle-state-machine logic (the `draft → validated → sending → sent → verified → mirrored/failed/unknown` progression, audit recording, idempotency lookup) into a shared generic command runner parameterized by the capability-specific provider call and verification step — without collapsing the capability-scoped provider interfaces themselves.

## TD-003: Concurrency safety relies on an unapplied database constraint (CLOSED)

**Resolution:** `SupabaseCommandRepository.findOrCreateCommand` (`supabase/functions/_shared/accounting-outbound-repository.ts`) now catches a `23505` unique-violation on insert and re-reads the winning row by `(company_id, provider, operation, idempotency_key)`, returning it with `wasCreated: false` instead of surfacing the raw Postgres error. If the winning row cannot be found (an edge case, e.g. the winner's transaction later rolled back), it throws a generic `OutboundRepositoryError` rather than a phantom record or the raw database message. Covered by 5 focused tests: normal first insert, repeated-key lookup, simulated `23505` re-read, an unfindable-winner safe-failure case, and an end-to-end test through `CreateCustomerCommandHandler` proving the write provider is never called more than once. The live production unique constraint was confirmed via `pg_constraint` before this fix (see the migration application record) — this closes the debt now that both halves (constraint + repository handling) exist.

## TD-004: `parasut-write-api` deployed — Paraşüt credentials now provisioned (CLOSED)

**Resolution:** with explicit authorization, `PARASUT_CLIENT_ID`/`PARASUT_CLIENT_SECRET`/`PARASUT_USERNAME`/`PARASUT_PASSWORD`/`PARASUT_COMPANY_ID` were provisioned as `parasut-write-api` Edge Function secrets via `supabase secrets set --env-file <restricted-temp-file>`, where the temp file contained only these five lines (grep-filtered from the existing local `.env`), was written with restricted permissions, and was deleted immediately after the command completed. Verified via `supabase secrets list` (names only, values never read back) that exactly these five names are now present alongside the pre-existing `SUPABASE_*` keys — no `VITE_*` values were pushed, no `SUPABASE_*` secret was modified. `PARASUT_COMPANY_ID` was confirmed to equal `666034` before provisioning, without ever printing the value (`grep -q "^PARASUT_COMPANY_ID=666034$" .env`).

This closes the original gap: `parasut-write-api` can now authenticate to Paraşüt. Retained here as a historical record of a real deployment gap that was found and closed correctly, not skipped.
