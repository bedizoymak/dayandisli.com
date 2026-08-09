import { ReactNode, useState } from "react";
import { Search } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
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
  invoiceRows,
} from "./financeIncomeData";
import { crmCustomers } from "../crm/crmCustomerData";
import "./finance-income.css";

const incomeInvoicesBase = "/apps/finance/income/invoices";
const incomeCustomersBase = "/apps/finance/income/customers";
const crmCustomersBase = "/apps/crm/customers";

function findCrmCustomer(customerId?: string) {
  return customerId ? crmCustomers.find((row) => row.id === customerId) : undefined;
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
const customerColumns: ExportColumn<(typeof crmCustomers)[number]>[] = [
  { header: "Müşteri Adı", value: (row) => row.name },
  { header: "Tür", value: (row) => row.type },
  { header: "VKN / TCKN", value: (row) => row.taxNo },
  { header: "E-posta", value: (row) => row.email },
  { header: "Telefon", value: (row) => row.phone },
  { header: "Bakiye", value: (row) => row.balance },
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
          const customer = findCrmCustomer(row.customerId);
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
                  <Link className="income-cell-link" to={`${crmCustomersBase}/${customer.id}`}>
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
  const rows = crmCustomers.filter((row) =>
    `${row.name} ${row.taxNo}`
      .toLocaleLowerCase("tr-TR")
      .includes(search.toLocaleLowerCase("tr-TR")),
  );
  return (
    <div className="income-page">
      <IncomeHeader
        breadcrumb="Muhasebe ve Finans / Gelir Yönetimi / Müşteriler"
        title="Müşteriler"
        subtitle="Müşteri hesaplarını görüntüleyin ve yönetin. (Müşteri İlişkileri modülüyle ortak kayıt.)"
        newTo="/apps/crm/customers/new"
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
          "İşlemler",
        ]}
        empty={!rows.length}
      >
        {rows.map((row) => (
          <tr key={row.taxNo}>
            <td>
              <Link
                className="income-cell-link"
                to={`${crmCustomersBase}/${row.id}`}
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
              <RowActionsMenu
                actions={[
                  {
                    label: "Görüntüle",
                    href: `${crmCustomersBase}/${row.id}`,
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

// Müşteri oluşturma artık tek kaynak: Müşteri İlişkileri (CRM) modülündeki
// /apps/crm/customers/new sayfası. Bu route sadece eski bağlantılar/yer
// imleri için geriye dönük bir yönlendirme olarak korunuyor.
export function CustomerFormPage() {
  return <Navigate to="/apps/crm/customers/new" replace />;
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
        {collectionRows.map((row) => {
          const party = findCrmCustomer(row.partyId);
          return (
            <tr key={row.document}>
              <td>{row.collectionDate}</td>
              <td>{row.documentDate}</td>
              <td>
                {party ? (
                  <Link className="income-cell-link" to={`${crmCustomersBase}/${party.id}`}>
                    {row.party}
                  </Link>
                ) : (
                  row.party
                )}
              </td>
              <td>{row.document}</td>
              <td>{row.amount}</td>
            </tr>
          );
        })}
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

  const customer = findCrmCustomer(row.customerId);

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
              <Link className="income-cell-link" to={`${crmCustomersBase}/${customer.id}`}>
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

// Müşteri kartı artık tek kaynak: Müşteri İlişkileri (CRM) modülündeki
// /apps/crm/customers/:id sayfası. Bu route sadece eski bağlantılar/yer
// imleri için geriye dönük bir yönlendirme olarak korunuyor.
export function FinanceCustomerDetailPage({ customerId }: { customerId?: string }) {
  const customer = findCrmCustomer(customerId);

  if (!customerId || !customer) {
    return (
      <NotFoundState
        backTo={incomeCustomersBase}
        backLabel="Müşterilere Dön"
        title="Müşteri Bulunamadı"
        message={`"${customerId ?? ""}" kimliğine ait bir müşteri bulunamadı.`}
      />
    );
  }

  return <Navigate to={`${crmCustomersBase}/${customer.id}`} replace />;
}
