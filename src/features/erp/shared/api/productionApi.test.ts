import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProductionRouteStep,
  SalesOrder,
  SalesOrderItem,
  SubcontractingJob,
  WorkOrder,
  WorkOrderOperation,
} from "../types";

const {
  fromMock,
  createAuditLogMock,
  listSalesOrderItemsMock,
  updateSalesOrderMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  createAuditLogMock: vi.fn(),
  listSalesOrderItemsMock: vi.fn(),
  updateSalesOrderMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("./salesApi", () => ({
  listSalesOrderItems: listSalesOrderItemsMock,
  updateSalesOrder: updateSalesOrderMock,
}));

vi.mock("./internal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./internal")>();
  return {
    ...actual,
    createAuditLog: createAuditLogMock,
    getNextERPNumber: vi.fn(async () => ({ data: "WO-TEST-1", error: null })),
    withEnterpriseOwnership: vi.fn(async (payload) => payload),
  };
});

import {
  createOperationsFromRoute,
  createWorkOrderFromSalesOrder,
  updateSubcontractingJob,
} from "./productionApi";

type QueryResult<T> = { data: T | null; error: unknown };

function query<T>(result: QueryResult<T>) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    order: vi.fn(() => builder),
    or: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: QueryResult<T>) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}

function queueFrom(...builders: ReturnType<typeof query>[]) {
  for (const builder of builders) fromMock.mockReturnValueOnce(builder);
}

const salesOrder: SalesOrder = {
  id: "sales-order-1",
  order_no: "SO-TEST-1",
  stakeholder_id: "stakeholder-1",
  source_quotation_id: null,
  title: "Test Siparişi",
  description: null,
  status: "confirmed",
  priority: "high",
  order_date: "2026-06-13",
  due_date: "2026-06-20",
  currency: "TRY",
  subtotal: 100,
  tax_total: 20,
  grand_total: 120,
  notes: null,
  created_at: "2026-06-13T00:00:00.000Z",
};

const salesOrderItem: SalesOrderItem = {
  id: "sales-item-1",
  sales_order_id: salesOrder.id,
  item_code: "PRT-1",
  description: "Test Parçası",
  quantity: 4,
  unit: "adet",
  unit_price: 25,
  total: 100,
  technical_drawing_id: null,
  created_at: "2026-06-13T00:00:00.000Z",
};

const workOrder: WorkOrder = {
  id: "work-order-1",
  work_order_no: "WO-TEST-1",
  sales_order_id: salesOrder.id,
  stakeholder_id: salesOrder.stakeholder_id,
  title: salesOrder.title,
  part_name: salesOrderItem.description,
  part_code: null,
  quantity: salesOrderItem.quantity,
  status: "planned",
  priority: salesOrder.priority,
  planned_start_date: null,
  planned_end_date: salesOrder.due_date,
  actual_start_at: null,
  actual_end_at: null,
  notes: null,
  created_at: "2026-06-13T00:00:00.000Z",
};

const routeSteps: ProductionRouteStep[] = [
  {
    id: "step-1",
    route_id: "route-1",
    step_no: 10,
    operation_name: "Torna",
    machine_id: "machine-1",
    estimated_minutes: 30,
    notes: null,
    created_at: "2026-06-13T00:00:00.000Z",
  },
  {
    id: "step-2",
    route_id: "route-1",
    step_no: 20,
    operation_name: "Taşlama",
    machine_id: "machine-2",
    estimated_minutes: 15,
    notes: "Kontrol et",
    created_at: "2026-06-13T00:00:00.000Z",
  },
];

function operation(step: ProductionRouteStep): WorkOrderOperation {
  return {
    id: `operation-${step.id}`,
    work_order_id: workOrder.id,
    step_no: step.step_no,
    operation_name: step.operation_name,
    machine_id: step.machine_id,
    assigned_employee_id: null,
    status: "pending",
    planned_minutes: step.estimated_minutes,
    actual_minutes: 0,
    started_at: null,
    completed_at: null,
    quality_required: false,
    notes: step.notes,
    created_at: "2026-06-13T00:00:00.000Z",
  };
}

describe("Production API", () => {
  beforeEach(() => {
    fromMock.mockReset();
    createAuditLogMock.mockReset();
    listSalesOrderItemsMock.mockReset();
    updateSalesOrderMock.mockReset();
    createAuditLogMock.mockResolvedValue({ data: { id: "audit-1" }, error: null });
  });

  it("converts a sales order only after work-order and status writes succeed", async () => {
    listSalesOrderItemsMock.mockResolvedValue({ data: [salesOrderItem], error: null });
    updateSalesOrderMock.mockResolvedValue({
      data: { ...salesOrder, status: "in_production" },
      error: null,
    });
    const insertQuery = query({ data: workOrder, error: null });
    queueFrom(
      query<WorkOrder>({ data: null, error: null }),
      insertQuery,
    );

    const result = await createWorkOrderFromSalesOrder(salesOrder);

    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      sales_order_id: salesOrder.id,
      part_name: salesOrderItem.description,
      quantity: salesOrderItem.quantity,
    }));
    expect(updateSalesOrderMock).toHaveBeenCalledWith(salesOrder.id, {
      status: "in_production",
    });
    expect(createAuditLogMock).toHaveBeenCalledOnce();
    expect(result).toEqual({ data: workOrder, error: null });
  });

  it("stops when sales order items cannot be retrieved", async () => {
    listSalesOrderItemsMock.mockResolvedValue({
      data: [],
      error: "Sipariş kalemleri alınamadı",
      missingTable: false,
    });
    queueFrom(query<WorkOrder>({ data: null, error: null }));

    const result = await createWorkOrderFromSalesOrder(salesOrder);

    expect(result).toEqual({
      data: null,
      error: "Sipariş kalemleri alınamadı",
      missingTable: false,
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(updateSalesOrderMock).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("returns a deterministic error when work-order creation fails", async () => {
    listSalesOrderItemsMock.mockResolvedValue({ data: [salesOrderItem], error: null });
    queueFrom(
      query<WorkOrder>({ data: null, error: null }),
      query<WorkOrder>({ data: null, error: { message: "İş emri eklenemedi" } }),
    );

    const result = await createWorkOrderFromSalesOrder(salesOrder);

    expect(result).toEqual({
      data: null,
      error: "İş emri eklenemedi",
      missingTable: false,
    });
    expect(updateSalesOrderMock).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("reports status update failure after preserving the created work order", async () => {
    listSalesOrderItemsMock.mockResolvedValue({ data: [salesOrderItem], error: null });
    updateSalesOrderMock.mockResolvedValue({
      data: null,
      error: "Sipariş durumu güncellenemedi",
      missingTable: false,
    });
    queueFrom(
      query<WorkOrder>({ data: null, error: null }),
      query({ data: workOrder, error: null }),
    );

    const result = await createWorkOrderFromSalesOrder(salesOrder);

    expect(result).toEqual({
      data: workOrder,
      error: "İş emri oluşturuldu ancak satış siparişi durumu güncellenemedi: Sipariş durumu güncellenemedi",
      missingTable: false,
    });
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("creates operations for every route step", async () => {
    queueFrom(
      query<WorkOrderOperation[]>({ data: [], error: null }),
      query({ data: routeSteps, error: null }),
      query({ data: operation(routeSteps[0]), error: null }),
      query({ data: operation(routeSteps[1]), error: null }),
    );

    const result = await createOperationsFromRoute(workOrder.id, "route-1");

    expect(result).toEqual({
      data: routeSteps.map(operation),
      error: null,
    });
    expect(fromMock).toHaveBeenCalledTimes(4);
  });

  it("returns a clear error when route steps cannot be listed", async () => {
    queueFrom(
      query<WorkOrderOperation[]>({ data: [], error: null }),
      query<ProductionRouteStep[]>({
        data: null,
        error: { message: "Rota adımları alınamadı" },
      }),
    );

    const result = await createOperationsFromRoute(workOrder.id, "route-1");

    expect(result).toEqual({
      data: [],
      error: "Rota adımları alınamadı",
      missingTable: false,
    });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("stops after an operation insert failure and reports partial results", async () => {
    const firstOperation = operation(routeSteps[0]);
    queueFrom(
      query<WorkOrderOperation[]>({ data: [], error: null }),
      query({ data: routeSteps, error: null }),
      query({ data: firstOperation, error: null }),
      query<WorkOrderOperation>({
        data: null,
        error: { message: "Operasyon eklenemedi" },
      }),
    );

    const result = await createOperationsFromRoute(workOrder.id, "route-1");

    expect(result).toEqual({
      data: [firstOperation],
      error: "Operasyon oluşturulamadı: Operasyon eklenemedi",
      missingTable: false,
    });
    expect(fromMock).toHaveBeenCalledTimes(4);
  });

  it("updates the related work order when subcontracting enters processing", async () => {
    const job: SubcontractingJob = {
      id: "job-1",
      work_order_id: workOrder.id,
      work_order_operation_id: null,
      supplier_id: "supplier-1",
      process_type: "Isıl İşlem",
      dispatch_no: null,
      sent_date: "2026-06-13",
      expected_return_date: null,
      returned_date: null,
      status: "in_process",
      quantity_sent: 4,
      quantity_returned: 0,
      unit_cost: 0,
      total_cost: 0,
      notes: null,
      created_at: "2026-06-13T00:00:00.000Z",
    };
    const workOrderUpdate = query({
      data: { ...workOrder, status: "waiting_subcontractor" as const },
      error: null,
    });
    queueFrom(
      query({ data: { status: "planned" }, error: null }),
      query({ data: job, error: null }),
      query({ data: { status: "planned" }, error: null }),
      workOrderUpdate,
    );

    const result = await updateSubcontractingJob(job.id, {
      status: "in_process",
    });

    expect(workOrderUpdate.update).toHaveBeenCalledWith({
      status: "waiting_subcontractor",
    });
    expect(result.data).toBe(job);
    expect(createAuditLogMock).toHaveBeenCalledTimes(2);
  });
});
