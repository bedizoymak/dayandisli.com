# Phase 1 Result

## Phase Summary

Phase 1 produced the database design for the Paraşüt read-only mirror layer.
The design covers eight confirmed JSON:API resource tables and recommends
auditable synchronization-run and sanitized-error infrastructure.

The mirror remains strictly separate from ERP domain modeling.

## Files Created

- `docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`
- `docs/phase-results/PHASE_1_RESULT.md`

## Files Inspected

- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/PHASE_0_PARASUT_MIRROR_ARCHITECTURE.md`
- Paraşüt discovery scripts under `tools/parasut/`
- sanitized discovery reports and JSON samples under
  `tools/parasut/discovery/`
- current Supabase table, trigger, multi-company, tenant RLS, and security
  governance migrations

No environment file, secret, token, password, or unsanitized personal payload
was inspected for inclusion in the design.

## Design Decisions Made

- Use eight resource-specific mirror tables.
- Use `uuid` internal primary keys.
- Enforce source identity with
  `parasut_company_id + resource_type + parasut_id`.
- Add DAYAN `company_id` for tenant ownership without adding branch or ERP
  domain relationships.
- Preserve attributes, relationships, included resources, and raw payloads as
  JSONB.
- Use canonical SHA-256 hashes excluding included resources and local metadata.
- Preserve explicit archive state and never infer deletion from absence.
- Upsert included confirmed resources into their own mirror tables.
- Retain unconfirmed included resources only in parent snapshots.
- Recommend `parasut_sync_runs` and `parasut_sync_errors`.
- Defer `parasut_sync_cursors` until incremental semantics are verified.
- Enable RLS with no anonymous access and no browser write policies.
- Default raw mirror reads to approved company-wide administrators.
- Reserve ingestion for a trusted server-side service-role process.

## What Was Intentionally Not Done

- No application code was implemented.
- No migration was created or applied.
- No database schema or RLS policy was changed.
- No RPC was created.
- No ERP domain table was modified or designed.
- No CRM partner or stakeholder model was designed.
- No Sales, Purchasing, Inventory, or Finance mapping was designed.
- No Paraşüt request was made.
- No Paraşüt write operation was performed.
- No commit or push was performed.

## Risks and Unknowns

- Pagination and incremental filtering remain unverified.
- Source deletion behavior remains unknown.
- A standalone complete payments collection is not confirmed.
- Purchase bill `spender` has not been observed with a populated relationship.
- Several related resources remain unconfirmed as independent endpoints.
- A dedicated integration permission for RLS is not yet available.
- Historical payload retention and expected data volume require later approval.
- DAYAN-to-Paraşüt company connection configuration remains to be designed.

## Validation Performed

- Confirmed both required documentation files exist.
- Confirmed the design covers all eight required resource tables.
- Confirmed the design includes identity, JSONB preservation, timestamps,
  hashing, relationships, includes, lifecycle handling, indexes, RLS,
  service-role ingestion, privacy, migration ordering, testing, and unknowns.
- Confirmed no migration or application source file was created or modified.
- Confirmed no database or Paraşüt operation was executed.

## Exact Next Action

Use the prompt under:

`docs/PHASE_1_PARASUT_MIRROR_DATABASE_DESIGN.md`

Section:

`Exact Phase 2 Implementation Prompt`

Phase 2 should implement the local-only additive mirror database foundation and
RLS tests without calling Paraşüt or changing ERP domain tables.
