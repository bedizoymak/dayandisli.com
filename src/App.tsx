import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/features/shop/CartContext";
import { SHOP_FEATURE_ENABLED } from "@/features/shop/config";

import Index from "./pages/Index";
import Hakkimizda from "./pages/Hakkimizda";
import Urunler from "./pages/Urunler";
import Referanslar from "./pages/Referanslar";
import Iletisim from "./pages/Iletisim";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

import Apps from "./pages/Apps";
import { ERPRoutes } from "./features/erp";
import ERPHomePage from "./features/erp/dashboard/ERPHomePage";

import {
  ShopPage,
  ProductDetailPage,
  CartPage,
  CheckoutPage,
  CheckoutSuccessPage,
  ShopOrdersPage,
} from "./features/shop";

const queryClient = new QueryClient();

function LegacyCalculatorRedirect() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/apps\/calculator/, "");
  return <Navigate to={`/erp/calculator${suffix}${location.search}`} replace />;
}

const AppContent = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/hakkimizda" element={<Hakkimizda />} />
        <Route path="/urunler" element={<Urunler />} />
        <Route path="/referanslar" element={<Referanslar />} />
        <Route path="/iletisim" element={<Iletisim />} />
        <Route path="/login" element={<Login />} />

        {SHOP_FEATURE_ENABLED ? (
          <>
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/shop/:slug" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
          </>
        ) : (
          <>
            <Route path="/shop/*" element={<NotFound />} />
            <Route path="/cart" element={<NotFound />} />
            <Route path="/checkout/*" element={<NotFound />} />
          </>
        )}

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Routes>
                <Route path="apps" element={<Apps />} />
                <Route path="dashboard" element={<ERPHomePage />} />
                <Route path="apps/calculator/*" element={<LegacyCalculatorRedirect />} />
                {SHOP_FEATURE_ENABLED && <Route path="apps/shop-orders" element={<ShopOrdersPage />} />}
                <Route path="kargo" element={<Navigate to="/erp/kargo" replace />} />
                <Route path="teklif-sayfasi" element={<Navigate to="/erp/teklifler/yeni" replace />} />
                <Route path="erp/*" element={<ERPRoutes />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
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
