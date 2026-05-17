import { supabase } from "@/integrations/supabase/client";
import {
  ApiResult,
  DashboardMetrics,
  DocumentMetadata,
  Employee,
  EmployeeTimeEntry,
  ERPQuotation,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  Invoice,
  Machine,
  MaintenanceTask,
  Payment,
  Priority,
  ProductionRoute,
  ProductionRouteStep,
  QualityMeasurement,
  QualityReport,
  SalesOrder,
  SalesOrderItem,
  SalesOrderStatus,
  Shipment,
  ShipmentItem,
  Stakeholder,
  StakeholderType,
  SubcontractingJob,
  WorkOrder,
  WorkOrderOperation,
  WorkOrderOperationStatus,
  WorkOrderStatus,
} from "./types";

export const ERP_MIGRATION_MESSAGE =
  "ERP veritabanı tabloları henüz uygulanmamış. Migration çalıştırıldıktan sonra bu modül aktif olacaktır.";

type DbResult<T> = { data: T | null; error: unknown; count?: number | null };

function toErrorMessage(error: unknown) {
  if (!error) return "Bilinmeyen hata";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Bilinmeyen hata";
  }
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; details?: string };
  const message = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();

  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("relation")
  );
}

function logError(scope: string, error: unknown) {
  console.error(`[ERP API] ${scope}:`, error);
}

function failure<T>(scope: string, error: unknown, fallback: T): ApiResult<T> {
  logError(scope, error);
  const missingTable = isMissingTableError(error);
  return {
    data: fallback,
    error: missingTable ? ERP_MIGRATION_MESSAGE : toErrorMessage(error),
    missingTable,
  };
}

function success<T>(data: T): ApiResult<T> {
  return { data, error: null };
}

async function safeCount(scope: string, queryPromise: Promise<unknown>) {
  const { count, error } = (await queryPromise) as { count: number | null; error: unknown };
  if (error) {
    logError(`count ${scope}`, error);
    return { count: 0, missingTable: isMissingTableError(error), error: toErrorMessage(error) };
  }
  return { count: count ?? 0, missingTable: false, error: null };
}

function normalizeSearch(value: string) {
  return value.trim().replaceAll(",", " ");
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sequencePrefix(sequenceKey: string) {
  const prefixes: Record<string, string> = {
    SALES_ORDER: "SO",
    WORK_ORDER: "WO",
    SHIPMENT: "SHP",
    QUALITY_REPORT: "QC",
    SUBCONTRACTING: "FSN",
  };

  return prefixes[sequenceKey] ?? "ERP";
}

export async function getNextERPNumber(sequenceKey: string): Promise<ApiResult<string>> {
  const prefix = sequencePrefix(sequenceKey);

  try {
    const { data, error } = (await supabase.rpc("next_erp_number" as never, {
      p_sequence_key: sequenceKey,
    } as never)) as unknown as DbResult<string>;

    if (error || !data) {
      const fallbackNo = `${prefix}-TEMP-${Date.now()}`;
      return { data: fallbackNo, error: error ? toErrorMessage(error) : null, missingTable: isMissingTableError(error) };
    }

    return success(data);
  } catch (error) {
    logError("getNextERPNumber", error);
    return { data: `${prefix}-TEMP-${Date.now()}`, error: toErrorMessage(error), missingTable: isMissingTableError(error) };
  }
}

export async function listStakeholders(search = "", type?: StakeholderType | "all"): Promise<ApiResult<Stakeholder[]>> {
  let query = supabase
    .from("stakeholders" as never)
    .select("*")
    .order("company_name", { ascending: true });

  const q = normalizeSearch(search);
  if (q) {
    query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  if (type && type !== "all") {
    query = query.eq("type", type);
  }

  const { data, error } = (await query) as unknown as DbResult<Stakeholder[]>;
  if (error) return failure("listStakeholders", error, []);
  return success(data ?? []);
}

export async function createStakeholder(payload: Partial<Stakeholder> & { type: StakeholderType; company_name: string }) {
  const { data, error } = (await supabase
    .from("stakeholders" as never)
    .insert({
      type: payload.type,
      company_name: payload.company_name,
      contact_name: payload.contact_name ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      tax_office: payload.tax_office ?? null,
      tax_number: payload.tax_number ?? null,
      address: payload.address ?? null,
      city: payload.city ?? null,
      country: payload.country ?? "Türkiye",
      risk_limit: payload.risk_limit ?? 0,
      current_balance: payload.current_balance ?? 0,
      notes: payload.notes ?? null,
      is_active: payload.is_active ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<Stakeholder>;

  if (error) return failure("createStakeholder", error, null);
  return success(data);
}

export async function updateStakeholder(id: string, payload: Partial<Stakeholder>) {
  const { data, error } = (await supabase
    .from("stakeholders" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<Stakeholder>;

  if (error) return failure("updateStakeholder", error, null);
  return success(data);
}

export async function findOrCreateStakeholderByCompany(companyName: string) {
  const name = companyName.trim();
  if (!name) return failure<Stakeholder | null>("findOrCreateStakeholderByCompany", "Firma adı boş.", null);

  const { data: existing, error: selectError } = (await supabase
    .from("stakeholders" as never)
    .select("*")
    .ilike("company_name", name)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<Stakeholder>;

  if (selectError && !isMissingTableError(selectError)) {
    return failure<Stakeholder | null>("findOrCreateStakeholderByCompany select", selectError, null);
  }

  if (existing) return success(existing);

  return createStakeholder({
    type: "customer",
    company_name: name,
    is_active: true,
  });
}

export async function listERPQuotationsFromExistingTable(limit = 100): Promise<ApiResult<ERPQuotation[]>> {
  const { data, error } = (await supabase
    .from("quotations" as never)
    .select("id, teklif_no, firma, ilgili_kisi, tel, email, konu, products, subtotal, kdv, total, active_currency, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)) as unknown as DbResult<ERPQuotation[]>;

  if (error) return failure("listERPQuotationsFromExistingTable", error, []);
  return success(data ?? []);
}

export const listQuotations = listERPQuotationsFromExistingTable;

export async function linkQuotationToStakeholder(quotationId: string, stakeholderId: string, status = "converted_to_order") {
  const { data, error } = (await supabase
    .from("erp_quotation_links" as never)
    .insert({ quotation_id: quotationId, stakeholder_id: stakeholderId, status } as never)
    .select("*")
    .single()) as unknown as DbResult<{ id: string }>;

  if (error) return failure("linkQuotationToStakeholder", error, null);
  return success(data);
}

function parseQuotationProducts(products: ERPQuotation["products"]) {
  if (!products) return [];
  if (Array.isArray(products)) return products as Record<string, unknown>[];

  try {
    const parsed = JSON.parse(String(products));
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

function quotationProductToItem(product: Record<string, unknown>, fallbackCurrency: string): Omit<SalesOrderItem, "id" | "sales_order_id" | "created_at"> {
  const quantity = numberValue(product.miktar ?? product.quantity, 1);
  const unitPrice = numberValue(product.birimFiyat ?? product.unit_price, 0);
  const descriptionParts = [product.cins, product.malzeme].filter(Boolean).map(String);

  return {
    item_code: product.kod ? String(product.kod) : null,
    description: descriptionParts.join(" - ") || "Teklif kalemi",
    quantity,
    unit: product.birim ? String(product.birim) : "adet",
    unit_price: unitPrice,
    total: quantity * unitPrice,
    technical_drawing_id: null,
  };
}

export async function listSalesOrders(search = ""): Promise<ApiResult<SalesOrder[]>> {
  let query = supabase
    .from("sales_orders" as never)
    .select("*")
    .order("created_at", { ascending: false });

  const q = normalizeSearch(search);
  if (q) query = query.or(`order_no.ilike.%${q}%,title.ilike.%${q}%`);

  const { data, error } = (await query) as unknown as DbResult<SalesOrder[]>;
  if (error) return failure("listSalesOrders", error, []);
  return success(data ?? []);
}

export async function getSalesOrder(id: string) {
  const { data, error } = (await supabase
    .from("sales_orders" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<SalesOrder>;

  if (error) return failure("getSalesOrder", error, null);
  return success(data);
}

export async function createSalesOrder(payload: Partial<SalesOrder> & { title: string }) {
  const generated = payload.order_no ? success(payload.order_no) : await getNextERPNumber("SALES_ORDER");
  const orderNo = generated.data;

  const { data, error } = (await supabase
    .from("sales_orders" as never)
    .insert({
      order_no: orderNo,
      stakeholder_id: payload.stakeholder_id ?? null,
      source_quotation_id: payload.source_quotation_id ?? null,
      title: payload.title,
      description: payload.description ?? null,
      status: payload.status ?? "new",
      priority: payload.priority ?? "normal",
      order_date: payload.order_date ?? new Date().toISOString().slice(0, 10),
      due_date: payload.due_date ?? null,
      currency: payload.currency ?? "TRY",
      subtotal: payload.subtotal ?? 0,
      tax_total: payload.tax_total ?? 0,
      grand_total: payload.grand_total ?? 0,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<SalesOrder>;

  if (error) return failure("createSalesOrder", error, null);
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updateSalesOrder(id: string, payload: Partial<SalesOrder>) {
  const { data, error } = (await supabase
    .from("sales_orders" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<SalesOrder>;

  if (error) return failure("updateSalesOrder", error, null);
  return success(data);
}

export async function createSalesOrderItem(payload: Partial<SalesOrderItem> & { sales_order_id: string; description: string }) {
  const quantity = payload.quantity ?? 1;
  const unitPrice = payload.unit_price ?? 0;
  const total = payload.total ?? quantity * unitPrice;

  const { data, error } = (await supabase
    .from("sales_order_items" as never)
    .insert({
      sales_order_id: payload.sales_order_id,
      item_code: payload.item_code ?? null,
      description: payload.description,
      quantity,
      unit: payload.unit ?? "adet",
      unit_price: unitPrice,
      total,
      technical_drawing_id: payload.technical_drawing_id ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<SalesOrderItem>;

  if (error) return failure("createSalesOrderItem", error, null);
  return success(data);
}

export async function listSalesOrderItems(salesOrderId: string): Promise<ApiResult<SalesOrderItem[]>> {
  const { data, error } = (await supabase
    .from("sales_order_items" as never)
    .select("*")
    .eq("sales_order_id", salesOrderId)
    .order("created_at", { ascending: true })) as unknown as DbResult<SalesOrderItem[]>;

  if (error) return failure("listSalesOrderItems", error, []);
  return success(data ?? []);
}

export async function convertQuotationToSalesOrder(quotation: ERPQuotation) {
  const stakeholderResult = await findOrCreateStakeholderByCompany(quotation.firma);
  if (stakeholderResult.error || !stakeholderResult.data) return failure<SalesOrder | null>("convertQuotationToSalesOrder stakeholder", stakeholderResult.error, null);

  const currency = quotation.active_currency || "TRY";
  const orderResult = await createSalesOrder({
    stakeholder_id: stakeholderResult.data.id,
    source_quotation_id: quotation.id,
    title: `Tekliften Oluşan Sipariş - ${quotation.teklif_no}`,
    description: quotation.konu ?? null,
    currency,
    subtotal: quotation.subtotal ?? 0,
    tax_total: quotation.kdv ?? 0,
    grand_total: quotation.total ?? 0,
    status: "new",
  });

  if (orderResult.error || !orderResult.data) return orderResult;

  const products = parseQuotationProducts(quotation.products);
  for (const product of products) {
    const item = quotationProductToItem(product, currency);
    await createSalesOrderItem({ ...item, sales_order_id: orderResult.data.id });
  }

  await linkQuotationToStakeholder(quotation.id, stakeholderResult.data.id, "converted_to_order");
  return orderResult;
}

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

export async function listWorkOrders(search = ""): Promise<ApiResult<WorkOrder[]>> {
  let query = supabase
    .from("work_orders" as never)
    .select("*")
    .order("created_at", { ascending: false });

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

export async function createWorkOrder(payload: Partial<WorkOrder> & { title: string }) {
  const generated = payload.work_order_no ? success(payload.work_order_no) : await getNextERPNumber("WORK_ORDER");

  const { data, error } = (await supabase
    .from("work_orders" as never)
    .insert({
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
    } as never)
    .select("*")
    .single()) as unknown as DbResult<WorkOrder>;

  if (error) return failure("createWorkOrder", error, null);
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updateWorkOrder(id: string, payload: Partial<WorkOrder>) {
  const { data, error } = (await supabase
    .from("work_orders" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<WorkOrder>;

  if (error) return failure("updateWorkOrder", error, null);
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

  if (!workOrderResult.error && workOrderResult.data) {
    await updateSalesOrder(order.id, { status: "in_production" });
  }

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
  const patch: Partial<WorkOrderOperation> = { status };
  if (status === "in_progress") patch.started_at = new Date().toISOString();
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

  return success(data);
}

export async function createOperationsFromRoute(workOrderId: string, routeId: string) {
  const existing = await listWorkOrderOperations(workOrderId);
  if (existing.data.length > 0) {
    return failure<WorkOrderOperation[]>("createOperationsFromRoute", "Bu iş emrinde zaten operasyon var.", []);
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
    if (result.data) created.push(result.data);
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

export async function createSubcontractingJob(payload: Partial<SubcontractingJob> & { process_type: string }) {
  const { data, error } = (await supabase
    .from("subcontracting_jobs" as never)
    .insert({
      work_order_id: payload.work_order_id ?? null,
      supplier_id: payload.supplier_id ?? null,
      process_type: payload.process_type,
      dispatch_no: payload.dispatch_no ?? null,
      sent_date: payload.sent_date ?? null,
      expected_return_date: payload.expected_return_date ?? null,
      returned_date: payload.returned_date ?? null,
      status: payload.status ?? "planned",
      quantity_sent: payload.quantity_sent ?? 0,
      quantity_returned: payload.quantity_returned ?? 0,
      unit_cost: payload.unit_cost ?? 0,
      total_cost: payload.total_cost ?? 0,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<SubcontractingJob>;

  if (error) return failure("createSubcontractingJob", error, null);
  if (data?.work_order_id && (data.status === "sent" || data.status === "in_process")) {
    await updateWorkOrder(data.work_order_id, { status: "waiting_subcontractor" });
  }
  return success(data);
}

export async function updateSubcontractingJob(id: string, payload: Partial<SubcontractingJob>) {
  const { data, error } = (await supabase
    .from("subcontracting_jobs" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<SubcontractingJob>;

  if (error) return failure("updateSubcontractingJob", error, null);
  return success(data);
}

export async function listInventoryItems(search = ""): Promise<ApiResult<InventoryItem[]>> {
  let query = supabase
    .from("inventory_items" as never)
    .select("*")
    .order("created_at", { ascending: false });

  const q = normalizeSearch(search);
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

  const { data, error } = (await query) as unknown as DbResult<InventoryItem[]>;
  if (error) return failure("listInventoryItems", error, []);
  return success(data ?? []);
}

export async function createInventoryItem(payload: Partial<InventoryItem> & { item_type: InventoryItem["item_type"]; name: string }) {
  const { data, error } = (await supabase
    .from("inventory_items" as never)
    .insert({
      item_type: payload.item_type,
      code: payload.code ?? null,
      name: payload.name,
      description: payload.description ?? null,
      unit: payload.unit ?? "adet",
      current_stock: payload.current_stock ?? 0,
      min_stock: payload.min_stock ?? 0,
      location: payload.location ?? null,
      supplier_id: payload.supplier_id ?? null,
      unit_cost: payload.unit_cost ?? 0,
      is_active: payload.is_active ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<InventoryItem>;

  if (error) return failure("createInventoryItem", error, null);
  return success(data);
}

export async function updateInventoryItem(id: string, payload: Partial<InventoryItem>) {
  const { data, error } = (await supabase
    .from("inventory_items" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<InventoryItem>;

  if (error) return failure("updateInventoryItem", error, null);
  return success(data);
}

export async function listInventoryMovements(): Promise<ApiResult<InventoryMovement[]>> {
  const { data, error } = (await supabase
    .from("inventory_movements" as never)
    .select("*")
    .order("movement_date", { ascending: false })
    .limit(200)) as unknown as DbResult<InventoryMovement[]>;

  if (error) return failure("listInventoryMovements", error, []);
  return success(data ?? []);
}

export async function createInventoryMovement(payload: {
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  source_type?: string | null;
  source_id?: string | null;
  notes?: string | null;
}) {
  const itemResult = (await supabase
    .from("inventory_items" as never)
    .select("*")
    .eq("id", payload.inventory_item_id)
    .single()) as unknown as DbResult<InventoryItem>;

  if (itemResult.error || !itemResult.data) return failure<InventoryMovement | null>("createInventoryMovement item", itemResult.error, null);

  const currentStock = numberValue(itemResult.data.current_stock, 0);
  const qty = numberValue(payload.quantity, 0);
  let nextStock = currentStock;

  if (payload.movement_type === "in" || payload.movement_type === "return") nextStock += qty;
  if (payload.movement_type === "out") nextStock -= qty;
  if (payload.movement_type === "adjustment") nextStock += qty;

  if (nextStock < 0) {
    return failure<InventoryMovement | null>("createInventoryMovement negative stock", "Stok eksiye düşemez.", null);
  }

  const { data, error } = (await supabase
    .from("inventory_movements" as never)
    .insert({
      inventory_item_id: payload.inventory_item_id,
      movement_type: payload.movement_type,
      quantity: qty,
      source_type: payload.source_type ?? "manual",
      source_id: payload.source_id ?? null,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<InventoryMovement>;

  if (error) return failure("createInventoryMovement", error, null);

  if (payload.movement_type !== "reservation") {
    await updateInventoryItem(payload.inventory_item_id, { current_stock: nextStock });
  }

  return success(data);
}

export async function listEmployees(): Promise<ApiResult<Employee[]>> {
  const { data, error } = (await supabase
    .from("employees" as never)
    .select("*")
    .order("full_name", { ascending: true })) as unknown as DbResult<Employee[]>;

  if (error) return failure("listEmployees", error, []);
  return success(data ?? []);
}

export async function createEmployee(payload: Partial<Employee> & { full_name: string }) {
  const { data, error } = (await supabase
    .from("employees" as never)
    .insert({
      full_name: payload.full_name,
      role: payload.role ?? null,
      department: payload.department ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      hire_date: payload.hire_date ?? null,
      is_active: payload.is_active ?? true,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<Employee>;

  if (error) return failure("createEmployee", error, null);
  return success(data);
}

export async function updateEmployee(id: string, payload: Partial<Employee>) {
  const { data, error } = (await supabase
    .from("employees" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<Employee>;

  if (error) return failure("updateEmployee", error, null);
  return success(data);
}

export async function listEmployeeTimeEntries(): Promise<ApiResult<EmployeeTimeEntry[]>> {
  const { data, error } = (await supabase
    .from("employee_time_entries" as never)
    .select("*")
    .order("work_date", { ascending: false })) as unknown as DbResult<EmployeeTimeEntry[]>;

  if (error) return failure("listEmployeeTimeEntries", error, []);
  return success(data ?? []);
}

export async function createEmployeeTimeEntry(payload: Partial<EmployeeTimeEntry> & { employee_id: string }) {
  const { data, error } = (await supabase
    .from("employee_time_entries" as never)
    .insert({
      employee_id: payload.employee_id,
      work_date: payload.work_date ?? new Date().toISOString().slice(0, 10),
      regular_hours: payload.regular_hours ?? 0,
      overtime_hours: payload.overtime_hours ?? 0,
      work_order_id: payload.work_order_id ?? null,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<EmployeeTimeEntry>;

  if (error) return failure("createEmployeeTimeEntry", error, null);
  return success(data);
}

export async function listShipments(): Promise<ApiResult<Shipment[]>> {
  const { data, error } = (await supabase
    .from("shipments" as never)
    .select("*")
    .order("shipment_date", { ascending: false })) as unknown as DbResult<Shipment[]>;

  if (error) return failure("listShipments", error, []);
  return success(data ?? []);
}

export async function createShipment(payload: Partial<Shipment>) {
  const generated = payload.shipment_no ? success(payload.shipment_no) : await getNextERPNumber("SHIPMENT");

  const { data, error } = (await supabase
    .from("shipments" as never)
    .insert({
      shipment_no: generated.data,
      sales_order_id: payload.sales_order_id ?? null,
      stakeholder_id: payload.stakeholder_id ?? null,
      carrier: payload.carrier ?? null,
      tracking_no: payload.tracking_no ?? null,
      delivery_note_no: payload.delivery_note_no ?? null,
      package_count: payload.package_count ?? 1,
      shipment_date: payload.shipment_date ?? new Date().toISOString().slice(0, 10),
      status: payload.status ?? "planned",
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<Shipment>;

  if (error) return failure("createShipment", error, null);
  if (data?.sales_order_id && data.status === "shipped") await updateSalesOrder(data.sales_order_id, { status: "shipped" });
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updateShipment(id: string, payload: Partial<Shipment>) {
  const { data, error } = (await supabase
    .from("shipments" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<Shipment>;

  if (error) return failure("updateShipment", error, null);
  if (data?.sales_order_id && data.status === "shipped") await updateSalesOrder(data.sales_order_id, { status: "shipped" });
  return success(data);
}

export async function listShipmentItems(shipmentId: string): Promise<ApiResult<ShipmentItem[]>> {
  const { data, error } = (await supabase
    .from("shipment_items" as never)
    .select("*")
    .eq("shipment_id", shipmentId)
    .order("created_at", { ascending: true })) as unknown as DbResult<ShipmentItem[]>;

  if (error) return failure("listShipmentItems", error, []);
  return success(data ?? []);
}

export async function createShipmentItem(payload: Partial<ShipmentItem> & { shipment_id: string; description: string }) {
  const { data, error } = (await supabase
    .from("shipment_items" as never)
    .insert({
      shipment_id: payload.shipment_id,
      description: payload.description,
      quantity: payload.quantity ?? 1,
      unit: payload.unit ?? "adet",
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ShipmentItem>;

  if (error) return failure("createShipmentItem", error, null);
  return success(data);
}

export async function createShipmentFromSalesOrder(order: SalesOrder) {
  const shipment = await createShipment({
    sales_order_id: order.id,
    stakeholder_id: order.stakeholder_id,
    status: "planned",
  });
  if (shipment.error || !shipment.data) return shipment;

  const items = await listSalesOrderItems(order.id);
  for (const item of items.data) {
    await createShipmentItem({
      shipment_id: shipment.data.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
    });
  }

  return shipment;
}

export async function listQualityReports(): Promise<ApiResult<QualityReport[]>> {
  const { data, error } = (await supabase
    .from("quality_reports" as never)
    .select("*")
    .order("inspection_date", { ascending: false })) as unknown as DbResult<QualityReport[]>;

  if (error) return failure("listQualityReports", error, []);
  return success(data ?? []);
}

export async function createQualityReport(payload: Partial<QualityReport>) {
  const generated = payload.report_no ? success(payload.report_no) : await getNextERPNumber("QUALITY_REPORT");

  const { data, error } = (await supabase
    .from("quality_reports" as never)
    .insert({
      report_no: generated.data,
      work_order_id: payload.work_order_id ?? null,
      sales_order_id: payload.sales_order_id ?? null,
      inspector_employee_id: payload.inspector_employee_id ?? null,
      inspection_date: payload.inspection_date ?? new Date().toISOString().slice(0, 10),
      result: payload.result ?? "pending",
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<QualityReport>;

  if (error) return failure("createQualityReport", error, null);
  if (data?.work_order_id) await updateWorkOrder(data.work_order_id, { status: "quality_check" });
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updateQualityReport(id: string, payload: Partial<QualityReport>) {
  const { data, error } = (await supabase
    .from("quality_reports" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<QualityReport>;

  if (error) return failure("updateQualityReport", error, null);
  if (data?.work_order_id && data.result === "passed") await updateWorkOrder(data.work_order_id, { status: "completed" });
  return success(data);
}

export async function listQualityMeasurements(reportId: string): Promise<ApiResult<QualityMeasurement[]>> {
  const { data, error } = (await supabase
    .from("quality_measurements" as never)
    .select("*")
    .eq("quality_report_id", reportId)
    .order("created_at", { ascending: true })) as unknown as DbResult<QualityMeasurement[]>;

  if (error) return failure("listQualityMeasurements", error, []);
  return success(data ?? []);
}

export async function createQualityMeasurement(payload: Partial<QualityMeasurement> & { quality_report_id: string; characteristic: string }) {
  const { data, error } = (await supabase
    .from("quality_measurements" as never)
    .insert({
      quality_report_id: payload.quality_report_id,
      characteristic: payload.characteristic,
      nominal_value: payload.nominal_value ?? null,
      tolerance: payload.tolerance ?? null,
      measured_value: payload.measured_value ?? null,
      result: payload.result ?? "pending",
    } as never)
    .select("*")
    .single()) as unknown as DbResult<QualityMeasurement>;

  if (error) return failure("createQualityMeasurement", error, null);
  return success(data);
}

export async function listMaintenanceTasks(): Promise<ApiResult<MaintenanceTask[]>> {
  const { data, error } = (await supabase
    .from("maintenance_tasks" as never)
    .select("*")
    .order("planned_date", { ascending: true })) as unknown as DbResult<MaintenanceTask[]>;

  if (error) return failure("listMaintenanceTasks", error, []);
  return success(data ?? []);
}

export async function createMaintenanceTask(payload: Partial<MaintenanceTask> & { task_name: string }) {
  const { data, error } = (await supabase
    .from("maintenance_tasks" as never)
    .insert({
      machine_id: payload.machine_id ?? null,
      task_name: payload.task_name,
      task_type: payload.task_type ?? "periodic",
      planned_date: payload.planned_date ?? null,
      completed_date: payload.completed_date ?? null,
      status: payload.status ?? "planned",
      responsible_employee_id: payload.responsible_employee_id ?? null,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<MaintenanceTask>;

  if (error) return failure("createMaintenanceTask", error, null);
  return success(data);
}

export async function updateMaintenanceTask(id: string, payload: Partial<MaintenanceTask>) {
  const { data, error } = (await supabase
    .from("maintenance_tasks" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<MaintenanceTask>;

  if (error) return failure("updateMaintenanceTask", error, null);
  return success(data);
}

export async function listInvoices(): Promise<ApiResult<Invoice[]>> {
  const { data, error } = (await supabase
    .from("invoices" as never)
    .select("*")
    .order("invoice_date", { ascending: false })) as unknown as DbResult<Invoice[]>;

  if (error) return failure("listInvoices", error, []);
  return success(data ?? []);
}

export async function createInvoice(payload: Partial<Invoice> & { invoice_type: "sales" | "purchase" }) {
  const { data, error } = (await supabase
    .from("invoices" as never)
    .insert({
      invoice_type: payload.invoice_type,
      invoice_no: payload.invoice_no ?? null,
      stakeholder_id: payload.stakeholder_id ?? null,
      invoice_date: payload.invoice_date ?? new Date().toISOString().slice(0, 10),
      due_date: payload.due_date ?? null,
      currency: payload.currency ?? "TRY",
      subtotal: payload.subtotal ?? 0,
      tax_total: payload.tax_total ?? 0,
      grand_total: payload.grand_total ?? 0,
      status: payload.status ?? "draft",
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<Invoice>;

  if (error) return failure("createInvoice", error, null);
  return success(data);
}

export async function listPayments(): Promise<ApiResult<Payment[]>> {
  const { data, error } = (await supabase
    .from("payments" as never)
    .select("*")
    .order("payment_date", { ascending: false })) as unknown as DbResult<Payment[]>;

  if (error) return failure("listPayments", error, []);
  return success(data ?? []);
}

export async function createPayment(payload: Partial<Payment> & { payment_type: "collection" | "payment"; amount: number }) {
  const { data, error } = (await supabase
    .from("payments" as never)
    .insert({
      payment_type: payload.payment_type,
      stakeholder_id: payload.stakeholder_id ?? null,
      financial_account_id: payload.financial_account_id ?? null,
      amount: payload.amount,
      currency: payload.currency ?? "TRY",
      payment_date: payload.payment_date ?? new Date().toISOString().slice(0, 10),
      description: payload.description ?? null,
      related_invoice_id: payload.related_invoice_id ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<Payment>;

  if (error) return failure("createPayment", error, null);
  return success(data);
}

export async function listDocuments(): Promise<ApiResult<DocumentMetadata[]>> {
  const { data, error } = (await supabase
    .from("documents" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<DocumentMetadata[]>;

  if (error) return failure("listDocuments", error, []);
  return success(data ?? []);
}

export async function createDocumentMetadata(payload: Partial<DocumentMetadata> & { entity_type: string; document_type: string; file_name: string }) {
  const { data, error } = (await supabase
    .from("documents" as never)
    .insert({
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ?? null,
      document_type: payload.document_type,
      file_name: payload.file_name,
      file_path: payload.file_path ?? null,
      version_no: payload.version_no ?? 1,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<DocumentMetadata>;

  if (error) return failure("createDocumentMetadata", error, null);
  return success(data);
}

export async function getERPDashboardMetrics(): Promise<ApiResult<DashboardMetrics>> {
  const defaultMetrics: DashboardMetrics = {
    stakeholderCount: 0,
    openQuotations: 0,
    activeSalesOrders: 0,
    openWorkOrders: 0,
    activeOperations: 0,
    waitingSubcontracting: 0,
    lowStockItems: 0,
    pendingQualityChecks: 0,
    upcomingMaintenances: 0,
    todaysShipments: 0,
  };

  try {
    const today = new Date().toISOString().slice(0, 10);

    const [
      stakeholderCount,
      openQuotations,
      activeSalesOrders,
      openWorkOrders,
      activeOperations,
      waitingSubcontracting,
      pendingQualityChecks,
      upcomingMaintenances,
      todaysShipments,
    ] = await Promise.all([
      safeCount("stakeholders", supabase.from("stakeholders" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount("quotations", supabase.from("quotations" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount(
        "sales_orders",
        supabase
          .from("sales_orders" as never)
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(closed,cancelled)") as unknown as Promise<unknown>
      ),
      safeCount(
        "work_orders",
        supabase
          .from("work_orders" as never)
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(completed,cancelled)") as unknown as Promise<unknown>
      ),
      safeCount(
        "work_order_operations",
        supabase
          .from("work_order_operations" as never)
          .select("id", { count: "exact", head: true })
          .eq("status", "in_progress") as unknown as Promise<unknown>
      ),
      safeCount(
        "subcontracting_jobs",
        supabase
          .from("subcontracting_jobs" as never)
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(returned,cancelled)") as unknown as Promise<unknown>
      ),
      safeCount(
        "quality_reports",
        supabase
          .from("quality_reports" as never)
          .select("id", { count: "exact", head: true })
          .eq("result", "pending") as unknown as Promise<unknown>
      ),
      safeCount(
        "maintenance_tasks",
        supabase
          .from("maintenance_tasks" as never)
          .select("id", { count: "exact", head: true })
          .in("status", ["planned", "in_progress"]) as unknown as Promise<unknown>
      ),
      safeCount(
        "shipments",
        supabase
          .from("shipments" as never)
          .select("id", { count: "exact", head: true })
          .eq("shipment_date", today) as unknown as Promise<unknown>
      ),
    ]);

    const stockResult = await listInventoryItems();
    const lowStockItems = stockResult.data.filter((item) => Number(item.current_stock) <= Number(item.min_stock)).length;
    const missingTable =
      [
        stakeholderCount,
        openQuotations,
        activeSalesOrders,
        openWorkOrders,
        activeOperations,
        waitingSubcontracting,
        pendingQualityChecks,
        upcomingMaintenances,
        todaysShipments,
      ].some((metric) => metric.missingTable) || Boolean(stockResult.missingTable);

    return {
      data: {
        stakeholderCount: stakeholderCount.count,
        openQuotations: openQuotations.count,
        activeSalesOrders: activeSalesOrders.count,
        openWorkOrders: openWorkOrders.count,
        activeOperations: activeOperations.count,
        waitingSubcontracting: waitingSubcontracting.count,
        lowStockItems,
        pendingQualityChecks: pendingQualityChecks.count,
        upcomingMaintenances: upcomingMaintenances.count,
        todaysShipments: todaysShipments.count,
      },
      error: missingTable ? ERP_MIGRATION_MESSAGE : stockResult.error,
      missingTable,
    };
  } catch (error) {
    return failure("getERPDashboardMetrics", error, defaultMetrics);
  }
}

export const getDashboardMetrics = getERPDashboardMetrics;
