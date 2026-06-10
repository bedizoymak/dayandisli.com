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
export type ShopOrderStatus = "pending" | "confirmed" | "shipped" | "completed" | "cancelled";
export type ShopCartStatus = "active" | "converted" | "abandoned" | "expired";
export type ShopPaymentStatus = "pending" | "authorized" | "paid" | "failed" | "refunded" | "cancelled";
export type ShopPaymentLifecycleStatus = "payment_pending" | "payment_received" | "payment_failed" | "refund_pending" | "refund_completed";
export type ShopFulfillmentStatus = "received" | "preparing" | "packed" | "shipped" | "delivered" | "completed" | "cancelled";
export type ShopRefundStatus = "none" | "pending" | "approved" | "completed" | "rejected";
export type ShopShipmentStatus = "preparing" | "packed" | "shipped" | "delivered" | "cancelled";
export type ShopReturnRequestStatus = "requested" | "erp_review" | "approved" | "rejected" | "received" | "closed";
export type ShopReturnRefundStatus = "refund_pending" | "refund_approved" | "refund_completed" | "refund_rejected";
export type ShopNotificationEventType = "order_created" | "payment_received" | "shipment_created" | "delivery_completed" | "return_requested" | "refund_completed";
export type ShopNotificationChannel = "email_event" | "erp_notification";
export type ShopNotificationStatus = "pending" | "sent" | "failed" | "read";
export type PaymentProvider = "iyzico" | "paytr" | "stripe" | "manual";
export type PaymentVerificationStatus = "pending" | "verified" | "failed" | "duplicate" | "replayed";
export type PaymentReconciliationStatus = "pending" | "matched" | "mismatch" | "duplicate" | "manual_review";
export type PaymentProviderHealthStatus = "healthy" | "degraded" | "down" | "unknown";
export type ShopCampaignDiscountType = "percentage" | "amount" | "free_shipping";
export type WebsitePageStatus = "draft" | "review" | "published" | "archived";
export type WebsitePageType = "home" | "content" | "landing" | "product" | "service" | "sector" | "contact";
export type WebsiteMenuArea = "header" | "footer" | "mobile";
export type WebsiteMediaType = "image" | "document" | "video" | "other";
export type WebsiteFormSubmissionStatus = "new" | "reviewed" | "converted" | "archived";
export type WebsiteBannerStatus = "draft" | "published" | "archived";
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
export type CompanyStatus = "active" | "passive" | "suspended";
export type BranchStatus = "active" | "passive" | "closed";
export type WarehouseStatus = "active" | "passive" | "closed";
export type WarehouseVisibilityScope = "company" | "branch" | "private";

export interface Company {
  id: string;
  code: string;
  legal_name: string;
  trade_name: string | null;
  tax_office: string | null;
  tax_number: string | null;
  status: CompanyStatus;
  base_currency: string;
  timezone: string;
  settings: Record<string, unknown>;
  primary_admin_email: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CompanyBranch {
  id: string;
  company_id: string;
  code: string;
  name: string;
  status: BranchStatus;
  manager_email: string | null;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface Warehouse {
  id: string;
  company_id: string;
  branch_id: string | null;
  code: string;
  name: string;
  status: WarehouseStatus;
  visibility_scope: WarehouseVisibilityScope;
  address_line: string | null;
  city: string | null;
  manager_email: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CompanyMembership {
  id: string;
  company_id: string;
  branch_id: string | null;
  erp_user_id: string | null;
  auth_user_id: string | null;
  email: string;
  role: ERPRole;
  is_company_admin: boolean;
  is_branch_manager: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface EnterpriseOwnership {
  company_id?: string | null;
  branch_id?: string | null;
  warehouse_id?: string | null;
}

export interface ERPUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  role: ERPRole;
  roles?: ERPRole[] | null;
  permissions?: string[] | null;
  department: string | null;
  default_company_id?: string | null;
  default_branch_id?: string | null;
  accessible_company_ids?: string[] | null;
  accessible_branch_ids?: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface Stakeholder {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
  default_warehouse_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
  warehouse_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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

export interface ShopProduct {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
  warehouse_id?: string | null;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  price: number;
  currency: string;
  in_stock: boolean;
  stock_quantity: number;
  category: string | null;
  brand: string | null;
  shop_category_id?: string | null;
  inventory_item_id?: string | null;
  is_shop_visible?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_category_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface ShopOrder {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
  order_number: string;
  status: ShopOrderStatus;
  customer_user_id?: string | null;
  customer_name: string;
  company_name: string | null;
  email: string;
  phone: string;
  address: string;
  notes: string | null;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  currency: string;
  payment_method: string;
  payment_status?: ShopPaymentStatus;
  payment_provider?: PaymentProvider | null;
  provider_payment_id?: string | null;
  provider_payment_url?: string | null;
  payment_reconciliation_status?: PaymentReconciliationStatus;
  paid_at?: string | null;
  refunded_at?: string | null;
  fulfillment_status?: ShopFulfillmentStatus;
  refund_status?: ShopRefundStatus;
  carrier_name?: string | null;
  shipping_method?: string | null;
  shipping_status?: string | null;
  tracking_number?: string | null;
  inventory_reservation_status?: string | null;
  stakeholder_id?: string | null;
  sales_order_id?: string | null;
  invoice_id?: string | null;
  payment_id?: string | null;
  campaign_id?: string | null;
  created_at: string;
}

export interface ShopOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface ShopCampaign {
  id: string;
  name: string;
  code: string | null;
  discount_type: ShopCampaignDiscountType;
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ShopCart {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  status: ShopCartStatus;
  currency: string;
  subtotal: number;
  converted_order_id: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ShopPaymentStatusRecord {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
  order_id: string;
  customer_user_id?: string | null;
  status: ShopPaymentStatus;
  lifecycle_status?: ShopPaymentLifecycleStatus;
  future_provider?: PaymentProvider | null;
  provider: string | null;
  transaction_reference: string | null;
  amount: number;
  currency: string;
  provider_event_id?: string | null;
  provider_payload?: Record<string, unknown>;
  verification_status?: PaymentVerificationStatus;
  reconciliation_status?: PaymentReconciliationStatus;
  invoice_id?: string | null;
  payment_id?: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ShopCarrier {
  id: string;
  name: string;
  code: string;
  tracking_url_template: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface ShopShipment {
  id: string;
  order_id: string;
  customer_user_id: string | null;
  carrier_id: string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  status: ShopShipmentStatus;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ShopFulfillmentHistory {
  id: string;
  order_id: string;
  customer_user_id: string | null;
  from_status: ShopFulfillmentStatus | null;
  to_status: ShopFulfillmentStatus;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ShopCustomerNotification {
  id: string;
  order_id: string | null;
  customer_user_id: string;
  event_type: ShopNotificationEventType;
  title: string;
  message: string | null;
  channel: ShopNotificationChannel;
  status: ShopNotificationStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export interface ShopReturnRequest {
  id: string;
  order_id: string;
  customer_user_id: string;
  reason: string;
  status: ShopReturnRequestStatus;
  refund_status: ShopReturnRefundStatus;
  requested_at: string;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PaymentProviderEvent {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
  provider: Exclude<PaymentProvider, "manual">;
  event_id: string;
  event_type: string;
  order_id: string | null;
  customer_user_id: string | null;
  payment_status_id: string | null;
  signature_valid: boolean;
  replay_detected: boolean;
  duplicate_detected: boolean;
  processing_status: "received" | "processed" | "ignored" | "failed";
  error_message: string | null;
  payload: Record<string, unknown>;
  payload_hash: string;
  received_at: string;
  processed_at: string | null;
}

export interface PaymentReconciliationLog {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
  order_id: string;
  invoice_id: string | null;
  payment_id: string | null;
  payment_status_id: string | null;
  provider: PaymentProvider | null;
  provider_payment_id: string | null;
  expected_amount: number;
  received_amount: number;
  currency: string;
  status: PaymentReconciliationStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AccountingEntry {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
  order_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  refund_request_id: string | null;
  entry_type: "payment_received" | "refund_approved" | "refund_completed" | "payment_failed";
  provider: PaymentProvider | null;
  external_reference: string | null;
  amount: number;
  currency: string;
  debit_account: string | null;
  credit_account: string | null;
  status: "draft" | "posted" | "reversed";
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PaymentRefundOperation {
  id: string;
  company_id?: string | null;
  branch_id?: string | null;
  return_request_id: string;
  order_id: string;
  payment_status_id: string | null;
  provider: PaymentProvider | null;
  provider_refund_id: string | null;
  requested_amount: number;
  approved_amount: number | null;
  currency: string;
  status: "requested" | "erp_review" | "provider_pending" | "provider_verified" | "completed" | "rejected" | "failed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface PaymentProviderHealth {
  id: string;
  provider: Exclude<PaymentProvider, "manual">;
  status: PaymentProviderHealthStatus;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  last_error: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
}

export type PlatformSeverity = "info" | "success" | "warning" | "critical";
export type PlatformMetricStatus = "active" | "inactive" | "resolved" | "archived";
export type PlatformEventStatus = "recorded" | "processing" | "processed" | "failed" | "ignored";
export type PlatformAlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";
export type ScheduledJobRunStatus = "queued" | "scheduled" | "running" | "completed" | "success" | "failed" | "cancelled";
export type ScheduledJobType = "reconciliation_check" | "inventory_verification" | "webhook_cleanup" | "backup_verification" | "rls_control_check" | "tenant_isolation_verification" | "observability_aggregation" | "maintenance";
export type AutomationRuleStatus = "active" | "paused" | "archived";
export type AutomationExecutionStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface PlatformMetricRecord {
  id: string;
  company_id: string;
  branch_id: string | null;
  metric_key: string;
  metric_name: string;
  metric_value: number | null;
  metric_unit: string | null;
  severity: PlatformSeverity;
  status: PlatformMetricStatus;
  source: string;
  module: string;
  measured_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PlatformEventRecord {
  id: string;
  company_id: string;
  branch_id: string | null;
  event_key: string;
  event_type: string;
  severity: PlatformSeverity;
  status: PlatformEventStatus;
  source: string;
  module: string;
  actor_email: string | null;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  description: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PlatformAlertRecord {
  id: string;
  company_id: string;
  branch_id: string | null;
  alert_key: string;
  title: string;
  description: string | null;
  severity: Exclude<PlatformSeverity, "success">;
  status: PlatformAlertStatus;
  source: string;
  module: string;
  event_id: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface ScheduledJobRunRecord {
  id: string;
  company_id: string;
  branch_id: string | null;
  job_key: string;
  job_name: string;
  job_type: ScheduledJobType;
  status: ScheduledJobRunStatus;
  severity: PlatformSeverity;
  source: string;
  module: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  queued_at?: string | null;
  retry_count?: number;
  max_retries?: number;
  next_retry_at?: string | null;
  parent_job_run_id?: string | null;
  audit_log_id?: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface AutomationRuleRecord {
  id: string;
  company_id: string;
  branch_id: string | null;
  rule_key: string;
  name: string;
  description: string | null;
  trigger_event: string;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  status: AutomationRuleStatus;
  severity: PlatformSeverity;
  source: string;
  module: string;
  last_triggered_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface AutomationExecutionRecord {
  id: string;
  company_id: string;
  branch_id: string | null;
  rule_id: string | null;
  rule_key: string;
  trigger_event: string;
  status: AutomationExecutionStatus;
  severity: PlatformSeverity;
  source: string;
  module: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  retry_count: number;
  max_retries: number;
  failure_reason: string | null;
  event_id: string | null;
  alert_id: string | null;
  job_run_id: string | null;
  audit_log_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface WebsitePage {
  id: string;
  title: string;
  slug: string;
  page_type: WebsitePageType;
  status: WebsitePageStatus;
  locale: string;
  summary: string | null;
  content: string | null;
  published_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface WebsiteSEOSetting {
  id: string;
  page_id: string | null;
  route_path: string;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  robots: string;
  og_image_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WebsiteMenuItem {
  id: string;
  label: string;
  path: string;
  menu_area: WebsiteMenuArea;
  parent_item_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WebsiteMediaAsset {
  id: string;
  file_name: string;
  file_path: string;
  media_type: WebsiteMediaType;
  alt_text: string | null;
  usage_area: string | null;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WebsiteForm {
  id: string;
  name: string;
  form_key: string;
  target_email: string | null;
  success_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WebsiteFormSubmission {
  id: string;
  form_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  company_name: string | null;
  subject: string | null;
  message: string | null;
  status: WebsiteFormSubmissionStatus;
  created_at: string;
  updated_at?: string;
}

export interface WebsiteBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_path: string | null;
  link_url: string | null;
  placement: string;
  status: WebsiteBannerStatus;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at?: string;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  company_id?: string | null;
  branch_id?: string | null;
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
  demoFallback?: boolean;
}
