import { supabase } from "@/integrations/supabase/client";
import {
  ApiResult,
  CRMActivity,
  CRMActivityType,
  CRMLead,
  CRMLeadStatus,
  CRMOpportunity,
  CRMOpportunityStatus,
  CRMRelatedType,
  CRMTask,
  CRMTaskStatus,
  DashboardMetrics,
  DocumentMetadata,
  Employee,
  EmployeeTimeEntry,
  HRDepartment,
  HRLeaveRequest,
  HROnboardingTask,
  HRPosition,
  HRRecruitmentCandidate,
  ERPAuditLog,
  ERPDashboardActivity,
  ERPDatabaseStatus,
  ERPNotification,
  ERPReportSummary,
  ERPUser,
  ERPQuotation,
  ERPQuotationConversionState,
  FinancialAccount,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  Invoice,
  LegacyCustomerCandidate,
  LegacyCustomerImportPreview,
  LegacyCustomerImportResult,
  Machine,
  MaintenanceTask,
  Payment,
  Priority,
  ProductionRoute,
  ProductionRouteStep,
  PurchaseOrder,
  PurchaseOrderItem,
  QualityMeasurement,
  QualityReport,
  SalesOrder,
  SalesOrderItem,
  SalesOrderStatus,
  Shipment,
  ShipmentItem,
  ShopCampaign,
  ShopCart,
  ShopCategory,
  ShopOrder,
  ShopOrderItem,
  ShopPaymentStatusRecord,
  ShopProduct,
  Stakeholder,
  StakeholderType,
  SubcontractingJob,
  WorkOrder,
  WorkOrderOperation,
  WorkOrderOperationStatus,
  WorkOrderStatus,
  WebsiteBanner,
  WebsiteForm,
  WebsiteFormSubmission,
  WebsiteMediaAsset,
  WebsiteMenuItem,
  WebsitePage,
  WebsiteSEOSetting,
} from "./types";

export const ERP_MIGRATION_MESSAGE =
  "ERP veritabanı tabloları henüz oluşturulmamış. Supabase SQL geçiş dosyasını çalıştırın.";

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
    message.includes("schema cache")
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

function validationFailure<T>(error: string, fallback: T): ApiResult<T> {
  return { data: fallback, error, missingTable: false };
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

function textValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
}

function normalizeKey(value?: string | null) {
  return (value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueBy<T>(items: T[], keyGetter: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyGetter(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sequencePrefix(sequenceKey: string) {
  const prefixes: Record<string, string> = {
    SALES_ORDER: "SO",
    WORK_ORDER: "WO",
    SHIPMENT: "SHP",
    QUALITY_REPORT: "QC",
    SUBCONTRACTING: "FSN",
    PURCHASE_ORDER: "PO",
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

export async function getERPDatabaseStatus(): Promise<ApiResult<ERPDatabaseStatus>> {
  const keyTables = [
    "admin_users",
    "erp_users",
    "stakeholders",
    "erp_quotation_links",
    "quotations",
    "sales_orders",
    "sales_order_items",
    "machines",
    "production_routes",
    "production_route_steps",
    "work_orders",
    "work_order_operations",
    "subcontracting_jobs",
    "documents",
    "inventory_items",
    "inventory_movements",
    "measuring_tools",
    "financial_accounts",
    "invoices",
    "payments",
    "products",
    "orders",
    "order_items",
    "shop_categories",
    "shop_campaigns",
    "shop_carts",
    "shop_payment_statuses",
    "website_pages",
    "website_seo_settings",
    "website_menu_items",
    "website_media_assets",
    "website_forms",
    "website_form_submissions",
    "website_banners",
    "employees",
    "hr_departments",
    "hr_positions",
    "employee_time_entries",
    "hr_leave_requests",
    "hr_recruitment_candidates",
    "hr_onboarding_tasks",
    "employee_assets",
    "shipments",
    "shipment_items",
    "quality_reports",
    "quality_measurements",
    "maintenance_tasks",
    "erp_number_sequences",
    "erp_audit_logs",
    "erp_notifications",
    "purchase_orders",
    "purchase_order_items",
  ];
  const checks = await Promise.all(
    keyTables.map(async (table) => {
      const { error } = (await supabase
        .from(table as never)
        .select("id", { count: "exact", head: true })) as unknown as { error: unknown };

      if (!error) return { table, status: "ready" as const, message: null };
      logError(`database status ${table}`, error);
      return {
        table,
        status: isMissingTableError(error) ? ("missing" as const) : ("restricted" as const),
        message: toErrorMessage(error),
      };
    })
  );

  const hasMissing = checks.some((check) => check.status === "missing");
  const hasRestricted = checks.some((check) => check.status === "restricted");
  const data: ERPDatabaseStatus = {
    overall: hasMissing ? "missing_migration" : hasRestricted ? "rls_check_required" : "ready",
    label: hasMissing ? "Eksik Migration" : hasRestricted ? "Erişim/RLS Kontrolü Gerekli" : "Hazır",
    tables: checks,
  };

  return {
    data,
    error: hasMissing ? ERP_MIGRATION_MESSAGE : hasRestricted ? "ERP tabloları var ancak bazı tablolarda erişim veya RLS kontrolü gerekiyor." : null,
    missingTable: hasMissing,
  };
}

export async function getCurrentERPUser(): Promise<ApiResult<ERPUser | null>> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.email) return success(null);

  const { data, error } = (await supabase
    .from("erp_users" as never)
    .select("*")
    .eq("email", authData.user.email)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<ERPUser>;

  if (error && !isMissingTableError(error)) return failure("getCurrentERPUser", error, null);
  if (data) return success(data);

  const adminResult = (await supabase
    .from("admin_users" as never)
    .select("id, email, role, is_active, created_at")
    .eq("email", authData.user.email)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<{ id: string; email: string; role?: string; is_active: boolean; created_at: string }>;

  if (adminResult.error && !isMissingTableError(adminResult.error)) return failure("getCurrentERPUser admin_users", adminResult.error, null);
  if (adminResult.data) {
    return success({
      id: adminResult.data.id,
      auth_user_id: authData.user.id,
      email: adminResult.data.email,
      full_name: null,
      role: "admin",
      department: null,
      is_active: adminResult.data.is_active,
      created_at: adminResult.data.created_at,
    });
  }

  return success({
    id: authData.user.id,
    auth_user_id: authData.user.id,
    email: authData.user.email,
    full_name: authData.user.user_metadata?.full_name ? String(authData.user.user_metadata.full_name) : null,
    role: "viewer",
    department: null,
    is_active: true,
    created_at: authData.user.created_at ?? new Date().toISOString(),
  });
}

export async function createAuditLog(payload: {
  entity_type: string;
  entity_id?: string | null;
  action: string;
  old_status?: string | null;
  new_status?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = (await supabase
    .from("erp_audit_logs" as never)
    .insert({
      actor_user_id: authData.user?.id ?? null,
      actor_email: authData.user?.email ?? null,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ?? null,
      action: payload.action,
      old_status: payload.old_status ?? null,
      new_status: payload.new_status ?? null,
      description: payload.description ?? null,
      metadata: payload.metadata ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ERPAuditLog>;

  if (error) return failure("createAuditLog", error, null);
  return success(data);
}

export async function listAuditLogsForEntity(entityType: string, entityId?: string | null): Promise<ApiResult<ERPAuditLog[]>> {
  let query = supabase
    .from("erp_audit_logs" as never)
    .select("*")
    .eq("entity_type", entityType)
    .order("created_at", { ascending: false });

  if (entityId) query = query.eq("entity_id", entityId);

  const { data, error } = (await query.limit(100)) as unknown as DbResult<ERPAuditLog[]>;
  if (error) return failure("listAuditLogsForEntity", error, []);
  return success(data ?? []);
}

export async function listRecentAuditLogs(limit = 10): Promise<ApiResult<ERPAuditLog[]>> {
  const { data, error } = (await supabase
    .from("erp_audit_logs" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)) as unknown as DbResult<ERPAuditLog[]>;

  if (error) return failure("listRecentAuditLogs", error, []);
  return success(data ?? []);
}

export async function listNotifications(limit = 100, includeRead = true): Promise<ApiResult<ERPNotification[]>> {
  let query = supabase
    .from("erp_notifications" as never)
    .select("*");

  if (!includeRead) query = query.eq("is_read", false);

  const { data, error } = (await query.order("created_at", { ascending: false }).limit(limit)) as unknown as DbResult<ERPNotification[]>;
  if (error) return failure("listNotifications", error, []);
  return success(data ?? []);
}

export async function listUnreadNotifications(limit = 20): Promise<ApiResult<ERPNotification[]>> {
  return listNotifications(limit, false);
}

export async function getUnreadNotificationCount(): Promise<ApiResult<number>> {
  const result = await safeCount(
    "erp_notifications unread",
    supabase
      .from("erp_notifications" as never)
      .select("id", { count: "exact", head: true })
      .eq("is_read", false) as unknown as Promise<unknown>
  );

  if (result.error) return { data: 0, error: result.error, missingTable: result.missingTable };
  return success(result.count);
}

export async function createNotification(payload: Partial<ERPNotification> & { title: string }) {
  const { data, error } = (await supabase
    .from("erp_notifications" as never)
    .insert({
      recipient_user_id: payload.recipient_user_id ?? null,
      recipient_email: payload.recipient_email ?? null,
      severity: payload.severity ?? "info",
      category: payload.category ?? "workflow",
      title: payload.title,
      body: payload.body ?? null,
      entity_type: payload.entity_type ?? null,
      entity_id: payload.entity_id ?? null,
      action_url: payload.action_url ?? null,
      is_read: payload.is_read ?? false,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ERPNotification>;

  if (error) return failure("createNotification", error, null);
  return success(data);
}

export async function markNotificationRead(id: string) {
  const { data, error } = (await supabase
    .from("erp_notifications" as never)
    .update({ is_read: true, read_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ERPNotification>;

  if (error) return failure("markNotificationRead", error, null);
  return success(data);
}

export async function markAllNotificationsRead() {
  const { error } = (await supabase
    .from("erp_notifications" as never)
    .update({ is_read: true, read_at: new Date().toISOString() } as never)
    .eq("is_read", false)) as unknown as { error: unknown };

  if (error) return failure("markAllNotificationsRead", error, false);
  return success(true);
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

export async function getStakeholderById(id: string) {
  const { data, error } = (await supabase
    .from("stakeholders" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<Stakeholder>;

  if (error) return failure("getStakeholderById", error, null);
  return success(data);
}

export async function listERPUsers(): Promise<ApiResult<ERPUser[]>> {
  const { data, error } = (await supabase
    .from("erp_users" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ERPUser[]>;

  if (error) return failure("listERPUsers", error, []);
  return success(data ?? []);
}

export async function createERPUser(payload: Partial<ERPUser> & { email: string }) {
  const { data, error } = (await supabase
    .from("erp_users" as never)
    .insert({
      auth_user_id: payload.auth_user_id ?? null,
      email: payload.email,
      full_name: payload.full_name ?? null,
      role: payload.role ?? "viewer",
      roles: payload.roles ?? [payload.role ?? "viewer"],
      permissions: payload.permissions ?? [],
      department: payload.department ?? null,
      is_active: payload.is_active ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ERPUser>;

  if (error) return failure("createERPUser", error, null);
  return success(data);
}

export async function updateERPUser(id: string, payload: Partial<ERPUser>) {
  const { data, error } = (await supabase
    .from("erp_users" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ERPUser>;

  if (error) return failure("updateERPUser", error, null);
  return success(data);
}

export async function listCRMLeads(search = "", status: CRMLeadStatus | "all" = "all"): Promise<ApiResult<CRMLead[]>> {
  let query = supabase.from("crm_leads" as never).select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status" as never, status as never);
  const q = normalizeSearch(search);
  if (q) query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,lead_no.ilike.%${q}%` as never);
  const { data, error } = (await query) as unknown as DbResult<CRMLead[]>;
  if (error) return failure("listCRMLeads", error, []);
  return success(data ?? []);
}

export async function createCRMLead(payload: Partial<CRMLead> & { company_name: string }) {
  const leadNo = await getNextERPNumber("CRM_LEAD");
  const { data, error } = (await supabase.from("crm_leads" as never).insert({ ...payload, lead_no: leadNo.data } as never).select("*").single()) as unknown as DbResult<CRMLead>;
  if (error) return failure<CRMLead | null>("createCRMLead", error, null);
  await createAuditLog({ entity_type: "lead", entity_id: data?.id, action: "created", description: `${data?.lead_no} potansiyel müşteri oluşturuldu.` });
  return success(data);
}

export async function updateCRMLead(id: string, payload: Partial<CRMLead>) {
  const previous = (await supabase.from("crm_leads" as never).select("status").eq("id", id).maybeSingle()) as unknown as DbResult<{ status: CRMLeadStatus }>;
  const { data, error } = (await supabase.from("crm_leads" as never).update(payload as never).eq("id" as never, id as never).select("*").single()) as unknown as DbResult<CRMLead>;
  if (error) return failure<CRMLead | null>("updateCRMLead", error, null);
  if (payload.status && previous.data?.status !== payload.status) {
    await createAuditLog({ entity_type: "lead", entity_id: id, action: "status_changed", old_status: previous.data?.status, new_status: payload.status, description: "Potansiyel müşteri durumu güncellendi." });
  }
  return success(data);
}

export async function listCRMOpportunities(search = "", status: CRMOpportunityStatus | "all" = "all"): Promise<ApiResult<CRMOpportunity[]>> {
  let query = supabase.from("crm_opportunities" as never).select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status" as never, status as never);
  const q = normalizeSearch(search);
  if (q) query = query.or(`title.ilike.%${q}%,opportunity_no.ilike.%${q}%` as never);
  const { data, error } = (await query) as unknown as DbResult<CRMOpportunity[]>;
  if (error) return failure("listCRMOpportunities", error, []);
  return success(data ?? []);
}

export async function createCRMOpportunity(payload: Partial<CRMOpportunity> & { title: string }) {
  const opportunityNo = await getNextERPNumber("CRM_OPPORTUNITY");
  const { data, error } = (await supabase.from("crm_opportunities" as never).insert({ ...payload, opportunity_no: opportunityNo.data } as never).select("*").single()) as unknown as DbResult<CRMOpportunity>;
  if (error) return failure<CRMOpportunity | null>("createCRMOpportunity", error, null);
  await createAuditLog({ entity_type: "opportunity", entity_id: data?.id, action: "created", description: `${data?.opportunity_no} fırsat oluşturuldu.` });
  return success(data);
}

export async function updateCRMOpportunity(id: string, payload: Partial<CRMOpportunity>) {
  const previous = (await supabase.from("crm_opportunities" as never).select("status").eq("id", id).maybeSingle()) as unknown as DbResult<{ status: CRMOpportunityStatus }>;
  const { data, error } = (await supabase.from("crm_opportunities" as never).update(payload as never).eq("id" as never, id as never).select("*").single()) as unknown as DbResult<CRMOpportunity>;
  if (error) return failure<CRMOpportunity | null>("updateCRMOpportunity", error, null);
  if (payload.status && previous.data?.status !== payload.status) {
    await createAuditLog({ entity_type: "opportunity", entity_id: id, action: "status_changed", old_status: previous.data?.status, new_status: payload.status, description: "Fırsat durumu güncellendi." });
  }
  return success(data);
}

export async function convertLeadToOpportunity(lead: CRMLead) {
  const opportunity = await createCRMOpportunity({
    title: `${lead.company_name} fırsatı`,
    lead_id: lead.id,
    stakeholder_id: lead.stakeholder_id,
    notes: lead.notes,
  });
  if (opportunity.data) await updateCRMLead(lead.id, { status: "converted" });
  return opportunity;
}

export async function listCRMTasks(search = "", status: CRMTaskStatus | "all" = "all"): Promise<ApiResult<CRMTask[]>> {
  let query = supabase.from("crm_tasks" as never).select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status" as never, status as never);
  const q = normalizeSearch(search);
  if (q) query = query.ilike("title" as never, `%${q}%` as never);
  const { data, error } = (await query) as unknown as DbResult<CRMTask[]>;
  if (error) return failure("listCRMTasks", error, []);
  return success(data ?? []);
}

export async function createCRMTask(payload: Partial<CRMTask> & { title: string }) {
  const { data, error } = (await supabase.from("crm_tasks" as never).insert(payload as never).select("*").single()) as unknown as DbResult<CRMTask>;
  if (error) return failure<CRMTask | null>("createCRMTask", error, null);
  return success(data);
}

export async function updateCRMTask(id: string, payload: Partial<CRMTask>) {
  const { data, error } = (await supabase.from("crm_tasks" as never).update(payload as never).eq("id" as never, id as never).select("*").single()) as unknown as DbResult<CRMTask>;
  if (error) return failure<CRMTask | null>("updateCRMTask", error, null);
  return success(data);
}

export async function listCRMActivities(search = "", relatedType?: CRMRelatedType, relatedId?: string): Promise<ApiResult<CRMActivity[]>> {
  let query = supabase.from("crm_activities" as never).select("*").order("activity_date", { ascending: false }).limit(200);
  if (relatedType) query = query.eq("related_type" as never, relatedType as never);
  if (relatedId) query = query.eq("related_id" as never, relatedId as never);
  const q = normalizeSearch(search);
  if (q) query = query.or(`subject.ilike.%${q}%,notes.ilike.%${q}%` as never);
  const { data, error } = (await query) as unknown as DbResult<CRMActivity[]>;
  if (error) return failure("listCRMActivities", error, []);
  return success(data ?? []);
}

export async function createCRMActivity(payload: Partial<CRMActivity> & { subject: string; activity_type?: CRMActivityType }) {
  const { data, error } = (await supabase.from("crm_activities" as never).insert({ activity_type: "note", ...payload } as never).select("*").single()) as unknown as DbResult<CRMActivity>;
  if (error) return failure<CRMActivity | null>("createCRMActivity", error, null);
  return success(data);
}

function mapLegacyCustomer(source_table: LegacyCustomerCandidate["source_table"], index: number, record: Record<string, unknown>): LegacyCustomerCandidate | null {
  const companyName = textValue(record, [
    "company_name",
    "firma",
    "firma_adi",
    "firma_adı",
    "unvan",
    "title",
    "customer_name",
    "name",
  ]);

  if (!companyName) {
    return {
      source_table,
      source_key: String(record.id ?? `${source_table}-${index}`),
      company_name: "",
      contact_name: null,
      phone: null,
      email: null,
      tax_office: null,
      tax_number: null,
      address: null,
      city: null,
      notes: "Firma adı tespit edilemedi.",
      duplicate: false,
      duplicate_reason: null,
    };
  }

  return {
    source_table,
    source_key: String(record.id ?? `${source_table}-${index}`),
    company_name: companyName,
    contact_name: textValue(record, ["contact_name", "ilgili_kisi", "ilgili_kişi", "yetkili", "authorized_person", "person"]),
    phone: textValue(record, ["phone", "telefon", "tel", "gsm", "mobile"]),
    email: textValue(record, ["email", "e_posta", "mail"]),
    tax_office: textValue(record, ["tax_office", "vergi_dairesi"]),
    tax_number: textValue(record, ["tax_number", "vergi_no", "vkn", "tckn"]),
    address: textValue(record, ["address", "adres", "full_address"]),
    city: textValue(record, ["city", "sehir", "şehir", "il"]),
    notes: textValue(record, ["notes", "notlar", "description"]),
    duplicate: false,
    duplicate_reason: null,
  };
}

async function readLegacyCustomerTable(table: LegacyCustomerCandidate["source_table"]) {
  const { data, error } = (await supabase.from(table as never).select("*").limit(1000)) as unknown as DbResult<Record<string, unknown>[]>;
  if (error) {
    logError(`read legacy customer table ${table}`, error);
    return { rows: [], error: isMissingTableError(error) ? `${table} tablosu bulunamadı.` : `${table}: ${toErrorMessage(error)}` };
  }
  return { rows: data ?? [], error: null };
}

async function buildLegacyCustomerPreview(): Promise<LegacyCustomerImportPreview> {
  const [profileResult, fullResult, stakeholderResult] = await Promise.all([
    readLegacyCustomerTable("customer_profile"),
    readLegacyCustomerTable("customers_full"),
    listStakeholders(),
  ]);

  const existing = stakeholderResult.data;
  const existingCompanyKeys = new Set(existing.map((item) => normalizeKey(item.company_name)).filter(Boolean));
  const existingEmails = new Set(existing.map((item) => normalizeKey(item.email)).filter(Boolean));
  const existingPhones = new Set(existing.map((item) => normalizeKey(item.phone)).filter(Boolean));
  const tableErrors = [profileResult.error, fullResult.error, stakeholderResult.error].filter(Boolean) as string[];

  const rawCandidates = [
    ...profileResult.rows.map((row, index) => mapLegacyCustomer("customer_profile", index, row)),
    ...fullResult.rows.map((row, index) => mapLegacyCustomer("customers_full", index, row)),
  ].filter(Boolean) as LegacyCustomerCandidate[];

  const uniqueCandidates = uniqueBy(rawCandidates, (candidate) => {
    const company = normalizeKey(candidate.company_name);
    const email = normalizeKey(candidate.email);
    const phone = normalizeKey(candidate.phone);
    return `${company}|${email}|${phone}`;
  });

  const candidates = uniqueCandidates.map((candidate) => {
    if (!candidate.company_name.trim()) return candidate;

    const companyKey = normalizeKey(candidate.company_name);
    const emailKey = normalizeKey(candidate.email);
    const phoneKey = normalizeKey(candidate.phone);
    const duplicate =
      existingCompanyKeys.has(companyKey) ||
      Boolean(emailKey && existingEmails.has(emailKey)) ||
      Boolean(phoneKey && existingPhones.has(phoneKey));

    return {
      ...candidate,
      duplicate,
      duplicate_reason: duplicate ? "Aynı firma, e-posta veya telefon ERP paydaşlarında mevcut." : null,
    };
  });

  const missingCompany = candidates.filter((candidate) => !candidate.company_name.trim()).length;
  const skippedDuplicates = candidates.filter((candidate) => candidate.duplicate).length;
  const importable = candidates.filter((candidate) => candidate.company_name.trim() && !candidate.duplicate).length;

  return {
    scanned: rawCandidates.length,
    importable,
    skippedDuplicates,
    missingCompany,
    tableErrors,
    sample: candidates.slice(0, 8),
    candidates,
  };
}

export async function previewLegacyCustomerImport(): Promise<ApiResult<LegacyCustomerImportPreview>> {
  const emptyPreview: LegacyCustomerImportPreview = {
    scanned: 0,
    importable: 0,
    skippedDuplicates: 0,
    missingCompany: 0,
    tableErrors: [],
    sample: [],
    candidates: [],
  };

  try {
    const preview = await buildLegacyCustomerPreview();
    const missingTable = preview.tableErrors.some((message) => message.includes("bulunamadı"));
    return {
      data: preview,
      error: preview.tableErrors.length ? preview.tableErrors.join(" ") : null,
      missingTable,
    };
  } catch (error) {
    return failure("previewLegacyCustomerImport", error, emptyPreview);
  }
}

export async function importLegacyCustomersToStakeholders(): Promise<ApiResult<LegacyCustomerImportResult>> {
  const defaultResult: LegacyCustomerImportResult = { imported: 0, skippedDuplicates: 0, failed: 0, errors: [] };

  try {
    const preview = await buildLegacyCustomerPreview();
    const result: LegacyCustomerImportResult = {
      imported: 0,
      skippedDuplicates: preview.skippedDuplicates + preview.missingCompany,
      failed: 0,
      errors: [...preview.tableErrors],
    };

    const importable = preview.candidates.filter((candidate) => candidate.company_name.trim() && !candidate.duplicate);

    for (const candidate of importable) {
      const created = await createStakeholder({
        type: "customer",
        company_name: candidate.company_name,
        contact_name: candidate.contact_name,
        phone: candidate.phone,
        email: candidate.email,
        tax_office: candidate.tax_office,
        tax_number: candidate.tax_number,
        address: candidate.address,
        city: candidate.city,
        country: "Türkiye",
        notes: candidate.notes ? `${candidate.notes}\nEski tablo: ${candidate.source_table}` : `Eski tablo: ${candidate.source_table}`,
        is_active: true,
      });

      if (created.error) {
        result.failed += 1;
        result.errors.push(`${candidate.company_name}: ${created.error}`);
      } else {
        result.imported += 1;
      }
    }

    return success(result);
  } catch (error) {
    return failure("importLegacyCustomersToStakeholders", error, defaultResult);
  }
}

export async function findOrCreateStakeholderByCompany(companyName: string) {
  const name = companyName.trim();
  if (!name) return validationFailure<Stakeholder | null>("Firma adı boş.", null);

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

export async function getQuotationConversionState(quotationId: string): Promise<ApiResult<ERPQuotationConversionState>> {
  const defaultState: ERPQuotationConversionState = { converted: false, salesOrder: null, warning: null };

  const orderResult = (await supabase
    .from("sales_orders" as never)
    .select("*")
    .eq("source_quotation_id", quotationId)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<SalesOrder>;

  if (orderResult.error && !isMissingTableError(orderResult.error)) {
    return failure("getQuotationConversionState sales_orders", orderResult.error, defaultState);
  }

  if (orderResult.data) {
    return success({
      converted: true,
      salesOrder: orderResult.data,
      warning: "Bu teklif daha önce siparişe dönüştürülmüş olabilir.",
    });
  }

  const linkResult = (await supabase
    .from("erp_quotation_links" as never)
    .select("id, status")
    .eq("quotation_id", quotationId)
    .eq("status", "converted_to_order")
    .limit(1)
    .maybeSingle()) as unknown as DbResult<{ id: string; status: string }>;

  if (linkResult.error && !isMissingTableError(linkResult.error)) {
    return failure("getQuotationConversionState erp_quotation_links", linkResult.error, defaultState);
  }

  if (linkResult.data) {
    return success({
      converted: true,
      salesOrder: null,
      warning: "Bu teklif daha önce siparişe dönüştürülmüş olabilir.",
    });
  }

  return success(defaultState);
}

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

export const getSalesOrderById = getSalesOrder;

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
  const conversionState = await getQuotationConversionState(quotation.id);
  if (conversionState.data.converted) {
    return {
      data: conversionState.data.salesOrder,
      error: conversionState.data.warning,
      missingTable: conversionState.missingTable,
    };
  }

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
  await createAuditLog({
    entity_type: "quotation",
    entity_id: quotation.id,
    action: "quotation_converted",
    description: `${quotation.teklif_no} numaralı teklif satış siparişine dönüştürüldü.`,
    metadata: { sales_order_id: orderResult.data.id, order_no: orderResult.data.order_no },
  });
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
  const { error } = (await supabase
    .from("production_route_steps" as never)
    .delete()
    .eq("id", id)) as unknown as { error: unknown };

  if (error) return failure("deleteProductionRouteStep", error, false);
  return success(true);
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

export const getWorkOrderById = getWorkOrder;

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
    await createAuditLog({
      entity_type: "sales_order",
      entity_id: order.id,
      action: "sales_order_converted",
      description: `${order.order_no} numaralı sipariş iş emrine dönüştürüldü.`,
      metadata: { work_order_id: workOrderResult.data.id, work_order_no: workOrderResult.data.work_order_no },
    });
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

export async function getInventoryItemById(id: string) {
  const { data, error } = (await supabase
    .from("inventory_items" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<InventoryItem>;

  if (error) return failure("getInventoryItemById", error, null);
  return success(data);
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

export async function listInventoryMovementsForItem(inventoryItemId: string): Promise<ApiResult<InventoryMovement[]>> {
  const { data, error } = (await supabase
    .from("inventory_movements" as never)
    .select("*")
    .eq("inventory_item_id", inventoryItemId)
    .order("movement_date", { ascending: false })
    .limit(200)) as unknown as DbResult<InventoryMovement[]>;

  if (error) return failure("listInventoryMovementsForItem", error, []);
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
  if (qty <= 0) {
    return validationFailure<InventoryMovement | null>("Miktar sıfırdan büyük olmalıdır.", null);
  }

  let nextStock = currentStock;

  if (payload.movement_type === "in" || payload.movement_type === "return") nextStock += qty;
  if (payload.movement_type === "out") nextStock -= qty;
  if (payload.movement_type === "adjustment") nextStock += qty;

  if (nextStock < 0) {
    return validationFailure<InventoryMovement | null>("Stok eksiye düşemez.", null);
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

  if (data) {
    await createAuditLog({
      entity_type: "inventory_item",
      entity_id: payload.inventory_item_id,
      action: "inventory_movement_created",
      old_status: String(currentStock),
      new_status: String(nextStock),
      description: `${payload.movement_type} stok hareketi oluşturuldu.`,
      metadata: { movement_id: data.id, quantity: qty, source_type: payload.source_type ?? "manual" },
    });
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

export async function listHRDepartments(): Promise<ApiResult<HRDepartment[]>> {
  const { data, error } = (await supabase
    .from("hr_departments" as never)
    .select("*")
    .order("name", { ascending: true })) as unknown as DbResult<HRDepartment[]>;

  if (error) return failure("listHRDepartments", error, []);
  return success(data ?? []);
}

export async function createHRDepartment(payload: Partial<HRDepartment> & { name: string }) {
  const { data, error } = (await supabase
    .from("hr_departments" as never)
    .insert({
      name: payload.name,
      code: payload.code ?? null,
      manager_employee_id: payload.manager_employee_id ?? null,
      parent_department_id: payload.parent_department_id ?? null,
      is_active: payload.is_active ?? true,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<HRDepartment>;

  if (error) return failure("createHRDepartment", error, null);
  return success(data);
}

export async function updateHRDepartment(id: string, payload: Partial<HRDepartment>) {
  const { data, error } = (await supabase
    .from("hr_departments" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<HRDepartment>;

  if (error) return failure("updateHRDepartment", error, null);
  return success(data);
}

export async function listHRPositions(): Promise<ApiResult<HRPosition[]>> {
  const { data, error } = (await supabase
    .from("hr_positions" as never)
    .select("*")
    .order("title", { ascending: true })) as unknown as DbResult<HRPosition[]>;

  if (error) return failure("listHRPositions", error, []);
  return success(data ?? []);
}

export async function createHRPosition(payload: Partial<HRPosition> & { title: string }) {
  const { data, error } = (await supabase
    .from("hr_positions" as never)
    .insert({
      title: payload.title,
      code: payload.code ?? null,
      department_id: payload.department_id ?? null,
      reports_to_position_id: payload.reports_to_position_id ?? null,
      is_active: payload.is_active ?? true,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<HRPosition>;

  if (error) return failure("createHRPosition", error, null);
  return success(data);
}

export async function updateHRPosition(id: string, payload: Partial<HRPosition>) {
  const { data, error } = (await supabase
    .from("hr_positions" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<HRPosition>;

  if (error) return failure("updateHRPosition", error, null);
  return success(data);
}

export async function createEmployee(payload: Partial<Employee> & { full_name: string }) {
  const { data, error } = (await supabase
    .from("employees" as never)
    .insert({
      employee_no: payload.employee_no ?? null,
      full_name: payload.full_name,
      role: payload.role ?? null,
      department: payload.department ?? null,
      department_id: payload.department_id ?? null,
      position_id: payload.position_id ?? null,
      manager_employee_id: payload.manager_employee_id ?? null,
      erp_user_id: payload.erp_user_id ?? null,
      status: payload.status ?? "active",
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

export async function listHRLeaveRequests(): Promise<ApiResult<HRLeaveRequest[]>> {
  const { data, error } = (await supabase
    .from("hr_leave_requests" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<HRLeaveRequest[]>;

  if (error) return failure("listHRLeaveRequests", error, []);
  return success(data ?? []);
}

export async function createHRLeaveRequest(payload: Partial<HRLeaveRequest> & { employee_id: string; start_date: string; end_date: string }) {
  const { data, error } = (await supabase
    .from("hr_leave_requests" as never)
    .insert({
      employee_id: payload.employee_id,
      leave_type: payload.leave_type ?? "annual",
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: payload.status ?? "pending",
      approver_employee_id: payload.approver_employee_id ?? null,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<HRLeaveRequest>;

  if (error) return failure("createHRLeaveRequest", error, null);
  return success(data);
}

export async function updateHRLeaveRequest(id: string, payload: Partial<HRLeaveRequest>) {
  const { data, error } = (await supabase
    .from("hr_leave_requests" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<HRLeaveRequest>;

  if (error) return failure("updateHRLeaveRequest", error, null);
  return success(data);
}

export async function listHRRecruitmentCandidates(): Promise<ApiResult<HRRecruitmentCandidate[]>> {
  const { data, error } = (await supabase
    .from("hr_recruitment_candidates" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<HRRecruitmentCandidate[]>;

  if (error) return failure("listHRRecruitmentCandidates", error, []);
  return success(data ?? []);
}

export async function createHRRecruitmentCandidate(payload: Partial<HRRecruitmentCandidate> & { full_name: string }) {
  const { data, error } = (await supabase
    .from("hr_recruitment_candidates" as never)
    .insert({
      full_name: payload.full_name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      position_id: payload.position_id ?? null,
      department_id: payload.department_id ?? null,
      status: payload.status ?? "new",
      source: payload.source ?? null,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<HRRecruitmentCandidate>;

  if (error) return failure("createHRRecruitmentCandidate", error, null);
  return success(data);
}

export async function updateHRRecruitmentCandidate(id: string, payload: Partial<HRRecruitmentCandidate>) {
  const { data, error } = (await supabase
    .from("hr_recruitment_candidates" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<HRRecruitmentCandidate>;

  if (error) return failure("updateHRRecruitmentCandidate", error, null);
  return success(data);
}

export async function listHROnboardingTasks(): Promise<ApiResult<HROnboardingTask[]>> {
  const { data, error } = (await supabase
    .from("hr_onboarding_tasks" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<HROnboardingTask[]>;

  if (error) return failure("listHROnboardingTasks", error, []);
  return success(data ?? []);
}

export async function createHROnboardingTask(payload: Partial<HROnboardingTask> & { title: string }) {
  const { data, error } = (await supabase
    .from("hr_onboarding_tasks" as never)
    .insert({
      employee_id: payload.employee_id ?? null,
      candidate_id: payload.candidate_id ?? null,
      title: payload.title,
      responsible_employee_id: payload.responsible_employee_id ?? null,
      due_date: payload.due_date ?? null,
      status: payload.status ?? "open",
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<HROnboardingTask>;

  if (error) return failure("createHROnboardingTask", error, null);
  return success(data);
}

export async function updateHROnboardingTask(id: string, payload: Partial<HROnboardingTask>) {
  const { data, error } = (await supabase
    .from("hr_onboarding_tasks" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<HROnboardingTask>;

  if (error) return failure("updateHROnboardingTask", error, null);
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

export async function getShipmentById(id: string) {
  const { data, error } = (await supabase
    .from("shipments" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<Shipment>;

  if (error) return failure("getShipmentById", error, null);
  return success(data);
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
  if (data?.sales_order_id && data.status === "delivered") await updateSalesOrder(data.sales_order_id, { status: "closed" });
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updateShipment(id: string, payload: Partial<Shipment>) {
  const before = payload.status
    ? ((await supabase.from("shipments" as never).select("status").eq("id", id).maybeSingle()) as unknown as DbResult<{ status: string }>)
    : null;

  const { data, error } = (await supabase
    .from("shipments" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<Shipment>;

  if (error) return failure("updateShipment", error, null);
  if (data?.sales_order_id && data.status === "shipped") await updateSalesOrder(data.sales_order_id, { status: "shipped" });
  if (data?.sales_order_id && data.status === "delivered") await updateSalesOrder(data.sales_order_id, { status: "closed" });
  if (payload.status && data) {
    await createAuditLog({
      entity_type: "shipment",
      entity_id: data.id,
      action: data.status === "shipped" ? "shipment_status_updated" : "status_changed",
      old_status: before?.data?.status ?? null,
      new_status: data.status,
      description: `${data.shipment_no} sevkiyat durumu güncellendi.`,
      metadata: { sales_order_id: data.sales_order_id },
    });
  }
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
  const existing = (await supabase
    .from("shipments" as never)
    .select("*")
    .eq("sales_order_id", order.id)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<Shipment>;

  if (existing.error && !isMissingTableError(existing.error)) return failure("createShipmentFromSalesOrder check", existing.error, null);
  if (existing.data) return { data: existing.data, error: "Bu sipariş için zaten sevkiyat var." };

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

export async function getQualityReportById(id: string) {
  const { data, error } = (await supabase
    .from("quality_reports" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<QualityReport>;

  if (error) return failure("getQualityReportById", error, null);
  return success(data);
}

export async function createQualityReport(payload: Partial<QualityReport>) {
  const generated = payload.report_no ? success(payload.report_no) : await getNextERPNumber("QUALITY_REPORT");
  const insertPayload: Record<string, unknown> = {
    report_no: generated.data,
    work_order_id: payload.work_order_id ?? null,
    sales_order_id: payload.sales_order_id ?? null,
    inspector_employee_id: payload.inspector_employee_id ?? null,
    inspection_date: payload.inspection_date ?? new Date().toISOString().slice(0, 10),
    result: payload.result ?? "pending",
    notes: payload.notes ?? null,
  };

  if (payload.work_order_operation_id) {
    insertPayload.work_order_operation_id = payload.work_order_operation_id;
  }

  const { data, error } = (await supabase
    .from("quality_reports" as never)
    .insert(insertPayload as never)
    .select("*")
    .single()) as unknown as DbResult<QualityReport>;

  if (error) return failure("createQualityReport", error, null);
  if (data?.work_order_id) await updateWorkOrder(data.work_order_id, { status: "quality_check" });
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updateQualityReport(id: string, payload: Partial<QualityReport>) {
  const before = payload.result
    ? ((await supabase.from("quality_reports" as never).select("result").eq("id", id).maybeSingle()) as unknown as DbResult<{ result: string }>)
    : null;

  const { data, error } = (await supabase
    .from("quality_reports" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<QualityReport>;

  if (error) return failure("updateQualityReport", error, null);
  if (payload.result && data) {
    await createAuditLog({
      entity_type: "quality_report",
      entity_id: data.id,
      action: "quality_result_updated",
      old_status: before?.data?.result ?? null,
      new_status: data.result,
      description: `${data.report_no} kalite sonucu güncellendi.`,
      metadata: { work_order_id: data.work_order_id, sales_order_id: data.sales_order_id },
    });
  }
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

export async function listFinancialAccounts(): Promise<ApiResult<FinancialAccount[]>> {
  const { data, error } = (await supabase
    .from("financial_accounts" as never)
    .select("*")
    .order("name", { ascending: true })) as unknown as DbResult<FinancialAccount[]>;

  if (error) return failure("listFinancialAccounts", error, []);
  return success(data ?? []);
}

export async function createFinancialAccount(payload: Partial<FinancialAccount> & { account_type: FinancialAccount["account_type"]; name: string }) {
  const { data, error } = (await supabase
    .from("financial_accounts" as never)
    .insert({
      account_type: payload.account_type,
      name: payload.name,
      currency: payload.currency ?? "TRY",
      opening_balance: payload.opening_balance ?? 0,
      current_balance: payload.current_balance ?? payload.opening_balance ?? 0,
      is_active: payload.is_active ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<FinancialAccount>;

  if (error) return failure("createFinancialAccount", error, null);
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

export async function updateInvoice(id: string, payload: Partial<Invoice>) {
  const { data, error } = (await supabase
    .from("invoices" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<Invoice>;

  if (error) return failure("updateInvoice", error, null);
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

export async function updatePayment(id: string, payload: Partial<Payment>) {
  const { data, error } = (await supabase
    .from("payments" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<Payment>;

  if (error) return failure("updatePayment", error, null);
  return success(data);
}

export async function listPurchaseOrders(search = ""): Promise<ApiResult<PurchaseOrder[]>> {
  let query = supabase
    .from("purchase_orders" as never)
    .select("*")
    .order("created_at", { ascending: false });

  const q = normalizeSearch(search);
  if (q) query = query.or(`purchase_order_no.ilike.%${q}%,title.ilike.%${q}%`);

  const { data, error } = (await query) as unknown as DbResult<PurchaseOrder[]>;
  if (error) return failure("listPurchaseOrders", error, []);
  return success(data ?? []);
}

export async function getPurchaseOrderById(id: string) {
  const { data, error } = (await supabase
    .from("purchase_orders" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<PurchaseOrder>;

  if (error) return failure("getPurchaseOrderById", error, null);
  return success(data);
}

export async function createPurchaseOrder(payload: Partial<PurchaseOrder> & { title: string }) {
  const generated = payload.purchase_order_no ? success(payload.purchase_order_no) : await getNextERPNumber("PURCHASE_ORDER");
  const { data, error } = (await supabase
    .from("purchase_orders" as never)
    .insert({
      purchase_order_no: generated.data,
      supplier_id: payload.supplier_id ?? null,
      title: payload.title,
      status: payload.status ?? "draft",
      order_date: payload.order_date ?? new Date().toISOString().slice(0, 10),
      expected_delivery_date: payload.expected_delivery_date ?? null,
      currency: payload.currency ?? "TRY",
      subtotal: payload.subtotal ?? 0,
      tax_total: payload.tax_total ?? 0,
      grand_total: payload.grand_total ?? 0,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<PurchaseOrder>;

  if (error) return failure("createPurchaseOrder", error, null);
  if (data) await createAuditLog({ entity_type: "purchase_order", entity_id: data.id, action: "created", description: `${data.purchase_order_no} satın alma siparişi oluşturuldu.` });
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updatePurchaseOrder(id: string, payload: Partial<PurchaseOrder>) {
  const before = payload.status
    ? ((await supabase.from("purchase_orders" as never).select("status").eq("id", id).maybeSingle()) as unknown as DbResult<{ status: string }>)
    : null;

  const { data, error } = (await supabase
    .from("purchase_orders" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<PurchaseOrder>;

  if (error) return failure("updatePurchaseOrder", error, null);
  if (payload.status && data) {
    await createAuditLog({
      entity_type: "purchase_order",
      entity_id: id,
      action: "status_changed",
      old_status: before?.data?.status ?? null,
      new_status: data.status,
      description: `${data.purchase_order_no} satın alma durumu güncellendi.`,
    });
  }
  return success(data);
}

export async function listPurchaseOrderItems(purchaseOrderId: string): Promise<ApiResult<PurchaseOrderItem[]>> {
  const { data, error } = (await supabase
    .from("purchase_order_items" as never)
    .select("*")
    .eq("purchase_order_id", purchaseOrderId)
    .order("created_at", { ascending: true })) as unknown as DbResult<PurchaseOrderItem[]>;

  if (error) return failure("listPurchaseOrderItems", error, []);
  return success(data ?? []);
}

export async function listShopProducts(): Promise<ApiResult<ShopProduct[]>> {
  const { data, error } = (await supabase
    .from("products" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ShopProduct[]>;

  if (error) return failure("listShopProducts", error, []);
  return success(data ?? []);
}

export async function updateShopProduct(id: string, payload: Partial<ShopProduct>) {
  const { data, error } = (await supabase
    .from("products" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ShopProduct>;

  if (error) return failure("updateShopProduct", error, null);
  return success(data);
}

export async function listShopCategories(): Promise<ApiResult<ShopCategory[]>> {
  const { data, error } = (await supabase
    .from("shop_categories" as never)
    .select("*")
    .order("sort_order", { ascending: true })) as unknown as DbResult<ShopCategory[]>;

  if (error) return failure("listShopCategories", error, []);
  return success(data ?? []);
}

export async function createShopCategory(payload: Partial<ShopCategory> & { name: string; slug: string }) {
  const { data, error } = (await supabase
    .from("shop_categories" as never)
    .insert({
      name: payload.name,
      slug: payload.slug,
      description: payload.description ?? null,
      parent_category_id: payload.parent_category_id ?? null,
      is_active: payload.is_active ?? true,
      sort_order: payload.sort_order ?? 0,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ShopCategory>;

  if (error) return failure("createShopCategory", error, null);
  return success(data);
}

export async function updateShopCategory(id: string, payload: Partial<ShopCategory>) {
  const { data, error } = (await supabase
    .from("shop_categories" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ShopCategory>;

  if (error) return failure("updateShopCategory", error, null);
  return success(data);
}

export async function listShopOrders(): Promise<ApiResult<ShopOrder[]>> {
  const { data, error } = (await supabase
    .from("orders" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ShopOrder[]>;

  if (error) return failure("listShopOrders", error, []);
  return success(data ?? []);
}

export async function listShopOrderItems(orderId: string): Promise<ApiResult<ShopOrderItem[]>> {
  const { data, error } = (await supabase
    .from("order_items" as never)
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })) as unknown as DbResult<ShopOrderItem[]>;

  if (error) return failure("listShopOrderItems", error, []);
  return success(data ?? []);
}

export async function updateShopOrder(id: string, payload: Partial<ShopOrder>) {
  const { data, error } = (await supabase
    .from("orders" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ShopOrder>;

  if (error) return failure("updateShopOrder", error, null);
  return success(data);
}

export async function listShopCampaigns(): Promise<ApiResult<ShopCampaign[]>> {
  const { data, error } = (await supabase
    .from("shop_campaigns" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ShopCampaign[]>;

  if (error) return failure("listShopCampaigns", error, []);
  return success(data ?? []);
}

export async function createShopCampaign(payload: Partial<ShopCampaign> & { name: string }) {
  const { data, error } = (await supabase
    .from("shop_campaigns" as never)
    .insert({
      name: payload.name,
      code: payload.code ?? null,
      discount_type: payload.discount_type ?? "percentage",
      discount_value: payload.discount_value ?? 0,
      starts_at: payload.starts_at ?? null,
      ends_at: payload.ends_at ?? null,
      is_active: payload.is_active ?? true,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ShopCampaign>;

  if (error) return failure("createShopCampaign", error, null);
  return success(data);
}

export async function updateShopCampaign(id: string, payload: Partial<ShopCampaign>) {
  const { data, error } = (await supabase
    .from("shop_campaigns" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ShopCampaign>;

  if (error) return failure("updateShopCampaign", error, null);
  return success(data);
}

export async function listShopCarts(): Promise<ApiResult<ShopCart[]>> {
  const { data, error } = (await supabase
    .from("shop_carts" as never)
    .select("*")
    .order("updated_at", { ascending: false })) as unknown as DbResult<ShopCart[]>;

  if (error) return failure("listShopCarts", error, []);
  return success(data ?? []);
}

export async function listShopPaymentStatuses(): Promise<ApiResult<ShopPaymentStatusRecord[]>> {
  const { data, error } = (await supabase
    .from("shop_payment_statuses" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ShopPaymentStatusRecord[]>;

  if (error) return failure("listShopPaymentStatuses", error, []);
  return success(data ?? []);
}

export async function createShopPaymentStatus(payload: Partial<ShopPaymentStatusRecord> & { order_id: string }) {
  const { data, error } = (await supabase
    .from("shop_payment_statuses" as never)
    .insert({
      order_id: payload.order_id,
      status: payload.status ?? "pending",
      provider: payload.provider ?? null,
      transaction_reference: payload.transaction_reference ?? null,
      amount: payload.amount ?? 0,
      currency: payload.currency ?? "TRY",
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ShopPaymentStatusRecord>;

  if (error) return failure("createShopPaymentStatus", error, null);
  await updateShopOrder(payload.order_id, { payment_status: payload.status ?? "pending" });
  return success(data);
}

export async function convertShopOrderToSalesOrder(order: ShopOrder) {
  if (order.sales_order_id) return { data: null, error: "Bu e-ticaret siparişi zaten satış siparişine bağlanmış." };

  const stakeholder = order.stakeholder_id
    ? success<Stakeholder | null>(null)
    : await createStakeholder({
        type: "customer",
        company_name: order.company_name || order.customer_name,
        contact_name: order.customer_name,
        phone: order.phone,
        email: order.email,
        address: order.address,
        notes: "E-ticaret siparişinden oluşturuldu.",
      });
  if (stakeholder.error) return { data: null, error: stakeholder.error };

  const salesOrder = await createSalesOrder({
    stakeholder_id: order.stakeholder_id ?? stakeholder.data?.id ?? null,
    title: `E-Ticaret Siparişi ${order.order_number}`,
    description: order.notes,
    status: "new",
    priority: "normal",
    order_date: order.created_at.slice(0, 10),
    currency: order.currency,
    subtotal: order.subtotal,
    tax_total: order.tax_total,
    grand_total: order.grand_total,
    notes: `Kaynak e-ticaret siparişi: ${order.order_number}`,
  });
  if (salesOrder.error || !salesOrder.data) return salesOrder;

  const items = await listShopOrderItems(order.id);
  for (const item of items.data) {
    await createSalesOrderItem({
      sales_order_id: salesOrder.data.id,
      description: item.product_name,
      quantity: item.quantity,
      unit: "adet",
      unit_price: item.unit_price,
      total: item.line_total,
    });
  }

  await updateShopOrder(order.id, {
    sales_order_id: salesOrder.data.id,
    stakeholder_id: order.stakeholder_id ?? stakeholder.data?.id ?? null,
    status: "confirmed",
  });

  await createAuditLog({
    entity_type: "shop_order",
    entity_id: order.id,
    action: "converted_to_sales_order",
    description: `${order.order_number} e-ticaret siparişi satış siparişine dönüştürüldü.`,
    metadata: { sales_order_id: salesOrder.data.id },
  });

  return salesOrder;
}

export async function listWebsitePages(): Promise<ApiResult<WebsitePage[]>> {
  const { data, error } = (await supabase.from("website_pages" as never).select("*").order("updated_at", { ascending: false })) as unknown as DbResult<WebsitePage[]>;
  if (error) return failure("listWebsitePages", error, []);
  return success(data ?? []);
}

export async function createWebsitePage(payload: Partial<WebsitePage> & { title: string; slug: string }) {
  const { data, error } = (await supabase
    .from("website_pages" as never)
    .insert({
      title: payload.title,
      slug: payload.slug,
      page_type: payload.page_type ?? "content",
      status: payload.status ?? "draft",
      locale: payload.locale ?? "tr",
      summary: payload.summary ?? null,
      content: payload.content ?? null,
      published_at: payload.status === "published" ? new Date().toISOString() : payload.published_at ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<WebsitePage>;
  if (error) return failure("createWebsitePage", error, null);
  return success(data);
}

export async function updateWebsitePage(id: string, payload: Partial<WebsitePage>) {
  const { data, error } = (await supabase.from("website_pages" as never).update(payload as never).eq("id", id).select("*").single()) as unknown as DbResult<WebsitePage>;
  if (error) return failure("updateWebsitePage", error, null);
  return success(data);
}

export async function listWebsiteSEOSettings(): Promise<ApiResult<WebsiteSEOSetting[]>> {
  const { data, error } = (await supabase.from("website_seo_settings" as never).select("*").order("route_path", { ascending: true })) as unknown as DbResult<WebsiteSEOSetting[]>;
  if (error) return failure("listWebsiteSEOSettings", error, []);
  return success(data ?? []);
}

export async function createWebsiteSEOSetting(payload: Partial<WebsiteSEOSetting> & { route_path: string }) {
  const { data, error } = (await supabase
    .from("website_seo_settings" as never)
    .insert({
      page_id: payload.page_id ?? null,
      route_path: payload.route_path,
      meta_title: payload.meta_title ?? null,
      meta_description: payload.meta_description ?? null,
      canonical_url: payload.canonical_url ?? null,
      robots: payload.robots ?? "index,follow",
      og_image_path: payload.og_image_path ?? null,
      is_active: payload.is_active ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<WebsiteSEOSetting>;
  if (error) return failure("createWebsiteSEOSetting", error, null);
  return success(data);
}

export async function listWebsiteMenuItems(): Promise<ApiResult<WebsiteMenuItem[]>> {
  const { data, error } = (await supabase.from("website_menu_items" as never).select("*").order("sort_order", { ascending: true })) as unknown as DbResult<WebsiteMenuItem[]>;
  if (error) return failure("listWebsiteMenuItems", error, []);
  return success(data ?? []);
}

export async function createWebsiteMenuItem(payload: Partial<WebsiteMenuItem> & { label: string; path: string }) {
  const { data, error } = (await supabase
    .from("website_menu_items" as never)
    .insert({
      label: payload.label,
      path: payload.path,
      menu_area: payload.menu_area ?? "header",
      parent_item_id: payload.parent_item_id ?? null,
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<WebsiteMenuItem>;
  if (error) return failure("createWebsiteMenuItem", error, null);
  return success(data);
}

export async function updateWebsiteMenuItem(id: string, payload: Partial<WebsiteMenuItem>) {
  const { data, error } = (await supabase.from("website_menu_items" as never).update(payload as never).eq("id", id).select("*").single()) as unknown as DbResult<WebsiteMenuItem>;
  if (error) return failure("updateWebsiteMenuItem", error, null);
  return success(data);
}

export async function listWebsiteMediaAssets(): Promise<ApiResult<WebsiteMediaAsset[]>> {
  const { data, error } = (await supabase.from("website_media_assets" as never).select("*").order("created_at", { ascending: false })) as unknown as DbResult<WebsiteMediaAsset[]>;
  if (error) return failure("listWebsiteMediaAssets", error, []);
  return success(data ?? []);
}

export async function createWebsiteMediaAsset(payload: Partial<WebsiteMediaAsset> & { file_name: string; file_path: string }) {
  const { data, error } = (await supabase
    .from("website_media_assets" as never)
    .insert({
      file_name: payload.file_name,
      file_path: payload.file_path,
      media_type: payload.media_type ?? "image",
      alt_text: payload.alt_text ?? null,
      usage_area: payload.usage_area ?? null,
      is_public: payload.is_public ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<WebsiteMediaAsset>;
  if (error) return failure("createWebsiteMediaAsset", error, null);
  return success(data);
}

export async function listWebsiteForms(): Promise<ApiResult<WebsiteForm[]>> {
  const { data, error } = (await supabase.from("website_forms" as never).select("*").order("name", { ascending: true })) as unknown as DbResult<WebsiteForm[]>;
  if (error) return failure("listWebsiteForms", error, []);
  return success(data ?? []);
}

export async function createWebsiteForm(payload: Partial<WebsiteForm> & { name: string; form_key: string }) {
  const { data, error } = (await supabase
    .from("website_forms" as never)
    .insert({
      name: payload.name,
      form_key: payload.form_key,
      target_email: payload.target_email ?? null,
      success_message: payload.success_message ?? null,
      is_active: payload.is_active ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<WebsiteForm>;
  if (error) return failure("createWebsiteForm", error, null);
  return success(data);
}

export async function listWebsiteFormSubmissions(): Promise<ApiResult<WebsiteFormSubmission[]>> {
  const { data, error } = (await supabase.from("website_form_submissions" as never).select("*").order("created_at", { ascending: false })) as unknown as DbResult<WebsiteFormSubmission[]>;
  if (error) return failure("listWebsiteFormSubmissions", error, []);
  return success(data ?? []);
}

export async function updateWebsiteFormSubmission(id: string, payload: Partial<WebsiteFormSubmission>) {
  const { data, error } = (await supabase.from("website_form_submissions" as never).update(payload as never).eq("id", id).select("*").single()) as unknown as DbResult<WebsiteFormSubmission>;
  if (error) return failure("updateWebsiteFormSubmission", error, null);
  return success(data);
}

export async function listWebsiteBanners(): Promise<ApiResult<WebsiteBanner[]>> {
  const { data, error } = (await supabase.from("website_banners" as never).select("*").order("sort_order", { ascending: true })) as unknown as DbResult<WebsiteBanner[]>;
  if (error) return failure("listWebsiteBanners", error, []);
  return success(data ?? []);
}

export async function createWebsiteBanner(payload: Partial<WebsiteBanner> & { title: string }) {
  const { data, error } = (await supabase
    .from("website_banners" as never)
    .insert({
      title: payload.title,
      subtitle: payload.subtitle ?? null,
      image_path: payload.image_path ?? null,
      link_url: payload.link_url ?? null,
      placement: payload.placement ?? "home",
      status: payload.status ?? "draft",
      starts_at: payload.starts_at ?? null,
      ends_at: payload.ends_at ?? null,
      sort_order: payload.sort_order ?? 0,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<WebsiteBanner>;
  if (error) return failure("createWebsiteBanner", error, null);
  return success(data);
}

export async function createPurchaseOrderItem(payload: Partial<PurchaseOrderItem> & { purchase_order_id: string; description: string }) {
  const quantity = numberValue(payload.quantity, 1);
  const unitPrice = numberValue(payload.unit_price, 0);
  const total = payload.total ?? quantity * unitPrice;
  const { data, error } = (await supabase
    .from("purchase_order_items" as never)
    .insert({
      purchase_order_id: payload.purchase_order_id,
      inventory_item_id: payload.inventory_item_id ?? null,
      description: payload.description,
      quantity,
      unit: payload.unit ?? "adet",
      unit_price: unitPrice,
      total,
      received_quantity: payload.received_quantity ?? 0,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<PurchaseOrderItem>;

  if (error) return failure("createPurchaseOrderItem", error, null);
  return success(data);
}

export async function receivePurchaseOrderItem(item: PurchaseOrderItem, quantity: number) {
  const requestedQuantity = numberValue(quantity, 0);
  if (requestedQuantity <= 0) return validationFailure<PurchaseOrderItem | null>("Teslim alınacak miktar sıfırdan büyük olmalıdır.", null);

  const totalQuantity = numberValue(item.quantity, 0);
  const alreadyReceived = numberValue(item.received_quantity, 0);
  const remainingQuantity = Math.max(totalQuantity - alreadyReceived, 0);
  if (remainingQuantity <= 0) return validationFailure<PurchaseOrderItem | null>("Bu kalem tamamen teslim alınmış.", null);
  if (requestedQuantity > remainingQuantity) return validationFailure<PurchaseOrderItem | null>("Teslim alınacak miktar kalan miktarı aşamaz.", null);

  const receivedQuantity = alreadyReceived + requestedQuantity;
  const { data, error } = (await supabase
    .from("purchase_order_items" as never)
    .update({ received_quantity: receivedQuantity } as never)
    .eq("id", item.id)
    .select("*")
    .single()) as unknown as DbResult<PurchaseOrderItem>;

  if (error) return failure("receivePurchaseOrderItem", error, null);

  if (item.inventory_item_id) {
    await createInventoryMovement({
      inventory_item_id: item.inventory_item_id,
      movement_type: "in",
      quantity: requestedQuantity,
      source_type: "purchase_order",
      source_id: item.purchase_order_id,
      notes: `${item.description} satın alma teslim alındı.`,
    });
  }

  const allItems = await listPurchaseOrderItems(item.purchase_order_id);
  const allReceived = allItems.data.every((row) => Number(row.received_quantity) >= Number(row.quantity));
  const partiallyReceived = allItems.data.some((row) => Number(row.received_quantity) > 0);
  await updatePurchaseOrder(item.purchase_order_id, { status: allReceived ? "received" : partiallyReceived ? "partially_received" : "sent" });
  await createAuditLog({
    entity_type: "purchase_order",
    entity_id: item.purchase_order_id,
    action: "purchase_order_received",
    description: `${item.description} kaleminden ${requestedQuantity} ${item.unit} teslim alındı.`,
    metadata: { purchase_order_item_id: item.id, inventory_item_id: item.inventory_item_id },
  });

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

export async function listDocumentsForEntity(entityType: string, entityId: string): Promise<ApiResult<DocumentMetadata[]>> {
  const { data, error } = (await supabase
    .from("documents" as never)
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })) as unknown as DbResult<DocumentMetadata[]>;

  if (error) return failure("listDocumentsForEntity", error, []);
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

export async function getERPDashboardActivity(): Promise<ApiResult<ERPDashboardActivity>> {
  const empty: ERPDashboardActivity = {
    recentSalesOrders: [],
    recentWorkOrders: [],
    recentSubcontractingJobs: [],
    lowStockItems: [],
    pendingQualityReports: [],
    recentAuditLogs: [],
    recentNotifications: [],
  };

  try {
    const [salesOrders, workOrders, subcontracting, inventory, quality, auditLogs, notifications] = await Promise.all([
      listSalesOrders(),
      listWorkOrders(),
      listSubcontractingJobs(),
      listInventoryItems(),
      listQualityReports(),
      listRecentAuditLogs(8),
      listNotifications(8),
    ]);

    const results = [salesOrders, workOrders, subcontracting, inventory, quality, auditLogs, notifications];
    const missingTable = results.some((result) => result.missingTable);
    const firstError = results.find((result) => result.error)?.error ?? null;

    return {
      data: {
        recentSalesOrders: salesOrders.data.slice(0, 5),
        recentWorkOrders: workOrders.data.slice(0, 5),
        recentSubcontractingJobs: subcontracting.data.slice(0, 5),
        lowStockItems: inventory.data.filter((item) => Number(item.current_stock) <= Number(item.min_stock)).slice(0, 5),
        pendingQualityReports: quality.data.filter((report) => report.result === "pending").slice(0, 5),
        recentAuditLogs: auditLogs.data,
        recentNotifications: notifications.data,
      },
      error: missingTable ? ERP_MIGRATION_MESSAGE : firstError,
      missingTable,
    };
  } catch (error) {
    return failure("getERPDashboardActivity", error, empty);
  }
}

export async function getERPDashboardMetrics(): Promise<ApiResult<DashboardMetrics>> {
  const defaultMetrics: DashboardMetrics = {
    stakeholderCount: 0,
    openQuotations: 0,
    activeSalesOrders: 0,
    openWorkOrders: 0,
    inventoryItemCount: 0,
    purchaseOrderCount: 0,
    auditLogCount: 0,
    unreadNotificationCount: 0,
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
      inventoryItemCount,
      purchaseOrderCount,
      auditLogCount,
      unreadNotificationCount,
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
      safeCount("inventory_items", supabase.from("inventory_items" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount("purchase_orders", supabase.from("purchase_orders" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount("erp_audit_logs", supabase.from("erp_audit_logs" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount("erp_notifications unread", supabase.from("erp_notifications" as never).select("id", { count: "exact", head: true }).eq("is_read", false) as unknown as Promise<unknown>),
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
        inventoryItemCount,
        purchaseOrderCount,
        auditLogCount,
        unreadNotificationCount,
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
        inventoryItemCount: inventoryItemCount.count,
        purchaseOrderCount: purchaseOrderCount.count,
        auditLogCount: auditLogCount.count,
        unreadNotificationCount: unreadNotificationCount.count,
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

export async function getERPReportSummary(): Promise<ApiResult<ERPReportSummary>> {
  const empty: ERPReportSummary = {
    openSalesOrders: 0,
    overdueSalesOrders: 0,
    openWorkOrders: 0,
    overdueWorkOrders: 0,
    purchaseOrders: 0,
    auditLogs: 0,
    financialAccounts: 0,
    waitingSubcontracting: 0,
    lowStockItems: 0,
    inventoryMovements: 0,
    pendingQualityReports: 0,
    upcomingMaintenances: 0,
  };

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [
      openSalesOrders,
      overdueSalesOrders,
      openWorkOrders,
      overdueWorkOrders,
      purchaseOrders,
      auditLogs,
      financialAccounts,
      waitingSubcontracting,
      inventoryMovements,
      pendingQualityReports,
      upcomingMaintenances,
    ] = await Promise.all([
      safeCount("report open sales orders", supabase.from("sales_orders" as never).select("id", { count: "exact", head: true }).not("status", "in", "(closed,cancelled)") as unknown as Promise<unknown>),
      safeCount("report overdue sales orders", supabase.from("sales_orders" as never).select("id", { count: "exact", head: true }).not("status", "in", "(closed,cancelled)").lt("due_date", today) as unknown as Promise<unknown>),
      safeCount("report open work orders", supabase.from("work_orders" as never).select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled)") as unknown as Promise<unknown>),
      safeCount("report overdue work orders", supabase.from("work_orders" as never).select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled)").lt("planned_end_date", today) as unknown as Promise<unknown>),
      safeCount("report purchase orders", supabase.from("purchase_orders" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount("report audit logs", supabase.from("erp_audit_logs" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount("report financial accounts", supabase.from("financial_accounts" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount("report subcontracting", supabase.from("subcontracting_jobs" as never).select("id", { count: "exact", head: true }).not("status", "in", "(returned,cancelled)") as unknown as Promise<unknown>),
      safeCount("report inventory movements", supabase.from("inventory_movements" as never).select("id", { count: "exact", head: true }) as unknown as Promise<unknown>),
      safeCount("report quality pending", supabase.from("quality_reports" as never).select("id", { count: "exact", head: true }).eq("result", "pending") as unknown as Promise<unknown>),
      safeCount("report maintenance", supabase.from("maintenance_tasks" as never).select("id", { count: "exact", head: true }).in("status", ["planned", "in_progress"]) as unknown as Promise<unknown>),
    ]);

    const stock = await listInventoryItems();
    const summary: ERPReportSummary = {
      openSalesOrders: openSalesOrders.count,
      overdueSalesOrders: overdueSalesOrders.count,
      openWorkOrders: openWorkOrders.count,
      overdueWorkOrders: overdueWorkOrders.count,
      purchaseOrders: purchaseOrders.count,
      auditLogs: auditLogs.count,
      financialAccounts: financialAccounts.count,
      waitingSubcontracting: waitingSubcontracting.count,
      lowStockItems: stock.data.filter((item) => Number(item.current_stock) <= Number(item.min_stock)).length,
      inventoryMovements: inventoryMovements.count,
      pendingQualityReports: pendingQualityReports.count,
      upcomingMaintenances: upcomingMaintenances.count,
    };

    const missingTable = [
      openSalesOrders,
      overdueSalesOrders,
      openWorkOrders,
      overdueWorkOrders,
      purchaseOrders,
      auditLogs,
      financialAccounts,
      waitingSubcontracting,
      inventoryMovements,
      pendingQualityReports,
      upcomingMaintenances,
    ].some((item) => item.missingTable) || stock.missingTable;
    return { data: summary, error: missingTable ? ERP_MIGRATION_MESSAGE : stock.error, missingTable };
  } catch (error) {
    return failure("getERPReportSummary", error, empty);
  }
}
