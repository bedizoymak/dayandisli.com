import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const generateQuoteNumber = vi.fn();
const saveQuote = vi.fn();
const createLocalCustomer = vi.fn();
const fetchLocalCustomer = vi.fn();
const fetchQuoteWithLines = vi.fn();
const addHistoryEntry = vi.fn();
const updateQuoteStatus = vi.fn();
vi.mock("./quotesApi", () => ({
  generateQuoteNumber,
  saveQuote,
  createLocalCustomer,
  fetchLocalCustomer,
  fetchQuoteWithLines,
  addHistoryEntry,
  updateQuoteStatus,
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const { QuoteFormPage } = await import("./QuotePages");

function renderForm(initialPath = "/apps/sales/quotes/new") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QuoteFormPage />
    </MemoryRouter>,
  );
}

describe("QuoteFormPage — issuer selection generates a real, series-correct quote number", () => {
  it("requests a Dayan (DY) number when Dayan is selected", async () => {
    generateQuoteNumber.mockResolvedValue({ ok: true, data: "DY-202608-4" });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Teklif Veren Firma \*/), { target: { value: "dayan" } });
    await waitFor(() => expect(generateQuoteNumber).toHaveBeenCalledWith("dayan"));
    await waitFor(() => expect(screen.getByDisplayValue("DY-202608-4")).toBeInTheDocument());
  });

  it("requests a CEHA (CH) number when CEHA is selected", async () => {
    generateQuoteNumber.mockResolvedValue({ ok: true, data: "CH-202608-1" });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Teklif Veren Firma \*/), { target: { value: "ceha" } });
    await waitFor(() => expect(generateQuoteNumber).toHaveBeenCalledWith("ceha"));
    await waitFor(() => expect(screen.getByDisplayValue("CH-202608-1")).toBeInTheDocument());
  });

  it("never clobbers a manually-typed quote number with a fresh auto-generated one", async () => {
    generateQuoteNumber.mockResolvedValue({ ok: true, data: "DY-202608-4" });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Teklif Veren Firma \*/), { target: { value: "dayan" } });
    await waitFor(() => expect(screen.getByDisplayValue("DY-202608-4")).toBeInTheDocument());

    const numberInput = screen.getByPlaceholderText(/DY-YYYYAA-N|CH-YYYYAA-N/) as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "DY-CUSTOM-99" } });
    expect(numberInput.value).toBe("DY-CUSTOM-99");

    generateQuoteNumber.mockClear();
    // Re-rendering the same issuer must not trigger another RPC call / overwrite.
    fireEvent.change(screen.getByLabelText(/Teklif Veren Firma \*/), { target: { value: "dayan" } });
    await new Promise((r) => setTimeout(r, 0));
    expect(numberInput.value).toBe("DY-CUSTOM-99");
  });
});

describe("QuoteFormPage — customer flow", () => {
  it("populates customer fields from the selected real Parasut customer", async () => {
    invoke.mockResolvedValue({
      data: { rows: [{ parasut_id: "cust-1", attributes: { name: "Test Müşteri A.Ş.", phone: "555", email: "a@b.com" } }] },
      error: null,
    });
    renderForm();
    fireEvent.click(screen.getByText("Müşteri Seç"));
    await waitFor(() => expect(screen.getByText("Test Müşteri A.Ş.")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Test Müşteri A.Ş."));
    await waitFor(() => expect(screen.getByDisplayValue("Test Müşteri A.Ş.")).toBeInTheDocument());
  });

  it("creates a new local customer (never written to Parasut) and selects it", async () => {
    createLocalCustomer.mockResolvedValue({
      ok: true,
      data: { id: "local-1", company_name: "Yeni Firma", contact_name: null, phone: null, email: null, address: null, tax_no: null },
    });
    renderForm();
    fireEvent.click(screen.getByText("Yeni Müşteri"));
    fireEvent.change(screen.getByLabelText(/Firma Adı \*/), { target: { value: "Yeni Firma" } });
    fireEvent.click(screen.getByText("Müşteriyi Kaydet ve Seç"));
    await waitFor(() => expect(createLocalCustomer).toHaveBeenCalledWith(expect.objectContaining({ companyName: "Yeni Firma" })));
    await waitFor(() => expect(screen.getByDisplayValue("Yeni Firma")).toBeInTheDocument());
    // The local-customer write path must never touch supabase.functions.invoke (Parasut).
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("QuoteFormPage — save", () => {
  it("blocks save and shows an error when no customer is selected", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Teklif Veren Firma \*/), { target: { value: "dayan" } });
    fireEvent.click(screen.getByText("Taslak Kaydet"));
    await waitFor(() => expect(screen.getByText(/Müşteri seçimi/)).toBeInTheDocument());
    expect(saveQuote).not.toHaveBeenCalled();
  });
});
