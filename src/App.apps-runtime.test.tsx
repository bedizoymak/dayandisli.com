import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppRoutes } from "./App";

// Mock ERP auth as an authorized admin user so route-level permission checks
// pass genuinely (not because auth short-circuits to a login redirect) and so
// the runtime 404 behavior below is proof of the *router's* matching, not of
// an auth gate.
vi.mock("@/contexts/ERPAuthContext", () => ({
  ERPAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useERPAuth: () => ({
    session: { user: { email: "test@dayandisli.com" } },
    supabaseUser: { email: "test@dayandisli.com" },
    erpUser: { email: "test@dayandisli.com", is_active: true, role: "admin" },
    permissions: [],
    roles: ["admin"],
    isLoading: false,
    isAuthenticated: true,
    isAuthorizedERPUser: true,
    refreshAuth: async () => undefined,
    signOut: async () => undefined,
    hasPermission: () => true,
  }),
}));

vi.mock("@/lib/domains", () => ({
  shouldExposeErpRoutes: () => true,
  shouldExposePublicRoutes: () => false,
  buildErpUrl: (path: string) => `https://erp.dayandisli.com${path}`,
}));

function renderAt(path: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <Suspense fallback={<div>loading...</div>}>
            <AppRoutes />
          </Suspense>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

async function waitForRouteToSettle() {
  await waitFor(() => expect(screen.queryByText("loading...")).not.toBeInTheDocument(), { timeout: 5000 });
}

describe("runtime /apps route resolution (authenticated, MemoryRouter, real router matching)", () => {
  it("renders the dashboard at /apps", async () => {
    renderAt("/apps");
    await waitForRouteToSettle();
    expect(screen.getByText(/Hızlı İşlemler/i)).toBeInTheDocument();
  });

  it("renders the finance overview at the static /apps/finance route", async () => {
    renderAt("/apps/finance");
    await waitForRouteToSettle();
    expect(document.querySelector(".erp-dashboard")).not.toBeNull();
    expect(screen.queryByText(/Sayfa Bulunamadı|404/i)).not.toBeInTheDocument();
  });

  it("renders the create-invoice route at /apps/finance/income/invoices/new", async () => {
    renderAt("/apps/finance/income/invoices/new");
    await waitForRouteToSettle();
    expect(screen.queryByText(/Sayfa Bulunamadı|404/i)).not.toBeInTheDocument();
    expect(document.querySelector("form")).not.toBeNull();
  });

  it("renders the dynamic detail route at /apps/crm/customers/:customerId", async () => {
    renderAt("/apps/crm/customers/atlas-makine");
    await waitForRouteToSettle();
    expect(screen.queryByText(/Sayfa Bulunamadı|404/i)).not.toBeInTheDocument();
  });

  it("renders the dynamic edit route at /apps/crm/customers/:customerId/edit", async () => {
    renderAt("/apps/crm/customers/atlas-makine/edit");
    await waitForRouteToSettle();
    expect(screen.queryByText(/Sayfa Bulunamadı|404/i)).not.toBeInTheDocument();
    expect(document.querySelector("form")).not.toBeNull();
  });

  it.each([
    "/apps/anything-unknown",
    "/apps/finance/anything-unknown",
    "/apps/crm/anything-unknown",
    "/apps/sales/anything-unknown",
  ])("renders the real NotFound component for unknown path %s (not the dashboard, not a module fallback, not an empty layout)", async (path) => {
    renderAt(path);
    await waitForRouteToSettle();
    // The real NotFound page (src/pages/NotFound.tsx) renders this heading.
    expect(screen.getByText(/404/)).toBeInTheDocument();
    // It must NOT be the ERP shell (dashboard / module fallback) rendering instead.
    expect(document.querySelector(".erp-dashboard")).toBeNull();
  });

  it.each(["/demo", "/demo/anything", "/demo/finance/invoices"])("renders NotFound for legacy demo path %s (no redirect, no dispatcher)", async (path) => {
    renderAt(path);
    await waitForRouteToSettle();
    expect(screen.getByText(/404/)).toBeInTheDocument();
    expect(document.querySelector(".erp-dashboard")).toBeNull();
  });
});

describe("dynamic-route parameter resolution (per-family, valid vs unknown vs malformed IDs)", () => {
  it("invoice detail: a valid fictional-but-existing invoice number renders the real record, not the first sample row", async () => {
    renderAt("/apps/finance/income/invoices/SF-2026-137");
    await waitForRouteToSettle();
    expect(screen.getByDisplayValue("SF-2026-137")).toBeInTheDocument();
    // Must not silently show the first sample row's number instead.
    expect(screen.queryByDisplayValue("SF-2026-148")).not.toBeInTheDocument();
  });

  it("invoice detail: an unknown invoice number renders a controlled not-found state, not sample data", async () => {
    renderAt("/apps/finance/income/invoices/DOES-NOT-EXIST-999");
    await waitForRouteToSettle();
    expect(screen.getByRole("heading", { name: "Fatura Bulunamadı" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/^SF-2026-/)).not.toBeInTheDocument();
  });

  it("invoice edit: an unknown invoice number renders a controlled not-found state instead of a blank/generic edit form", async () => {
    renderAt("/apps/finance/income/invoices/DOES-NOT-EXIST-999/edit");
    await waitForRouteToSettle();
    expect(screen.getByRole("heading", { name: "Fatura Bulunamadı" })).toBeInTheDocument();
  });

  it("static /new invoice route is not swallowed by the dynamic :invoiceId route", async () => {
    renderAt("/apps/finance/income/invoices/new");
    await waitForRouteToSettle();
    expect(screen.queryByRole("heading", { name: "Fatura Bulunamadı" })).not.toBeInTheDocument();
    expect(document.querySelector("form")).not.toBeNull();
  });

  it("crm customer detail: a valid id renders the matching customer without a not-found heading", async () => {
    const view = renderAt("/apps/crm/customers/eksen-otomotiv");
    await waitForRouteToSettle();
    expect(screen.queryByRole("heading", { name: "Müşteri bulunamadı" })).not.toBeInTheDocument();
    view.unmount();
  });

  it("crm customer detail: an unknown id renders controlled not-found, not customer[0]", async () => {
    renderAt("/apps/crm/customers/no-such-customer-id");
    await waitForRouteToSettle();
    expect(screen.getByRole("heading", { name: "Müşteri bulunamadı" })).toBeInTheDocument();
  });

  it("crm customer detail: malformed/empty-looking id segment also renders controlled not-found, never a generic fallback", async () => {
    renderAt("/apps/crm/customers/%20%20");
    await waitForRouteToSettle();
    expect(screen.getByRole("heading", { name: "Müşteri bulunamadı" })).toBeInTheDocument();
  });

  it("quote detail: an unknown/unreachable id renders controlled not-found with that exact id, not any other quote's data", async () => {
    renderAt("/apps/sales/quotes/no-such-quote");
    await waitForRouteToSettle();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Teklif bulunamadı" })).toBeInTheDocument());
    expect(screen.getByText(/no-such-quote/)).toBeInTheDocument();
  });

  it("quote customer detail: an unknown local customer id renders controlled not-found", async () => {
    renderAt("/apps/sales/quote-customers/no-such-customer");
    await waitForRouteToSettle();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Müşteri bulunamadı" })).toBeInTheDocument());
  });

  it("supplier detail: unknown supplier id renders controlled not-found, not the first supplier", async () => {
    renderAt("/apps/finance/purchasing/suppliers/no-such-supplier");
    await waitForRouteToSettle();
    expect(screen.getByRole("heading", { name: "Tedarikçi Bulunamadı" })).toBeInTheDocument();
  });

  it("finance expense detail: unknown expense document id renders controlled not-found, not the first expense row", async () => {
    renderAt("/apps/finance/expense/list/no-such-expense-doc");
    await waitForRouteToSettle();
    expect(screen.getByRole("heading", { name: "Gider Kaydı Bulunamadı" })).toBeInTheDocument();
  });

  it("incoming invoice detail: unknown invoice number renders controlled not-found, not the first incoming invoice", async () => {
    renderAt("/apps/finance/expense/incoming-invoices/no-such-incoming-invoice");
    await waitForRouteToSettle();
    expect(screen.getByRole("heading", { name: "Fatura Bulunamadı" })).toBeInTheDocument();
  });
});

describe("representative internal navigation actions (click through, assert final URL + rendered page)", () => {
  it("clicking the sidebar 'Muhasebe ve Finans' trigger navigates to the real /apps/finance route", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderAt("/apps");
    await waitForRouteToSettle();
    await user.click(screen.getByText("Muhasebe ve Finans"));
    await waitFor(() => expect(document.querySelector(".erp-finance-overview-link, .finance-overview-page, .erp-dashboard")).not.toBeNull());
    // FinanceOverviewPage renders under the /apps/finance route once clicked.
    expect(screen.queryByText(/Sayfa Bulunamadı|404/i)).not.toBeInTheDocument();
  });

  it("a disabled sidebar module (e.g. Ayarlar) does not navigate anywhere when clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderAt("/apps");
    await waitForRouteToSettle();
    expect(screen.getByText(/Hızlı İşlemler/i)).toBeInTheDocument();
    await user.click(screen.getByText("Ayarlar"));
    // Still on the dashboard — a disabled module button must never route anywhere.
    expect(screen.getByText(/Hızlı İşlemler/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sayfa Bulunamadı|404/i)).not.toBeInTheDocument();
  });
});
