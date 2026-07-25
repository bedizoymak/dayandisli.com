import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useParasutList } from "@/features/erp/parasut/api/queries";
import { QuoteFormPage } from "./QuotePages";

vi.mock("@/features/erp/parasut/api/queries", () => ({ useParasutList: vi.fn() }));

const mockedUseParasutList = vi.mocked(useParasutList);

function renderPage() {
  return render(
    <MemoryRouter>
      <QuoteFormPage />
    </MemoryRouter>,
  );
}

const customerRow = (overrides: Partial<{ parasut_id: string; name: string }> = {}) => ({
  id: "row-1",
  parasut_id: overrides.parasut_id ?? "123",
  attributes: {
    name: overrides.name ?? "Acme A.Ş.",
    short_name: "Ahmet Yılmaz",
    email: "ahmet@acme.com",
    phone: "5551112233",
    address: "Sanayi Cad.",
    district: "Ümraniye",
    city: "İstanbul",
    contact_type: "company",
    account_type: "customer",
    tax_number: null,
    tax_office: null,
    balance: null,
    trl_balance: null,
    usd_balance: null,
    eur_balance: null,
    gbp_balance: null,
    term_days: null,
    archived: false,
  },
  relationships: {},
  source_created_at: null,
  source_updated_at: null,
  source_archived: false,
  synced_at: "",
  last_seen_at: "",
});

describe("QuoteFormPage customer selector", () => {
  it("queries the customers resource, excluding archived contacts, via useParasutList", async () => {
    mockedUseParasutList.mockReturnValue({
      data: { rows: [customerRow()], total: 1, page: 1, pageSize: 25 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useParasutList>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Müşteri Seç" }));

    expect(mockedUseParasutList).toHaveBeenCalledWith(
      "customers",
      expect.objectContaining({ filters: { archived: false } }),
    );
    expect(screen.getByText("Acme A.Ş.")).toBeInTheDocument();
  });

  it("shows a loading state while customers are being fetched", async () => {
    mockedUseParasutList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useParasutList>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Müşteri Seç" }));

    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
  });

  it("shows an empty state when no customers match", async () => {
    mockedUseParasutList.mockReturnValue({
      data: { rows: [], total: 0, page: 1, pageSize: 25 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useParasutList>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Müşteri Seç" }));

    expect(screen.getByText(/Eşleşen müşteri bulunamadı/)).toBeInTheDocument();
  });

  it("shows an error state when the fetch fails", async () => {
    mockedUseParasutList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network down"),
    } as ReturnType<typeof useParasutList>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Müşteri Seç" }));

    expect(screen.getByText(/network down/)).toBeInTheDocument();
  });

  it("populates the quote form fields when a customer is selected", async () => {
    mockedUseParasutList.mockReturnValue({
      data: { rows: [customerRow()], total: 1, page: 1, pageSize: 25 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useParasutList>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Müşteri Seç" }));
    await user.click(screen.getByText("Acme A.Ş."));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme A.Ş.")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Ahmet Yılmaz")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ahmet@acme.com")).toBeInTheDocument();
  });
});
