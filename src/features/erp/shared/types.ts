export type StakeholderType = "customer" | "supplier" | "subcontractor" | "both";
export type Priority = "low" | "normal" | "high" | "urgent";

export type SalesOrderStatus =
  | "new"
  | "confirmed"
  | "in_production"
  | "waiting_subcontractor"
  | "ready_to_ship"
  | "shipped"
  | "invoiced"
  | "closed"
  | "cancelled";

export type WorkOrderStatus =
  | "planned"
  | "released"
  | "in_progress"
  | "paused"
  | "waiting_subcontractor"
  | "quality_check"
  | "completed"
  | "cancelled";

export type WorkOrderOperationStatus = "pending" | "in_progress" | "paused" | "completed" | "cancelled";

export type InventoryItemType =
  | "raw_material"
  | "consumable"
  | "tool"
  | "measuring_tool"
  | "finished_good"
  | "semi_finished";

export type InventoryMovementType = "in" | "out" | "adjustment" | "reservation" | "return";
export type SubcontractingStatus = "planned" | "sent" | "in_process" | "returned" | "cancelled";
export type ShipmentStatus = "planned" | "packed" | "shipped" | "delivered" | "cancelled";
export type QualityResult = "pending" | "passed" | "failed" | "conditional";
export type MeasurementResult = "pending" | "passed" | "failed";
export type MaintenanceStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type InvoiceStatus = "draft" | "issued" | "paid" | "partial" | "cancelled";
export type PurchaseOrderStatus = "draft" | "sent" | "partially_received" | "received" | "cancelled";
export type FinancialAccountType = "cash" | "bank" | "customer" | "supplier";
export type InvoiceType = "sales" | "purchase";
export type PaymentType = "collection" | "payment";
export type ERPRole = "admin" | "planner" | "sales" | "finance" | "operator" | "purchasing" | "warehouse" | "hr" | "quality" | "viewer";
export type EmployeeStatus = "active" | "inactive" | "on_leave" | "terminated" | "candidate";
export type LeaveRequestStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";
export type RecruitmentStatus = "new" | "screening" | "interview" | "offer" | "hired" | "rejected";
export type OnboardingTaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type ERPNotificationSeverity = "info" | "success" | "warning" | "danger";
export type ERPNotificationCategory = "workflow" | "quality" | "subcontracting" | "shipment" | "inventory" | "maintenance" | "system";
export type CRMLeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
export type CRMOpportunityStatus = "open" | "proposal" | "won" | "lost" | "cancelled";
export type CRMTaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type CRMActivityType = "note" | "call" | "meeting" | "email" | "visit" | "status_change";
export type CRMRelatedType = "lead" | "opportunity" | "stakeholder" | "quotation" | "sales_order";

export interface ERPUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  role: ERPRole;
  roles?: ERPRole[] | null;
  permissions?: string[] | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Stakeholder {
  id: string;
  type: StakeholderType;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_office: string | null;
  tax_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  risk_limit: number;
  current_balance: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CRMLead {
  id: string;
  lead_no: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: CRMLeadStatus;
  priority: Priority;
  stakeholder_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CRMOpportunity {
  id: string;
  opportunity_no: string;
  title: string;
  lead_id: string | null;
  stakeholder_id: string | null;
  status: CRMOpportunityStatus;
  expected_value: number;
  probability: number;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CRMTask {
  id: string;
  title: string;
  related_type: CRMRelatedType | null;
  related_id: string | null;
  status: CRMTaskStatus;
  priority: Priority;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CRMActivity {
  id: string;
  subject: string;
  activity_type: CRMActivityType;
  related_type: CRMRelatedType | null;
  related_id: string | null;
  activity_date: string;
  notes: string | null;
  created_at: string;
}

export interface SalesOrder {
  id: string;
  order_no: string;
  stakeholder_id: string | null;
  source_quotation_id: string | null;
  title: string;
  description: string | null;
  status: SalesOrderStatus;
  priority: Priority;
  order_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  notes: string | null;
  created_at: string;
  stakeholder?: Pick<Stakeholder, "company_name"> | null;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  item_code: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  technical_drawing_id: string | null;
  created_at: string;
}

export interface Machine {
  id: string;
  code: string | null;
  name: string;
  machine_type: string | null;
  location: string | null;
  is_active: boolean;
}

export interface ProductionRoute {
  id: string;
  name: string;
  description: string | null;
  is_template: boolean;
  created_at: string;
}

export interface ProductionRouteStep {
  id: string;
  route_id: string;
  step_no: number;
  operation_name: string;
  machine_id: string | null;
  estimated_minutes: number;
  notes: string | null;
  created_at: string;
}

export interface WorkOrder {
  id: string;
  work_order_no: string;
  sales_order_id: string | null;
  stakeholder_id: string | null;
  title: string;
  part_name: string | null;
  part_code: string | null;
  quantity: number;
  status: WorkOrderStatus;
  priority: Priority;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  notes: string | null;
  created_at: string;
  stakeholder?: Pick<Stakeholder, "company_name"> | null;
}

export interface WorkOrderOperation {
  id: string;
  work_order_id: string;
  step_no: number;
  operation_name: string;
  machine_id: string | null;
  assigned_employee_id: string | null;
  status: WorkOrderOperationStatus;
  planned_minutes: number;
  actual_minutes: number;
  started_at: string | null;
  completed_at: string | null;
  quality_required: boolean;
  notes: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  item_type: InventoryItemType;
  code: string | null;
  name: string;
  description: string | null;
  unit: string;
  current_stock: number;
  min_stock: number;
  location: string | null;
  supplier_id: string | null;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  source_type: string | null;
  source_id: string | null;
  movement_date: string;
  notes: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_no?: string | null;
  full_name: string;
  role: string | null;
  department: string | null;
  department_id?: string | null;
  position_id?: string | null;
  manager_employee_id?: string | null;
  erp_user_id?: string | null;
  status?: EmployeeStatus;
  phone: string | null;
  email: string | null;
  hire_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface HRDepartment {
  id: string;
  name: string;
  code: string | null;
  manager_employee_id: string | null;
  parent_department_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface HRPosition {
  id: string;
  department_id: string | null;
  title: string;
  code: string | null;
  reports_to_position_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface EmployeeTimeEntry {
  id: string;
  employee_id: string;
  work_date: string;
  regular_hours: number;
  overtime_hours: number;
  work_order_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface HRLeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: LeaveRequestStatus;
  approver_employee_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface HRRecruitmentCandidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position_id: string | null;
  department_id: string | null;
  status: RecruitmentStatus;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface HROnboardingTask {
  id: string;
  employee_id: string | null;
  candidate_id: string | null;
  title: string;
  responsible_employee_id: string | null;
  due_date: string | null;
  status: OnboardingTaskStatus;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Shipment {
  id: string;
  shipment_no: string;
  sales_order_id: string | null;
  stakeholder_id: string | null;
  carrier: string | null;
  tracking_no: string | null;
  delivery_note_no: string | null;
  package_count: number;
  shipment_date: string;
  status: ShipmentStatus;
  notes: string | null;
  created_at: string;
}

export interface ShipmentItem {
  id: string;
  shipment_id: string;
  description: string;
  quantity: number;
  unit: string;
  notes: string | null;
  created_at: string;
}

export interface QualityReport {
  id: string;
  report_no: string;
  work_order_id: string | null;
  work_order_operation_id?: string | null;
  sales_order_id: string | null;
  inspector_employee_id: string | null;
  inspection_date: string;
  result: QualityResult;
  notes: string | null;
  created_at: string;
}

export interface QualityMeasurement {
  id: string;
  quality_report_id: string;
  characteristic: string;
  nominal_value: string | null;
  tolerance: string | null;
  measured_value: string | null;
  result: MeasurementResult;
  created_at: string;
}

export interface MaintenanceTask {
  id: string;
  machine_id: string | null;
  task_name: string;
  task_type: "periodic" | "breakdown" | "inspection";
  status: MaintenanceStatus;
  planned_date: string | null;
  completed_date: string | null;
  responsible_employee_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface FinancialAccount {
  id: string;
  account_type: FinancialAccountType;
  name: string;
  currency: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_type: InvoiceType;
  invoice_no: string | null;
  stakeholder_id: string | null;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  payment_type: PaymentType;
  stakeholder_id: string | null;
  financial_account_id: string | null;
  amount: number;
  currency: string;
  payment_date: string;
  description: string | null;
  related_invoice_id: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  purchase_order_no: string;
  supplier_id: string | null;
  title: string;
  status: PurchaseOrderStatus;
  order_date: string;
  expected_delivery_date: string | null;
  currency: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  received_quantity: number;
  created_at: string;
}

export interface DocumentMetadata {
  id: string;
  entity_type: string;
  entity_id: string | null;
  document_type: string;
  file_name: string;
  file_path: string | null;
  version_no: number;
  notes: string | null;
  created_at: string;
}

export interface ERPQuotation {
  id: string;
  teklif_no: string;
  firma: string;
  ilgili_kisi: string | null;
  tel?: string | null;
  email?: string | null;
  konu?: string | null;
  products?: string | unknown[] | null;
  subtotal?: number | null;
  kdv?: number | null;
  total: number | null;
  active_currency: string | null;
  created_at: string;
}

export interface SubcontractingJob {
  id: string;
  work_order_id: string | null;
  work_order_operation_id?: string | null;
  supplier_id: string | null;
  process_type: string;
  dispatch_no: string | null;
  sent_date: string | null;
  expected_return_date: string | null;
  returned_date: string | null;
  status: SubcontractingStatus;
  quantity_sent: number;
  quantity_returned: number;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
  supplier?: Pick<Stakeholder, "company_name"> | null;
}

export interface DashboardMetrics {
  stakeholderCount: number;
  openQuotations: number;
  activeSalesOrders: number;
  openWorkOrders: number;
  inventoryItemCount: number;
  purchaseOrderCount: number;
  auditLogCount: number;
  unreadNotificationCount: number;
  activeOperations: number;
  waitingSubcontracting: number;
  lowStockItems: number;
  pendingQualityChecks: number;
  upcomingMaintenances: number;
  todaysShipments: number;
}

export type ERPDatabaseTableStatus = "ready" | "missing" | "restricted";
export type ERPDatabaseOverallStatus = "ready" | "missing_migration" | "rls_check_required";

export interface ERPDatabaseTableCheck {
  table: string;
  status: ERPDatabaseTableStatus;
  message: string | null;
}

export interface ERPDatabaseStatus {
  overall: ERPDatabaseOverallStatus;
  label: string;
  tables: ERPDatabaseTableCheck[];
}

export interface LegacyCustomerCandidate {
  source_table: "customer_profile" | "customers_full";
  source_key: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_office: string | null;
  tax_number: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  duplicate: boolean;
  duplicate_reason: string | null;
}

export interface LegacyCustomerImportPreview {
  scanned: number;
  importable: number;
  skippedDuplicates: number;
  missingCompany: number;
  tableErrors: string[];
  sample: LegacyCustomerCandidate[];
  candidates: LegacyCustomerCandidate[];
}

export interface LegacyCustomerImportResult {
  imported: number;
  skippedDuplicates: number;
  failed: number;
  errors: string[];
}

export interface ERPQuotationConversionState {
  converted: boolean;
  salesOrder: SalesOrder | null;
  warning: string | null;
}

export interface ERPDashboardActivity {
  recentSalesOrders: SalesOrder[];
  recentWorkOrders: WorkOrder[];
  recentSubcontractingJobs: SubcontractingJob[];
  lowStockItems: InventoryItem[];
  pendingQualityReports: QualityReport[];
  recentAuditLogs?: ERPAuditLog[];
  recentNotifications?: ERPNotification[];
}

export interface ERPAuditLog {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ERPNotification {
  id: string;
  recipient_user_id: string | null;
  recipient_email: string | null;
  severity: ERPNotificationSeverity;
  category: ERPNotificationCategory;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ERPReportSummary {
  openSalesOrders: number;
  overdueSalesOrders: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
  purchaseOrders: number;
  auditLogs: number;
  financialAccounts: number;
  waitingSubcontracting: number;
  lowStockItems: number;
  inventoryMovements: number;
  pendingQualityReports: number;
  upcomingMaintenances: number;
}

export interface ApiResult<T> {
  data: T;
  error: string | null;
  missingTable?: boolean;
}
