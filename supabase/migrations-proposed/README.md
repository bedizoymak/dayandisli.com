# Proposed (NOT auto-applied) migrations

Files here are **review-gated retirement scripts**. They are deliberately
OUTSIDE `supabase/migrations/` because everything in that directory is
auto-applied by `supabase db push` — and destructive schema changes must
never happen as a side effect.

Apply procedure for each file:
1. Complete the matching checklist in `docs/database-generation-retirement.md`
   against a STAGING restore.
2. Move the file into `supabase/migrations/`.
3. Push to staging, run the finance + customer-statement smoke matrix.
4. Only then push to production within the documented maintenance window.

Current contents:
- `20260826000000_retire_public_parasut_gen1.sql` — drops the superseded
  gen-1 mirror (`public.parasut_*`, created 20260613194043) after a
  fail-closed dependency probe; rows are archived into dated
  `public._retired_<date>_*` side tables first. Verified prerequisites as of
  2026-08-25: zero code references outside its own creation migration and
  generated types (types.ts regeneration happens post-drop on next CLI run).
