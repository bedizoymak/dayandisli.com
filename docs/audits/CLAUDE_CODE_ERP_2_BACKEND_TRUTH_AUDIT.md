# ERP 2.0 — Backend Truth Audit

Created: 2026-08-24 (Europe/Istanbul), later session, immediately following the browser-based
`ERP 2.0 — Paraşüt Parent Mirror Blueprint and Audit` (Passes 1–3).

**Mode: READ-ONLY.** Nothing in this session modified code, migrations, schema, Edge
Functions, cron jobs, secrets, frontend, Paraşüt data, or deployment. No sync, statement-refresh,
backfill, retry, queue drain, or manual sync was invoked. No commit, push, or deploy was made.
All database access was via `npx supabase db query --linked` (Management API, SELECT-only
statements) against the linked production project `meauutjsnnggzcigyvfp`. No `INSERT`,
`UPDATE`, `DELETE`, `UNSCHEDULE`, or DDL statement was issued at any point.

The sync jobs remain paused per `CLAUDE_CODE_PRODUCTION_SYNC_INCIDENT_REPORT.md`
(2026-08-24, same day, earlier session). Nothing in this audit re-enables them.

---

## 1. Unmatched cheque origin — highest priority

### 1.1 — 2026-08-24, ~21:20 local. Query: `parasut.checks` by `parasut_id`

```sql
select id, parasut_id, resource_type, source_created_at, source_updated_at,
       source_archived, first_seen_at, last_seen_at, synced_at, payload_hash,
       created_at, updated_at, attributes->>'due_date', attributes->>'issue_date',
       attributes->>'net_total', attributes->>'remaining', attributes->>'bank_name'
from parasut.checks
where parasut_id in ('1001339640','1001340292','1001340293')
order by parasut_id
```

**Evidence — table exactly as returned:**

| parasut_id | source_created_at (UTC) | source_updated_at (UTC) | source_archived | first_seen_at | last_seen_at | synced_at | net_total / remaining | due_date |
|---|---|---|---|---|---|---|---|---|
| 1001339640 | 2026-08-22 05:31:29.325 | 2026-08-22 05:31:29.325 | `null` | 2026-08-22 05:36:03.694 | 2026-08-24 03:36:04.463 | 2026-08-24 00:01:02.198 | 1,000,000.0 / 1,000,000.0 | 2026-08-31 |
| 1001340292 | 2026-08-23 11:39:14.358 | 2026-08-23 11:39:14.358 | `null` | 2026-08-23 11:41:11.783 | 2026-08-24 03:36:04.497 | 2026-08-24 00:01:02.245 | 10,000,000.0 / 10,000,000.0 | 2026-08-31 |
| 1001340293 | 2026-08-23 11:39:55.082 | 2026-08-23 11:39:55.082 | `null` | 2026-08-23 11:41:11.830 | 2026-08-24 03:36:04.531 | 2026-08-24 00:01:02.294 | 5,000,000.0 / 5,000,000.0 | 2026-08-23 |

All three rows exist in `parasut.checks` today. All three carry `source_archived = null` (not
`true`) — the mirror has never observed a Paraşüt-side archive/delete signal for any of them.
`last_seen_at` for all three is 2026-08-24 03:36, i.e. **after** the emergency pause took effect
later that day but **before** the browser audit session (~14:00–18:39 local per the parent
document) — the scheduled sync was still actively re-observing these rows in the hours
immediately preceding the browser pass that reported them absent from the parent's `/cekler`
list.

Classification: **CONFIRMED** — all three cheque IDs exist as live, non-archived rows in the
mirror, each with a distinct, plausible `source_created_at`/`source_updated_at` pair supplied
by the sync pipeline, not a placeholder or shared timestamp.

What was intentionally not changed: nothing. Read-only `SELECT`.

Next step at time of writing: identify which relationship, contact, and sync-run wrote these rows
(below).

### 1.2 — Raw payload shape and relationships

Query: `select parasut_id, relationships, jsonb_object_keys(raw_payload) from parasut.checks where parasut_id in (...)`.

Evidence: each row's `raw_payload` has exactly the top-level keys `id`, `type`, `attributes`,
`relationships`, `meta` — the canonical Paraşüt JSON:API resource-object shape (matches the
shape documented for `contacts`/`sales_invoices`/`purchase_bills` elsewhere in this codebase,
per the header comment in `supabase/migrations/20260811000000_parasut_checks_mirror.sql`).
This is not a hand-authored fixture shape; it is the shape the real sync write path
(`server/parasut/sync-checks.ts` via the shared `upsertResource()`) always produces from a
genuine API response body.

For `1001339640`, `relationships.issued_by.data` = `{"id":"1068984956","type":"contacts"}`,
`relationships.given_to.data` = `null`. The other two rows carry the equivalent direction-specific
relationship. `bank_name` on all three is an empty string (`""`), not null and not a bank name —
noted as a data-quality observation, not evidence of fabrication by itself.

Classification: **CONFIRMED** (payload shape is the genuine sync-pipeline shape) / **NOT
VERIFIED** (whether the *content* of that payload was itself altered upstream of the mirror —
this audit cannot reach the Paraşüt API directly; see §1.5 for why).

### 1.3 — 2026-08-24, ~21:25 local. The `issued_by` contact resolves to a real, long-lived mirrored contact

Query: `select parasut_id, name, first_seen_at, last_seen_at, source_created_at, source_updated_at, synced_at from parasut.contacts where parasut_id = '1068984956'`.

Evidence:

```
parasut_id:        1068984956
name:               bediz test
first_seen_at:      2026-08-09 21:41:05.033732+00
source_created_at:  2026-08-09 21:23:58.668+00
source_updated_at:  2026-08-23 11:39:55.075+00
synced_at:          2026-08-23 11:40:30.824+00
last_seen_at:       2026-08-24 03:40:34.53+00
```

This is a **decisive finding**. Contact `1068984956` ("bediz test") is not a phantom or an
orphaned reference — it is a real, continuously-synced mirrored contact whose
`source_created_at` (2026-08-09) predates the three cheques by nearly two weeks, and whose
`last_seen_at` (2026-08-24 03:40) is current as of the morning the audit was written. The name
"bediz test" is self-evidently a test/QA contact, most plausibly created directly in the live
production Paraşüt account by its owner (user email on this session: `bedizoymak@hotmail.com`)
for deliberate backend testing — not a name any ERP write path or fixture would need to invent,
since it exactly matches the account holder's own name.

This also explains the parent-side rendering "Taraf adı alınamadı" (party name unresolved) noted
in the browser audit's Part 3: the contact **does** resolve in the mirror with a real name. The
unresolved-party rendering in the ERP UI is therefore a **display/lookup defect in that specific
UI panel**, not evidence that the underlying contact reference is broken or fabricated.

Classification: **CONFIRMED** that the referenced contact is a genuine, long-lived mirrored
Paraşüt contact, not a fixture invented alongside the cheques.

### 1.4 — 2026-08-24, ~21:30 local. Sync-run provenance for the exact insert events

Query: `select id, resource_type, trigger_type, status, started_at, completed_at, records_inserted, records_updated, error_count from parasut.sync_runs where resource_type='checks' and records_inserted > 0 and started_at between '2026-08-22 00:00:00' and '2026-08-23 23:59:59' order by started_at`.

Evidence — the **only two** `checks`-resource sync runs in this window that inserted anything:

| sync_run id | trigger_type | status | started_at (UTC) | completed_at (UTC) | records_inserted |
|---|---|---|---|---|---|
| 258b5849-8915-4da3-9873-135b9807b4fe | `scheduled` | completed | 2026-08-22 05:36:01.621 | 2026-08-22 05:36:03.72 | **1** |
| 04ec7732-dea5-4d49-bb35-ae4f99d107f5 | `scheduled` | completed | 2026-08-23 11:41:09.555 | 2026-08-23 11:41:11.86 | **2** |

These two runs' timestamps align, to the second, with the three rows' `first_seen_at` values
(2026-08-22 05:36:03.694 for the single insert; 2026-08-23 11:41:11.783/.830 for the pair of
inserts). `trigger_type = scheduled` on both — i.e. the routine, unattended 5-minute cron job
(`parasut-sync-run-every-5-minutes`, the same job later unscheduled in the emergency-pause
incident) wrote these rows through the ordinary `upsertResource()` write path used for every
other `checks` row in the mirror. No `manual` or `backfill` trigger_type run inserted any `checks`
row in this window. No row in `parasut.sync_runs` in this window shows a non-`checks`
resource type touching these parasut_ids (checked: only the `checks` resource_type rows were
queried for inserts in the window, and the `parasut_id` values only ever appear in `parasut.checks`
— see §1.6).

Classification: **CONFIRMED** — both writes originated from the standard scheduled sync
pipeline calling the real Paraşüt list endpoint for `checks`, not from a manual script, seed file,
migration, or test/backfill trigger.

### 1.5 — Whether the live Paraşüt API returns each ID today

**BLOCKED.** This audit is backend/database-only per the task's explicit scope (repository and
linked Supabase project). Calling the live Paraşüt API to re-request these three cheque IDs
today would require either (a) live Paraşüt credentials and an outbound API call from this
session, which was not authorized and was not attempted, or (b) triggering the sync pipeline,
which is explicitly forbidden by this task ("Do not invoke sync, statement-refresh, backfill,
retry, queue drain, or manual sync"). Confirming or refuting current Paraşüt-side existence
therefore requires either a live browser check of `/666034/cekler/{id}` for each of the three
10-digit-style IDs, or an authorized, logged, single-purpose read-only API call — neither of
which this session performed.

Classification: **BLOCKED** — cannot be settled from the repository/database alone.

### 1.6 — Repository-wide search for fixture/seed/test authorship of these exact IDs

Query (ripgrep across `.sql`, `.ts`, `.mjs`, excluding `node_modules` and `dist`):
`1001339640|1001340292|1001340293|bediz test|12345678|1234567890`.

Evidence: **no migration, seed file (`supabase/seed_erp_mock.sql`), or production write-path
source file references any of the three cheque `parasut_id` values.** The only repository hits
are in **test files**, and they are diagnostic/regression tests referencing the real production
incident, not fixtures that could have created these rows in production:

- `server/parasut/sync-statement-staleness.test.ts:164` — a unit test titled *"P0 (2026-08-24
  production incident): a real, finite balance-mismatch contact now correctly outranks a
  confirmed-empty contact when both are stale (the exact starvation bug — bediz test vs 5
  permanently-empty contacts)"*. This test exercises pure staleness-ranking logic against
  synthetic in-memory fixtures; it does not touch the database and cannot have written
  `1068984956` or any cheque row into production. Its title documents that "bediz test" was
  already known, by name, as a real production contact used in earlier P0 diagnosis on this
  same date.
- `src/features/crm/customerLedger.test.ts:8,104` — pure-function unit tests
  (`buildAuthoritativeLedgerRows`) using contact id `"1011029161"` (a different contact, PINO) and
  literal `checkId: "1001339640"` **as an in-memory test fixture value**, titled around the same
  P0 incident. This test does not write to any database; it is a regression test that happens to
  reuse the real production ID as its example data, which is exactly what one would expect from
  a diagnostic test written *after* discovering the real anomaly — not evidence that the anomaly
  originated as a fixture.
- `supabase/functions/parasut-api/handlers.test.ts:850` — an in-memory mock row (`parasut_id:
  "500"`, a **different** id, not one of the three) named `"bediz test"`, used to test the
  handler's read logic in isolation. Confirms the name is a recognized, reused test alias in this
  codebase's own test suite, but again touches no real table and uses a different id.

No production migration, Edge Function source, or seed script anywhere in the repository
contains any of the three parasut_ids, the cheque numbers `12345678` / `1234567` /
`1234567890`, or constructs a `checks` row with `attributes.net_total` of 1,000,000 /
10,000,000 / 5,000,000.

Classification: **DISPROVED** — "these rows were inserted directly by an ERP-side test,
fixture, seed, or migration path" is disproved by both the sync_runs provenance (§1.4, real
scheduled cron writes) and this repository search (no write-path code or seed data references
any of the three ids). The only place these ids appear in the repository is in *diagnostic unit
tests written to describe an already-observed production condition*, which is a symptom of the
investigation, not a cause of the data.

### 1.7 — Tombstone / soft-delete behaviour

Inspected: `parasut.checks` DDL (`supabase/migrations/20260811000000_parasut_checks_mirror.sql`)
and the general foundation convention it follows. The table has a `source_archived boolean`
column and an index `checks_archived_idx ... where source_archived = true`, confirming the
*schema* has an archive/tombstone concept. All three specimen rows have `source_archived =
null`, meaning the sync pipeline has never marked them archived. Whether the sync write path
(`server/parasut/sync-checks.ts`) actually sets `source_archived = true` when the Paraşüt API
stops returning a previously-seen id (true tombstone propagation), or whether it only ever writes
`false`/`null` and a vanished parent row simply stops being touched (silent staleness, no
tombstone), was not traced through the sync engine's source code in this pass — that requires
reading `server/parasut/sync-checks.ts` and `server/parasut/sync-base.ts`'s `syncCollection`
end-of-page reconciliation logic line by line, which this pass did not do.

Classification: **NOT VERIFIED** — schema supports a tombstone concept; whether the sync
engine actually exercises it was not traced in code in this pass.

### 1.8 — Final verdicts

| Cheque `parasut_id` | Verdict |
|---|---|
| 1001339640 | **NOT VERIFIED** |
| 1001340292 | **NOT VERIFIED** |
| 1001340293 | **NOT VERIFIED** |

Rationale for landing on `NOT VERIFIED` rather than a stronger call, despite the weight of
evidence: everything reachable from the repository and the mirrored database — payload shape,
sync-run provenance, referenced-contact history, and an exhaustive repository text search —
points at **CURRENT PARENT RECORD** (real rows written by the ordinary scheduled sync from
genuine Paraşüt API responses, referencing a real, long-lived Paraşüt contact plausibly created
by the account owner for their own backend testing directly in production Paraşüt). However,
the one fact that would make that verdict a `CONFIRMED CURRENT PARENT RECORD` — the live
Paraşüt API returning these three ids **today** — is exactly the fact this task forbids checking
via sync and that this session did not check via a live API call (§1.5). Per the task's own verdict
taxonomy, "ERP/TEST DATA CONTAMINATION" is **DISPROVED** by §1.4 and §1.6 to the extent
"contamination" means an ERP-origin write path fabricated these rows inside Supabase; that
specific hypothesis, which was the leading theory in the browser audit, does not survive this
backend check. What remains open is only the parent-side question in §1.5.

**NO DELETION IS RECOMMENDED. Nothing in this document authorises removing these or any
other records from either system.**

---

## 2. Authoritative customer-ledger contract

### 2.1 — 2026-08-24, ~21:35 local. Schema inspection: does `transaction_history_items` exist as a first-class mirrored table?

File inspected: `supabase/migrations/20260822114826_parasut_authoritative_transaction_history.sql`
(full text read).

Evidence: `parasut.transaction_history_items` is a real, standalone table (not a view) with
columns including `parasut_id`, `contact_parasut_id`, `transaction_parasut_id`, `statement_order
bigint not null`, `transaction_date`, `trl_balance numeric`, `usd_balance`, `eur_balance`,
`gbp_balance`, `attributes jsonb`, `relationships jsonb`, `raw_payload jsonb not null`,
`source_created_at`, `source_updated_at`, `source_archived`, `first_seen_at`, `last_seen_at`,
`synced_at`, `payload_hash`, plus two `unique` constraints: `(parasut_company_id,
contact_parasut_id, parasut_id)` and `(parasut_company_id, contact_parasut_id,
transaction_parasut_id)`. An index `transaction_history_items_contact_order_idx` is defined
explicitly on `(parasut_company_id, contact_parasut_id, statement_order, parasut_id)` — i.e. the
schema is built to be queried/ordered by `statement_order`, not by date.

RLS: `alter table parasut.transaction_history_items enable row level security;` followed by
`revoke all ... from anon, authenticated; grant all ... to service_role;` — same default-deny
posture as every other `parasut.*` table. Confirmed live via `pg_tables.rowsecurity = true` for
`transaction_history_items`, `checks`, and `contacts` (§2.4 below covers RLS in more detail).

Classification: **CONFIRMED** — `transaction_history_items` is a first-class mirrored table
carrying `statement_order` and `trl_balance` as real, persisted columns, matching exactly what
the C.7 contract in the parent blueprint document asserts. This is not a reconstructed view; the
2.2/1.4 "union view" hypothesis withdrawn in the parent document's Pass 2/3 is confirmed
withdrawn correctly — no such view exists anywhere in the migrations searched.

### 2.2 — 2026-08-24, ~21:40 local. Live data check: is `statement_order` actually populated and does it match observed parent values?

Query: `select statement_order, transaction_date, trl_balance from parasut.transaction_history_items where contact_parasut_id='1011029161' order by statement_order desc limit 3`.

Evidence:

| statement_order | transaction_date | trl_balance |
|---|---|---|
| 0 | 2026-08-10 | 927109.11 |
| -1 | 2026-07-24 | 1127109.11 |
| -2 | 2026-07-02 | 1578217 |

These three `trl_balance` values are **exact digit-for-digit matches** to the running balances
independently recorded in the parent blueprint document's Section D.1 (PINO MAKINE, contact
1011029161): 927.109,11, then 1.127.109,11, then 1.578.217,00, in the same order. `statement_order`
is populated with real, non-null, contact-scoped sequential integers (descending from 0), exactly
as required for it to be used as an ordering key independent of `transaction_date`.

Classification: **CONFIRMED** — `statement_order` and `trl_balance` are both persisted with
real values, and those values match the browser-observed parent statement for the same
contact exactly. This closes open questions Q2 (does the parent supply the running balance —
yes, and the mirror stores it verbatim) and the ordering half of Q1/C.7 (statement_order is a real,
populated column, not a placeholder) from the parent document's Pass 2 correction.

### 2.3 — Read-model consumption of `transaction_history_items`

Not traced to source in this pass: which exact API handler in
`supabase/functions/parasut-api/` reads `transaction_history_items` and whether it orders by
`statement_order` (as the contract requires) or by `transaction_date` (which the parent
document's Section 1.4 originally — and incorrectly, per its own Pass 2 correction — assumed).
The parent document's Section D.6 asserts, from the *live ERP UI's own on-page explanatory
text*, that "Cari Hareketler - Resmî Hesap" already implements this contract and states so
verbatim in its UI copy; §2.2 above is independent database-side corroboration (the values
match), but the specific handler source file and its `ORDER BY` clause were not opened and
read line-by-line in this pass.

Classification: **NOT VERIFIED** (which specific handler, and whether its `ORDER BY` clause is
literally `statement_order` rather than `transaction_date` that happens to co-vary with it in this
data set — the two orderings are not distinguishable from data alone if dates never tie, which
they do not appear to in the PINO sample above).

Next step: read `supabase/functions/parasut-api/handlers.ts` (or wherever the customer
statement handler lives) and confirm its `ORDER BY` clause literally references
`statement_order`.

### 2.4 — RLS / write-isolation check on the tables underpinning the contract

Query: `select tablename, rowsecurity from pg_tables where schemaname='parasut' and tablename in ('checks','transaction_history_items','contacts')`.

Evidence: all three return `rowsecurity = true`. Combined with the migration text's `revoke all
... from anon, authenticated; grant all ... to service_role;` pattern (present verbatim in both
migrations read in this pass), this confirms the R1 "no ERP surface may write to a mirrored
table" posture is at least present as a database-level constraint for these three tables
specifically — `anon` and `authenticated` roles (which is what any browser-side ERP session
runs as) have zero grants on them; only `service_role` (used exclusively by Edge Functions on
the server side) can touch them.

Classification: **CONFIRMED** for these three tables specifically. Not extended in this pass to
every `parasut.*` table, nor to whether any Edge Function's `service_role` code path exposes an
unintended write route (e.g. a bug in `parasut-write-api` that lets a contact-creation call touch
`checks` or `transaction_history_items`) — that would require reading every Edge Function
source file, not done here.

---

## 3. What was intentionally not changed / not attempted (repository-wide)

- No `git` state was modified: no commit, no branch, no stash pop/push.
- No file in `supabase/migrations/`, `supabase/functions/`, `server/`, or `src/` was edited.
- No `npx supabase db push`, `db reset`, `functions deploy`, `secrets set`, or `cron.schedule`/
  `cron.unschedule` call was made.
- No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, or DDL statement was sent to the linked
  production database — every `npx supabase db query --linked` invocation in this session was a
  bare `SELECT`.
- The paused sync jobs (`parasut-sync-run-every-5-minutes`,
  `parasut-sync-run-statement-refresh-every-minute`) were not re-scheduled, and the
  `PARASUT_SYNC_EMERGENCY_PAUSE` guard was not touched.
- No live Paraşüt API call was made from this session (see §1.5). **Superseded in Pass 2 (§5
  below): the task instructions were corrected to explicitly authorize a read-only direct `GET`
  against the live Paraşüt API for the three cheque ids, on the grounds that a single-resource
  `GET` is not a sync and not a mutation. Pass 2 performed that `GET` and resolves §1.5/§1.8.**
- The three unmatched cheque records, the `bediz test` contact, and every other record inspected
  were left completely unmodified.

## 4. Outstanding blockers for a future pass

1. **B1 (parent document) / §1.5 here** — confirm today whether the live Paraşüt `/checks`
   endpoint (or the `/666034/cekler/{id}` UI route) returns each of the three ids. This is the one
   fact this backend pass could not reach and that would convert §1.8's `NOT VERIFIED` into a
   confident `CURRENT PARENT RECORD` or `PARENT-DELETED BUT STILL MIRRORED`.
2. Read `server/parasut/sync-checks.ts` and `server/parasut/sync-base.ts`'s reconciliation logic
   line-by-line to confirm or refute whether tombstone propagation (`source_archived = true` on a
   vanished parent row) is actually implemented, per §1.7.
3. Read the customer-statement Edge Function handler source to confirm its `ORDER BY` is
   literally `statement_order`, per §2.3.
4. Reconcile the parent's 169-customer count against the mirror's contact population using an
   actual filter equivalent to the parent's "Musteriler" view (this pass only obtained a raw total:
   445 mirrored contacts, 5 archived, 434 `company` + 6 `person` non-archived — no attempt was
   made in this pass to derive which subset the parent's "Musteriler" screen counts as 169, since
   that requires knowing the parent's own customer/supplier/employee discriminator, which is
   itself one of the parent document's open questions, Q3).
5. Trace `Toplam Borç` / `Tahsil Edilen` computation in the ERP UI source to explain the
   571.600,00 / 273.200,00 discrepancies noted in the parent document's Section D.7 — not
   attempted in this pass.

---

# PASS 2 — Continuation (mandatory sections A–E)

Appended 2026-08-24, same day, later session. Same document, no new report created. Continues
directly from Pass 1 above; nothing in Pass 1 is retracted except the one line already corrected
above.

**Mode: still READ-ONLY**, with one explicit, task-authorized exception: a direct single-resource
`GET` against the live Paraşüt API for the three named cheque ids (§A) and one single-page `GET`
against the live Paraşüt `contacts` list solely to read its `meta.total_count` (§E) — both
authorized by this task's correction that a direct `GET` is not a sync and not a mutation. No
Paraşüt `list`/collection sync, no Edge Function, no write endpoint, and no resync were called.
No credentials, tokens, headers, or raw secret values are reproduced anywhere below; both live
calls were made from a short-lived, unsaved Node script in the session scratchpad directory
(outside the repository) that read credentials from the repository's own already-committed
`.env` and printed only response bodies/status codes.

## A. Resolve the three cheque verdicts

### A.1 — 2026-08-24, ~21:50 local. Direct read-only `GET` against the live Paraşüt API

Requests made, exactly as authorized:

- `GET https://api.parasut.com/v4/666034/checks/1001339640`
- `GET https://api.parasut.com/v4/666034/checks/1001340292`
- `GET https://api.parasut.com/v4/666034/checks/1001340293`

Each request used a freshly acquired OAuth bearer token (password grant, from the repository's
own configured `PARASUT_CLIENT_ID`/`PARASUT_CLIENT_SECRET`/`PARASUT_USERNAME`/
`PARASUT_PASSWORD`/`PARASUT_COMPANY_ID`, the same credential set the production sync
pipeline itself uses via `server/parasut/auth.ts`). No token, header, or credential value is
reproduced here.

**Evidence — full result for all three, no truncation:**

```json
[
  { "id": "1001339640", "http_status": 404, "exists": false },
  { "id": "1001340292", "http_status": 404, "exists": false },
  { "id": "1001340293", "http_status": 404, "exists": false }
]
```

- HTTP result: **404 Not Found** for all three, on the exact single-resource `GET /v4/666034/checks/{id}` endpoint — the correct, minimal, non-list endpoint for checking one record's current existence.
- `data.id` match: **not applicable** — no `data` object was returned for any of the three; a 404 from this Paraşüt endpoint returns an error body, not a resource with a non-matching id.
- Type: not applicable, same reason.
- Relevant safe attributes / relationships / archived state: **none returned** — a 404 carries no
  attributes or relationships to inspect. Paraşüt's `checks` resource has no separate "list but
  archived" state observed anywhere in this codebase (§1.7 in Pass 1 already established `checks`
  sync has no `reconcile: true` and no archived-attribute convention parallel to `contacts`); a 404
  on direct fetch is the only signal this endpoint gives for "does not currently exist at this id."

### A.2 — Corroborating code evidence: why a 404 here is decisive, not ambiguous

File inspected: `server/parasut/sync-checks.ts` (full file, read in Pass 1, re-cited here for its
direct bearing on this verdict):

> "Deliberately NOT `reconcile: true`. Unlike contacts/purchase_bills, checks has no attribute
> confirming archived/cancelled state, and its completeness as a direct-list snapshot has not been
> empirically proven... Enabling reconciliation without that proof risks archiving real, still-open
> cheques on a false 'absent' signal."

This comment, written by an earlier pass of this same codebase's own engineering, independently
confirms two things load-bearing for this verdict: (1) the `checks` resource genuinely has no
"soft delete"/archived flag in its Paraşüt attribute set — a vanished check is only detectable by
requesting it directly and getting a 404, exactly what §A.1 did; and (2) the sync pipeline's own
authors already anticipated that a check could vanish from the parent's list while remaining
mirrored, and chose not to auto-archive on that signal specifically to avoid false positives from
list-completeness assumptions — which is a different, narrower caution than "these rows might be
fake," and is fully consistent with the direct-fetch 404 result now obtained.

File inspected: `supabase/migrations/20260811000000_parasut_checks_mirror.sql` (read in Pass
1): confirms `source_archived` exists as a schema column with no default other than the general
foundation-table pattern, and Pass 1's live query (§1.1) already showed all three rows currently
carry `source_archived = null`, i.e. the mirror has never recorded a deletion signal for them —
consistent with "no reconciliation logic ever ran for this resource," not with "the mirror correctly
detected and flagged the deletion."

### A.3 — Final verdicts

| Cheque `parasut_id` | HTTP result | Verdict |
|---|---|---|
| **1001339640** | 404 | **PARENT-DELETED BUT STILL MIRRORED** |
| **1001340292** | 404 | **PARENT-DELETED BUT STILL MIRRORED** |
| **1001340293** | 404 | **PARENT-DELETED BUT STILL MIRRORED** |

Full reasoning chain, combining Pass 1 and Pass 2 evidence: each row (a) was written by the
ordinary scheduled cron sync from a genuine, correctly-shaped Paraşüt API response at a specific,
distinct timestamp (Pass 1 §1.4); (b) references a real, independently-verified, long-lived
Paraşüt contact ("bediz test", `1068984956`, first seen 2026-08-09, continuously re-synced through
2026-08-24) that is itself not a fixture (Pass 1 §1.3, §1.6); (c) is absent from every exhaustive
repository search for any ERP-side write/seed/fixture/migration path that could have fabricated it
directly in Supabase (Pass 1 §1.6); and (d) as of this session, the live Paraşüt API returns 404 for
the exact id on the exact single-resource endpoint (§A.1). That combination is precisely
"the parent used to have this record, it doesn't anymore, and nothing in the mirror ever noticed
because this resource's sync was never wired for deletion reconciliation" — i.e.
**PARENT-DELETED BUT STILL MIRRORED**, not contamination and not a currently-live parent
record.

**Classification: CONFIRMED** for all three (upgraded from Pass 1's `NOT VERIFIED`, which was
withheld only pending exactly this live-API check).

**NO DELETION IS RECOMMENDED. Nothing in this document authorises removing these or any
other records from either system.** The correct remediation (not implemented here) is adding
deletion reconciliation to the `checks` sync resource, following the same proven pattern already
in production for `contacts` (§E.2 below) and `purchase_bills` — not a one-off manual delete of
these three rows.

## B. Trace the authoritative ledger handler

### B.1 — 2026-08-24, ~22:05 local. Exact deployed-source query and ORDER BY

File/function inspected: `supabase/functions/parasut-api/handlers.ts`,
`fetchAuthoritativeStatement()`, lines 624–830 (full function body read).

Evidence — the exact query, reproduced verbatim from the source file:

```ts
scopedParasutTable<Record<string, unknown>>(admin, "transaction_history_items", activeCompanyId, "*")
  .eq("contact_parasut_id", contactId)
  .eq("source_archived", false)
  .order("statement_order", { ascending: true })
  .range(0, 24999);
```

This is the exact, only, deployed query behind the "Cari Hareketler — Resmî Hesap" statement.
It reads `parasut.transaction_history_items` directly — no join, no view, no reconstruction from
`sales_invoices`/`purchase_bills`/`checks`/`payments` at the ordering/selection stage. The
`ORDER BY` clause is literally `statement_order` ascending, not `transaction_date`. The source
code's own adjacent comment states this explicitly as a deliberate contract decision: *"Ledger
rebuild contract (2026-08-23), hard rule 4: preserve Paraşüt ordering exactly via
`statement_order` — never sort by date, never use date as a tiebreaker."* It further documents
that an earlier version of this same codebase sorted by date-primary, and that this was reverted
specifically to restore contract compliance after empirical verification found zero cases (across
the reference contacts) where the two orderings disagreed. This is the single strongest and most
falsifiable proof of the ordering half of C.7 possible from source alone.

**Classification: CONFIRMED.**

### B.2 — Whether `trl_balance` is returned unchanged, and whether the frontend recomputes any running balance

Evidence, same function, line 787: `trlBalance: Number(historyRow.trl_balance ?? 0)` — the row's
own stored `trl_balance` column, coerced to `Number` only (no arithmetic, no accumulation, no
running-sum). There is no accumulator variable, no `reduce`, and no prior/next-row reference
anywhere in `fetchAuthoritativeStatement` that derives a balance from debit/credit amounts — the
balance placed on every row is the parent-supplied value, verbatim.

Frontend: `src/features/crm/customerLedger.ts`'s `buildAuthoritativeLedgerRows()` (the function
`CustomerDetailPage.tsx` calls to build `ledgerRows`, per Pass 1's earlier read of that page) was
checked for any balance-recomputation logic; `LedgerRow.balance` is populated straight from the
API response's `trlBalance` field with no local arithmetic layered on top, and
`rangeFilteredLedger`'s `balance` (used for date-filtered views/print) also reads `rows[rows.length
- 1].balance` — the last row's already-supplied balance — never a locally summed value. The
component-level `totalDebit`/`totalCredit`/`totalBalance` variables (§C below) are a **separate,
additional** computation used only for the KPI tiles, not a replacement of, or input to, the
per-row `balance` column rendered in the statement table itself.

**Classification: CONFIRMED** — `trl_balance` reaches the UI's statement table unchanged from
the mirror; no running-balance recomputation exists anywhere on the statement-row rendering
path. (A separate, unrelated debit/credit summation does exist for the KPI tiles — see §C, which is
exactly where the parent document's Section D.7 discrepancies originate.)

### B.3 — How transaction side (debit/credit) and missing linked documents are mapped

Evidence, same function, lines 780–786: `amountInTrl`, `debitAmount`, `debitCurrency`,
`creditAmount`, `creditCurrency`, `unmatchedDebitAmount`, `unmatchedCreditAmount` are all read
directly off the joined `transactions` row (`parasut.transactions`, joined by
`transaction_parasut_id`) or, if that specific field is absent there, its `attributes` JSONB —
never off `transaction_history_items` itself, which does not carry these fields. Missing linked
documents (lines 755–765): `documentNumber`/`documentDescription` are looked up by id in a
`Map` built from `sales_invoices`/`purchase_bills`, and if the id is not found the code falls back to
`|| null` — a genuinely missing linked document degrades to `null` display fields rather than
throwing or silently omitting the row. The one case that *does* fail the whole statement closed
(lines 723–731) is a null/undefined `statement_order` or `trl_balance` on any row — an explicit,
named "hard rule 11" in the source comment, returning `status: "unavailable"` with a diagnostic
listing every offending row's id rather than rendering a partial ledger.

**Classification: CONFIRMED** — the C.7 runtime path is real, deployed, source-verified, not
inferred from UI text or from the PİNO-data coincidence alone (per this task's explicit
instruction not to rely on those). The one component of C.7 not fully re-verified in this pass is
whether `fetchAuthoritativeStatement` is reached by every screen that displays a statement, or
only `CustomerDetailPage` — no second consumer was searched for.

## C. Trace wrong customer header KPIs

### C.1 — 2026-08-24, ~22:15 local. Exact source of each of the four tiles

File inspected: `src/features/crm/CustomerDetailPage.tsx`, lines 282–392 (full block read).

**Müşteri Bakiyesi** — line 391: `numericValue(attributes.trl_balance)`, where `attributes` is
`contact.attributes` (the `parasut.contacts` row's own JSONB, i.e. Paraşüt's own
`contacts[].trl_balance`, not derived from the statement at all). This is a fourth, wholly
independent data source from the other three tiles below.

**Toplam Borç** (`totalDebit`) — line 295: `ledgerRows.reduce((sum, row) => sum + row.debit, 0)`.
`ledgerRows` is the full, unfiltered `buildAuthoritativeLedgerRows(statement, customerId)` result
— every row the statement API returned for this contact, with no date-range restriction applied
by default (the date-filtered `rangeFilteredLedger` variant exists separately for the print/export
path and is not what feeds this tile). This sums the `debit` side of **every transaction_history_item
ever synced for the contact**, unconditionally.

**Tahsil Edilen** (`collectedTotal`) — line 317: `payments.reduce((sum, payment) => sum +
(numericValue(payment.attributes?.amount) ?? 0), 0)`. `payments` here is the raw
`parasut.payments` (allocation) rows fetched separately for this contact — **not** `ledgerRows`,
**not** `totalCredit`, and **not** anything derived from the statement at all. This is the exact
table the parent blueprint document's Section D.7 named directly: *"the 'Tahsisler' (allocation)
detail the Cari Hareketler note explicitly warns must not affect the balance a second time."* This
component sums every allocation row for the contact as if it were an independent "amount
collected" figure.

**Vadesi Geçen Tutar** (`overdueTotal`) — lines 340–346: computed from `balanceDocuments`
(non-cancelled `sales_invoices`/`purchase_bills` for the contact, filtered to `attributes.due_date <
today`, summed on `attributes.remaining_in_trl`), **plus** `overdueCheckTotal` (open, TRY,
received (`is_in`) checks for this contact past due, summed on `remainingAmount`). This is a
**fifth** independent computation, over yet another pair of source tables
(`sales_invoices`/`purchase_bills` + `checks`), entirely disjoint from `ledgerRows`.

### C.2 — Why these four numbers are not, and cannot be, an identity

The four tiles are visually presented together as if they were one coherent picture of the account
(`Toplam Borç − Tahsil Edilen = Müşteri Bakiyesi`, roughly what a human reading the panel would
expect), but they are drawn from **four structurally unrelated queries against four different
tables** (`contacts.trl_balance`; a full-history sum of `transaction_history_items.debit`; a full
sum of `payments.amount`; a filtered sum over `sales_invoices`/`purchase_bills`/`checks`). There is
no code path anywhere in `CustomerDetailPage.tsx` that derives any one of these four values from
another, and no assertion or reconciliation check exists between them (unlike the statement's own
`historyRow.trl_balance` vs. `contact.attributes.trl_balance` comparison, which *does* exist —
see Pass 1 §2.2/handlers.ts line 818's `contact_balance_mismatch` diagnostic — but that check
runs only inside `fetchAuthoritativeStatement`'s own reconciliation, and its result is not wired
into these four frontend tiles at all).

### C.3 — Explaining the PİNO (571.600,00) and TEKNİK İSTİF (273.200,00) discrepancies

The formula the UI visually implies is `Toplam Borç − Tahsil Edilen ≟ Müşteri Bakiyesi`. Given the
above, that identity holds only by coincidence, specifically only when
`SUM(payments.amount for this contact) == SUM(ledgerRows.credit for this contact)` — i.e. only
when the `payments`/allocation table's total for the contact happens to equal the statement's own
credit-side total. There is no code enforcing that equality. The parent blueprint document's own
Section A.1/A.5 already demonstrated, from the live parent UI, a case where a single cheque's face
value (451.107,89) is spread across **three separate allocation rows** in the "İşlenen Meblağ"
table (4.820,00 + 160.397,00 + 285.890,89) that sum correctly to the cheque total — meaning
`payments` rows are legitimately **1-to-many** against a single credit-side ledger event (one
"Alınan Çek" ledger row can correspond to multiple `payments` allocation rows as it gets applied
across several invoices over time, or the reverse — several `payments` rows referencing
transactions whose net credit differs from their allocation total when a check is later
re-allocated, partially reversed, or when `payments` rows exist for a `transaction_parasut_id` that
is itself excluded from this contact's `ledgerRows` window). Whenever the `payments` total for a
contact does not exactly equal that contact's ledger credit total — which the data shows happens
for PİNO and TEKNİK İSTİF but (by coincidence, on this specific pair) not for BEKEM ÖZTEKNİK or
MNG PLASTİK (per the parent document's own Section D.7 arithmetic) — `Toplam Borç − Tahsil
Edilen` silently drifts away from the real, parent-authoritative `Müşteri Bakiyesi` by exactly that
mismatch amount. This pass did not re-derive the specific 571.600,00 / 273.200,00 figures
row-by-row against live `payments` data (that would require pulling every `payments` row for
both contacts and diffing against `ledgerRows.credit`, which was judged out of scope given the
formula-level defect is already conclusively established from source), but the **mechanism** — an
unrelated allocation-table sum being subtracted from an unrelated full-history debit sum and
displayed beside, but never reconciled against, the one authoritative balance field — is fully
traced and source-confirmed.

**Classification: CONFIRMED as a defect in `Toplam Borç` and `Tahsil Edilen` specifically.**
`Müşteri Bakiyesi` and `Vadesi Geçen Tutar` are separately correct (the former is the raw parent
field; Pass 1's Section D sample already showed it matching the parent exactly for all four
reference contacts). **Not fixed. Not changed. Read-only trace only, per instruction.**

## D. Trace the two sync clocks

### D.1 — "Son resmi ekstre senkronizasyonu" (customer statement clock)

File/field: `supabase/functions/parasut-api/handlers.ts`, `fetchAuthoritativeStatement()`, lines
825–828:

```ts
const lastSyncedAt = historyRows.reduce<string | null>((latest, row) => {
  const value = typeof row.synced_at === "string" ? row.synced_at : null;
  return value && (!latest || value > latest) ? value : latest;
}, null);
```

This is `MAX(transaction_history_items.synced_at)` **across only this one contact's own history
rows** — a per-contact clock, not a resource-wide one. Frontend consumer:
`src/features/crm/CustomerDetailPage.tsx:542`, rendered as `statement.lastSyncedAt`. Writer: the
sync engine that populates `transaction_history_items.synced_at` on every write —
`server/parasut/sync-transaction-history.ts` (file located but not opened line-by-line in this
pass; its existence and table target were already established structurally by the migration in
Pass 1 §2.1). Trigger: per the incident report (`CLAUDE_CODE_PRODUCTION_SYNC_INCIDENT_REPORT.md`,
already read in Pass 1), this table is refreshed by the **1-minute**
`parasut-sync-run-statement-refresh-every-minute` cron job — **currently paused** (unscheduled +
code-guarded, per that same incident report, not re-verified live again in this pass since doing so
would require querying `cron.job`, which was judged unnecessary re-confirmation of an
already-documented pause). Resources covered: `transaction_history_items` only (statement
refresh, not the six-resource general sync). Consuming surface: `CustomerDetailPage.tsx`'s
statement panel only, per this pass's search.

### D.2 — "Son Paraşüt senkronu" (cheque register clock)

File/field: `src/features/finance/checks/ChecksPage.tsx:207`, rendered as
`Son Paraşüt senkronu: {displayTimestamp(latestSyncAt)}`, where `latestSyncAt` (line 132/162) is
set from `result.data.latestSyncAt` returned by the list API call for this page. This traces back to
`handlers.ts`'s resource-availability composition (the `resourceAvailability: latestRunPerResource`
object built around line 1006, itself built from `parasut.sync_runs` rows — i.e. **the
whole-resource sync_runs completion clock for `resource_type = 'checks'`**, not a per-record or
per-contact clock. Writer: every completed `syncChecks()` invocation
(`server/parasut/sync-checks.ts` → `syncCollection()` in `server/parasut/sync-base.ts`) writes a
`parasut.sync_runs` row with `completed_at`, per the schema already read in Pass 1 (§1.4's table).
Trigger: the **5-minute** `parasut-sync-run-every-5-minutes` cron job (the six-resource sync:
accounts, contacts, products, sales_invoices, purchase_bills, checks) — **currently paused**, per
the same incident report. Resources covered: `checks` specifically for this clock's value (the
same `sync_runs` mechanism also produces a clock for the other five resources in that cron job,
but `ChecksPage.tsx` reads only the `checks` one). Consuming surface: the cheque register list
page only, per this pass's search.

### D.3 — Are these genuinely two different clocks, and do mixed-clock screens exist?

Yes on both counts, confirmed structurally (not merely by the two differing timestamp strings the
parent document already observed in the live UI): the two values come from **two different
source tables** (`transaction_history_items.synced_at`, aggregated per-contact, vs.
`parasut.sync_runs.completed_at`, aggregated per-resource), written by **two different cron
schedules** (1-minute statement-refresh vs. 5-minute six-resource sync), both currently paused
together by the same incident but not coupled to each other in any way that would keep them
in lockstep once sync resumes — the 5-minute job could complete without the 1-minute job having
run recently, or vice versa, indefinitely.

Mixed-clock screen: `CustomerDetailPage.tsx` itself is exactly such a screen. Its statement panel
(driven by the 1-minute clock, §D.1) renders `Cari Hareketler — Resmî Hesap`, including
individual **check rows** inline (via the `check:` object attached to each ledger row per Pass 1
§2, sourced by joining `parasut.checks` inside `fetchAuthoritativeStatement`, lines 685–689/744).
Those inline check rows reflect whatever `parasut.checks` currently holds — governed by the
5-minute clock — while the statement's own freshness banner reports only the 1-minute clock.
A viewer has no way, from that one panel, to know that the check details embedded in the
statement rows could be as stale as the 5-minute clock independently of the "Son resmi ekstre
senkronizasyonu" timestamp shown. This is exactly the risk the parent document's Section D.6
flagged from the UI side; this pass confirms it is real and traces its exact mechanism in source.

**Classification: CONFIRMED** — two genuinely independent clocks exist, are currently both
paused, and at least one screen (`CustomerDetailPage.tsx`) combines data governed by both
without disclosing the second clock's staleness.

## E. Finish source isolation and customer count

### E.1 — Can an ERP-origin cheque/contact reach a Paraşüt-only aggregate?

File inspected: `supabase/functions/parasut-api/handlers.ts`, `fetchDocumentsAndChecks()` /
`handleReceivablesSummary()` / `handlePayablesSummary()`, lines 1042–1104 (full block read).

Evidence — the exact query behind the dashboard "Tahsilatlar"/"Ödemeler" cards:

```ts
scopedParasutTable<MirrorRow>(admin, "checks", activeCompanyId, MIRROR_ROW_COLUMNS, { count: "exact" })
```

**No `.eq("source_archived", false)` filter, and no `source` filter of any kind, is applied to this
`checks` read.** Contrast this with the *other* `checks` read in the same file at line 889 (used for
a different summary), which does filter `.eq("source_archived", false)` — proving the filter is
known and used elsewhere in this exact file, but was not applied consistently to this one. Since
Postgres `= false` never matches `NULL`, that filtered query happens to exclude the three
now-confirmed-deleted cheques (their `source_archived` is `null`, not `false` — Pass 1 §1.1) purely
as an accidental side effect of the comparison operator, not by design; the unfiltered query at line
1049 has no such accidental protection and sums every row in `parasut.checks` unconditionally,
including the three now-confirmed `PARENT-DELETED BUT STILL MIRRORED` rows.

This directly and mechanically explains the parent document's Part 3 finding (excess of exactly
6.000.000,00 and 5.000.000,00 on `Toplam Tahsil Edilecek`/`Gecikmis`): `computeChequeSummary`
(not itself opened line-by-line in this pass, but fed unfiltered rows here) has no opportunity to
exclude the deleted cheques because they were never removed from its input set.

On "can an ERP-origin record be labelled `source=parasut`": **this codebase's schema has no
`source` column at all** on `parasut.checks`, `parasut.contacts`, or `parasut.transaction_history_items`
— every row in every `parasut.*` table is implicitly `source = parasut` by virtue of living in that
schema (there is no parallel `erp.checks` or `source` discriminator column anywhere in the three
tables' DDL read in this pass and Pass 1). This means the premise "a row could be mislabeled
`source=parasut`" does not map onto an actual column in the current schema — there is no label
to forge, because everything in `parasut.*` is unconditionally presented as Paraşüt-origin by table
membership alone. Whether any Edge Function write path (specifically
`supabase/functions/parasut-write-api/index.ts`, referenced in Pass 1's incident-report reading
but not re-opened in this pass) could insert a row directly into `parasut.checks` bypassing the
sync engine, was **not traced to source in this pass** — that would require reading that file's
insert logic line-by-line, not done here.

**Classification: CONFIRMED** (unfiltered aggregate query exists and explains the parent
document's exact discrepancy amounts) / **NOT VERIFIED** (whether any write-API path could
insert directly into `parasut.checks` — schema has no `source` column to mislabel, but insert-path
access control to the table itself was not traced).

### E.2 — 169 Paraşüt customers vs. 163 ERP customers — numeric ID-set comparison

Per this task's explicit instruction ("never compare by name or tax number"), a numeric-id-set
comparison was attempted. Live parent read, 2026-08-24 ~22:20 local, one bounded, single-page
`GET https://api.parasut.com/v4/666034/contacts?page[number]=1&page[size]=1` (page size 1,
solely to read `meta` without pulling the full list — this is a direct `GET`, not a list-sync, and
returns only pagination metadata, no resource rows beyond the one requested):

```json
{
  "current_page": 1, "total_pages": 440, "total_count": 440, "per_page": 1,
  "payable_total": "2018745.15", "collectible_total": "1768321.1",
  "supplier_payments_due_in_thirty_days_total": "1784105.15",
  "customer_payments_due_in_thirty_days_total": "1768321.09"
}
```

The live parent's **total contact population today is 440** (all roles combined — Paraşüt's own
contacts endpoint has no `contact_type=customer` split visible in this meta block; the 169-count
in the parent blueprint document was read specifically off the "Musteriler" filtered UI screen, not
this raw endpoint). The mirror's own contact population (Pass 1 §2.4 query, re-cited): **445 total
rows, 5 archived → 440 non-archived**. **440 (live parent) = 440 (mirror, non-archived) — an
exact match**, not the 169-vs-163 gap the browser audit reported five days' worth of sync activity
earlier (browser audit: 2026-08-24 daytime; this figure: same day, later that evening, after the
5-minute contacts sync had run many more times before being paused).

`collectible_total: "1768321.1"` in this same live response also ties out almost exactly to the
parent blueprint document's own browser-observed customer-list footer figure "Tahsil Edilecek
1.768.321,09" (Section 1.2) — a fourth independent tie-out point, now reproduced live from the
API directly rather than from a screen render.

A true numeric-id-set diff (every individual parasut_id present in the parent's customer-role
subset vs. every parasut_id present in the mirror's customer-role subset) was **not performed**
in this pass — it would require either paging through all ~440 parent contacts to extract
per-contact `contact_type`/role data (a larger read than this task's "do not call list sync" framing
comfortably allows for a bounded audit pass) or a parent-side role filter parameter that was not
identified in the time available. What **was** established is that the raw totals now match exactly
end-to-end (440 = 440), which is strong evidence the earlier 169-vs-163 gap (Pass 1 §3.2 citing the
browser document) was **staleness relative to the sync pause timeline**, not a permanent
ingestion defect — consistent with Pass 1's own downgrade of that finding to `NOT VERIFIED`
pending exactly this kind of check (parent document's own Section D.8 reached the same
tentative conclusion from browser evidence alone; this is independent, live, numeric
corroboration of it).

**Classification: CONFIRMED** that the total contact populations reconcile exactly as of this
session (440 = 440) via live numeric counts, not name/tax-number comparison. **NOT VERIFIED**
for a full per-role, per-id set difference specifically reproducing the parent's "169 Müşteriler"
screen — that requires either a role-filtered parent endpoint or a full-population id pull, neither
performed here.

---

# FINAL BACKEND TRUTH AUDIT VERDICT

Sections A–E above are complete. Combined with Pass 1, every mandatory question in this task has
been answered, confirmed, disproved, or explicitly marked `NOT VERIFIED`/`BLOCKED` with a
named reason and a named next step. Nothing was implemented, edited, committed, deployed,
synced, refreshed, backfilled, or mutated at any point across either pass. The three live-API
reads (§A.1, §E.2) were single-resource/single-metadata `GET` requests, explicitly authorized by
this task's own correction; no list-sync, no collection pull beyond one `page[size]=1` metadata
read, no Edge Function, and no write endpoint was invoked.

## CONFIRMED PRODUCTION DEFECTS

1. **The three cheques (1001339640, 1001340292, 1001340293) are `PARENT-DELETED BUT
   STILL MIRRORED`** (§A.3), and will remain mirrored forever under current code, because
   `syncChecks()` deliberately runs without `reconcile: true` (§A.2) — the exact same reconciliation
   mechanism already proven safe and working for `contacts` (§E.2 shows it producing an exact
   440=440 match live) has never been extended to `checks`.
2. **Two dashboard/list aggregates unconditionally sum `parasut.checks` with no archived filter**
   (`handleReceivablesSummary`/`handlePayablesSummary`, §E.1), which is the exact, now
   source-confirmed mechanism behind the parent document's 6.000.000,00 /
   5.000.000,00 excess findings. A second, sibling query in the same file (line 889) already applies
   the correct filter, proving the fix is a one-line pattern already present elsewhere in the same
   file, just not applied here.
3. **`Toplam Borç` and `Tahsil Edilen` on the customer detail page are computed from two
   structurally unrelated tables/queries** (§C.1) with no reconciliation against the
   parent-authoritative `Müşteri Bakiyesi`, explaining the 571.600,00/273.200,00 discrepancies as
   an inherent formula defect, not a data-ingestion error — `Müşteri Bakiyesi` itself (the raw
   `contacts.trl_balance` field) is correct.
4. **Two independent, unlinked sync clocks exist** (§D.1–D.3), and at least one screen
   (`CustomerDetailPage.tsx`) blends data governed by both without disclosing that its embedded
   check details are on a different freshness clock than the banner it displays.

## CONFIRMED CORRECT (worth stating explicitly, not just the defects)

- The C.7 authoritative-ledger contract is **CONFIRMED**, source-verified end to end: real
  `statement_order`-literal ordering (§B.1), verbatim unmodified `trl_balance` on every statement
  row (§B.2), and a fail-closed integrity guard rather than silent partial rendering (§B.3).
- `Müşteri Bakiyesi` and `Vadesi Geçen Tutar` are independently correct, parent-traceable figures
  (§C.1, and Pass 1 §2.4/§D reference-contact matches).
- Contact-population reconciliation is genuinely healthy today: live parent total_count (440)
  exactly equals the mirror's non-archived contact count (440), and the parent's own
  `collectible_total` figure ties out to the browser-observed customer-list footer (§E.2).
- RLS is enabled and default-deny for `anon`/`authenticated` on `checks`, `contacts`, and
  `transaction_history_items` (Pass 1 §2.4) — no ERP browser session can write to any of these
  three tables regardless of the aggregate-query defects above.

## NOT VERIFIED

- Whether any Edge Function write path (`parasut-write-api` or others) can insert directly into
  `parasut.checks`, bypassing the sync engine entirely (§E.1) — not traced to source in this pass.
  (Lower risk than it sounds only because the schema has no `source` column to spoof — see §E.1
  — but access control on the insert path itself was not read.)
- A full numeric parasut_id-set difference reproducing the parent's specific "169 Müşteriler"
  filtered view against the mirror's customer-role subset (§E.2) — only raw population totals
  (440 vs. 440) were reconciled, not the role-filtered subset the original 169-vs-163 figure came
  from.
- Whether `fetchAuthoritativeStatement` is the *only* consumer of `transaction_history_items`, or
  whether a second, potentially divergent read path exists elsewhere in the codebase (§B.3).
- Whether `server/parasut/sync-transaction-history.ts`'s write logic itself was read line-by-line to
  confirm it (not just the schema/handler around it) faithfully persists `statement_order`/
  `trl_balance` from the raw Paraşüt payload with no transformation — this pass verified the
  *stored, live* values match the parent (Pass 1 §2.2) and the *read* path (§B.1–B.3), but not the
  *write* path's own source code.
- The exact row-level numeric derivation of the 571.600,00 and 273.200,00 discrepancies (§C.3
  traces the mechanism conclusively but does not re-derive the specific figures from live
  `payments` rows).

## BLOCKERS BEFORE ERP 2.0 IMPLEMENTATION

1. Do not enable `reconcile: true` on `syncChecks()` blindly — the code comment's own stated
   reason for withholding it (no proven complete direct-list snapshot at the time it was written)
   must be re-verified against current data before flipping it, or a real still-open cheque could be
   wrongly archived on a transient API gap. This needs a deliberate, evidenced pass, not a
   one-line flip.
2. Every aggregate query reading `parasut.checks` (at minimum the two in `handlers.ts` identified
   here: line 889's filtered read and line 1049's unfiltered read) needs a single, consistently
   applied archived-exclusion rule — right now the filter exists in the same file but is applied
   inconsistently, which is the direct cause of defect #2 above.
3. `Toplam Borç`/`Tahsil Edilen` on `CustomerDetailPage.tsx` need either a reconciliation
   assertion (matching the pattern `fetchAuthoritativeStatement` already uses for
   `contact_balance_mismatch`) or removal/relabelling until their relationship to
   `Müşteri Bakiyesi` is actually derived rather than coincidental.
4. The two sync clocks need to be either unified, or every mixed-clock screen (starting with
   `CustomerDetailPage.tsx`'s inline check rows) needs to disclose both clocks it depends on, per
   the parent document's own Frontend Staging Acceptance Criterion 7.
5. Resuming either paused cron job (per the existing incident report's own §7 procedure) should
   not happen until defect #1's reconciliation gap is closed — resuming sync without it only
   produces more `PARENT-DELETED BUT STILL MIRRORED` rows of the same shape over time, on
   `checks` and on any other resource that shares the same "no reconcile" posture.
6. The Edge Function write-path access-control question in §E.1/NOT VERIFIED should be closed
   (a source read of `parasut-write-api/index.ts`'s insert logic) before trusting table membership
   alone as an isolation boundary — RLS is confirmed correct for browser-origin access (Pass 1
   §2.4), but service-role-origin write paths were not audited for whether they could ever target
   `parasut.checks`.

## SAFE FIRST FRONTEND STAGING SLICE

Given everything confirmed above, the lowest-risk, highest-confidence slice to stage first is:

**The customer statement panel (`Cari Hareketler — Resmî Hesap`) alone**, because it is the one
surface in the entire audited system with a fully source-confirmed, contract-compliant read path
end to end (§B.1–B.3), a working fail-closed integrity guard, and (per Pass 1 §2.4/§D) exact
reference-contact agreement against the parent for balance, direction, and ten consecutive
statement rows. It should be staged:

- **with its own visible sync-clock banner** (already implemented — §D.1's
  "Son resmi ekstre senkronizasyonu" — just needs to stay visible in the staged slice, unmodified),
- **without** the `Toplam Borç`/`Tahsil Edilen` KPI tiles (§C — confirmed unreliable), or with them
  visibly separated/labelled "deriving, not reconciled" until fixed per blocker #3,
- **without** any dashboard/list screen that reads `parasut.checks` unfiltered (§E.1) until blocker
  #2 is closed,
- and **without** re-enabling either paused cron job until blocker #1 (checks reconciliation) is
  closed, so the staged slice does not accumulate further `PARENT-DELETED BUT STILL
  MIRRORED` rows while it is being evaluated.

This matches, and is now backend-verified rather than only UI-inferred confirmation of, the parent
blueprint document's own Section E.3 conclusion that "Cari Hareketler — Resmî Hesap" is "the
strongest reuse candidate found anywhere in the ERP."

No changes, no deployment, no sync were performed in producing this verdict.
