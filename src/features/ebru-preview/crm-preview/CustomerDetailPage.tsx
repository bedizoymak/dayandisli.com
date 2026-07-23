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
import { CrmPageHeader, StatusBadge } from "./CrmShared";
import type { CustomerAccountType } from "../shared/collectionTypes";
import { useParasutContactDetail } from "@/features/erp/parasut/api/queries";
import { formatParasutCurrency, formatParasutDate } from "@/features/erp/parasut/utils/format";
import type { CollectionMovement, CrmCustomer, CustomerInvoiceRef } from "./crmCustomerTypes";
const parent = "/apps/crm/customers";
export function CustomerDetailPage() {
  const { customerId } = useParams();
  const detail = useParasutContactDetail("customers", customerId);
  const [account, setAccount] = useState<CustomerAccountType>("official");
  const attributes = detail.data?.contact.attributes;
  const customer: CrmCustomer = {
    id: detail.data?.contact.parasut_id ?? customerId ?? "",
    name: attributes?.name ?? "Müşteri",
    type: attributes?.contact_type === "person" ? "Gerçek Kişi" : "Tüzel Kişi",
    taxNo: attributes?.tax_number ?? "—",
    phone: attributes?.phone ?? "—",
    email: attributes?.email ?? "—",
    projects: [],
    planned: formatParasutCurrency(attributes?.trl_balance, "TRY"),
    collected: "₺0",
    balance: formatParasutCurrency(attributes?.trl_balance, "TRY"),
    contact: attributes?.short_name ?? "—",
    address: [attributes?.address, attributes?.district, attributes?.city].filter(Boolean).join(", ") || "—",
  };
  const baseSummary = {
    planned: formatParasutCurrency(attributes?.trl_balance, "TRY"),
    collected: "₺0",
    balance: formatParasutCurrency(attributes?.trl_balance, "TRY"),
    overdue: "₺0",
    upcoming: "₺0",
    shares: [0, 0, 100] as [number, number, number],
  };
  const summary = baseSummary;
  const legacyMovements: CollectionMovement[] = [];
  const movements = legacyMovements;
  const customerInvoices: CustomerInvoiceRef[] = (detail.data?.recentDocuments ?? []).map((document) => ({
    type: "Fatura",
    no: document.attributes.invoice_no ?? document.parasut_id,
    date: formatParasutDate(document.attributes.issue_date),
    due: formatParasutDate(document.attributes.due_date),
    amount: formatParasutCurrency(document.attributes.gross_total, document.attributes.currency),
    status: document.attributes.payment_status ?? "—",
  }));
  const donutStyle = {
    "--paid": `${summary.shares[0]}%`,
    "--overdue": `${summary.shares[0] + summary.shares[1]}%`,
  } as CSSProperties;
  if (detail.isLoading) return <div className="crm-page"><div className="ebru-card crm-empty">Müşteri bilgileri yükleniyor…</div></div>;
  if (detail.isError || !detail.data) return <div className="crm-page"><div className="ebru-card crm-empty">Müşteri bilgileri yüklenemedi.</div></div>;
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
                  {movements.map((movement) => (
                    <tr key={movement.title}>
                      <td>{movement.date}</td>
                      <td>{movement.title}</td>
                      <td>{movement.planned}</td>
                      <td>{movement.paid}</td>
                      <td>
                        <StatusBadge>{movement.status}</StatusBadge>
                      </td>
                      <td>{movement.project}</td>
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
      {account === "official" && <InvoiceHistory rows={customerInvoices} />}
      <QuoteHistory />
    </div>
  );
}
function QuoteHistory() {
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
          <tbody />
        </table>
        <div className="crm-empty">Bu müşteriye ait senkronize teklif bulunamadı.</div>
      </div>
    </section>
  );
}
function InvoiceHistory({ rows }: { rows: CustomerInvoiceRef[] }) {
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
            {rows.map((r) => (
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
        {!rows.length && <div className="crm-empty">Bu müşteriye ait senkronize fatura bulunamadı.</div>}
      </div>
    </section>
  );
}
