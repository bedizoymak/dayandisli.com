import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/features/shop/CartContext";
import { SHOP_FEATURE_ENABLED } from "@/features/shop/config";
import { buildErpUrl, shouldExposeErpRoutes, shouldExposePublicRoutes } from "@/lib/domains";
import { ERPErrorBoundary } from "@/components/ERPErrorBoundary";
import { ERPAuthProvider } from "@/contexts/ERPAuthContext";

import ProtectedRoute from "./components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const Hizmetler = lazy(() => import("./pages/site/Hizmetler"));
const Teknolojiler = lazy(() => import("./pages/site/Teknolojiler"));
const SiteUrunler = lazy(() => import("./pages/site/Urunler"));
const Sektorler = lazy(() => import("./pages/site/Sektorler"));
const SiteIletisim = lazy(() => import("./pages/site/Iletisim"));
const Hakkimizda = lazy(() => import("./pages/Hakkimizda"));
const Referanslar = lazy(() => import("./pages/Referanslar"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const EbruPreviewPage = lazy(() => import("./features/ebru-preview/EbruPreviewPage"));
const ShopPage = lazy(() => import("./features/shop").then((module) => ({ default: module.ShopPage })));
const ProductDetailPage = lazy(() => import("./features/shop").then((module) => ({ default: module.ProductDetailPage })));
const CartPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CartPage })));
const CheckoutPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CheckoutPage })));
const CheckoutSuccessPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CheckoutSuccessPage })));
const CustomerPortalPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CustomerPortalPage })));
const DynamicCMSPage = lazy(() => import("./features/public-cms/DynamicCMSPage"));
const SitemapPage = lazy(() => import("./features/public-cms/SitemapPage"));

const queryClient = new QueryClient();

function LegacyErpRedirect() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/erp/, "") || "/";
  return <Navigate to={`/apps${suffix}${location.search}`} replace />;
}

// Every real ERP module now lives under the canonical /apps/... hierarchy
// (see UnifiedErpShell + ERPRoutes). Any pre-migration bare path — /dashboard,
// /production, /musteriler, /finans/hareketler/:id, etc. — is redirected here
// to its /apps-prefixed equivalent, preserving the suffix, search, and hash so
// deep links and query strings keep working.
function LegacyRootToAppsRedirect() {
  const location = useLocation();
  return <Navigate to={`/apps${location.pathname}${location.search}${location.hash}`} replace />;
}

const LEGACY_PARASUT_ROUTES: Array<[RegExp, string]> = [
  [/\/satislar\/faturalar|\/sales-invoices|\/invoices/, "/apps/finance/income/invoices"],
  [/\/satislar\/musteriler|\/customers/, "/apps/finance/income/customers"],
  [/\/alislar\/faturalar|\/purchase-bills/, "/apps/finance/expense/incoming-invoices"],
  [/\/alislar\/tedarikciler|\/suppliers/, "/apps/finance/purchasing/suppliers"],
  [/\/kasa-banka|\/accounts/, "/apps/finance/cash/accounts"],
  [/\/urunler|\/products/, "/apps/finance/inventory/products"],
  [/\/stok\/hareketler/, "/apps/finance/inventory/history"],
  [/\/stok\/mevcut/, "/apps/finance/inventory/report"],
  [/\/ik\/calisanlar|\/employees/, "/apps/hr/employees"],
  [/\/ik\/maaslar|\/salaries/, "/apps/hr/salaries"],
  [/\/satislar\/teklifler/, "/apps/sales/quotes"],
  [/\/raporlar\/tahsilat|\/tahsilatlar/, "/apps/finance/income/collection-report"],
  [/\/raporlar\/gelir-gider|\/raporlar/, "/apps/finance/expense/income-expense-report"],
];

export function resolveLegacyParasutRoute(pathname: string) {
  const suffix = pathname.replace(/^\/apps\/parasut/, "") || "/";
  return LEGACY_PARASUT_ROUTES.find(([pattern]) => pattern.test(suffix))?.[1] ?? "/apps";
}

function LegacyParasutRedirect() {
  const location = useLocation();
  const target = resolveLegacyParasutRoute(location.pathname);
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

const protectedElement = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

function PublicDomainErpRedirect() {
  const location = useLocation();
  window.location.replace(buildErpUrl(`${location.pathname}${location.search}${location.hash}`));
  return null;
}

const AppRoutes = () => {
  const exposePublicRoutes = shouldExposePublicRoutes();
  const exposeErpRoutes = shouldExposeErpRoutes();

  return (
    <Routes>
      {exposePublicRoutes && (
          <>
            <Route path="/" element={<Index />} />
            <Route path="/hizmetler" element={<Hizmetler />} />
            <Route path="/teknolojiler" element={<Teknolojiler />} />
            <Route path="/urunler" element={<SiteUrunler />} />
            <Route path="/sektorler" element={<Sektorler />} />
            <Route path="/iletisim" element={<SiteIletisim />} />
            <Route path="/hakkimizda" element={<Hakkimizda />} />
            <Route path="/referanslar" element={<Referanslar />} />
            <Route path="/site-haritasi" element={<SitemapPage />} />
          </>
      )}

      <Route path="/login" element={exposeErpRoutes ? <Login /> : <PublicDomainErpRedirect />} />

      {exposePublicRoutes && SHOP_FEATURE_ENABLED ? (
          <>
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/shop/kategori/:categorySlug" element={<ShopPage />} />
            <Route path="/shop/:slug" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
            <Route path="/hesabim" element={<CustomerPortalPage />} />
          </>
      ) : exposePublicRoutes ? (
          <>
            <Route path="/shop/*" element={<NotFound />} />
            <Route path="/cart" element={<NotFound />} />
            <Route path="/checkout/*" element={<NotFound />} />
            <Route path="/hesabim" element={<NotFound />} />
          </>
      ) : null}

      {exposePublicRoutes && <Route path="/sayfa/*" element={<DynamicCMSPage />} />}

      {exposeErpRoutes ? (
          <>
            <Route path="/apps/ebru-preview/*" element={protectedElement(<Navigate to="/apps" replace />)} />
            <Route path="/apps/parasut/*" element={protectedElement(<LegacyParasutRedirect />)} />
            {/* The approved Ebru UI is the one canonical ERP shell. */}
            <Route path="/apps/*" element={protectedElement(<EbruPreviewPage />)} />
            <Route path="/teklif-sayfasi" element={protectedElement(<Navigate to="/apps" replace />)} />
            <Route path="/erp/*" element={protectedElement(<LegacyErpRedirect />)} />
            {/* Every other pre-migration ERP path redirects to its /apps/... equivalent. */}
            <Route path="/*" element={protectedElement(<LegacyRootToAppsRedirect />)} />
          </>
      ) : (
        <Route path="/*" element={<NotFound />} />
      )}
    </Routes>
  );
};

const AppContent = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <ERPAuthProvider enabled={shouldExposeErpRoutes()}>
        <ERPErrorBoundary>
          <Suspense fallback={<div className="min-h-screen bg-background p-6 text-sm text-muted-foreground">Sayfa yükleniyor...</div>}>
            <AppRoutes />
          </Suspense>
        </ERPErrorBoundary>
      </ERPAuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

const App = () => {
  const content = SHOP_FEATURE_ENABLED ? (
    <CartProvider>
      <AppContent />
    </CartProvider>
  ) : (
    <AppContent />
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{content}</LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;
