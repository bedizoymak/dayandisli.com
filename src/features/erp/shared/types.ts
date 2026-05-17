export type StakeholderType = "customer" | "supplier" | "subcontractor" | "both";
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

export type InventoryItemType =
  | "raw_material"
  | "consumable"
  | "tool"
  | "measuring_tool"
  | "finished_good"
  | "semi_finished";

export interface Stakeholder {
  id: string;
  type: StakeholderType;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  risk_limit: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface SalesOrder {
  id: string;
  order_no: string;
  stakeholder_id: string | null;
  title: string;
  status: SalesOrderStatus;
  priority: "low" | "normal" | "high" | "urgent";
  due_date: string | null;
  grand_total: number;
  currency: string;
  created_at: string;
  stakeholder?: Pick<Stakeholder, "company_name"> | null;
}

export interface WorkOrder {
  id: string;
  work_order_no: string;
  stakeholder_id: string | null;
  title: string;
  part_name: string | null;
  quantity: number;
  status: WorkOrderStatus;
  planned_end_date: string | null;
  created_at: string;
  stakeholder?: Pick<Stakeholder, "company_name"> | null;
}

export interface InventoryItem {
  id: string;
  item_type: InventoryItemType;
  code: string | null;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  movement_type: "in" | "out" | "adjustment" | "reservation" | "return";
  quantity: number;
  source_type: string | null;
  movement_date: string;
  notes: string | null;
}

export interface Employee {
  id: string;
  full_name: string;
  role: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Shipment {
  id: string;
  shipment_no: string;
  status: "planned" | "packed" | "shipped" | "delivered" | "cancelled";
  carrier: string | null;
  tracking_no: string | null;
  package_count: number;
  shipment_date: string;
  created_at: string;
}

export interface QualityReport {
  id: string;
  report_no: string;
  result: "pending" | "passed" | "failed" | "conditional";
  inspection_date: string;
  created_at: string;
}

export interface MaintenanceTask {
  id: string;
  task_name: string;
  task_type: "periodic" | "breakdown" | "inspection";
  status: "planned" | "in_progress" | "completed" | "cancelled";
  planned_date: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_type: "sales" | "purchase";
  invoice_no: string | null;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  grand_total: number;
  status: "draft" | "issued" | "paid" | "partial" | "cancelled";
}

export interface Payment {
  id: string;
  payment_type: "collection" | "payment";
  amount: number;
  currency: string;
  payment_date: string;
  description: string | null;
  related_invoice_id: string | null;
}

export interface EmployeeTimeEntry {
  id: string;
  employee_id: string;
  work_date: string;
  regular_hours: number;
  overtime_hours: number;
  work_order_id: string | null;
  notes: string | null;
}

export interface ERPQuotation {
  id: string;
  teklif_no: string;
  firma: string;
  ilgili_kisi: string;
  total: number;
  active_currency: string;
  created_at: string;
}

export interface SubcontractingJob {
  id: string;
  process_type: string;
  status: "planned" | "sent" | "in_process" | "returned" | "cancelled";
  expected_return_date: string | null;
  quantity_sent: number;
  quantity_returned: number;
  created_at: string;
  supplier?: Pick<Stakeholder, "company_name"> | null;
}

export interface ProductionRoute {
  id: string;
  name: string;
  description: string | null;
  is_template: boolean;
  created_at: string;
}

export interface DashboardMetrics {
  openQuotations: number;
  activeSalesOrders: number;
  openWorkOrders: number;
  waitingSubcontracting: number;
  lowStockItems: number;
  pendingQualityChecks: number;
  upcomingMaintenances: number;
  todaysShipments: number;
}

export interface ApiResult<T> {
  data: T;
  error: string | null;
}
