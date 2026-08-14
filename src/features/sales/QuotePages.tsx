import { useEffect, useMemo, useState } from "react";
import {
  FileDown,
  Mail,
  MessageCircle,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { salesOrders, salesQuotes } from "./salesData";
import { SalesHeader, SalesStatus } from "./SalesShared";
import { customerName } from "./salesUtils";
import { calculateLineTotal, calculateQuoteTotals } from "./quoteCalculations";
import {
  createLocalCustomer,
  fetchLocalCustomer,
  fetchQuoteWithLines,
  generateQuoteNumber,
  saveQuote,
  updateQuoteStatus,
  type QuoteCustomerSnapshot,
} from "./quotesApi";
import { openQuotePdf } from "./pdf/quotePdfHtml";
import {
  emptyQuoteLine,
  QUOTE_DEFAULT_TERMS,
  QUOTE_ISSUERS,
  QUOTE_STATUS_LABELS,
  effectiveQuoteStatus,
  type QuoteIssuerKey,
  type QuoteLineDraft,
  type QuoteLineRow,
  type QuoteRow,
  type QuoteStatus,
} from "./quoteTypes";

const root = "/apps/sales";

function sourceText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

let lineIdCounter = 0;
function nextLineId() {
  lineIdCounter += 1;
  return `line-${Date.now()}-${lineIdCounter}`;
}

type QuoteCustomer = {
  source: "parasut" | "local";
  parasutId: string | null;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  taxNo: string;
};

function defaultValidUntil(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function QuoteFormPage({ quoteId }: { quoteId?: string }) {
  const editing = Boolean(quoteId);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const preselectedCustomerId = params.get("customerId");
  const preselectedLocalCustomerId = params.get("localCustomerId");

  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const [issuer, setIssuer] = useState<QuoteIssuerKey | "">("");
  const [quoteNo, setQuoteNo] = useState("");
  const [autoQuoteNoForIssuer, setAutoQuoteNoForIssuer] = useState<QuoteIssuerKey | null>(null);
  const [status, setStatus] = useState<QuoteStatus>("draft");

  const [selector, setSelector] = useState(false);
  const [customer, setCustomer] = useState<QuoteCustomer | null>(null);
  const [localCustomerId, setLocalCustomerId] = useState<string | null>(null);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    taxNo: "",
  });
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCustomers, setPickerCustomers] = useState<QuoteCustomer[]>([]);
  const [pickerLoaded, setPickerLoaded] = useState(false);

  const [subject, setSubject] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [lines, setLines] = useState<QuoteLineDraft[]>([emptyQuoteLine(nextLineId())]);
  const [issueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validityDays, setValidityDays] = useState(3);
  const [validUntil, setValidUntil] = useState(() => defaultValidUntil(3));
  const [paymentTerms, setPaymentTerms] = useState(QUOTE_DEFAULT_TERMS.paymentTerms);
  const [deliveryTime, setDeliveryTime] = useState(QUOTE_DEFAULT_TERMS.deliveryTime);
  const [deliveryTerms, setDeliveryTerms] = useState(QUOTE_DEFAULT_TERMS.deliveryTerms);
  const [notes, setNotes] = useState(QUOTE_DEFAULT_TERMS.notes);
  const [error, setError] = useState<string | null>(null);

  const duplicateOf = params.get("duplicateOf");

  // Load an existing quote when editing, or a source quote's contents when
  // duplicating (?duplicateOf=…) — duplication never carries over the id,
  // quote_no, or status, so saving always creates a brand-new quote row
  // with a freshly generated number.
  useEffect(() => {
    const sourceId = quoteId || duplicateOf;
    if (!sourceId) return;
    let cancelled = false;
    setLoading(true);
    fetchQuoteWithLines(sourceId).then((result) => {
      if (cancelled) return;
      if (result.ok === false) {
        setError(result.message);
        setLoading(false);
        return;
      }
      const { quote, lines: rows } = result.data;
      if (quoteId) {
        setExistingId(quote.id);
        setQuoteNo(quote.quote_no);
        setStatus(quote.status);
      }
      setIssuer(quote.issuer);
      setCustomer({
        source: quote.customer_source,
        parasutId: quote.parasut_customer_id,
        name: quote.customer_name,
        contact: quote.customer_contact ?? "",
        phone: quote.customer_phone ?? "",
        email: quote.customer_email ?? "",
        address: quote.customer_address ?? "",
        taxNo: quote.customer_tax_no ?? "",
      });
      setLocalCustomerId(quote.local_customer_id);
      setSubject(quote.subject);
      setCurrency(quote.currency);
      setValidUntil(quote.valid_until ?? "");
      setPaymentTerms(quote.payment_terms ?? "");
      setDeliveryTime(quote.delivery_time ?? "");
      setDeliveryTerms(quote.delivery_terms ?? "");
      setNotes(quote.notes ?? "");
      setLines(
        rows.length
          ? rows.map((row: QuoteLineRow) => ({
              id: nextLineId(),
              description: row.description,
              detail: row.detail ?? "",
              quantity: row.quantity,
              unit: row.unit,
              unitPrice: row.unit_price,
              discountPct: row.discount_pct,
              vatPct: row.vat_pct,
            }))
          : [emptyQuoteLine(nextLineId())],
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, duplicateOf]);

  // Preselect a real Parasut customer via ?customerId=… (from the customer detail page).
  useEffect(() => {
    if (!preselectedCustomerId || editing) return;
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", { body: { action: "detail", resource: "customers", parasutId: preselectedCustomerId } })
      .then(({ data, error: apiError }) => {
        if (cancelled) return;
        const response = data as { contact?: { attributes?: Record<string, unknown> | null } } | null;
        const attributes = response?.contact?.attributes;
        if (apiError || !attributes) return;
        setCustomer({
          source: "parasut",
          parasutId: preselectedCustomerId,
          name: sourceText(attributes.name),
          contact: "",
          phone: sourceText(attributes.phone),
          email: sourceText(attributes.email),
          address: [attributes.address, attributes.district, attributes.city].map(sourceText).filter(Boolean).join(", "),
          taxNo: sourceText(attributes.tax_number),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [preselectedCustomerId, editing]);

  // Preselect a local (non-Parasut) quote customer via ?localCustomerId=…
  // (from the local customer detail page).
  useEffect(() => {
    if (!preselectedLocalCustomerId || editing) return;
    let cancelled = false;
    fetchLocalCustomer(preselectedLocalCustomerId).then((result) => {
      if (cancelled || !result.ok) return;
      const row = result.data;
      setCustomer({
        source: "local",
        parasutId: null,
        name: row.company_name,
        contact: row.contact_name ?? "",
        phone: row.phone ?? "",
        email: row.email ?? "",
        address: row.address ?? "",
        taxNo: row.tax_no ?? "",
      });
      setLocalCustomerId(row.id);
    });
    return () => {
      cancelled = true;
    };
  }, [preselectedLocalCustomerId, editing]);

  useEffect(() => {
    if (!selector || newCustomerMode || pickerLoaded) return;
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", { body: { action: "list", resource: "customers", pageSize: 100, filters: { archived: false } } })
      .then(({ data, error: apiError }) => {
        if (cancelled) return;
        const response = data as { rows?: unknown } | null;
        if (apiError || !response || !Array.isArray(response.rows)) return;
        setPickerCustomers(
          (response.rows as { parasut_id?: unknown; attributes?: Record<string, unknown> | null }[])
            .map((row) => {
              const attributes = row.attributes ?? {};
              return {
                source: "parasut" as const,
                parasutId: sourceText(row.parasut_id),
                name: sourceText(attributes.name),
                contact: "",
                phone: sourceText(attributes.phone),
                email: sourceText(attributes.email),
                address: [attributes.address, attributes.district, attributes.city].map(sourceText).filter(Boolean).join(", "),
                taxNo: sourceText(attributes.tax_number),
              };
            })
            .filter((c) => c.parasutId && c.name),
        );
        setPickerLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selector, newCustomerMode, pickerLoaded]);

  const filteredPickerCustomers = pickerCustomers.filter((c) =>
    c.name.toLocaleLowerCase("tr-TR").includes(pickerSearch.trim().toLocaleLowerCase("tr-TR")),
  );

  // Suggest a real quote number the moment an issuer is chosen on a new
  // quote. Only replaces the field while it still holds the auto-suggested
  // value for the *previous* issuer — a manual edit is never clobbered.
  useEffect(() => {
    if (editing || !issuer) return;
    if (quoteNo && autoQuoteNoForIssuer !== null && autoQuoteNoForIssuer === issuer) return;
    if (quoteNo && autoQuoteNoForIssuer === null) return; // user has typed something manually
    let cancelled = false;
    generateQuoteNumber(issuer).then((result) => {
      if (cancelled || !result.ok) return;
      setQuoteNo(result.data);
      setAutoQuoteNoForIssuer(issuer);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuer, editing]);

  const totals = useMemo(() => calculateQuoteTotals(lines), [lines]);

  function updateLine(id: string, patch: Partial<QuoteLineDraft>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }
  function addLine() {
    setLines((current) => [...current, emptyQuoteLine(nextLineId())]);
  }
  function removeLine(id: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : current));
  }

  // Print/PDF preview from the still-unsaved form: builds an in-memory
  // QuoteRow/QuoteLineRow shape (never sent to saveQuote, never touches
  // Parasut) and reuses the same buildQuotePdfHtml the saved-quote detail
  // page uses, so the preview is pixel-identical to the eventual saved
  // output. window.open() happens synchronously inside this click handler
  // (openQuotePdf) — no async gap, so no popup blocker can intervene.
  function handlePreviewPrint() {
    if (!issuer) return toast({ title: "Eksik bilgi", description: "Önce teklif veren firmayı seçin.", variant: "destructive" });
    if (!customer) return toast({ title: "Eksik bilgi", description: "Önce müşteri seçin.", variant: "destructive" });
    if (!subject.trim()) return toast({ title: "Eksik bilgi", description: "Konu alanı zorunludur.", variant: "destructive" });
    if (!quoteNo.trim()) return toast({ title: "Eksik bilgi", description: "Teklif numarası zorunludur.", variant: "destructive" });
    const validLines = lines.filter((line) => line.description.trim() && line.quantity > 0);
    if (!validLines.length) {
      return toast({ title: "Eksik bilgi", description: "Önizleme için en az bir ürün/hizmet satırı girilmelidir.", variant: "destructive" });
    }

    const now = new Date().toISOString();
    const previewQuote: QuoteRow = {
      id: existingId ?? "preview",
      quote_no: quoteNo.trim(),
      issuer,
      status,
      currency: currency as QuoteRow["currency"],
      subject: subject.trim(),
      customer_source: customer.source,
      parasut_customer_id: customer.source === "parasut" ? customer.parasutId : null,
      local_customer_id: customer.source === "local" ? localCustomerId : null,
      customer_name: customer.name,
      customer_contact: customer.contact || null,
      customer_phone: customer.phone || null,
      customer_email: customer.email || null,
      customer_address: customer.address || null,
      customer_tax_no: customer.taxNo || null,
      issue_date: issueDate,
      valid_until: validUntil || null,
      payment_terms: paymentTerms || null,
      delivery_terms: deliveryTerms || null,
      delivery_time: deliveryTime || null,
      notes: notes || null,
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      vat_total: totals.vatTotal,
      grand_total: totals.grandTotal,
      converted_order_no: null,
      created_at: now,
      updated_at: now,
    };
    const previewLines: QuoteLineRow[] = validLines.map((line, index) => ({
      id: line.id,
      quote_id: previewQuote.id,
      position: index,
      description: line.description,
      detail: line.detail || null,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      discount_pct: line.discountPct,
      vat_pct: line.vatPct,
      line_total: calculateLineTotal(line),
    }));
    const opened = openQuotePdf(previewQuote, previewLines);
    if (!opened) {
      toast({
        title: "Popup engellendi",
        description: "Tarayıcınız açılır pencereyi engelledi. Lütfen bu site için popup iznini açıp tekrar deneyin.",
        variant: "destructive",
      });
    }
  }

  async function submitNewCustomer() {
    if (!newCustomerForm.companyName.trim()) {
      toast({ title: "Eksik bilgi", description: "Firma adı zorunlu.", variant: "destructive" });
      return;
    }
    try {
      const result = await createLocalCustomer(newCustomerForm);
      if (result.ok === false) {
        toast({ title: "Hata", description: result.message, variant: "destructive" });
        return;
      }
      const row = result.data;
      setCustomer({
        source: "local",
        parasutId: null,
        name: row.company_name,
        contact: row.contact_name ?? "",
        phone: row.phone ?? "",
        email: row.email ?? "",
        address: row.address ?? "",
        taxNo: row.tax_no ?? "",
      });
      setLocalCustomerId(row.id);
      setNewCustomerMode(false);
      setSelector(false);
    } catch (caught) {
      toast({
        title: "Hata",
        description: caught instanceof Error ? caught.message : "Müşteri kaydedilirken beklenmeyen bir hata oluştu.",
        variant: "destructive",
      });
    }
  }

  async function handleSave() {
    setError(null);
    if (!issuer) return setError("Teklif veren firma seçimi zorunludur.");
    if (!customer) return setError("Müşteri seçimi veya yeni müşteri girişi zorunludur.");
    if (!subject.trim()) return setError("Konu alanı zorunludur.");
    if (!quoteNo.trim()) return setError("Teklif numarası zorunludur.");
    const validLines = lines.filter((line) => line.description.trim() && line.quantity > 0);
    if (!validLines.length) return setError("En az bir ürün/hizmet satırı girilmelidir.");

    setSaving(true);
    // try/finally guarantees setSaving(false) runs even if saveQuote (or
    // anything it calls) throws instead of resolving with {ok:false} — a
    // previous version had no catch here, so an unexpected rejection left
    // the button stuck on "Kaydediliyor…" forever with no visible error.
    try {
      const customerSnapshot: QuoteCustomerSnapshot = {
        source: customer.source,
        parasutCustomerId: customer.source === "parasut" ? customer.parasutId : null,
        localCustomerId: customer.source === "local" ? localCustomerId : null,
        name: customer.name,
        contact: customer.contact,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        taxNo: customer.taxNo,
      };
      const result = await saveQuote({
        id: existingId ?? undefined,
        quoteNo: quoteNo.trim(),
        issuer,
        status,
        currency,
        subject: subject.trim(),
        customer: customerSnapshot,
        issueDate,
        validUntil: validUntil || null,
        paymentTerms,
        deliveryTerms,
        deliveryTime,
        notes,
        lines: validLines,
      });
      if (result.ok === false) {
        // Postgres reports a duplicate quote_no as a unique-violation
        // (error code 23505) — surfaced verbatim by default, which is not
        // understandable to a user; translate that one case to plain
        // Turkish instead.
        setError(
          /duplicate key|unique constraint|23505/i.test(result.message)
            ? `"${quoteNo.trim()}" numaralı bir teklif zaten var. Lütfen farklı bir teklif numarası girin.`
            : result.message,
        );
        return;
      }
      toast({ title: "Kaydedildi", description: `${result.data.quote_no} kaydedildi.` });
      navigate(`${root}/quotes/${result.data.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Teklif kaydedilirken beklenmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="sales-page">
        <SalesHeader section="Teklifler" current="Yükleniyor…" title="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="sales-page">
      <SalesHeader section="Teklifler" current={editing ? "Teklif Düzenle" : "Yeni Teklif"} title={editing ? "Teklif Düzenle" : "Yeni Teklif"}>
        <Link className="sales-back" to={editing ? `${root}/quotes/${existingId}` : `${root}/quotes`}>
          ← {editing ? "Teklife Dön" : "Tekliflere Dön"}
        </Link>
      </SalesHeader>
      {error && <div className="sales-form-error">{error}</div>}
      <form className="sales-form" onSubmit={(e) => e.preventDefault()}>
        <section className="erp-card">
          <h2>Teklif Veren Firma</h2>
          <div className="sales-fields">
            <label>
              Teklif Veren Firma *
              <select value={issuer} onChange={(e) => setIssuer(e.target.value as QuoteIssuerKey)}>
                <option value="">— Seçiniz —</option>
                <option value="dayan">{QUOTE_ISSUERS.dayan.legalName}</option>
                <option value="ceha">{QUOTE_ISSUERS.ceha.legalName}</option>
              </select>
            </label>
            <label>
              Teklif No *
              <input
                value={quoteNo}
                onChange={(e) => {
                  setQuoteNo(e.target.value);
                  setAutoQuoteNoForIssuer(null);
                }}
                placeholder={issuer ? `${QUOTE_ISSUERS[issuer].prefix}-YYYYAA-N` : "Firma seçin"}
              />
            </label>
            {editing && (
              <label>
                Durum
                <select value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)}>
                  {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((key) => (
                    <option key={key} value={key}>
                      {QUOTE_STATUS_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        <section className="erp-card">
          <h2>Müşteri Bilgileri</h2>
          <div className="sales-inline-actions">
            <button type="button" onClick={() => { setNewCustomerMode(false); setSelector(true); }}>
              Müşteri Seç
            </button>
            <button type="button" onClick={() => { setNewCustomerMode(true); setSelector(true); }}>
              Yeni Müşteri
            </button>
          </div>
          <div className="sales-fields">
            <label>
              Firma *<input readOnly value={customer?.name ?? ""} />
            </label>
            <label>
              İlgili Kişi
              <input readOnly value={customer?.contact ?? ""} />
            </label>
            <label>
              Telefon
              <input readOnly value={customer?.phone ?? ""} />
            </label>
            <label>
              E-posta
              <input readOnly value={customer?.email ?? ""} />
            </label>
            <label className="wide">
              Adres
              <input readOnly value={customer?.address ?? ""} />
            </label>
            <label className="wide">
              Konu *
              <input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="erp-card">
          <div className="sales-section-head">
            <h2>Ürün / Hizmet</h2>
            <div>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option>TRY</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
              <button type="button" onClick={addLine}>
                <Plus />
                Satır Ekle
              </button>
            </div>
          </div>
          <div className="quote-lines">
            <div className="quote-line head">
              {["#", "Ürün/Hizmet", "Detay", "Miktar", "Birim", "Birim Fiyat", "İskonto %", "KDV %", "Toplam", ""].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {lines.map((line, index) => (
              <div className="quote-line" key={line.id}>
                <span>{index + 1}</span>
                <input value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} placeholder="Ürün/Hizmet" />
                <input value={line.detail} onChange={(e) => updateLine(line.id, { detail: e.target.value })} placeholder="Teknik açıklama" />
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) || 0 })}
                />
                <input value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={line.discountPct}
                  onChange={(e) => updateLine(line.id, { discountPct: Number(e.target.value) || 0 })}
                />
                <input type="number" value={20} readOnly title="KDV oranı %20 sabittir" />
                <strong>{calculateLineTotal(line).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}</strong>
                <button type="button" onClick={() => removeLine(line.id)} aria-label="Satırı sil">
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          <div className="quote-totals">
            <p>
              <span>Ara Toplam</span>
              <b>{totals.subtotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}</b>
            </p>
            <p>
              <span>İskonto</span>
              <b>{totals.discountTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}</b>
            </p>
            <p>
              <span>KDV</span>
              <b>{totals.vatTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}</b>
            </p>
            <p className="grand">
              <span>Genel Toplam</span>
              <b>{totals.grandTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}</b>
            </p>
          </div>
        </section>

        <section className="erp-card">
          <h2>Teklif Koşulları</h2>
          <div className="sales-fields">
            <label>
              Geçerlilik Süresi (gün)
              <input
                type="number"
                min={1}
                value={validityDays}
                onChange={(e) => {
                  const days = Number(e.target.value) || 1;
                  setValidityDays(days);
                  setValidUntil(defaultValidUntil(days));
                }}
              />
            </label>
            <label>
              Teklif Geçerlilik Tarihi
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </label>
            <label>
              Ödeme Şekli
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </label>
            <label>
              Teslim Süresi
              <input value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} />
            </label>
            <label>
              Teslim Yeri
              <input value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} />
            </label>
            <label className="wide">
              Notlar
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
        </section>

        <footer className="quote-actions">
          <button type="button" onClick={handlePreviewPrint}>
            Yazdır / PDF Kaydet
          </button>
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor…" : editing ? "Kaydet" : "Taslak Kaydet"}
          </button>
        </footer>
      </form>

      {selector && (
        <div className="sales-modal" role="dialog" aria-modal="true">
          <div>
            <button className="close" onClick={() => setSelector(false)}>
              <X />
            </button>
            {newCustomerMode ? (
              <>
                <h2>Yeni Müşteri</h2>
                <small>Bu müşteri Paraşüt'e yazılmaz; yalnızca ERP'de yerel teklif müşterisi olarak saklanır.</small>
                <div className="sales-fields" style={{ marginTop: "10px" }}>
                  <label className="wide">
                    Firma Adı *
                    <input value={newCustomerForm.companyName} onChange={(e) => setNewCustomerForm((f) => ({ ...f, companyName: e.target.value }))} />
                  </label>
                  <label>
                    İlgili Kişi
                    <input value={newCustomerForm.contactName} onChange={(e) => setNewCustomerForm((f) => ({ ...f, contactName: e.target.value }))} />
                  </label>
                  <label>
                    Telefon
                    <input value={newCustomerForm.phone} onChange={(e) => setNewCustomerForm((f) => ({ ...f, phone: e.target.value }))} />
                  </label>
                  <label>
                    E-posta
                    <input value={newCustomerForm.email} onChange={(e) => setNewCustomerForm((f) => ({ ...f, email: e.target.value }))} />
                  </label>
                  <label>
                    Vergi No
                    <input value={newCustomerForm.taxNo} onChange={(e) => setNewCustomerForm((f) => ({ ...f, taxNo: e.target.value }))} />
                  </label>
                  <label className="wide">
                    Adres
                    <input value={newCustomerForm.address} onChange={(e) => setNewCustomerForm((f) => ({ ...f, address: e.target.value }))} />
                  </label>
                </div>
                <button type="button" onClick={submitNewCustomer} style={{ marginTop: "10px", width: "100%" }}>
                  Müşteriyi Kaydet ve Seç
                </button>
              </>
            ) : (
              <>
                <h2>Müşteri Seç</h2>
                <input value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Müşteri ara" />
                {filteredPickerCustomers.length ? (
                  <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0, maxHeight: "260px", overflowY: "auto" }}>
                    {filteredPickerCustomers.map((c) => (
                      <li key={c.parasutId}>
                        <button
                          type="button"
                          style={{ width: "100%", textAlign: "left", padding: "0.5rem", background: "none", border: 0, borderBottom: "1px solid #20364d", cursor: "pointer", font: "inherit", color: "inherit" }}
                          onClick={() => {
                            setCustomer(c);
                            setLocalCustomerId(null);
                            setSelector(false);
                          }}
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{pickerLoaded ? "Müşteri bulunamadı." : "Yükleniyor…"}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function QuoteDetailPage({ quoteId }: { quoteId?: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [lines, setLines] = useState<QuoteLineRow[]>([]);

  useEffect(() => {
    if (!quoteId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchQuoteWithLines(quoteId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setQuote(result.data.quote);
        setLines(result.data.lines);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  async function changeStatus(next: QuoteStatus) {
    if (!quote) return;
    const result = await updateQuoteStatus(quote.id, next);
    if (result.ok === false) {
      toast({ title: "Hata", description: result.message, variant: "destructive" });
      return;
    }
    setQuote({ ...quote, status: next });
    toast({ title: "Durum güncellendi", description: QUOTE_STATUS_LABELS[next] });
  }

  if (loading) {
    return (
      <div className="sales-page">
        <SalesHeader section="Teklifler" current="Yükleniyor…" title="Yükleniyor…" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="sales-page">
        <SalesHeader section="Teklifler" current="Teklif bulunamadı" title="Teklif bulunamadı" subtitle={`"${quoteId ?? ""}" kimlikli teklif kaydı bulunamadı.`}>
          <Link className="sales-back" to={`${root}/quotes`}>
            ← Tekliflere Dön
          </Link>
        </SalesHeader>
      </div>
    );
  }

  const issuer = QUOTE_ISSUERS[quote.issuer];
  const status = effectiveQuoteStatus(quote);
  const whatsappNumber = quote.customer_phone?.replace(/\D/g, "") ?? "";
  const whatsappText = encodeURIComponent(
    `Merhaba, ${quote.quote_no} numaralı teklifimiz hazır. Konu: ${quote.subject}. Toplam: ${quote.grand_total.toLocaleString("tr-TR")} ${quote.currency}. PDF'yi ekten indirebilirsiniz.`,
  );
  const mailtoHref = `mailto:${quote.customer_email ?? ""}?subject=${encodeURIComponent(`Teklif ${quote.quote_no}`)}&body=${encodeURIComponent(
    `Sayın ${quote.customer_name},\n\n${quote.quote_no} numaralı teklifimizi bilgilerinize sunarız. Konu: ${quote.subject}\nGenel Toplam: ${quote.grand_total.toLocaleString("tr-TR")} ${quote.currency}\n\nPDF dosyasını ayrıca indirip bu e-postaya ekleyebilirsiniz.\n\nSaygılarımızla,\n${issuer.legalName}`,
  )}`;

  const customerLink =
    quote.customer_source === "parasut" && quote.parasut_customer_id
      ? `/apps/crm/customers/${quote.parasut_customer_id}`
      : quote.local_customer_id
        ? `${root}/quote-customers/${quote.local_customer_id}`
        : null;

  return (
    <div className="sales-page">
      <SalesHeader section="Teklifler" current={quote.quote_no} title={quote.quote_no} subtitle={`${quote.customer_name} · ${quote.subject}`}>
        <SalesStatus>{QUOTE_STATUS_LABELS[status]}</SalesStatus>
        <Link className="sales-back" to={`${root}/quotes`}>
          ← Tekliflere Dön
        </Link>
        <button
          onClick={() => {
            if (!openQuotePdf(quote, lines)) {
              toast({
                title: "Popup engellendi",
                description: "Tarayıcınız açılır pencereyi engelledi. Lütfen bu site için popup iznini açıp tekrar deneyin.",
                variant: "destructive",
              });
            }
          }}
          title="Yazdırılabilir bir pencere açar; tarayıcının yazdırma penceresinden 'PDF olarak kaydet' seçilebilir."
        >
          <FileDown />
          Yazdır / PDF Kaydet
        </button>
        <a href={mailtoHref}>
          <Mail />
          Mail Gönder
        </a>
        <a href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle />
          WhatsApp ile Gönder
        </a>
        <Link className="sales-primary" to={`${root}/quotes/${quote.id}/edit`}>
          Düzenle
        </Link>
        <Link className="sales-primary" to={`${root}/quotes/new?duplicateOf=${quote.id}`}>
          Kopyala
        </Link>
        <Link className="sales-primary" to={`${root}/orders/new?sourceQuoteId=${quote.id}`}>
          <ShoppingCart />
          Siparişe Dönüştür
        </Link>
      </SalesHeader>

      <section className="sales-detail-grid">
        <article className="erp-card">
          <h2>Müşteri ve Teklif Bilgileri</h2>
          <p>
            <span>Müşteri</span>
            {customerLink ? (
              <Link className="sales-customer-link" to={customerLink}>
                {quote.customer_name}
              </Link>
            ) : (
              <b>{quote.customer_name}</b>
            )}
          </p>
          <p>
            <span>Teklif Veren</span>
            <b>{issuer.legalName}</b>
          </p>
          <p>
            <span>Oluşturulma</span>
            <b>{quote.issue_date}</b>
          </p>
          <p>
            <span>Geçerlilik</span>
            <b>{quote.valid_until ?? "—"}</b>
          </p>
          <p>
            <span>Para Birimi</span>
            <b>{quote.currency}</b>
          </p>
        </article>
        <article className="erp-card">
          <h2>Koşullar</h2>
          <p>
            <span>Ödeme</span>
            <b>{quote.payment_terms || "—"}</b>
          </p>
          <p>
            <span>Teslim Süresi</span>
            <b>{quote.delivery_time || "—"}</b>
          </p>
          <p>
            <span>Teslim Yeri</span>
            <b>{quote.delivery_terms || "—"}</b>
          </p>
          <p>
            <span>Durum</span>
            <select value={quote.status} onChange={(e) => changeStatus(e.target.value as QuoteStatus)}>
              {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((key) => (
                <option key={key} value={key}>
                  {QUOTE_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </p>
        </article>
      </section>

      <section className="erp-card sales-detail-lines">
        <h2>Teklif Satırları</h2>
        <table>
          <thead>
            <tr>
              <th>Ürün/Hizmet</th>
              <th>Miktar</th>
              <th>Birim Fiyat</th>
              <th>İskonto</th>
              <th>KDV</th>
              <th>Toplam</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td>
                  {line.quantity} {line.unit}
                </td>
                <td>
                  {line.unit_price.toLocaleString("tr-TR")} {quote.currency}
                </td>
                <td>%{line.discount_pct}</td>
                <td>%{line.vat_pct}</td>
                <td>
                  {line.line_total.toLocaleString("tr-TR")} {quote.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="quote-totals">
          <p>
            <span>Ara Toplam</span>
            <b>{quote.subtotal.toLocaleString("tr-TR")} {quote.currency}</b>
          </p>
          <p>
            <span>İskonto</span>
            <b>{quote.discount_total.toLocaleString("tr-TR")} {quote.currency}</b>
          </p>
          <p>
            <span>KDV</span>
            <b>{quote.vat_total.toLocaleString("tr-TR")} {quote.currency}</b>
          </p>
          <p className="grand">
            <span>Genel Toplam</span>
            <b>
              {quote.grand_total.toLocaleString("tr-TR")} {quote.currency}
            </b>
          </p>
        </div>
      </section>

      <section className="sales-detail-grid">
        <article className="erp-card">
          <h2>Notlar</h2>
          <p style={{ display: "block" }}>{quote.notes || "—"}</p>
        </article>
        <article className="erp-card sales-timeline">
          <h2>Aktivite Geçmişi</h2>
          <p>
            Oluşturuldu: {new Date(quote.created_at).toLocaleString("tr-TR")}
            {quote.updated_at !== quote.created_at && <> · Güncellendi: {new Date(quote.updated_at).toLocaleString("tr-TR")}</>}
          </p>
        </article>
      </section>
    </div>
  );
}

export function SalesOrderDetailPage({ orderId }: { orderId?: string }) {
  const o = salesOrders.find((x) => x.id === orderId);
  if (!o) {
    return (
      <div className="sales-page">
        <SalesHeader section="Siparişler" current="Sipariş bulunamadı" title="Sipariş bulunamadı" subtitle={`"${orderId}" kimlikli sipariş kaydı bulunamadı.`}>
          <Link className="sales-back" to={`${root}/orders`}>
            ← Siparişlere Dön
          </Link>
        </SalesHeader>
      </div>
    );
  }
  const sourceQuote = salesQuotes.find((q) => q.id === o.sourceQuoteId);
  return (
    <div className="sales-page">
      <SalesHeader
        section="Siparişler"
        current="Sipariş Detayı"
        title={o.no}
        subtitle={`${customerName(o.customerId)} · ${o.project}`}
      >
        <SalesStatus>{o.status}</SalesStatus>
        <Link className="sales-back" to={`${root}/orders`}>
          ← Siparişlere Dön
        </Link>
      </SalesHeader>
      <section className="sales-detail-grid">
        <article className="erp-card">
          <h2>Müşteri ve Sipariş Bilgileri</h2>
          <p>
            <span>Müşteri</span>
            <Link className="sales-customer-link" to={`/apps/crm/customers/${o.customerId}`}>
              {customerName(o.customerId)}
            </Link>
          </p>
          <p>
            <span>Proje</span>
            <b>{o.project}</b>
          </p>
          <p>
            <span>Sipariş Tarihi</span>
            <b>{o.orderDate}</b>
          </p>
          <p>
            <span>Termin Tarihi</span>
            <b>{o.dueDate}</b>
          </p>
          <p>
            <span>Toplam</span>
            <b>{o.total}</b>
          </p>
        </article>
        <article className="erp-card">
          <h2>Kaynak</h2>
          <p>
            <span>Kaynak Teklif</span>
            {sourceQuote ? (
              <Link className="sales-customer-link" to={`${root}/quotes/${sourceQuote.id}`}>
                {o.sourceQuoteNo}
              </Link>
            ) : (
              <b>—</b>
            )}
          </p>
        </article>
      </section>
    </div>
  );
}
export function SalesOrderFormPage() {
  const [params] = useSearchParams();
  const source = salesQuotes.find((q) => q.id === params.get("sourceQuoteId"));
  return (
    <div className="sales-page">
      <SalesHeader
        section="Siparişler"
        current="Yeni Sipariş"
        title="Yeni Sipariş"
      >
        <Link className="sales-back" to={`${root}/orders`}>
          ← Siparişlere Dön
        </Link>
      </SalesHeader>
      <form className="sales-form" onSubmit={(e) => e.preventDefault()}>
        <section className="erp-card">
          <h2>Sipariş Bilgileri</h2>
          <div className="sales-fields">
            <label>
              Müşteri
              <input
                defaultValue={source ? customerName(source.customerId) : ""}
                readOnly={!!source}
              />
            </label>
            <label>
              Kaynak Teklif
              <input value={source?.no ?? ""} readOnly />
            </label>
            <label>
              İlgili Kişi
              <input defaultValue={source?.contact ?? ""} readOnly={!!source} />
            </label>
            <label>
              Proje
              <input defaultValue={source?.project ?? ""} readOnly={!!source} />
            </label>
            <label>
              Sipariş Tarihi
              <input type="date" />
            </label>
            <label>
              Termin Tarihi
              <input type="date" />
            </label>
            <label>
              Para Birimi
              <input value={source?.currency ?? ""} readOnly />
            </label>
            <label className="wide">
              Notlar
              <textarea defaultValue={source?.notes} />
            </label>
            <label>
              Ödeme Koşulları
              <input defaultValue={source?.paymentTerms} />
            </label>
            <label>
              Teslim Koşulları
              <input defaultValue={source?.deliveryTerms} />
            </label>
          </div>
        </section>
        <section className="erp-card">
          <h2>Ürün / Hizmet Satırları</h2>
          {source?.lines.map((l) => (
            <p key={l.productServiceId}>
              {l.code} · {l.name} · {l.quantity} {l.unit} · {l.unitPrice}{" "}
              {source.currency}
            </p>
          )) ?? null}
        </section>
        <footer className="quote-actions">
          <button>Taslak Kaydet</button>
          <button>Sipariş Oluştur</button>
        </footer>
      </form>
    </div>
  );
}
