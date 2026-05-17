import { supabase } from "@/integrations/supabase/client";
import {
  ApiResult,
  DashboardMetrics,
  Employee,
  EmployeeTimeEntry,
  ERPQuotation,
  Invoice,
  InventoryItem,
  InventoryMovement,
  MaintenanceTask,
  Payment,
  ProductionRoute,
  QualityReport,
  SalesOrder,
  Shipment,
  Stakeholder,
  StakeholderType,
  SubcontractingJob,
  WorkOrder,
} from "./types";

function toErrorMessage(error: unknown) {
  if (!error) return "Bilinmeyen hata";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Bilinmeyen hata";
  }
}

function logError(scope: string, error: unknown) {
  console.error(`[ERP API] ${scope}:`, error);
}

async function safeCount(scope: string, queryPromise: Promise<unknown>): Promise<number> {
  const { count, error } = (await queryPromise) as {
    count: number | null;
    error: unknown;
  };

  if (error) {
    logError(`count ${scope}`, error);
    return 0;
  }

  return count ?? 0;
}

export async function listStakeholders(search = ""): Promise<ApiResult<Stakeholder[]>> {
  let query = supabase
    .from("stakeholders" as never)
    .select("*")
    .order("company_name", { ascending: true });

  if (search.trim()) {
    query = query.ilike("company_name", `%${search.trim()}%`);
  }

  const { data, error } = (await query) as unknown as {
    data: Stakeholder[] | null;
    error: unknown;
  };

  if (error) {
    logError("listStakeholders", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function createStakeholder(payload: {
  type: StakeholderType;
  company_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  risk_limit?: number;
}): Promise<ApiResult<Stakeholder | null>> {
  const { data, error } = (await supabase
    .from("stakeholders" as never)
    .insert({
      type: payload.type,
      company_name: payload.company_name,
      contact_name: payload.contact_name ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      risk_limit: payload.risk_limit ?? 0,
    } as never)
    .select("*")
    .single()) as unknown as {
    data: Stakeholder | null;
    error: unknown;
  };

  if (error) {
    logError("createStakeholder", error);
    return { data: null, error: toErrorMessage(error) };
  }

  return { data, error: null };
}

export async function updateStakeholder(
  id: string,
  payload: Partial<Pick<Stakeholder, "company_name" | "contact_name" | "phone" | "email" | "is_active" | "type">>
): Promise<ApiResult<Stakeholder | null>> {
  const { data, error } = (await supabase
    .from("stakeholders" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as {
    data: Stakeholder | null;
    error: unknown;
  };

  if (error) {
    logError("updateStakeholder", error);
    return { data: null, error: toErrorMessage(error) };
  }

  return { data, error: null };
}

export async function listSalesOrders(search = ""): Promise<ApiResult<SalesOrder[]>> {
  let query = supabase
    .from("sales_orders" as never)
    .select("*")
    .order("created_at", { ascending: false });

  if (search.trim()) {
    query = query.or(`order_no.ilike.%${search}%,title.ilike.%${search}%`);
  }

  const { data, error } = (await query) as unknown as {
    data: SalesOrder[] | null;
    error: unknown;
  };

  if (error) {
    logError("listSalesOrders", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function createSalesOrder(payload: {
  stakeholder_id?: string | null;
  title: string;
  description?: string;
  due_date?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  currency?: string;
}): Promise<ApiResult<SalesOrder | null>> {
  const { data: generatedNo } = (await supabase.rpc("next_erp_number" as never, {
    p_sequence_key: "SALES_ORDER",
  } as never)) as unknown as { data: string | null };

  const fallbackNo = `SO-${new Date().getFullYear()}-${Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, "0")}`;

  const orderNo = generatedNo ?? fallbackNo;

  const { data, error } = (await supabase
    .from("sales_orders" as never)
    .insert({
      order_no: orderNo,
      stakeholder_id: payload.stakeholder_id ?? null,
      title: payload.title,
      description: payload.description ?? null,
      due_date: payload.due_date ?? null,
      priority: payload.priority ?? "normal",
      currency: payload.currency ?? "TRY",
    } as never)
    .select("*")
    .single()) as unknown as {
    data: SalesOrder | null;
    error: unknown;
  };

  if (error) {
    logError("createSalesOrder", error);
    return { data: null, error: toErrorMessage(error) };
  }

  return { data, error: null };
}

export async function listWorkOrders(search = ""): Promise<ApiResult<WorkOrder[]>> {
  let query = supabase
    .from("work_orders" as never)
    .select("*")
    .order("created_at", { ascending: false });

  if (search.trim()) {
    query = query.or(`work_order_no.ilike.%${search}%,title.ilike.%${search}%,part_name.ilike.%${search}%`);
  }

  const { data, error } = (await query) as unknown as {
    data: WorkOrder[] | null;
    error: unknown;
  };

  if (error) {
    logError("listWorkOrders", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function createWorkOrder(payload: {
  stakeholder_id?: string | null;
  sales_order_id?: string | null;
  title: string;
  part_name?: string;
  quantity?: number;
  planned_end_date?: string | null;
}): Promise<ApiResult<WorkOrder | null>> {
  const { data: generatedNo } = (await supabase.rpc("next_erp_number" as never, {
    p_sequence_key: "WORK_ORDER",
  } as never)) as unknown as { data: string | null };

  const fallbackNo = `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, "0")}`;

  const workOrderNo = generatedNo ?? fallbackNo;

  const { data, error } = (await supabase
    .from("work_orders" as never)
    .insert({
      work_order_no: workOrderNo,
      stakeholder_id: payload.stakeholder_id ?? null,
      sales_order_id: payload.sales_order_id ?? null,
      title: payload.title,
      part_name: payload.part_name ?? null,
      quantity: payload.quantity ?? 1,
      planned_end_date: payload.planned_end_date ?? null,
    } as never)
    .select("*")
    .single()) as unknown as {
    data: WorkOrder | null;
    error: unknown;
  };

  if (error) {
    logError("createWorkOrder", error);
    return { data: null, error: toErrorMessage(error) };
  }

  return { data, error: null };
}

export async function listInventoryItems(search = ""): Promise<ApiResult<InventoryItem[]>> {
  let query = supabase
    .from("inventory_items" as never)
    .select("*")
    .order("created_at", { ascending: false });

  if (search.trim()) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, error } = (await query) as unknown as {
    data: InventoryItem[] | null;
    error: unknown;
  };

  if (error) {
    logError("listInventoryItems", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function createInventoryItem(payload: {
  item_type: InventoryItem["item_type"];
  code?: string;
  name: string;
  unit?: string;
  current_stock?: number;
  min_stock?: number;
  location?: string;
}): Promise<ApiResult<InventoryItem | null>> {
  const { data, error } = (await supabase
    .from("inventory_items" as never)
    .insert({
      item_type: payload.item_type,
      code: payload.code ?? null,
      name: payload.name,
      unit: payload.unit ?? "adet",
      current_stock: payload.current_stock ?? 0,
      min_stock: payload.min_stock ?? 0,
      location: payload.location ?? null,
    } as never)
    .select("*")
    .single()) as unknown as {
    data: InventoryItem | null;
    error: unknown;
  };

  if (error) {
    logError("createInventoryItem", error);
    return { data: null, error: toErrorMessage(error) };
  }

  return { data, error: null };
}

export async function listInventoryMovements(): Promise<ApiResult<InventoryMovement[]>> {
  const { data, error } = (await supabase
    .from("inventory_movements" as never)
    .select("*")
    .order("movement_date", { ascending: false })
    .limit(200)) as unknown as {
    data: InventoryMovement[] | null;
    error: unknown;
  };

  if (error) {
    logError("listInventoryMovements", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listEmployees(): Promise<ApiResult<Employee[]>> {
  const { data, error } = (await supabase
    .from("employees" as never)
    .select("*")
    .order("full_name", { ascending: true })) as unknown as {
    data: Employee[] | null;
    error: unknown;
  };

  if (error) {
    logError("listEmployees", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function createEmployee(payload: {
  full_name: string;
  role?: string;
  department?: string;
}): Promise<ApiResult<Employee | null>> {
  const { data, error } = (await supabase
    .from("employees" as never)
    .insert({
      full_name: payload.full_name,
      role: payload.role ?? null,
      department: payload.department ?? null,
    } as never)
    .select("*")
    .single()) as unknown as {
    data: Employee | null;
    error: unknown;
  };

  if (error) {
    logError("createEmployee", error);
    return { data: null, error: toErrorMessage(error) };
  }

  return { data, error: null };
}

export async function listShipments(): Promise<ApiResult<Shipment[]>> {
  const { data, error } = (await supabase
    .from("shipments" as never)
    .select("*")
    .order("shipment_date", { ascending: false })) as unknown as {
    data: Shipment[] | null;
    error: unknown;
  };

  if (error) {
    logError("listShipments", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listQualityReports(): Promise<ApiResult<QualityReport[]>> {
  const { data, error } = (await supabase
    .from("quality_reports" as never)
    .select("*")
    .order("inspection_date", { ascending: false })) as unknown as {
    data: QualityReport[] | null;
    error: unknown;
  };

  if (error) {
    logError("listQualityReports", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listMaintenanceTasks(): Promise<ApiResult<MaintenanceTask[]>> {
  const { data, error } = (await supabase
    .from("maintenance_tasks" as never)
    .select("*")
    .order("planned_date", { ascending: true })) as unknown as {
    data: MaintenanceTask[] | null;
    error: unknown;
  };

  if (error) {
    logError("listMaintenanceTasks", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listSubcontractingJobs(): Promise<ApiResult<SubcontractingJob[]>> {
  const { data, error } = (await supabase
    .from("subcontracting_jobs" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as {
    data: SubcontractingJob[] | null;
    error: unknown;
  };

  if (error) {
    logError("listSubcontractingJobs", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listProductionRoutes(): Promise<ApiResult<ProductionRoute[]>> {
  const { data, error } = (await supabase
    .from("production_routes" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as {
    data: ProductionRoute[] | null;
    error: unknown;
  };

  if (error) {
    logError("listProductionRoutes", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listQuotations(limit = 100): Promise<ApiResult<ERPQuotation[]>> {
  const { data, error } = (await supabase
    .from("quotations" as never)
    .select("id, teklif_no, firma, ilgili_kisi, total, active_currency, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)) as unknown as {
    data: ERPQuotation[] | null;
    error: unknown;
  };

  if (error) {
    logError("listQuotations", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listInvoices(): Promise<ApiResult<Invoice[]>> {
  const { data, error } = (await supabase
    .from("invoices" as never)
    .select("*")
    .order("invoice_date", { ascending: false })) as unknown as {
    data: Invoice[] | null;
    error: unknown;
  };

  if (error) {
    logError("listInvoices", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listPayments(): Promise<ApiResult<Payment[]>> {
  const { data, error } = (await supabase
    .from("payments" as never)
    .select("*")
    .order("payment_date", { ascending: false })) as unknown as {
    data: Payment[] | null;
    error: unknown;
  };

  if (error) {
    logError("listPayments", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function listEmployeeTimeEntries(): Promise<ApiResult<EmployeeTimeEntry[]>> {
  const { data, error } = (await supabase
    .from("employee_time_entries" as never)
    .select("*")
    .order("work_date", { ascending: false })) as unknown as {
    data: EmployeeTimeEntry[] | null;
    error: unknown;
  };

  if (error) {
    logError("listEmployeeTimeEntries", error);
    return { data: [], error: toErrorMessage(error) };
  }

  return { data: data ?? [], error: null };
}

export async function getDashboardMetrics(): Promise<ApiResult<DashboardMetrics>> {
  const defaultMetrics: DashboardMetrics = {
    openQuotations: 0,
    activeSalesOrders: 0,
    openWorkOrders: 0,
    waitingSubcontracting: 0,
    lowStockItems: 0,
    pendingQualityChecks: 0,
    upcomingMaintenances: 0,
    todaysShipments: 0,
  };

  try {
    const today = new Date().toISOString().slice(0, 10);

    const [openQuotations, activeSalesOrders, openWorkOrders, waitingSubcontracting, pendingQualityChecks, upcomingMaintenances, todaysShipments] =
      await Promise.all([
        safeCount(
          "quotations",
          supabase.from("quotations" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>
        ),
        safeCount(
          "sales_orders",
          supabase
            .from("sales_orders" as never)
            .select("id", { count: "exact", head: true })
            .neq("status", "closed")
            .neq("status", "cancelled") as unknown as Promise<unknown>
        ),
        safeCount(
          "work_orders",
          supabase
            .from("work_orders" as never)
            .select("id", { count: "exact", head: true })
            .neq("status", "completed")
            .neq("status", "cancelled") as unknown as Promise<unknown>
        ),
        safeCount(
          "subcontracting_jobs",
          supabase
            .from("subcontracting_jobs" as never)
            .select("id", { count: "exact", head: true })
            .neq("status", "returned")
            .neq("status", "cancelled") as unknown as Promise<unknown>
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
    const lowStockItems = stockResult.data.filter((item) => item.current_stock <= item.min_stock).length;

    return {
      data: {
        openQuotations,
        activeSalesOrders,
        openWorkOrders,
        waitingSubcontracting,
        lowStockItems,
        pendingQualityChecks,
        upcomingMaintenances,
        todaysShipments,
      },
      error: stockResult.error,
    };
  } catch (error) {
    logError("getDashboardMetrics", error);
    return { data: defaultMetrics, error: toErrorMessage(error) };
  }
}
