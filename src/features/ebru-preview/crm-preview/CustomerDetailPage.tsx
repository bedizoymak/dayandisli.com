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
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { CrmPageHeader, StatusBadge } from "./CrmShared";
import { CollectionEntryPanel } from "./CollectionEntryPanel";
import {
  cancelCollectionTransaction,
  useCollectionTransactions,
} from "../shared/collectionTransactions";
import {
  accountLabel,
  calculateCustomerAccountSummary,
  formatPreviewDate,
  formatTry,
  getCollectionActivity,
  getCustomerCollections,
} from "../shared/collectionSelectors";
import type {
  CollectionTransaction,
  CustomerAccountType,
} from "../shared/collectionTypes";
import { useParasutContactDetail } from "@/features/erp/parasut/api/queries";
import { formatParasutCurrency, formatParasutDate } from "@/features/erp/parasut/utils/format";
import type { CollectionMovement, CrmCustomer, CustomerInvoiceRef } from "./crmCustomerTypes";
const parent = "/apps/crm/customers";
export function CustomerDetailPage() {
  const { customerId } = useParams();
  const { erpUser } = useERPAuth();
  const detail = useParasutContactDetail("customers", customerId);
  const [account, setAccount] = useState<CustomerAccountType>("official");
  const [success, setSuccess] = useState("");
  const [editingTransaction, setEditingTransaction] =
    useState<CollectionTransaction>();
  const transactions = useCollectionTransactions();
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
  const summary = calculateCustomerAccountSummary(
    transactions,
    customer.id,
    account,
    baseSummary,
  );
  const legacyMovements: CollectionMovement[] = [];
  const collections = getCustomerCollections(
    transactions,
    customer.id,
    account,
  );
  const actor =
    erpUser?.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Ekip Üyesi";
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
      {success && <div className="collection-success">{success}</div>}
      <div className="crm-customer-workspace">
        <main className="crm-customer-main">
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
                          "Açıklama",
                          "Tahsilat Türü",
                          "Hesap",
                          "Planlanan",
                          "Tahsil Edilen",
                          "Durum",
                          "Proje",
                          "İşlemler",
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {collections.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>
                            {formatPreviewDate(transaction.transactionDate)}
                          </td>
                          <td>
                            {transaction.description || "Müşteri tahsilatı"}
                          </td>
                          <td>
                            {transaction.method === "cash"
                              ? "Nakit Tahsilat"
                              : "Çek Tahsilatı"}
                          </td>
                          <td>
                            <span
                              className={`collection-account-badge ${transaction.accountType}`}
                            >
                              {accountLabel(transaction.accountType)}
                            </span>
                          </td>
                          <td>{formatTry(transaction.amount)}</td>
                          <td>
                            {transaction.status === "cancelled"
                              ? "—"
                              : formatTry(transaction.amount)}
                          </td>
                          <td>
                            <StatusBadge>
                              {transaction.status === "received" ||
                              transaction.status === "cleared"
                                ? "Tahsil Edildi"
                                : transaction.status === "pending"
                                  ? "Portföyde"
                                  : "İptal Edildi"}
                            </StatusBadge>
                          </td>
                          <td>{transaction.relatedProjectId || "—"}</td>
                          <td className="collection-row-actions">
                            <button title="Görüntüle">
                              <Eye />
                            </button>
                            <button
                              title="Düzenle"
                              onClick={() => setEditingTransaction(transaction)}
                            >
                              <Pencil />
                            </button>
                            <button
                              title="İptal Et"
                              disabled={transaction.status === "cancelled"}
                              onClick={() =>
                                cancelCollectionTransaction(transaction.id)
                              }
                            >
                              İptal
                            </button>
                          </td>
                        </tr>
                      ))}
                      {legacyMovements.map((m) => (
                        <tr key={`legacy-${account}-${m.title}`}>
                          <td>{m.date}</td>
                          <td>{m.title}</td>
                          <td>—</td>
                          <td>
                            <span
                              className={`collection-account-badge ${account}`}
                            >
                              {accountLabel(account)}
                            </span>
                          </td>
                          <td>{m.planned}</td>
                          <td>{m.paid}</td>
                          <td>
                            <StatusBadge>{m.status}</StatusBadge>
                          </td>
                          <td>{m.project}</td>
                          <td className="collection-row-actions">
                            <button>
                              <Eye />
                            </button>
                            <button>
                              <Pencil />
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
        </main>
        <aside className="crm-customer-aside">
          <CollectionEntryPanel
            customerId={customer.id}
            customerName={customer.name}
            actor={actor}
            activeAccount={account}
            activeSummary={summary}
            editingTransaction={editingTransaction}
            onEditComplete={() => setEditingTransaction(undefined)}
            onSaved={(transaction) => {
              setAccount(transaction.accountType);
              setSuccess(
                editingTransaction
                  ? "Tahsilat hareketi frontend önizleme durumunda güncellendi."
                  : transaction.method === "cash"
                    ? `Tahsilat ${transaction.accountType === "official" ? "Resmi Hesap" : "Gayri Resmi Hesap"} ve ${transaction.destinationAccountName} hareketlerine eklendi.`
                    : `Çek tahsilatı ${transaction.accountType === "official" ? "Resmi Hesap" : "Gayri Resmi Hesap"} ve Çek Portföyü hareketlerine eklendi.`,
              );
            }}
          />
          <CustomerActivityHistory
            activities={getCollectionActivity(transactions, customer)}
          />
        </aside>
      </div>
    </div>
  );
}

function CustomerActivityHistory({
  activities,
}: {
  activities: ReturnType<typeof getCollectionActivity>;
}) {
  return (
    <article className="ebru-card customer-activity-panel">
      <h2>Müşteri / Tedarikçi Geçmişi</h2>
      {activities.map((activity) => (
        <div key={activity.id}>
          <span className={`collection-account-badge ${activity.accountType}`}>
            {accountLabel(activity.accountType)}
          </span>
          <p>{activity.text}</p>
          <small>
            {activity.timestamp} · {activity.actor}
          </small>
        </div>
      ))}
      {!activities.length && (
        <p className="crm-empty">Yeni tahsilat hareketi bulunmuyor.</p>
      )}
    </article>
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
