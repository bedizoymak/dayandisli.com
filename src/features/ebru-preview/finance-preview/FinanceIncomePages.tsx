import { ReactNode, useEffect, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { FinanceFormSection, FinancePageHeader } from "./FinanceFormComponents";
import {
  FinanceBreadcrumb,
  FinanceExportMenu,
  type ExportColumn,
} from "./FinanceNavigationTools";
import {
  agingBuckets,
  collectionKpis,
  collectionRows,
  customerFormDefaults,
} from "./financeIncomeData";
import "./finance-income.css";
import { listInvoices, listStakeholders } from "@/features/erp/shared/erpApi";
import { formatCurrency, formatDate } from "@/features/erp/shared/formatters";
import { INVOICE_STATUS_LABELS } from "@/features/erp/shared/statusLabels";
import type { Invoice, Stakeholder } from "@/features/erp/shared/types";

function IncomeHeader<T>({
  breadcrumb,
  title,
  subtitle,
  newTo,
  newLabel,
  rows,
  columns,
  filename,
}: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  newTo?: string;
  newLabel?: string;
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
}) {
  return (
    <header className="income-page-head">
      <div>
        <FinanceBreadcrumb value={breadcrumb} />
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div>
        {newTo && (
          <Link className="income-primary" to={newTo}>
            {newLabel}
          </Link>
        )}
        <FinanceExportMenu
          title={title}
          filename={filename}
          rows={rows}
          columns={columns}
        />
      </div>
    </header>
  );
}
function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="ebru-card income-filters">
      {children}
      <button className="income-filter-button">Filtrele</button>
      <button className="income-clear">Filtreleri Temizle</button>
    </div>
  );
}
function Status({ children }: { children: ReactNode }) {
  const value = String(children);
  return (
    <span
      className={`income-status ${value.includes("Gecik") || value === "Pasif" ? "danger" : value.includes("Edildi") || value === "Aktif" || value === "Kapandı" ? "success" : "info"}`}
    >
      {children}
    </span>
  );
}
function TableShell({
  headers,
  children,
  empty = false,
  loading = false,
  error = null,
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <section className="ebru-card income-table-card">
      <div className="income-table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header} ↕</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="income-state">
                  Yükleniyor…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={headers.length} className="income-state income-state-error">
                  Veriler yüklenemedi: {error}
                </td>
              </tr>
            ) : empty ? (
              <tr>
                <td colSpan={headers.length} className="income-state">
                  Gösterilecek kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      <div className="income-pagination">
        <span>1–{Array.isArray(children) ? children.length : 4} / 24</span>
        <label>
          Sayfa boyutu{" "}
          <select defaultValue="10">
            <option>10</option>
            <option>25</option>
            <option>50</option>
          </select>
        </label>
        <button>‹</button>
        <button>1</button>
        <button>2</button>
        <button>›</button>
      </div>
    </section>
  );
}
const RowActions = () => (
  <button
    className="income-row-actions"
    title="Görüntüle · Düzenle · Çoğalt · Dışa Aktar · Arşivle"
  >
    <MoreHorizontal />
  </button>
);

export function InvoiceListPage() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([listInvoices(), listStakeholders()]).then(([invoiceResult, stakeholderResult]) => {
      if (cancelled) return;
      setInvoices(invoiceResult.data.filter((invoice) => invoice.invoice_type === "sales"));
      setStakeholders(stakeholderResult.data);
      setError(invoiceResult.error ?? stakeholderResult.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stakeholderName = (stakeholderId: string | null) =>
    stakeholders.find((stakeholder) => stakeholder.id === stakeholderId)?.company_name ?? "-";

  const rows = invoices.filter((invoice) =>
    `${invoice.invoice_no ?? ""} ${stakeholderName(invoice.stakeholder_id)}`
      .toLocaleLowerCase("tr-TR")
      .includes(search.toLocaleLowerCase("tr-TR")),
  );
  return (
    <div className="income-page">
      <IncomeHeader
        breadcrumb="Muhasebe ve Finans / Gelir Yönetimi / Faturalar"
        title="Faturalar"
        subtitle="Satış faturalarını görüntüleyin, filtreleyin ve yönetin."
        newTo="/apps/finance/income/invoices/new"
        newLabel="Yeni Fatura"
        rows={rows}
        filename="faturalar"
        columns={[
          { header: "Fatura No", value: (row) => row.invoice_no ?? "-" },
          { header: "Müşteri", value: (row) => stakeholderName(row.stakeholder_id) },
          { header: "Fatura Tarihi", value: (row) => formatDate(row.invoice_date) },
          { header: "Vade Tarihi", value: (row) => formatDate(row.due_date) },
          { header: "Tutar", value: (row) => formatCurrency(row.grand_total, row.currency) },
          { header: "Tahsilat Durumu", value: () => "—" },
          { header: "Durum", value: (row) => INVOICE_STATUS_LABELS[row.status] },
        ]}
      />
      <FilterBar>
        <label>
          Başlangıç Tarihi
          <input type="date" defaultValue="2026-07-01" />
        </label>
        <label>
          Bitiş Tarihi
          <input type="date" defaultValue="2026-07-31" />
        </label>
        <label>
          Durum
          <select>
            <option>Tümü</option>
            <option>Onaylandı</option>
            <option>Kapandı</option>
          </select>
        </label>
        <label>
          Tahsilat Durumu
          <select>
            <option>Tümü</option>
            <option>Tahsil Edilecek</option>
            <option>Tahsil Edildi</option>
          </select>
        </label>
        <label className="income-search">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Fatura veya müşteri ara"
          />
        </label>
      </FilterBar>
      <TableShell
        headers={[
          "Fatura No",
          "Müşteri",
          "Fatura Tarihi",
          "Vade Tarihi",
          "Tutar",
          "Tahsilat Durumu",
          "Durum",
          "İşlemler",
        ]}
        empty={!loading && !error && !rows.length}
        loading={loading}
        error={error}
      >
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <Link to="/apps/finance/income/invoices/new">
                {row.invoice_no ?? "-"}
              </Link>
            </td>
            <td>{stakeholderName(row.stakeholder_id)}</td>
            <td>{formatDate(row.invoice_date)}</td>
            <td>{formatDate(row.due_date)}</td>
            <td>{formatCurrency(row.grand_total, row.currency)}</td>
            <td>
              <Status>—</Status>
            </td>
            <td>
              <Status>{INVOICE_STATUS_LABELS[row.status]}</Status>
            </td>
            <td>
              <RowActions />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

export function CustomerListPage() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Stakeholder[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listStakeholders(search, "customer").then((result) => {
      if (cancelled) return;
      setCustomers(result.data);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div className="income-page">
      <IncomeHeader
        breadcrumb="Muhasebe ve Finans / Gelir Yönetimi / Müşteriler"
        title="Müşteriler"
        subtitle="Müşteri hesaplarını görüntüleyin ve yönetin."
        newTo="/apps/finance/income/customers/new"
        newLabel="Yeni Müşteri"
        rows={customers}
        filename="musteriler"
        columns={[
          { header: "Müşteri Adı", value: (row) => row.company_name },
          { header: "Tür", value: (row) => row.type === "customer" ? "Müşteri" : row.type },
          { header: "VKN / TCKN", value: (row) => row.tax_number ?? "-" },
          { header: "E-posta", value: (row) => row.email ?? "-" },
          { header: "Telefon", value: (row) => row.phone ?? "-" },
          { header: "Bakiye", value: (row) => formatCurrency(row.current_balance) },
          { header: "Durum", value: (row) => (row.is_active ? "Aktif" : "Pasif") },
        ]}
      />
      <FilterBar>
        <label className="income-search">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ad veya VKN / TCKN ara"
          />
        </label>
        <label>
          Durum
          <select>
            <option>Tümü</option>
            <option>Aktif</option>
            <option>Pasif</option>
          </select>
        </label>
        <label>
          Bakiye Durumu
          <select>
            <option>Tümü</option>
            <option>Borçlu</option>
            <option>Alacaklı</option>
            <option>Dengede</option>
          </select>
        </label>
      </FilterBar>
      <TableShell
        headers={[
          "Müşteri Adı",
          "Tür",
          "VKN / TCKN",
          "E-posta",
          "Telefon",
          "Bakiye",
          "Durum",
          "İşlemler",
        ]}
        empty={!loading && !error && !customers.length}
        loading={loading}
        error={error}
      >
        {customers.map((row) => (
          <tr key={row.id}>
            <td>{row.company_name}</td>
            <td>{row.type === "customer" ? "Müşteri" : row.type}</td>
            <td>{row.tax_number ?? "-"}</td>
            <td>{row.email ?? "-"}</td>
            <td>{row.phone ?? "-"}</td>
            <td>{formatCurrency(row.current_balance)}</td>
            <td>
              <Status>{row.is_active ? "Aktif" : "Pasif"}</Status>
            </td>
            <td>
              <RowActions />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

export function CustomerFormPage() {
  const data = customerFormDefaults;
  return (
    <div className="finance-form-page">
      <FinancePageHeader
        breadcrumb="Muhasebe ve Finans / Gelir Yönetimi / Müşteriler / Yeni Müşteri"
        title="Yeni Müşteri"
        cancelTo="/apps/finance/income/customers"
        backLabel="Müşterilere Dön"
      />
      <form
        className="customer-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <FinanceFormSection title="Temel Bilgiler">
          <div className="finance-fields two">
            <label>
              VKN / TCKN
              <input defaultValue={data.taxNo} />
            </label>
            <fieldset>
              <legend>Tür</legend>
              <label>
                <input type="radio" name="customerType" defaultChecked /> Tüzel
                Kişi
              </label>
              <label>
                <input type="radio" name="customerType" /> Gerçek Kişi
              </label>
            </fieldset>
            <label>
              Firma Ünvanı
              <input defaultValue={data.companyName} />
            </label>
            <label>
              Kısa İsim
              <input defaultValue={data.shortName} />
            </label>
            <label>
              Vergi Dairesi
              <input defaultValue={data.taxOffice} />
            </label>
            <label>
              Kategori
              <select defaultValue={data.category}>
                <option>{data.category}</option>
              </select>
            </label>
          </div>
        </FinanceFormSection>
        <FinanceFormSection title="İletişim Bilgileri">
          <div className="finance-fields two">
            <label>
              E-posta Adresi
              <input type="email" defaultValue={data.email} />
            </label>
            <label>
              Telefon Numarası
              <input defaultValue={data.phone} />
            </label>
            <label>
              Faks Numarası
              <input defaultValue={data.fax} />
            </label>
            <label className="finance-check">
              <input type="checkbox" /> Adres Yurt Dışında
            </label>
            <label className="wide">
              Açık Adres
              <textarea defaultValue={data.address} />
            </label>
            <label>
              Posta Kodu
              <input defaultValue={data.postalCode} />
            </label>
            <label>
              İlçe
              <input defaultValue={data.district} />
            </label>
            <label>
              İl
              <input defaultValue={data.city} />
            </label>
          </div>
        </FinanceFormSection>
        <FinanceFormSection title="Finansal Bilgiler">
          <div className="finance-fields two">
            <label className="wide">
              IBAN Numarası
              <input defaultValue={data.iban} />
            </label>
            <button type="button" className="finance-text-button">
              ＋ Yeni IBAN Ekle
            </button>
            <label>
              Fiyat Listesi
              <select defaultValue={data.priceList}>
                <option>{data.priceList}</option>
              </select>
            </label>
            <fieldset>
              <legend>Döviz Kuru</legend>
              <label>
                <input type="radio" name="currencySide" /> Alış
              </label>
              <label>
                <input type="radio" name="currencySide" defaultChecked /> Satış
              </label>
            </fieldset>
            <label>
              Açılış Bakiyesi
              <input type="number" defaultValue={data.openingBalance} />
            </label>
            <label className="finance-check">
              <input type="checkbox" /> Açılış Bakiyesi Var
            </label>
          </div>
        </FinanceFormSection>
        <FinanceFormSection title="Yetkili Kişiler">
          {data.contacts.map((contact) => (
            <div className="finance-fields two" key={contact.email}>
              <label>
                Yetkili Kişi Adı
                <input defaultValue={contact.name} />
              </label>
              <label>
                E-posta
                <input defaultValue={contact.email} />
              </label>
              <label>
                Telefon
                <input defaultValue={contact.phone} />
              </label>
              <label>
                Notlar
                <input defaultValue={contact.note} />
              </label>
            </div>
          ))}
          <button type="button" className="finance-text-button">
            ＋ Yeni Yetkili Ekle
          </button>
        </FinanceFormSection>
      </form>
    </div>
  );
}

export function CollectionReportPage() {
  const max = Math.max(1, ...agingBuckets.map((item) => item.value));
  return (
    <div className="income-page">
      <IncomeHeader
        breadcrumb="Muhasebe ve Finans / Gelir Yönetimi / Tahsilat Raporu"
        title="Tahsilat Raporu"
        subtitle="Fatura ve tahsilat verilerinden oluşturulan yaşlandırma raporu."
        rows={collectionRows}
        filename="tahsilat-raporu"
        columns={[
          { header: "Tahsilat Tarihi", value: (row) => row.collectionDate },
          { header: "Fatura / Çek Tarihi", value: (row) => row.documentDate },
          {
            header: "Müşteri / Tedarikçi / Çalışan",
            value: (row) => row.party,
          },
          { header: "Fatura / Çek", value: (row) => row.document },
          { header: "Tahsilat Tutarı", value: (row) => row.amount },
        ]}
      />
      <section className="income-kpis">
        {collectionKpis.map((item) => (
          <article className="ebru-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>
      <article className="ebru-card aging-chart">
        <h2>Tahsilat Yaşlandırması</h2>
        <div className="aging-bars">
          {agingBuckets.map((item) => (
            <div key={item.label}>
              <span>{item.value}K</span>
              <i
                style={{ height: `${Math.max(10, (item.value / max) * 100)}%` }}
              />
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </article>
      <FilterBar>
        <label>
          Başlangıç
          <input type="date" defaultValue="2026-07-01" />
        </label>
        <label>
          Bitiş
          <input type="date" defaultValue="2026-07-31" />
        </label>
        <label>
          Müşteri
          <select>
            <option>Tümü</option>
          </select>
        </label>
        <label>
          Fatura Türü
          <select>
            <option>Tümü</option>
          </select>
        </label>
        <label className="income-search">
          <Search />
          <input placeholder="Raporda ara" />
        </label>
      </FilterBar>
      <TableShell
        headers={[
          "Tahsilat Tarihi",
          "Fatura / Çek Tarihi",
          "Müşteri / Tedarikçi / Çalışan",
          "Fatura / Çek",
          "Tahsilat Tutarı",
        ]}
      >
        {collectionRows.map((row) => (
          <tr key={row.document}>
            <td>{row.collectionDate}</td>
            <td>{row.documentDate}</td>
            <td>{row.party}</td>
            <td>{row.document}</td>
            <td>{row.amount}</td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
