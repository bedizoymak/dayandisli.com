import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Download,
  Eye,
  FileInput,
  Loader2,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import {
  FinanceFormSection,
  FinanceMetadataPanel,
  FinancePageHeader,
} from "./FinanceFormComponents";
import { InvoiceLineItemsTable } from "./InvoiceLineItemsTable";
import {
  FinanceBackLink,
  FinanceBreadcrumb,
  FinanceExportMenu,
  RowActionsMenu,
  printReport,
  type ExportColumn,
} from "./FinanceNavigationTools";
import { suppliers } from "./operationsData";
import {
  expenseFormDefaults,
  expensePaymentStatuses,
  expenseRows,
  expenseTypes,
  incomingInvoiceRows,
  newExpenseActions,
  type ExpenseRow,
} from "./financeExpenseData";
import "./finance-expense.css";

const base = "/apps/finance/expense/list";
const incomingBase = "/apps/finance/expense/incoming-invoices";
const purchasingSuppliersBase = "/apps/finance/purchasing/suppliers";

function findSupplierByName(name: string) {
  return suppliers.find((supplier) => supplier.name === name);
}

type LiveExpenseRow = ExpenseRow & { parasutId: string; supplierId: string };

type PurchaseBillApiRow = {
  parasut_id?: unknown;
  partyName?: unknown;
  source_archived?: boolean | null;
  attributes?: {
    archived?: unknown;
    currency?: unknown;
    description?: unknown;
    due_date?: unknown;
    gross_total?: unknown;
    invoice_no?: unknown;
    issue_date?: unknown;
    item_type?: unknown;
    payment_status?: unknown;
  } | null;
  relationships?: {
    supplier?: {
      data?: { id?: unknown } | null;
    } | null;
  } | null;
};

function purchaseBillSourceText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function purchaseBillAmount(value: unknown, currencyValue: unknown) {
  const currency = purchaseBillSourceText(currencyValue)
    .toUpperCase()
    .replace(/^TRL$/, "TRY");
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

function purchaseBillTypeLabel(value: unknown) {
  const type = purchaseBillSourceText(value);
  return (
    {
      purchase_bill: "Fiş / Fatura",
      recurring_purchase_bill: "Tekrarlayan Alış Faturası",
      refund: "İade",
      cancelled: "İptal",
    }[type] ?? type
  ) || "—";
}

function purchaseBillPaymentLabel(value: unknown) {
  const status = purchaseBillSourceText(value);
  return (
    {
      paid: "Ödendi",
      partially_paid: "Kısmen Ödendi",
      overdue: "Gecikmiş",
      unpaid: "Ödenecek",
    }[status] ?? status
  ) || "—";
}

const expenseColumns: ExportColumn<ExpenseRow>[] = [
  { header: "Kayıt İsmi", value: (row) => row.name },
  { header: "Tedarikçi / Çalışan", value: (row) => row.party },
  { header: "Kayıt Türü", value: (row) => row.type },
  { header: "Düzenleme Tarihi", value: (row) => row.issue },
  { header: "Belge No", value: (row) => row.document },
  { header: "Vade Tarihi", value: (row) => row.due },
  { header: "Toplam Tutar", value: (row) => row.total },
  { header: "Ödeme Durumu", value: (row) => row.payment },
  { header: "Durum", value: (row) => row.status },
];

const incomingInvoiceColumns: ExportColumn<
  (typeof incomingInvoiceRows)[number]
>[] = [
  { header: "Gönderen Ünvan", value: (row) => row.sender },
  { header: "Fatura No", value: (row) => row.number },
  { header: "Fatura Türü", value: (row) => row.type },
  { header: "Fatura Tarihi", value: (row) => row.date },
  { header: "Fatura Tutarı", value: (row) => row.total },
  { header: "Durum", value: (row) => row.status },
];

function PageHeader({
  breadcrumb,
  title,
  subtitle,
  children,
  backTo,
  backLabel,
}: {
  breadcrumb: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <header className="expense-page-header">
      <div>
        <FinanceBreadcrumb value={breadcrumb} />
        {backTo && (
          <FinanceBackLink to={backTo}>
            {backLabel ?? "Listeye Dön"}
          </FinanceBackLink>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="expense-header-actions">{children}</div>}
    </header>
  );
}

type ExpenseFiltersState = {
  dateFrom: string;
  dateTo: string;
  recordType: string;
  paymentStatus: string;
  supplierText: string;
  search: string;
};

const EXPENSE_FILTERS_DEFAULT: ExpenseFiltersState = {
  dateFrom: "",
  dateTo: "",
  recordType: "Tümü",
  paymentStatus: "Tümü",
  supplierText: "",
  search: "",
};

function Filters({
  incoming = false,
  value,
  onChange,
}: {
  incoming?: boolean;
  value?: ExpenseFiltersState;
  onChange?: (next: ExpenseFiltersState) => void;
}) {
  const filters = value ?? EXPENSE_FILTERS_DEFAULT;
  const set = (patch: Partial<ExpenseFiltersState>) => onChange?.({ ...filters, ...patch });
  return (
    <div className="erp-card expense-filters">
      <label>
        Başlangıç
        <input
          type="date"
          value={onChange ? filters.dateFrom : undefined}
          onChange={onChange ? (event) => set({ dateFrom: event.target.value }) : undefined}
        />
      </label>
      <label>
        Bitiş
        <input
          type="date"
          value={onChange ? filters.dateTo : undefined}
          onChange={onChange ? (event) => set({ dateTo: event.target.value }) : undefined}
        />
      </label>
      {incoming ? (
        <>
          <label>
            Gönderen
            <input />
          </label>
          <label>
            Fatura Türü
            <select>
              <option>Tümü</option>
              <option>Ticari e-Fatura</option>
              <option>Temel e-Fatura</option>
              <option>e-Arşiv</option>
            </select>
          </label>
          <label>
            Durum
            <select>
              <option>Tümü</option>
              <option>Onay Bekliyor</option>
              <option>Kabul Edildi</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <label>
            Kayıt Türü
            <select
              value={onChange ? filters.recordType : undefined}
              onChange={onChange ? (event) => set({ recordType: event.target.value }) : undefined}
            >
              <option>Tümü</option>
              {expenseTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Ödeme Durumu
            <select
              value={onChange ? filters.paymentStatus : undefined}
              onChange={onChange ? (event) => set({ paymentStatus: event.target.value }) : undefined}
            >
              <option>Tümü</option>
              {expensePaymentStatuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Tedarikçi
            <input
              value={onChange ? filters.supplierText : undefined}
              onChange={onChange ? (event) => set({ supplierText: event.target.value }) : undefined}
            />
          </label>
          <label>
            Kategori
            <select>
              <option>Tümü</option>
              <option>Malzeme ve Tedarik</option>
            </select>
          </label>
        </>
      )}
      <label className="expense-search">
        <Search />
        <input
          value={onChange ? filters.search : undefined}
          onChange={onChange ? (event) => set({ search: event.target.value }) : undefined}
        />
      </label>
      <button type="button" onClick={() => onChange?.(EXPENSE_FILTERS_DEFAULT)}>
        Filtreleri Temizle
      </button>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={`expense-badge ${String(children).toLocaleLowerCase("tr-TR").replaceAll(" ", "-")}`}
    >
      {children}
    </span>
  );
}
function TableFrame({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  return (
    <div className="erp-card expense-table-wrap">
      <div className="expense-table-scroll">{children}</div>
      <footer>
        <span>{count ? `1-${count} / ${count} kayıt` : "—"}</span>
        <div>
          <button type="button" disabled>
            Önceki
          </button>
          <button type="button">Sonraki</button>
        </div>
      </footer>
    </div>
  );
}

function NewExpenseSplitButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <div className="expense-split" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus /> Yeni Gider <ChevronDown />
      </button>
      {open && (
        <div role="menu">
          {newExpenseActions.map((item) => (
            <Link
              key={item.label}
              role="menuitem"
              to={item.route}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Backend caps a single list call at 100 rows; this company has at least
// 767 real purchase bills (per server/parasut/resource-registry.ts's
// live-verified count), so a single page hid the vast majority of them and
// left search only able to match within that first page. Same
// full-page-fetch convention as CustomerListPage's fetchAllCustomers.
async function fetchAllPurchaseBills(cancelledRef: { cancelled: boolean }) {
  const pageSize = 100;
  const fetchPage = (page: number) =>
    supabase.functions.invoke("parasut-api", {
      body: {
        action: "list",
        resource: "purchase_bills",
        page,
        pageSize,
        filters: { archived: false },
        sort: { field: "issue_date", direction: "desc" },
      },
    });

  const first = await fetchPage(1);
  if (cancelledRef.cancelled) return [] as PurchaseBillApiRow[];
  const firstResponse = first.data as { rows?: unknown; total?: unknown } | null;
  if (first.error || !firstResponse || !Array.isArray(firstResponse.rows)) return [] as PurchaseBillApiRow[];

  const total = typeof firstResponse.total === "number" ? firstResponse.total : null;
  const rows = [...(firstResponse.rows as PurchaseBillApiRow[])];

  if (total !== null) {
    const remainingPages = Math.ceil(total / pageSize) - 1;
    for (let page = 2; page <= remainingPages + 1; page += 1) {
      if (cancelledRef.cancelled) break;
      const next = await fetchPage(page);
      const nextResponse = next.data as { rows?: unknown } | null;
      if (next.error || !nextResponse || !Array.isArray(nextResponse.rows)) break;
      rows.push(...(nextResponse.rows as PurchaseBillApiRow[]));
    }
  }

  return rows;
}

export function ExpenseListPage() {
  const [liveExpenseRows, setLiveExpenseRows] = useState<LiveExpenseRow[]>([]);

  useEffect(() => {
    const cancelledRef = { cancelled: false };

    async function loadExpenses() {
      try {
        const rows = await fetchAllPurchaseBills(cancelledRef);

        if (cancelledRef.cancelled) return;

        setLiveExpenseRows(
          rows.map((source) => {
            const attributes = source.attributes ?? {};
            const supplierId = purchaseBillSourceText(
              source.relationships?.supplier?.data?.id,
            );
            const partyName = purchaseBillSourceText(source.partyName);
            const itemType = purchaseBillSourceText(attributes.item_type);
            const archived =
              source.source_archived === true || attributes.archived === true;

            return {
              parasutId: purchaseBillSourceText(source.parasut_id),
              supplierId,
              name: purchaseBillSourceText(attributes.description) || "—",
              party: partyName && partyName !== supplierId ? partyName : "—",
              type: purchaseBillTypeLabel(itemType),
              issue: purchaseBillSourceText(attributes.issue_date) || "—",
              document: purchaseBillSourceText(attributes.invoice_no) || "—",
              due: purchaseBillSourceText(attributes.due_date) || "—",
              total: purchaseBillAmount(
                attributes.gross_total,
                attributes.currency,
              ),
              payment: purchaseBillPaymentLabel(attributes.payment_status),
              status: archived
                ? "Arşivlendi"
                : itemType === "cancelled"
                  ? "İptal"
                  : "—",
            };
          }),
        );
      } catch {
        if (!cancelledRef.cancelled) setLiveExpenseRows([]);
      }
    }

    void loadExpenses();
    return () => {
      cancelledRef.cancelled = true;
    };
  }, []);

  const [filters, setFilters] = useState<ExpenseFiltersState>(EXPENSE_FILTERS_DEFAULT);
  const rows = liveExpenseRows.filter((row) => {
    if (filters.dateFrom && row.issue < filters.dateFrom) return false;
    if (filters.dateTo && row.issue > filters.dateTo) return false;
    if (filters.recordType !== "Tümü" && row.type !== filters.recordType) return false;
    if (filters.paymentStatus !== "Tümü" && row.payment !== filters.paymentStatus) return false;
    if (
      filters.supplierText.trim() &&
      !row.party.toLocaleLowerCase("tr-TR").includes(filters.supplierText.trim().toLocaleLowerCase("tr-TR"))
    ) {
      return false;
    }
    if (filters.search.trim()) {
      const haystack = `${row.name} ${row.party} ${row.document}`.toLocaleLowerCase("tr-TR");
      if (!haystack.includes(filters.search.trim().toLocaleLowerCase("tr-TR"))) return false;
    }
    return true;
  });

  return (
    <div className="expense-page">
      <PageHeader
        breadcrumb="Muhasebe ve Finans / Gider Yönetimi / Gider Listesi"
        title="Gider Listesi"
        subtitle="Gider, fiş ve alış faturası kayıtlarını görüntüleyin ve yönetin."
      >
        <FinanceExportMenu
          title="Gider Listesi"
          filename="gider-listesi"
          rows={rows}
          columns={expenseColumns}
        />
        <NewExpenseSplitButton />
      </PageHeader>
      <Filters value={filters} onChange={setFilters} />
      <TableFrame count={rows.length}>
        <table className="expense-table">
          <thead>
            <tr>
              {[
                "Kayıt İsmi",
                "Tedarikçi / Çalışan",
                "Kayıt Türü",
                "Düzenleme Tarihi",
                "Belge No",
                "Vade Tarihi",
                "Toplam Tutar",
                "Ödeme Durumu",
                "Durum",
                "İşlemler",
              ].map((item) => (
                <th key={item}>{item}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.parasutId || `${row.document}-${index}`}>
                <td>
                  <Link
                    className="expense-cell-link"
                    to={`${base}/${encodeURIComponent(row.parasutId)}`}
                  >
                    <strong>{row.name}</strong>
                  </Link>
                </td>
                <td>
                  {row.supplierId ? (
                    <Link className="expense-cell-link" to={`${purchasingSuppliersBase}/${row.supplierId}`}>
                      {row.party}
                    </Link>
                  ) : (
                    row.party
                  )}
                </td>
                <td>{row.type}</td>
                <td>{row.issue}</td>
                <td>{row.document}</td>
                <td>{row.due}</td>
                <td>
                  <strong>{row.total}</strong>
                </td>
                <td>
                  <Badge>{row.payment}</Badge>
                </td>
                <td>
                  <Badge>{row.status}</Badge>
                </td>
                <td>
                  <RowActionsMenu
                    label="Kayıt işlemleri"
                    actions={[
                      {
                        label: "Görüntüle",
                        href: `${base}/${encodeURIComponent(row.parasutId)}`,
                      },
                      {
                        label: "Dışa Aktar",
                        onSelect: () =>
                          printReport(
                            row.name,
                            expenseColumns,
                            [row],
                            `Kayıt: ${row.name}`,
                          ),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </div>
  );
}

function IncomingInvoiceRow({
  row,
}: {
  row: (typeof incomingInvoiceRows)[number];
}) {
  const [downloading, setDownloading] = useState(false);
  const supplier = findSupplierByName(row.sender);
  const detailTo = `${incomingBase}/${encodeURIComponent(row.number)}`;

  const download = () => {
    if (downloading) return;
    setDownloading(true);
    window.setTimeout(() => {
      printReport(
        `Gelen Fatura ${row.number}`,
        incomingInvoiceColumns,
        [row],
        `Gönderen: ${row.sender}`,
      );
      setDownloading(false);
    }, 350);
  };

  return (
    <tr>
      <td>
        {supplier ? (
          <Link
            className="expense-cell-link"
            to={`${purchasingSuppliersBase}/${encodeURIComponent(supplier.taxNo)}`}
          >
            <strong>{row.sender}</strong>
          </Link>
        ) : (
          <strong>{row.sender}</strong>
        )}
      </td>
      <td>
        <Link className="expense-cell-link" to={detailTo}>
          {row.number}
        </Link>
      </td>
      <td>{row.type}</td>
      <td>{row.date}</td>
      <td>
        <strong>{row.total}</strong>
      </td>
      <td>
        <Badge>{row.status}</Badge>
      </td>
      <td>
        <div className="expense-row-actions">
          <Link to={detailTo} title="Görüntüle">
            <Eye />
          </Link>
          <button type="button" title="Gider Kaydına Aktar">
            Aktar
          </button>
          <button type="button">Eşleştir</button>
          <button type="button">Reddet</button>
          <button
            type="button"
            title="İndir"
            disabled={downloading}
            aria-busy={downloading}
            onClick={download}
          >
            {downloading ? <Loader2 className="expense-spin" /> : <Download />}
          </button>
        </div>
      </td>
    </tr>
  );
}

type LiveIncomingInvoiceRow = {
  key: string;
  sender: string;
  number: string;
  type: string;
  date: string;
  total: string;
  status: string;
  purchaseBillId: string;
};

type EInvoiceApiRow = {
  attributes?: {
    external_id?: unknown;
    direction?: unknown;
    contact_name?: unknown;
    status?: unknown;
    response_type?: unknown;
    issue_date?: unknown;
    net_total?: unknown;
    currency?: unknown;
    invoice_parasut_id?: unknown;
  } | null;
};

// "Gelen Faturalar" previously rendered the static, permanently-empty
// incomingInvoiceRows mock. The real equivalent is the existing e_invoices
// resource's incoming direction (direction === "in") — already-built
// generic list action, full-page-fetched the same way as
// fetchAllPurchaseBills so a supplier's e-invoices aren't cut off past
// page 1 either.
async function fetchAllIncomingEInvoices(cancelledRef: { cancelled: boolean }) {
  const pageSize = 100;
  const fetchPage = (page: number) =>
    supabase.functions.invoke("parasut-api", {
      body: { action: "list", resource: "e_invoices", page, pageSize },
    });

  const first = await fetchPage(1);
  if (cancelledRef.cancelled) return [] as EInvoiceApiRow[];
  const firstResponse = first.data as { rows?: unknown; total?: unknown } | null;
  if (first.error || !firstResponse || !Array.isArray(firstResponse.rows)) return [] as EInvoiceApiRow[];

  const total = typeof firstResponse.total === "number" ? firstResponse.total : null;
  const rows = [...(firstResponse.rows as EInvoiceApiRow[])];

  if (total !== null) {
    const remainingPages = Math.ceil(total / pageSize) - 1;
    for (let page = 2; page <= remainingPages + 1; page += 1) {
      if (cancelledRef.cancelled) break;
      const next = await fetchPage(page);
      const nextResponse = next.data as { rows?: unknown } | null;
      if (next.error || !nextResponse || !Array.isArray(nextResponse.rows)) break;
      rows.push(...(nextResponse.rows as EInvoiceApiRow[]));
    }
  }

  return rows;
}

export function IncomingInvoicesPage() {
  const [rows, setRows] = useState<LiveIncomingInvoiceRow[]>([]);

  useEffect(() => {
    const cancelledRef = { cancelled: false };
    fetchAllIncomingEInvoices(cancelledRef)
      .then((allRows) => {
        if (cancelledRef.cancelled) return;
        setRows(
          allRows
            .filter((row) => purchaseBillSourceText(row.attributes?.direction) === "in")
            .map((row, index) => {
              const attributes = row.attributes ?? {};
              return {
                key: purchaseBillSourceText(attributes.external_id) || String(index),
                sender: purchaseBillSourceText(attributes.contact_name) || "—",
                number: purchaseBillSourceText(attributes.external_id) || "—",
                type: purchaseBillSourceText(attributes.response_type) || "—",
                date: purchaseBillSourceText(attributes.issue_date) || "—",
                total: purchaseBillAmount(attributes.net_total, attributes.currency),
                status: purchaseBillSourceText(attributes.status) || "—",
                purchaseBillId: purchaseBillSourceText(attributes.invoice_parasut_id),
              };
            }),
        );
      })
      .catch(() => {
        if (!cancelledRef.cancelled) setRows([]);
      });
    return () => {
      cancelledRef.cancelled = true;
    };
  }, []);

  return (
    <div className="expense-page">
      <PageHeader
        breadcrumb="Muhasebe ve Finans / Gider Yönetimi / Gelen Faturalar"
        title="Gelen Faturalar"
        subtitle="Tedarikçilerden gelen e-faturaları görüntüleyin ve yönetin."
      >
        <FinanceExportMenu
          title="Gelen Faturalar"
          filename="gelen-faturalar"
          rows={rows}
          columns={[
            { header: "Gönderen Ünvan", value: (row: LiveIncomingInvoiceRow) => row.sender },
            { header: "Fatura No", value: (row: LiveIncomingInvoiceRow) => row.number },
            { header: "Fatura Türü", value: (row: LiveIncomingInvoiceRow) => row.type },
            { header: "Fatura Tarihi", value: (row: LiveIncomingInvoiceRow) => row.date },
            { header: "Fatura Tutarı", value: (row: LiveIncomingInvoiceRow) => row.total },
            { header: "Durum", value: (row: LiveIncomingInvoiceRow) => row.status },
          ]}
        />
        <Link
          className="expense-primary-link"
          to="/apps/finance/expense/list/new/invoice?from=incoming"
        >
          <Plus /> Yeni Alış Faturası
        </Link>
        <button type="button">
          <FileInput /> Faturaları İçeri Al
        </button>
      </PageHeader>
      <Filters incoming />
      <TableFrame count={rows.length}>
        <table className="expense-table incoming">
          <thead>
            <tr>
              {[
                "Gönderen Ünvan",
                "Fatura No",
                "Fatura Türü",
                "Fatura Tarihi",
                "Fatura Tutarı",
                "Durum",
                "İşlemler",
              ].map((item) => (
                <th key={item}>{item}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <strong>{row.sender}</strong>
                </td>
                <td>
                  {row.purchaseBillId ? (
                    <Link className="expense-cell-link" to={`${base}/${row.purchaseBillId}`}>
                      {row.number}
                    </Link>
                  ) : (
                    row.number
                  )}
                </td>
                <td>{row.type}</td>
                <td>{row.date}</td>
                <td>
                  <strong>{row.total}</strong>
                </td>
                <td>
                  <Badge>{row.status}</Badge>
                </td>
                <td>
                  {row.purchaseBillId && (
                    <Link to={`${base}/${row.purchaseBillId}`} title="Görüntüle">
                      <Eye />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="ops-empty">Gerçek gelen e-fatura kaydı bulunamadı.</p>}
      </TableFrame>
    </div>
  );
}

function FormActions({ cancelTo = base }: { cancelTo?: string }) {
  return (
    <div className="expense-form-actions">
      <Link to={cancelTo}>Vazgeç</Link>
      <button type="button" className="secondary">
        Taslak Kaydet
      </button>
      <button type="submit">Kaydet</button>
    </div>
  );
}
function Payment({ employee = false }: { employee?: boolean }) {
  return (
    <fieldset>
      <legend>Ödeme Durumu</legend>
      <label>
        <input type="radio" name="expense-payment" /> Ödenecek
      </label>
      <label>
        <input type="radio" name="expense-payment" /> Ödendi
      </label>
      {employee && (
        <label>
          <input type="radio" name="expense-payment" /> Çalışan Cebinden Ödedi
        </label>
      )}
    </fieldset>
  );
}
function FormShell({
  title,
  breadcrumb,
  children,
  metadata = true,
  cancelTo = base,
  backLabel = "Gider Listesine Dön",
}: {
  title: string;
  breadcrumb: string;
  children: ReactNode;
  metadata?: boolean;
  cancelTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="finance-form-page expense-form-page">
      <PageHeader
        breadcrumb={breadcrumb}
        title={title}
        backTo={cancelTo}
        backLabel={backLabel}
      />
      <form onSubmit={(event) => event.preventDefault()}>
        <FormActions cancelTo={cancelTo} />
        <div className={`finance-form-layout${metadata ? "" : " single"}`}>
          <main>{children}</main>
          {metadata && (
            <FinanceMetadataPanel
              categoryLabel="Gider Kategorisi"
              category={expenseFormDefaults.category}
              tags={expenseFormDefaults.tags}
              showSpender
            />
          )}
        </div>
      </form>
    </div>
  );
}

export function ExpenseInvoicePage({
  accommodation = false,
}: {
  accommodation?: boolean;
}) {
  const location = useLocation();
  const fromIncoming = new URLSearchParams(location.search).get("from") ===
    "incoming";
  const data = expenseFormDefaults;
  const title = accommodation
    ? "Yeni Konaklama Faturası"
    : fromIncoming
      ? "Yeni Alış Faturası"
      : "Yeni Fiş / Fatura";
  const parentLabel = fromIncoming ? "Gelen Faturalar" : "Gider Listesi";
  const cancelTo = fromIncoming ? incomingBase : base;
  return (
    <FormShell
      title={title}
      breadcrumb={`Muhasebe ve Finans / Gider Yönetimi / ${parentLabel} / ${title}`}
      cancelTo={cancelTo}
      backLabel={
        fromIncoming ? "Gelen Faturalara Dön" : "Gider Listesine Dön"
      }
    >
      <FinanceFormSection title="Fiş / Fatura Bilgileri">
        <div className="finance-fields two">
          <label>
            Kayıt İsmi
            <input defaultValue={data.name} />
          </label>
          <label>
            Tedarikçi
            <select defaultValue={data.supplier}>
              <option>{data.supplier}</option>
            </select>
          </label>
          <label className="wide">
            Tedarikçi Bilgileri
            <textarea defaultValue={data.supplierInfo} />
          </label>
          <label>
            Fiş / Fatura Tarihi
            <input type="date" defaultValue={data.invoiceDate} />
          </label>
          <label>
            Fiş / Fatura Numarası
            <input
              defaultValue={data.invoiceNumber}
            />
          </label>
          <label>
            Toplam Tutar
            <input type="number" defaultValue={data.total} />
          </label>
          <button className="finance-text-button" type="button">
            ₺ Döviz Değiştir
          </button>
        </div>
        <Payment employee={!accommodation} />
        <label>
          Ödeneceği Tarih
          <input type="date" defaultValue={data.paymentDate} />
        </label>
        <div className="finance-upload">
          <Upload />
          <strong>Fiş / Fatura Görseli</strong>
          <span>Dosya yalnızca tarayıcı önizlemesinde seçilir.</span>
          <button type="button">Dosya Yükle</button>
        </div>
      </FinanceFormSection>
      <FinanceFormSection title="Hizmet / Ürün Satırları">
        <InvoiceLineItemsTable
          taxLabel={accommodation ? "Toplam Konaklama Vergisi" : "Toplam KDV"}
        />
      </FinanceFormSection>
    </FormShell>
  );
}

const simpleConfigs = {
  payroll: {
    title: "Yeni Maaş / Prim",
    date: "Hakediş Tarihi",
    party: "Çalışan",
    partyValue: expenseFormDefaults.employee,
  },
  tax: {
    title: "Yeni Vergi / SGK Primi",
    date: "Vade Tarihi",
    party: "Vergi Dönemi",
    partyValue: `${expenseFormDefaults.periodMonth} ${expenseFormDefaults.periodYear}`,
  },
  bank: {
    title: "Yeni Banka Gideri",
    date: "Düzenleme Tarihi",
    party: "Banka",
    partyValue: "",
  },
  other: {
    title: "Diğer Gider",
    date: "Düzenleme Tarihi",
    party: "Tedarikçi / Çalışan",
    partyValue: "",
  },
};
export function SimpleExpenseForm({
  type,
}: {
  type: keyof typeof simpleConfigs;
}) {
  const config = simpleConfigs[type];
  return (
    <FormShell
      title={config.title}
      breadcrumb={`Muhasebe ve Finans / Gider Yönetimi / Gider Listesi / ${config.title}`}
    >
      <FinanceFormSection title="Kayıt Bilgileri">
        <div className="finance-fields two">
          <label>
            Kayıt İsmi
            <input />
          </label>
          <label>
            {config.party}
            <input defaultValue={config.partyValue} />
          </label>
          <label>
            {config.date}
            <input type="date" defaultValue={expenseFormDefaults.invoiceDate} />
          </label>
          <label>
            Toplam Tutar
            <input type="number" />
          </label>
          <label>
            Para Birimi
            <select defaultValue="">
              <option value="">—</option>
              <option>TRY</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
          <label>
            Ödeneceği Tarih
            <input type="date" defaultValue={expenseFormDefaults.paymentDate} />
          </label>
        </div>
        <Payment />
      </FinanceFormSection>
    </FormShell>
  );
}

function ExpenseNotFound({
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
    <div className="expense-page">
      <PageHeader
        breadcrumb="Muhasebe ve Finans / Gider Yönetimi"
        title={title}
        backTo={backTo}
        backLabel={backLabel}
      />
      <section className="erp-card expense-state-panel">
        <p>{message}</p>
      </section>
    </div>
  );
}

type ExpenseDetailData = {
  parasutId: string;
  name: string;
  document: string;
  supplierName: string;
  supplierId: string;
  issue: string;
  due: string;
  total: string;
  vatTotal: string;
  payment: string;
  status: string;
  lines: {
    key: string;
    description: string;
    quantity: string;
    unitPrice: string;
    vatRate: string;
    lineTotal: string;
  }[];
};

export function ExpenseDetailPage({ expenseId }: { expenseId?: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExpenseDetailData | null>(null);

  useEffect(() => {
    if (!expenseId) {
      setLoading(false);
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke("parasut-api", {
        body: { action: "detail", resource: "purchase_bills", parasutId: expenseId },
      })
      .then(({ data: response, error }) => {
        if (cancelled) return;
        const result = response as {
          header?: PurchaseBillApiRow | null;
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
          }[] | null;
        } | null;
        const header = result?.header;
        if (error || !header) {
          setData(null);
          setLoading(false);
          return;
        }
        const attributes = header.attributes ?? {} as Record<string, unknown>;
        const currency = purchaseBillSourceText(attributes.currency).toUpperCase().replace(/^TRL$/, "TRY") || "TRY";
        const supplierId = purchaseBillSourceText(header.relationships?.supplier?.data?.id);
        const supplierName = purchaseBillSourceText(result?.contact?.attributes?.name);
        const itemType = purchaseBillSourceText(attributes.item_type);
        const archived = header.source_archived === true || attributes.archived === true;

        const lines = (result?.details ?? []).map((detail) => {
          const detailAttributes = detail.attributes ?? {};
          const quantity = Number(detailAttributes.quantity);
          const unitPrice = Number(detailAttributes.unit_price);
          const vatRate = Number(detailAttributes.vat_rate);
          const lineNet = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : null;
          const lineTotal =
            lineNet !== null && Number.isFinite(vatRate) ? lineNet * (1 + vatRate / 100) : lineNet;
          return {
            key: purchaseBillSourceText(detail.parasut_id) || Math.random().toString(36),
            description:
              [purchaseBillSourceText(detail.productName), purchaseBillSourceText(detailAttributes.description)]
                .filter(Boolean)
                .join(" — ") || "—",
            quantity: Number.isFinite(quantity) ? quantity.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—",
            unitPrice: Number.isFinite(unitPrice) ? purchaseBillAmount(unitPrice, currency) : "—",
            vatRate: Number.isFinite(vatRate) ? `%${vatRate}` : "—",
            lineTotal: lineTotal !== null ? purchaseBillAmount(lineTotal, currency) : "—",
          };
        });

        setData({
          parasutId: purchaseBillSourceText(header.parasut_id) || expenseId,
          name: purchaseBillSourceText(attributes.description) || "—",
          document: purchaseBillSourceText(attributes.invoice_no) || "—",
          supplierName: supplierName || "—",
          supplierId,
          issue: purchaseBillSourceText(attributes.issue_date) || "—",
          due: purchaseBillSourceText(attributes.due_date) || "—",
          // Same gross_total field the already-approved list column uses —
          // unchanged mapping, not a new calculation.
          total: purchaseBillAmount(attributes.gross_total, currency),
          vatTotal: purchaseBillAmount((attributes as { total_vat?: unknown }).total_vat, currency),
          payment: purchaseBillPaymentLabel(attributes.payment_status),
          status: archived ? "Arşivlendi" : itemType === "cancelled" ? "İptal" : "—",
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
  }, [expenseId]);

  if (loading) {
    return (
      <div className="finance-form-page expense-form-page">
        <PageHeader breadcrumb="Muhasebe ve Finans / Gider Yönetimi" title="Yükleniyor…" />
      </div>
    );
  }

  if (!expenseId || !data) {
    return (
      <ExpenseNotFound
        backTo={base}
        backLabel="Gider Listesine Dön"
        title="Gider Kaydı Bulunamadı"
        message={`"${expenseId ?? ""}" kimlikli bir gider kaydı bulunamadı.`}
      />
    );
  }

  return (
    <div className="finance-form-page expense-form-page">
      <PageHeader
        breadcrumb={`Muhasebe ve Finans / Gider Yönetimi / Gider Listesi / ${data.name}`}
        title={data.name}
        backTo={base}
        backLabel="Gider Listesine Dön"
      />
      <section className="erp-card expense-detail-panel">
        <div className="expense-detail-fields">
          <p>
            <span>Belge No</span>
            <b>{data.document}</b>
          </p>
          <p>
            <span>Tedarikçi</span>
            <b>
              {data.supplierId ? (
                <Link className="expense-cell-link" to={`${purchasingSuppliersBase}/${data.supplierId}`}>
                  {data.supplierName}
                </Link>
              ) : (
                data.supplierName
              )}
            </b>
          </p>
          <p>
            <span>Düzenleme Tarihi</span>
            <b>{data.issue}</b>
          </p>
          <p>
            <span>Vade Tarihi</span>
            <b>{data.due}</b>
          </p>
          <p>
            <span>Ödeme Durumu</span>
            <b>{data.payment}</b>
          </p>
          {data.status && (
            <p>
              <span>Durum</span>
              <b>{data.status}</b>
            </p>
          )}
        </div>
      </section>
      <section className="erp-card expense-detail-panel">
        <h2>Kalemler</h2>
        {data.lines.length ? (
          <div className="expense-table-scroll">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Açıklama</th>
                  <th>Miktar</th>
                  <th>Birim Fiyat</th>
                  <th>KDV Oranı</th>
                  <th>Satır Toplamı</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.key}>
                    <td>{line.description}</td>
                    <td>{line.quantity}</td>
                    <td>{line.unitPrice}</td>
                    <td>{line.vatRate}</td>
                    <td>{line.lineTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Bu kayda ait kalem verisi bulunamadı.</p>
        )}
        <div className="expense-detail-fields" style={{ marginTop: "12px" }}>
          {data.vatTotal !== "—" && (
            <p>
              <span>KDV Toplam</span>
              <b>{data.vatTotal}</b>
            </p>
          )}
          <p>
            <span>Toplam Tutar</span>
            <b>{data.total}</b>
          </p>
        </div>
      </section>
    </div>
  );
}

export function IncomingInvoiceDetailPage({ incomingInvoiceId }: { incomingInvoiceId?: string }) {
  const row = incomingInvoiceId ? incomingInvoiceRows.find((item) => item.number === incomingInvoiceId) : undefined;

  if (!incomingInvoiceId || !row) {
    return (
      <ExpenseNotFound
        backTo={incomingBase}
        backLabel="Gelen Faturalara Dön"
        title="Fatura Bulunamadı"
        message={`"${incomingInvoiceId ?? ""}" numaralı bir gelen fatura bulunamadı.`}
      />
    );
  }

  const supplier = findSupplierByName(row.sender);

  return (
    <div className="finance-form-page expense-form-page">
      <PageHeader
        breadcrumb={`Muhasebe ve Finans / Gider Yönetimi / Gelen Faturalar / ${row.number}`}
        title={`Gelen Fatura ${row.number}`}
        backTo={incomingBase}
        backLabel="Gelen Faturalara Dön"
      />
      <section className="erp-card expense-detail-panel">
        <div className="finance-fields two">
          <label>
            Gönderen Ünvan
            {supplier ? (
              <Link
                className="expense-cell-link"
                to={`${purchasingSuppliersBase}/${encodeURIComponent(supplier.taxNo)}`}
              >
                {row.sender}
              </Link>
            ) : (
              <input readOnly value={row.sender} />
            )}
          </label>
          <label>
            Fatura No
            <input readOnly value={row.number} />
          </label>
          <label>
            Fatura Türü
            <input readOnly value={row.type} />
          </label>
          <label>
            Fatura Tarihi
            <input readOnly value={row.date} />
          </label>
          <label>
            Fatura Tutarı
            <input readOnly value={row.total} />
          </label>
          <label>
            Durum
            <input readOnly value={row.status} />
          </label>
        </div>
        <div className="finance-inline-actions">
          <button
            type="button"
            className="finance-text-button"
            onClick={() =>
              printReport(
                `Gelen Fatura ${row.number}`,
                incomingInvoiceColumns,
                [row],
                `Gönderen: ${row.sender}`,
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
