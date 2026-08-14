import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Toaster } from "@/components/ui/toaster";

const fetchHistoryEntriesForCustomer = vi.fn();
const addHistoryEntry = vi.fn();
const uploadQuoteHistoryFile = vi.fn();
const deleteQuoteHistoryFile = vi.fn();
const getQuoteHistoryFileUrl = vi.fn();
vi.mock("./quotesApi", () => ({
  fetchHistoryEntriesForCustomer: (...args: unknown[]) => fetchHistoryEntriesForCustomer(...args),
  addHistoryEntry: (...args: unknown[]) => addHistoryEntry(...args),
  uploadQuoteHistoryFile: (...args: unknown[]) => uploadQuoteHistoryFile(...args),
  deleteQuoteHistoryFile: (...args: unknown[]) => deleteQuoteHistoryFile(...args),
  getQuoteHistoryFileUrl: (...args: unknown[]) => getQuoteHistoryFileUrl(...args),
  QUOTE_HISTORY_FILE_MAX_BYTES: 20 * 1024 * 1024,
}));

const { QuoteHistoryPanel } = await import("./QuoteHistoryPanel");

function renderPanel(props: { source: "parasut" | "local"; parasutCustomerId: string | null; localCustomerId: string | null }) {
  return render(
    <>
      <QuoteHistoryPanel {...props} />
      <Toaster />
    </>,
  );
}

function pdfFile(name = "eski-teklif.pdf", size = 1024) {
  const file = new File([new Uint8Array(size)], name, { type: "application/pdf" });
  return file;
}

describe("QuoteHistoryPanel — validation", () => {
  it("rejects a non-PDF file with a Turkish error and never uploads it", async () => {
    fetchHistoryEntriesForCustomer.mockResolvedValue({ ok: true, data: [] });
    renderPanel({ source: "parasut", parasutCustomerId: "cust-1", localCustomerId: null });
    await waitFor(() => expect(fetchHistoryEntriesForCustomer).toHaveBeenCalled());
    fireEvent.click(screen.getByText("+ Geçmiş Teklif Ekle"));

    const fileInput = screen.getByLabelText(/PDF Dosyası/) as HTMLInputElement;
    const notPdf = new File(["x"], "resim.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [notPdf] } });

    await waitFor(() => expect(screen.getByText(/Yalnızca .pdf dosyası/)).toBeInTheDocument());
    expect(uploadQuoteHistoryFile).not.toHaveBeenCalled();
  });

  it("rejects a PDF over 20 MB with a Turkish error", async () => {
    fetchHistoryEntriesForCustomer.mockResolvedValue({ ok: true, data: [] });
    renderPanel({ source: "parasut", parasutCustomerId: "cust-1", localCustomerId: null });
    await waitFor(() => expect(fetchHistoryEntriesForCustomer).toHaveBeenCalled());
    fireEvent.click(screen.getByText("+ Geçmiş Teklif Ekle"));

    const fileInput = screen.getByLabelText(/PDF Dosyası/) as HTMLInputElement;
    const tooBig = pdfFile("buyuk.pdf", 21 * 1024 * 1024);
    fireEvent.change(fileInput, { target: { files: [tooBig] } });

    await waitFor(() => expect(screen.getByText(/20 MB'ı aşamaz/)).toBeInTheDocument());
    expect(uploadQuoteHistoryFile).not.toHaveBeenCalled();
  });

  it("blocks submit when quote date, description, or file is missing", async () => {
    fetchHistoryEntriesForCustomer.mockResolvedValue({ ok: true, data: [] });
    renderPanel({ source: "parasut", parasutCustomerId: "cust-1", localCustomerId: null });
    await waitFor(() => expect(fetchHistoryEntriesForCustomer).toHaveBeenCalled());
    fireEvent.click(screen.getByText("+ Geçmiş Teklif Ekle"));
    fireEvent.click(screen.getByText("Kaydet"));
    await waitFor(() => expect(screen.getByText(/Teklif tarihi zorunludur/)).toBeInTheDocument());
    expect(addHistoryEntry).not.toHaveBeenCalled();
  });
});

describe("QuoteHistoryPanel — upload flow", () => {
  it("uploads the PDF, then creates the history entry with the returned file metadata, and lists it", async () => {
    fetchHistoryEntriesForCustomer.mockResolvedValue({ ok: true, data: [] });
    uploadQuoteHistoryFile.mockResolvedValue({
      ok: true,
      data: { path: "parasut/cust-1/abc-eski-teklif.pdf", name: "eski-teklif.pdf", mime: "application/pdf", size: 1024 },
    });
    addHistoryEntry.mockResolvedValue({
      ok: true,
      data: {
        id: "h1",
        customer_source: "parasut",
        parasut_customer_id: "cust-1",
        local_customer_id: null,
        quote_no: "OLD-1",
        quote_date: "2025-01-01",
        amount: 1000,
        currency: "TRY",
        note: "Eski teklif",
        file_path: "parasut/cust-1/abc-eski-teklif.pdf",
        file_name: "eski-teklif.pdf",
        file_mime: "application/pdf",
        file_size: 1024,
        created_at: "2026-08-16T00:00:00Z",
      },
    });
    renderPanel({ source: "parasut", parasutCustomerId: "cust-1", localCustomerId: null });
    await waitFor(() => expect(fetchHistoryEntriesForCustomer).toHaveBeenCalled());
    fireEvent.click(screen.getByText("+ Geçmiş Teklif Ekle"));

    fireEvent.change(screen.getByLabelText(/Teklif Tarihi/), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText(/Konu \/ Açıklama/), { target: { value: "Eski teklif" } });
    fireEvent.change(screen.getByLabelText(/PDF Dosyası/), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByText("Kaydet"));

    await waitFor(() => expect(uploadQuoteHistoryFile).toHaveBeenCalledWith(expect.any(File), { source: "parasut", customerId: "cust-1" }));
    await waitFor(() => expect(addHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ filePath: "parasut/cust-1/abc-eski-teklif.pdf", fileName: "eski-teklif.pdf" })));
    await waitFor(() => expect(screen.getByText(/eski-teklif\.pdf/)).toBeInTheDocument());
  });

  it("cleans up the uploaded file when saving the history entry fails afterward", async () => {
    fetchHistoryEntriesForCustomer.mockResolvedValue({ ok: true, data: [] });
    uploadQuoteHistoryFile.mockResolvedValue({
      ok: true,
      data: { path: "parasut/cust-1/abc-x.pdf", name: "x.pdf", mime: "application/pdf", size: 500 },
    });
    addHistoryEntry.mockResolvedValue({ ok: false, message: "insert failed" });
    renderPanel({ source: "parasut", parasutCustomerId: "cust-1", localCustomerId: null });
    await waitFor(() => expect(fetchHistoryEntriesForCustomer).toHaveBeenCalled());
    fireEvent.click(screen.getByText("+ Geçmiş Teklif Ekle"));

    fireEvent.change(screen.getByLabelText(/Teklif Tarihi/), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText(/Konu \/ Açıklama/), { target: { value: "Eski teklif" } });
    fireEvent.change(screen.getByLabelText(/PDF Dosyası/), { target: { files: [pdfFile("x.pdf")] } });
    fireEvent.click(screen.getByText("Kaydet"));

    await waitFor(() => expect(deleteQuoteHistoryFile).toHaveBeenCalledWith("parasut/cust-1/abc-x.pdf"));
    await waitFor(() => expect(screen.getByText("insert failed")).toBeInTheDocument());
  });

  it("works for a local (non-Parasut) quote customer the same way", async () => {
    fetchHistoryEntriesForCustomer.mockResolvedValue({ ok: true, data: [] });
    renderPanel({ source: "local", parasutCustomerId: null, localCustomerId: "local-1" });
    await waitFor(() => expect(fetchHistoryEntriesForCustomer).toHaveBeenCalledWith("local", "local-1"));
  });
});

describe("QuoteHistoryPanel — PDF Görüntüle / İndir", () => {
  it("opens a short-lived signed URL, never a public URL, in a new tab", async () => {
    fetchHistoryEntriesForCustomer.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "h1",
          customer_source: "parasut",
          parasut_customer_id: "cust-1",
          local_customer_id: null,
          quote_no: "OLD-1",
          quote_date: "2025-01-01",
          amount: 1000,
          currency: "TRY",
          note: "Eski teklif",
          file_path: "parasut/cust-1/abc-eski-teklif.pdf",
          file_name: "eski-teklif.pdf",
          file_mime: "application/pdf",
          file_size: 1024,
          created_at: "2026-08-16T00:00:00Z",
        },
      ],
    });
    getQuoteHistoryFileUrl.mockResolvedValue({ ok: true, data: "https://signed.example/eski-teklif.pdf?token=abc" });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    renderPanel({ source: "parasut", parasutCustomerId: "cust-1", localCustomerId: null });
    await waitFor(() => expect(screen.getByText(/eski-teklif\.pdf/)).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("PDF Görüntüle / İndir"));
    await waitFor(() => expect(getQuoteHistoryFileUrl).toHaveBeenCalledWith("parasut/cust-1/abc-eski-teklif.pdf"));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith("https://signed.example/eski-teklif.pdf?token=abc", "_blank", "noopener,noreferrer"));
    openSpy.mockRestore();
  });
});
