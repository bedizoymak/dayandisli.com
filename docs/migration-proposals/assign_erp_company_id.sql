-- PREPARED, NOT EXECUTED. Requires explicit approval before running against
-- production. This is a one-time DATA assignment (DML), not a schema
-- migration — it does not belong in supabase/migrations/.
--
-- Purpose: assign the proposed canonical ERP_COMPANY_ID
-- (54b50745-89e0-4b97-adb6-4f2426fa2a2f — see
-- PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md §14c) to the sole currently
-- authorized ERP user, so the corrected tenant-isolation logic
-- (supabase/functions/_shared/company-scope.ts) has a valid company to
-- resolve for that user instead of rejecting every request.
--
-- Safety properties:
--   - Idempotent / rerunnable: the WHERE clause excludes rows that already
--     contain the target UUID, so running this twice is a no-op the second
--     time — it can never insert a duplicate.
--   - Preserves existing array contents: uses array_append, never
--     `accessible_company_ids = array[...]` (which would clobber any other
--     company ids already present).
--   - Updates only the intended row: scoped by primary key `id`, not by a
--     broader predicate like role or email pattern.
--   - Returns verification rows: both a before/after read and a RETURNING
--     clause on the UPDATE itself, so the actual effect is visible without
--     a separate follow-up query.

-- 1. Verify current state (read-only).
select id, email, role, accessible_company_ids
from public.erp_users
where id = '98a395c3-d437-442c-83df-4d0519966acf';

-- 2. Idempotent, rerunnable assignment.
update public.erp_users
set accessible_company_ids = array_append(accessible_company_ids, '54b50745-89e0-4b97-adb6-4f2426fa2a2f'::uuid)
where id = '98a395c3-d437-442c-83df-4d0519966acf'
  and not ('54b50745-89e0-4b97-adb6-4f2426fa2a2f'::uuid = any (accessible_company_ids))
returning id, email, accessible_company_ids;

-- 3. Verify final state (read-only) — expect exactly one occurrence of
--    54b50745-89e0-4b97-adb6-4f2426fa2a2f in accessible_company_ids,
--    regardless of how many times step 2 has been run.
select
  id,
  email,
  accessible_company_ids,
  (select count(*) from unnest(accessible_company_ids) as x where x = '54b50745-89e0-4b97-adb6-4f2426fa2a2f'::uuid) as target_uuid_occurrences
from public.erp_users
where id = '98a395c3-d437-442c-83df-4d0519966acf';
