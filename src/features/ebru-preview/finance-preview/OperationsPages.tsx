import { type ReactNode } from "react";
import { Filter, Plus, Search, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import {
  FinanceBackLink,
  FinanceBreadcrumb,
  FinanceExportMenu,
  type ExportColumn,
} from "./FinanceNavigationTools";
import {
  dispatches,
  orders,
  parties,
  products,
  stockMovements,
  suppliers,
} from "./operationsData";
import "./operations-pages.css";

const root = "/apps/finance";
function Header({
  breadcrumb,
  title,
  action,
}: {
  breadcrumb: string;
  title: string;
  action?: { label: string; to: string };
}) {
  return (
    <header className="ops-head">
      <div>
        <FinanceBreadcrumb value={breadcrumb} />
        <h1>{title}</h1>
      </div>
      {action && (
        <Link to={action.to}>
          <Plus />
          {action.label}
        </Link>
      )}
    </header>
  );
}
function Filters() {
  return (
    <div className="ebru-card ops-filters">
      <label>
        <Search />
        <input placeholder="Ara..." />
      </label>
      <button>
        <Filter /> Filtrele
      </button>
    </div>
  );
}
function Table<T>({
  rows,
  columns,
  title,
  filename,
}: {
  rows: T[];
  columns: ExportColumn<T>[];
  title: string;
  filename: string;
}) {
  return (
    <>
      <div className="ops-export">
        <FinanceExportMenu
          rows={rows}
          columns={columns}
          title={title}
          filename={filename}
        />
      </div>
      <div className="ebru-card ops-table">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.header}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.header}>{c.value(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function FormShell({
  breadcrumb,
  title,
  parent,
  children,
}: {
  breadcrumb: string;
  title: string;
  parent: string;
  children: ReactNode;
}) {
  return (
    <div className="ops-page">
      <Header breadcrumb={breadcrumb} title={title} />
      <FinanceBackLink to={parent}>Listeye Dön</FinanceBackLink>
      <form className="ebru-card ops-form" onSubmit={(e) => e.preventDefault()}>
        {children}
        <footer>
          <Link to={parent}>Vazgeç</Link>
          <button>Kaydet</button>
        </footer>
      </form>
    </div>
  );
}
const productColumns: ExportColumn<(typeof products)[number]>[] = [
  { header: "Adı", value: (r) => r.name },
  { header: "Ürün / Stok Kodu", value: (r) => r.code },
  { header: "Stok", value: (r) => r.stock },
  { header: "Alış Fiyatı", value: (r) => `₺${r.purchase}` },
  { header: "Satış Fiyatı", value: (r) => `₺${r.sale}` },
];
export function ProductsPage() {
  return (
    <div className="ops-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Stok Yönetimi / Hizmet ve Ürünler"
        title="Hizmet ve Ürünler"
        action={{
          label: "Hizmet / Ürün Ekle",
          to: `${root}/inventory/products/new`,
        }}
      />
      <div className="ops-toolbar">
        <Filters />
        <button>Stok Güncelle</button>
      </div>
      <Table
        rows={products}
        columns={productColumns}
        title="Hizmet ve Ürünler"
        filename="hizmet-urunler"
      />
    </div>
  );
}
export function ProductFormPage() {
  return (
    <FormShell
      breadcrumb="Muhasebe ve Finans / Stok Yönetimi / Hizmet ve Ürünler / Yeni"
      title="Hizmet / Ürün Ekle"
      parent={`${root}/inventory/products`}
    >
      <section>
        <h2>Temel Bilgiler</h2>
        <div className="ops-fields">
          <label>
            Adı
            <input />
          </label>
          <label>
            Ürün / Stok Kodu
            <input />
          </label>
          <label>
            Barkod Numarası
            <input />
          </label>
          <label>
            Kategori
            <select>
              <option>Dişli</option>
              <option>Hizmet</option>
            </select>
          </label>
          <label className="wide">
            Ürün Fotoğrafı
            <span className="ops-upload">
              <Upload /> Görsel seç
            </span>
          </label>
          <label>
            Alış Birimi
            <select>
              <option>Adet</option>
              <option>Kg</option>
            </select>
          </label>
          <label>
            Satış Birimi
            <select>
              <option>Adet</option>
              <option>Saat</option>
            </select>
          </label>
          <label className="wide">
            Ürün Tanımlama Kodları
            <input />
          </label>
        </div>
      </section>
      <section>
        <h2>Stok ve Fiyatlandırma</h2>
        <div className="ops-fields">
          <label>
            Stok Takibi
            <select>
              <option>Açık</option>
              <option>Kapalı</option>
            </select>
          </label>
          <label>
            Başlangıç Stok Miktarı
            <input type="number" />
          </label>
          <label>
            Kritik Stok Uyarısı
            <input type="number" />
          </label>
          <label>
            Vergiler Hariç Alış Fiyatı
            <input type="number" />
          </label>
          <label>
            Vergiler Hariç Satış Fiyatı
            <input type="number" />
          </label>
          <label>
            KDV
            <select>
              <option>%20</option>
              <option>%10</option>
            </select>
          </label>
          <label>
            Ek Vergi
            <input />
          </label>
          <label>
            Vergiler Dahil Alış Fiyatı
            <input readOnly />
          </label>
          <label>
            Vergiler Dahil Satış Fiyatı
            <input readOnly />
          </label>
        </div>
      </section>
    </FormShell>
  );
}
const dispatchColumns: ExportColumn<(typeof dispatches)[number]>[] = [
  { header: "İrsaliye No", value: (r) => r.no },
  { header: "Müşteri / Tedarikçi", value: (r) => r.party },
  { header: "Tür", value: (r) => r.type },
  { header: "Tarih", value: (r) => r.date },
  { header: "Miktar", value: (r) => r.quantity },
  { header: "Durum", value: (r) => r.status },
];
export function DispatchesPage({ type }: { type: "incoming" | "outgoing" }) {
  const incoming = type === "incoming";
  const rows = dispatches.filter(
    (r) => r.type === (incoming ? "Gelen" : "Giden"),
  );
  const title = incoming ? "Gelen İrsaliyeler" : "Giden İrsaliyeler";
  const slug = incoming ? "incoming-dispatches" : "outgoing-dispatches";
  return (
    <div className="ops-page">
      <Header
        breadcrumb={`Muhasebe ve Finans / Stok Yönetimi / ${title}`}
        title={title}
        action={{
          label: `Yeni ${incoming ? "Gelen" : "Giden"} İrsaliye`,
          to: `${root}/inventory/${slug}/new`,
        }}
      />
      <Filters />
      <Table
        rows={rows}
        columns={dispatchColumns}
        title={title}
        filename={slug}
      />
    </div>
  );
}
export function DispatchFormPage({ type }: { type: "incoming" | "outgoing" }) {
  const incoming = type === "incoming";
  const title = `Yeni ${incoming ? "Gelen" : "Giden"} İrsaliye`;
  const parent = `${root}/inventory/${incoming ? "incoming" : "outgoing"}-dispatches`;
  return (
    <FormShell
      breadcrumb={`Muhasebe ve Finans / Stok Yönetimi / ${incoming ? "Gelen" : "Giden"} İrsaliyeler / ${title}`}
      title={title}
      parent={parent}
    >
      <section>
        <h2>İrsaliye Bilgileri</h2>
        <div className="ops-fields">
          <label>
            {incoming ? "Tedarikçi" : "Müşteri"}
            <select>
              {parties
                .filter((p) => p.type === (incoming ? "supplier" : "customer"))
                .map((p) => (
                  <option key={p.id}>{p.name}</option>
                ))}
            </select>
          </label>
          <label>
            İrsaliye No
            <input />
          </label>
          <label>
            Düzenleme Tarihi
            <input type="date" />
          </label>
          <label>
            Sevk Tarihi
            <input type="date" />
          </label>
          <label>
            Sevkiyat Yöntemi
            <select>
              <option>Kargo</option>
              <option>Firma Aracı</option>
            </select>
          </label>
          <label>
            Etiketler
            <input />
          </label>
          <label className="wide">
            Teslimat Adresi
            <textarea />
          </label>
        </div>
      </section>
      <section>
        <h2>Ürün Satırları</h2>
        <div className="ops-fields">
          <label>
            Hizmet / Ürün
            <select>
              {products.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Miktar
            <input type="number" />
          </label>
          <label>
            Birim
            <select>
              <option>Adet</option>
              <option>Kg</option>
            </select>
          </label>
        </div>
      </section>
    </FormShell>
  );
}
const movementColumns: ExportColumn<(typeof stockMovements)[number]>[] = [
  { header: "Ürün", value: (r) => r.product },
  { header: "Hareket Türü", value: (r) => r.type },
  { header: "Müşteri / Tedarikçi", value: (r) => r.party },
  { header: "Hareket Tarihi", value: (r) => r.date },
  { header: "Miktar", value: (r) => r.quantity },
];
export function StockHistoryPage() {
  return (
    <div className="ops-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Stok Yönetimi / Stok Geçmişi"
        title="Stok Geçmişi"
      />
      <Filters />
      <Table
        rows={stockMovements}
        columns={movementColumns}
        title="Stok Geçmişi"
        filename="stok-gecmisi"
      />
    </div>
  );
}
export function StockReportPage() {
  const rows = products.filter((p) => p.stock > 0);
  const columns = [
    ...productColumns,
    {
      header: "Stok Maliyeti",
      value: (r: (typeof rows)[number]) =>
        `₺${(r.stock * r.purchase).toLocaleString("tr-TR")}`,
    },
    {
      header: "Satış Değeri",
      value: (r: (typeof rows)[number]) =>
        `₺${(r.stock * r.sale).toLocaleString("tr-TR")}`,
    },
    {
      header: "Satış Karı",
      value: (r: (typeof rows)[number]) =>
        `₺${(r.stock * (r.sale - r.purchase)).toLocaleString("tr-TR")}`,
    },
  ];
  return (
    <div className="ops-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Stok Yönetimi / Stoktaki Ürünler Raporu"
        title="Stoktaki Ürünler Raporu"
      />
      <section className="ops-kpis">
        <article className="ebru-card">
          Toplam Stok Maliyeti<strong>₺226.960</strong>
        </article>
        <article className="ebru-card">
          Toplam Satış Değeri<strong>₺350.060</strong>
        </article>
        <article className="ebru-card">
          Tahmini Kâr<strong>₺123.100</strong>
        </article>
      </section>
      <Table
        rows={rows}
        columns={columns}
        title="Stoktaki Ürünler Raporu"
        filename="stok-raporu"
      />
    </div>
  );
}
const supplierColumns: ExportColumn<(typeof suppliers)[number]>[] = [
  { header: "Firma Ünvanı", value: (r) => r.name },
  { header: "Kısa Ad", value: (r) => r.short },
  { header: "Vergi No", value: (r) => r.taxNo },
  { header: "Telefon", value: (r) => r.phone },
  { header: "E-posta", value: (r) => r.email },
  { header: "İl", value: (r) => r.city },
  { header: "Yetkili", value: (r) => r.contact },
];
export function SuppliersPage() {
  return (
    <div className="ops-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Satın Alma / Tedarikçiler"
        title="Tedarikçiler"
        action={{
          label: "Yeni Tedarikçi",
          to: `${root}/purchasing/suppliers/new`,
        }}
      />
      <Filters />
      <Table
        rows={suppliers}
        columns={supplierColumns}
        title="Tedarikçiler"
        filename="tedarikciler"
      />
    </div>
  );
}
export function SupplierFormPage() {
  return (
    <FormShell
      breadcrumb="Muhasebe ve Finans / Satın Alma / Tedarikçiler / Yeni Tedarikçi"
      title="Yeni Tedarikçi"
      parent={`${root}/purchasing/suppliers`}
    >
      <section>
        <h2>Tedarikçi Kartı</h2>
        <div className="ops-fields">
          {[
            "Firma Ünvanı",
            "Kısa Ad",
            "Vergi No / TCKN",
            "Vergi Dairesi",
            "Telefon",
            "E-posta",
            "Adres",
            "İl",
            "İlçe",
            "Yetkili Kişi",
            "IBAN / Banka Bilgileri",
            "Etiket / Kategori",
          ].map((field) => (
            <label className={field === "Adres" ? "wide" : ""} key={field}>
              {field}
              <input />
            </label>
          ))}
        </div>
      </section>
    </FormShell>
  );
}
const orderColumns: ExportColumn<(typeof orders)[number]>[] = [
  { header: "Sipariş No", value: (r) => r.no },
  { header: "Müşteri", value: (r) => r.customer },
  { header: "Sipariş Tarihi", value: (r) => r.orderDate },
  { header: "Termin Tarihi", value: (r) => r.delivery },
  { header: "Durum", value: (r) => r.status },
  { header: "Toplam", value: (r) => r.total },
  { header: "İlgili Fatura", value: (r) => r.invoice },
];
export function OrdersPage() {
  return (
    <div className="ops-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Satın Alma / Siparişler"
        title="Siparişler"
        action={{
          label: "Elle Sipariş Gir",
          to: `${root}/purchasing/orders/new`,
        }}
      />
      <Filters />
      <Table
        rows={orders}
        columns={orderColumns}
        title="Siparişler"
        filename="siparisler"
      />
    </div>
  );
}
export function OrderFormPage() {
  return (
    <FormShell
      breadcrumb="Muhasebe ve Finans / Satın Alma / Siparişler / Elle Sipariş Girişi"
      title="Elle Sipariş Girişi"
      parent={`${root}/purchasing/orders`}
    >
      <section>
        <h2>Sipariş Bilgileri</h2>
        <div className="ops-fields">
          <label>
            Sipariş No
            <input />
          </label>
          <label>
            Müşteri
            <select>
              {parties
                .filter((p) => p.type === "customer")
                .map((p) => (
                  <option key={p.id}>{p.name}</option>
                ))}
            </select>
          </label>
          <label>
            Sipariş Tarihi
            <input type="date" />
          </label>
          <label>
            Teslim / Termin Tarihi
            <input type="date" />
          </label>
          <label>
            Durum
            <select>
              <option>Taslak</option>
              <option>Onaylandı</option>
            </select>
          </label>
          <label>
            İlgili Fatura
            <input placeholder="Henüz oluşturulmadı" />
          </label>
          <label className="wide">
            Notlar
            <textarea />
          </label>
        </div>
      </section>
      <section>
        <h2>Ürün / Hizmet Satırları</h2>
        <div className="ops-fields">
          <label>
            Ürün / Hizmet
            <select>
              {products.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Miktar
            <input type="number" />
          </label>
          <label>
            Birim
            <select>
              <option>Adet</option>
              <option>Saat</option>
            </select>
          </label>
          <label>
            Fiyat
            <input type="number" />
          </label>
        </div>
        <button type="button">Fatura Oluştur / İlişkilendir</button>
      </section>
    </FormShell>
  );
}
export function CheckFormPage() {
  return (
    <FormShell
      breadcrumb="Muhasebe ve Finans / Kasa / Çekler / Çek Ekle"
      title="Çek Ekle"
      parent={`${root}/cash/checks`}
    >
      <section>
        <h2>Çek Bilgileri</h2>
        <div className="ops-fields">
          <label>
            Tür
            <select>
              <option>Alınan Çek</option>
              <option>Verilen Çek</option>
            </select>
          </label>
          <label>
            Düzenleyen / İlgili Taraf
            <select>
              {parties.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Banka
            <input />
          </label>
          <label>
            Çek Numarası
            <input />
          </label>
          <label>
            Vade Tarihi
            <input type="date" />
          </label>
          <label>
            Tutar / Kalan Meblağ
            <input type="number" />
          </label>
          <label>
            Durum
            <select>
              <option>Portföyde</option>
              <option>Tahsil edilecek</option>
              <option>Tahsil edildi</option>
              <option>Ödenecek</option>
              <option>Ödendi</option>
            </select>
          </label>
          <label>
            Müşteri / Tedarikçi
            <select>
              {parties.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </FormShell>
  );
}
