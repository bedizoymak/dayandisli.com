import { useEffect, useState } from "react";
import {
  FileDown,
  Mail,
  MessageCircle,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { salesOrders, salesQuotes } from "./salesData";
import { SalesHeader, SalesStatus } from "./SalesShared";
import { customerName, openQuotePreview, printQuote } from "./salesUtils";
import type { QuoteLine, SalesQuote } from "./salesTypes";
const root = "/apps/sales";

function sourceText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type QuoteCustomer = { id: string; name: string; phone: string; email: string };

let lineSeq = 0;
function newLine(): QuoteLine {
  lineSeq += 1;
  return {
    productServiceId: `line-${Date.now()}-${lineSeq}`,
    code: "",
    name: "",
    material: "",
    quantity: 1,
    unit: "Adet",
    unitPrice: 0,
    discount: 0,
    vat: 20,
  };
}

export function QuoteFormPage() {
  const [selector, setSelector] = useState(false);
  const [params] = useSearchParams();
  const preselectedCustomerId = params.get("customerId");
  const [selectedCustomer, setSelectedCustomer] = useState<QuoteCustomer | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCustomers, setPickerCustomers] = useState<QuoteCustomer[]>([]);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  const [contactPerson, setContactPerson] = useState("");
  const [currency, setCurrency] = useState("TRY");
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [details, setDetails] = useState({
    subject: "",
    notes: "",
    optionValidity: "",
    validUntil: "",
    estimatedDelivery: "",
    paymentTerms: "",
    deliveryLocation: "",
    project: "",
  });

  useEffect(() => {
    if (!preselectedCustomerId) return;
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", {
        body: { action: "detail", resource: "customers", parasutId: preselectedCustomerId },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        const response = data as { contact?: { attributes?: Record<string, unknown> | null } } | null;
        const attributes = response?.contact?.attributes;
        if (error || !attributes) return;
        setSelectedCustomer({
          id: preselectedCustomerId,
          name: sourceText(attributes.name),
          phone: sourceText(attributes.phone),
          email: sourceText(attributes.email),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [preselectedCustomerId]);

  useEffect(() => {
    if (!selector || pickerLoaded) return;
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", {
        body: { action: "list", resource: "customers", pageSize: 100, filters: { archived: false } },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        const response = data as { rows?: unknown } | null;
        if (error || !response || !Array.isArray(response.rows)) return;
        setPickerCustomers(
          (response.rows as { parasut_id?: unknown; attributes?: Record<string, unknown> | null }[])
            .map((row) => ({
              id: sourceText(row.parasut_id),
              name: sourceText(row.attributes?.name),
              phone: sourceText(row.attributes?.phone),
              email: sourceText(row.attributes?.email),
            }))
            .filter((customer) => customer.id && customer.name),
        );
        setPickerLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selector, pickerLoaded]);

  const filteredPickerCustomers = pickerCustomers.filter((customer) =>
    customer.name.toLocaleLowerCase("tr-TR").includes(pickerSearch.toLocaleLowerCase("tr-TR")),
  );

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.productServiceId !== id));
  const updateLine = (id: string, patch: Partial<QuoteLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.productServiceId === id ? { ...l, ...patch } : l)),
    );

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discountTotal = lines.reduce(
    (s, l) => s + (l.quantity * l.unitPrice * l.discount) / 100,
    0,
  );
  const vatTotal = lines.reduce(
    (s, l) =>
      s + (l.quantity * l.unitPrice * (1 - l.discount / 100) * l.vat) / 100,
    0,
  );
  const grandTotal = subtotal - discountTotal + vatTotal;
  const money = (value: number) =>
    `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  const buildQuote = (): SalesQuote => {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    return {
      id: `draft-${stamp}`,
      no: `TKF-${stamp}`,
      customerId: selectedCustomer?.id ?? "",
      customerName: selectedCustomer?.name ?? "",
      customerPhone: selectedCustomer?.phone ?? "",
      customerEmail: selectedCustomer?.email ?? "",
      contactId: "",
      contact: contactPerson,
      projectId: "",
      project: details.project,
      subject: details.subject,
      currency,
      created: now.toLocaleDateString("tr-TR"),
      validUntil: details.validUntil,
      optionValidity: details.optionValidity,
      estimatedDelivery: details.estimatedDelivery,
      status: "Taslak",
      lines,
      notes: details.notes,
      paymentTerms: details.paymentTerms,
      deliveryTerms: details.deliveryLocation,
    };
  };

  return (
    <div className="sales-page">
      <SalesHeader
        section="Teklifler"
        current="Yeni Teklif"
        title="Yeni Teklif"
      >
        <Link className="sales-back" to={`${root}/quotes`}>
          ← Tekliflere Dön
        </Link>
      </SalesHeader>
      <details className="erp-card sales-recent">
        <summary>Son Teklifler</summary>
        <span>—</span>
      </details>
      <form className="sales-form" onSubmit={(e) => e.preventDefault()}>
        <section className="erp-card">
          <h2>Müşteri Bilgileri</h2>
          <div className="sales-inline-actions">
            <button type="button" onClick={() => setSelector(true)}>
              Müşteri Seç
            </button>
            <Link to="/apps/crm/customers/new?returnTo=/apps/sales/quotes/new">
              Yeni Müşteri Oluştur
            </Link>
          </div>
          <div className="sales-fields">
            <label>
              Firma *<input readOnly defaultValue={selectedCustomer?.name ?? ""} key={selectedCustomer?.name} />
            </label>
            <label>
              İlgili Kişi *
              <input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </label>
            <label>
              Telefon
              <input readOnly defaultValue={selectedCustomer?.phone ?? ""} key={`phone-${selectedCustomer?.phone}`} />
            </label>
            <label>
              E-posta *<input readOnly defaultValue={selectedCustomer?.email ?? ""} key={`email-${selectedCustomer?.email}`} />
            </label>
            <label className="wide">
              Konu
              <input
                value={details.subject}
                onChange={(e) => setDetails((d) => ({ ...d, subject: e.target.value }))}
              />
            </label>
          </div>
        </section>
        <section className="erp-card">
          <div className="sales-section-head">
            <h2>Ürün / Hizmet</h2>
            <div>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              <button type="button" onClick={addLine}>
                <Plus />
                Satır Ekle
              </button>
            </div>
          </div>
          <div className="quote-lines">
            <div className="quote-line head">
              {[
                "#",
                "Kod",
                "Ürün/Hizmet",
                "Malzeme",
                "Miktar",
                "Birim",
                "Birim Fiyat",
                "İskonto",
                "KDV",
                "Toplam",
                "",
              ].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {lines.map((line, i) => {
              const lineTotal =
                line.quantity *
                line.unitPrice *
                (1 - line.discount / 100) *
                (1 + line.vat / 100);
              return (
                <div className="quote-line" key={line.productServiceId}>
                  <span>{i + 1}</span>
                  <input
                    value={line.code}
                    onChange={(e) => updateLine(line.productServiceId, { code: e.target.value })}
                  />
                  <input
                    value={line.name}
                    placeholder="Ürün / hizmet adı"
                    onChange={(e) => updateLine(line.productServiceId, { name: e.target.value })}
                  />
                  <input
                    value={line.material}
                    onChange={(e) => updateLine(line.productServiceId, { material: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.productServiceId, { quantity: Number(e.target.value) || 0 })}
                  />
                  <input
                    value={line.unit}
                    onChange={(e) => updateLine(line.productServiceId, { unit: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.productServiceId, { unitPrice: Number(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={line.discount}
                    onChange={(e) => updateLine(line.productServiceId, { discount: Number(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={line.vat}
                    onChange={(e) => updateLine(line.productServiceId, { vat: Number(e.target.value) || 0 })}
                  />
                  <strong>{money(lineTotal)}</strong>
                  <button
                    type="button"
                    onClick={() => removeLine(line.productServiceId)}
                    aria-label="Satırı sil"
                  >
                    <X />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="quote-totals">
            <p>
              <span>Ara Toplam</span>
              <b>{money(subtotal)}</b>
            </p>
            <p>
              <span>İskonto</span>
              <b>{money(discountTotal)}</b>
            </p>
            <p>
              <span>KDV</span>
              <b>{money(vatTotal)}</b>
            </p>
            <p className="grand">
              <span>Genel Toplam</span>
              <b>{money(grandTotal)}</b>
            </p>
          </div>
        </section>
        <section className="erp-card">
          <h2>Ek Bilgiler</h2>
          <div className="sales-fields">
            <label className="wide">
              Notlar
              <textarea
                value={details.notes}
                onChange={(e) => setDetails((d) => ({ ...d, notes: e.target.value }))}
              />
            </label>
            <label>
              Opsiyon Süresi
              <input
                value={details.optionValidity}
                onChange={(e) => setDetails((d) => ({ ...d, optionValidity: e.target.value }))}
              />
            </label>
            <label>
              Teklif Geçerlilik Tarihi
              <input
                type="date"
                value={details.validUntil}
                onChange={(e) => setDetails((d) => ({ ...d, validUntil: e.target.value }))}
              />
            </label>
            <label>
              Öngörülen Teslim Süresi
              <input
                value={details.estimatedDelivery}
                onChange={(e) => setDetails((d) => ({ ...d, estimatedDelivery: e.target.value }))}
              />
            </label>
            <label>
              Ödeme Şekli
              <input
                value={details.paymentTerms}
                onChange={(e) => setDetails((d) => ({ ...d, paymentTerms: e.target.value }))}
              />
            </label>
            <label>
              Teslim Yeri
              <input
                value={details.deliveryLocation}
                onChange={(e) => setDetails((d) => ({ ...d, deliveryLocation: e.target.value }))}
              />
            </label>
            <label>
              Proje
              <input
                value={details.project}
                onChange={(e) => setDetails((d) => ({ ...d, project: e.target.value }))}
              />
            </label>
            <label>
              Para Birimi
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label>
              Teklif Dili
              <select>
                <option value="">—</option>
                <option>Türkçe</option>
                <option>İngilizce</option>
              </select>
            </label>
            <label>
              Etiketler
              <input />
            </label>
          </div>
        </section>
        <footer className="quote-actions">
          <button type="button">Taslak Kaydet</button>
          <button type="button" onClick={() => openQuotePreview(buildQuote())}>
            Önizle
          </button>
          <button type="button" onClick={() => printQuote(buildQuote())}>
            PDF İndir
          </button>
          <button type="button">Mail Gönder</button>
          <button type="button">WhatsApp ile Gönder</button>
        </footer>
      </form>
      {selector && (
        <div className="sales-modal" role="dialog" aria-modal="true">
          <div>
            <button className="close" onClick={() => setSelector(false)}>
              <X />
            </button>
            <h2>Müşteri Seç</h2>
            <input
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
              placeholder="Müşteri ara"
            />
            {filteredPickerCustomers.length ? (
              <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0, maxHeight: "260px", overflowY: "auto" }}>
                {filteredPickerCustomers.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.5rem",
                        background: "none",
                        border: 0,
                        borderBottom: "1px solid var(--border, #e2e8f0)",
                        cursor: "pointer",
                        font: "inherit",
                        color: "inherit",
                      }}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setSelector(false);
                      }}
                    >
                      {customer.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{pickerLoaded ? "Müşteri bulunamadı." : "Yükleniyor…"}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export function QuoteDetailPage({ quoteId }: { quoteId?: string }) {
  const q = salesQuotes.find((x) => x.id === quoteId);
  if (!q) {
    return (
      <div className="sales-page">
        <SalesHeader section="Teklifler" current="Teklif bulunamadı" title="Teklif bulunamadı" subtitle={`"${quoteId}" kimlikli teklif kaydı bulunamadı.`}>
          <Link className="sales-back" to={`${root}/quotes`}>
            ← Tekliflere Dön
          </Link>
        </SalesHeader>
      </div>
    );
  }
  const grandTotal = q.lines.reduce(
    (sum, line) =>
      sum +
      line.quantity *
        line.unitPrice *
        (1 - line.discount / 100) *
        (1 + line.vat / 100),
    0,
  );
  return (
    <div className="sales-page">
      <SalesHeader
        section="Teklifler"
        current="Teklif Detayı"
        title={q.no}
        subtitle={`${customerName(q.customerId)} · ${q.subject}`}
      >
        <SalesStatus>{q.status}</SalesStatus>
        <Link className="sales-back" to={`${root}/quotes`}>
          ← Tekliflere Dön
        </Link>
        <button onClick={() => printQuote(q)}>
          <FileDown />
          PDF İndir
        </button>
        <button>
          <Mail />
          Mail Gönder
        </button>
        <button>
          <MessageCircle />
          WhatsApp ile Gönder
        </button>
        <Link
          className="sales-primary"
          to={`${root}/orders/new?sourceQuoteId=${q.id}`}
        >
          <ShoppingCart />
          Siparişe Dönüştür
        </Link>
      </SalesHeader>
      <section className="sales-detail-grid">
        <article className="erp-card">
          <h2>Müşteri ve Teklif Bilgileri</h2>
          <p>
            <span>Müşteri</span>
            <Link
              className="sales-customer-link"
              to={`/apps/crm/customers/${q.customerId}`}
            >
              {customerName(q.customerId)}
            </Link>
          </p>
          <p>
            <span>İlgili Kişi</span>
            <b>{q.contact}</b>
          </p>
          <p>
            <span>Proje</span>
            <b>{q.project}</b>
          </p>
          <p>
            <span>Oluşturulma</span>
            <b>{q.created}</b>
          </p>
          <p>
            <span>Geçerlilik</span>
            <b>{q.validUntil}</b>
          </p>
        </article>
        <article className="erp-card">
          <h2>Koşullar</h2>
          <p>
            <span>Ödeme</span>
            <b>{q.paymentTerms}</b>
          </p>
          <p>
            <span>Teslim</span>
            <b>{q.deliveryTerms}</b>
          </p>
          <p>
            <span>Kaynak Sipariş</span>
            <b>{q.linkedOrderNo ?? "—"}</b>
          </p>
        </article>
      </section>
      <section className="erp-card sales-detail-lines">
        <h2>Teklif Satırları</h2>
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Ürün/Hizmet</th>
              <th>Miktar</th>
              <th>Birim Fiyat</th>
              <th>KDV</th>
              <th>Toplam</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l) => (
              <tr key={l.productServiceId}>
                <td>{l.code}</td>
                <td>{l.name}</td>
                <td>
                  {l.quantity} {l.unit}
                </td>
                <td>
                  {l.unitPrice.toLocaleString("tr-TR")} {q.currency}
                </td>
                <td>%{l.vat}</td>
                <td>
                  {(
                    l.quantity *
                    l.unitPrice *
                    (1 + l.vat / 100)
                  ).toLocaleString("tr-TR")}{" "}
                  {q.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="quote-totals">
          <p className="grand">
            <span>Genel Toplam</span>
            <b>
              {grandTotal.toLocaleString("tr-TR")} {q.currency}
            </b>
          </p>
        </div>
      </section>
      <section className="sales-detail-grid">
        <article className="erp-card">
          <h2>Notlar</h2>
          <p>{q.notes}</p>
        </article>
        <article className="erp-card sales-timeline">
          <h2>Aktivite Geçmişi</h2>
          <p>Henüz aktivite kaydı yok.</p>
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
      {sourceQuote && (
        <section className="erp-card sales-detail-lines">
          <h2>Ürün / Hizmet Satırları</h2>
          <table>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Ürün/Hizmet</th>
                <th>Miktar</th>
                <th>Birim Fiyat</th>
                <th>KDV</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {sourceQuote.lines.map((l) => (
                <tr key={l.productServiceId}>
                  <td>{l.code}</td>
                  <td>{l.name}</td>
                  <td>
                    {l.quantity} {l.unit}
                  </td>
                  <td>
                    {l.unitPrice.toLocaleString("tr-TR")} {sourceQuote.currency}
                  </td>
                  <td>%{l.vat}</td>
                  <td>
                    {(l.quantity * l.unitPrice * (1 + l.vat / 100)).toLocaleString("tr-TR")} {sourceQuote.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
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
