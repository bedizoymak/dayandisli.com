import { SalesInvoiceForm } from "./finance-preview/FinanceInvoicePages";
import { CustomerFormPage } from "./finance-preview/FinanceIncomePages";
import { ExpenseInvoicePage, SimpleExpenseForm } from "./finance-preview/FinanceExpensePages";
import { ChecksPage } from "./finance-preview/FinanceReportPages";
import { CheckFormPage, DispatchFormPage, OrderFormPage, ProductFormPage, SupplierFormPage } from "./finance-preview/OperationsPages";
import { CustomerFormPage as CrmCustomerFormPage } from "./crm-preview/CustomerFormPage";
import { CustomerDetailPage } from "./crm-preview/CustomerDetailPage";
import { SalesActivitiesPage, SalesOrdersPage } from "./sales-preview/SalesListPages";
import { QuoteDetailPage, QuoteFormPage, SalesOrderFormPage } from "./sales-preview/QuotePages";
import { QuotePrintPage } from "./sales-preview/pdf/QuotePrintPage";
import { ProductionReportPage } from "./reports-preview/ProductionReportPage";
import { FinanceOverview } from "./finance-preview/FinanceOverview";
import {
  CanonicalFinanceReportPage,
  CanonicalParasutListPage,
  canonicalParasutPages,
} from "./finance-preview/CanonicalParasutPages";

export default function EbruRouteContent({ routePath }: { routePath: string }) {
  if (routePath === "/apps" || routePath === "/apps/") return null;
  {
    const listConfig =
      routePath.endsWith("/finance/income/invoices") ? canonicalParasutPages.invoices
        : routePath.endsWith("/finance/income/customers") ? canonicalParasutPages.customers
        : routePath.endsWith("/finance/expense/list") ? canonicalParasutPages.expenses
        : routePath.endsWith("/finance/expense/incoming-invoices") ? canonicalParasutPages.purchaseBills
        : routePath.endsWith("/finance/purchasing/orders") ? { ...canonicalParasutPages.purchaseBills, breadcrumb: "Muhasebe ve Finans / Satın Alma / Siparişler", title: "Siparişler", subtitle: "Satın alma siparişlerini görüntüleyin ve yönetin.", actionLabel: "Elle Sipariş Gir", actionPath: "/apps/finance/purchasing/orders/new", filename: "siparisler" }
        : routePath.endsWith("/finance/purchasing/suppliers") ? canonicalParasutPages.suppliers
        : routePath.endsWith("/finance/cash/accounts") ? canonicalParasutPages.accounts
        : routePath.endsWith("/finance/inventory/products") ? canonicalParasutPages.products
        : routePath.endsWith("/finance/inventory/history") ? canonicalParasutPages.stockHistory
        : routePath.endsWith("/finance/inventory/report") ? canonicalParasutPages.inventory
        : routePath.endsWith("/finance/inventory/outgoing-dispatches") || routePath.endsWith("/finance/inventory/incoming-dispatches") ? canonicalParasutPages.shipments
        : routePath.endsWith("/sales/quotes") ? canonicalParasutPages.offers
        : routePath.endsWith("/crm/customers") ? { ...canonicalParasutPages.customers, breadcrumb: "Müşteri İlişkileri / Müşteriler", actionPath: "/apps/crm/customers/new", filename: "crm-musteriler" }
        : routePath.endsWith("/hr") || routePath.endsWith("/hr/employees") ? canonicalParasutPages.employees
        : routePath.endsWith("/hr/salaries") ? canonicalParasutPages.salaries
        : routePath.endsWith("/e-documents") || routePath.endsWith("/e-documents/invoices") ? canonicalParasutPages.eInvoices
        : null;
    if (listConfig) return <CanonicalParasutListPage config={listConfig} />;

    const reportKind =
      routePath.endsWith("/finance/income/collection-report") || routePath.endsWith("/reports/collections") ? "collections"
        : routePath.endsWith("/finance/expense/payments-report") ? "payments"
        : routePath.endsWith("/finance/expense/income-expense-report") || routePath.endsWith("/reports/income-expense") ? "incomeExpense"
        : routePath.endsWith("/finance/expense/vat-report") ? "vat"
        : routePath.endsWith("/finance/cash/cash-bank-report") || routePath.endsWith("/finance/cash/cash-flow-report") || routePath.endsWith("/reports/cash-bank") ? "cash"
        : null;
    if (reportKind) return <CanonicalFinanceReportPage kind={reportKind} />;
  }
  if (routePath.includes("/reports/")) return <ProductionReportPage />;
  if (routePath.endsWith("/sales/quotes/new") || (routePath.includes("/sales/quotes/") && routePath.endsWith("/edit"))) return <QuoteFormPage />;
  if (routePath.endsWith("/print")) return <QuotePrintPage />;
  if (routePath.includes("/sales/quotes/")) return <QuoteDetailPage />;
  if (routePath.endsWith("/sales/orders/new")) return <SalesOrderFormPage />;
  if (routePath.endsWith("/sales/orders")) return <SalesOrdersPage />;
  if (routePath.includes("/sales/")) return <SalesActivitiesPage />;
  if (routePath.endsWith("/crm/customers/new")) return <CrmCustomerFormPage />;
  if (routePath.includes("/crm/customers/") && routePath.endsWith("/edit")) return <CrmCustomerFormPage edit />;
  if (routePath.includes("/crm/customers/")) return <CustomerDetailPage />;
  if (routePath.endsWith("/finance/income/invoices/new")) return <SalesInvoiceForm />;
  if (routePath.endsWith("/finance/income/customers/new")) return <CustomerFormPage />;
  if (routePath.endsWith("/finance/expense/list/new/invoice")) return <ExpenseInvoicePage />;
  if (routePath.endsWith("/finance/expense/list/new/payroll")) return <SimpleExpenseForm type="payroll" />;
  if (routePath.endsWith("/finance/expense/list/new/tax")) return <SimpleExpenseForm type="tax" />;
  if (routePath.endsWith("/finance/expense/list/new/bank-expense")) return <SimpleExpenseForm type="bank" />;
  if (routePath.endsWith("/finance/expense/list/new/other")) return <SimpleExpenseForm type="other" />;
  if (routePath.endsWith("/finance/expense/list/new/accommodation")) return <ExpenseInvoicePage accommodation />;
  if (routePath.endsWith("/finance/inventory/products/new")) return <ProductFormPage />;
  if (routePath.endsWith("/finance/inventory/outgoing-dispatches/new")) return <DispatchFormPage type="outgoing" />;
  if (routePath.endsWith("/finance/inventory/incoming-dispatches/new")) return <DispatchFormPage type="incoming" />;
  if (routePath.endsWith("/finance/purchasing/suppliers/new")) return <SupplierFormPage />;
  if (routePath.endsWith("/finance/purchasing/orders/new")) return <OrderFormPage />;
  if (routePath.endsWith("/finance/cash/checks/new")) return <CheckFormPage />;
  if (routePath.endsWith("/finance/cash/checks")) return <ChecksPage />;
  return <FinanceOverview />;
}
