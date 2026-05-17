import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/features/shop/CartContext";

import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

import Apps from "./pages/Apps";
import Kargo from "./pages/Kargo";
import TeklifSayfasi from "./features/quotation";
import { CalculatorRoutes } from "./calculator";
import { ERPRoutes } from "./features/erp";

import {
  ShopPage,
  ProductDetailPage,
  CartPage,
  CheckoutPage,
  CheckoutSuccessPage,
  ShopOrdersPage,
} from "./features/shop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />

              <Route path="/shop" element={<ShopPage />} />
              <Route path="/shop/:slug" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/checkout/success" element={<CheckoutSuccessPage />} />

              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Routes>
                      <Route path="apps" element={<Apps />} />
                      <Route path="apps/calculator/*" element={<CalculatorRoutes />} />
                      <Route path="apps/shop-orders" element={<ShopOrdersPage />} />
                      <Route path="kargo" element={<Kargo />} />
                      <Route path="teklif-sayfasi" element={<TeklifSayfasi />} />
                      <Route path="erp/*" element={<ERPRoutes />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
