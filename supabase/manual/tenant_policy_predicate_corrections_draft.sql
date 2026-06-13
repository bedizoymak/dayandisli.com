-- DRAFT ONLY
-- Corrected predicate patterns for production-RPC prerequisite review.
-- This is intentionally not a repository-wide policy replacement.

-- Audit effective policies before applying any correction.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ~ '\m([a-z_][a-z0-9_]*)\.company_id\s*=\s*\1\.company_id\M'
    or coalesce(with_check, '') ~ '\m([a-z_][a-z0-9_]*)\.company_id\s*=\s*\1\.company_id\M'
  )
order by tablename, policyname;

-- Explicit target qualification pattern for sales_orders.
drop policy if exists tenant_member_read_sales_orders on public.sales_orders;
create policy tenant_member_read_sales_orders
  on public.sales_orders for select to authenticated
  using (
    sales_orders.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = sales_orders.company_id
        and (
          membership.branch_id is null
          or (
            sales_orders.branch_id is not null
            and membership.branch_id = sales_orders.branch_id
          )
        )
    )
  );

drop policy if exists tenant_member_write_sales_orders on public.sales_orders;
create policy tenant_member_write_sales_orders
  on public.sales_orders for insert to authenticated
  with check (
    sales_orders.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = sales_orders.company_id
        and (
          membership.branch_id is null
          or (
            sales_orders.branch_id is not null
            and membership.branch_id = sales_orders.branch_id
          )
        )
    )
  );

drop policy if exists tenant_member_update_sales_orders on public.sales_orders;
create policy tenant_member_update_sales_orders
  on public.sales_orders for update to authenticated
  using (
    sales_orders.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = sales_orders.company_id
        and (
          membership.branch_id is null
          or (
            sales_orders.branch_id is not null
            and membership.branch_id = sales_orders.branch_id
          )
        )
    )
  )
  with check (
    sales_orders.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = sales_orders.company_id
        and (
          membership.branch_id is null
          or (
            sales_orders.branch_id is not null
            and membership.branch_id = sales_orders.branch_id
          )
        )
    )
  );

-- Explicit target qualification pattern for work_orders.
drop policy if exists tenant_member_read_work_orders on public.work_orders;
create policy tenant_member_read_work_orders
  on public.work_orders for select to authenticated
  using (
    work_orders.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = work_orders.company_id
        and (
          membership.branch_id is null
          or (
            work_orders.branch_id is not null
            and membership.branch_id = work_orders.branch_id
          )
        )
    )
  );

drop policy if exists tenant_member_write_work_orders on public.work_orders;
create policy tenant_member_write_work_orders
  on public.work_orders for insert to authenticated
  with check (
    work_orders.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = work_orders.company_id
        and (
          membership.branch_id is null
          or (
            work_orders.branch_id is not null
            and membership.branch_id = work_orders.branch_id
          )
        )
    )
  );

drop policy if exists tenant_member_update_work_orders on public.work_orders;
create policy tenant_member_update_work_orders
  on public.work_orders for update to authenticated
  using (
    work_orders.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = work_orders.company_id
        and (
          membership.branch_id is null
          or (
            work_orders.branch_id is not null
            and membership.branch_id = work_orders.branch_id
          )
        )
    )
  )
  with check (
    work_orders.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = work_orders.company_id
        and (
          membership.branch_id is null
          or (
            work_orders.branch_id is not null
            and membership.branch_id = work_orders.branch_id
          )
        )
    )
  );

-- erp_audit_logs also needs explicit target qualification, but its write model
-- must be reviewed together with RPC execution and existing audit grants before
-- replacement policies are packaged.

-- Additional tables generated by the Phase 25, 26, 29, and 30 policy loops
-- require table-by-table review. Do not mechanically apply this pattern without
-- confirming branch columns, ownership paths, command coverage, and null scope.
