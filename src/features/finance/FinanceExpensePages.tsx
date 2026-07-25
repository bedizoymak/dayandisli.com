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
} from "./financeExpenseData";
import "./finance-expense.css";

const base = "/apps/finance/expense/list";
const incomingBase = "/apps/finance/expense/incoming-invoices";
const purchasingSuppliersBase = "/apps/finance/purchasing/suppliers";

function findSupplierByName(name: string) {
  return suppliers.find((supplier) => supplier.name === name);
}

const expenseColumns: ExportColumn<(typeof expenseRows)[number]>[] = [
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

function Filters({ incoming = false }: { incoming?: boolean }) {
  return (
    <div className="erp-card expense-filters">
      <label>
        Başlangıç
        <input type="date" />
      </label>
      <label>
        Bitiş
        <input type="date" />
      </label>
      {incoming ? (
        <>
          <label>
            Gönderen
            <input placeholder="Tüm gönderenler" />
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
            <select>
              <option>Tümü</option>
              {expenseTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Ödeme Durumu
            <select>
              <option>Tümü</option>
              {expensePaymentStatuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Tedarikçi
            <input placeholder="Tümü" />
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
        <input placeholder="Ara..." />
      </label>
      <button type="button">Filtreleri Temizle</button>
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
function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="erp-card expense-table-wrap">
      <div className="expense-table-scroll">{children}</div>
      <footer>
        <span>1-4 / 4 kayıt</span>
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

export function ExpenseListPage() {
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
          rows={expenseRows}
          columns={expenseColumns}
        />
        <NewExpenseSplitButton />
      </PageHeader>
      <Filters />
      <TableFrame>
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
            {expenseRows.map((row) => (
              <tr key={row.document}>
                <td>
                  <Link
                    className="expense-cell-link"
                    to={`${base}/${encodeURIComponent(row.document)}`}
                  >
                    <strong>{row.name}</strong>
                  </Link>
                </td>
                <td>{row.party}</td>
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
                        href: `${base}/${encodeURIComponent(row.document)}`,
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

export function IncomingInvoicesPage() {
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
          rows={incomingInvoiceRows}
          columns={incomingInvoiceColumns}
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
      <TableFrame>
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
            {incomingInvoiceRows.map((row) => (
              <IncomingInvoiceRow row={row} key={row.number} />
            ))}
          </tbody>
        </table>
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
        <input type="radio" name="expense-payment" defaultChecked /> Ödenecek
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
              placeholder="Belge numarası"
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
    partyValue: "Garanti BBVA",
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
            <input defaultValue={config.title} />
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
            <input type="number" defaultValue="0" />
          </label>
          <label>
            Para Birimi
            <select defaultValue="TRY">
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

export function ExpenseDetailPage({ expenseId }: { expenseId?: string }) {
  const row = expenseId ? expenseRows.find((item) => item.document === expenseId) : undefined;

  if (!expenseId || !row) {
    return (
      <ExpenseNotFound
        backTo={base}
        backLabel="Gider Listesine Dön"
        title="Gider Kaydı Bulunamadı"
        message={`"${expenseId ?? ""}" belge numaralı bir gider kaydı bulunamadı.`}
      />
    );
  }

  return (
    <div className="finance-form-page expense-form-page">
      <PageHeader
        breadcrumb={`Muhasebe ve Finans / Gider Yönetimi / Gider Listesi / ${row.name}`}
        title={row.name}
        backTo={base}
        backLabel="Gider Listesine Dön"
      />
      <section className="erp-card expense-detail-panel">
        <div className="finance-fields two">
          <label>
            Kayıt İsmi
            <input readOnly value={row.name} />
          </label>
          <label>
            Tedarikçi / Çalışan
            <input readOnly value={row.party} />
          </label>
          <label>
            Kayıt Türü
            <input readOnly value={row.type} />
          </label>
          <label>
            Belge No
            <input readOnly value={row.document} />
          </label>
          <label>
            Düzenleme Tarihi
            <input readOnly value={row.issue} />
          </label>
          <label>
            Vade Tarihi
            <input readOnly value={row.due} />
          </label>
          <label>
            Toplam Tutar
            <input readOnly value={row.total} />
          </label>
          <label>
            Ödeme Durumu
            <input readOnly value={row.payment} />
          </label>
          <label>
            Durum
            <input readOnly value={row.status} />
          </label>
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
