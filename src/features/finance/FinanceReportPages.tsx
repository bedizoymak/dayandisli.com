import { useEffect, useState, type ReactNode } from "react";
import { Filter, Landmark, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import {
  FinanceBackLink,
  FinanceBreadcrumb,
  FinanceExportMenu,
  type ExportColumn,
  type PdfReportExtras,
} from "./FinanceNavigationTools";
import {
  incomeExpenseReport,
  paymentAging,
  pendingPayments,
  vatDetails,
  vatMonths,
} from "./financeReportData";
import { expenseRows } from "./financeExpenseData";
import {
  cashChart,
  cashFlowGrid,
  cashMovements,
  checks,
  flowTransactions,
  type CashAccount,
} from "./cashReportData";
import { OpenChecksReportSection } from "./checks/OpenChecksReportSection";
import "./finance-reports.css";

function Header<T>({
  breadcrumb,
  title,
  rows,
  columns,
  filename,
  actions,
  pdfExtras,
}: {
  breadcrumb: string;
  title: string;
  rows?: T[];
  columns?: ExportColumn<T>[];
  filename?: string;
  actions?: ReactNode;
  pdfExtras?: PdfReportExtras;
}) {
  return (
    <header className="report-head">
      <div>
        <FinanceBreadcrumb value={breadcrumb} />
        <h1>{title}</h1>
      </div>
      <div>
        {actions}
        {rows && columns && filename && (
          <FinanceExportMenu
            title={title}
            rows={rows}
            columns={columns}
            filename={filename}
            pdfExtras={pdfExtras}
          />
        )}
      </div>
    </header>
  );
}
function DateFilters({ tax = false }: { tax?: boolean }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <div className="erp-card report-filters">
      <label>
        Başlangıç
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        Bitiş
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      {tax && (
        <label>
          KDV / Vergiler
          <select>
            <option>Dahil</option>
            <option>Hariç</option>
          </select>
        </label>
      )}
      <button type="button">
        <Filter /> Filtrele
      </button>
    </div>
  );
}
function Table<T>({
  columns,
  rows,
}: {
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  return (
    <div className="erp-card report-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.header}>{column.value(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const paymentColumns: ExportColumn<(typeof pendingPayments)[number]>[] = [
  { header: "Kayıt İsmi", value: (r) => r.name },
  { header: "Düzenleme Tarihi", value: (r) => r.issue },
  { header: "Ödeme Tarihi", value: (r) => r.due },
  { header: "Gecikme Bilgisi", value: (r) => r.delay },
  { header: "Ödenecek Meblağ", value: (r) => r.amount },
];
const vatMonthColumns: ExportColumn<(typeof vatMonths)[number]>[] = [
  { header: "Ay", value: (r) => r.month },
  { header: "Hesaplanan KDV", value: (r) => r.calculated },
  { header: "İndirilecek KDV", value: (r) => r.deductible },
  { header: "Net KDV", value: (r) => r.net },
];
const vatDetailColumns: ExportColumn<(typeof vatDetails)[number]>[] = [
  { header: "İşlem Türü", value: (r) => r.type },
  { header: "Fatura No", value: (r) => r.no },
  { header: "Kayıt İsmi", value: (r) => r.name },
  { header: "Müşteri / Tedarikçi", value: (r) => r.party },
  { header: "Düzenleme Tarihi", value: (r) => r.date },
  { header: "KDV", value: (r) => r.vat },
];

export function IncomeExpenseReportPage() {
  const rows = [
    ...incomeExpenseReport.income.map((r) => ({ type: "Gelir", ...r })),
    ...incomeExpenseReport.expense.map((r) => ({ type: "Gider", ...r })),
  ];
  const columns = [
    { header: "Tür", value: (r: (typeof rows)[number]) => r.type },
    { header: "Kategori", value: (r: (typeof rows)[number]) => r.name },
    { header: "Tutar", value: (r: (typeof rows)[number]) => r.amount },
    { header: "Dağılım", value: (r: (typeof rows)[number]) => `%${r.share}` },
  ];
  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Gider Yönetimi / Gelir Gider Raporu"
        title="Gelir ve Gider Raporu"
        rows={rows}
        columns={columns}
        filename="gelir-gider-raporu"
      />
      <DateFilters tax />
      <div className="income-expense-grid">
        {[
          {
            title: "Gelirler",
            rows: incomeExpenseReport.income,
            total: incomeExpenseReport.totals.income,
            tone: "income",
          },
          {
            title: "Giderler",
            rows: incomeExpenseReport.expense,
            total: incomeExpenseReport.totals.expense,
            tone: "expense",
          },
        ].map((section) => (
          <article
            className="erp-card report-distribution"
            key={section.title}
          >
            <div>
              <h2>{section.title}</h2>
              {section.rows.map((row) => (
                <p key={row.name}>
                  <span>{row.name}</span>
                  <strong>{row.amount}</strong>
                </p>
              ))}
              <footer>
                <span>Toplam</span>
                <strong>{section.total}</strong>
              </footer>
            </div>
            <span>—</span>
          </article>
        ))}
      </div>
      <article className="erp-card report-net">
        <span>Net</span>
        <strong>{incomeExpenseReport.totals.net}</strong>
      </article>
    </div>
  );
}

const paymentsReportKpis = [
  { label: "Planlanmamış", value: "—" },
  { label: "Vadesi Geçen", value: "—" },
  { label: "Toplam Ödeme", value: "—" },
  { label: "Ort. Vade Aşımı", value: "—" },
];

export function PaymentsReportPage() {
  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Gider Yönetimi / Ödemeler Raporu"
        title="Ödemeler Raporu"
        rows={pendingPayments}
        columns={paymentColumns}
        filename="odemeler-raporu"
        pdfExtras={{
          kpis: paymentsReportKpis,
          chart: {
            title: "Ödeme Yaşlandırması",
            bars: paymentAging.map((item) => ({
              label: item.label,
              value: item.value,
            })),
          },
        }}
      />
      <OpenChecksReportSection direction="issued" title="Yaklaşan Ödemeler — Açık Verilen Çekler" />
      <DateFilters />
      <section className="report-kpis">
        {paymentsReportKpis.map((kpi) => (
          <article className="erp-card" key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
          </article>
        ))}
      </section>
      <article className="erp-card report-chart">
        <h2>Ödeme Yaşlandırması</h2>
        <div className="aging-columns">
          {paymentAging.map((item) => (
            <div key={item.label}>
              <span>{item.value}K</span>
              <i style={{ height: `${item.value / 4.1}%` }} />
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </article>
      <h2 className="report-section-title">Bekleyen Ödemeler</h2>
      <div className="erp-card report-table">
        <table>
          <thead>
            <tr>
              {paymentColumns.map((column) => (
                <th key={column.header}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendingPayments.map((row) => {
              const expense = expenseRows.find(
                (item) => item.name === row.name,
              );
              return (
                <tr key={row.name}>
                  <td>
                    {expense ? (
                      <Link
                        className="report-cell-link"
                        to={`/apps/finance/expense/list/${encodeURIComponent(expense.document)}`}
                      >
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td>{row.issue}</td>
                  <td>{row.due}</td>
                  <td>{row.delay}</td>
                  <td>{row.amount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function VatReportPage() {
  const [filter, setFilter] = useState("Tümü");
  const visible = vatDetails.filter(
    (row) => filter === "Tümü" || row.type === filter.slice(0, -3),
  );
  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Gider Yönetimi / KDV Raporu"
        title="KDV Raporu"
        rows={visible}
        columns={vatDetailColumns}
        filename="kdv-raporu"
      />
      <DateFilters />
      <h2 className="report-section-title">Aylara Göre KDV Raporları</h2>
      <Table rows={vatMonths} columns={vatMonthColumns} />
      <button className="report-more" type="button">
        Daha Fazla Göster
      </button>
      <div className="report-subhead">
        <h2>Satışlar ve Giderler KDV Dökümü</h2>
        <div>
          {["Tümü", "Satışlar", "Giderler"].map((item) => (
            <button
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <Table rows={visible} columns={vatDetailColumns} />
    </div>
  );
}

type CashAccountApiRow = {
  attributes?: {
    balance?: unknown;
    currency?: unknown;
    iban?: unknown;
    name?: unknown;
  } | null;
};

function accountText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function accountCurrency(value: unknown) {
  const currency =
    typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "";
  return currency === "TRL" ? "TRY" : currency;
}

function accountBalance(value: unknown, currency: string) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!currency || !Number.isFinite(amount)) return "—";

  try {
    return formatMoney(amount, currency);
  } catch {
    return "—";
  }
}

const accountColumns: ExportColumn<CashAccount>[] = [
  { header: "Hesap İsmi", value: (r) => r.name },
  { header: "IBAN", value: (r) => r.iban },
  { header: "Döviz Cinsi", value: (r) => r.currency },
  { header: "Bakiye", value: (r) => r.balance },
];
const checkColumns: ExportColumn<(typeof checks)[number]>[] = [
  { header: "Düzenleyen", value: (r) => r.issuer },
  { header: "Çek Bilgileri", value: (r) => r.info },
  { header: "Vade Tarihi", value: (r) => r.due },
  { header: "Kalan Meblağ", value: (r) => r.amount },
  { header: "Durum / Tür", value: (r) => r.status },
];
const movementColumns: ExportColumn<(typeof cashMovements)[number]>[] = [
  { header: "İşlem Türü", value: (r) => r.type },
  { header: "İşlem Tarihi", value: (r) => r.date },
  { header: "Müşteri / Tedarikçi / Çalışan", value: (r) => r.party },
  { header: "Kayıt İsmi", value: (r) => r.name },
  { header: "Meblağ", value: (r) => r.amount },
];
const flowColumns: ExportColumn<(typeof flowTransactions)[number]>[] = [
  { header: "İşlem Türü", value: (r) => r.type },
  { header: "Vade Tarihi", value: (r) => r.due },
  { header: "Müşteri / Tedarikçi / Çalışan", value: (r) => r.party },
  { header: "Açıklama", value: (r) => r.description },
  { header: "Çıkış", value: (r) => r.out },
  { header: "Giriş", value: (r) => r.input },
];

export function CashAccountsPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", {
        body: {
          action: "list",
          resource: "accounts",
          pageSize: 50,
          filters: { archived: false },
        },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        const response = data as { rows?: unknown } | null;
        if (error || !response || !Array.isArray(response.rows)) {
          setAccounts([]);
          return;
        }
        setAccounts(
          (response.rows as CashAccountApiRow[]).map((source) => {
            const attributes = source.attributes ?? {};
            const currency = accountCurrency(attributes.currency);
            return {
              name: accountText(attributes.name),
              iban: accountText(attributes.iban),
              currency: currency || "—",
              balance: accountBalance(attributes.balance, currency),
            };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Kasa / Kasa ve Bankalar"
        title="Kasa ve Bankalar"
        rows={accounts}
        columns={accountColumns}
        filename="kasa-ve-bankalar"
        actions={
          <div className="report-actions">
            <button type="button" disabled>
              <Landmark /> Banka Hesabı Bağla
            </button>
            <Link className="report-action-link" to="/apps/finance/cash/accounts/new-cash">
              <Plus /> Kasa Ekle
            </Link>
            <Link className="report-action-link" to="/apps/finance/cash/accounts/new-bank">
              <Plus /> Banka Ekle
            </Link>
          </div>
        }
      />
      <div className="erp-card report-filters">
        <label className="wide">
          <Search /> <input />
        </label>
        <button>
          <Filter /> Filtrele
        </button>
      </div>
      <Table rows={accounts} columns={accountColumns} />
    </div>
  );
}
export function ChecksPage() {
  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Kasa / Çekler"
        title="Çekler"
        rows={checks}
        columns={checkColumns}
        filename="cekler"
        actions={
          <Link
            className="report-primary-link"
            to="/apps/finance/cash/checks/new"
          >
            <Plus /> Çek Ekle
          </Link>
        }
      />
      <div className="erp-card report-filters">
        <label className="wide">
          <Search /> <input />
        </label>
        <button>
          <Filter /> Filtrele
        </button>
      </div>
      <Table rows={checks} columns={checkColumns} />
    </div>
  );
}
export function CashBankReportPage() {
  const [scale, setScale] = useState("Ay");
  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Kasa / Kasa / Banka Raporu"
        title="Kasa / Banka Raporu"
        rows={cashMovements}
        columns={movementColumns}
        filename="kasa-banka-raporu"
      />
      <DateFilters />
      <section className="report-kpis">
        {[
          ["Toplam Nakit Girişi", "—"],
          ["Toplam Nakit Çıkışı", "—"],
          ["Net Nakit Akışı", "—"],
        ].map((kpi) => (
          <article className="erp-card" key={kpi[0]}>
            <span>{kpi[0]}</span>
            <strong>{kpi[1]}</strong>
          </article>
        ))}
      </section>
      <article className="erp-card report-chart">
        <div className="report-subhead">
          <h2>Nakit Hareketleri</h2>
          <div>
            {["Gün", "Hafta", "Ay", "Yıl"].map((item) => (
              <button
                className={scale === item ? "active" : ""}
                onClick={() => setScale(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="cash-bars">
          {cashChart.map((value, index) => (
            <i
              className={index % 3 === 1 ? "outgoing" : "incoming"}
              key={index}
              style={{ height: `${value / 2}%` }}
            />
          ))}
        </div>
        <div className="chart-legend">
          <span>Nakit Girişi</span>
          <span>Nakit Çıkışı</span>
        </div>
      </article>
      <Table rows={cashMovements} columns={movementColumns} />
    </div>
  );
}
export function CashFlowReportPage() {
  const [period, setPeriod] = useState("Önümüzdeki 12 Hafta");
  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Kasa / Nakit Akış Raporu"
        title="Nakit Akış Raporu"
        rows={flowTransactions}
        columns={flowColumns}
        filename="nakit-akis-raporu"
      />
      <section className="report-kpis flow">
        {[
          ["Bugün toplam bakiye", "—"],
          ["Vadesi geçmiş Tahsilat", "—"],
          ["Vadesi geçmiş Ödeme", "—"],
          ["Planlanmamış Tahsilat", "—"],
          ["Planlanmamış Ödeme", "—"],
        ].map((kpi) => (
          <article className="erp-card" key={kpi[0]}>
            <span>{kpi[0]}</span>
            <strong>{kpi[1]}</strong>
          </article>
        ))}
      </section>
      <article className="erp-card flow-grid-card">
        <div className="report-subhead">
          <h2>Nakit Akış Tahmini</h2>
          <div>
            {["Önümüzdeki 12 Hafta", "Önümüzdeki 12 Ay"].map((item) => (
              <button
                className={period === item ? "active" : ""}
                onClick={() => setPeriod(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="forecast-panel">
          <aside>
            <span>
              Toplam Tahsilat<strong>—</strong>
            </span>
            <span>
              Toplam Ödeme<strong>—</strong>
            </span>
            <span>
              Tahmini Dönem Sonu Bakiyesi<strong>—</strong>
            </span>
          </aside>
          <div className="forecast-chart">
            {cashChart.map((value, index) => (
              <i key={index} style={{ height: `${value}%` }} />
            ))}
          </div>
        </div>
        <div className="flow-grid">
          <span />
          {cashFlowGrid.periods.map((period) => (
            <strong key={period}>{period}</strong>
          ))}
          {cashFlowGrid.rows.flatMap((row) => [
            <b key={`${row.label}-label`}>{row.label}</b>,
            ...row.values.map((value, index) => (
              <span key={`${row.label}-${index}`}>{value}</span>
            )),
          ])}
        </div>
      </article>
      <h2 className="report-section-title">Yapılacak Tahsilat ve Ödemeler</h2>
      <Table rows={flowTransactions} columns={flowColumns} />
    </div>
  );
}

const accountsBase = "/apps/finance/cash/accounts";
const banks: string[] = [];

function AccountFormActions() {
  return (
    <div className="report-form-actions">
      <Link to={accountsBase}>Vazgeç</Link>
      <button type="submit">Kaydet</button>
    </div>
  );
}

export function CashAccountFormPage() {
  return (
    <div className="report-page">
      <header className="report-form-head">
        <div>
          <FinanceBreadcrumb value="Muhasebe ve Finans / Kasa / Kasa ve Bankalar / Yeni Kasa" />
          <FinanceBackLink to={accountsBase}>
            Kasa ve Bankalara Dön
          </FinanceBackLink>
          <h1>Yeni Kasa</h1>
        </div>
        <AccountFormActions />
      </header>
      <form
        className="erp-card report-account-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="report-account-fields">
          <label>
            Hesap İsmi *
            <input required />
          </label>
          <label>
            Sorumlu Kişi
            <input />
          </label>
          <label>
            Döviz Cinsi
            <select defaultValue="">
              <option value="">—</option>
              <option value="TRY">₺ - Türk Lirası</option>
              <option value="USD">$ - Amerikan Doları</option>
              <option value="EUR">€ - Euro</option>
            </select>
          </label>
          <label>
            Durum
            <select defaultValue="">
              <option value="">—</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </label>
          <label>
            Açılış Bakiyesi
            <input type="number" step="0.01" />
          </label>
          <label>
            Açılış Bakiyesi Tarihi
            <input type="date" />
          </label>
          <label className="wide">
            Açıklama / Notlar
            <textarea rows={3} />
          </label>
        </div>
      </form>
    </div>
  );
}

export function BankAccountFormPage() {
  return (
    <div className="report-page">
      <header className="report-form-head">
        <div>
          <FinanceBreadcrumb value="Muhasebe ve Finans / Kasa / Kasa ve Bankalar / Yeni Banka" />
          <FinanceBackLink to={accountsBase}>
            Kasa ve Bankalara Dön
          </FinanceBackLink>
          <h1>Yeni Banka</h1>
        </div>
        <AccountFormActions />
      </header>
      <form
        className="erp-card report-account-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="report-account-fields">
          <label>
            Hesap İsmi *
            <input required />
          </label>
          <label>
            Banka *
            <select required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {banks.map((bank) => (
                <option key={bank}>{bank}</option>
              ))}
            </select>
          </label>
          <label>
            Banka Şubesi
            <input />
          </label>
          <label>
            Hesap Sahibi / Firma
            <input />
          </label>
          <label>
            Hesap Numarası
            <input />
          </label>
          <label className="wide">
            IBAN
            <input />
          </label>
          <label>
            Döviz Cinsi
            <select defaultValue="">
              <option value="">—</option>
              <option value="TRY">₺ - Türk Lirası</option>
              <option value="USD">$ - Amerikan Doları</option>
              <option value="EUR">€ - Euro</option>
            </select>
          </label>
          <label>
            Hesap Türü
            <select defaultValue="">
              <option value="">—</option>
              <option value="vadesiz">Vadesiz Hesap</option>
              <option value="vadeli">Vadeli Hesap</option>
              <option value="kredi">Kredi Hesabı</option>
            </select>
          </label>
          <label>
            Durum
            <select defaultValue="">
              <option value="">—</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </label>
          <label>
            Açılış Bakiyesi
            <input type="number" step="0.01" />
          </label>
          <label>
            Açılış Bakiyesi Tarihi
            <input type="date" />
          </label>
          <label className="wide">
            Açıklama / Notlar
            <textarea rows={3} />
          </label>
        </div>
      </form>
    </div>
  );
}
