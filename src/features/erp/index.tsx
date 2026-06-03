import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ERPLayout } from "./layout/ERPLayout";

const ERPHomePage = lazy(() => import("./dashboard/ERPHomePage"));
const StakeholdersPage = lazy(() => import("./crm/StakeholdersPage"));
const CRMOperationsPage = lazy(() => import("./crm/CRMOperationsPage"));
const ERPQuotationsPage = lazy(() => import("./quotations/ERPQuotationsPage"));
const TeklifSayfasi = lazy(() => import("../quotation"));
const CalculatorRoutes = lazy(() => import("@/calculator").then((module) => ({ default: module.CalculatorRoutes })));
const Kargo = lazy(() => import("@/pages/Kargo"));
const SalesOrdersPage = lazy(() => import("./sales/SalesOrdersPage"));
const SalesActivitiesPage = lazy(() => import("./sales/SalesActivitiesPage"));
const ProductionPage = lazy(() => import("./production/ProductionPage"));
const WorkOrdersPage = lazy(() => import("./production/WorkOrdersPage"));
const RoutesPage = lazy(() => import("./production/RoutesPage"));
const SubcontractingPage = lazy(() => import("./subcontracting/SubcontractingPage"));
const InventoryPage = lazy(() => import("./inventory/InventoryPage"));
const InventoryMovementsPage = lazy(() => import("./inventory/InventoryMovementsPage"));
const InvoicesPage = lazy(() => import("./finance/InvoicesPage"));
const PaymentsPage = lazy(() => import("./finance/PaymentsPage"));
const EmployeesPage = lazy(() => import("./hr/EmployeesPage"));
const TimeEntriesPage = lazy(() => import("./hr/TimeEntriesPage"));
const ShipmentsPage = lazy(() => import("./logistics/ShipmentsPage"));
const QualityReportsPage = lazy(() => import("./quality/QualityReportsPage"));
const MaintenancePage = lazy(() => import("./maintenance/MaintenancePage"));
const DocumentsPage = lazy(() => import("./documents/DocumentsPage"));
const NotificationsPage = lazy(() => import("./notifications/NotificationsPage"));
const ReportsPage = lazy(() => import("./reports/ReportsPage"));
const ERPHealthCenterPage = lazy(() => import("./observability/ERPHealthCenterPage"));
const ERPSettingsPage = lazy(() => import("./settings/ERPSettingsPage"));
const PurchasingPage = lazy(() => import("./purchasing/PurchasingPage"));
const PurchaseOrdersPage = lazy(() => import("./purchasing/PurchaseOrdersPage"));
const PurchaseOrderDetailPage = lazy(() => import("./purchasing/PurchaseOrderDetailPage"));
const ECommercePage = lazy(() => import("./ecommerce/ECommercePage"));
const WebsiteManagementPage = lazy(() => import("./website/WebsiteManagementPage"));
const TasksPage = lazy(() => import("@/pages/erp/TasksPage"));
const NotesPage = lazy(() => import("@/pages/erp/NotesPage"));
const ErpNotFoundPage = lazy(() => import("@/pages/erp/ErpNotFoundPage"));
const CustomersPage = lazy(() => import("@/pages/erp/CustomersPage"));
const CustomerFormPage = lazy(() => import("@/pages/erp/CustomerFormPage"));
const CustomerDetailPage = lazy(() => import("@/pages/erp/CustomerDetailPage"));
const SuppliersPage = lazy(() => import("@/pages/erp/SuppliersPage"));
const SupplierFormPage = lazy(() => import("@/pages/erp/SupplierFormPage"));
const SupplierDetailPage = lazy(() => import("@/pages/erp/SupplierDetailPage"));
const FinancePage = lazy(() => import("@/pages/erp/FinancePage"));
const FinanceTransactionsPage = lazy(() => import("@/pages/erp/FinanceTransactionsPage"));
const FinanceTransactionFormPage = lazy(() => import("@/pages/erp/FinanceTransactionFormPage"));
const FinanceTransactionDetailPage = lazy(() => import("@/pages/erp/FinanceTransactionDetailPage"));
const FinancePaymentsPage = lazy(() => import("@/pages/erp/FinancePaymentsPage"));
const PaymentDocumentsPage = lazy(() => import("@/pages/erp/PaymentDocumentsPage"));
const FinanceReportsPage = lazy(() => import("@/pages/erp/FinanceReportsPage"));
const InventoryDetailPage = lazy(() => import("./details/ERPDetailPages").then((module) => ({ default: module.InventoryDetailPage })));
const QualityDetailPage = lazy(() => import("./details/ERPDetailPages").then((module) => ({ default: module.QualityDetailPage })));
const SalesOrderDetailPage = lazy(() => import("./details/ERPDetailPages").then((module) => ({ default: module.SalesOrderDetailPage })));
const ShipmentDetailPage = lazy(() => import("./details/ERPDetailPages").then((module) => ({ default: module.ShipmentDetailPage })));
const StakeholderDetailPage = lazy(() => import("./details/ERPDetailPages").then((module) => ({ default: module.StakeholderDetailPage })));
const SubcontractingDetailPage = lazy(() => import("./details/ERPDetailPages").then((module) => ({ default: module.SubcontractingDetailPage })));
const WorkOrderDetailPage = lazy(() => import("./details/ERPDetailPages").then((module) => ({ default: module.WorkOrderDetailPage })));

function RouteLoading() {
  return (
    <ERPLayout title="Yükleniyor">
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Sayfa yükleniyor...</div>
    </ERPLayout>
  );
}

export function ERPRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<ERPHomePage />} />
      <Route path="musteriler" element={<CustomersPage />} />
      <Route path="musteriler/yeni" element={<CustomerFormPage />} />
      <Route path="musteriler/:id" element={<CustomerDetailPage />} />
      <Route path="musteriler/:id/duzenle" element={<CustomerFormPage />} />
      <Route path="tedarikciler" element={<SuppliersPage />} />
      <Route path="tedarikciler/yeni" element={<SupplierFormPage />} />
      <Route path="tedarikciler/:id" element={<SupplierDetailPage />} />
      <Route path="tedarikciler/:id/duzenle" element={<SupplierFormPage />} />
      <Route path="teklifler" element={<ERPQuotationsPage />} />
      <Route path="teklifler/yeni" element={<ERPLayout title="Yeni Teklif"><TeklifSayfasi embedded /></ERPLayout>} />
      <Route path="calculator/*" element={<ERPLayout title="DAYAN Hesaplama"><CalculatorRoutes /></ERPLayout>} />
      <Route path="kargo" element={<ERPLayout title="Kargo Yönetimi"><Kargo embedded /></ERPLayout>} />
      <Route path="siparisler" element={<SalesOrdersPage />} />
      <Route path="siparisler/:id" element={<SalesOrderDetailPage />} />
      <Route path="satis-faaliyetleri" element={<SalesActivitiesPage />} />
      <Route path="finans" element={<FinancePage />} />
      <Route path="finans/hareketler" element={<FinanceTransactionsPage />} />
      <Route path="finans/hareketler/yeni" element={<FinanceTransactionFormPage />} />
      <Route path="finans/hareketler/:id" element={<FinanceTransactionDetailPage />} />
      <Route path="finans/odemeler" element={<FinancePaymentsPage />} />
      <Route path="finans/cekler" element={<PaymentDocumentsPage />} />
      <Route path="finans/raporlar" element={<FinanceReportsPage />} />
      <Route path="bildirimler" element={<NotificationsPage />} />
      <Route path="gorevler" element={<TasksPage />} />
      <Route path="notlar" element={<NotesPage />} />
      <Route path="ayarlar" element={<ERPSettingsPage />} />
      <Route path="crm" element={<CRMOperationsPage />} />
      <Route path="paydaslar" element={<StakeholdersPage />} />
      <Route path="stakeholders/:id" element={<StakeholderDetailPage />} />
      <Route path="quotations" element={<ERPQuotationsPage />} />
      <Route path="sales-orders" element={<SalesOrdersPage />} />
      <Route path="sales-orders/:id" element={<SalesOrderDetailPage />} />
      <Route path="sales-activities" element={<SalesActivitiesPage />} />
      <Route path="production" element={<ProductionPage />} />
      <Route path="work-orders" element={<WorkOrdersPage />} />
      <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
      <Route path="routes" element={<RoutesPage />} />
      <Route path="subcontracting" element={<SubcontractingPage />} />
      <Route path="subcontracting/:id" element={<SubcontractingDetailPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="inventory/:id" element={<InventoryDetailPage />} />
      <Route path="inventory-movements" element={<InventoryMovementsPage />} />
      <Route path="purchasing" element={<PurchasingPage />} />
      <Route path="commerce" element={<ECommercePage />} />
      <Route path="commerce/kategoriler" element={<ECommercePage />} />
      <Route path="commerce/siparisler" element={<ECommercePage />} />
      <Route path="commerce/musteriler" element={<ECommercePage />} />
      <Route path="commerce/kampanyalar" element={<ECommercePage />} />
      <Route path="commerce/sepetler" element={<ECommercePage />} />
      <Route path="commerce/odemeler" element={<ECommercePage />} />
      <Route path="website" element={<WebsiteManagementPage />} />
      <Route path="website/seo" element={<WebsiteManagementPage />} />
      <Route path="website/menuler" element={<WebsiteManagementPage />} />
      <Route path="website/medya" element={<WebsiteManagementPage />} />
      <Route path="website/formlar" element={<WebsiteManagementPage />} />
      <Route path="website/bannerlar" element={<WebsiteManagementPage />} />
      <Route path="website/yayin" element={<WebsiteManagementPage />} />
      <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
      <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
      <Route path="finance" element={<FinancePage />} />
      <Route path="invoices" element={<InvoicesPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="hr" element={<EmployeesPage />} />
      <Route path="hr/departmanlar" element={<EmployeesPage />} />
      <Route path="hr/pozisyonlar" element={<EmployeesPage />} />
      <Route path="hr/devam" element={<EmployeesPage />} />
      <Route path="hr/izinler" element={<EmployeesPage />} />
      <Route path="hr/ise-alim" element={<EmployeesPage />} />
      <Route path="hr/oryantasyon" element={<EmployeesPage />} />
      <Route path="time-entries" element={<TimeEntriesPage />} />
      <Route path="logistics" element={<ShipmentsPage />} />
      <Route path="shipments/:id" element={<ShipmentDetailPage />} />
      <Route path="quality" element={<QualityReportsPage />} />
      <Route path="quality/:id" element={<QualityDetailPage />} />
      <Route path="maintenance" element={<MaintenancePage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="health" element={<ERPHealthCenterPage />} />
      <Route path="settings" element={<ERPSettingsPage />} />
      <Route path="*" element={<ErpNotFoundPage />} />
    </Routes>
    </Suspense>
  );
}

export default ERPRoutes;
