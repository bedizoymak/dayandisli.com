import { ReactNode, useState } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { FinanceFormSection, FinancePageHeader } from "./FinanceFormComponents";
import {
  FinanceBreadcrumb,
  FinanceExportMenu,
  RowActionsMenu,
  downloadCsv,
  printReport,
  type ExportColumn,
  type PdfReportExtras,
} from "./FinanceNavigationTools";
import {
  agingBuckets,
  collectionKpis,
  collectionRows,
  customerFormDefaults,
  customerRows,
  invoiceRows,
} from "./financeIncomeData";
import "./finance-income.css";

const incomeInvoicesBase = "/apps/finance/income/invoices";
const incomeCustomersBase = "/apps/finance/income/customers";

function findCustomerByName(name: string) {
  return customerRows.find((row) => row.name === name);
}

function IncomeHeader<T>({
  breadcrumb,
  title,
  subtitle,
  newTo,
  newLabel,
  rows,
  columns,
  filename,
  pdfExtras,
}: {
  breadcrumb: string;
  title: string;
  subtitle: string;
  newTo?: string;
  newLabel?: string;
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
  pdfExtras?: PdfReportExtras;
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
          pdfExtras={pdfExtras}
        />
      </div>
    </header>
  );
}
function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="erp-card income-filters">
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
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
  loading?: boolean;
}) {
  return (
    <section className="erp-card income-table-card">
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
const customerColumns: ExportColumn<(typeof customerRows)[number]>[] = [
  { header: "Müşteri Adı", value: (row) => row.name },
  { header: "Tür", value: (row) => row.type },
  { header: "VKN / TCKN", value: (row) => row.taxNo },
  { header: "E-posta", value: (row) => row.email },
  { header: "Telefon", value: (row) => row.phone },
  { header: "Bakiye", value: (row) => row.balance },
  { header: "Durum", value: (row) => row.status },
];

const invoiceColumns: ExportColumn<(typeof invoiceRows)[number]>[] = [
  { header: "Fatura No", value: (row) => row.no },
  { header: "Müşteri", value: (row) => row.customer },
  { header: "Fatura Tarihi", value: (row) => row.invoiceDate },
  { header: "Vade Tarihi", value: (row) => row.dueDate },
  { header: "Tutar", value: (row) => row.amount },
  { header: "Tahsilat Durumu", value: (row) => row.collection },
  { header: "Durum", value: (row) => row.status },
];

function InvoiceRowActions({ row }: { row: (typeof invoiceRows)[number] }) {
  const detailTo = `${incomeInvoicesBase}/${encodeURIComponent(row.no)}`;
  return (
    <RowActionsMenu
      actions={[
        { label: "Görüntüle", href: detailTo },
        { label: "Düzenle", href: `${detailTo}/edit` },
        { label: "Çoğalt", href: `${incomeInvoicesBase}/new` },
        {
          label: "Dışa Aktar",
          onSelect: () =>
            printReport(
              `Fatura ${row.no}`,
              invoiceColumns,
              [row],
              `Fatura no ${row.no}`,
            ),
        },
        { label: "Arşivle", onSelect: () => undefined },
      ]}
    />
  );
}

export function InvoiceListPage() {
  const [search, setSearch] = useState("");
  const rows = invoiceRows.filter((row) =>
    `${row.no} ${row.customer}`
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
        columns={invoiceColumns}
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
        empty={!rows.length}
      >
        {rows.map((row) => {
          const customer = findCustomerByName(row.customer);
          return (
            <tr key={row.no}>
              <td>
                <Link
                  className="income-cell-link"
                  to={`${incomeInvoicesBase}/${encodeURIComponent(row.no)}`}
                >
                  {row.no}
                </Link>
              </td>
              <td>
                {customer ? (
                  <Link
                    className="income-cell-link"
                    to={`${incomeCustomersBase}/${encodeURIComponent(customer.taxNo)}`}
                  >
                    {row.customer}
                  </Link>
                ) : (
                  row.customer
                )}
              </td>
              <td>{row.invoiceDate}</td>
              <td>{row.dueDate}</td>
              <td>{row.amount}</td>
              <td>
                <Status>{row.collection}</Status>
              </td>
              <td>
                <Status>{row.status}</Status>
              </td>
              <td>
                <InvoiceRowActions row={row} />
              </td>
            </tr>
          );
        })}
      </TableShell>
    </div>
  );
}

export function CustomerListPage() {
  const [search, setSearch] = useState("");
  const rows = customerRows.filter((row) =>
    `${row.name} ${row.taxNo}`
      .toLocaleLowerCase("tr-TR")
      .includes(search.toLocaleLowerCase("tr-TR")),
  );
  return (
    <div className="income-page">
      <IncomeHeader
        breadcrumb="Muhasebe ve Finans / Gelir Yönetimi / Müşteriler"
        title="Müşteriler"
        subtitle="Müşteri hesaplarını görüntüleyin ve yönetin."
        newTo="/apps/finance/income/customers/new"
        newLabel="Yeni Müşteri"
        rows={rows}
        filename="musteriler"
        columns={customerColumns}
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
        empty={!rows.length}
      >
        {rows.map((row) => (
          <tr key={row.taxNo}>
            <td>
              <Link
                className="income-cell-link"
                to={`${incomeCustomersBase}/${encodeURIComponent(row.taxNo)}`}
              >
                {row.name}
              </Link>
            </td>
            <td>{row.type}</td>
            <td>{row.taxNo}</td>
            <td>{row.email}</td>
            <td>{row.phone}</td>
            <td>{row.balance}</td>
            <td>
              <Status>{row.status}</Status>
            </td>
            <td>
              <RowActionsMenu
                actions={[
                  {
                    label: "Görüntüle",
                    href: `${incomeCustomersBase}/${encodeURIComponent(row.taxNo)}`,
                  },
                  {
                    label: "Dışa Aktar",
                    onSelect: () =>
                      printReport(
                        row.name,
                        customerColumns,
                        [row],
                        `Müşteri: ${row.name}`,
                      ),
                  },
                  {
                    label: "CSV İndir",
                    onSelect: () =>
                      downloadCsv(`musteri-${row.taxNo}`, customerColumns, [
                        row,
                      ]),
                  },
                ]}
              />
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
  const max = Math.max(...agingBuckets.map((item) => item.value));
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
        pdfExtras={{
          kpis: collectionKpis,
          chart: {
            title: "Tahsilat Yaşlandırması",
            bars: agingBuckets.map((item) => ({
              label: item.label,
              value: item.value,
            })),
          },
        }}
      />
      <section className="income-kpis">
        {collectionKpis.map((item) => (
          <article className="erp-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>
      <article className="erp-card aging-chart">
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

function NotFoundState({
  backTo,
  backLabel,
  title,
  message,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  message: string;
}) {
  return (
    <div className="income-page">
      <FinancePageHeader
        breadcrumb="Muhasebe ve Finans / Gelir Yönetimi"
        title={title}
        cancelTo={backTo}
        backLabel={backLabel}
      />
      <section className="erp-card income-state-panel">
        <p>{message}</p>
      </section>
    </div>
  );
}

export function InvoiceDetailPage({ invoiceId }: { invoiceId?: string }) {
  const row = invoiceId ? invoiceRows.find((item) => item.no === invoiceId) : undefined;

  if (!invoiceId || !row) {
    return (
      <NotFoundState
        backTo={incomeInvoicesBase}
        backLabel="Faturalara Dön"
        title="Fatura Bulunamadı"
        message={`"${invoiceId ?? ""}" numaralı bir fatura bulunamadı. Fatura silinmiş veya taşınmış olabilir.`}
      />
    );
  }

  const customer = findCustomerByName(row.customer);

  return (
    <div className="income-page">
      <FinancePageHeader
        breadcrumb={`Muhasebe ve Finans / Gelir Yönetimi / Faturalar / ${row.no}`}
        title={`Fatura ${row.no}`}
        cancelTo={incomeInvoicesBase}
        backLabel="Faturalara Dön"
      />
      <section className="erp-card income-detail-panel">
        <div className="finance-fields two">
          <label>
            Fatura No
            <input readOnly value={row.no} />
          </label>
          <label>
            Müşteri
            {customer ? (
              <Link
                className="income-cell-link"
                to={`${incomeCustomersBase}/${encodeURIComponent(customer.taxNo)}`}
              >
                {row.customer}
              </Link>
            ) : (
              <input readOnly value={row.customer} />
            )}
          </label>
          <label>
            Fatura Tarihi
            <input readOnly value={row.invoiceDate} />
          </label>
          <label>
            Vade Tarihi
            <input readOnly value={row.dueDate} />
          </label>
          <label>
            Tutar
            <input readOnly value={row.amount} />
          </label>
          <label>
            Tahsilat Durumu
            <input readOnly value={row.collection} />
          </label>
          <label>
            Durum
            <input readOnly value={row.status} />
          </label>
        </div>
        <div className="finance-inline-actions">
          <Link
            className="finance-text-button"
            to={`${incomeInvoicesBase}/${encodeURIComponent(row.no)}/edit`}
          >
            Düzenle
          </Link>
          <button
            type="button"
            className="finance-text-button"
            onClick={() =>
              printReport(
                `Fatura ${row.no}`,
                invoiceColumns,
                [row],
                `Fatura no ${row.no}`,
              )
            }
          >
            PDF Olarak İndir
          </button>
        </div>
      </section>
    </div>
  );
}

export function FinanceCustomerDetailPage({ customerId }: { customerId?: string }) {
  const row = customerId ? customerRows.find((item) => item.taxNo === customerId) : undefined;

  if (!customerId || !row) {
    return (
      <NotFoundState
        backTo={incomeCustomersBase}
        backLabel="Müşterilere Dön"
        title="Müşteri Bulunamadı"
        message={`"${customerId ?? ""}" VKN/TCKN numarasına ait bir müşteri bulunamadı.`}
      />
    );
  }

  const relatedInvoices = invoiceRows.filter(
    (invoice) => invoice.customer === row.name,
  );

  return (
    <div className="income-page">
      <FinancePageHeader
        breadcrumb={`Muhasebe ve Finans / Gelir Yönetimi / Müşteriler / ${row.name}`}
        title={row.name}
        cancelTo={incomeCustomersBase}
        backLabel="Müşterilere Dön"
      />
      <section className="erp-card income-detail-panel">
        <div className="finance-fields two">
          <label>
            Müşteri Adı
            <input readOnly value={row.name} />
          </label>
          <label>
            Tür
            <input readOnly value={row.type} />
          </label>
          <label>
            VKN / TCKN
            <input readOnly value={row.taxNo} />
          </label>
          <label>
            E-posta
            <input readOnly value={row.email} />
          </label>
          <label>
            Telefon
            <input readOnly value={row.phone} />
          </label>
          <label>
            Bakiye
            <input readOnly value={row.balance} />
          </label>
          <label>
            Durum
            <input readOnly value={row.status} />
          </label>
        </div>
      </section>
      <FinanceFormSection title="Fatura Geçmişi">
        {relatedInvoices.length ? (
          <table className="income-subtable">
            <thead>
              <tr>
                <th>Fatura No</th>
                <th>Fatura Tarihi</th>
                <th>Tutar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {relatedInvoices.map((invoice) => (
                <tr key={invoice.no}>
                  <td>
                    <Link
                      className="income-cell-link"
                      to={`${incomeInvoicesBase}/${encodeURIComponent(invoice.no)}`}
                    >
                      {invoice.no}
                    </Link>
                  </td>
                  <td>{invoice.invoiceDate}</td>
                  <td>{invoice.amount}</td>
                  <td>{invoice.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="income-state">Bu müşteriye ait fatura bulunamadı.</p>
        )}
      </FinanceFormSection>
    </div>
  );
}
