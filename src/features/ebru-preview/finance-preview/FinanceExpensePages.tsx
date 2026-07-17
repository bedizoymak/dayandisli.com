import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  Download,
  Eye,
  FileInput,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  FinanceFormSection,
  FinanceMetadataPanel,
} from "./FinanceFormComponents";
import { InvoiceLineItemsTable } from "./InvoiceLineItemsTable";
import {
  FinanceBackLink,
  FinanceBreadcrumb,
  FinanceExportMenu,
} from "./FinanceNavigationTools";
import {
  expenseFormDefaults,
  expensePaymentStatuses,
  expenseRows,
  expenseTypes,
  incomingInvoiceRows,
  newExpenseActions,
} from "./financeExpenseData";
import "./finance-expense.css";

const base = "/apps/ebru-preview/finance/expense/list";

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
    <div className="ebru-card expense-filters">
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
    <div className="ebru-card expense-table-wrap">
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

export function ExpenseListPage() {
  const [open, setOpen] = useState(false);
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
          columns={[
            { header: "Kayıt İsmi", value: (row) => row.name },
            { header: "Tedarikçi / Çalışan", value: (row) => row.party },
            { header: "Kayıt Türü", value: (row) => row.type },
            { header: "Düzenleme Tarihi", value: (row) => row.issue },
            { header: "Belge No", value: (row) => row.document },
            { header: "Vade Tarihi", value: (row) => row.due },
            { header: "Toplam Tutar", value: (row) => row.total },
            { header: "Ödeme Durumu", value: (row) => row.payment },
            { header: "Durum", value: (row) => row.status },
          ]}
        />
        <div className="expense-split">
          <button type="button" onClick={() => setOpen((value) => !value)}>
            <Plus /> Yeni Gider <ChevronDown />
          </button>
          {open && (
            <div>
              {newExpenseActions.map((item) => (
                <Link
                  key={item.label}
                  to={item.route}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
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
                  <strong>{row.name}</strong>
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
                  <button
                    className="icon"
                    type="button"
                    aria-label="Kayıt işlemleri"
                  >
                    <MoreHorizontal />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </div>
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
          columns={[
            { header: "Gönderen Ünvan", value: (row) => row.sender },
            { header: "Fatura No", value: (row) => row.number },
            { header: "Fatura Türü", value: (row) => row.type },
            { header: "Fatura Tarihi", value: (row) => row.date },
            { header: "Fatura Tutarı", value: (row) => row.total },
            { header: "Durum", value: (row) => row.status },
          ]}
        />
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
              <tr key={row.number}>
                <td>
                  <strong>{row.sender}</strong>
                </td>
                <td>{row.number}</td>
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
                    <button type="button" title="Görüntüle">
                      <Eye />
                    </button>
                    <button type="button" title="Gider Kaydına Aktar">
                      Aktar
                    </button>
                    <button type="button">Eşleştir</button>
                    <button type="button">Reddet</button>
                    <button type="button" title="İndir">
                      <Download />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </div>
  );
}

function FormActions() {
  return (
    <div className="expense-form-actions">
      <Link to={base}>Vazgeç</Link>
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
}: {
  title: string;
  breadcrumb: string;
  children: ReactNode;
  metadata?: boolean;
}) {
  return (
    <div className="finance-form-page expense-form-page">
      <PageHeader
        breadcrumb={breadcrumb}
        title={title}
        backTo={base}
        backLabel="Gider Listesine Dön"
      />
      <form onSubmit={(event) => event.preventDefault()}>
        <FormActions />
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
  const data = expenseFormDefaults;
  const title = accommodation ? "Yeni Konaklama Faturası" : "Yeni Fiş / Fatura";
  return (
    <FormShell
      title={title}
      breadcrumb={`Muhasebe ve Finans / Gider Yönetimi / Gider Listesi / ${title}`}
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
