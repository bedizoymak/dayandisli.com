import { supabase } from "@/integrations/supabase/client";
import type {
  ApiResult,
  Machine,
  ProductionRoute,
  ProductionRouteStep,
  SalesOrder,
  SubcontractingJob,
  WorkOrder,
  WorkOrderOperation,
  WorkOrderOperationStatus,
} from "../types";
import { listSalesOrderItems, updateSalesOrder } from "./salesApi";
import {
  applyEnterpriseScope,
  createAuditLog,
  DbResult,
  EnterpriseQueryScope,
  failure,
  getNextERPNumber,
  isMissingTableError,
  normalizeSearch,
  resolveEnterpriseScope,
  success,
  validationFailure,
  withEnterpriseOwnership,
} from "./internal";

export async function listMachines(): Promise<ApiResult<Machine[]>> {
  const { data, error } = (await supabase
    .from("machines" as never)
    .select("*")
    .order("name", { ascending: true })) as unknown as DbResult<Machine[]>;

  if (error) return failure("listMachines", error, []);
  return success(data ?? []);
}

export async function listProductionRoutes(): Promise<ApiResult<ProductionRoute[]>> {
  const { data, error } = (await supabase
    .from("production_routes" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ProductionRoute[]>;

  if (error) return failure("listProductionRoutes", error, []);
  return success(data ?? []);
}

export async function createProductionRoute(payload: Partial<ProductionRoute> & { name: string }) {
  const { data, error } = (await supabase
    .from("production_routes" as never)
    .insert({
      name: payload.name,
      description: payload.description ?? null,
      is_template: payload.is_template ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ProductionRoute>;

  if (error) return failure("createProductionRoute", error, null);
  return success(data);
}

export async function updateProductionRoute(id: string, payload: Partial<ProductionRoute>) {
  const { data, error } = (await supabase
    .from("production_routes" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ProductionRoute>;

  if (error) return failure("updateProductionRoute", error, null);
  return success(data);
}

export async function listProductionRouteSteps(routeId: string): Promise<ApiResult<ProductionRouteStep[]>> {
  const { data, error } = (await supabase
    .from("production_route_steps" as never)
    .select("*")
    .eq("route_id", routeId)
    .order("step_no", { ascending: true })) as unknown as DbResult<ProductionRouteStep[]>;

  if (error) return failure("listProductionRouteSteps", error, []);
  return success(data ?? []);
}

export async function createProductionRouteStep(payload: Partial<ProductionRouteStep> & { route_id: string; step_no: number; operation_name: string }) {
  const { data, error } = (await supabase
    .from("production_route_steps" as never)
    .insert({
      route_id: payload.route_id,
      step_no: payload.step_no,
      operation_name: payload.operation_name,
      machine_id: payload.machine_id ?? null,
      estimated_minutes: payload.estimated_minutes ?? 0,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ProductionRouteStep>;

  if (error) return failure("createProductionRouteStep", error, null);
  return success(data);
}

export async function updateProductionRouteStep(id: string, payload: Partial<ProductionRouteStep>) {
  const { data, error } = (await supabase
    .from("production_route_steps" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ProductionRouteStep>;

  if (error) return failure("updateProductionRouteStep", error, null);
  return success(data);
}

export async function deleteProductionRouteStep(id: string) {
  const previous = (await supabase
    .from("production_route_steps" as never)
    .select("*")
    .eq("id" as never, id as never)
    .maybeSingle()) as unknown as DbResult<ProductionRouteStep>;

  const { error } = (await supabase
    .from("production_route_steps" as never)
    .delete()
    .eq("id", id)) as unknown as { error: unknown };

  if (error) return failure("deleteProductionRouteStep", error, false);
  await createAuditLog({
    entity_type: "production_route_step",
    entity_id: id,
    action: "deleted",
    description: `${previous.data?.operation_name ?? "Operasyon adımı"} silindi.`,
    metadata: { previous: previous.data ?? null },
  });
  return success(true);
}

export async function listWorkOrders(search = "", scope?: EnterpriseQueryScope): Promise<ApiResult<WorkOrder[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = applyEnterpriseScope(supabase
    .from("work_orders" as never)
    .select("*")
    .order("created_at", { ascending: false }), enterpriseScope);

  const q = normalizeSearch(search);
  if (q) query = query.or(`work_order_no.ilike.%${q}%,title.ilike.%${q}%,part_name.ilike.%${q}%`);

  const { data, error } = (await query) as unknown as DbResult<WorkOrder[]>;
  if (error) return failure("listWorkOrders", error, []);
  return success(data ?? []);
}

export async function getWorkOrder(id: string) {
  const { data, error } = (await supabase
    .from("work_orders" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<WorkOrder>;

  if (error) return failure("getWorkOrder", error, null);
  return success(data);
}

export const getWorkOrderById = getWorkOrder;

export async function createWorkOrder(payload: Partial<WorkOrder> & { title: string }) {
  const generated = payload.work_order_no ? success(payload.work_order_no) : await getNextERPNumber("WORK_ORDER");
  const record = await withEnterpriseOwnership({
    work_order_no: generated.data,
    sales_order_id: payload.sales_order_id ?? null,
    stakeholder_id: payload.stakeholder_id ?? null,
    title: payload.title,
    part_name: payload.part_name ?? null,
    part_code: payload.part_code ?? null,
    quantity: payload.quantity ?? 1,
    status: payload.status ?? "planned",
    priority: payload.priority ?? "normal",
    planned_start_date: payload.planned_start_date ?? null,
    planned_end_date: payload.planned_end_date ?? null,
    notes: payload.notes ?? null,
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });

  const { data, error } = (await supabase
    .from("work_orders" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<WorkOrder>;

  if (error) return failure("createWorkOrder", error, null);
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updateWorkOrder(id: string, payload: Partial<WorkOrder>) {
  const before = payload.status
    ? ((await supabase.from("work_orders" as never).select("status").eq("id", id).maybeSingle()) as unknown as DbResult<{ status: string }>)
    : null;

  const { data, error } = (await supabase
    .from("work_orders" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<WorkOrder>;

  if (error) return failure("updateWorkOrder", error, null);
  if (payload.status && data) {
    await createAuditLog({
      entity_type: "work_order",
      entity_id: id,
      action: "status_changed",
      old_status: before?.data?.status ?? null,
      new_status: data.status,
      description: `${data.work_order_no} iş emri durumu güncellendi.`,
    });
  }
  return success(data);
}

export async function createWorkOrderFromSalesOrder(order: SalesOrder) {
  const existing = (await supabase
    .from("work_orders" as never)
    .select("*")
    .eq("sales_order_id", order.id)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<WorkOrder>;

  if (existing.error && !isMissingTableError(existing.error)) return failure("createWorkOrderFromSalesOrder check", existing.error, null);
  if (existing.data) return { data: existing.data, error: "Bu sipariş için zaten iş emri var." };

  const items = await listSalesOrderItems(order.id);
  if (items.error) {
    return failure<WorkOrder | null>("createWorkOrderFromSalesOrder items", items.error, null);
  }

  const firstItem = items.data[0];
  const workOrderResult = await createWorkOrder({
    sales_order_id: order.id,
    stakeholder_id: order.stakeholder_id,
    title: order.title,
    part_name: firstItem?.description ?? order.title,
    quantity: firstItem?.quantity ?? 1,
    planned_end_date: order.due_date,
    priority: order.priority,
  });

  if (workOrderResult.error || !workOrderResult.data) {
    return failure<WorkOrder | null>(
      "createWorkOrderFromSalesOrder work order",
      workOrderResult.error ?? "İş emri oluşturulamadı.",
      null,
    );
  }

  const statusResult = await updateSalesOrder(order.id, { status: "in_production" });
  if (statusResult.error || !statusResult.data) {
    return {
      data: workOrderResult.data,
      error: `İş emri oluşturuldu ancak satış siparişi durumu güncellenemedi: ${statusResult.error ?? "Bilinmeyen hata"}`,
      missingTable: statusResult.missingTable,
    };
  }

  await createAuditLog({
    entity_type: "sales_order",
    entity_id: order.id,
    action: "sales_order_converted",
    description: `${order.order_no} numaralı sipariş iş emrine dönüştürüldü.`,
    metadata: { work_order_id: workOrderResult.data.id, work_order_no: workOrderResult.data.work_order_no },
  });

  return workOrderResult;
}

export async function listWorkOrderOperations(workOrderId: string): Promise<ApiResult<WorkOrderOperation[]>> {
  const { data, error } = (await supabase
    .from("work_order_operations" as never)
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("step_no", { ascending: true })) as unknown as DbResult<WorkOrderOperation[]>;

  if (error) return failure("listWorkOrderOperations", error, []);
  return success(data ?? []);
}

export async function createWorkOrderOperation(payload: Partial<WorkOrderOperation> & { work_order_id: string; step_no: number; operation_name: string }) {
  const { data, error } = (await supabase
    .from("work_order_operations" as never)
    .insert({
      work_order_id: payload.work_order_id,
      step_no: payload.step_no,
      operation_name: payload.operation_name,
      machine_id: payload.machine_id ?? null,
      assigned_employee_id: payload.assigned_employee_id ?? null,
      status: payload.status ?? "pending",
      planned_minutes: payload.planned_minutes ?? 0,
      actual_minutes: payload.actual_minutes ?? 0,
      quality_required: payload.quality_required ?? false,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<WorkOrderOperation>;

  if (error) return failure("createWorkOrderOperation", error, null);
  return success(data);
}

export async function updateWorkOrderOperationStatus(id: string, status: WorkOrderOperationStatus, actualMinutes?: number) {
  const current = (await supabase
    .from("work_order_operations" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<WorkOrderOperation>;

  if (current.error) return failure("updateWorkOrderOperationStatus current", current.error, null);

  const patch: Partial<WorkOrderOperation> = { status };
  if (status === "in_progress") patch.started_at = current.data?.started_at ?? new Date().toISOString();
  if (status === "completed") {
    patch.completed_at = new Date().toISOString();
    if (typeof actualMinutes === "number") patch.actual_minutes = actualMinutes;
  }

  const { data, error } = (await supabase
    .from("work_order_operations" as never)
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<WorkOrderOperation>;

  if (error) return failure("updateWorkOrderOperationStatus", error, null);

  if (data?.work_order_id && status === "in_progress") {
    await updateWorkOrder(data.work_order_id, { status: "in_progress", actual_start_at: data.started_at ?? new Date().toISOString() });
  }

  if (data) {
    await createAuditLog({
      entity_type: "work_order_operation",
      entity_id: data.id,
      action: status === "in_progress" ? "operation_started" : status === "paused" ? "operation_paused" : status === "completed" ? "operation_completed" : "status_changed",
      old_status: current.data?.status ?? null,
      new_status: status,
      description: `${data.operation_name} operasyonu güncellendi.`,
      metadata: { work_order_id: data.work_order_id },
    });
  }

  return success(data);
}

export async function createOperationsFromRoute(workOrderId: string, routeId: string, allowAppend = false) {
  const existing = await listWorkOrderOperations(workOrderId);
  if (existing.data.length > 0 && !allowAppend) {
    return validationFailure<WorkOrderOperation[]>("Bu iş emrinde zaten operasyon var.", []);
  }

  const steps = await listProductionRouteSteps(routeId);
  if (steps.error) return failure<WorkOrderOperation[]>("createOperationsFromRoute steps", steps.error, []);

  const created: WorkOrderOperation[] = [];
  for (const step of steps.data) {
    const result = await createWorkOrderOperation({
      work_order_id: workOrderId,
      step_no: step.step_no,
      operation_name: step.operation_name,
      machine_id: step.machine_id,
      planned_minutes: step.estimated_minutes,
      notes: step.notes,
    });
    if (result.error || !result.data) {
      return {
        data: created,
        error: `Operasyon oluşturulamadı: ${result.error ?? "Bilinmeyen hata"}`,
        missingTable: result.missingTable,
      };
    }
    created.push(result.data);
  }

  return success(created);
}

export async function listSubcontractingJobs(): Promise<ApiResult<SubcontractingJob[]>> {
  const { data, error } = (await supabase
    .from("subcontracting_jobs" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<SubcontractingJob[]>;

  if (error) return failure("listSubcontractingJobs", error, []);
  return success(data ?? []);
}

export async function getSubcontractingJobById(id: string) {
  const { data, error } = (await supabase
    .from("subcontracting_jobs" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<SubcontractingJob>;

  if (error) return failure("getSubcontractingJobById", error, null);
  return success(data);
}

export async function createSubcontractingJob(payload: Partial<SubcontractingJob> & { process_type: string }) {
  const insertPayload: Record<string, unknown> = {
    work_order_id: payload.work_order_id ?? null,
    supplier_id: payload.supplier_id ?? null,
    process_type: payload.process_type,
    dispatch_no: payload.dispatch_no ?? null,
    sent_date: payload.sent_date ?? (payload.status === "sent" ? new Date().toISOString().slice(0, 10) : null),
    expected_return_date: payload.expected_return_date ?? null,
    returned_date: payload.returned_date ?? null,
    status: payload.status ?? "planned",
    quantity_sent: payload.quantity_sent ?? 0,
    quantity_returned: payload.quantity_returned ?? 0,
    unit_cost: payload.unit_cost ?? 0,
    total_cost: payload.total_cost ?? 0,
    notes: payload.notes ?? null,
  };

  if (payload.work_order_operation_id) {
    insertPayload.work_order_operation_id = payload.work_order_operation_id;
  }

  const { data, error } = (await supabase
    .from("subcontracting_jobs" as never)
    .insert(insertPayload as never)
    .select("*")
    .single()) as unknown as DbResult<SubcontractingJob>;

  if (error) return failure("createSubcontractingJob", error, null);
  if (data?.work_order_id && (data.status === "sent" || data.status === "in_process")) {
    await updateWorkOrder(data.work_order_id, { status: "waiting_subcontractor" });
  }
  return success(data);
}

export async function updateSubcontractingJob(id: string, payload: Partial<SubcontractingJob>) {
  const before = payload.status
    ? ((await supabase.from("subcontracting_jobs" as never).select("status").eq("id", id).maybeSingle()) as unknown as DbResult<{ status: string }>)
    : null;

  const { data, error } = (await supabase
    .from("subcontracting_jobs" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<SubcontractingJob>;

  if (error) return failure("updateSubcontractingJob", error, null);
  if (data?.work_order_id && (data.status === "sent" || data.status === "in_process")) {
    await updateWorkOrder(data.work_order_id, { status: "waiting_subcontractor" });
  }
  if (payload.status && data) {
    await createAuditLog({
      entity_type: "subcontracting_job",
      entity_id: data.id,
      action: data.status === "sent" ? "subcontracting_sent" : data.status === "returned" ? "subcontracting_returned" : "status_changed",
      old_status: before?.data?.status ?? null,
      new_status: data.status,
      description: `${data.process_type} fason durumu güncellendi.`,
      metadata: { work_order_id: data.work_order_id },
    });
  }
  return success(data);
}
