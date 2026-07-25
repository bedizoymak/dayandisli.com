import type { QuotePdfDocument } from "./quotePdfTypes";
import "./QuoteDocument.css";
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
export function QuoteDocument({ document }: { document: QuotePdfDocument }) {
  return (
    <main className="quote-pdf-document">
      <header className="quote-pdf-header">
        <div className="quote-pdf-brand">
          <div className="quote-pdf-logo">
            <img
              src={`${import.meta.env.BASE_URL}logo-header.png`}
              alt="Dayan Dişli"
            />
          </div>
          <div>
            <p className="quote-pdf-kicker">DAYAN DİŞLİ</p>
            <h1>TEKLİF FORMU</h1>
            <p>Dişli imalatı · Azdırma · Taşlama · Özel üretim</p>
          </div>
        </div>
        <div className="quote-pdf-meta">
          {[
            ["Teklif No", document.quoteNo],
            ["Teklif Tarihi", document.quoteDate],
            ["Geçerlilik", document.validity],
            ["Para Birimi", document.currency],
          ].map((x) => (
            <div key={x[0]}>
              <span>{x[0]}</span>
              <strong>{x[1]}</strong>
            </div>
          ))}
        </div>
      </header>
      <section className="quote-pdf-parties">
        <Party title="TEKLİF VEREN" party={document.issuer} />
        <Party title="MÜŞTERİ" party={document.customer} customer />
      </section>
      <section className="quote-pdf-subject">
        <div>
          <p className="quote-pdf-kicker">TEKLİF KONUSU</p>
          <h2>{document.subject}</h2>
        </div>
        <p>
          {document.project} kapsamında talebiniz doğrultusunda aşağıdaki ürün
          ve hizmetler için fiyat teklifimizi bilgilerinize sunarız.
        </p>
      </section>
      <section className="quote-pdf-table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Kod</th>
              <th>Ürün / Hizmet</th>
              <th>Malzeme</th>
              <th>Miktar</th>
              <th>Birim</th>
              <th>Birim Fiyat</th>
              <th>İsk.</th>
              <th>KDV</th>
              <th>Toplam</th>
            </tr>
          </thead>
          <tbody>
            {document.lines.map((line, i) => (
              <tr key={`${line.code}-${i}`}>
                <td>{i + 1}</td>
                <td>{line.code}</td>
                <td>
                  <strong>{line.name}</strong>
                  <span>{line.description}</span>
                </td>
                <td>{line.material}</td>
                <td>{line.quantity}</td>
                <td>{line.unit}</td>
                <td>{money(line.unitPrice, document.currency)}</td>
                <td>%{line.discount}</td>
                <td>%{line.vat}</td>
                <td>{money(line.total, document.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="quote-pdf-summary">
        <article className="quote-pdf-terms">
          <p className="quote-pdf-kicker">TİCARİ ŞARTLAR</p>
          <ul>
            <li>
              <span>Öngörülen teslim süresi</span>
              <strong>{document.estimatedDelivery}</strong>
            </li>
            <li>
              <span>Ödeme şekli</span>
              <strong>{document.paymentTerms}</strong>
            </li>
            <li>
              <span>Opsiyon süresi</span>
              <strong>{document.validity}</strong>
            </li>
            <li>
              <span>Teslim yeri</span>
              <strong>{document.deliveryLocation}</strong>
            </li>
          </ul>
        </article>
        <article className="quote-pdf-totals">
          <div>
            <span>Ara Toplam</span>
            <strong>{money(document.subtotal, document.currency)}</strong>
          </div>
          <div>
            <span>İskonto</span>
            <strong>-{money(document.discount, document.currency)}</strong>
          </div>
          <div>
            <span>KDV</span>
            <strong>{money(document.vat, document.currency)}</strong>
          </div>
          <div className="grand">
            <span>Genel Toplam</span>
            <strong>{money(document.grandTotal, document.currency)}</strong>
          </div>
        </article>
      </section>
      <section className="quote-pdf-notes">
        <p className="quote-pdf-kicker">NOTLAR</p>
        <p>{document.notes}</p>
      </section>
      <section className="quote-pdf-signatures">
        <div>
          <span>Teklifi Hazırlayan</span>
          <strong>{document.preparedBy}</strong>
          <p>İmza / Kaşe</p>
        </div>
        <div>
          <span>Müşteri Onayı</span>
          <strong>{document.customer.name}</strong>
          <p>Ad Soyad / İmza / Tarih</p>
        </div>
      </section>
      <footer className="quote-pdf-footer">
        <div>
          <strong>{document.issuer.name}</strong>
          <span>
            {document.issuer.website} · {document.issuer.email}
          </span>
        </div>
        <div>
          <span>Bu teklif elektronik ortamda oluşturulmuştur.</span>
          <strong>Sayfa</strong>
        </div>
      </footer>
    </main>
  );
}
function Party({
  title,
  party,
  customer = false,
}: {
  title: string;
  party: QuotePdfDocument["customer"];
  customer?: boolean;
}) {
  return (
    <article className={`quote-pdf-party${customer ? " customer" : ""}`}>
      <p className="quote-pdf-kicker">{title}</p>
      <h2>{party.name}</h2>
      <dl>
        <div>
          <dt>Yetkili</dt>
          <dd>{party.contact}</dd>
        </div>
        <div>
          <dt>Telefon</dt>
          <dd>{party.phone}</dd>
        </div>
        <div>
          <dt>E-posta</dt>
          <dd>{party.email}</dd>
        </div>
        <div>
          <dt>Adres</dt>
          <dd>{party.address}</dd>
        </div>
        <div>
          <dt>Vergi / VKN</dt>
          <dd>{party.taxNo}</dd>
        </div>
      </dl>
    </article>
  );
}
