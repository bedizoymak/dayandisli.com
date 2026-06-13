-- DRAFT ONLY
-- Review prerequisite for production workflow RPCs. Do not apply to production.

alter table public.work_order_operations enable row level security;

drop policy if exists tenant_member_read_work_order_operations
  on public.work_order_operations;
create policy tenant_member_read_work_order_operations
  on public.work_order_operations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.work_orders as parent_work_order
      where parent_work_order.id = work_order_operations.work_order_id
        and (
          parent_work_order.company_id is null
          or exists (
            select 1
            from public.company_memberships as membership
            where lower(membership.email) = lower(auth.jwt() ->> 'email')
              and membership.is_active
              and membership.company_id = parent_work_order.company_id
              and (
                membership.branch_id is null
                or (
                  parent_work_order.branch_id is not null
                  and membership.branch_id = parent_work_order.branch_id
                )
              )
          )
        )
    )
  );

drop policy if exists tenant_member_insert_work_order_operations
  on public.work_order_operations;
create policy tenant_member_insert_work_order_operations
  on public.work_order_operations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.work_orders as parent_work_order
      where parent_work_order.id = work_order_operations.work_order_id
        and (
          parent_work_order.company_id is null
          or exists (
            select 1
            from public.company_memberships as membership
            where lower(membership.email) = lower(auth.jwt() ->> 'email')
              and membership.is_active
              and membership.company_id = parent_work_order.company_id
              and (
                membership.branch_id is null
                or (
                  parent_work_order.branch_id is not null
                  and membership.branch_id = parent_work_order.branch_id
                )
              )
          )
        )
    )
  );

drop policy if exists tenant_member_update_work_order_operations
  on public.work_order_operations;
create policy tenant_member_update_work_order_operations
  on public.work_order_operations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.work_orders as parent_work_order
      where parent_work_order.id = work_order_operations.work_order_id
        and (
          parent_work_order.company_id is null
          or exists (
            select 1
            from public.company_memberships as membership
            where lower(membership.email) = lower(auth.jwt() ->> 'email')
              and membership.is_active
              and membership.company_id = parent_work_order.company_id
              and (
                membership.branch_id is null
                or (
                  parent_work_order.branch_id is not null
                  and membership.branch_id = parent_work_order.branch_id
                )
              )
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.work_orders as parent_work_order
      where parent_work_order.id = work_order_operations.work_order_id
        and (
          parent_work_order.company_id is null
          or exists (
            select 1
            from public.company_memberships as membership
            where lower(membership.email) = lower(auth.jwt() ->> 'email')
              and membership.is_active
              and membership.company_id = parent_work_order.company_id
              and (
                membership.branch_id is null
                or (
                  parent_work_order.branch_id is not null
                  and membership.branch_id = parent_work_order.branch_id
                )
              )
          )
        )
    )
  );

-- No role grants are added by this draft. Review existing table privileges and
-- overlapping policies before packaging a migration.
