import { useMemo, useState } from "react";
import {
  FileDown,
  Mail,
  MessageCircle,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { crmCustomers } from "../crm-preview/crmCustomerData";
import { products } from "../finance-preview/operationsData";
import { salesQuotes } from "./salesData";
import { SalesHeader, SalesStatus } from "./SalesShared";
import { customerName, openQuotePreview, printQuote } from "./salesUtils";
import type { QuoteLine, SalesQuote } from "./salesTypes";
const root = "/apps/ebru-preview/sales";
const blankLine = (): QuoteLine => ({
  productServiceId: products[0].id,
  code: products[0].code,
  name: products[0].name,
  material: "42CrMo4",
  quantity: 1,
  unit: "Adet",
  unitPrice: products[0].sale,
  discount: 0,
  vat: 20,
});
export function QuoteFormPage() {
  const [customerId, setCustomerId] = useState(crmCustomers[0].id);
  const [selector, setSelector] = useState(false);
  const [lines, setLines] = useState<QuoteLine[]>([blankLine()]);
  const customer =
    crmCustomers.find((c) => c.id === customerId) ?? crmCustomers[0];
  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const discount = lines.reduce(
      (s, l) => s + (l.quantity * l.unitPrice * l.discount) / 100,
      0,
    );
    const vat = lines.reduce(
      (s, l) =>
        s + (l.quantity * l.unitPrice * (1 - l.discount / 100) * l.vat) / 100,
      0,
    );
    return { subtotal, discount, vat, grand: subtotal - discount + vat };
  }, [lines]);
  const draftQuote: SalesQuote = {
    id: "draft-quote",
    no: "TKL-YENİ",
    customerId,
    contactId: `${customerId}-contact`,
    contact: customer.contact,
    projectId: "draft-project",
    project: "Yeni Proje",
    subject: "Dişli üretim teklifi",
    currency: "TRY",
    created: new Intl.DateTimeFormat("tr-TR").format(new Date()),
    validUntil: "15 gün",
    status: "Taslak",
    lines,
    notes: "Teklif formundaki güncel notlar.",
    paymentTerms: "%40 avans, bakiye teslimde",
    deliveryTerms: customer.address,
  };
  const update = (
    index: number,
    key: keyof QuoteLine,
    value: string | number,
  ) =>
    setLines((items) =>
      items.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
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
      <details className="ebru-card sales-recent">
        <summary>Son Teklifler</summary>
        <span>TKL-2026-0092 · TKL-2026-0078</span>
      </details>
      <form className="sales-form" onSubmit={(e) => e.preventDefault()}>
        <section className="ebru-card">
          <h2>Müşteri Bilgileri</h2>
          <div className="sales-inline-actions">
            <button type="button" onClick={() => setSelector(true)}>
              Müşteri Seç
            </button>
            <Link to="/apps/ebru-preview/crm/customers/new?returnTo=/apps/ebru-preview/sales/quotes/new">
              Yeni Müşteri Oluştur
            </Link>
          </div>
          <div className="sales-fields">
            <label>
              Firma *<input value={customer.name} readOnly />
            </label>
            <label>
              İlgili Kişi *<input value={customer.contact} readOnly />
            </label>
            <label>
              Telefon
              <input value={customer.phone} readOnly />
            </label>
            <label>
              E-posta *<input value={customer.email} readOnly />
            </label>
            <label className="wide">
              Konu
              <input defaultValue="Dişli üretim teklifi" />
            </label>
          </div>
        </section>
        <section className="ebru-card">
          <div className="sales-section-head">
            <h2>Ürün / Hizmet</h2>
            <div>
              <select>
                <option>TRY</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
              <button
                type="button"
                onClick={() => setLines((i) => [...i, blankLine()])}
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
            {lines.map((l, i) => (
              <div className="quote-line" key={i}>
                <span>{i + 1}</span>
                <input value={l.code} readOnly />
                <select
                  value={l.productServiceId}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value)!;
                    setLines((items) =>
                      items.map((line, n) =>
                        n === i
                          ? {
                              ...line,
                              productServiceId: p.id,
                              code: p.code,
                              name: p.name,
                              unitPrice: p.sale,
                            }
                          : line,
                      ),
                    );
                  }}
                >
                  {products.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  value={l.material}
                  onChange={(e) => update(i, "material", e.target.value)}
                />
                <input
                  type="number"
                  value={l.quantity}
                  onChange={(e) =>
                    update(i, "quantity", Number(e.target.value))
                  }
                />
                <select
                  value={l.unit}
                  onChange={(e) => update(i, "unit", e.target.value)}
                >
                  <option>Adet</option>
                  <option>Saat</option>
                  <option>Kg</option>
                </select>
                <input
                  type="number"
                  value={l.unitPrice}
                  onChange={(e) =>
                    update(i, "unitPrice", Number(e.target.value))
                  }
                />
                <input
                  type="number"
                  value={l.discount}
                  onChange={(e) =>
                    update(i, "discount", Number(e.target.value))
                  }
                />
                <select
                  value={l.vat}
                  onChange={(e) => update(i, "vat", Number(e.target.value))}
                >
                  <option value="20">%20</option>
                  <option value="10">%10</option>
                </select>
                <strong>
                  {(
                    l.quantity *
                    l.unitPrice *
                    (1 - l.discount / 100) *
                    (1 + l.vat / 100)
                  ).toLocaleString("tr-TR")}
                </strong>
                <button
                  type="button"
                  onClick={() => setLines((x) => x.filter((_, n) => n !== i))}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          <div className="quote-totals">
            <p>
              <span>Ara Toplam</span>
              <b>{totals.subtotal.toLocaleString("tr-TR")} TRY</b>
            </p>
            <p>
              <span>İskonto</span>
              <b>-{totals.discount.toLocaleString("tr-TR")} TRY</b>
            </p>
            <p>
              <span>KDV</span>
              <b>{totals.vat.toLocaleString("tr-TR")} TRY</b>
            </p>
            <p className="grand">
              <span>Genel Toplam</span>
              <b>{totals.grand.toLocaleString("tr-TR")} TRY</b>
            </p>
          </div>
        </section>
        <section className="ebru-card">
          <h2>Ek Bilgiler</h2>
          <div className="sales-fields">
            <label className="wide">
              Notlar
              <textarea />
            </label>
            <label>
              Opsiyon Süresi
              <input defaultValue="15 gün" />
            </label>
            <label>
              Teklif Geçerlilik Tarihi
              <input type="date" />
            </label>
            <label>
              Öngörülen Teslim Süresi
              <input defaultValue="4 hafta" />
            </label>
            <label>
              Ödeme Şekli
              <input defaultValue="%40 avans" />
            </label>
            <label>
              Teslim Yeri
              <input defaultValue="Fabrika teslim" />
            </label>
            <label>
              Proje
              <input />
            </label>
            <label>
              Para Birimi
              <select>
                <option>TRY</option>
              </select>
            </label>
            <label>
              Teklif Dili
              <select>
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
          <button type="button" onClick={() => openQuotePreview(draftQuote)}>
            Önizle
          </button>
          <button type="button" onClick={() => printQuote(draftQuote)}>
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
            <input placeholder="Müşteri ara" />
            {crmCustomers.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCustomerId(c.id);
                  setSelector(false);
                }}
              >
                {c.name}
                <small>
                  {c.contact} · {c.phone}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export function QuoteDetailPage() {
  const { quoteId } = useParams();
  const q = salesQuotes.find((x) => x.id === quoteId) ?? salesQuotes[0];
  const subtotal = q.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
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
        <article className="ebru-card">
          <h2>Müşteri ve Teklif Bilgileri</h2>
          <p>
            <span>Müşteri</span>
            <Link
              className="sales-customer-link"
              to={`/apps/ebru-preview/crm/customers/${q.customerId}`}
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
        <article className="ebru-card">
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
            <b>{q.linkedOrderNo ?? "Henüz yok"}</b>
          </p>
        </article>
      </section>
      <section className="ebru-card sales-detail-lines">
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
              {(subtotal * 1.2).toLocaleString("tr-TR")} {q.currency}
            </b>
          </p>
        </div>
      </section>
      <section className="sales-detail-grid">
        <article className="ebru-card">
          <h2>Notlar</h2>
          <p>{q.notes}</p>
        </article>
        <article className="ebru-card sales-timeline">
          <h2>Aktivite Geçmişi</h2>
          <p>Teklif oluşturuldu · {q.created}</p>
          <p>Müşteriye gönderildi</p>
          <p>Son görüntüleme kaydedildi</p>
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
        <section className="ebru-card">
          <h2>Sipariş Bilgileri</h2>
          <div className="sales-fields">
            <label>
              Müşteri
              <input
                value={source ? customerName(source.customerId) : ""}
                readOnly={!!source}
              />
            </label>
            <label>
              Kaynak Teklif
              <input value={source?.no ?? "Manuel sipariş"} readOnly />
            </label>
            <label>
              İlgili Kişi
              <input value={source?.contact ?? ""} readOnly={!!source} />
            </label>
            <label>
              Proje
              <input value={source?.project ?? ""} readOnly={!!source} />
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
              <input value={source?.currency ?? "TRY"} readOnly />
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
        <section className="ebru-card">
          <h2>Ürün / Hizmet Satırları</h2>
          {source?.lines.map((l) => (
            <p key={l.productServiceId}>
              {l.code} · {l.name} · {l.quantity} {l.unit} · {l.unitPrice}{" "}
              {source.currency}
            </p>
          )) ?? <p>Manuel ürün satırı eklenebilir.</p>}
        </section>
        <footer className="quote-actions">
          <button>Taslak Kaydet</button>
          <button>Sipariş Oluştur</button>
        </footer>
      </form>
    </div>
  );
}
