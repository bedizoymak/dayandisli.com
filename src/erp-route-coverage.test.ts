import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeMap = readFileSync("docs/ERP_FRONTEND_ROUTE_MAP.md", "utf8");
const routeContent = readFileSync("src/features/ebru-preview/EbruRouteContent.tsx", "utf8");
const livePresentation = readFileSync(
  "src/features/ebru-preview/finance-preview/CanonicalParasutPages.tsx",
  "utf8",
);

const mappedRoutes = [
  "/apps",
  "/apps/finance",
  "/apps/finance/income/invoices",
  "/apps/finance/income/invoices/new",
  "/apps/finance/income/customers",
  "/apps/finance/income/customers/new",
  "/apps/finance/income/collection-report",
  "/apps/finance/expense/list",
  "/apps/finance/expense/list/new/invoice",
  "/apps/finance/expense/list/new/payroll",
  "/apps/finance/expense/list/new/tax",
  "/apps/finance/expense/list/new/bank-expense",
  "/apps/finance/expense/list/new/other",
  "/apps/finance/expense/list/new/accommodation",
  "/apps/finance/expense/incoming-invoices",
  "/apps/finance/expense/income-expense-report",
  "/apps/finance/expense/payments-report",
  "/apps/finance/expense/vat-report",
  "/apps/finance/inventory/products",
  "/apps/finance/inventory/products/new",
  "/apps/finance/inventory/outgoing-dispatches",
  "/apps/finance/inventory/outgoing-dispatches/new",
  "/apps/finance/inventory/incoming-dispatches",
  "/apps/finance/inventory/incoming-dispatches/new",
  "/apps/finance/inventory/history",
  "/apps/finance/inventory/report",
  "/apps/finance/purchasing/suppliers",
  "/apps/finance/purchasing/suppliers/new",
  "/apps/finance/purchasing/orders",
  "/apps/finance/purchasing/orders/new",
  "/apps/finance/cash/accounts",
  "/apps/finance/cash/checks",
  "/apps/finance/cash/checks/new",
  "/apps/finance/cash/cash-bank-report",
  "/apps/finance/cash/cash-flow-report",
  "/apps/crm/customers",
  "/apps/crm/customers/new",
  "/apps/crm/customers/:id",
  "/apps/crm/customers/:id/edit",
  "/apps/sales/quotes",
  "/apps/sales/quotes/new",
  "/apps/sales/quotes/:id",
  "/apps/sales/quotes/:id/edit",
  "/apps/sales/quotes/:id/print",
  "/apps/sales/orders",
  "/apps/sales/orders/new",
  "/apps/sales/activities",
  "/apps/reports/collections",
  "/apps/reports/income-expense",
  "/apps/reports/cash-bank",
  "/apps/reports/production",
];

describe("canonical ERP route coverage", () => {
  it.each(mappedRoutes)("classifies %s in the route map", (route) => {
    expect(routeMap).toContain(`\`${route}\``);
  });

  it("keeps dispatch list matching exact so new forms remain reachable", () => {
    expect(routeContent).toContain('routePath.endsWith("/finance/inventory/outgoing-dispatches")');
    expect(routeContent).toContain('routePath.endsWith("/finance/inventory/incoming-dispatches")');
    expect(routeContent).not.toContain('routePath.includes("/finance/inventory/outgoing-dispatches")');
  });

  it("routes CRM edit to the CRM form instead of the quote form", () => {
    expect(routeContent).toContain('routePath.includes("/crm/customers/") && routePath.endsWith("/edit")');
    expect(routeContent).toContain("<CrmCustomerFormPage edit />");
  });

  it("uses every approved Ebru presentation family with live Paraşüt adapters", () => {
    for (const className of [
      "income-page",
      "ops-page",
      "crm-page",
      "sales-page",
      "report-page",
    ]) {
      expect(livePresentation).toContain(`className="${className}"`);
    }
    expect(livePresentation).toContain("useParasutList");
    expect(livePresentation).toContain("useParasutReports");
    expect(livePresentation).toContain("CreateCustomerDialog");
  });
});
