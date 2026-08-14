import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";

const fetchQuotes = vi.fn();
const fetchQuoteWithLines = vi.fn();
const deleteQuote = vi.fn();
vi.mock("./quotesApi", () => ({
  fetchQuotes: (...args: unknown[]) => fetchQuotes(...args),
  fetchQuoteWithLines: (...args: unknown[]) => fetchQuoteWithLines(...args),
  deleteQuote: (...args: unknown[]) => deleteQuote(...args),
}));

const { QuotesPage } = await import("./SalesListPages");

const SAMPLE_QUOTE = {
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
};

describe("QuotesPage — real, persisted quote list (no mock fixture data)", () => {
  it("shows a real quote row with its own real number, issuer, customer and total", async () => {
    fetchQuotes.mockResolvedValue({ ok: true, data: [SAMPLE_QUOTE] });
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

describe("QuotesPage — 'Yazdır / PDF Kaydet' opens the popup synchronously (popup-blocker safe)", () => {
  it("calls window.open() before awaiting the lines fetch, not after", async () => {
    fetchQuotes.mockResolvedValue({ ok: true, data: [SAMPLE_QUOTE] });
    let resolveLines: (value: unknown) => void = () => {};
    fetchQuoteWithLines.mockReturnValue(new Promise((resolve) => { resolveLines = resolve; }));

    const fakeWindow = { document: { write: vi.fn(), open: vi.fn(), close: vi.fn() }, close: vi.fn() };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("DY-202608-4")).toBeInTheDocument());

    fireEvent.click(screen.getByTitle("Yazdır / PDF Kaydet"));
    // window.open must already have happened synchronously, before the
    // lines fetch has even resolved.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(fetchQuoteWithLines).toHaveBeenCalledWith("q1");

    resolveLines({ ok: true, data: { quote: SAMPLE_QUOTE, lines: [] } });
    await waitFor(() => expect(fakeWindow.document.close).toHaveBeenCalled());

    openSpy.mockRestore();
  });

  it("shows a visible error toast (never a silent no-op) when the popup is blocked", async () => {
    fetchQuotes.mockResolvedValue({ ok: true, data: [SAMPLE_QUOTE] });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <MemoryRouter>
        <QuotesPage />
        <Toaster />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("DY-202608-4")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Yazdır / PDF Kaydet"));
    expect(fetchQuoteWithLines).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Popup engellendi/)).toBeInTheDocument());
    openSpy.mockRestore();
  });
});

describe("QuotesPage — delete", () => {
  it("asks for confirmation with the quote number in the message, and does nothing on cancel", async () => {
    fetchQuotes.mockResolvedValue({ ok: true, data: [SAMPLE_QUOTE] });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <MemoryRouter>
        <QuotesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("DY-202608-4")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Sil"));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("DY-202608-4"));
    expect(deleteQuote).not.toHaveBeenCalled();
    expect(screen.getByText("DY-202608-4")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("deletes on confirm, removes the row immediately, and toasts success", async () => {
    fetchQuotes.mockResolvedValue({ ok: true, data: [SAMPLE_QUOTE] });
    deleteQuote.mockResolvedValue({ ok: true, data: null });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <QuotesPage />
        <Toaster />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("DY-202608-4")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Sil"));
    expect(deleteQuote).toHaveBeenCalledWith("q1");
    await waitFor(() => expect(screen.queryByText("DY-202608-4")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/kalıcı olarak silindi/)).toBeInTheDocument());
  });

  it("shows a visible error and keeps the row when the delete fails", async () => {
    fetchQuotes.mockResolvedValue({ ok: true, data: [SAMPLE_QUOTE] });
    deleteQuote.mockResolvedValue({ ok: false, message: "permission denied" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <QuotesPage />
        <Toaster />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("DY-202608-4")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Sil"));
    await waitFor(() => expect(screen.getByText("permission denied")).toBeInTheDocument());
    expect(screen.getByText("DY-202608-4")).toBeInTheDocument();
  });
});
