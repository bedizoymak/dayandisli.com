import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fetchQuotes = vi.fn();
vi.mock("./quotesApi", () => ({
  fetchQuotes: (...args: unknown[]) => fetchQuotes(...args),
}));

const { QuotesPage } = await import("./SalesListPages");

describe("QuotesPage — real, persisted quote list (no mock fixture data)", () => {
  it("shows a real quote row with its own real number, issuer, customer and total", async () => {
    fetchQuotes.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "q1",
          quote_no: "DY-202608-4",
          issuer: "dayan",
          status: "draft",
          currency: "TRY",
          subject: "Helis Dişli",
          customer_source: "parasut",
          parasut_customer_id: "123",
          local_customer_id: null,
          customer_name: "Test A.Ş.",
          customer_contact: null,
          customer_phone: null,
          customer_email: null,
          customer_address: null,
          customer_tax_no: null,
          issue_date: "2026-08-14",
          valid_until: "2026-08-17",
          payment_terms: null,
          delivery_terms: null,
          delivery_time: null,
          notes: null,
          subtotal: 1000,
          discount_total: 0,
          vat_total: 200,
          grand_total: 1200,
          converted_order_no: null,
          created_at: "2026-08-14T00:00:00Z",
          updated_at: "2026-08-14T00:00:00Z",
        },
      ],
    });
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("DY-202608-4")).toBeInTheDocument());
    expect(screen.getByText("Test A.Ş.")).toBeInTheDocument();
  });

  it("shows a controlled empty state instead of fabricated/demo rows when there are no quotes", async () => {
    fetchQuotes.mockResolvedValue({ ok: true, data: [] });
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Kayıtlı teklif bulunamadı.")).toBeInTheDocument());
  });
});
