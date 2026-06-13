-- Production workflow RPC prerequisites.
-- Transaction-safe RLS policy changes only; concurrent index creation is a
-- separate manual deployment step.

alter table public.work_order_operations enable row level security;
alter table public.sales_orders enable row level security;
alter table public.work_orders enable row level security;
alter table public.erp_audit_logs enable row level security;

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

drop policy if exists tenant_member_read_sales_orders on public.sales_orders;
create policy tenant_member_read_sales_orders
  on public.sales_orders
  for select
  to authenticated
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
  on public.sales_orders
  for insert
  to authenticated
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
  on public.sales_orders
  for update
  to authenticated
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

drop policy if exists tenant_member_read_work_orders on public.work_orders;
create policy tenant_member_read_work_orders
  on public.work_orders
  for select
  to authenticated
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
  on public.work_orders
  for insert
  to authenticated
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
  on public.work_orders
  for update
  to authenticated
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

drop policy if exists tenant_member_read_erp_audit_logs on public.erp_audit_logs;
create policy tenant_member_read_erp_audit_logs
  on public.erp_audit_logs
  for select
  to authenticated
  using (
    erp_audit_logs.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = erp_audit_logs.company_id
        and (
          membership.branch_id is null
          or (
            erp_audit_logs.branch_id is not null
            and membership.branch_id = erp_audit_logs.branch_id
          )
        )
    )
  );

drop policy if exists tenant_member_write_erp_audit_logs on public.erp_audit_logs;
create policy tenant_member_write_erp_audit_logs
  on public.erp_audit_logs
  for insert
  to authenticated
  with check (
    erp_audit_logs.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = erp_audit_logs.company_id
        and (
          membership.branch_id is null
          or (
            erp_audit_logs.branch_id is not null
            and membership.branch_id = erp_audit_logs.branch_id
          )
        )
    )
  );

drop policy if exists tenant_member_update_erp_audit_logs on public.erp_audit_logs;
create policy tenant_member_update_erp_audit_logs
  on public.erp_audit_logs
  for update
  to authenticated
  using (
    erp_audit_logs.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = erp_audit_logs.company_id
        and (
          membership.branch_id is null
          or (
            erp_audit_logs.branch_id is not null
            and membership.branch_id = erp_audit_logs.branch_id
          )
        )
    )
  )
  with check (
    erp_audit_logs.company_id is null
    or exists (
      select 1
      from public.company_memberships as membership
      where lower(membership.email) = lower(auth.jwt() ->> 'email')
        and membership.is_active
        and membership.company_id = erp_audit_logs.company_id
        and (
          membership.branch_id is null
          or (
            erp_audit_logs.branch_id is not null
            and membership.branch_id = erp_audit_logs.branch_id
          )
        )
    )
  );
