import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shellSource = readFileSync("src/features/ebru-preview/EbruPreviewPage.tsx", "utf8");
const routeSource = readFileSync("src/features/ebru-preview/EbruRouteContent.tsx", "utf8");
const incomeSource = readFileSync("src/features/ebru-preview/finance-preview/FinanceIncomePages.tsx", "utf8");
const operationsSource = readFileSync("src/features/ebru-preview/finance-preview/OperationsPages.tsx", "utf8");
const crmSource = readFileSync("src/features/ebru-preview/crm-preview/CustomerListPage.tsx", "utf8");
const salesSource = readFileSync("src/features/ebru-preview/sales-preview/SalesListPages.tsx", "utf8");
const reportsSource = readFileSync("src/features/ebru-preview/finance-preview/FinanceReportPages.tsx", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");

describe("canonical Ebru visual architecture", () => {
  it("keeps canonical routes inside the approved single Ebru shell", () => {
    expect(appSource).toContain('path="/apps/*"');
    expect(appSource).toContain("<EbruPreviewPage />");
    expect(shellSource).toContain('className="ebru-sidebar"');
    expect(shellSource).toContain('className="ebru-topbar"');
    expect(shellSource).toContain('className="ebru-footer"');
  });

  it("keeps every demo presentation family in canonical routing", () => {
    expect(incomeSource).toContain('className="income-page-head"');
    expect(incomeSource).toContain('className="ebru-card income-filters"');
    expect(incomeSource).toContain('className="ebru-card income-table-card"');
    expect(incomeSource).toContain('className="income-pagination"');
    expect(operationsSource).toContain('className="ops-page"');
    expect(crmSource).toContain('className="crm-page"');
    expect(salesSource).toContain('className="sales-page"');
    expect(reportsSource).toContain('className="report-page"');
  });

  it("routes demo-backed pages to exact presentation modules instead of the generic adapter", () => {
    expect(routeSource).toContain("<InvoiceListPage />");
    expect(routeSource).toContain("<ExpenseListPage />");
    expect(routeSource).toContain("<ProductsPage />");
    expect(routeSource).toContain("<CrmCustomerListPage />");
    expect(routeSource).toContain("<QuotesPage />");
    expect(routeSource).not.toContain("canonicalParasutPages.invoices");
    expect(routeSource).not.toContain("canonicalParasutPages.customers");
  });

  it("does not mount obsolete standalone or primitive resource shells", () => {
    expect(shellSource).not.toContain("DomainResourcePage");
    expect(appSource).not.toContain("<ParasutModuleRoutes");
    expect(appSource).toContain('path="/apps/ebru-preview/*"');
    expect(appSource).toContain('path="/apps/parasut/*"');
  });

  it("does not import historical demo datasets into production pages", () => {
    for (const forbidden of ["financeIncomeData", "financeExpenseData", "cashReportData", "demoFallback"]) {
      expect(shellSource).not.toContain(forbidden);
      expect(routeSource).not.toContain(forbidden);
    }
  });
});
