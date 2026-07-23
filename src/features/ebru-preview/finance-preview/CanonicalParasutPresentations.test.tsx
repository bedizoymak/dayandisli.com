import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  CanonicalParasutListPage,
  canonicalParasutPages,
} from "./CanonicalParasutPages";

vi.mock("@/features/erp/parasut/api/queries", () => ({
  parasutQueryKeys: { all: ["parasut"] },
  useParasutList: () => ({
    data: { rows: [], total: 0, page: 1, pageSize: 25 },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useParasutReports: () => ({
    data: {
      salesSummary: [],
      collectionSummary: [],
      purchaseSummary: [],
      paymentSummary: [],
      incomeExpenseComparison: { sales: [], purchases: [] },
      receivablesAging: [],
      payablesAging: [],
      customerBalances: [],
      supplierBalances: [],
      monthlyInvoiceTrend: [],
    },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/contexts/ERPAuthContext", () => ({
  useERPAuth: () => ({ roles: [], hasPermission: () => false }),
}));
vi.mock("@/features/erp/parasut/components/CreateCustomerDialog", () => ({
  CreateCustomerDialog: () => null,
}));

function renderPage(config: (typeof canonicalParasutPages)[string]) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/apps"]}>
        <CanonicalParasutListPage config={config} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("live canonical Ebru presentation adapters", () => {
  it("uses the approved income presentation for invoices", () => {
    expect(renderPage(canonicalParasutPages.invoices).container.querySelector(".income-page")).toBeTruthy();
  });

  it("uses the approved operations presentation for products and suppliers", () => {
    expect(renderPage(canonicalParasutPages.products).container.querySelector(".ops-page")).toBeTruthy();
    expect(renderPage(canonicalParasutPages.suppliers).container.querySelector(".ops-page")).toBeTruthy();
  });

  it("uses the approved sales presentation for offers", () => {
    expect(renderPage(canonicalParasutPages.offers).container.querySelector(".sales-page")).toBeTruthy();
  });

  it("uses the approved cash/report presentation for accounts", () => {
    expect(renderPage(canonicalParasutPages.accounts).container.querySelector(".report-page")).toBeTruthy();
  });

  it("uses the approved CRM presentation when the live customer config is routed through CRM", () => {
    const config = {
      ...canonicalParasutPages.customers,
      breadcrumb: "Müşteri İlişkileri / Müşteriler",
    };
    expect(renderPage(config).container.querySelector(".crm-page")).toBeTruthy();
  });
});
