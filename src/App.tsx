import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/features/shop/CartContext";
import { SHOP_FEATURE_ENABLED } from "@/features/shop/config";
import { buildErpUrl, shouldExposeErpRoutes, shouldExposePublicRoutes } from "@/lib/domains";
import { ERPErrorBoundary } from "@/components/ERPErrorBoundary";
import { ERPAuthProvider } from "@/contexts/ERPAuthContext";
import { getErpApplication } from "@/features/erp/apps/applicationRegistry";

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
const AdminRoutes = lazy(() => import("./features/admin").then((module) => ({ default: module.AdminRoutes })));
const ParasutModuleRoutes = lazy(() => import("./features/erp/parasut").then((module) => ({ default: module.ParasutModuleRoutes })));
const ERPRoutes = lazy(() => import("./features/erp").then((module) => ({ default: module.ERPRoutes })));
const ERPHomePage = lazy(() => import("./features/erp/dashboard/ERPHomePage"));
const ShopPage = lazy(() => import("./features/shop").then((module) => ({ default: module.ShopPage })));
const ProductDetailPage = lazy(() => import("./features/shop").then((module) => ({ default: module.ProductDetailPage })));
const CartPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CartPage })));
const CheckoutPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CheckoutPage })));
const CheckoutSuccessPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CheckoutSuccessPage })));
const CustomerPortalPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CustomerPortalPage })));
const DynamicCMSPage = lazy(() => import("./features/public-cms/DynamicCMSPage"));
const SitemapPage = lazy(() => import("./features/public-cms/SitemapPage"));

const queryClient = new QueryClient();
const isErpBuild = (import.meta.env.VITE_APP_TARGET || "erp") === "erp";

function LegacyCalculatorRedirect() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/(?:erp\/)?apps\/calculator/, "");
  const targetBase = isErpBuild ? "/calculator" : "/erp/calculator";
  return <Navigate to={`${targetBase}${suffix}${location.search}`} replace />;
}

function LegacyErpRedirect() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/erp/, "") || "/";
  return <Navigate to={`${suffix}${location.search}`} replace />;
}

// The old /apps/:appId application-launcher card grid has been retired in favor of
// the unified ERP shell (ERPLayout + ERPSidebar). This keeps every legacy
// /apps/<id> deep link working by sending it straight to that module's first
// real page instead of an intermediate card screen.
function LegacyAppShellRedirect() {
  const { appId } = useParams();
  const app = getErpApplication(appId);
  const target = app?.modules[0]?.route ?? "/dashboard";
  return <Navigate to={target} replace />;
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
            <Route path="/apps" element={protectedElement(<Navigate to="/dashboard" replace />)} />
            <Route path="/apps/ebru-preview/*" element={protectedElement(<EbruPreviewPage />)} />
            <Route path="/apps/calculator/*" element={protectedElement(<LegacyCalculatorRedirect />)} />
            <Route path="/apps/shop-orders" element={protectedElement(<Navigate to="/commerce/siparisler" replace />)} />
            <Route path="/apps/parasut/*" element={protectedElement(<ParasutModuleRoutes />)} />
            <Route path="/apps/:appId" element={protectedElement(<LegacyAppShellRedirect />)} />
            <Route path="/admin/*" element={protectedElement(<AdminRoutes />)} />
            <Route path="/dashboard" element={protectedElement(<ERPHomePage />)} />
            <Route path="/teklif-sayfasi" element={protectedElement(<Navigate to="/teklifler/yeni" replace />)} />
            <Route path="/erp/*" element={protectedElement(<LegacyErpRedirect />)} />
            <Route path="/*" element={protectedElement(<ERPRoutes />)} />
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
