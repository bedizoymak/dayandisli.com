import { lazy, Suspense, useMemo } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ParasutLayout } from "./layout/ParasutLayout";
import { ParasutLoadingState } from "./components/ParasutStateViews";
import { MissingResourcePage } from "./pages/MissingResourcePage";
import { parasutNavigation, PARASUT_MISSING_RESOURCE_MESSAGE } from "./navigation";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SalesInvoicesPage = lazy(() => import("./pages/SalesInvoicesPage"));
const SalesInvoiceDetailPage = lazy(() => import("./pages/SalesInvoiceDetailPage"));
const PurchaseBillsPage = lazy(() => import("./pages/PurchaseBillsPage"));
const PurchaseBillDetailPage = lazy(() => import("./pages/PurchaseBillDetailPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const CustomerDetailPage = lazy(() => import("./pages/CustomerDetailPage"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage"));
const SupplierDetailPage = lazy(() => import("./pages/SupplierDetailPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const AccountDetailPage = lazy(() => import("./pages/AccountDetailPage"));
const CollectionsPage = lazy(() => import("./pages/CollectionsPage"));
const PaymentsOutPage = lazy(() => import("./pages/PaymentsOutPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SyncPage = lazy(() => import("./pages/SyncPage"));
const SyncRunDetailPage = lazy(() => import("./pages/SyncRunDetailPage"));

function findNavLabel(pathname: string): string {
  const relative = pathname.replace(/^\/apps\/parasut\/?/, "");
  for (const group of parasutNavigation) {
    if (group.route !== undefined && (relative === group.route || (group.route === "" && relative === ""))) return group.label;
    for (const item of group.items) {
      if (relative.startsWith(item.route)) return item.label;
    }
    if (group.route !== undefined && group.route !== "" && relative.startsWith(group.route)) return group.label;
  }
  return "Paraşüt";
}

function ParasutRouteShell() {
  const location = useLocation();
  const title = useMemo(() => findNavLabel(location.pathname), [location.pathname]);
  return (
    <ParasutLayout title={title}>
      <Suspense fallback={<ParasutLoadingState />}>
        <Outlet />
      </Suspense>
    </ParasutLayout>
  );
}

export function ParasutModuleRoutes() {
  return (
    <Routes>
      <Route element={<ParasutRouteShell />}>
        <Route index element={<DashboardPage />} />

        <Route path="satislar/teklifler" element={<MissingResourcePage title="Teklifler" message={PARASUT_MISSING_RESOURCE_MESSAGE} />} />
        <Route path="satislar/faturalar" element={<SalesInvoicesPage />} />
        <Route path="satislar/faturalar/:parasutId" element={<SalesInvoiceDetailPage />} />
        <Route path="satislar/musteriler" element={<CustomersPage />} />
        <Route path="satislar/musteriler/:parasutId" element={<CustomerDetailPage />} />

        <Route path="alislar/giderler" element={<MissingResourcePage title="Giderler" message={PARASUT_MISSING_RESOURCE_MESSAGE} />} />
        <Route path="alislar/faturalar" element={<PurchaseBillsPage />} />
        <Route path="alislar/faturalar/:parasutId" element={<PurchaseBillDetailPage />} />
        <Route path="alislar/tedarikciler" element={<SuppliersPage />} />
        <Route path="alislar/tedarikciler/:parasutId" element={<SupplierDetailPage />} />

        <Route path="urunler" element={<ProductsPage />} />
        <Route path="urunler/:parasutId" element={<ProductDetailPage />} />

        <Route path="kasa-banka" element={<AccountsPage />} />
        <Route path="kasa-banka/:parasutId" element={<AccountDetailPage />} />

        <Route path="tahsilatlar" element={<CollectionsPage />} />
        <Route path="odemeler" element={<PaymentsOutPage />} />

        <Route path="raporlar" element={<ReportsPage />} />
        {/* Backward-compatible redirects: these two slugs were briefly live and may be bookmarked. */}
        <Route path="raporlar/satislar" element={<Navigate to="/apps/parasut/raporlar/satis" replace />} />
        <Route path="raporlar/tahsilatlar" element={<Navigate to="/apps/parasut/raporlar/tahsilat" replace />} />
        <Route path="raporlar/:section" element={<ReportsPage />} />

        <Route path="senkronizasyon" element={<SyncPage />} />
        <Route path="senkronizasyon/:runId" element={<SyncRunDetailPage />} />

        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
    </Routes>
  );
}
