# Paraşüt Schema Audit Report

Status: **IMPLEMENTED (local only) — no migration executed against production**

## 1. Current production schema (as of this audit)

Single migration creates all existing Paraşüt tables, all under `public`, all prefixed `parasut_`:

`supabase/migrations/20260613194043_parasut_mirror_database_foundation.sql` (347 lines)

| Existing table (schema `public`) | `resource_type` CHECK | Role |
|---|---|---|
| `parasut_contacts` | `contacts` | resource mirror |
| `parasut_products` | `products` | resource mirror |
| `parasut_sales_invoices` | `sales_invoices` | resource mirror |
| `parasut_sales_invoice_details` | `sales_invoice_details` | resource mirror (included-only) |
| `parasut_purchase_bills` | `purchase_bills` | resource mirror |
| `parasut_purchase_bill_details` | `purchase_bill_details` | resource mirror (included-only) |
| `parasut_payments` | `payments` | resource mirror (included-only) |
| `parasut_accounts` | `accounts` | resource mirror |
| `parasut_sync_runs` | — | infrastructure (sync run log) |
| `parasut_sync_errors` | — | infrastructure (sync error log) |

Common mirror-table columns (all 8 resource tables): `id uuid PK, company_id uuid FK→public.companies, parasut_id text, parasut_company_id text, resource_type text, attributes jsonb, relationships jsonb, included jsonb, raw_payload jsonb, source_created_at, source_updated_at, source_archived boolean, first_seen_at, last_seen_at, synced_at, payload_hash text, created_at, updated_at`. Unique key: `(parasut_company_id, resource_type, parasut_id)`. RLS enabled everywhere; `authenticated` role has SELECT only; all writes are service-role (server/edge-function) only.

`supabase/migrations/20260614061645_unified_erp_user_authorization.sql` extends authorization policy over the same 10 table names — creates no new tables.

## 2. Discovered live Paraşüt API resources (authoritative sync engine: `server/parasut/*`)

Confirmed via API client, sync modules, real API response captures (`tools/parasut/discovery/*.json`), and design docs (`docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`):

| API resource (JSON:API `type`) | Fetched via | Endpoint |
|---|---|---|
| `contacts` | direct sync | `/v4/{company}/contacts` |
| `products` | direct sync | `/v4/{company}/products` |
| `sales_invoices` | direct sync | `/v4/{company}/sales_invoices` (include contact, details, payments) |
| `sales_invoice_details` | included-only | no standalone endpoint |
| `purchase_bills` | direct sync | `/v4/{company}/purchase_bills` (include spender, details, payments) |
| `purchase_bill_details` | included-only | no standalone endpoint |
| `payments` | included-only | standalone `/payments` endpoint **confirmed 404** — do not attempt direct sync |
| `accounts` | direct sync | `/v4/{company}/accounts` |

These 8 resource names map 1:1 to the 8 existing resource-mirror tables. **No table names were invented for this list** — every entry is a verbatim JSON:API `type` string / endpoint path segment pulled from `server/parasut/sync-*.ts` and cross-checked against real API captures in `tools/parasut/discovery/`.

Explicitly rejected as resources (do not create tables for these):
- `purchase_invoices` — tried, confirmed HTTP 404, wrong name (`purchase_bills` is correct)
- `tags`, `warehouses`, `categories`/`category`, `e_invoice_inboxes`, etc. — these are relationship keys nested inside other resources' payloads, not independently-fetchable collections in this codebase

## 3. CONFLICT — two incompatible Paraşüt implementations coexist

**A. `server/parasut/*` mirror engine (tested, documented across 20+ phase docs, matches the live migration)** — this is what section 2 describes.

**B. Legacy Deno edge functions**, still present and deployed under `supabase/functions/`:
- `parasut-sync/index.ts` — separate OAuth flow, writes OAuth tokens to a table **`parasut_tokens`**
- `parasut-sync-run/index.ts` — separate fetch/sync logic, writes flattened rows to **`parasut_contacts`**, **`parasut_products`**, and **`parasut_invoices`** (note: `parasut_invoices`, not `parasut_sales_invoices`) with a *different column shape* (`parasut_id, name, email, phone, ...` — flat, not JSON:API envelope)

**Neither `parasut_tokens` nor `parasut_invoices` has a migration file anywhere in `supabase/migrations/`, and neither appears in the generated `src/integrations/supabase/types.ts`.** This means either:
- they were created manually outside migration tracking (schema drift risk), or
- these edge functions are currently non-functional/dead code that has never actually run against production

If implementation B is still deployed and live, it currently collides with implementation A on `parasut_contacts`/`parasut_products` (same table names, incompatible column sets) — that's already a pre-existing bug independent of this task, but it directly affects whether moving tables to a `parasut` schema is safe to do without also updating/retiring the edge functions.

## 4. Proposed table list under new `parasut` schema

Moving (not duplicating) the 8 resource-mirror tables + 2 infra tables, dropping the now-redundant `parasut_` prefix since the schema itself provides the namespace:

| Current (`public.*`) | Proposed (`parasut.*`) | Type |
|---|---|---|
| `parasut_contacts` | `parasut.contacts` | resource mirror |
| `parasut_products` | `parasut.products` | resource mirror |
| `parasut_sales_invoices` | `parasut.sales_invoices` | resource mirror |
| `parasut_sales_invoice_details` | `parasut.sales_invoice_details` | resource mirror |
| `parasut_purchase_bills` | `parasut.purchase_bills` | resource mirror |
| `parasut_purchase_bill_details` | `parasut.purchase_bill_details` | resource mirror |
| `parasut_payments` | `parasut.payments` | resource mirror |
| `parasut_accounts` | `parasut.accounts` | resource mirror |
| `parasut_sync_runs` | `parasut.sync_runs` | infrastructure (kept clearly separate by name — not treated as a resource table) |
| `parasut_sync_errors` | `parasut.sync_errors` | infrastructure |

No naming conflicts detected inside the target `parasut` schema itself (schema doesn't exist yet). The only conflicts are the cross-implementation ones in section 3.

## 5. Blocking questions (must answer before I write the migration)

1. **Is `supabase/functions/parasut-sync` / `parasut-sync-run` (legacy edge functions) still deployed/live, or safe to treat as dead code for this task?** This determines whether moving `parasut_contacts`/`parasut_products` breaks something currently running in production.
2. **What should happen to `parasut_tokens` and `parasut_invoices`?** They have no migration, aren't part of the tested mirror architecture, and aren't in scope per your resource list (section 2) — should I leave them untouched in `public` (since this task explicitly says "do not touch unrelated ERP modules" / "do not delete production data"), or do you want them retired as part of resolving the conflict?
3. **`RENAME TABLE` vs `create in parasut + copy + drop from public`?** Postgres supports `ALTER TABLE public.parasut_contacts SET SCHEMA parasut` (zero data movement, keeps all data/indexes/constraints, just reparents the table) — this is the safe, minimal-risk approach. I plan to use `SET SCHEMA` plus `ALTER TABLE ... RENAME TO` to drop the prefix, not a copy+drop. Confirm this is acceptable (it does briefly take an `ACCESS EXCLUSIVE` lock per table, near-instant, no data rewrite).

I have not written any SQL or touched any code yet, per your instruction to stop and report ambiguity first.

## 6. Revised architecture (per mid-task clarification)

Production was confirmed clean (`public.erp_users`, `public.machines` only — no live `parasut_*` data anywhere). This became a **greenfield schema creation**, not an in-place migration:

- `parasut.*` — API mirror resource tables (8, one per confirmed resource)
- `integration.*` — sync infrastructure, kept structurally separate (`sync_runs`, `sync_errors`)
- `public.*` — untouched (no `parasut_*` names created there)
- `public.parasut_*` (the old, unapplied `20260613194043` migration), `parasut_tokens`, `parasut_invoices`, and the legacy edge functions (`supabase/functions/parasut-sync`, `parasut-sync-run`) are left untouched as repository-legacy artifacts, per explicit instruction — not part of this migration, not deployed/depended on.

## 7. Final table list (implemented)

| Schema | Table | Source |
|---|---|---|
| `parasut` | `contacts` | API resource `contacts` |
| `parasut` | `products` | API resource `products` |
| `parasut` | `sales_invoices` | API resource `sales_invoices` |
| `parasut` | `sales_invoice_details` | API resource `sales_invoice_details` (included-only) |
| `parasut` | `purchase_bills` | API resource `purchase_bills` |
| `parasut` | `purchase_bill_details` | API resource `purchase_bill_details` (included-only) |
| `parasut` | `payments` | API resource `payments` (included-only) |
| `parasut` | `accounts` | API resource `accounts` |
| `integration` | `sync_runs` | infra — not an API resource |
| `integration` | `sync_errors` | infra — not an API resource |

Migration file: `supabase/migrations/20260713120000_parasut_mirror_schema_foundation.sql`. Not executed against any database — file only, pending explicit approval to apply.

## 8. Code changes

- `server/parasut/types.ts` — `MirrorTable` union changed to bare resource names; added `PARASUT_MIRROR_SCHEMA`/`PARASUT_INTEGRATION_SCHEMA` constants; `MirrorDatabase` interface gained a `schema(name)` method (mirrors supabase-js's real `.schema()` API).
- `server/parasut/upsert-resource.ts` — now calls `database.schema(PARASUT_MIRROR_SCHEMA).from(table)` for all resource-mirror reads/writes.
- `server/parasut/sync-base.ts` — sync-run/error bookkeeping now goes through `database.schema(PARASUT_INTEGRATION_SCHEMA).from("sync_runs"|"sync_errors")`; `INCLUDED_DEFINITIONS` table values updated to bare names.
- `server/parasut/sync-contacts.ts`, `sync-products.ts`, `sync-sales-invoices.ts`, `sync-purchase-bills.ts`, `sync-accounts.ts` — `table:` updated to bare resource name.
- `server/parasut/sync-run-recovery.ts` — `RecoveryDatabase` gained `schema()`; queries scoped to `integration.sync_runs`.
- Tests updated to match: `sync-engine.test.ts`, `sync-run-recovery.test.ts`, `local-safety.test.ts` (mock objects now implement `.schema()`; literal table names updated).
- No changes made to `server/parasut/client.ts` or `server/parasut/auth.ts` — the client remains GET-only; no write/create/update/delete capability exists or was added, preserving the read-only-toward-Paraşüt rule.
- Not touched: `supabase/functions/parasut-sync*` (legacy, explicitly out of scope), any `src/` frontend code (none referenced these tables), `public.erp_users`, `public.machines`.

## 9. Validation output

```
$ npm run typecheck            → PASS (tsconfig.app.json)
$ npx tsc -p tsconfig.server.json --noEmit  → PASS
$ npx vitest run server/parasut → 13 test files, 134 tests, all PASS
$ npm run build                → PASS (dist/ built successfully)
```

- No `parasut` resource table created under `public` — confirmed by migration content and by grep (zero `public.parasut_*` CREATE statements in the new migration).
- Every mirror table name matches a confirmed API resource string exactly — no invented/translated/abbreviated names.
- Sync infrastructure (`sync_runs`, `sync_errors`) kept in a separate `integration` schema, never mixed into resource tables.
- `parasut`/`integration` schemas are not added to any Supabase API-exposure config in this repo — combined with RLS-enabled, anon/authenticated-revoked, service-role-only grants, they are not reachable from the frontend.
- Read-only-toward-Paraşüt preserved — no API client changes, no write methods added.
- Upserts verified (by both code and passing tests) to target `parasut.<table>` via `.schema()`.
- **No production deploy. No migration executed against any database** — file created only, awaiting explicit approval before `supabase db push` or equivalent.
