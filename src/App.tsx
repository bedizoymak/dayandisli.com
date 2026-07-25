import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
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

const ErpLayout = lazy(() => import("./layouts/ErpLayout"));
const DashboardPage = lazy(() => import("./pages/apps/dashboard/DashboardPage"));
const FinanceOverviewPage = lazy(() => import("./pages/apps/finance/FinanceOverviewPage"));
const InvoicesPage = lazy(() => import("./pages/apps/finance/income/InvoicesPage"));
const NewInvoicePage = lazy(() => import("./pages/apps/finance/income/NewInvoicePage"));
const InvoiceDetailPage = lazy(() => import("./pages/apps/finance/income/InvoiceDetailPage"));
const EditInvoicePage = lazy(() => import("./pages/apps/finance/income/EditInvoicePage"));
const FinanceIncomeCustomersPage = lazy(() => import("./pages/apps/finance/income/CustomersPage"));
const NewFinanceCustomerPage = lazy(() => import("./pages/apps/finance/income/NewCustomerPage"));
const FinanceCustomerDetailPage = lazy(() => import("./pages/apps/finance/income/CustomerDetailPage"));
const FinanceCollectionReportPage = lazy(() => import("./pages/apps/finance/income/CollectionReportPage"));
const ExpenseListPage = lazy(() => import("./pages/apps/finance/expense/ExpenseListPage"));
const ExpenseDetailPage = lazy(() => import("./pages/apps/finance/expense/ExpenseDetailPage"));
const NewExpenseInvoicePage = lazy(() => import("./pages/apps/finance/expense/NewExpenseInvoicePage"));
const NewAccommodationExpensePage = lazy(() => import("./pages/apps/finance/expense/NewAccommodationExpensePage"));
const NewPayrollExpensePage = lazy(() => import("./pages/apps/finance/expense/NewPayrollExpensePage"));
const NewTaxExpensePage = lazy(() => import("./pages/apps/finance/expense/NewTaxExpensePage"));
const NewBankExpensePage = lazy(() => import("./pages/apps/finance/expense/NewBankExpensePage"));
const NewOtherExpensePage = lazy(() => import("./pages/apps/finance/expense/NewOtherExpensePage"));
const IncomingInvoicesPage = lazy(() => import("./pages/apps/finance/expense/IncomingInvoicesPage"));
const IncomingInvoiceDetailPage = lazy(() => import("./pages/apps/finance/expense/IncomingInvoiceDetailPage"));
const FinanceIncomeExpenseReportPage = lazy(() => import("./pages/apps/finance/expense/IncomeExpenseReportPage"));
const PaymentsReportPage = lazy(() => import("./pages/apps/finance/expense/PaymentsReportPage"));
const VatReportPage = lazy(() => import("./pages/apps/finance/expense/VatReportPage"));
const PurchasingOrdersPage = lazy(() => import("./pages/apps/finance/purchasing/OrdersPage"));
const NewPurchasingOrderPage = lazy(() => import("./pages/apps/finance/purchasing/NewOrderPage"));
const SuppliersPage = lazy(() => import("./pages/apps/finance/purchasing/SuppliersPage"));
const NewSupplierPage = lazy(() => import("./pages/apps/finance/purchasing/NewSupplierPage"));
const SupplierDetailPage = lazy(() => import("./pages/apps/finance/purchasing/SupplierDetailPage"));
const CashAccountsPage = lazy(() => import("./pages/apps/finance/cash/CashAccountsPage"));
const NewCashAccountPage = lazy(() => import("./pages/apps/finance/cash/NewCashAccountPage"));
const NewBankAccountPage = lazy(() => import("./pages/apps/finance/cash/NewBankAccountPage"));
const ChecksPage = lazy(() => import("./pages/apps/finance/cash/ChecksPage"));
const NewCheckPage = lazy(() => import("./pages/apps/finance/cash/NewCheckPage"));
const CashBankReportPage = lazy(() => import("./pages/apps/finance/cash/CashBankReportPage"));
const CashFlowReportPage = lazy(() => import("./pages/apps/finance/cash/CashFlowReportPage"));
const ProductsPage = lazy(() => import("./pages/apps/finance/inventory/ProductsPage"));
const NewProductPage = lazy(() => import("./pages/apps/finance/inventory/NewProductPage"));
const OutgoingDispatchesPage = lazy(() => import("./pages/apps/finance/inventory/OutgoingDispatchesPage"));
const NewOutgoingDispatchPage = lazy(() => import("./pages/apps/finance/inventory/NewOutgoingDispatchPage"));
const IncomingDispatchesPage = lazy(() => import("./pages/apps/finance/inventory/IncomingDispatchesPage"));
const NewIncomingDispatchPage = lazy(() => import("./pages/apps/finance/inventory/NewIncomingDispatchPage"));
const StockHistoryPage = lazy(() => import("./pages/apps/finance/inventory/StockHistoryPage"));
const StockReportPage = lazy(() => import("./pages/apps/finance/inventory/StockReportPage"));
const CrmCustomersPage = lazy(() => import("./pages/apps/crm/CustomersPage"));
const NewCrmCustomerPage = lazy(() => import("./pages/apps/crm/NewCustomerPage"));
const EditCrmCustomerPage = lazy(() => import("./pages/apps/crm/EditCustomerPage"));
const CrmCustomerDetailPage = lazy(() => import("./pages/apps/crm/CustomerDetailPage"));
const QuotesPage = lazy(() => import("./pages/apps/sales/QuotesPage"));
const NewQuotePage = lazy(() => import("./pages/apps/sales/NewQuotePage"));
const EditQuotePage = lazy(() => import("./pages/apps/sales/EditQuotePage"));
const QuoteDetailPage = lazy(() => import("./pages/apps/sales/QuoteDetailPage"));
const QuotePrintPage = lazy(() => import("./pages/apps/sales/QuotePrintPage"));
const SalesOrdersPage = lazy(() => import("./pages/apps/sales/OrdersPage"));
const NewSalesOrderPage = lazy(() => import("./pages/apps/sales/NewOrderPage"));
const SalesActivitiesPage = lazy(() => import("./pages/apps/sales/ActivitiesPage"));
const CollectionsReportPage = lazy(() => import("./pages/apps/reports/CollectionsReportPage"));
const ReportsIncomeExpensePage = lazy(() => import("./pages/apps/reports/IncomeExpenseReportPage"));
const ReportsCashBankPage = lazy(() => import("./pages/apps/reports/CashBankReportPage"));
const ReportsProductionPage = lazy(() => import("./pages/apps/reports/ProductionReportPage"));

const ShopPage = lazy(() => import("./features/shop").then((module) => ({ default: module.ShopPage })));
const ProductDetailPage = lazy(() => import("./features/shop").then((module) => ({ default: module.ProductDetailPage })));
const CartPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CartPage })));
const CheckoutPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CheckoutPage })));
const CheckoutSuccessPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CheckoutSuccessPage })));
const CustomerPortalPage = lazy(() => import("./features/shop").then((module) => ({ default: module.CustomerPortalPage })));
const DynamicCMSPage = lazy(() => import("./features/public-cms/DynamicCMSPage"));
const SitemapPage = lazy(() => import("./features/public-cms/SitemapPage"));

const queryClient = new QueryClient();

const protectedElement = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

function PublicDomainErpRedirect() {
  const location = useLocation();
  window.location.replace(buildErpUrl(`${location.pathname}${location.search}${location.hash}`));
  return null;
}

export const AppRoutes = () => {
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

      {exposeErpRoutes && (
        <Route path="/apps" element={protectedElement(<ErpLayout />)}>
          <Route index element={<DashboardPage />} />

          <Route path="finance" element={<FinanceOverviewPage />} />
          <Route path="finance/income/invoices" element={<InvoicesPage />} />
          <Route path="finance/income/invoices/new" element={<NewInvoicePage />} />
          <Route path="finance/income/invoices/:invoiceId/edit" element={<EditInvoicePage />} />
          <Route path="finance/income/invoices/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="finance/income/customers" element={<FinanceIncomeCustomersPage />} />
          <Route path="finance/income/customers/new" element={<NewFinanceCustomerPage />} />
          <Route path="finance/income/customers/:customerId" element={<FinanceCustomerDetailPage />} />
          <Route path="finance/income/collection-report" element={<FinanceCollectionReportPage />} />

          <Route path="finance/expense/list" element={<ExpenseListPage />} />
          <Route path="finance/expense/list/new/invoice" element={<NewExpenseInvoicePage />} />
          <Route path="finance/expense/list/new/payroll" element={<NewPayrollExpensePage />} />
          <Route path="finance/expense/list/new/tax" element={<NewTaxExpensePage />} />
          <Route path="finance/expense/list/new/bank-expense" element={<NewBankExpensePage />} />
          <Route path="finance/expense/list/new/other" element={<NewOtherExpensePage />} />
          <Route path="finance/expense/list/new/accommodation" element={<NewAccommodationExpensePage />} />
          <Route path="finance/expense/list/:expenseId" element={<ExpenseDetailPage />} />
          <Route path="finance/expense/incoming-invoices" element={<IncomingInvoicesPage />} />
          <Route path="finance/expense/incoming-invoices/:incomingInvoiceId" element={<IncomingInvoiceDetailPage />} />
          <Route path="finance/expense/income-expense-report" element={<FinanceIncomeExpenseReportPage />} />
          <Route path="finance/expense/payments-report" element={<PaymentsReportPage />} />
          <Route path="finance/expense/vat-report" element={<VatReportPage />} />

          <Route path="finance/purchasing/orders" element={<PurchasingOrdersPage />} />
          <Route path="finance/purchasing/orders/new" element={<NewPurchasingOrderPage />} />
          <Route path="finance/purchasing/suppliers" element={<SuppliersPage />} />
          <Route path="finance/purchasing/suppliers/new" element={<NewSupplierPage />} />
          <Route path="finance/purchasing/suppliers/:supplierId" element={<SupplierDetailPage />} />

          <Route path="finance/cash/accounts" element={<CashAccountsPage />} />
          <Route path="finance/cash/accounts/new-cash" element={<NewCashAccountPage />} />
          <Route path="finance/cash/accounts/new-bank" element={<NewBankAccountPage />} />
          <Route path="finance/cash/checks" element={<ChecksPage />} />
          <Route path="finance/cash/checks/new" element={<NewCheckPage />} />
          <Route path="finance/cash/cash-bank-report" element={<CashBankReportPage />} />
          <Route path="finance/cash/cash-flow-report" element={<CashFlowReportPage />} />

          <Route path="finance/inventory/products" element={<ProductsPage />} />
          <Route path="finance/inventory/products/new" element={<NewProductPage />} />
          <Route path="finance/inventory/outgoing-dispatches" element={<OutgoingDispatchesPage />} />
          <Route path="finance/inventory/outgoing-dispatches/new" element={<NewOutgoingDispatchPage />} />
          <Route path="finance/inventory/incoming-dispatches" element={<IncomingDispatchesPage />} />
          <Route path="finance/inventory/incoming-dispatches/new" element={<NewIncomingDispatchPage />} />
          <Route path="finance/inventory/history" element={<StockHistoryPage />} />
          <Route path="finance/inventory/report" element={<StockReportPage />} />

          <Route path="crm/customers" element={<CrmCustomersPage />} />
          <Route path="crm/customers/new" element={<NewCrmCustomerPage />} />
          <Route path="crm/customers/:customerId/edit" element={<EditCrmCustomerPage />} />
          <Route path="crm/customers/:customerId" element={<CrmCustomerDetailPage />} />

          <Route path="sales/quotes" element={<QuotesPage />} />
          <Route path="sales/quotes/new" element={<NewQuotePage />} />
          <Route path="sales/quotes/:quoteId/edit" element={<EditQuotePage />} />
          <Route path="sales/quotes/:quoteId/print" element={<QuotePrintPage />} />
          <Route path="sales/quotes/:quoteId" element={<QuoteDetailPage />} />
          <Route path="sales/orders" element={<SalesOrdersPage />} />
          <Route path="sales/orders/new" element={<NewSalesOrderPage />} />
          <Route path="sales/activities" element={<SalesActivitiesPage />} />

          <Route path="reports/collections" element={<CollectionsReportPage />} />
          <Route path="reports/income-expense" element={<ReportsIncomeExpensePage />} />
          <Route path="reports/cash-bank" element={<ReportsCashBankPage />} />
          <Route path="reports/production" element={<ReportsProductionPage />} />
        </Route>
      )}

      <Route path="/*" element={<NotFound />} />
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
