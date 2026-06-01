import { Navigate, Route, Routes } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import AdminTablePage from "./AdminTablePage";
import AdminSettings from "./AdminSettings";
import AdminSqlEditor from "./AdminSqlEditor";
import { AdminFinancePage, AdminOperationsPage, AdminReportsPage } from "./AdminSummaryPages";
import { adminTableConfigs } from "./adminData";

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="urunler" element={<AdminTablePage config={adminTableConfigs.products} />} />
      <Route path="siparisler" element={<AdminTablePage config={adminTableConfigs.orders} />} />
      <Route path="teklifler" element={<AdminTablePage config={adminTableConfigs.quotations} />} />
      <Route path="medya" element={<AdminOperationsPage mode="media" />} />
      <Route path="cariler" element={<AdminOperationsPage mode="stakeholders" />} />
      <Route path="uretim" element={<AdminOperationsPage mode="production" />} />
      <Route path="stok" element={<AdminOperationsPage mode="stock" />} />
      <Route path="kalite" element={<AdminOperationsPage mode="quality" />} />
      <Route path="finans" element={<AdminFinancePage />} />
      <Route path="raporlar" element={<AdminReportsPage />} />
      <Route path="ayarlar" element={<AdminSettings />} />
      <Route path="sql-editor" element={<AdminSqlEditor />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export default AdminRoutes;
