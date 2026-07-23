import {
  Eye,
  FileDown,
  MoreHorizontal,
  Pencil,
  Search,
  ShoppingCart,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  FinanceExportMenu,
  type ExportColumn,
} from "../finance-preview/FinanceNavigationTools";
import { salesActivities, salesOrders, salesQuotes } from "./salesData";
import { SalesHeader, SalesStatus } from "./SalesShared";
import { customerName, printQuote } from "./salesUtils";
const root = "/apps/ebru-preview/sales";
const quoteColumns: ExportColumn<(typeof salesQuotes)[number]>[] = [
  { header: "Teklif No", value: (r) => r.no },
  { header: "Firma", value: (r) => customerName(r.customerId) },
  { header: "İlgili Kişi", value: (r) => r.contact },
  { header: "Proje", value: (r) => r.project },
  { header: "Toplam", value: (r) => quoteTotal(r) },
  { header: "Durum", value: (r) => r.status },
  { header: "Oluşturulma Tarihi", value: (r) => r.created },
  { header: "Geçerlilik Tarihi", value: (r) => r.validUntil },
];
const quoteTotal = (q: (typeof salesQuotes)[number]) =>
  `${q.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice * (1 - l.discount / 100) * (1 + l.vat / 100), 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${q.currency}`;
function Filters({ activity = false }: { activity?: boolean }) {
  return (
    <div className="ebru-card sales-filters">
      <label className="search">
        <Search />
        <input
          placeholder={activity ? "Aktivite ara" : "Teklif veya sipariş no ara"}
        />
      </label>
      <select>
        <option>{activity ? "Tüm Müşteriler" : "Tüm Firmalar"}</option>
      </select>
      <select>
        <option>{activity ? "Tüm Aktivite Türleri" : "Tüm Durumlar"}</option>
      </select>
      <label>
        Başlangıç
        <input type="date" />
      </label>
      <label>
        Bitiş
        <input type="date" />
      </label>
      <button>Filtreleri Temizle</button>
    </div>
  );
}
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="ebru-card sales-table-wrap">
      <table className="sales-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      <footer>
        <span>1–10 / 24</span>
        <button disabled>Önceki</button>
        <button>Sonraki</button>
      </footer>
    </div>
  );
}
export function QuotesPage() {
  return (
    <div className="sales-page">
      <SalesHeader
        section="Teklifler"
        title="Teklifler"
        subtitle="Müşterilere hazırlanan teklifleri görüntüleyin, indirin ve siparişe dönüştürün."
      >
        <FinanceExportMenu
          title="Teklifler"
          filename="teklifler"
          rows={salesQuotes}
          columns={quoteColumns}
        />
        <Link className="sales-primary" to={`${root}/quotes/new`}>
          Yeni Teklif Oluştur
        </Link>
      </SalesHeader>
      <Filters />
      <Table
        headers={[
          "Teklif No",
          "Firma",
          "İlgili Kişi",
          "Proje",
          "Toplam",
          "Durum",
          "Oluşturulma Tarihi",
          "Geçerlilik Tarihi",
          "İşlemler",
        ]}
      >
        {salesQuotes.map((q) => (
          <tr key={q.id}>
            <td>
              <Link to={`${root}/quotes/${q.id}`}>{q.no}</Link>
            </td>
            <td>
              <Link
                className="sales-customer-link"
                to={`/apps/ebru-preview/crm/customers/${q.customerId}`}
              >
                {customerName(q.customerId)}
              </Link>
            </td>
            <td>{q.contact}</td>
            <td>{q.project}</td>
            <td>{quoteTotal(q)}</td>
            <td>
              <SalesStatus>{q.status}</SalesStatus>
            </td>
            <td>{q.created}</td>
            <td>{q.validUntil}</td>
            <td>
              <div className="sales-row-actions">
                <Link title="Görüntüle" to={`${root}/quotes/${q.id}`}>
                  <Eye />
                </Link>
                <Link title="Düzenle" to={`${root}/quotes/${q.id}/edit`}>
                  <Pencil />
                </Link>
                <button title="PDF İndir" onClick={() => printQuote(q)}>
                  <FileDown />
                </button>
                <Link
                  title="Siparişe Dönüştür"
                  to={`${root}/orders/new?sourceQuoteId=${q.id}`}
                >
                  <ShoppingCart />
                </Link>
                <button title="Çoğalt / Arşivle">
                  <MoreHorizontal />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
const orderColumns: ExportColumn<(typeof salesOrders)[number]>[] = [
  { header: "Sipariş No", value: (r) => r.no },
  { header: "Müşteri", value: (r) => customerName(r.customerId) },
  { header: "Kaynak Teklif", value: (r) => r.sourceQuoteNo ?? "—" },
  { header: "Proje", value: (r) => r.project },
  { header: "Sipariş Tarihi", value: (r) => r.orderDate },
  { header: "Termin Tarihi", value: (r) => r.dueDate },
  { header: "Toplam", value: (r) => r.total },
  { header: "Durum", value: (r) => r.status },
];
export function SalesOrdersPage() {
  return (
    <div className="sales-page">
      <SalesHeader
        section="Siparişler"
        title="Siparişler"
        subtitle="Tekliflerden veya manuel olarak oluşturulan müşteri siparişlerini yönetin."
      >
        <FinanceExportMenu
          title="Siparişler"
          filename="satis-siparisleri"
          rows={salesOrders}
          columns={orderColumns}
        />
        <Link className="sales-primary" to={`${root}/orders/new`}>
          Yeni Sipariş
        </Link>
      </SalesHeader>
      <Filters />
      <Table headers={orderColumns.map((c) => c.header).concat("İşlemler")}>
        {salesOrders.map((o) => (
          <tr key={o.id}>
            {orderColumns.map((c) => (
              <td key={c.header}>{c.value(o)}</td>
            ))}
            <td>
              <button title="Görüntüle · Düzenle · Fatura Oluştur · Üretime Aktar · İndir">
                <MoreHorizontal />
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
export function SalesActivitiesPage() {
  return (
    <div className="sales-page">
      <SalesHeader section="Satış Faaliyetleri" title="Satış Faaliyetleri" />
      <Filters activity />
      <Table
        headers={[
          "Tarih",
          "Aktivite Türü",
          "Müşteri",
          "Teklif / Sipariş",
          "Açıklama",
          "Sorumlu",
          "Durum",
          "İşlemler",
        ]}
      >
        {salesActivities.map((a) => (
          <tr key={a.id}>
            <td>{a.date}</td>
            <td>{a.type}</td>
            <td>
              <Link
                className="sales-customer-link"
                to={`/apps/ebru-preview/crm/customers/${a.customerId}`}
              >
                {customerName(a.customerId)}
              </Link>
            </td>
            <td>{a.relation}</td>
            <td>{a.description}</td>
            <td>{a.owner}</td>
            <td>
              <SalesStatus>{a.status}</SalesStatus>
            </td>
            <td>
              <button>
                <MoreHorizontal />
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
