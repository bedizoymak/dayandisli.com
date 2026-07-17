# ADR-001: Read/Write Provider Split and Durable Outbound Command Architecture

Status: Accepted — migration applied to production, Edge Function deployed
Date: 2026-07-16
Phase: 007 (Bidirectional Customer Creation MVP)

**Deployment addendum (2026-07-16):** at apply time, the `company_id` column's originally-proposed FK (`references public.erp_users(id)`) was found to be a stale placeholder never revisited before approval, and was removed to match this schema's established convention of an application-validated, non-FK `company_id` (confirmed via production `information_schema`/`pg_constraint` — no table in this schema enforces a `company_id` FK). See `docs/RISK_REGISTER.md` R-005 and `docs/LESSONS_LEARNED.md` for detail. This is the only change made to the schema between proposal and application.

**Addendum 2 (same day):** two gaps identified during the deployment pass were closed without changing this ADR's core decision: (1) `SupabaseCommandRepository.findOrCreateCommand` now catches a real `23505` unique-violation and re-reads the winning row, closing TD-003; (2) a new read-only `customer-create-availability` action was added to `parasut-write-api` (`handlers.ts`'s `computeCustomerCreateAvailability`) so the frontend's "Yeni Müşteri" visibility reflects the live server-side feature-flag/capability state, not just the client's cached permission — this performs no Paraşüt HTTP call and requires no `PARASUT_*` credential, consistent with this ADR's read/write separation principle (it is a read of ERP-side configuration state, not of Paraşüt).

## Context

Phase 006 established `AccountingProvider` as a single read-only interface implemented once per accounting system (`ParasutAccountingProvider`, plus six unimplemented skeletons). Phase 007 requires the first real write capability: creating a customer in Paraşüt from the ERP. Two designs were possible:

1. Add write methods directly onto `AccountingProvider`, making every provider (and every consumer typed against it) carry write capability whether or not it needs it.
2. Introduce a separate, narrow write contract that a consumer must be explicitly given, independent of read access.

Similarly, for the write itself, two designs were possible:
1. Call the provider synchronously from the ERP API request handler, returning the provider's raw result directly.
2. Persist a durable command record before calling the provider, so the outcome, retries, and audit trail survive a crash or timeout mid-request.

## Decision

- **Split the provider contract.** `CustomerWriteProvider` (`server/erp/providers/customer-write-provider.ts`) is a separate interface from `AccountingProvider`, granting exactly one capability (`createCustomer`). A consumer that only needs read access is never structurally able to call a write method, and vice versa — this is enforced by TypeScript's structural typing, not by convention.
- **Introduce a durable command lifecycle.** Every write request creates (or finds, via idempotency key) a row in `accounting_outbound_commands` before the provider is ever called, and progresses through an explicit state machine (`draft → validated → sending → sent → verified_in_provider → mirrored_back` / `failed` / `unknown_result`). Every transition is audited. A crash between "sent" and "verified" leaves a recoverable, inspectable row — never a silent gap.
- **A dedicated write client, isolated from the read client.** `server/parasut/write-client.ts` is the only code permitted to POST to `api.parasut.com`; it is a sibling to, not a modification of, the existing read-only `server/parasut/client.ts`.
- **A distinct `unknown_result` terminal state**, separate from both `failed` and `mirrored_back`, for any outcome where the provider's actual state cannot be confirmed (timeout, failed GET verification, failed mirror sync). This is the state most novel to this design — see Consequences.

## Consequences

- Positive: a service that only ever reads accounting data (the overwhelming majority of the codebase) cannot accidentally be given write access by a future refactor that widens `AccountingProvider`'s type — the compiler would reject it.
- Positive: `unknown_result` prevents two classes of bugs common to naive integrations — auto-retrying a request whose first attempt may have already succeeded (duplicate creation), and reporting success when verification never actually confirmed it.
- Cost: every new write capability requires its own narrow contract, own command-status enum values, and own repository wiring — more boilerplate per capability than a single generic "write" method would need. Accepted deliberately; see `docs/TECHNICAL_DEBT.md` for the tracked cost of this pattern as more write capabilities are added.
- Cost: a 4th table (`accounting_audit_log`) was required beyond the 3 explicitly named in the original phase spec, because the durable-audit requirement (Project Constitution, V3 §31) needs an append-only event log distinct from the HTTP-level `accounting_outbound_attempts` table. Tracked as a deliberate, documented deviation, not an oversight.

## Alternatives considered

- **Generic `write(operation, payload)` method on `AccountingProvider`**: rejected — would require every consumer typed against the full provider to be trusted with arbitrary write operations, and would make capability-based permission checks (`capabilities.contacts.create`) meaningless since the method itself wouldn't be capability-scoped.
- **Synchronous call with no durable command row**: rejected — a request that times out mid-flight would leave no record of whether Paraşüt actually created the contact, which is exactly the ambiguity `unknown_result` exists to make visible and auditable instead of silently lost.
