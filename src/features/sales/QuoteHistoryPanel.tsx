import { useEffect, useState } from "react";
import { Eye, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  addHistoryEntry,
  deleteQuoteHistoryFile,
  fetchHistoryEntriesForCustomer,
  getQuoteHistoryFileUrl,
  QUOTE_HISTORY_FILE_MAX_BYTES,
  uploadQuoteHistoryFile,
} from "./quotesApi";
import type { QuoteCustomerSource, QuoteHistoryEntryRow } from "./quoteTypes";

function formatFileSize(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shared "Geçmiş Teklifler" (historical, pre-ERP quotes) panel — used on
 * both the Parasut customer detail page and the local quote-customer
 * detail page. Every entry requires an uploaded PDF (private Storage
 * bucket, short-lived signed URLs only — never a public URL). Never
 * writes to Parasut.
 */
export function QuoteHistoryPanel({
  source,
  parasutCustomerId,
  localCustomerId,
}: {
  source: QuoteCustomerSource;
  parasutCustomerId: string | null;
  localCustomerId: string | null;
}) {
  const { toast } = useToast();
  const customerId = source === "parasut" ? parasutCustomerId : localCustomerId;
  const [entries, setEntries] = useState<QuoteHistoryEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchHistoryEntriesForCustomer(source, customerId).then((result) => {
      if (cancelled) return;
      if (result.ok) setEntries(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [source, customerId]);

  async function handleOpenFile(entry: QuoteHistoryEntryRow) {
    if (!entry.file_path) return;
    setOpeningId(entry.id);
    const result = await getQuoteHistoryFileUrl(entry.file_path);
    setOpeningId(null);
    if (!result.ok) {
      toast({ title: "Hata", description: result.message, variant: "destructive" });
      return;
    }
    window.open(result.data, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="erp-card sales-detail-lines">
      <div className="sales-section-head">
        <h2>Geçmiş Teklifler</h2>
        <div>
          <button type="button" onClick={() => setModalOpen(true)} disabled={!customerId}>
            + Geçmiş Teklif Ekle
          </button>
        </div>
      </div>
      {!customerId ? (
        <p>Müşteri bilgisi yüklenemedi.</p>
      ) : loading ? (
        <p>Yükleniyor…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Teklif No</th>
              <th>Tarih</th>
              <th>Konu / Açıklama</th>
              <th>Tutar</th>
              <th>Dosya</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.quote_no || "—"}</td>
                <td>{entry.quote_date || "—"}</td>
                <td>{entry.note || "—"}</td>
                <td>{entry.amount != null ? `${entry.amount.toLocaleString("tr-TR")} ${entry.currency ?? ""}` : "—"}</td>
                <td>
                  {entry.file_name ? `${entry.file_name}${entry.file_size ? ` (${formatFileSize(entry.file_size)})` : ""}` : "—"}
                </td>
                <td>
                  {entry.file_path ? (
                    <button type="button" onClick={() => handleOpenFile(entry)} disabled={openingId === entry.id} title="PDF Görüntüle / İndir">
                      {openingId === entry.id ? <Loader2 className="expense-spin" /> : <Eye />}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && customerId && !entries.length && <p>Bu müşteriye ait eski/manuel teklif kaydı yok.</p>}

      {modalOpen && customerId && (
        <QuoteHistoryUploadModal
          source={source}
          customerId={customerId}
          parasutCustomerId={parasutCustomerId}
          localCustomerId={localCustomerId}
          onClose={() => setModalOpen(false)}
          onAdded={(entry) => {
            setEntries((current) => [entry, ...current]);
            setModalOpen(false);
          }}
        />
      )}
    </section>
  );
}

function QuoteHistoryUploadModal({
  source,
  customerId,
  parasutCustomerId,
  localCustomerId,
  onClose,
  onAdded,
}: {
  source: QuoteCustomerSource;
  customerId: string;
  parasutCustomerId: string | null;
  localCustomerId: string | null;
  onClose: () => void;
  onAdded: (entry: QuoteHistoryEntryRow) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ quoteNo: "", quoteDate: "", note: "", amount: "", currency: "TRY" });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    const looksLikePdf = picked.type === "application/pdf" || picked.name.toLocaleLowerCase("tr-TR").endsWith(".pdf");
    if (!looksLikePdf) {
      setFile(null);
      setError("Yalnızca .pdf dosyası yüklenebilir.");
      event.target.value = "";
      return;
    }
    if (picked.size > QUOTE_HISTORY_FILE_MAX_BYTES) {
      setFile(null);
      setError("Dosya boyutu 20 MB'ı aşamaz.");
      event.target.value = "";
      return;
    }
    setFile(picked);
  }

  async function submit() {
    setError(null);
    if (!form.quoteDate) return setError("Teklif tarihi zorunludur.");
    if (!form.note.trim()) return setError("Konu / açıklama zorunludur.");
    if (!file) return setError("PDF dosyası zorunludur.");

    setUploading(true);
    try {
      const uploadResult = await uploadQuoteHistoryFile(file, { source, customerId });
      if (!uploadResult.ok) {
        setError(uploadResult.message);
        return;
      }
      const result = await addHistoryEntry({
        source,
        parasutCustomerId,
        localCustomerId,
        quoteNo: form.quoteNo,
        quoteDate: form.quoteDate,
        amount: form.amount ? Number(form.amount) : null,
        currency: form.currency,
        note: form.note,
        filePath: uploadResult.data.path,
        fileName: uploadResult.data.name,
        fileMime: uploadResult.data.mime,
        fileSize: uploadResult.data.size,
      });
      if (!result.ok) {
        // Best-effort cleanup — never leave an orphaned file in storage
        // when the DB record it belongs to failed to save.
        await deleteQuoteHistoryFile(uploadResult.data.path);
        setError(result.message);
        return;
      }
      toast({ title: "Kaydedildi", description: "Geçmiş teklif PDF ile eklendi." });
      onAdded(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Beklenmeyen bir hata oluştu.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="sales-modal" role="dialog" aria-modal="true">
      <div>
        <button className="close" onClick={onClose} disabled={uploading}>
          <X />
        </button>
        <h2>Geçmiş Teklif Ekle</h2>
        <small>Paraşüt'e yazılmaz; yalnızca bu müşterinin ERP geçmişine, yüklediğiniz PDF ile birlikte eklenir.</small>
        {error && <div className="sales-form-error">{error}</div>}
        <div className="sales-fields" style={{ marginTop: "10px" }}>
          <label>
            Teklif No
            <input value={form.quoteNo} onChange={(e) => setForm((f) => ({ ...f, quoteNo: e.target.value }))} disabled={uploading} />
          </label>
          <label>
            Teklif Tarihi *
            <input type="date" value={form.quoteDate} onChange={(e) => setForm((f) => ({ ...f, quoteDate: e.target.value }))} disabled={uploading} />
          </label>
          <label>
            Para Birimi
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} disabled={uploading}>
              <option>TRY</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
          <label>
            Genel Toplam
            <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} disabled={uploading} />
          </label>
          <label className="wide">
            Konu / Açıklama *
            <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} disabled={uploading} />
          </label>
          <label className="wide">
            PDF Dosyası * (yalnızca .pdf, maksimum 20 MB)
            <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} disabled={uploading} />
          </label>
        </div>
        <button type="button" onClick={submit} disabled={uploading} style={{ marginTop: "10px", width: "100%" }}>
          {uploading ? "Yükleniyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
