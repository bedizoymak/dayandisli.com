import { type ReactNode } from "react";
import { Filter, Plus, Search, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import {
  FinanceBackLink,
  FinanceBreadcrumb,
  FinanceExportMenu,
  RowActionsMenu,
  printReport,
  type ExportColumn,
} from "./FinanceNavigationTools";
import { PartyLedgerEntryDialog } from "./PartyLedgerEntryDialog";
import {
  dispatches,
  orders,
  parties,
  products,
  stockMovements,
  suppliers,
} from "./operationsData";
import { crmCustomers } from "../crm/crmCustomerData";
import "./operations-pages.css";

const suppliersBase = "/apps/finance/purchasing/suppliers";

const root = "/apps/finance";

// "Giden" dispatches ship to a customer (CRM is the single source of truth for
// customers); "Gelen" dispatches arrive from a supplier. Resolve a matching
// detail route by name where possible so the party name stays clickable.
function resolvePartyLink(party: string, dispatchType: string): string | undefined {
  if (dispatchType === "Giden") {
    const customer = crmCustomers.find((row) => row.name === party);
    return customer ? `/apps/crm/customers/${customer.id}` : undefined;
  }
  const supplier = suppliers.find((row) => row.name === party);
  return supplier ? `${suppliersBase}/${encodeURIComponent(supplier.taxNo)}` : undefined;
}
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
    <div className="erp-card ops-filters">
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
      <div className="erp-card ops-table">
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
      <form className="erp-card ops-form" onSubmit={(e) => e.preventDefault()}>
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
        <button type="button" disabled title="Bu demo ortamında devre dışıdır">
          Stok Güncelle
        </button>
      </div>
      <div className="ops-export">
        <FinanceExportMenu
          rows={products}
          columns={productColumns}
          title="Hizmet ve Ürünler"
          filename="hizmet-urunler"
        />
      </div>
      <div className="erp-card ops-table">
        <table>
          <thead>
            <tr>
              {productColumns.map((column) => (
                <th key={column.header}>{column.header}</th>
              ))}
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {products.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link className="ops-cell-link" to={`${root}/inventory/products/${row.id}`}>
                    {row.name}
                  </Link>
                </td>
                {productColumns.slice(1).map((column) => (
                  <td key={column.header}>{column.value(row)}</td>
                ))}
                <td>
                  <RowActionsMenu
                    actions={[
                      { label: "Görüntüle", href: `${root}/inventory/products/${row.id}` },
                      {
                        label: "Dışa Aktar",
                        onSelect: () =>
                          printReport(row.name, productColumns, [row], `Ürün: ${row.name}`),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export function ProductDetailPage({ productId }: { productId?: string }) {
  const product = productId ? products.find((row) => row.id === productId) : undefined;

  if (!productId || !product) {
    return (
      <div className="ops-page">
        <Header breadcrumb="Muhasebe ve Finans / Stok Yönetimi / Hizmet ve Ürünler" title="Ürün Bulunamadı" />
        <FinanceBackLink to={`${root}/inventory/products`}>Ürünlere Dön</FinanceBackLink>
        <p className="ops-empty">"{productId ?? ""}" kimlikli bir ürün bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="ops-page">
      <Header breadcrumb={`Muhasebe ve Finans / Stok Yönetimi / Hizmet ve Ürünler / ${product.name}`} title={product.name} />
      <FinanceBackLink to={`${root}/inventory/products`}>Ürünlere Dön</FinanceBackLink>
      <section className="erp-card ops-supplier-card">
        <header className="ops-supplier-head">
          <div>
            <h2>{product.name}</h2>
            <span>{product.code}</span>
          </div>
        </header>
        <div className="ops-supplier-grid">
          <div>
            <h3>Stok</h3>
            <dl>
              <div>
                <dt>Stok Adedi</dt>
                <dd>{product.stock}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3>Fiyatlandırma</h3>
            <dl>
              <div>
                <dt>Alış Fiyatı</dt>
                <dd>₺{product.purchase}</dd>
              </div>
              <div>
                <dt>Satış Fiyatı</dt>
                <dd>₺{product.sale}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
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
      <div className="ops-export">
        <FinanceExportMenu rows={rows} columns={dispatchColumns} title={title} filename={slug} />
      </div>
      <div className="erp-card ops-table">
        <table>
          <thead>
            <tr>
              {dispatchColumns.map((column) => (
                <th key={column.header}>{column.header}</th>
              ))}
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.no}>
                <td>
                  <Link className="ops-cell-link" to={`${root}/inventory/${slug}/${encodeURIComponent(row.no)}`}>
                    {row.no}
                  </Link>
                </td>
                {dispatchColumns.slice(1).map((column) => {
                  if (column.header !== "Müşteri / Tedarikçi") {
                    return <td key={column.header}>{column.value(row)}</td>;
                  }
                  const partyLink = resolvePartyLink(row.party, row.type);
                  return (
                    <td key={column.header}>
                      {partyLink ? (
                        <Link className="ops-cell-link" to={partyLink}>
                          {row.party}
                        </Link>
                      ) : (
                        row.party
                      )}
                    </td>
                  );
                })}
                <td>
                  <RowActionsMenu
                    actions={[
                      { label: "Görüntüle", href: `${root}/inventory/${slug}/${encodeURIComponent(row.no)}` },
                      {
                        label: "Dışa Aktar",
                        onSelect: () => printReport(row.no, dispatchColumns, [row], `İrsaliye: ${row.no}`),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export function DispatchDetailPage({ type, dispatchNo }: { type: "incoming" | "outgoing"; dispatchNo?: string }) {
  const incoming = type === "incoming";
  const title = incoming ? "Gelen İrsaliyeler" : "Giden İrsaliyeler";
  const slug = incoming ? "incoming-dispatches" : "outgoing-dispatches";
  const dispatch = dispatchNo
    ? dispatches.find((row) => row.no === dispatchNo && row.type === (incoming ? "Gelen" : "Giden"))
    : undefined;

  if (!dispatchNo || !dispatch) {
    return (
      <div className="ops-page">
        <Header breadcrumb={`Muhasebe ve Finans / Stok Yönetimi / ${title}`} title="İrsaliye Bulunamadı" />
        <FinanceBackLink to={`${root}/inventory/${slug}`}>İrsaliyelere Dön</FinanceBackLink>
        <p className="ops-empty">"{dispatchNo ?? ""}" numaralı bir irsaliye bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="ops-page">
      <Header breadcrumb={`Muhasebe ve Finans / Stok Yönetimi / ${title} / ${dispatch.no}`} title={dispatch.no} />
      <FinanceBackLink to={`${root}/inventory/${slug}`}>İrsaliyelere Dön</FinanceBackLink>
      <section className="erp-card ops-supplier-card">
        <header className="ops-supplier-head">
          <div>
            <h2>{dispatch.no}</h2>
            <span>{dispatch.party}</span>
          </div>
        </header>
        <div className="ops-supplier-grid">
          <div>
            <h3>İrsaliye Bilgileri</h3>
            <dl>
              <div>
                <dt>Müşteri / Tedarikçi</dt>
                <dd>
                  {(() => {
                    const partyLink = resolvePartyLink(dispatch.party, dispatch.type);
                    return partyLink ? <Link to={partyLink}>{dispatch.party}</Link> : dispatch.party;
                  })()}
                </dd>
              </div>
              <div>
                <dt>Tarih</dt>
                <dd>{dispatch.date}</dd>
              </div>
              <div>
                <dt>Miktar</dt>
                <dd>{dispatch.quantity}</dd>
              </div>
              <div>
                <dt>Durum</dt>
                <dd>{dispatch.status}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
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
  const totalCost = rows.reduce((sum, r) => sum + r.stock * r.purchase, 0);
  const totalSales = rows.reduce((sum, r) => sum + r.stock * r.sale, 0);
  const totalProfit = totalSales - totalCost;
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
      <Filters />
      <section className="ops-kpis">
        <article className="erp-card">
          Toplam Stok Maliyeti
          <strong>₺{totalCost.toLocaleString("tr-TR")}</strong>
        </article>
        <article className="erp-card">
          Toplam Satış Değeri
          <strong>₺{totalSales.toLocaleString("tr-TR")}</strong>
        </article>
        <article className="erp-card">
          Tahmini Kâr
          <strong>₺{totalProfit.toLocaleString("tr-TR")}</strong>
        </article>
      </section>
      {rows.length ? (
        <Table
          rows={rows}
          columns={columns}
          title="Stoktaki Ürünler Raporu"
          filename="stok-raporu"
        />
      ) : (
        <p className="ops-empty">Stokta ürün bulunamadı.</p>
      )}
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
      <div className="ops-export">
        <FinanceExportMenu
          rows={suppliers}
          columns={supplierColumns}
          title="Tedarikçiler"
          filename="tedarikciler"
        />
      </div>
      <div className="erp-card ops-table">
        <table>
          <thead>
            <tr>
              {supplierColumns.map((column) => (
                <th key={column.header}>{column.header}</th>
              ))}
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((row) => (
              <tr key={row.taxNo}>
                <td>
                  <Link
                    className="ops-cell-link"
                    to={`${suppliersBase}/${encodeURIComponent(row.taxNo)}`}
                  >
                    {row.name}
                  </Link>
                </td>
                {supplierColumns.slice(1).map((column) => (
                  <td key={column.header}>{column.value(row)}</td>
                ))}
                <td>
                  <RowActionsMenu
                    actions={[
                      {
                        label: "Görüntüle",
                        href: `${suppliersBase}/${encodeURIComponent(row.taxNo)}`,
                      },
                      {
                        label: "Dışa Aktar",
                        onSelect: () =>
                          printReport(
                            row.name,
                            supplierColumns,
                            [row],
                            `Tedarikçi: ${row.name}`,
                          ),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SupplierDetailPage({ supplierId }: { supplierId?: string }) {
  const supplier = supplierId ? suppliers.find((row) => row.taxNo === supplierId) : undefined;

  if (!supplierId || !supplier) {
    return (
      <div className="ops-page">
        <Header
          breadcrumb="Muhasebe ve Finans / Satın Alma / Tedarikçiler"
          title="Tedarikçi Bulunamadı"
        />
        <FinanceBackLink to={`${root}/purchasing/suppliers`}>
          Tedarikçilere Dön
        </FinanceBackLink>
        <p className="ops-empty">
          "{supplierId ?? ""}" vergi numarasına ait bir tedarikçi bulunamadı.
        </p>
      </div>
    );
  }

  const relatedDispatches = dispatches.filter(
    (row) => row.party === supplier.name,
  );

  return (
    <div className="ops-page">
      <Header
        breadcrumb={`Muhasebe ve Finans / Satın Alma / Tedarikçiler / ${supplier.name}`}
        title={supplier.name}
      />
      <FinanceBackLink to={`${root}/purchasing/suppliers`}>
        Tedarikçilere Dön
      </FinanceBackLink>
      <section className="erp-card ops-supplier-card">
        <header className="ops-supplier-head">
          <div>
            <h2>{supplier.name}</h2>
            <span>{supplier.short}</span>
          </div>
          <PartyLedgerEntryDialog
            kind="payment"
            partyLabel="Tedarikçi"
            partyName={supplier.name}
            trigger={
              <button type="button" className="ops-supplier-payment">
                Ödeme Ekle
              </button>
            }
          />
        </header>
        <div className="ops-supplier-grid">
          <div>
            <h3>Kimlik ve Vergi Bilgileri</h3>
            <dl>
              <div>
                <dt>Vergi No</dt>
                <dd>{supplier.taxNo}</dd>
              </div>
              <div>
                <dt>İl</dt>
                <dd>{supplier.city}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3>İletişim</h3>
            <dl>
              <div>
                <dt>Telefon</dt>
                <dd>{supplier.phone}</dd>
              </div>
              <div>
                <dt>E-posta</dt>
                <dd>{supplier.email}</dd>
              </div>
              <div>
                <dt>Yetkili Kişi</dt>
                <dd>{supplier.contact}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
      <section className="erp-card ops-supplier-history">
        <h3>İrsaliye Geçmişi</h3>
        {relatedDispatches.length ? (
          <table>
            <thead>
              <tr>
                <th>İrsaliye No</th>
                <th>Tür</th>
                <th>Tarih</th>
                <th>Miktar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {relatedDispatches.map((row) => (
                <tr key={row.no}>
                  <td>{row.no}</td>
                  <td>{row.type}</td>
                  <td>{row.date}</td>
                  <td>{row.quantity}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ops-empty">Bu tedarikçiye ait irsaliye bulunamadı.</p>
        )}
      </section>
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
      <div className="ops-export">
        <FinanceExportMenu
          rows={orders}
          columns={orderColumns}
          title="Siparişler"
          filename="siparisler"
        />
      </div>
      <div className="erp-card ops-table">
        <table>
          <thead>
            <tr>
              {orderColumns.map((column) => (
                <th key={column.header}>{column.header}</th>
              ))}
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((row) => (
              <tr key={row.no}>
                <td>
                  <Link className="ops-cell-link" to={`${root}/purchasing/orders/${encodeURIComponent(row.no)}`}>
                    {row.no}
                  </Link>
                </td>
                {orderColumns.slice(1).map((column) =>
                  column.header === "Müşteri" && row.customerId ? (
                    <td key={column.header}>
                      <Link className="ops-cell-link" to={`/apps/crm/customers/${row.customerId}`}>
                        {column.value(row)}
                      </Link>
                    </td>
                  ) : (
                    <td key={column.header}>{column.value(row)}</td>
                  ),
                )}
                <td>
                  <RowActionsMenu
                    actions={[
                      {
                        label: "Görüntüle",
                        href: `${root}/purchasing/orders/${encodeURIComponent(row.no)}`,
                      },
                      {
                        label: "Dışa Aktar",
                        onSelect: () =>
                          printReport(row.no, orderColumns, [row], `Sipariş: ${row.no}`),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export function OrderDetailPage({ orderNo }: { orderNo?: string }) {
  const order = orderNo ? orders.find((row) => row.no === orderNo) : undefined;

  if (!orderNo || !order) {
    return (
      <div className="ops-page">
        <Header breadcrumb="Muhasebe ve Finans / Satın Alma / Siparişler" title="Sipariş Bulunamadı" />
        <FinanceBackLink to={`${root}/purchasing/orders`}>Siparişlere Dön</FinanceBackLink>
        <p className="ops-empty">"{orderNo ?? ""}" numaralı bir sipariş bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="ops-page">
      <Header breadcrumb={`Muhasebe ve Finans / Satın Alma / Siparişler / ${order.no}`} title={order.no} />
      <FinanceBackLink to={`${root}/purchasing/orders`}>Siparişlere Dön</FinanceBackLink>
      <section className="erp-card ops-supplier-card">
        <header className="ops-supplier-head">
          <div>
            <h2>{order.no}</h2>
            <span>{order.customer}</span>
          </div>
        </header>
        <div className="ops-supplier-grid">
          <div>
            <h3>Sipariş Bilgileri</h3>
            <dl>
              <div>
                <dt>Müşteri</dt>
                <dd>
                  {order.customerId ? (
                    <Link to={`/apps/crm/customers/${order.customerId}`}>{order.customer}</Link>
                  ) : (
                    order.customer
                  )}
                </dd>
              </div>
              <div>
                <dt>Sipariş Tarihi</dt>
                <dd>{order.orderDate}</dd>
              </div>
              <div>
                <dt>Termin Tarihi</dt>
                <dd>{order.delivery}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3>Durum ve Tutar</h3>
            <dl>
              <div>
                <dt>Durum</dt>
                <dd>{order.status}</dd>
              </div>
              <div>
                <dt>Toplam</dt>
                <dd>{order.total}</dd>
              </div>
              <div>
                <dt>İlgili Fatura</dt>
                <dd>{order.invoice ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
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
