import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const { ExpenseListPage } = await import("./FinanceExpensePages.tsx");

function bill(id: string, opts: { supplier: string; payment: string; invoiceNo: string }) {
  return {
    parasut_id: id,
    partyName: opts.supplier,
    source_archived: false,
    attributes: {
      archived: false,
      currency: "TRL",
      description: `Kayıt ${id}`,
      due_date: "2026-02-01",
      gross_total: 100,
      invoice_no: opts.invoiceNo,
      issue_date: "2026-01-01",
      item_type: "purchase_bill",
      payment_status: opts.payment,
    },
    relationships: { supplier: { data: { id: `supplier-${id}` } } },
  };
}

// 20 rows: 6 ERDEMİR METAL suppliers (2 overdue), 14 other suppliers (2 overdue),
// one of the ERDEMİR rows carries the specific searched document number.
const ROWS = [
  ...Array.from({ length: 6 }, (_, i) =>
    bill(`erd-${i}`, {
      supplier: "ERDEMİR METAL SANAYİ",
      payment: i < 2 ? "overdue" : "paid",
      invoiceNo: i === 0 ? "ERD2026000001640" : `ERD2026-0000${i}`,
    }),
  ),
  ...Array.from({ length: 14 }, (_, i) =>
    bill(`other-${i}`, {
      supplier: `TEDARIKCI ${i}`,
      payment: i < 2 ? "overdue" : "paid",
      invoiceNo: `OTH2026-0000${i}`,
    }),
  ),
];

function mockInvoke() {
  invoke.mockImplementation((_fn: string, opts: { body: { action: string; resource?: string; page?: number } }) => {
    if (opts.body.action === "list" && opts.body.resource === "purchase_bills") {
      if ((opts.body.page ?? 1) > 1) return Promise.resolve({ data: { rows: [], total: ROWS.length }, error: null });
      return Promise.resolve({ data: { rows: ROWS, total: ROWS.length }, error: null });
    }
    return Promise.resolve({ data: null, error: { message: "unexpected action in test" } });
  });
}

function footerCount() {
  const footer = document.querySelector(".expense-table-wrap footer span");
  const match = footer?.textContent?.match(/\/ (\d+) kayıt/);
  return match ? Number(match[1]) : Number.NaN;
}

function visibleRowCount() {
  return document.querySelectorAll(".expense-table tbody tr").length;
}

function expectFooterMatchesVisible(expectedFooter: number) {
  expect(footerCount()).toBe(expectedFooter);
  expect(visibleRowCount()).toBe(expectedFooter);
}

describe("ExpenseListPage — rendered row count always matches the footer count", () => {
  it("stays in sync across a clean load, supplier filter, payment filter, document search, and clear", async () => {
    mockInvoke();
    render(
      <MemoryRouter>
        <ExpenseListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expectFooterMatchesVisible(20));

    fireEvent.change(screen.getByLabelText("Tedarikçi"), { target: { value: "erdemir" } });
    await waitFor(() => expectFooterMatchesVisible(6));

    fireEvent.change(screen.getByLabelText("Tedarikçi"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Ödeme Durumu"), { target: { value: "Gecikmiş" } });
    await waitFor(() => expectFooterMatchesVisible(4));

    fireEvent.change(screen.getByLabelText("Ödeme Durumu"), { target: { value: "Tümü" } });
    const searchInput = document.querySelector(".expense-search input") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "ERD2026000001640" } });
    await waitFor(() => expectFooterMatchesVisible(1));

    fireEvent.click(screen.getByText("Filtreleri Temizle"));
    await waitFor(() => expectFooterMatchesVisible(20));
  });
});
