import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";

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
      <Toaster />
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

async function fillMinimalValidForm() {
  generateQuoteNumber.mockResolvedValue({ ok: true, data: "DY-202608-4" });
  createLocalCustomer.mockResolvedValue({
    ok: true,
    data: { id: "local-1", company_name: "Yeni Firma", contact_name: null, phone: null, email: null, address: null, tax_no: null },
  });
  renderForm();
  fireEvent.change(screen.getByLabelText(/Teklif Veren Firma \*/), { target: { value: "dayan" } });
  await waitFor(() => expect(screen.getByDisplayValue("DY-202608-4")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Yeni Müşteri"));
  fireEvent.change(screen.getByLabelText(/Firma Adı \*/), { target: { value: "Yeni Firma" } });
  fireEvent.click(screen.getByText("Müşteriyi Kaydet ve Seç"));
  await waitFor(() => expect(screen.getByDisplayValue("Yeni Firma")).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/^Konu \*/), { target: { value: "Test Konu" } });
  fireEvent.change(screen.getByPlaceholderText("Ürün/Hizmet"), { target: { value: "Test Kalem" } });
}

describe("QuoteFormPage — save", () => {
  it("blocks save and shows an error when no customer is selected", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Teklif Veren Firma \*/), { target: { value: "dayan" } });
    fireEvent.click(screen.getByText("Taslak Kaydet"));
    await waitFor(() => expect(screen.getByText(/Müşteri seçimi/)).toBeInTheDocument());
    expect(saveQuote).not.toHaveBeenCalled();
  });

  it("never hangs on 'Kaydediliyor…' — an unexpected rejection is caught, surfaced, and re-enables the button", async () => {
    await fillMinimalValidForm();
    saveQuote.mockRejectedValue(new Error("network down"));
    fireEvent.click(screen.getByText("Taslak Kaydet"));
    await waitFor(() => expect(screen.getByText("network down")).toBeInTheDocument());
    expect(screen.getByText("Taslak Kaydet")).not.toBeDisabled();
  });

  it("translates a duplicate quote_no (unique-violation) error into a plain Turkish message", async () => {
    await fillMinimalValidForm();
    saveQuote.mockResolvedValue({
      ok: false,
      message: 'duplicate key value violates unique constraint "quotes_quote_no_key"',
    });
    fireEvent.click(screen.getByText("Taslak Kaydet"));
    await waitFor(() => expect(screen.getByText(/numaralı bir teklif zaten var/)).toBeInTheDocument());
  });

  it("saves successfully, toasts, and navigates to the new quote's detail page", async () => {
    await fillMinimalValidForm();
    saveQuote.mockResolvedValue({ ok: true, data: { id: "new-quote-1", quote_no: "DY-202608-4" } });
    fireEvent.click(screen.getByText("Taslak Kaydet"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/apps/sales/quotes/new-quote-1"));
    expect(saveQuote).toHaveBeenCalledWith(
      expect.objectContaining({ quoteNo: "DY-202608-4", issuer: "dayan", subject: "Test Konu" }),
    );
  });
});

describe("QuoteFormPage — 'Yazdır / PDF Kaydet' from an unsaved form", () => {
  it("blocks the preview and shows a Turkish error when there is no line item yet", async () => {
    generateQuoteNumber.mockResolvedValue({ ok: true, data: "DY-202608-4" });
    createLocalCustomer.mockResolvedValue({
      ok: true,
      data: { id: "local-1", company_name: "Yeni Firma", contact_name: null, phone: null, email: null, address: null, tax_no: null },
    });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Teklif Veren Firma \*/), { target: { value: "dayan" } });
    await waitFor(() => expect(screen.getByDisplayValue("DY-202608-4")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Yeni Müşteri"));
    fireEvent.change(screen.getByLabelText(/Firma Adı \*/), { target: { value: "Yeni Firma" } });
    fireEvent.click(screen.getByText("Müşteriyi Kaydet ve Seç"));
    await waitFor(() => expect(screen.getByDisplayValue("Yeni Firma")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Konu \*/), { target: { value: "Test Konu" } });
    // No line description entered — the single default empty line stays invalid.
    const openSpy = vi.spyOn(window, "open");
    fireEvent.click(screen.getByText("Yazdır / PDF Kaydet"));
    expect(openSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/en az bir ürün\/hizmet satırı/)).toBeInTheDocument());
    openSpy.mockRestore();
  });

  it("opens the print window synchronously with the in-memory form data — never calls saveQuote, never touches Parasut", async () => {
    await fillMinimalValidForm();
    const openSpy = vi.spyOn(window, "open").mockReturnValue({ document: { write: vi.fn() } } as unknown as Window);
    invoke.mockClear();
    fireEvent.click(screen.getByText("Yazdır / PDF Kaydet"));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(saveQuote).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("shows a visible Turkish error toast when the popup is blocked", async () => {
    await fillMinimalValidForm();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    fireEvent.click(screen.getByText("Yazdır / PDF Kaydet"));
    await waitFor(() => expect(screen.getByText(/Popup engellendi/)).toBeInTheDocument());
    openSpy.mockRestore();
  });
});
