import { useState, type CSSProperties } from "react";
import {
  Download,
  Eye,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  crmCustomers,
  customerInvoiceRefs,
  officialAccountSummary,
  officialCollectionMovements,
  unofficialAccountSummary,
  unofficialCollectionMovements,
} from "./crmCustomerData";
import { CrmPageHeader, StatusBadge } from "./CrmShared";
import { salesQuotes } from "../sales-preview/salesData";
import { printQuote } from "../sales-preview/salesUtils";
const parent = "/apps/ebru-preview/crm/customers";
export function CustomerDetailPage() {
  const { customerId } = useParams();
  const [account, setAccount] = useState<"official" | "unofficial">("official");
  const customer =
    crmCustomers.find((c) => c.id === customerId) ?? crmCustomers[0];
  const summary =
    account === "official" ? officialAccountSummary : unofficialAccountSummary;
  const movements =
    account === "official"
      ? officialCollectionMovements
      : unofficialCollectionMovements;
  const customerQuotes = salesQuotes.filter(
    (quote) => quote.customerId === customer.id,
  );
  const donutStyle = {
    "--paid": `${summary.shares[0]}%`,
    "--overdue": `${summary.shares[0] + summary.shares[1]}%`,
  } as CSSProperties;
  return (
    <div className="crm-page">
      <CrmPageHeader
        current="Müşteri Detayı"
        title={customer.name}
        subtitle={`${customer.type} · ${customer.projects.length} bağlı proje`}
      >
        <Link className="crm-back" to={parent}>
          ← Müşterilere Dön
        </Link>
        <a
          className="crm-whatsapp"
          href={`https://wa.me/${(customer.whatsapp ?? customer.phone).replace(/\D/g, "")}`}
        >
          <MessageCircle />
          WhatsApp
        </a>
        <Link className="crm-primary" to={`${parent}/${customer.id}/edit`}>
          <Pencil />
          Düzenle
        </Link>
      </CrmPageHeader>
      <article className="ebru-card crm-info-card">
        <div className="crm-large-avatar">
          <UserRound />
        </div>
        <div>
          <span>
            <Phone />
            {customer.phone}
          </span>
          <span>
            <Mail />
            {customer.email}
          </span>
          <span>TC/Vergi No: {customer.taxNo}</span>
          <span>İlgili kişi: {customer.contact}</span>
          <span>
            <MapPin />
            {customer.address}
          </span>
          <span>Projeler: {customer.projects.join(", ")}</span>
        </div>
      </article>
      <div className="crm-tabs">
        <button
          className={account === "official" ? "active" : ""}
          onClick={() => setAccount("official")}
        >
          Resmi Hesap
        </button>
        <button
          className={account === "unofficial" ? "active" : ""}
          onClick={() => setAccount("unofficial")}
        >
          Gayri Resmi Hesap
        </button>
      </div>
      <section className="crm-kpis detail">
        {[
          ["Toplam Alacak", summary.planned],
          ["Tahsil Edilen", summary.collected],
          ["Müşteri Bakiyesi", summary.balance],
          ["Vadesi Geçen Tutar", summary.overdue],
          ["Yaklaşan Ödeme", summary.upcoming],
        ].map((item) => (
          <article className="ebru-card" key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[1]}</strong>
          </article>
        ))}
      </section>
      <div className="crm-distribution">
        <i className="paid" style={{ flex: summary.shares[0] }} />
        <i className="overdue" style={{ flex: summary.shares[1] }} />
        <i className="upcoming" style={{ flex: summary.shares[2] }} />
      </div>
      <div className="crm-legend">
        <span>Tahsil Edilen</span>
        <span>Vadesi Geçen</span>
        <span>Ödenecek / Yaklaşan</span>
      </div>
      <section className="crm-account">
        <div className="crm-detail-grid">
          <div>
            <h2>Tahsilat Hareketleri</h2>
            <div className="ebru-card crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    {[
                      "Tarih",
                      "Başlık",
                      "Planlanan",
                      "Ödenen",
                      "Durum",
                      "Proje",
                      "İşlemler",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.title}>
                      <td>{m.date}</td>
                      <td>{m.title}</td>
                      <td>{m.planned}</td>
                      <td>{m.paid}</td>
                      <td>
                        <StatusBadge>{m.status}</StatusBadge>
                      </td>
                      <td>{m.project}</td>
                      <td>
                        <button>
                          <Eye />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <article className="ebru-card crm-payment-chart">
            <h2>Genel Ödeme Durumu</h2>
            <div className={`crm-donut ${account}`} style={donutStyle}>
              <strong>{summary.collected}</strong>
              <small>Tahsil Edilen</small>
            </div>
            <p>
              <span>Tahsil Edilen</span>
              <b>{summary.collected}</b>
            </p>
            <p>
              <span>Vadesi Geçen</span>
              <b>{summary.overdue}</b>
            </p>
            <p>
              <span>Yaklaşan Ödeme</span>
              <b>{summary.upcoming}</b>
            </p>
          </article>
        </div>
      </section>
      {account === "official" && <InvoiceHistory />}
      <QuoteHistory quotes={customerQuotes} />
    </div>
  );
}
function QuoteHistory({ quotes }: { quotes: typeof salesQuotes }) {
  return (
    <section className="crm-history">
      <h2>Teklif Geçmişi</h2>
      <div className="ebru-card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {[
                "Teklif No",
                "Tarih",
                "Proje",
                "Toplam",
                "Durum",
                "İşlemler",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td>{q.no}</td>
                <td>{q.created}</td>
                <td>{q.project}</td>
                <td>
                  {q.lines
                    .reduce(
                      (sum, line) =>
                        sum +
                        line.quantity *
                          line.unitPrice *
                          (1 - line.discount / 100) *
                          (1 + line.vat / 100),
                      0,
                    )
                    .toLocaleString("tr-TR")}{" "}
                  {q.currency}
                </td>
                <td>
                  <StatusBadge>{q.status}</StatusBadge>
                </td>
                <td>
                  <Link
                    title="Görüntüle"
                    to={`/apps/ebru-preview/sales/quotes/${q.id}`}
                  >
                    <Eye />
                  </Link>
                  <button title="PDF İndir" onClick={() => printQuote(q)}>
                    <Download />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!quotes.length && (
          <div className="crm-empty">Bu müşteriye ait teklif bulunamadı.</div>
        )}
      </div>
    </section>
  );
}
function InvoiceHistory() {
  return (
    <section className="crm-history">
      <h2>Fatura Geçmişi</h2>
      <div className="ebru-card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {[
                "Belge Türü",
                "Belge No",
                "Tarih",
                "Vade Tarihi",
                "Tutar",
                "Durum",
                "İşlemler",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customerInvoiceRefs.map((r) => (
              <tr key={r.no}>
                <td>{r.type}</td>
                <td>{r.no}</td>
                <td>{r.date}</td>
                <td>{r.due}</td>
                <td>{r.amount}</td>
                <td>
                  <StatusBadge>{r.status}</StatusBadge>
                </td>
                <td>
                  <button title="Görüntüle">
                    <Eye />
                  </button>
                  <button title="İndir">
                    <Download />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
