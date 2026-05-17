import { Navigate, Route, Routes } from "react-router-dom";
import ERPHomePage from "./dashboard/ERPHomePage";
import StakeholdersPage from "./crm/StakeholdersPage";
import ERPQuotationsPage from "./quotations/ERPQuotationsPage";
import SalesOrdersPage from "./sales/SalesOrdersPage";
import ProductionPage from "./production/ProductionPage";
import WorkOrdersPage from "./production/WorkOrdersPage";
import RoutesPage from "./production/RoutesPage";
import SubcontractingPage from "./subcontracting/SubcontractingPage";
import InventoryPage from "./inventory/InventoryPage";
import InventoryMovementsPage from "./inventory/InventoryMovementsPage";
import FinanceDashboardPage from "./finance/FinanceDashboardPage";
import InvoicesPage from "./finance/InvoicesPage";
import PaymentsPage from "./finance/PaymentsPage";
import EmployeesPage from "./hr/EmployeesPage";
import TimeEntriesPage from "./hr/TimeEntriesPage";
import ShipmentsPage from "./logistics/ShipmentsPage";
import QualityReportsPage from "./quality/QualityReportsPage";
import MaintenancePage from "./maintenance/MaintenancePage";
import DocumentsPage from "./documents/DocumentsPage";
import ReportsPage from "./reports/ReportsPage";
import ERPSettingsPage from "./settings/ERPSettingsPage";

export function ERPRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<ERPHomePage />} />
      <Route path="crm" element={<StakeholdersPage />} />
      <Route path="quotations" element={<ERPQuotationsPage />} />
      <Route path="sales-orders" element={<SalesOrdersPage />} />
      <Route path="production" element={<ProductionPage />} />
      <Route path="work-orders" element={<WorkOrdersPage />} />
      <Route path="routes" element={<RoutesPage />} />
      <Route path="subcontracting" element={<SubcontractingPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="inventory-movements" element={<InventoryMovementsPage />} />
      <Route path="finance" element={<FinanceDashboardPage />} />
      <Route path="invoices" element={<InvoicesPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="hr" element={<EmployeesPage />} />
      <Route path="time-entries" element={<TimeEntriesPage />} />
      <Route path="logistics" element={<ShipmentsPage />} />
      <Route path="quality" element={<QualityReportsPage />} />
      <Route path="maintenance" element={<MaintenancePage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="settings" element={<ERPSettingsPage />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}

export default ERPRoutes;
