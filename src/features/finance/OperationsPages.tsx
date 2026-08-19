import { useEffect, useState, type ReactNode } from "react";
import { Filter, Plus, Search, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import {
  FinanceBackLink,
  FinanceBreadcrumb,
  FinanceExportMenu,
  RowActionsMenu,
  printReport,
  type ExportColumn,
} from "./FinanceNavigationTools";
import { PartyLedgerEntryDialog } from "./PartyLedgerEntryDialog";
import { listAllChecks } from "./checks/checksApi";
import { formatCheckMoney } from "./checks/checkDomain";
import { projectPartyCheckLedger } from "./checks/checkProjections";
import type { CheckListRow } from "./checks/types";
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
function Filters({
  search,
  onSearchChange,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
} = {}) {
  return (
    <div className="erp-card ops-filters">
      <label>
        <Search />
        <input
          value={search}
          onChange={onSearchChange ? (event) => onSearchChange(event.target.value) : undefined}
        />
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

type ProductListRow = {
  id: string;
  name: string;
  code: string;
  stock: number | null;
  purchase: number | null;
  sale: number | null;
};

type ProductApiRow = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

const liveProductColumns: ExportColumn<ProductListRow>[] = [
  { header: "Adı", value: (r) => r.name },
  { header: "Ürün / Stok Kodu", value: (r) => r.code },
  { header: "Stok", value: (r) => r.stock ?? "—" },
  { header: "Alış Fiyatı", value: (r) => (r.purchase === null ? "—" : `₺${r.purchase}`) },
  { header: "Satış Fiyatı", value: (r) => (r.sale === null ? "—" : `₺${r.sale}`) },
];

function productText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function productNumber(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function mapProduct(row: ProductApiRow): ProductListRow | null {
  if (typeof row.parasut_id !== "string" || !row.parasut_id.trim()) return null;
  const attributes = row.attributes ?? {};
  return {
    id: row.parasut_id,
    name: productText(attributes.name),
    code: productText(attributes.code),
    stock: productNumber(attributes.stock_count),
    purchase: productNumber(attributes.buying_price_in_trl),
    sale: productNumber(attributes.list_price_in_trl),
  };
}

export function ProductsPage() {
  const [productRows, setProductRows] = useState<ProductListRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", {
        body: {
          action: "list",
          resource: "products",
          pageSize: 100,
          filters: { archived: false },
        },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        const response = data as { rows?: unknown } | null;
        if (error || !response || !Array.isArray(response.rows)) {
          setProductRows([]);
          return;
        }
        setProductRows(
          (response.rows as ProductApiRow[])
            .map(mapProduct)
            .filter((row): row is ProductListRow => row !== null),
        );
      })
      .catch(() => {
        if (!cancelled) setProductRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        <button type="button" disabled>
          Stok Güncelle
        </button>
      </div>
      <div className="ops-export">
        <FinanceExportMenu
          rows={productRows}
          columns={liveProductColumns}
          title="Hizmet ve Ürünler"
          filename="hizmet-urunler"
        />
      </div>
      <div className="erp-card ops-table">
        <table>
          <thead>
            <tr>
              {liveProductColumns.map((column) => (
                <th key={column.header}>{column.header}</th>
              ))}
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {productRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link className="ops-cell-link" to={`${root}/inventory/products/${row.id}`}>
                    {row.name}
                  </Link>
                </td>
                {liveProductColumns.slice(1).map((column) => (
                  <td key={column.header}>{column.value(row)}</td>
                ))}
                <td>
                  <RowActionsMenu
                    actions={[
                      { label: "Görüntüle", href: `${root}/inventory/products/${row.id}` },
                      {
                        label: "Dışa Aktar",
                        onSelect: () =>
                          printReport(
                            row.name,
                            liveProductColumns,
                            [row],
                            `Ürün: ${row.name}`,
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
            <select defaultValue="">
              <option value="">—</option>
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
            <select defaultValue="">
              <option value="">—</option>
              <option>Adet</option>
              <option>Kg</option>
            </select>
          </label>
          <label>
            Satış Birimi
            <select defaultValue="">
              <option value="">—</option>
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
            <select defaultValue="">
              <option value="">—</option>
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
            <select defaultValue="">
              <option value="">—</option>
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
            <select defaultValue="">
              <option value="">—</option>
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
            <select defaultValue="">
              <option value="">—</option>
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
          <strong>{rows.length ? `₺${totalCost.toLocaleString("tr-TR")}` : "—"}</strong>
        </article>
        <article className="erp-card">
          Toplam Satış Değeri
          <strong>{rows.length ? `₺${totalSales.toLocaleString("tr-TR")}` : "—"}</strong>
        </article>
        <article className="erp-card">
          Tahmini Kâr
          <strong>{rows.length ? `₺${totalProfit.toLocaleString("tr-TR")}` : "—"}</strong>
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
type SupplierListRow = {
  id: string;
  name: string;
  short: string;
  taxNo: string;
  phone: string;
  email: string;
  city: string;
  contact: string;
  balance: string;
};

type SupplierApiRow = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

const supplierColumns: ExportColumn<SupplierListRow>[] = [
  { header: "Firma Ünvanı", value: (r) => r.name },
  { header: "Kısa Ad", value: (r) => r.short },
  { header: "Vergi No", value: (r) => r.taxNo },
  { header: "Telefon", value: (r) => r.phone },
  { header: "E-posta", value: (r) => r.email },
  { header: "İl", value: (r) => r.city },
  { header: "Yetkili", value: (r) => r.contact },
  { header: "Bakiye", value: (r) => r.balance },
];

function supplierText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "—";
}

// Same join convention as CustomerDetailPage's displayAddress: real
// address/district/city attributes only, no invented fallback.
// Paraşüt's free-text `address` field is very often already a full address
// (street + neighborhood/district + city typed together), while the
// separate `district`/`city` attributes are also populated from the same
// real location — appending them unconditionally repeated that text. Real
// info is never dropped: district/city are only left out when their exact
// text is already present in `address`; otherwise they're still appended.
// Turkish casing is locale-dependent in a way plain .toLowerCase()/
// .toLocaleLowerCase("tr-TR") don't handle uniformly for containment
// checks: "İ" and "I" fold to two DIFFERENT lowercase letters in Turkish
// ("i" vs "ı"), so if the free-text address spells a word with one variant
// and the separate district/city field spells the same word with the
// other, a locale-aware lowercase comparison still misses the match. All
// three I-like characters are folded to a single marker first, before any
// other casing/punctuation normalization, so the comparison is blind to
// that variance. Exported for its own unit test.
export function normalizeAddressForComparison(value: string) {
  return value
    .replace(/[İIı]/g, "i")
    .toLowerCase()
    .replace(/[.,/\\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function supplierAddressText(attributes: Record<string, unknown>) {
  const address = typeof attributes.address === "string" ? attributes.address.trim() : "";
  const district = typeof attributes.district === "string" ? attributes.district.trim() : "";
  const city = typeof attributes.city === "string" ? attributes.city.trim() : "";

  const addressNormalized = normalizeAddressForComparison(address);

  const parts = [address];
  if (district && !addressNormalized.includes(normalizeAddressForComparison(district))) parts.push(district);
  if (city && !addressNormalized.includes(normalizeAddressForComparison(city))) parts.push(city);

  const cleaned = parts.filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : "—";
}

// +/-/0 sign, no suffix — same real-trl_balance convention as the customer
// list and profile header.
function supplierBalanceText(value: unknown) {
  const amount = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null;
  if (amount === null || !Number.isFinite(amount)) return "—";
  if (amount === 0) return formatMoney(0);
  return `${amount > 0 ? "+" : "-"}${formatMoney(Math.abs(amount))}`;
}

function mapSupplier(row: SupplierApiRow): SupplierListRow | null {
  if (typeof row.parasut_id !== "string" || !row.parasut_id) return null;
  const attributes = row.attributes ?? {};
  return {
    id: row.parasut_id,
    name: supplierText(attributes.name),
    short: supplierText(attributes.short_name),
    taxNo: supplierText(attributes.tax_number),
    phone: supplierText(attributes.phone),
    email: supplierText(attributes.email),
    city: supplierText(attributes.city),
    contact: "—",
    balance: supplierBalanceText(attributes.trl_balance),
  };
}

// Backend caps a single list call at 100 rows and defaults to
// last_seen_at desc. A real supplier that hasn't been touched recently in
// Paraşüt could rank far past page 1 and never render — same fix as
// CustomerListPage's fetchAllCustomers, adapted for suppliers (no server
// search here; the page's own search box already filters client-side).
async function fetchAllSuppliers(cancelledRef: { cancelled: boolean }) {
  const pageSize = 100;
  const fetchPage = (page: number) =>
    supabase.functions.invoke("parasut-api", {
      body: { action: "list", resource: "suppliers", page, pageSize },
    });

  const first = await fetchPage(1);
  if (cancelledRef.cancelled) return [] as SupplierApiRow[];
  const firstResponse = first.data as { rows?: unknown; total?: unknown } | null;
  if (first.error || !firstResponse || !Array.isArray(firstResponse.rows)) return [] as SupplierApiRow[];

  const total = typeof firstResponse.total === "number" ? firstResponse.total : null;
  const rows = [...(firstResponse.rows as SupplierApiRow[])];

  if (total !== null) {
    const remainingPages = Math.ceil(total / pageSize) - 1;
    for (let page = 2; page <= remainingPages + 1; page += 1) {
      if (cancelledRef.cancelled) break;
      const next = await fetchPage(page);
      const nextResponse = next.data as { rows?: unknown } | null;
      if (next.error || !nextResponse || !Array.isArray(nextResponse.rows)) break;
      rows.push(...(nextResponse.rows as SupplierApiRow[]));
    }
  }

  return rows;
}

export function SuppliersPage() {
  const [supplierRows, setSupplierRows] = useState<SupplierListRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const cancelledRef = { cancelled: false };
    fetchAllSuppliers(cancelledRef)
      .then((rows) => {
        if (cancelledRef.cancelled) return;
        setSupplierRows(rows.map(mapSupplier).filter((row): row is SupplierListRow => row !== null));
      })
      .catch(() => {
        if (!cancelledRef.cancelled) setSupplierRows([]);
      });
    return () => {
      cancelledRef.cancelled = true;
    };
  }, []);

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
      <Filters search={search} onSearchChange={setSearch} />
      <div className="ops-export">
        <FinanceExportMenu
          rows={supplierRows}
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
            {supplierRows
              .filter((row) => row.name.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")))
              .map((row) => (
              <tr key={row.id}>
                <td>
                  <Link
                    className="ops-cell-link"
                    to={`${suppliersBase}/${encodeURIComponent(row.id)}`}
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
                        href: `${suppliersBase}/${encodeURIComponent(row.id)}`,
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
  const [loading, setLoading] = useState(true);
  const [attributes, setAttributes] = useState<Record<string, unknown> | null>(null);
  const [linkedChecks, setLinkedChecks] = useState<CheckListRow[]>([]);
  const [linkedChecksStatus, setLinkedChecksStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!supplierId) {
      setLoading(false);
      setAttributes(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke("parasut-api", {
        body: { action: "detail", resource: "suppliers", parasutId: supplierId },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        const response = data as { contact?: { attributes?: Record<string, unknown> | null } } | null;
        setAttributes(!error && response?.contact?.attributes ? response.contact.attributes : null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setAttributes(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  useEffect(() => {
    if (!supplierId) {
      setLinkedChecks([]);
      setLinkedChecksStatus("ready");
      return;
    }
    let cancelled = false;
    setLinkedChecksStatus("loading");
    listAllChecks({
      filters: { contactParasutId: supplierId, direction: "issued" },
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok === false) {
          setLinkedChecks([]);
          setLinkedChecksStatus("error");
          return;
        }
        setLinkedChecks(result.data);
        setLinkedChecksStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setLinkedChecks([]);
          setLinkedChecksStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  if (loading) {
    return (
      <div className="ops-page">
        <Header breadcrumb="Muhasebe ve Finans / Satın Alma / Tedarikçiler" title="Yükleniyor…" />
      </div>
    );
  }

  if (!supplierId || !attributes) {
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
          "{supplierId ?? ""}" kimlikli bir tedarikçi bulunamadı.
        </p>
      </div>
    );
  }

  const name = supplierText(attributes.name);
  const balance = supplierBalanceText(attributes.trl_balance);
  const supplierChecks = projectPartyCheckLedger(linkedChecks, supplierId, "issued");

  return (
    <div className="ops-page">
      <Header
        breadcrumb={`Muhasebe ve Finans / Satın Alma / Tedarikçiler / ${name}`}
        title={name}
      />
      <FinanceBackLink to={`${root}/purchasing/suppliers`}>
        Tedarikçilere Dön
      </FinanceBackLink>
      <section className="erp-card ops-supplier-card">
        <header className="ops-supplier-head">
          <div>
            <h2>{name}</h2>
            <span>{supplierText(attributes.short_name)}</span>
          </div>
          <PartyLedgerEntryDialog
            kind="payment"
            partyLabel="Tedarikçi"
            partyName={name}
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
                <dd>{supplierText(attributes.tax_number)}</dd>
              </div>
              <div>
                <dt>İl</dt>
                <dd>{supplierText(attributes.city)}</dd>
              </div>
              <div>
                <dt>Bakiye</dt>
                <dd>{balance}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3>İletişim</h3>
            <dl>
              <div>
                <dt>Telefon</dt>
                <dd>{supplierText(attributes.phone)}</dd>
              </div>
              <div>
                <dt>E-posta</dt>
                <dd>{supplierText(attributes.email)}</dd>
              </div>
              <div>
                <dt>Adres</dt>
                <dd>{supplierAddressText(attributes)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
      <section className="erp-card ops-supplier-card">
        <header className="ops-supplier-head">
          <div>
            <h2>Yaklaşan Ödemeler ve Çek Hareketleri</h2>
            <span>Açık çekler ödeme sayılmaz; ödenmiş ERP çekleri ayrı cari etkisiyle gösterilir.</span>
          </div>
        </header>
        {linkedChecksStatus === "loading" && <p className="ops-empty">Bağlı çekler yükleniyor…</p>}
        {linkedChecksStatus === "error" && (
          <p className="ops-empty" role="alert">Bağlı çekler yüklenemedi; mevcut tedarikçi bakiyesi değiştirilmedi.</p>
        )}
        {linkedChecksStatus === "ready" && supplierChecks.length === 0 && (
          <p className="ops-empty">Bu tedarikçiye atanmış verilen çek bulunmuyor.</p>
        )}
        {supplierChecks.length > 0 && (
          <div className="ops-table">
            <table>
              <thead>
                <tr>
                  {[
                    "Çek No",
                    "Banka",
                    "Vade",
                    "Tutar",
                    "Kalan",
                    "Durum",
                    "Kaynak",
                    "Cari Etkisi",
                  ].map((heading) => <th key={heading}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {supplierChecks.map((check) => (
                  <tr key={check.id}>
                    <td>
                      <Link className="ops-cell-link" to={`/apps/finance/cash/checks/${encodeURIComponent(check.id)}`}>
                        {check.checkNumber || "—"}
                      </Link>
                    </td>
                    <td>{check.bankName || "—"}</td>
                    <td>{check.dueDate || "—"}</td>
                    <td>{formatCheckMoney(check.originalAmount, check.currency)}</td>
                    <td>{formatCheckMoney(check.remainingAmount, check.currency)}</td>
                    <td>{({
                      open: "Açık",
                      upcoming: "Vadesi Gelmedi",
                      due_today: "Bugün Vadeli",
                      overdue: "Gecikmiş",
                      paid: "Ödendi",
                      cancelled: "İptal",
                      returned: "İade",
                    } as const)[check.effectiveStatus]}</td>
                    <td>{check.sourceLabel}</td>
                    <td>{check.debit > 0 ? formatMoney(check.debit, check.currency) : "Bekleyen / bilgi"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <select defaultValue="">
              <option value="">—</option>
              <option>Taslak</option>
              <option>Onaylandı</option>
            </select>
          </label>
          <label>
            İlgili Fatura
            <input />
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
            <select defaultValue="">
              <option value="">—</option>
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
            <select defaultValue="">
              <option value="">—</option>
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
            <select defaultValue="">
              <option value="">—</option>
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
