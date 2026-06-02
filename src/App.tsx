import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/features/shop/CartContext";
import { SHOP_FEATURE_ENABLED } from "@/features/shop/config";
import { buildErpUrl, shouldExposeErpRoutes, shouldExposePublicRoutes } from "@/lib/domains";

import Index from "./pages/Index";
import Hizmetler from "./pages/site/Hizmetler";
import Teknolojiler from "./pages/site/Teknolojiler";
import SiteUrunler from "./pages/site/Urunler";
import Sektorler from "./pages/site/Sektorler";
import SiteIletisim from "./pages/site/Iletisim";
import Hakkimizda from "./pages/Hakkimizda";
import Referanslar from "./pages/Referanslar";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

import Apps from "./pages/Apps";
import { AdminRoutes } from "./features/admin";
import ApplicationShellPage from "./features/erp/apps/ApplicationShellPage";
import { ERPRoutes } from "./features/erp";
import ERPHomePage from "./features/erp/dashboard/ERPHomePage";

import {
  ShopPage,
  ProductDetailPage,
  CartPage,
  CheckoutPage,
  CheckoutSuccessPage,
} from "./features/shop";

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
          </>
      )}

      <Route path="/login" element={exposeErpRoutes ? <Login /> : <PublicDomainErpRedirect />} />

      {exposePublicRoutes && SHOP_FEATURE_ENABLED ? (
          <>
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/shop/:slug" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
          </>
      ) : exposePublicRoutes ? (
          <>
            <Route path="/shop/*" element={<NotFound />} />
            <Route path="/cart" element={<NotFound />} />
            <Route path="/checkout/*" element={<NotFound />} />
          </>
      ) : null}

      {exposeErpRoutes ? (
          <>
            <Route path="/apps" element={protectedElement(<Apps />)} />
            <Route path="/apps/:appId" element={protectedElement(<ApplicationShellPage />)} />
            <Route path="/admin/*" element={protectedElement(<AdminRoutes />)} />
            <Route path="/dashboard" element={protectedElement(<ERPHomePage />)} />
            <Route path="/apps/calculator/*" element={protectedElement(<LegacyCalculatorRedirect />)} />
            <Route path="/apps/shop-orders" element={protectedElement(<Navigate to="/commerce/siparisler" replace />)} />
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
      <AppRoutes />
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
