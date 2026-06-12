import { supabase } from "@/integrations/supabase/client";
import {
  ApiResult,
  AccountingEntry,
  AutomationExecutionRecord,
  AutomationRuleRecord,
  Company,
  CompanyBranch,
  CompanyMembership,
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
  FinancialAccount,
  Invoice,
  LegacyCustomerCandidate,
  LegacyCustomerImportPreview,
  LegacyCustomerImportResult,
  Machine,
  MaintenanceTask,
  Payment,
  PaymentProviderEvent,
  PaymentProviderHealth,
  PaymentReconciliationLog,
  PaymentRefundOperation,
  PlatformAlertRecord,
  PlatformEventRecord,
  PlatformMetricRecord,
  ScheduledJobRunRecord,
  Priority,
  ProductionRoute,
  ProductionRouteStep,
  PurchaseOrder,
  PurchaseOrderItem,
  QualityMeasurement,
  QualityReport,
  SalesOrder,
  SalesOrderStatus,
  Shipment,
  ShipmentItem,
  ShopCampaign,
  ShopCart,
  ShopCategory,
  ShopCarrier,
  ShopCustomerNotification,
  ShopFulfillmentHistory,
  ShopOrder,
  ShopOrderItem,
  ShopPaymentStatusRecord,
  ShopProduct,
  ShopReturnRequest,
  ShopShipment,
  Stakeholder,
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
import { getDemoDatabaseStatus } from "./demoFallback";
import {
  applyEnterpriseScope,
  createAuditLog,
  DbResult,
  EnterpriseQueryScope,
  failure,
  getNextERPNumber,
  isMissingTableError,
  logError,
  normalizeSearch,
  numberValue,
  resolveEnterpriseScope,
  success,
  toErrorMessage,
  validationFailure,
  withEnterpriseOwnership,
} from "./api/internal";
import { createStakeholder, listStakeholders } from "./api/crmApi";
import {
  createSalesOrder,
  createSalesOrderItem,
  listSalesOrderItems,
  listSalesOrders,
  updateSalesOrder,
} from "./api/salesApi";
import {
  createInventoryMovement,
  listInventoryItems,
} from "./api/inventoryApi";

export { createAuditLog, getNextERPNumber } from "./api/internal";
export {
  convertLeadToOpportunity,
  createCRMActivity,
  createCRMLead,
  createCRMOpportunity,
  createCRMTask,
  createStakeholder,
  getStakeholderById,
  listCRMActivities,
  listCRMLeads,
  listCRMOpportunities,
  listCRMTasks,
  listStakeholders,
  updateCRMLead,
  updateCRMOpportunity,
  updateCRMTask,
  updateStakeholder,
} from "./api/crmApi";
export {
  convertQuotationToSalesOrder,
  createSalesOrder,
  createSalesOrderItem,
  findOrCreateStakeholderByCompany,
  getQuotationConversionState,
  getSalesOrder,
  getSalesOrderById,
  linkQuotationToStakeholder,
  listERPQuotationsFromExistingTable,
  listQuotations,
  listSalesOrderItems,
  listSalesOrders,
  updateSalesOrder,
} from "./api/salesApi";
export {
  createInventoryItem,
  createInventoryMovement,
  createWarehouse,
  getInventoryItemById,
  listInventoryItems,
  listInventoryMovements,
  listInventoryMovementsForItem,
  listWarehouses,
  updateInventoryItem,
  updateWarehouse,
} from "./api/inventoryApi";

export const ERP_MIGRATION_MESSAGE =
  "ERP veritabanı tabloları henüz oluşturulmamış. Supabase SQL geçiş dosyasını çalıştırın.";

export type { EnterpriseQueryScope } from "./api/internal";

async function safeCount(scope: string, queryPromise: Promise<unknown>) {
  const { count, error } = (await queryPromise) as { count: number | null; error: unknown };
  if (error) {
    logError(`count ${scope}`, error);
    return { count: 0, missingTable: isMissingTableError(error), error: toErrorMessage(error) };
  }
  return { count: count ?? 0, missingTable: false, error: null };
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

export async function getERPDatabaseStatus(): Promise<ApiResult<ERPDatabaseStatus>> {
  const keyTables = [
    "admin_users",
    "companies",
    "company_branches",
    "warehouses",
    "company_memberships",
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
    "platform_metrics",
    "platform_events",
    "platform_alerts",
    "scheduled_job_runs",
    "automation_rules",
    "automation_executions",
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
  if (hasMissing) {
    return {
      data: getDemoDatabaseStatus(),
      error: null,
      missingTable: true,
      demoFallback: true,
    };
  }

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

export async function listAuditLogs(filters: {
  search?: string;
  actor?: string;
  companyId?: string;
  branchId?: string;
  entityType?: string;
  action?: string;
  limit?: number;
} = {}): Promise<ApiResult<ERPAuditLog[]>> {
  let query = supabase
    .from("erp_audit_logs" as never)
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.actor) query = query.ilike("actor_email" as never, `%${filters.actor}%` as never);
  if (filters.companyId && filters.companyId !== "all") query = query.eq("company_id" as never, filters.companyId as never);
  if (filters.branchId && filters.branchId !== "all") query = query.eq("branch_id" as never, filters.branchId as never);
  if (filters.entityType && filters.entityType !== "all") query = query.eq("entity_type" as never, filters.entityType as never);
  if (filters.action && filters.action !== "all") query = query.eq("action" as never, filters.action as never);

  const { data, error } = (await query.limit(filters.limit ?? 200)) as unknown as DbResult<ERPAuditLog[]>;
  if (error) return failure("listAuditLogs", error, []);

  const needle = normalizeSearch(filters.search);
  const rows = data ?? [];
  if (!needle) return success(rows);
  return success(rows.filter((row) => {
    const haystack = [
      row.actor_email,
      row.entity_type,
      row.entity_id,
      row.action,
      row.description,
      row.old_status,
      row.new_status,
      row.company_id,
      row.branch_id,
    ].join(" ").toLocaleLowerCase("tr-TR");
    return haystack.includes(needle.toLocaleLowerCase("tr-TR"));
  }));
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

export type PlatformOperationalSummary = {
  metrics: PlatformMetricRecord[];
  events: PlatformEventRecord[];
  alerts: PlatformAlertRecord[];
  scheduledJobRuns: ScheduledJobRunRecord[];
  automationRules: AutomationRuleRecord[];
  automationExecutions: AutomationExecutionRecord[];
  openAlertCount: number;
  criticalAlertCount: number;
  failedJobCount: number;
  jobSuccessRate: number;
  jobFailureRate: number;
  retryCount: number;
  automationSuccessRate: number;
  automationFailureRate: number;
};

export type RegisteredOperationalJob = {
  key: ScheduledJobRunRecord["job_type"];
  name: string;
  module: string;
  description: string;
  maxRetries: number;
};

type JobExecutionResult = {
  severity: ScheduledJobRunRecord["severity"];
  summary: string;
  metrics: Array<{ key: string; name: string; value: number; unit?: string; severity?: ScheduledJobRunRecord["severity"] }>;
  alert?: { key: string; title: string; description: string; severity: PlatformAlertRecord["severity"] };
  metadata?: Record<string, unknown>;
};

const operationalJobRegistry: RegisteredOperationalJob[] = [
  { key: "reconciliation_check", name: "Mutabakat Kontrolü", module: "finance", description: "Ödeme ve mutabakat kayıtlarını doğrular.", maxRetries: 2 },
  { key: "inventory_verification", name: "Stok Doğrulama", module: "inventory", description: "Minimum stok ve hareket risklerini kontrol eder.", maxRetries: 2 },
  { key: "backup_verification", name: "Yedek Doğrulama", module: "governance", description: "Yedek doğrulama prosedürü için kayıt üretir.", maxRetries: 1 },
  { key: "webhook_cleanup", name: "Webhook Temizliği", module: "commerce", description: "Webhook tekrar ve hata kayıtlarını denetler.", maxRetries: 2 },
  { key: "tenant_isolation_verification", name: "Tenant İzolasyon Kontrolü", module: "security", description: "Şirket ve şube kapsamlı veri kayıtlarını doğrular.", maxRetries: 1 },
  { key: "observability_aggregation", name: "Observability Agregasyonu", module: "operations", description: "Operasyon metriklerini kalıcı kayıtlara toplar.", maxRetries: 2 },
];

export function listRegisteredOperationalJobs() {
  return operationalJobRegistry;
}

async function getCurrentActorEmail() {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

async function requireScopedCompany(scope?: EnterpriseQueryScope): Promise<EnterpriseQueryScope & { companyId: string }> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  if (!enterpriseScope.companyId) throw new Error("Şirket kapsamı seçilmeden operasyon çalıştırılamaz.");
  return { ...enterpriseScope, companyId: enterpriseScope.companyId };
}

function durationMs(startedAt: string, completedAt: string) {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

function successRate(successes: number, total: number) {
  if (!total) return 0;
  return Math.round((successes / total) * 100);
}

export async function listPlatformMetrics(scope?: EnterpriseQueryScope, limit = 100): Promise<ApiResult<PlatformMetricRecord[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = supabase
    .from("platform_metrics" as never)
    .select("*")
    .order("measured_at", { ascending: false })
    .limit(limit);

  query = applyEnterpriseScope(query, enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<PlatformMetricRecord[]>;
  if (error) return failure("listPlatformMetrics", error, []);
  return success(data ?? []);
}

export async function createPlatformMetric(payload: Partial<PlatformMetricRecord> & { metric_key: string; metric_name: string; source: string; module: string }, scope?: EnterpriseQueryScope) {
  const record = await withEnterpriseOwnership({
    metric_key: payload.metric_key,
    metric_name: payload.metric_name,
    metric_value: payload.metric_value ?? null,
    metric_unit: payload.metric_unit ?? null,
    severity: payload.severity ?? "info",
    status: payload.status ?? "active",
    source: payload.source,
    module: payload.module,
    measured_at: payload.measured_at ?? new Date().toISOString(),
    metadata: payload.metadata ?? {},
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  }, scope);

  const { data, error } = (await supabase
    .from("platform_metrics" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<PlatformMetricRecord>;

  if (error) return failure("createPlatformMetric", error, null);
  return success(data);
}

export async function listPlatformEvents(scope?: EnterpriseQueryScope, limit = 200): Promise<ApiResult<PlatformEventRecord[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = supabase
    .from("platform_events" as never)
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  query = applyEnterpriseScope(query, enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<PlatformEventRecord[]>;
  if (error) return failure("listPlatformEvents", error, []);
  return success(data ?? []);
}

export async function createPlatformEvent(payload: Partial<PlatformEventRecord> & { event_key: string; event_type: string; source: string; module: string; title: string }, scope?: EnterpriseQueryScope) {
  const record = await withEnterpriseOwnership({
    event_key: payload.event_key,
    event_type: payload.event_type,
    severity: payload.severity ?? "info",
    status: payload.status ?? "recorded",
    source: payload.source,
    module: payload.module,
    actor_email: payload.actor_email ?? await getCurrentActorEmail(),
    entity_type: payload.entity_type ?? null,
    entity_id: payload.entity_id ?? null,
    title: payload.title,
    description: payload.description ?? null,
    occurred_at: payload.occurred_at ?? new Date().toISOString(),
    metadata: payload.metadata ?? {},
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  }, scope);

  const { data, error } = (await supabase
    .from("platform_events" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<PlatformEventRecord>;

  if (error) return failure("createPlatformEvent", error, null);
  return success(data);
}

export async function listPlatformAlerts(scope?: EnterpriseQueryScope, limit = 100): Promise<ApiResult<PlatformAlertRecord[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = supabase
    .from("platform_alerts" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyEnterpriseScope(query, enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<PlatformAlertRecord[]>;
  if (error) return failure("listPlatformAlerts", error, []);
  return success(data ?? []);
}

export async function createPlatformAlert(payload: Partial<PlatformAlertRecord> & { alert_key: string; title: string; severity: PlatformAlertRecord["severity"]; source: string; module: string }, scope?: EnterpriseQueryScope) {
  const record = await withEnterpriseOwnership({
    alert_key: payload.alert_key,
    title: payload.title,
    description: payload.description ?? null,
    severity: payload.severity,
    status: payload.status ?? "open",
    source: payload.source,
    module: payload.module,
    event_id: payload.event_id ?? null,
    metadata: payload.metadata ?? {},
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  }, scope);

  const { data, error } = (await supabase
    .from("platform_alerts" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<PlatformAlertRecord>;

  if (error) return failure("createPlatformAlert", error, null);
  await createPlatformEvent({
    company_id: data.company_id,
    branch_id: data.branch_id,
    event_key: `alert-created-${data.id}`,
    event_type: "alert_created",
    severity: data.severity,
    status: "recorded",
    source: data.source,
    module: data.module,
    entity_type: "platform_alert",
    entity_id: data.id,
    title: data.title,
    description: data.description,
    metadata: { alert_key: data.alert_key },
  });
  return success(data);
}

export async function acknowledgePlatformAlert(id: string) {
  const actor = await getCurrentActorEmail();
  const now = new Date().toISOString();
  const { data, error } = (await supabase
    .from("platform_alerts" as never)
    .update({ status: "acknowledged", acknowledged_by: actor, acknowledged_at: now, updated_at: now } as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<PlatformAlertRecord>;

  if (error) return failure("acknowledgePlatformAlert", error, null);
  await createPlatformEvent({
    company_id: data.company_id,
    branch_id: data.branch_id,
    event_key: `alert-acknowledged-${data.id}-${now}`,
    event_type: "alert_acknowledged",
    severity: data.severity,
    status: "recorded",
    source: data.source,
    module: data.module,
    actor_email: actor,
    entity_type: "platform_alert",
    entity_id: data.id,
    title: data.title,
    description: "Alert acknowledged.",
    metadata: { alert_key: data.alert_key },
  });
  return success(data);
}

export async function resolvePlatformAlert(id: string, resolutionNotes?: string) {
  const actor = await getCurrentActorEmail();
  const now = new Date().toISOString();
  const { data, error } = (await supabase
    .from("platform_alerts" as never)
    .update({ status: "resolved", resolved_by: actor, resolved_at: now, resolution_notes: resolutionNotes ?? null, updated_at: now } as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<PlatformAlertRecord>;

  if (error) return failure("resolvePlatformAlert", error, null);
  await createPlatformEvent({
    company_id: data.company_id,
    branch_id: data.branch_id,
    event_key: `alert-resolved-${data.id}-${now}`,
    event_type: "alert_resolved",
    severity: "success",
    status: "recorded",
    source: data.source,
    module: data.module,
    actor_email: actor,
    entity_type: "platform_alert",
    entity_id: data.id,
    title: data.title,
    description: resolutionNotes ?? "Alert resolved.",
    metadata: { alert_key: data.alert_key },
  });
  return success(data);
}

export async function listScheduledJobRuns(scope?: EnterpriseQueryScope, limit = 100): Promise<ApiResult<ScheduledJobRunRecord[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = supabase
    .from("scheduled_job_runs" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyEnterpriseScope(query, enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<ScheduledJobRunRecord[]>;
  if (error) return failure("listScheduledJobRuns", error, []);
  return success(data ?? []);
}

export async function createScheduledJobRun(payload: Partial<ScheduledJobRunRecord> & { job_key: string; job_name: string; job_type: ScheduledJobRunRecord["job_type"] }, scope?: EnterpriseQueryScope) {
  const record = await withEnterpriseOwnership({
    job_key: payload.job_key,
    job_name: payload.job_name,
    job_type: payload.job_type,
    status: payload.status ?? "queued",
    severity: payload.severity ?? "info",
    source: payload.source ?? "erp",
    module: payload.module ?? "operations",
    queued_at: payload.queued_at ?? new Date().toISOString(),
    started_at: payload.started_at ?? null,
    completed_at: payload.completed_at ?? null,
    duration_ms: payload.duration_ms ?? null,
    retry_count: payload.retry_count ?? 0,
    max_retries: payload.max_retries ?? 2,
    next_retry_at: payload.next_retry_at ?? null,
    parent_job_run_id: payload.parent_job_run_id ?? null,
    audit_log_id: payload.audit_log_id ?? null,
    failure_reason: payload.failure_reason ?? null,
    metadata: payload.metadata ?? {},
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  }, scope);

  const { data, error } = (await supabase
    .from("scheduled_job_runs" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<ScheduledJobRunRecord>;

  if (error) return failure("createScheduledJobRun", error, null);
  return success(data);
}

async function updateScheduledJobRun(id: string, payload: Partial<ScheduledJobRunRecord>) {
  const { data, error } = (await supabase
    .from("scheduled_job_runs" as never)
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ScheduledJobRunRecord>;

  if (error) return failure("updateScheduledJobRun", error, null);
  return success(data);
}

async function runOperationalJobHandler(jobType: ScheduledJobRunRecord["job_type"], scope: EnterpriseQueryScope): Promise<JobExecutionResult> {
  if (jobType === "reconciliation_check") {
    const [reconciliations, payments] = await Promise.all([listPaymentReconciliationLogs(), listShopPaymentStatuses()]);
    const pending = reconciliations.data.filter((row) => row.status === "pending" || row.status === "manual_review").length;
    const failedPayments = payments.data.filter((row) => row.status === "failed").length;
    return {
      severity: pending || failedPayments ? "warning" : "success",
      summary: `${pending} pending reconciliation records and ${failedPayments} failed payments found.`,
      metrics: [
        { key: "reconciliation.pending", name: "Bekleyen Mutabakat", value: pending, severity: pending ? "warning" : "success" },
        { key: "payments.failed", name: "Başarısız Ödeme", value: failedPayments, severity: failedPayments ? "warning" : "success" },
      ],
      alert: pending || failedPayments ? { key: "reconciliation-risk", title: "Mutabakat Riski", description: "Bekleyen mutabakat veya başarısız ödeme kaydı var.", severity: failedPayments ? "critical" : "warning" } : undefined,
      metadata: { pending, failedPayments, paymentError: payments.error, reconciliationError: reconciliations.error },
    };
  }

  if (jobType === "inventory_verification") {
    const items = await listInventoryItems("", scope);
    const lowStock = items.data.filter((row) => row.current_stock <= row.min_stock).length;
    return {
      severity: lowStock ? "warning" : "success",
      summary: `${lowStock} low stock records found.`,
      metrics: [{ key: "inventory.low_stock", name: "Kritik Stok", value: lowStock, severity: lowStock ? "warning" : "success" }],
      alert: lowStock ? { key: "inventory-threshold", title: "Stok Eşiği Aşıldı", description: "Minimum seviyenin altında stok kayıtları var.", severity: lowStock >= 10 ? "critical" : "warning" } : undefined,
      metadata: { lowStock, totalItems: items.data.length, error: items.error },
    };
  }

  if (jobType === "webhook_cleanup") {
    const events = await listPaymentProviderEvents();
    const duplicates = events.data.filter((row) => row.duplicate_detected).length;
    const failed = events.data.filter((row) => row.processing_status === "failed").length;
    return {
      severity: failed ? "warning" : "success",
      summary: `${duplicates} duplicate webhook records and ${failed} failed webhook records detected.`,
      metrics: [
        { key: "webhooks.duplicates", name: "Tekrar Webhook", value: duplicates, severity: duplicates ? "warning" : "success" },
        { key: "webhooks.failed", name: "Webhook Hatası", value: failed, severity: failed ? "warning" : "success" },
      ],
      alert: failed ? { key: "webhook-cleanup-required", title: "Webhook İncelemesi Gerekli", description: "Başarısız webhook kayıtları bulundu.", severity: failed >= 3 ? "critical" : "warning" } : undefined,
      metadata: { duplicates, failed, error: events.error },
    };
  }

  if (jobType === "backup_verification") {
    return {
      severity: "success",
      summary: "Backup verification procedure checkpoint recorded.",
      metrics: [{ key: "backup.verification", name: "Yedek Doğrulama", value: 1, unit: "checkpoint", severity: "success" }],
      metadata: { procedure: "manual_supabase_backup_verification", destructive: false },
    };
  }

  if (jobType === "rls_control_check" || jobType === "tenant_isolation_verification") {
    const [companies, branches, auditLogs] = await Promise.all([listCompanies(), listBranches(), listAuditLogs({ limit: 100 })]);
    const unscopedAuditLogs = auditLogs.data.filter((row) => !row.company_id).length;
    return {
      severity: unscopedAuditLogs ? "warning" : "success",
      summary: `${unscopedAuditLogs} audit records without company scope detected in visible scope.`,
      metrics: [
        { key: "tenant.unscoped_audit", name: "Kapsamsız Audit", value: unscopedAuditLogs, severity: unscopedAuditLogs ? "warning" : "success" },
        { key: "tenant.visible_companies", name: "Görünen Şirket", value: companies.data.length, severity: "info" },
        { key: "tenant.visible_branches", name: "Görünen Şube", value: branches.data.length, severity: "info" },
      ],
      alert: unscopedAuditLogs ? { key: "tenant-scope-review", title: "Tenant Kapsam İncelemesi", description: "Şirket kapsamı olmayan audit kayıtları bulundu.", severity: "warning" } : undefined,
      metadata: { unscopedAuditLogs, companies: companies.data.length, branches: branches.data.length, auditError: auditLogs.error },
    };
  }

  const summary = await listPlatformOperationalSummary(scope);
  return {
    severity: summary.data.criticalAlertCount || summary.data.failedJobCount ? "warning" : "success",
    summary: "Operational observability aggregation completed.",
    metrics: [
      { key: "operations.open_alerts", name: "Açık Alarm", value: summary.data.openAlertCount, severity: summary.data.openAlertCount ? "warning" : "success" },
      { key: "operations.failed_jobs", name: "Hatalı İş", value: summary.data.failedJobCount, severity: summary.data.failedJobCount ? "warning" : "success" },
      { key: "operations.retry_count", name: "Tekrar Sayısı", value: summary.data.retryCount, severity: summary.data.retryCount ? "warning" : "success" },
    ],
    metadata: { summaryError: summary.error },
  };
}

export async function executeOperationalJob(jobType: ScheduledJobRunRecord["job_type"], scope?: EnterpriseQueryScope) {
  let executionScope: EnterpriseQueryScope & { companyId: string };
  try {
    executionScope = await requireScopedCompany(scope);
  } catch (error) {
    return failure("executeOperationalJob", error, null);
  }

  const definition = operationalJobRegistry.find((job) => job.key === jobType);
  if (!definition) return failure("executeOperationalJob", `Unknown job type ${jobType}`, null);

  const queued = await createScheduledJobRun({
    job_key: `${definition.key}-${Date.now()}`,
    job_name: definition.name,
    job_type: definition.key,
    status: "queued",
    severity: "info",
    module: definition.module,
    max_retries: definition.maxRetries,
    metadata: { description: definition.description },
  }, executionScope);
  if (queued.error || !queued.data) return queued;

  const startedAt = new Date().toISOString();
  await updateScheduledJobRun(queued.data.id, { status: "running", started_at: startedAt });

  try {
    const result = await runOperationalJobHandler(jobType, executionScope);
    const completedAt = new Date().toISOString();
    const audit = await createAuditLog({
      company_id: executionScope.companyId,
      branch_id: executionScope.branchId ?? null,
      entity_type: "scheduled_job_run",
      entity_id: queued.data.id,
      action: "scheduled_job_completed",
      description: result.summary,
      metadata: { jobType, ...result.metadata },
    });

    const event = await createPlatformEvent({
      company_id: executionScope.companyId,
      branch_id: executionScope.branchId ?? null,
      event_key: `job-${queued.data.id}-completed`,
      event_type: "scheduled_job_completed",
      severity: result.severity,
      status: "processed",
      source: "scheduled_operations_engine",
      module: definition.module,
      entity_type: "scheduled_job_run",
      entity_id: queued.data.id,
      title: definition.name,
      description: result.summary,
      metadata: { jobType, durationMs: durationMs(startedAt, completedAt), ...result.metadata },
    }, executionScope);

    await Promise.all(result.metrics.map((metric) => createPlatformMetric({
      metric_key: metric.key,
      metric_name: metric.name,
      metric_value: metric.value,
      metric_unit: metric.unit ?? null,
      severity: metric.severity ?? result.severity,
      status: "active",
      source: "scheduled_operations_engine",
      module: definition.module,
      metadata: { jobRunId: queued.data?.id, jobType },
    }, executionScope)));

    let alertId: string | null = null;
    if (result.alert) {
      const alert = await createPlatformAlert({
        alert_key: result.alert.key,
        title: result.alert.title,
        description: result.alert.description,
        severity: result.alert.severity,
        source: "scheduled_operations_engine",
        module: definition.module,
        event_id: event.data?.id ?? null,
        metadata: { jobRunId: queued.data.id, jobType },
      }, executionScope);
      alertId = alert.data?.id ?? null;
    }

    return updateScheduledJobRun(queued.data.id, {
      status: "completed",
      severity: result.severity,
      completed_at: completedAt,
      duration_ms: durationMs(startedAt, completedAt),
      audit_log_id: audit.data?.id ?? null,
      metadata: { ...queued.data.metadata, result: result.metadata, eventId: event.data?.id ?? null, alertId },
    });
  } catch (error) {
    const completedAt = new Date().toISOString();
    const retryCount = (queued.data.retry_count ?? 0) + 1;
    const canRetry = retryCount <= (queued.data.max_retries ?? definition.maxRetries);
    await createAuditLog({
      company_id: executionScope.companyId,
      branch_id: executionScope.branchId ?? null,
      entity_type: "scheduled_job_run",
      entity_id: queued.data.id,
      action: canRetry ? "scheduled_job_retry_queued" : "scheduled_job_failed",
      description: toErrorMessage(error),
      metadata: { jobType, retryCount },
    });
    if (!canRetry) {
      await createPlatformAlert({
        alert_key: `job-failed-${jobType}`,
        title: "Operasyon İşi Hatası",
        description: toErrorMessage(error),
        severity: "critical",
        source: "scheduled_operations_engine",
        module: definition.module,
        metadata: { jobRunId: queued.data.id, jobType, retryCount },
      }, executionScope);
    }
    return updateScheduledJobRun(queued.data.id, {
      status: "failed",
      severity: "critical",
      completed_at: completedAt,
      duration_ms: durationMs(startedAt, completedAt),
      retry_count: retryCount,
      next_retry_at: canRetry ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
      failure_reason: toErrorMessage(error),
    });
  }
}

export async function listAutomationRules(scope?: EnterpriseQueryScope, limit = 100): Promise<ApiResult<AutomationRuleRecord[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = supabase
    .from("automation_rules" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyEnterpriseScope(query, enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<AutomationRuleRecord[]>;
  if (error) return failure("listAutomationRules", error, []);
  return success(data ?? []);
}

export async function createAutomationRule(payload: Partial<AutomationRuleRecord> & { rule_key: string; name: string; trigger_event: string }) {
  const record = await withEnterpriseOwnership({
    rule_key: payload.rule_key,
    name: payload.name,
    description: payload.description ?? null,
    trigger_event: payload.trigger_event,
    condition: payload.condition ?? {},
    action: payload.action ?? {},
    status: payload.status ?? "active",
    severity: payload.severity ?? "info",
    source: payload.source ?? "erp",
    module: payload.module ?? "automation",
    metadata: payload.metadata ?? {},
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });

  const { data, error } = (await supabase
    .from("automation_rules" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<AutomationRuleRecord>;

  if (error) return failure("createAutomationRule", error, null);
  return success(data);
}

export async function listAutomationExecutions(scope?: EnterpriseQueryScope, limit = 100): Promise<ApiResult<AutomationExecutionRecord[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = supabase
    .from("automation_executions" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyEnterpriseScope(query, enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<AutomationExecutionRecord[]>;
  if (error) return failure("listAutomationExecutions", error, []);
  return success(data ?? []);
}

async function createAutomationExecution(payload: Partial<AutomationExecutionRecord> & { rule_key: string; trigger_event: string }, scope: EnterpriseQueryScope) {
  const record = await withEnterpriseOwnership({
    rule_id: payload.rule_id ?? null,
    rule_key: payload.rule_key,
    trigger_event: payload.trigger_event,
    status: payload.status ?? "queued",
    severity: payload.severity ?? "info",
    source: payload.source ?? "automation_engine",
    module: payload.module ?? "automation",
    started_at: payload.started_at ?? null,
    completed_at: payload.completed_at ?? null,
    duration_ms: payload.duration_ms ?? null,
    retry_count: payload.retry_count ?? 0,
    max_retries: payload.max_retries ?? 2,
    failure_reason: payload.failure_reason ?? null,
    event_id: payload.event_id ?? null,
    alert_id: payload.alert_id ?? null,
    job_run_id: payload.job_run_id ?? null,
    audit_log_id: payload.audit_log_id ?? null,
    metadata: payload.metadata ?? {},
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  }, scope);

  const { data, error } = (await supabase
    .from("automation_executions" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<AutomationExecutionRecord>;

  if (error) return failure("createAutomationExecution", error, null);
  return success(data);
}

async function updateAutomationExecution(id: string, payload: Partial<AutomationExecutionRecord>) {
  const { data, error } = (await supabase
    .from("automation_executions" as never)
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<AutomationExecutionRecord>;

  if (error) return failure("updateAutomationExecution", error, null);
  return success(data);
}

function conditionMatches(condition: Record<string, unknown>, payload: Record<string, unknown>) {
  return Object.entries(condition).every(([key, expected]) => {
    if (expected === undefined || expected === null || expected === "") return true;
    return payload[key] === expected;
  });
}

export async function triggerAutomationEvent(triggerEvent: string, payload: Record<string, unknown> = {}, scope?: EnterpriseQueryScope): Promise<ApiResult<AutomationExecutionRecord[]>> {
  let executionScope: EnterpriseQueryScope & { companyId: string };
  try {
    executionScope = await requireScopedCompany(scope);
  } catch (error) {
    return failure("triggerAutomationEvent", error, []);
  }

  const rules = await listAutomationRules(executionScope, 100);
  if (rules.error) return failure("triggerAutomationEvent", rules.error, []);

  const matchingRules = rules.data.filter((rule) => rule.status === "active" && rule.trigger_event === triggerEvent && conditionMatches(rule.condition, payload));
  const executions: AutomationExecutionRecord[] = [];

  for (const rule of matchingRules) {
    const startedAt = new Date().toISOString();
    const execution = await createAutomationExecution({
      rule_id: rule.id,
      rule_key: rule.rule_key,
      trigger_event: triggerEvent,
      status: "running",
      severity: rule.severity,
      module: rule.module,
      started_at: startedAt,
      metadata: { payload, action: rule.action },
    }, executionScope);
    if (!execution.data) continue;

    try {
      const actionType = String(rule.action.type ?? "");
      let jobRunId: string | null = null;
      let alertId: string | null = null;

      if (actionType === "run_job") {
        const jobType = rule.action.job_type as ScheduledJobRunRecord["job_type"];
        const job = await executeOperationalJob(jobType, executionScope);
        jobRunId = job.data?.id ?? null;
      } else if (actionType === "create_alert") {
        const alert = await createPlatformAlert({
          alert_key: String(rule.action.alert_key ?? rule.rule_key),
          title: String(rule.action.title ?? rule.name),
          description: String(rule.action.description ?? rule.description ?? "Automation alert."),
          severity: (rule.action.severity as PlatformAlertRecord["severity"]) ?? "warning",
          source: "automation_engine",
          module: rule.module,
          metadata: { payload, ruleKey: rule.rule_key },
        }, executionScope);
        alertId = alert.data?.id ?? null;
      } else if (actionType === "send_notification") {
        await createNotification({
          title: String(rule.action.title ?? rule.name),
          body: String(rule.action.body ?? rule.description ?? ""),
          severity: rule.severity === "critical" ? "danger" : rule.severity === "warning" ? "warning" : "info",
          category: "system",
          company_id: executionScope.companyId,
          branch_id: executionScope.branchId ?? null,
        });
      }

      const completedAt = new Date().toISOString();
      const event = await createPlatformEvent({
        company_id: executionScope.companyId,
        branch_id: executionScope.branchId ?? null,
        event_key: `automation-${execution.data.id}-completed`,
        event_type: "automation_completed",
        severity: "success",
        status: "processed",
        source: "automation_engine",
        module: rule.module,
        entity_type: "automation_execution",
        entity_id: execution.data.id,
        title: rule.name,
        description: rule.description,
        metadata: { triggerEvent, payload, action: rule.action },
      }, executionScope);
      const audit = await createAuditLog({
        company_id: executionScope.companyId,
        branch_id: executionScope.branchId ?? null,
        entity_type: "automation_execution",
        entity_id: execution.data.id,
        action: "automation_completed",
        description: rule.name,
        metadata: { triggerEvent, payload, action: rule.action },
      });

      const updated = await updateAutomationExecution(execution.data.id, {
        status: "completed",
        severity: "success",
        completed_at: completedAt,
        duration_ms: durationMs(startedAt, completedAt),
        event_id: event.data?.id ?? null,
        alert_id: alertId,
        job_run_id: jobRunId,
        audit_log_id: audit.data?.id ?? null,
      });
      if (updated.data) executions.push(updated.data);
    } catch (error) {
      const completedAt = new Date().toISOString();
      const audit = await createAuditLog({
        company_id: executionScope.companyId,
        branch_id: executionScope.branchId ?? null,
        entity_type: "automation_execution",
        entity_id: execution.data.id,
        action: "automation_failed",
        description: toErrorMessage(error),
        metadata: { triggerEvent, payload, ruleKey: rule.rule_key },
      });
      const updated = await updateAutomationExecution(execution.data.id, {
        status: "failed",
        severity: "critical",
        completed_at: completedAt,
        duration_ms: durationMs(startedAt, completedAt),
        failure_reason: toErrorMessage(error),
        retry_count: (execution.data.retry_count ?? 0) + 1,
        audit_log_id: audit.data?.id ?? null,
      });
      if (updated.data) executions.push(updated.data);
    }
  }

  return success(executions);
}

export async function listPlatformOperationalSummary(scope?: EnterpriseQueryScope): Promise<ApiResult<PlatformOperationalSummary>> {
  const [metrics, events, alerts, scheduledJobRuns, automationRules, automationExecutions] = await Promise.all([
    listPlatformMetrics(scope, 100),
    listPlatformEvents(scope, 200),
    listPlatformAlerts(scope, 100),
    listScheduledJobRuns(scope, 100),
    listAutomationRules(scope, 100),
    listAutomationExecutions(scope, 100),
  ]);

  const firstError = [metrics, events, alerts, scheduledJobRuns, automationRules, automationExecutions].find((result) => result.error);
  const completedJobs = scheduledJobRuns.data.filter((job) => job.status === "completed" || job.status === "success").length;
  const failedJobs = scheduledJobRuns.data.filter((job) => job.status === "failed").length;
  const completedAutomations = automationExecutions.data.filter((execution) => execution.status === "completed").length;
  const failedAutomations = automationExecutions.data.filter((execution) => execution.status === "failed").length;
  const summary: PlatformOperationalSummary = {
    metrics: metrics.data,
    events: events.data,
    alerts: alerts.data,
    scheduledJobRuns: scheduledJobRuns.data,
    automationRules: automationRules.data,
    automationExecutions: automationExecutions.data,
    openAlertCount: alerts.data.filter((alert) => alert.status === "open" || alert.status === "acknowledged").length,
    criticalAlertCount: alerts.data.filter((alert) => alert.severity === "critical" && alert.status !== "resolved").length,
    failedJobCount: failedJobs,
    jobSuccessRate: successRate(completedJobs, completedJobs + failedJobs),
    jobFailureRate: successRate(failedJobs, completedJobs + failedJobs),
    retryCount: scheduledJobRuns.data.reduce((total, job) => total + (job.retry_count ?? 0), 0) + automationExecutions.data.reduce((total, execution) => total + execution.retry_count, 0),
    automationSuccessRate: successRate(completedAutomations, completedAutomations + failedAutomations),
    automationFailureRate: successRate(failedAutomations, completedAutomations + failedAutomations),
  };

  if (firstError?.error) return { ...success(summary), error: firstError.error, missingTable: firstError.missingTable };
  return success(summary);
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

export async function listCompanies(): Promise<ApiResult<Company[]>> {
  const { data, error } = (await supabase
    .from("companies" as never)
    .select("*")
    .order("legal_name", { ascending: true })) as unknown as DbResult<Company[]>;

  if (error) return failure("listCompanies", error, []);
  return success(data ?? []);
}

export async function createCompany(payload: Partial<Company> & { code: string; legal_name: string }) {
  const { data, error } = (await supabase
    .from("companies" as never)
    .insert({
      code: payload.code,
      legal_name: payload.legal_name,
      trade_name: payload.trade_name ?? null,
      tax_office: payload.tax_office ?? null,
      tax_number: payload.tax_number ?? null,
      status: payload.status ?? "active",
      base_currency: payload.base_currency ?? "TRY",
      timezone: payload.timezone ?? "Europe/Istanbul",
      settings: payload.settings ?? {},
      primary_admin_email: payload.primary_admin_email ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<Company>;

  if (error) return failure("createCompany", error, null);
  await createAuditLog({ company_id: data?.id, entity_type: "company", entity_id: data?.id, action: "company_created", description: `${data?.legal_name} şirket kaydı oluşturuldu.` });
  return success(data);
}

export async function updateCompany(id: string, payload: Partial<Company>) {
  const { data, error } = (await supabase
    .from("companies" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<Company>;

  if (error) return failure("updateCompany", error, null);
  await createAuditLog({ company_id: id, entity_type: "company", entity_id: id, action: "company_updated", description: `${data?.legal_name} şirket kaydı güncellendi.` });
  return success(data);
}

export async function listBranches(companyId?: string | null): Promise<ApiResult<CompanyBranch[]>> {
  let query = supabase.from("company_branches" as never).select("*").order("name", { ascending: true });
  if (companyId) query = query.eq("company_id" as never, companyId as never);
  const { data, error } = (await query) as unknown as DbResult<CompanyBranch[]>;
  if (error) return failure("listBranches", error, []);
  return success(data ?? []);
}

export async function createBranch(payload: Partial<CompanyBranch> & { company_id: string; code: string; name: string }) {
  const { data, error } = (await supabase
    .from("company_branches" as never)
    .insert({
      company_id: payload.company_id,
      code: payload.code,
      name: payload.name,
      status: payload.status ?? "active",
      manager_email: payload.manager_email ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address_line: payload.address_line ?? null,
      city: payload.city ?? null,
      country: payload.country ?? "Turkiye",
      settings: payload.settings ?? {},
    } as never)
    .select("*")
    .single()) as unknown as DbResult<CompanyBranch>;

  if (error) return failure("createBranch", error, null);
  await createAuditLog({ company_id: data?.company_id, branch_id: data?.id, entity_type: "branch", entity_id: data?.id, action: "branch_created", description: `${data?.name} şube kaydı oluşturuldu.` });
  return success(data);
}

export async function updateBranch(id: string, payload: Partial<CompanyBranch>) {
  const { data, error } = (await supabase
    .from("company_branches" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<CompanyBranch>;

  if (error) return failure("updateBranch", error, null);
  await createAuditLog({ company_id: data?.company_id, branch_id: data?.id, entity_type: "branch", entity_id: id, action: "branch_updated", description: `${data?.name} şube kaydı güncellendi.` });
  return success(data);
}

export async function listCompanyMemberships(): Promise<ApiResult<CompanyMembership[]>> {
  const { data, error } = (await supabase
    .from("company_memberships" as never)
    .select("*")
    .order("email", { ascending: true })) as unknown as DbResult<CompanyMembership[]>;

  if (error) return failure("listCompanyMemberships", error, []);
  return success(data ?? []);
}

export async function upsertCompanyMembership(payload: Partial<CompanyMembership> & { company_id: string; email: string }) {
  const record = {
    company_id: payload.company_id,
    branch_id: payload.branch_id ?? null,
    erp_user_id: payload.erp_user_id ?? null,
    auth_user_id: payload.auth_user_id ?? null,
    email: payload.email,
    role: payload.role ?? "viewer",
    is_company_admin: payload.is_company_admin ?? false,
    is_branch_manager: payload.is_branch_manager ?? false,
    is_active: payload.is_active ?? true,
  };
  const existing = (await supabase
    .from("company_memberships" as never)
    .select("id")
    .eq("company_id" as never, record.company_id as never)
    .eq("email" as never, record.email as never)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<{ id: string }>;

  const { data, error } = existing.data
    ? ((await supabase.from("company_memberships" as never).update(record as never).eq("id", existing.data.id).select("*").single()) as unknown as DbResult<CompanyMembership>)
    : ((await supabase
      .from("company_memberships" as never)
      .insert(record as never)
    .select("*")
      .single()) as unknown as DbResult<CompanyMembership>);

  if (error) return failure("upsertCompanyMembership", error, null);
  await createAuditLog({
    company_id: data?.company_id,
    branch_id: data?.branch_id,
    entity_type: "company_membership",
    entity_id: data?.id,
    action: "membership_upserted",
    description: `${data?.email} şirket üyeliği güncellendi.`,
  });
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
      default_company_id: payload.default_company_id ?? null,
      default_branch_id: payload.default_branch_id ?? null,
      accessible_company_ids: payload.accessible_company_ids ?? [],
      accessible_branch_ids: payload.accessible_branch_ids ?? [],
      is_active: payload.is_active ?? true,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ERPUser>;

  if (error) return failure("createERPUser", error, null);
  if (data) {
    await createAuditLog({
      entity_type: "erp_user",
      entity_id: data.id,
      action: "user_created",
      description: `${data.email} ERP kullanıcısı oluşturuldu.`,
      metadata: {
        email: data.email,
        role: data.role,
        roles: data.roles ?? null,
        permissions: data.permissions ?? null,
        department: data.department ?? null,
        default_company_id: data.default_company_id ?? null,
        default_branch_id: data.default_branch_id ?? null,
      },
    });
  }
  return success(data);
}

export async function updateERPUser(id: string, payload: Partial<ERPUser>) {
  const previous = (await supabase
    .from("erp_users" as never)
    .select("id, email, role, roles, permissions, is_active, department, default_company_id, default_branch_id, accessible_company_ids, accessible_branch_ids")
    .eq("id" as never, id as never)
    .maybeSingle()) as unknown as DbResult<Partial<ERPUser>>;

  const { data, error } = (await supabase
    .from("erp_users" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ERPUser>;

  if (error) return failure("updateERPUser", error, null);
  if (data) {
    const before = previous.data ?? {};
    const changedKeys = Object.keys(payload).filter((key) => {
      const beforeValue = JSON.stringify((before as Record<string, unknown>)[key] ?? null);
      const afterValue = JSON.stringify((data as unknown as Record<string, unknown>)[key] ?? null);
      return beforeValue !== afterValue;
    });
    const action =
      changedKeys.some((key) => key === "role" || key === "roles")
        ? "role_changed"
        : changedKeys.includes("permissions")
          ? "permissions_changed"
          : changedKeys.includes("is_active")
            ? "user_status_changed"
            : "user_updated";

    await createAuditLog({
      entity_type: "erp_user",
      entity_id: data.id,
      action,
      old_status: before.is_active === undefined ? null : before.is_active ? "active" : "inactive",
      new_status: data.is_active ? "active" : "inactive",
      description: `${data.email} ERP kullanıcı kaydı güncellendi.`,
      metadata: {
        changed_keys: changedKeys,
        previous: before,
        next: {
          email: data.email,
          role: data.role,
          roles: data.roles ?? null,
          permissions: data.permissions ?? null,
          is_active: data.is_active,
          department: data.department ?? null,
          default_company_id: data.default_company_id ?? null,
          default_branch_id: data.default_branch_id ?? null,
          accessible_company_ids: data.accessible_company_ids ?? null,
          accessible_branch_ids: data.accessible_branch_ids ?? null,
        },
      },
    });
  }
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

export async function listEmployees(scope?: EnterpriseQueryScope): Promise<ApiResult<Employee[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("employees" as never)
    .select("*")
    .order("full_name", { ascending: true }), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<Employee[]>;

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

export async function listFinancialAccounts(scope?: EnterpriseQueryScope): Promise<ApiResult<FinancialAccount[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("financial_accounts" as never)
    .select("*")
    .order("name", { ascending: true }), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<FinancialAccount[]>;

  if (error) return failure("listFinancialAccounts", error, []);
  return success(data ?? []);
}

export async function createFinancialAccount(payload: Partial<FinancialAccount> & { account_type: FinancialAccount["account_type"]; name: string }) {
  const record = await withEnterpriseOwnership({
    account_type: payload.account_type,
    name: payload.name,
    currency: payload.currency ?? "TRY",
    opening_balance: payload.opening_balance ?? 0,
    current_balance: payload.current_balance ?? payload.opening_balance ?? 0,
    is_active: payload.is_active ?? true,
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });
  const { data, error } = (await supabase
    .from("financial_accounts" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<FinancialAccount>;

  if (error) return failure("createFinancialAccount", error, null);
  return success(data);
}

export async function listInvoices(scope?: EnterpriseQueryScope): Promise<ApiResult<Invoice[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("invoices" as never)
    .select("*")
    .order("invoice_date", { ascending: false }), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<Invoice[]>;

  if (error) return failure("listInvoices", error, []);
  return success(data ?? []);
}

export async function createInvoice(payload: Partial<Invoice> & { invoice_type: "sales" | "purchase" }) {
  const record = await withEnterpriseOwnership({
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
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });
  const { data, error } = (await supabase
    .from("invoices" as never)
    .insert(record as never)
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

export async function listPayments(scope?: EnterpriseQueryScope): Promise<ApiResult<Payment[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("payments" as never)
    .select("*")
    .order("payment_date", { ascending: false }), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<Payment[]>;

  if (error) return failure("listPayments", error, []);
  return success(data ?? []);
}

export async function createPayment(payload: Partial<Payment> & { payment_type: "collection" | "payment"; amount: number }) {
  const record = await withEnterpriseOwnership({
    payment_type: payload.payment_type,
    stakeholder_id: payload.stakeholder_id ?? null,
    financial_account_id: payload.financial_account_id ?? null,
    amount: payload.amount,
    currency: payload.currency ?? "TRY",
    payment_date: payload.payment_date ?? new Date().toISOString().slice(0, 10),
    description: payload.description ?? null,
    related_invoice_id: payload.related_invoice_id ?? null,
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });
  const { data, error } = (await supabase
    .from("payments" as never)
    .insert(record as never)
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

export async function listPurchaseOrders(search = "", scope?: EnterpriseQueryScope): Promise<ApiResult<PurchaseOrder[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = applyEnterpriseScope(supabase
    .from("purchase_orders" as never)
    .select("*")
    .order("created_at", { ascending: false }), enterpriseScope);

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
  const record = await withEnterpriseOwnership({
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
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });
  const { data, error } = (await supabase
    .from("purchase_orders" as never)
    .insert(record as never)
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

export async function listShopPaymentStatuses(scope?: EnterpriseQueryScope): Promise<ApiResult<ShopPaymentStatusRecord[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("shop_payment_statuses" as never)
    .select("*")
    .order("created_at", { ascending: false }), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<ShopPaymentStatusRecord[]>;

  if (error) return failure("listShopPaymentStatuses", error, []);
  return success(data ?? []);
}

export async function createShopPaymentStatus(payload: Partial<ShopPaymentStatusRecord> & { order_id: string }) {
  const record = await withEnterpriseOwnership({
    order_id: payload.order_id,
    customer_user_id: payload.customer_user_id ?? null,
    status: payload.status ?? "pending",
    lifecycle_status: payload.lifecycle_status ?? "payment_pending",
    future_provider: payload.future_provider ?? null,
    provider: payload.provider ?? null,
    transaction_reference: payload.transaction_reference ?? null,
    amount: payload.amount ?? 0,
    currency: payload.currency ?? "TRY",
    notes: payload.notes ?? null,
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });
  const { data, error } = (await supabase
    .from("shop_payment_statuses" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<ShopPaymentStatusRecord>;

  if (error) return failure("createShopPaymentStatus", error, null);
  await updateShopOrder(payload.order_id, { payment_status: payload.status ?? "pending" });
  return success(data);
}

export async function listShopCarriers(): Promise<ApiResult<ShopCarrier[]>> {
  const { data, error } = (await supabase
    .from("shop_carriers" as never)
    .select("*")
    .order("sort_order", { ascending: true })) as unknown as DbResult<ShopCarrier[]>;

  if (error) return failure("listShopCarriers", error, []);
  return success(data ?? []);
}

export async function listShopShipments(): Promise<ApiResult<ShopShipment[]>> {
  const { data, error } = (await supabase
    .from("shop_shipments" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ShopShipment[]>;

  if (error) return failure("listShopShipments", error, []);
  return success(data ?? []);
}

export async function createShopShipment(payload: Partial<ShopShipment> & { order_id: string }) {
  const { data, error } = (await supabase
    .from("shop_shipments" as never)
    .insert({
      order_id: payload.order_id,
      customer_user_id: payload.customer_user_id ?? null,
      carrier_id: payload.carrier_id ?? null,
      carrier_name: payload.carrier_name ?? null,
      tracking_number: payload.tracking_number ?? null,
      status: payload.status ?? "preparing",
      shipped_at: payload.shipped_at ?? null,
      delivered_at: payload.delivered_at ?? null,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ShopShipment>;

  if (error) return failure("createShopShipment", error, null);
  await updateShopOrder(payload.order_id, {
    carrier_name: payload.carrier_name ?? null,
    tracking_number: payload.tracking_number ?? null,
    shipping_status: payload.status ?? "preparing",
    fulfillment_status: payload.status === "delivered" ? "delivered" : payload.status === "shipped" ? "shipped" : payload.status,
  });
  return success(data);
}

export async function updateShopShipment(id: string, payload: Partial<ShopShipment>) {
  const { data, error } = (await supabase
    .from("shop_shipments" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ShopShipment>;

  if (error) return failure("updateShopShipment", error, null);
  if (data?.order_id) {
    await updateShopOrder(data.order_id, {
      carrier_name: data.carrier_name,
      tracking_number: data.tracking_number,
      shipping_status: data.status,
      fulfillment_status: data.status === "delivered" ? "delivered" : data.status === "shipped" ? "shipped" : data.status,
    });
  }
  return success(data);
}

export async function listShopFulfillmentHistory(): Promise<ApiResult<ShopFulfillmentHistory[]>> {
  const { data, error } = (await supabase
    .from("shop_fulfillment_history" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ShopFulfillmentHistory[]>;

  if (error) return failure("listShopFulfillmentHistory", error, []);
  return success(data ?? []);
}

export async function listShopCustomerNotifications(): Promise<ApiResult<ShopCustomerNotification[]>> {
  const { data, error } = (await supabase
    .from("shop_customer_notifications" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ShopCustomerNotification[]>;

  if (error) return failure("listShopCustomerNotifications", error, []);
  return success(data ?? []);
}

export async function listShopReturnRequests(): Promise<ApiResult<ShopReturnRequest[]>> {
  const { data, error } = (await supabase
    .from("shop_return_requests" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<ShopReturnRequest[]>;

  if (error) return failure("listShopReturnRequests", error, []);
  return success(data ?? []);
}

export async function updateShopReturnRequest(id: string, payload: Partial<ShopReturnRequest>) {
  const { data, error } = (await supabase
    .from("shop_return_requests" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<ShopReturnRequest>;

  if (error) return failure("updateShopReturnRequest", error, null);
  if (data?.order_id) {
    await updateShopOrder(data.order_id, {
      refund_status: data.refund_status === "refund_completed" ? "completed" : data.refund_status === "refund_rejected" ? "rejected" : data.refund_status === "refund_approved" ? "approved" : "pending",
    });
  }
  return success(data);
}

export async function listPaymentProviderEvents(scope?: EnterpriseQueryScope): Promise<ApiResult<PaymentProviderEvent[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("payment_provider_events" as never)
    .select("*")
    .order("received_at", { ascending: false })
    .limit(100), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<PaymentProviderEvent[]>;

  if (error) return failure("listPaymentProviderEvents", error, []);
  return success(data ?? []);
}

export async function listPaymentReconciliationLogs(scope?: EnterpriseQueryScope): Promise<ApiResult<PaymentReconciliationLog[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("payment_reconciliation_logs" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<PaymentReconciliationLog[]>;

  if (error) return failure("listPaymentReconciliationLogs", error, []);
  return success(data ?? []);
}

export async function listPaymentRefundOperations(scope?: EnterpriseQueryScope): Promise<ApiResult<PaymentRefundOperation[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("payment_refund_operations" as never)
    .select("*")
    .order("created_at", { ascending: false }), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<PaymentRefundOperation[]>;

  if (error) return failure("listPaymentRefundOperations", error, []);
  return success(data ?? []);
}

export async function listAccountingEntries(scope?: EnterpriseQueryScope): Promise<ApiResult<AccountingEntry[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("accounting_entries" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<AccountingEntry[]>;

  if (error) return failure("listAccountingEntries", error, []);
  return success(data ?? []);
}

export async function createPaymentRefundOperation(payload: Partial<PaymentRefundOperation> & { return_request_id: string; order_id: string }) {
  const record = await withEnterpriseOwnership({
    return_request_id: payload.return_request_id,
    order_id: payload.order_id,
    payment_status_id: payload.payment_status_id ?? null,
    provider: payload.provider ?? null,
    requested_amount: payload.requested_amount ?? 0,
    approved_amount: payload.approved_amount ?? null,
    currency: payload.currency ?? "TRY",
    status: payload.status ?? "requested",
    metadata: payload.metadata ?? {},
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });
  const { data, error } = (await supabase
    .from("payment_refund_operations" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<PaymentRefundOperation>;

  if (error) return failure("createPaymentRefundOperation", error, null);
  return success(data);
}

export async function verifyPaymentRefund(returnRequestId: string, provider: "iyzico" | "paytr" | "stripe", providerRefundId: string, amount: number) {
  const { data, error } = (await supabase.functions.invoke("payment-refund", {
    body: { returnRequestId, provider, providerRefundId, amount },
  })) as unknown as { data: { verified: boolean } | null; error: Error | null };

  if (error) return failure("verifyPaymentRefund", error, null);
  return success(data);
}

export async function listPaymentProviderHealth(): Promise<ApiResult<PaymentProviderHealth[]>> {
  const { data, error } = (await supabase
    .from("payment_provider_health" as never)
    .select("*")
    .order("provider", { ascending: true })) as unknown as DbResult<PaymentProviderHealth[]>;

  if (error) return failure("listPaymentProviderHealth", error, []);
  return success(data ?? []);
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
      error: missingTable ? null : firstError,
      missingTable,
      demoFallback: missingTable,
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
      error: missingTable ? null : stockResult.error,
      missingTable,
      demoFallback: missingTable,
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
    return { data: summary, error: missingTable ? null : stock.error, missingTable, demoFallback: missingTable };
  } catch (error) {
    return failure("getERPReportSummary", error, empty);
  }
}
