import { useState, type ReactNode } from "react";
import { Filter, Landmark, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import {
  FinanceBreadcrumb,
  FinanceExportMenu,
  type ExportColumn,
} from "./FinanceNavigationTools";
import {
  incomeExpenseReport,
  paymentAging,
  pendingPayments,
  vatDetails,
  vatMonths,
} from "./financeReportData";
import {
  cashAccounts,
  cashChart,
  cashFlowGrid,
  cashMovements,
  checks,
  flowTransactions,
} from "./cashReportData";
import "./finance-reports.css";

function Header<T>({
  breadcrumb,
  title,
  rows,
  columns,
  filename,
  actions,
}: {
  breadcrumb: string;
  title: string;
  rows?: T[];
  columns?: ExportColumn<T>[];
  filename?: string;
  actions?: ReactNode;
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
          />
        )}
      </div>
    </header>
  );
}
function DateFilters({ tax = false }: { tax?: boolean }) {
  const [from, setFrom] = useState("2026-07-01");
  const [to, setTo] = useState("2026-07-31");
  return (
    <div className="ebru-card report-filters">
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
    <div className="ebru-card report-table">
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
            className="ebru-card report-distribution"
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
            <div className={`report-donut ${section.tone}`}>
              <span>{section.total}</span>
            </div>
          </article>
        ))}
      </div>
      <article className="ebru-card report-net">
        <span>Net</span>
        <strong>{incomeExpenseReport.totals.net}</strong>
      </article>
    </div>
  );
}

export function PaymentsReportPage() {
  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Gider Yönetimi / Ödemeler Raporu"
        title="Ödemeler Raporu"
        rows={pendingPayments}
        columns={paymentColumns}
        filename="odemeler-raporu"
      />
      <DateFilters />
      <section className="report-kpis">
        {[
          ["Planlanmamış", "₺199K"],
          ["Vadesi Geçen", "₺1,30M"],
          ["Toplam Ödeme", "₺1,62M"],
          ["Ort. Vade Aşımı", "42 gün"],
        ].map((kpi) => (
          <article className="ebru-card" key={kpi[0]}>
            <span>{kpi[0]}</span>
            <strong>{kpi[1]}</strong>
          </article>
        ))}
      </section>
      <article className="ebru-card report-chart">
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
      <Table rows={pendingPayments} columns={paymentColumns} />
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
        <h2>Temmuz 2026 Satışlar ve Giderler KDV Dökümü</h2>
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

const accountColumns: ExportColumn<(typeof cashAccounts)[number]>[] = [
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
  return (
    <div className="report-page">
      <Header
        breadcrumb="Muhasebe ve Finans / Kasa / Kasa ve Bankalar"
        title="Kasa ve Bankalar"
        rows={cashAccounts}
        columns={accountColumns}
        filename="kasa-ve-bankalar"
        actions={
          <div className="report-actions">
            <button>
              <Landmark /> Banka Hesabı Bağla
            </button>
            <button>
              <Plus /> Kasa Ekle
            </button>
            <button>
              <Plus /> Banka Ekle
            </button>
          </div>
        }
      />
      <div className="ebru-card report-filters">
        <label className="wide">
          <Search /> <input placeholder="Hesap ara" />
        </label>
        <button>
          <Filter /> Filtrele
        </button>
      </div>
      <Table rows={cashAccounts} columns={accountColumns} />
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
            to="/apps/ebru-preview/finance/cash/checks/new"
          >
            <Plus /> Çek Ekle
          </Link>
        }
      />
      <div className="ebru-card report-filters">
        <label className="wide">
          <Search /> <input placeholder="Düzenleyen veya çek no ara" />
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
          ["Toplam Nakit Girişi", "₺1,84M"],
          ["Toplam Nakit Çıkışı", "₺1,12M"],
          ["Net Nakit Akışı", "₺720K"],
        ].map((kpi) => (
          <article className="ebru-card" key={kpi[0]}>
            <span>{kpi[0]}</span>
            <strong>{kpi[1]}</strong>
          </article>
        ))}
      </section>
      <article className="ebru-card report-chart">
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
          ["Bugün toplam bakiye", "₺7,15M"],
          ["Vadesi geçmiş Tahsilat", "₺3,34M"],
          ["Vadesi geçmiş Ödeme", "₺1,30M"],
          ["Planlanmamış Tahsilat", "₺0"],
          ["Planlanmamış Ödeme", "₺199K"],
        ].map((kpi) => (
          <article className="ebru-card" key={kpi[0]}>
            <span>{kpi[0]}</span>
            <strong>{kpi[1]}</strong>
          </article>
        ))}
      </section>
      <article className="ebru-card flow-grid-card">
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
              Toplam Tahsilat<strong>₺2,28M</strong>
            </span>
            <span>
              Toplam Ödeme<strong>₺1,87M</strong>
            </span>
            <span>
              Tahmini Dönem Sonu Bakiyesi<strong>₺7,50M</strong>
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
