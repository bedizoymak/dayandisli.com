import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanonicalParasutListPage, canonicalParasutPages } from "./CanonicalParasutPages";

const useParasutListMock = vi.fn();

vi.mock("@/features/erp/parasut/api/queries", () => ({
  parasutQueryKeys: { all: ["parasut"] },
  useParasutList: (...args: unknown[]) => useParasutListMock(...args),
  useParasutReports: () => ({ data: undefined, isLoading: false, isError: false }),
}));
vi.mock("@/contexts/ERPAuthContext", () => ({
  useERPAuth: () => ({ roles: [], hasPermission: () => false }),
}));
vi.mock("@/features/erp/parasut/components/CreateCustomerDialog", () => ({
  CreateCustomerDialog: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderInvoicesPage(initialPath: string) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <CanonicalParasutListPage config={canonicalParasutPages.invoices} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("invoices list — default and explicit sort", () => {
  beforeEach(() => {
    useParasutListMock.mockReset();
    useParasutListMock.mockReturnValue({
      data: { rows: [], total: 0, page: 1, pageSize: 25 },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("opening without any sort param defaults to issue_date desc and canonicalizes the URL", async () => {
    renderInvoicesPage("/apps/finance/income/invoices");

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/apps/finance/income/invoices?sort=issue_date&dir=desc&page=1",
      ),
    );

    const lastCall = useParasutListMock.mock.calls.at(-1) as [string, { sort?: { field: string; direction: string } }];
    expect(lastCall[0]).toBe("sales_invoices");
    expect(lastCall[1].sort).toEqual({ field: "issue_date", direction: "desc" });
  });

  it("shows the Fatura Tarihi column with a visible descending indicator by default", async () => {
    renderInvoicesPage("/apps/finance/income/invoices");

    const dateHeader = await screen.findByRole("button", { name: /Fatura Tarihi/ });
    expect(dateHeader.textContent).toContain("↓");
    const amountHeader = screen.getByRole("button", { name: /Tutar/ });
    expect(amountHeader.textContent).toContain("↕"); // not the active sort column
  });

  it("an explicit user-selected sort (Tutar ascending) overrides the issue_date default and is not overwritten", async () => {
    renderInvoicesPage("/apps/finance/income/invoices?sort=gross_total&dir=asc&page=1");

    await waitFor(() => expect(useParasutListMock).toHaveBeenCalled());
    const lastCall = useParasutListMock.mock.calls.at(-1) as [string, { sort?: { field: string; direction: string } }];
    expect(lastCall[1].sort).toEqual({ field: "gross_total", direction: "asc" });

    const amountHeader = screen.getByRole("button", { name: /Tutar/ });
    expect(amountHeader.textContent).toContain("↑");
    // URL must stay exactly as the user set it — no canonicalization redirect
    // fires once an explicit sort is already present.
    expect(screen.getByTestId("location").textContent).toBe(
      "/apps/finance/income/invoices?sort=gross_total&dir=asc&page=1",
    );
  });

  it("preserves an explicit sort when combined with pagination/page-size state", async () => {
    renderInvoicesPage("/apps/finance/income/invoices?sort=gross_total&dir=desc&page=2&pageSize=10");

    await waitFor(() => expect(useParasutListMock).toHaveBeenCalled());
    const lastCall = useParasutListMock.mock.calls.at(-1) as [string, { sort?: { field: string; direction: string }; page: number; pageSize: number }];
    expect(lastCall[1].sort).toEqual({ field: "gross_total", direction: "desc" });
    expect(lastCall[1].page).toBe(2);
    expect(lastCall[1].pageSize).toBe(10);
  });
});
