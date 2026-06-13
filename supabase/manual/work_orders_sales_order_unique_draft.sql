-- DRAFT ONLY
-- Review prerequisite for one work order per non-null sales order.
-- Run with stop-on-error semantics and outside a migration transaction.

select
  sales_order_id,
  count(*) as work_order_count
from public.work_orders
where sales_order_id is not null
group by sales_order_id
having count(*) > 1
order by sales_order_id;

do $$
begin
  if exists (
    select 1
    from public.work_orders
    where sales_order_id is not null
    group by sales_order_id
    having count(*) > 1
  ) then
    raise exception
      'Duplicate work_orders.sales_order_id values must be reviewed before creating the unique index.';
  end if;
end;
$$;

create unique index concurrently if not exists
  uq_work_orders_sales_order_id_not_null
on public.work_orders (sales_order_id)
where sales_order_id is not null;

-- No duplicate cleanup is performed by this draft.
