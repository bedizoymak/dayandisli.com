# Risk Register

Risks tracked at the project level. Each entry: risk, likelihood/impact, mitigation, owner of the mitigation.

## R-001: Duplicate customer creation in Paraşüt from a retried/ambiguous request

**Risk:** a request that times out or whose response is lost could be resubmitted by a user or a client-side retry, creating two contacts for the same intended customer.

**Likelihood:** Medium (network conditions, user impatience clicking twice). **Impact:** Medium (a duplicate contact is a real, visible record in the customer's live Paraşüt account requiring manual cleanup).

**Mitigation:** idempotency-key deduplication at the command-repository level (`findOrCreateCommand`), a stable per-dialog-session idempotency key on the frontend that is never regenerated on retry (`CreateCustomerDialog.tsx`), and an explicit `unknown_result` state that blocks automatic retry and requires operator review rather than resubmission. See [[TD-003-concurrency]] for the remaining gap in real-database concurrent-request handling.

**Owner:** whoever operates the feature post-deployment; see `docs/ACCOUNTING_OUTBOUND_OPERATIONS_RUNBOOK.md` "Handling unknown_result commands."

## R-002: Permission wildcard silently grants write access to an unintended role

**Risk:** `financePermissions`'s `startsWith("accounting.")` filter would have silently granted `accounting.contacts.create` to the finance role the moment that permission string was added to the catalog, without any code change to the filter itself — a "grant by naming convention" trap.

**Likelihood:** Was realized during this phase (caught before shipping, not after). **Impact:** would have been High — finance users creating real Paraşüt contacts without the explicit authorization the phase spec requires.

**Mitigation:** `OUTBOUND_WRITE_ONLY_PERMISSIONS` explicit exclusion list in `src/features/erp/shared/permissions.ts`, with regression tests in `permissionMatrix.test.ts` asserting finance is denied both new permissions. **Residual risk:** any *future* permission string added to the catalog that happens to start with `accounting.` but is not meant for finance will have the same silent-grant problem unless the developer remembers to check this filter — this is a recurring category of risk, not fully closed by fixing today's instance.

**Owner:** any future author of a new `accounting.*` permission string must check `financePermissions`'s filter logic before assuming a wildcard match is safe.

## R-003: Real production Paraşüt write before authorization

**Risk:** the entire point of the Production Policy is to prevent an irreversible real-world action (creating a real customer record) from happening without explicit user sign-off in conversation.

**Likelihood:** Low, given the policy is followed. **Impact:** High if violated (a real, permanent record in a live third-party system, potentially confusing the customer's actual bookkeeping).

**Mitigation:** the write path is fully built but nothing is deployed; `ACCOUNTING_WRITE_ENABLED` defaults to requiring explicit configuration; every doc in this phase states the deployment/migration/test-customer steps as pending explicit authorization, not as completed work.

**Owner:** the user, who must explicitly authorize deployment, migration application, and the one production test customer.

## R-005: Placeholder foreign key would have shipped an incorrect constraint to production

**Risk:** `docs/migration-proposals/20260716130000_accounting_outbound_commands.sql` originally contained `company_id uuid not null references public.erp_users(id) on delete restrict` with an inline comment `-- placeholder FK target; adjust to the real company/tenant table at approval time`. This placeholder was never revisited before the migration was applied, and pointed `company_id` at a user-id table rather than any tenant concept.

**Likelihood:** Realized — caught during this session's pre-apply re-validation, before the migration reached production. **Impact:** would have been Medium (a semantically wrong FK constraint on a core outbound-write table; likely would have rejected valid inserts or silently coupled company_id to an unrelated user row).

**Mitigation:** before applying, queried production's `information_schema`/`pg_constraint` and confirmed no table in this schema enforces a `company_id` foreign key anywhere (`company_id` is used purely as an application-validated scoping key via `erp_users.accessible_company_ids` and `supabase/functions/_shared/company-scope.ts`). Removed the FK to match that established, schema-wide convention before applying. See [[ADR-001-read-write-provider-split-and-outbound-command-architecture]] and the migration file's own inline comment for the corrected rationale.

**Owner:** any future migration author who leaves a "placeholder — adjust at approval time" comment must actually revisit it at approval time, not just re-read the comment and apply anyway; this is the second time in this phase a "confirm before assuming" step caught a real defect (see R-002 for the first).

## R-006: Deployed write function that could not yet reach Paraşüt (RESOLVED)

**Risk (as originally recorded):** `parasut-write-api` was deployed and ACTIVE with `ACCOUNTING_WRITE_ENABLED` togglable, but no `PARASUT_*` credentials existed as Edge Function secrets in production. Any request reaching the function would have failed at the authentication step.

**Resolution:** the five `PARASUT_*` secrets were provisioned with explicit authorization via a restricted, immediately-deleted temporary env file (see `docs/TECHNICAL_DEBT.md` TD-004). `parasut-write-api` was then redeployed. The write gate (`ACCOUNTING_WRITE_ENABLED`) was kept `false` throughout provisioning and redeployment, and is only set to `true` immediately before the single controlled production test, per the operations runbook.

**Residual risk:** none specific to this item; ongoing operational risk of a future secret rotation breaking this function silently is a normal operational concern, not unique to this phase.

## R-004: Silent field loss (`country`/`currency`/`paymentTermDays`)

**Risk:** a user fills in these fields in the ERP dialog, believing them saved, but they are silently dropped by the provider mapper (see [[TD-001-dropped-fields]]).

**Likelihood:** Medium (these are plausible, visible form fields). **Impact:** Low-Medium (data loss is silent but not destructive — no incorrect data is written, just missing data).

**Mitigation:** none currently at the UI level — the frontend does not warn the user these fields won't persist. **Residual risk:** open until either the mapper is extended with a confirmed field mapping or the UI is updated to indicate these fields are not yet supported.

**Owner:** whoever picks up TD-001 should also update `CreateCustomerDialog.tsx` to reflect the resolution (either wire the fields through, or remove/label them as unsupported).
