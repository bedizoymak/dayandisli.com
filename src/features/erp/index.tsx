import { Navigate, Route, Routes } from "react-router-dom";
import ERPHomePage from "./dashboard/ERPHomePage";
import StakeholdersPage from "./crm/StakeholdersPage";
import ERPQuotationsPage from "./quotations/ERPQuotationsPage";
import TeklifSayfasi from "../quotation";
import { CalculatorRoutes } from "@/calculator";
import Kargo from "@/pages/Kargo";
import SalesOrdersPage from "./sales/SalesOrdersPage";
import ProductionPage from "./production/ProductionPage";
import WorkOrdersPage from "./production/WorkOrdersPage";
import RoutesPage from "./production/RoutesPage";
import SubcontractingPage from "./subcontracting/SubcontractingPage";
import InventoryPage from "./inventory/InventoryPage";
import InventoryMovementsPage from "./inventory/InventoryMovementsPage";
import InvoicesPage from "./finance/InvoicesPage";
import PaymentsPage from "./finance/PaymentsPage";
import EmployeesPage from "./hr/EmployeesPage";
import TimeEntriesPage from "./hr/TimeEntriesPage";
import ShipmentsPage from "./logistics/ShipmentsPage";
import QualityReportsPage from "./quality/QualityReportsPage";
import MaintenancePage from "./maintenance/MaintenancePage";
import DocumentsPage from "./documents/DocumentsPage";
import NotificationsPage from "./notifications/NotificationsPage";
import ReportsPage from "./reports/ReportsPage";
import ERPSettingsPage from "./settings/ERPSettingsPage";
import PurchasingPage from "./purchasing/PurchasingPage";
import PurchaseOrdersPage from "./purchasing/PurchaseOrdersPage";
import PurchaseOrderDetailPage from "./purchasing/PurchaseOrderDetailPage";
import TasksPage from "@/pages/erp/TasksPage";
import NotesPage from "@/pages/erp/NotesPage";
import ErpNotFoundPage from "@/pages/erp/ErpNotFoundPage";
import CustomersPage from "@/pages/erp/CustomersPage";
import CustomerFormPage from "@/pages/erp/CustomerFormPage";
import CustomerDetailPage from "@/pages/erp/CustomerDetailPage";
import SuppliersPage from "@/pages/erp/SuppliersPage";
import SupplierFormPage from "@/pages/erp/SupplierFormPage";
import SupplierDetailPage from "@/pages/erp/SupplierDetailPage";
import FinancePage from "@/pages/erp/FinancePage";
import FinanceTransactionsPage from "@/pages/erp/FinanceTransactionsPage";
import FinanceTransactionFormPage from "@/pages/erp/FinanceTransactionFormPage";
import FinanceTransactionDetailPage from "@/pages/erp/FinanceTransactionDetailPage";
import FinancePaymentsPage from "@/pages/erp/FinancePaymentsPage";
import PaymentDocumentsPage from "@/pages/erp/PaymentDocumentsPage";
import FinanceReportsPage from "@/pages/erp/FinanceReportsPage";
import { ERPLayout } from "./layout/ERPLayout";
import {
  InventoryDetailPage,
  QualityDetailPage,
  SalesOrderDetailPage,
  ShipmentDetailPage,
  StakeholderDetailPage,
  SubcontractingDetailPage,
  WorkOrderDetailPage,
} from "./details/ERPDetailPages";

export function ERPRoutes() {
  return (
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
      <Route path="crm" element={<StakeholdersPage />} />
      <Route path="stakeholders/:id" element={<StakeholderDetailPage />} />
      <Route path="quotations" element={<ERPQuotationsPage />} />
      <Route path="sales-orders" element={<SalesOrdersPage />} />
      <Route path="sales-orders/:id" element={<SalesOrderDetailPage />} />
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
      <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
      <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
      <Route path="finance" element={<FinancePage />} />
      <Route path="invoices" element={<InvoicesPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="hr" element={<EmployeesPage />} />
      <Route path="time-entries" element={<TimeEntriesPage />} />
      <Route path="logistics" element={<ShipmentsPage />} />
      <Route path="shipments/:id" element={<ShipmentDetailPage />} />
      <Route path="quality" element={<QualityReportsPage />} />
      <Route path="quality/:id" element={<QualityDetailPage />} />
      <Route path="maintenance" element={<MaintenancePage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="settings" element={<ERPSettingsPage />} />
      <Route path="*" element={<ErpNotFoundPage />} />
    </Routes>
  );
}

export default ERPRoutes;
