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
import { customerName, printQuote } from "./salesUtils";
const root = "/apps/sales";

function sourceText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type QuoteCustomer = { id: string; name: string; phone: string; email: string };

export function QuoteFormPage() {
  const [selector, setSelector] = useState(false);
  const [params] = useSearchParams();
  const preselectedCustomerId = params.get("customerId");
  const [selectedCustomer, setSelectedCustomer] = useState<QuoteCustomer | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCustomers, setPickerCustomers] = useState<QuoteCustomer[]>([]);
  const [pickerLoaded, setPickerLoaded] = useState(false);

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
              İlgili Kişi *<input readOnly />
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
              <input />
            </label>
          </div>
        </section>
        <section className="erp-card">
          <div className="sales-section-head">
            <h2>Ürün / Hizmet</h2>
            <div>
              <select>
                <option value="">—</option>
                <option>TRY</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
              <button
                type="button"
                disabled
              >
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
          </div>
          <div className="quote-totals">
            <p>
              <span>Ara Toplam</span>
              <b>—</b>
            </p>
            <p>
              <span>İskonto</span>
              <b>—</b>
            </p>
            <p>
              <span>KDV</span>
              <b>—</b>
            </p>
            <p className="grand">
              <span>Genel Toplam</span>
              <b>—</b>
            </p>
          </div>
        </section>
        <section className="erp-card">
          <h2>Ek Bilgiler</h2>
          <div className="sales-fields">
            <label className="wide">
              Notlar
              <textarea />
            </label>
            <label>
              Opsiyon Süresi
              <input />
            </label>
            <label>
              Teklif Geçerlilik Tarihi
              <input type="date" />
            </label>
            <label>
              Öngörülen Teslim Süresi
              <input />
            </label>
            <label>
              Ödeme Şekli
              <input />
            </label>
            <label>
              Teslim Yeri
              <input />
            </label>
            <label>
              Proje
              <input />
            </label>
            <label>
              Para Birimi
              <select>
                <option value="">—</option>
                <option>TRY</option>
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
          <button type="button" disabled>
            Önizle
          </button>
          <button type="button" disabled>
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
