import { ReactNode, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import { FinanceFormSection, FinancePageHeader } from "./FinanceFormComponents";
import {
  FinanceBackLink,
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
  type InvoiceRow,
} from "./financeIncomeData";
import { crmCustomers } from "../crm/crmCustomerData";
import { OpenChecksReportSection } from "./checks/OpenChecksReportSection";
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
      {!empty && !loading && (
        <div className="income-pagination">
          <span>{Array.isArray(children) ? `${children.length} kayıt` : "—"}</span>
          <label>
            Sayfa boyutu{" "}
            <select defaultValue="10">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </label>
          <button>‹</button>
          <button>›</button>
        </div>
      )}
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

type LiveInvoiceRow = InvoiceRow & { parasutId: string };

type InvoiceApiRow = {
  parasut_id?: unknown;
  partyName?: unknown;
  source_archived?: boolean | null;
  attributes?: {
    archived?: unknown;
    currency?: unknown;
    description?: unknown;
    due_date?: unknown;
    // Paraşüt's own schema (SalesInvoiceAttributes) documents these two the
    // opposite of what their English names suggest: net_total = "Genel
    // Toplam" (VAT-inclusive general total), gross_total = "Ara toplam"
    // (VAT-exclusive subtotal). Verified 2026-08-12 against live production
    // invoices where the list/detail showed gross_total's value (the
    // subtotal) while Paraşüt's own UI showed net_total's value (the real
    // general total) for the same invoices.
    gross_total?: unknown;
    net_total?: unknown;
    total_vat?: unknown;
    invoice_no?: unknown;
    issue_date?: unknown;
    item_type?: unknown;
    payment_status?: unknown;
  } | null;
  relationships?: {
    contact?: {
      data?: { id?: unknown } | null;
    } | null;
  } | null;
};

function sourceText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function invoiceAmount(value: unknown, currencyValue: unknown) {
  const currency = sourceText(currencyValue).toUpperCase().replace(/^TRL$/, "TRY");
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(amount) || !currency) return "—";

  try {
    return formatMoney(amount, currency);
  } catch {
    return "—";
  }
}

function collectionLabel(value: unknown) {
  const status = sourceText(value);
  return (
    {
      paid: "Tahsil Edildi",
      partially_paid: "Kısmen Tahsil Edildi",
      overdue: "Gecikmiş",
      unpaid: "Tahsil Edilecek",
    }[status] ?? status ?? "—"
  ) || "—";
}

const invoiceColumns: ExportColumn<InvoiceRow>[] = [
  { header: "Fatura No", value: (row) => row.no },
  { header: "Müşteri", value: (row) => row.customer },
  { header: "Fatura Tarihi", value: (row) => row.invoiceDate },
  { header: "Vade Tarihi", value: (row) => row.dueDate },
  { header: "Tutar", value: (row) => row.amount },
  { header: "Tahsilat Durumu", value: (row) => row.collection },
  { header: "Durum", value: (row) => row.status },
];

function InvoiceRowActions({ row }: { row: LiveInvoiceRow }) {
  const detailTo = `${incomeInvoicesBase}/${encodeURIComponent(row.parasutId)}`;
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("Tümü");
  const [liveInvoiceRows, setLiveInvoiceRows] = useState<LiveInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoices() {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("parasut-api", {
        body: {
          action: "list",
          resource: "sales_invoices",
          pageSize: 100,
          filters: { archived: false },
          sort: { field: "issue_date", direction: "desc" },
        },
      });

      if (cancelled) return;

      if (error || !Array.isArray(data?.rows)) {
        setLiveInvoiceRows([]);
        setLoading(false);
        return;
      }

      setLiveInvoiceRows(
        (data.rows as InvoiceApiRow[]).map((source) => {
          const attributes = source.attributes ?? {};
          const customerId = sourceText(source.relationships?.contact?.data?.id);
          const partyName = sourceText(source.partyName);
          const itemType = sourceText(attributes.item_type);
          const archived = source.source_archived === true || attributes.archived === true;

          return {
            parasutId: sourceText(source.parasut_id),
            no: sourceText(attributes.invoice_no) || "—",
            customer: partyName && partyName !== customerId ? partyName : "—",
            customerId,
            invoiceDate: sourceText(attributes.issue_date) || "—",
            dueDate: sourceText(attributes.due_date) || "—",
            // net_total is Paraşüt's real VAT-inclusive general total for
            // this resource — see the InvoiceApiRow field comment.
            amount: invoiceAmount(attributes.net_total, attributes.currency),
            collection: collectionLabel(attributes.payment_status),
            status: archived ? "Arşivlendi" : itemType === "cancelled" ? "İptal" : "—",
          };
        }),
      );
      setLoading(false);
    }

    void loadInvoices();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = liveInvoiceRows.filter((row) => {
    const matchesSearch = `${row.no} ${row.customer}`
      .toLocaleLowerCase("tr-TR")
      .includes(search.toLocaleLowerCase("tr-TR"));
    const matchesFrom = !dateFrom || row.invoiceDate >= dateFrom;
    const matchesTo = !dateTo || row.invoiceDate <= dateTo;
    const matchesCollection = collectionFilter === "Tümü" || row.collection === collectionFilter;
    return matchesSearch && matchesFrom && matchesTo && matchesCollection;
  });
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
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          Bitiş Tarihi
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
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
          <select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}>
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
        loading={loading}
        empty={!rows.length}
      >
        {rows.map((row, index) => {
          return (
            <tr key={row.parasutId || `${row.no}-${index}`}>
              <td>
                <Link
                  className="income-cell-link"
                  to={`${incomeInvoicesBase}/${encodeURIComponent(row.parasutId)}`}
                >
                  {row.no}
                </Link>
              </td>
              <td>
                {row.customerId ? (
                  <Link className="income-cell-link" to={`${crmCustomersBase}/${row.customerId}`}>
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
  const max = Math.max(...agingBuckets.map((item) => item.value), 1);
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
      <OpenChecksReportSection direction="received" title="Yaklaşan Tahsilatlar — Açık Alınan Çekler" />
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
          <input type="date" />
        </label>
        <label>
          Bitiş
          <input type="date" />
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
          <input />
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
        empty={!collectionRows.length}
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

type InvoiceDetailData = {
  parasutId: string;
  no: string;
  description: string;
  customer: string;
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  vatTotal: string;
  grandTotal: string;
  collection: string;
  status: string;
  eInvoiceStatus: string;
  lines: {
    key: string;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    vatRate: string;
    vatAmount: string;
    lineTotal: string;
  }[];
};

// A JSON:API to-one relationship is normally { data: { id, type } }, but the
// backend's own relationshipId() helper (supabase/functions/parasut-api/
// handlers.ts) defensively rejects an array shape rather than assuming
// which entry is right — mirrored here so a product reference is never
// silently dropped just because it arrived in the less common shape.
function toOneRelationshipId(ref: unknown): string {
  if (!ref || typeof ref !== "object") return "";
  const data = (ref as { data?: unknown }).data;
  if (!data || Array.isArray(data)) return "";
  return sourceText((data as { id?: unknown }).id);
}

function formatQuantity(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceDetailPage({ invoiceId }: { invoiceId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InvoiceDetailData | null>(null);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke("parasut-api", {
        body: { action: "detail", resource: "sales_invoices", parasutId: invoiceId },
      })
      .then(async ({ data: response, error }) => {
        if (cancelled) return;
        const result = response as {
          header?: InvoiceApiRow | null;
          contact?: { attributes?: Record<string, unknown> | null } | null;
          details?: {
            parasut_id?: unknown;
            productName?: unknown;
            attributes?: {
              description?: unknown;
              quantity?: unknown;
              unit_price?: unknown;
              vat_rate?: unknown;
            } | null;
            relationships?: { product?: { data?: { id?: unknown } | null } | null } | null;
          }[] | null;
        } | null;
        const header = result?.header;
        if (error || !header) {
          setData(null);
          setLoading(false);
          return;
        }
        const attributes = header.attributes ?? {};
        const currency = sourceText(attributes.currency).toUpperCase().replace(/^TRL$/, "TRY") || "TRY";
        const customerId = sourceText(header.relationships?.contact?.data?.id);
        const contactName = sourceText(result?.contact?.attributes?.name);
        const issueDate = sourceText(attributes.issue_date);
        const archived = header.source_archived === true || attributes.archived === true;
        const detailRows = result?.details ?? [];

        // Units live on the product resource (products.attributes.unit),
        // not on the invoice line itself — resolved here via the existing
        // read-only detail/products action (no backend change) for each
        // product actually referenced by this invoice's real lines.
        // toOneRelationshipId (not a plain optional-chain) is used because a
        // relationship that arrived as an array was previously read as
        // undefined, silently dropping the product link for every line.
        const productIds = Array.from(
          new Set(
            detailRows
              .map((detail) => toOneRelationshipId(detail.relationships?.product))
              .filter(Boolean),
          ),
        );
        const unitByProductId = new Map<string, string>();
        if (productIds.length) {
          const productResults = await Promise.all(
            productIds.map((id) =>
              supabase.functions.invoke("parasut-api", { body: { action: "detail", resource: "products", parasutId: id } }),
            ),
          );
          productResults.forEach((productResult, index) => {
            const record = (productResult.data as { record?: { attributes?: Record<string, unknown> | null } } | null)?.record;
            const unit = sourceText(record?.attributes?.unit);
            if (unit) unitByProductId.set(productIds[index], unit);
          });
        }

        // Real e-belge status, if this invoice has one. The previous version
        // used the generic list action's `search` param, which only matches
        // e_invoices.external_id/contact_name/from_vkn/to_vkn — never the
        // invoice_parasut_id relation this needs, so it always returned zero
        // rows. Narrowed instead with the resource's real date filter
        // (issue_date, same calendar day as this invoice) and matched
        // client-side by the real invoice_parasut_id attribute. Left empty
        // — never guessed — if nothing real is found.
        let eInvoiceStatus = "";
        if (issueDate) {
          const eInvoiceResult = await supabase.functions.invoke("parasut-api", {
            body: {
              action: "list",
              resource: "e_invoices",
              pageSize: 100,
              filters: { dueFrom: issueDate, dueTo: issueDate },
            },
          });
          const eInvoiceRows = (eInvoiceResult.data as { rows?: { attributes?: Record<string, unknown> | null }[] } | null)?.rows ?? [];
          const matchedEInvoice = eInvoiceRows.find(
            (row) => sourceText(row.attributes?.invoice_parasut_id) === invoiceId,
          );
          if (matchedEInvoice) {
            eInvoiceStatus = sourceText(matchedEInvoice.attributes?.status);
          }
        }
        if (cancelled) return;

        const lines = detailRows.map((detail) => {
          const detailAttributes = detail.attributes ?? {};
          const quantity = Number(detailAttributes.quantity);
          const unitPrice = Number(detailAttributes.unit_price);
          const vatRate = Number(detailAttributes.vat_rate);
          const lineNet = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : null;
          const vatAmount = lineNet !== null && Number.isFinite(vatRate) ? (lineNet * vatRate) / 100 : null;
          const lineTotal = lineNet !== null && vatAmount !== null ? lineNet + vatAmount : lineNet;
          const productId = toOneRelationshipId(detail.relationships?.product);
          return {
            key: sourceText(detail.parasut_id) || Math.random().toString(36),
            description:
              [sourceText(detail.productName), sourceText(detailAttributes.description)]
                .filter(Boolean)
                .join(" — ") || "—",
            quantity: Number.isFinite(quantity) ? formatQuantity(quantity) : "—",
            unit: unitByProductId.get(productId) ?? "",
            unitPrice: Number.isFinite(unitPrice) ? invoiceAmount(unitPrice, currency) : "—",
            vatRate: Number.isFinite(vatRate) ? `%${vatRate}` : "—",
            vatAmount: vatAmount !== null ? invoiceAmount(vatAmount, currency) : "—",
            lineTotal: lineTotal !== null ? invoiceAmount(lineTotal, currency) : "—",
          };
        });

        setData({
          parasutId: sourceText(header.parasut_id) || invoiceId,
          no: sourceText(attributes.invoice_no) || "—",
          description: sourceText(attributes.description),
          customer: contactName || "—",
          customerId,
          invoiceDate: issueDate || "—",
          dueDate: sourceText(attributes.due_date) || "—",
          currency,
          // See the InvoiceApiRow field comment: Paraşüt's own schema swaps
          // these names — gross_total is the VAT-exclusive subtotal
          // ("Ara toplam"), net_total is the VAT-inclusive general total
          // ("Genel Toplam").
          subtotal: invoiceAmount(attributes.gross_total, currency),
          vatTotal: invoiceAmount(attributes.total_vat, currency),
          grandTotal: invoiceAmount(attributes.net_total, currency),
          collection: collectionLabel(attributes.payment_status),
          // item_type ("invoice"/"estimate"/...) is a document TYPE, not a
          // status — no longer shown as Durum. Durum now only reflects a
          // real, verified state: archived, or a matched e-invoice status.
          status: archived ? "Arşivlendi" : "",
          eInvoiceStatus,
          lines,
        });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="income-page">
        <h1>Yükleniyor…</h1>
      </div>
    );
  }

  if (!invoiceId || !data) {
    return (
      <NotFoundState
        backTo={incomeInvoicesBase}
        backLabel="Faturalara Dön"
        title="Fatura Bulunamadı"
        message={`"${invoiceId ?? ""}" kimlikli bir fatura bulunamadı. Fatura silinmiş veya taşınmış olabilir.`}
      />
    );
  }

  return (
    <div className="income-page">
      <header className="finance-form-header">
        <div>
          <FinanceBreadcrumb value={`Muhasebe ve Finans / Gelir Yönetimi / Faturalar / ${data.no}`} />
          <FinanceBackLink to={incomeInvoicesBase}>Faturalara Dön</FinanceBackLink>
          <h1>{data.description ? `Fatura ${data.no} — ${data.description}` : `Fatura ${data.no}`}</h1>
        </div>
      </header>
      <section className="erp-card income-detail-panel">
        <div className="income-detail-fields">
          <p>
            <span>Fatura No</span>
            <b>{data.no}</b>
          </p>
          <p>
            <span>Müşteri</span>
            <b>
              {data.customerId ? (
                <Link className="income-cell-link" to={`${crmCustomersBase}/${data.customerId}`}>
                  {data.customer}
                </Link>
              ) : (
                data.customer
              )}
            </b>
          </p>
          <p>
            <span>Fatura Tarihi</span>
            <b>{data.invoiceDate}</b>
          </p>
          <p>
            <span>Vade Tarihi</span>
            <b>{data.dueDate}</b>
          </p>
          <p>
            <span>Tahsilat Durumu</span>
            <b>{data.collection}</b>
          </p>
          {data.status && (
            <p>
              <span>Durum</span>
              <b>{data.status}</b>
            </p>
          )}
          {data.eInvoiceStatus && (
            <p>
              <span>E-Fatura Durumu</span>
              <b>{data.eInvoiceStatus}</b>
            </p>
          )}
        </div>
      </section>
      <section className="erp-card income-detail-panel">
        <h2>Fatura Kalemleri</h2>
        {data.lines.length ? (
          <div className="income-table-scroll">
            <table className="income-subtable">
              <thead>
                <tr>
                  <th>Açıklama</th>
                  <th>Miktar</th>
                  <th>Birim Fiyat</th>
                  <th>KDV Oranı</th>
                  <th>KDV Tutarı</th>
                  <th>Satır Toplamı</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.key}>
                    <td>{line.description}</td>
                    <td>{line.unit ? `${line.quantity} ${line.unit}` : line.quantity}</td>
                    <td>{line.unitPrice}</td>
                    <td>{line.vatRate}</td>
                    <td>{line.vatAmount}</td>
                    <td>{line.lineTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Bu faturaya ait kalem verisi bulunamadı.</p>
        )}
        <div className="income-detail-fields" style={{ marginTop: "12px" }}>
          <p>
            <span>Ara Toplam (KDV Hariç)</span>
            <b>{data.subtotal}</b>
          </p>
          <p>
            <span>KDV Toplam</span>
            <b>{data.vatTotal}</b>
          </p>
          <p>
            <span>Genel Toplam (KDV Dahil)</span>
            <b>{data.grandTotal}</b>
          </p>
        </div>
      </section>
      <section className="erp-card">
        <div className="finance-inline-actions" style={{ gap: "12px" }}>
          <Link
            className="finance-text-button"
            to={`${incomeInvoicesBase}/${encodeURIComponent(data.parasutId)}/edit`}
          >
            Düzenle
          </Link>
          <button
            type="button"
            className="finance-text-button"
            style={{ marginLeft: "4px" }}
            onClick={() =>
              printReport(
                `Fatura ${data.no}`,
                invoiceColumns,
                [
                  {
                    no: data.no,
                    customer: data.customer,
                    customerId: data.customerId,
                    invoiceDate: data.invoiceDate,
                    dueDate: data.dueDate,
                    amount: data.grandTotal,
                    collection: data.collection,
                    status: data.status,
                  },
                ],
                `Fatura no ${data.no}`,
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
  if (!customerId) {
    return (
      <NotFoundState
        backTo={incomeCustomersBase}
        backLabel="Müşterilere Dön"
        title="Müşteri Bulunamadı"
        message="Müşteri kimliği eksik."
      />
    );
  }

  return <Navigate to={`${crmCustomersBase}/${customerId}`} replace />;
}
