import {
  ApiResult,
  DashboardMetrics,
  ERPDashboardActivity,
  ERPDatabaseStatus,
  ERPQuotation,
  FinancialAccount,
  InventoryItem,
  InventoryMovement,
  Invoice,
  Payment,
  ProductionRoute,
  ProductionRouteStep,
  SalesOrder,
  SalesOrderItem,
  Stakeholder,
  WorkOrder,
  WorkOrderOperation,
  Employee,
  Machine,
  PurchaseOrder,
  ERPAuditLog,
  ERPNotification,
} from "./types";

const now = new Date().toISOString();
const today = new Date().toISOString().slice(0, 10);

export const DEMO_FALLBACK_ACTIVE = true;

export const demoIds = {
  company: "00000000-0000-4000-8000-100000000001",
  branch: "00000000-0000-4000-8000-100000000002",
  customer: "00000000-0000-4000-8000-100000000101",
  supplier: "00000000-0000-4000-8000-100000000102",
  quotation: "00000000-0000-4000-8000-100000000201",
  salesOrder: "00000000-0000-4000-8000-100000000301",
  salesOrderItem: "00000000-0000-4000-8000-100000000302",
  machine: "00000000-0000-4000-8000-100000000401",
  route: "00000000-0000-4000-8000-100000000501",
  routeStep1: "00000000-0000-4000-8000-100000000502",
  routeStep2: "00000000-0000-4000-8000-100000000503",
  workOrder: "00000000-0000-4000-8000-100000000601",
  workOperation1: "00000000-0000-4000-8000-100000000602",
  workOperation2: "00000000-0000-4000-8000-100000000603",
  inventoryItem: "00000000-0000-4000-8000-100000000701",
  inventoryMovement: "00000000-0000-4000-8000-100000000702",
  account: "00000000-0000-4000-8000-100000000801",
  invoice: "00000000-0000-4000-8000-100000000802",
  payment: "00000000-0000-4000-8000-100000000803",
  employee: "00000000-0000-4000-8000-100000000901",
  purchaseOrder: "00000000-0000-4000-8000-100000001001",
  audit: "00000000-0000-4000-8000-100000001101",
  notification: "00000000-0000-4000-8000-100000001102",
};

export const demoStakeholders: Stakeholder[] = [
  {
    id: demoIds.customer,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    type: "customer",
    company_name: "[DEMO] Atlas Makina A.S.",
    contact_name: "Murat Yilmaz",
    phone: "+90 212 000 00 11",
    email: "demo.customer@example.invalid",
    tax_office: "Ikitelli",
    tax_number: "1111111111",
    address: "Istanbul OSB demo adresi",
    city: "Istanbul",
    country: "Turkiye",
    risk_limit: 750000,
    current_balance: 125000,
    notes: "Demo fallback musteri kaydi.",
    is_active: true,
    created_at: now,
  },
  {
    id: demoIds.supplier,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    type: "both",
    company_name: "[DEMO] Isil Fason Ltd.",
    contact_name: "Ayse Demir",
    phone: "+90 262 000 00 22",
    email: "demo.supplier@example.invalid",
    tax_office: "Gebze",
    tax_number: "2222222222",
    address: "Kocaeli demo tedarikci adresi",
    city: "Kocaeli",
    country: "Turkiye",
    risk_limit: 250000,
    current_balance: -42000,
    notes: "Demo fallback tedarikci/fason kaydi.",
    is_active: true,
    created_at: now,
  },
];

export const demoQuotations: ERPQuotation[] = [
  {
    id: demoIds.quotation,
    teklif_no: "TKL-DEMO-2026-001",
    firma: "[DEMO] Atlas Makina A.S.",
    ilgili_kisi: "Murat Yilmaz",
    tel: "+90 212 000 00 11",
    email: "demo.customer@example.invalid",
    konu: "Helis disli seti demo teklifi",
    products: [
      { kod: "DG-HL-001", cins: "Helis disli", malzeme: "C45", miktar: 2, birim: "adet", birimFiyat: 18500 },
      { kod: "DG-MIL-002", cins: "Ara mil", malzeme: "42CrMo4", miktar: 1, birim: "adet", birimFiyat: 12500 },
    ],
    subtotal: 49500,
    kdv: 9900,
    total: 59400,
    active_currency: "TRY",
    created_at: now,
  },
];

export const demoSalesOrders: SalesOrder[] = [
  {
    id: demoIds.salesOrder,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    order_no: "SO-DEMO-2026-001",
    stakeholder_id: demoIds.customer,
    source_quotation_id: demoIds.quotation,
    title: "Helis disli seti demo siparisi",
    description: "Demo fallback siparis kaydi.",
    status: "in_production",
    priority: "high",
    order_date: today,
    due_date: "2026-06-20",
    currency: "TRY",
    subtotal: 49500,
    tax_total: 9900,
    grand_total: 59400,
    notes: "Demo sunum verisi.",
    created_at: now,
  } as SalesOrder,
];

export const demoSalesOrderItems: SalesOrderItem[] = [
  {
    id: demoIds.salesOrderItem,
    sales_order_id: demoIds.salesOrder,
    item_code: "DG-HL-001",
    description: "Helis disli seti",
    quantity: 2,
    unit: "adet",
    unit_price: 18500,
    total: 37000,
    technical_drawing_id: null,
    created_at: now,
  },
];

export const demoMachines: Machine[] = [
  {
    id: demoIds.machine,
    code: "CNC-DEMO-01",
    name: "Demo CNC Azdirma",
    machine_type: "Azdirma",
    location: "Uretim Hatti 1",
    is_active: true,
    created_at: now,
  } as Machine,
];

export const demoProductionRoutes: ProductionRoute[] = [
  {
    id: demoIds.route,
    name: "Demo Helis Disli Rotasi",
    description: "Torna, azdirma ve kalite kontrol demo akisi.",
    is_template: true,
    created_at: now,
  },
];

export const demoProductionRouteSteps: ProductionRouteStep[] = [
  {
    id: demoIds.routeStep1,
    route_id: demoIds.route,
    step_no: 10,
    operation_name: "Torna hazirlik",
    machine_id: demoIds.machine,
    estimated_minutes: 90,
    notes: "Demo rota adimi.",
    created_at: now,
  },
  {
    id: demoIds.routeStep2,
    route_id: demoIds.route,
    step_no: 20,
    operation_name: "Disli azdirma",
    machine_id: demoIds.machine,
    estimated_minutes: 180,
    notes: "Demo rota adimi.",
    created_at: now,
  },
];

export const demoWorkOrders: WorkOrder[] = [
  {
    id: demoIds.workOrder,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    work_order_no: "WO-DEMO-2026-001",
    sales_order_id: demoIds.salesOrder,
    stakeholder_id: demoIds.customer,
    title: "Helis disli uretim is emri",
    part_name: "Helis disli",
    part_code: "DG-HL-001",
    quantity: 2,
    status: "in_progress",
    priority: "high",
    planned_start_date: today,
    planned_end_date: "2026-06-18",
    actual_start_at: now,
    actual_end_at: null,
    notes: "Demo fallback is emri.",
    created_at: now,
  } as WorkOrder,
];

export const demoWorkOrderOperations: WorkOrderOperation[] = [
  {
    id: demoIds.workOperation1,
    work_order_id: demoIds.workOrder,
    step_no: 10,
    operation_name: "Torna hazirlik",
    machine_id: demoIds.machine,
    assigned_employee_id: demoIds.employee,
    status: "completed",
    planned_minutes: 90,
    actual_minutes: 86,
    started_at: now,
    completed_at: now,
    quality_required: false,
    notes: "Demo tamamlanan operasyon.",
    created_at: now,
  },
  {
    id: demoIds.workOperation2,
    work_order_id: demoIds.workOrder,
    step_no: 20,
    operation_name: "Disli azdirma",
    machine_id: demoIds.machine,
    assigned_employee_id: demoIds.employee,
    status: "in_progress",
    planned_minutes: 180,
    actual_minutes: 45,
    started_at: now,
    completed_at: null,
    quality_required: true,
    notes: "Demo devam eden operasyon.",
    created_at: now,
  },
];

export const demoInventoryItems: InventoryItem[] = [
  {
    id: demoIds.inventoryItem,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    item_type: "raw_material",
    code: "C45-050-DEMO",
    name: "C45 yuvarlak celik 50mm",
    description: "Demo hammadde stogu.",
    unit: "kg",
    current_stock: 120,
    min_stock: 50,
    location: "A-01",
    supplier_id: demoIds.supplier,
    unit_cost: 42.5,
    is_active: true,
    created_at: now,
  } as InventoryItem,
];

export const demoInventoryMovements: InventoryMovement[] = [
  {
    id: demoIds.inventoryMovement,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    inventory_item_id: demoIds.inventoryItem,
    movement_type: "in",
    quantity: 120,
    source_type: "demo_seed",
    source_id: demoIds.purchaseOrder,
    movement_date: now,
    notes: "Demo stok girisi.",
    created_at: now,
  } as InventoryMovement,
];

export const demoFinancialAccounts: FinancialAccount[] = [
  {
    id: demoIds.account,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    account_type: "bank",
    name: "Demo Banka Hesabi",
    currency: "TRY",
    opening_balance: 250000,
    current_balance: 309400,
    is_active: true,
    created_at: now,
  } as FinancialAccount,
];

export const demoInvoices: Invoice[] = [
  {
    id: demoIds.invoice,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    invoice_type: "sales",
    invoice_no: "INV-DEMO-2026-001",
    stakeholder_id: demoIds.customer,
    invoice_date: today,
    due_date: "2026-06-25",
    currency: "TRY",
    subtotal: 49500,
    tax_total: 9900,
    grand_total: 59400,
    status: "issued",
    notes: "Demo satis faturasi.",
    created_at: now,
  } as Invoice,
];

export const demoPayments: Payment[] = [
  {
    id: demoIds.payment,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    payment_type: "collection",
    stakeholder_id: demoIds.customer,
    financial_account_id: demoIds.account,
    amount: 59400,
    currency: "TRY",
    payment_date: today,
    description: "Demo tahsilat kaydi.",
    related_invoice_id: demoIds.invoice,
    created_at: now,
  } as Payment,
];

export const demoEmployees: Employee[] = [
  {
    id: demoIds.employee,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    employee_no: "PRS-DEMO-001",
    full_name: "Demo Operator",
    role: "CNC Operatoru",
    department: "Uretim",
    department_id: null,
    position_id: null,
    manager_employee_id: null,
    erp_user_id: null,
    status: "active",
    phone: "+90 555 000 00 01",
    email: "operator.demo@example.invalid",
    hire_date: "2024-01-15",
    is_active: true,
    notes: "Demo personel kaydi.",
    created_at: now,
  } as Employee,
];

export const demoPurchaseOrders: PurchaseOrder[] = [
  {
    id: demoIds.purchaseOrder,
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    purchase_order_no: "PO-DEMO-2026-001",
    supplier_id: demoIds.supplier,
    title: "C45 hammadde demo satin alma",
    status: "sent",
    priority: "normal",
    order_date: today,
    expected_delivery_date: "2026-06-14",
    currency: "TRY",
    subtotal: 51000,
    tax_total: 10200,
    grand_total: 61200,
    notes: "Demo satin alma kaydi.",
    created_at: now,
  } as PurchaseOrder,
];

export const demoAuditLogs: ERPAuditLog[] = [
  {
    id: demoIds.audit,
    actor_user_id: null,
    actor_email: "demo-fallback@dayandisli.com",
    company_id: demoIds.company,
    branch_id: demoIds.branch,
    entity_type: "demo",
    entity_id: demoIds.salesOrder,
    action: "demo_fallback_enabled",
    old_status: null,
    new_status: null,
    description: "Demo fallback verisi aktif edildi.",
    metadata: { source: "local_demo_fallback" },
    created_at: now,
  } as ERPAuditLog,
];

export const demoNotifications: ERPNotification[] = [
  {
    id: demoIds.notification,
    recipient_user_id: null,
    recipient_email: null,
    title: "Demo modu hazir",
    body: "Supabase tablo eksigi varsa ekranlar yerel demo verisiyle acilir.",
    severity: "info",
    category: "system",
    entity_type: "demo",
    entity_id: null,
    action_url: "/dashboard",
    is_read: false,
    read_at: null,
    created_at: now,
  } as ERPNotification,
];

export const demoDashboardMetrics: DashboardMetrics = {
  stakeholderCount: demoStakeholders.length,
  openQuotations: demoQuotations.length,
  activeSalesOrders: demoSalesOrders.length,
  openWorkOrders: demoWorkOrders.length,
  inventoryItemCount: demoInventoryItems.length,
  purchaseOrderCount: demoPurchaseOrders.length,
  auditLogCount: demoAuditLogs.length,
  unreadNotificationCount: demoNotifications.filter((item) => !item.is_read).length,
  activeOperations: demoWorkOrderOperations.filter((item) => item.status === "in_progress").length,
  waitingSubcontracting: 0,
  lowStockItems: demoInventoryItems.filter((item) => item.current_stock <= item.min_stock).length,
  pendingQualityChecks: demoWorkOrderOperations.filter((item) => item.quality_required && item.status !== "completed").length,
  upcomingMaintenances: 0,
  todaysShipments: 0,
};

export const demoDashboardActivity: ERPDashboardActivity = {
  recentSalesOrders: demoSalesOrders,
  recentWorkOrders: demoWorkOrders,
  recentSubcontractingJobs: [],
  lowStockItems: demoInventoryItems.filter((item) => item.current_stock <= item.min_stock),
  pendingQualityReports: [],
  recentAuditLogs: demoAuditLogs,
  recentNotifications: demoNotifications,
};

export function getDemoDatabaseStatus(): ERPDatabaseStatus {
  const tables = [
    "stakeholders",
    "quotations",
    "sales_orders",
    "work_orders",
    "production_routes",
    "inventory_items",
    "financial_accounts",
    "employees",
  ].map((table) => ({
    table,
    status: "ready" as const,
    message: "Demo fallback ready",
  }));

  return {
    overall: "ready",
    label: "Demo Hazir",
    tables,
  };
}

const demoByScope: Record<string, unknown> = {
  listStakeholders: demoStakeholders,
  listERPQuotationsFromExistingTable: demoQuotations,
  listSalesOrders: demoSalesOrders,
  listSalesOrderItems: demoSalesOrderItems,
  listMachines: demoMachines,
  listProductionRoutes: demoProductionRoutes,
  listProductionRouteSteps: demoProductionRouteSteps,
  listWorkOrders: demoWorkOrders,
  listWorkOrderOperations: demoWorkOrderOperations,
  listInventoryItems: demoInventoryItems,
  listInventoryMovements: demoInventoryMovements,
  listInventoryMovementsForItem: demoInventoryMovements,
  listEmployees: demoEmployees,
  listFinancialAccounts: demoFinancialAccounts,
  listInvoices: demoInvoices,
  listPayments: demoPayments,
  listPurchaseOrders: demoPurchaseOrders,
  listRecentAuditLogs: demoAuditLogs,
  listAuditLogs: demoAuditLogs,
  listNotifications: demoNotifications,
  listUnreadNotifications: demoNotifications.filter((item) => !item.is_read),
  getERPDashboardMetrics: demoDashboardMetrics,
  getERPDashboardActivity: demoDashboardActivity,
};

export function demoFallbackForScope<T>(scope: string, fallback: T): T {
  return (scope in demoByScope ? demoByScope[scope] : fallback) as T;
}

export function demoResult<T>(scope: string, fallback: T): ApiResult<T> {
  return {
    data: demoFallbackForScope(scope, fallback),
    error: null,
    missingTable: true,
    demoFallback: true,
  };
}
