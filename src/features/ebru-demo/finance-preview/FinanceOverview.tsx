import {
  Building2,
  ChevronRight,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { FinanceBreadcrumb } from "./FinanceNavigationTools";
import { financeOverviewData } from "./financePreviewData";
import "./finance-preview.css";

function SummaryPanel({
  title,
  metrics,
  details,
  kind,
}: {
  title: string;
  metrics: typeof financeOverviewData.receivables;
  details: typeof financeOverviewData.receivableDetails;
  kind: "receivable" | "payable";
}) {
  const target =
    kind === "receivable"
      ? "/apps/demo/finance/income/invoices"
      : "/apps/demo/finance/expense/incoming-invoices";
  return (
    <article className={`ebru-card finance-summary ${kind}`}>
      <div className="finance-panel-head">
        <h2>{title}</h2>
        <Link className="finance-detail-link" to={target}>
          {kind === "receivable" ? "Tahsilat Detayı" : "Ödeme Detayları"}{" "}
          <ChevronRight />
        </Link>
      </div>
      <div className="finance-summary-layout">
        <div className="finance-metrics">
          {metrics.map((metric, index) => (
            <div className="finance-metric" key={metric.label}>
              <div
                className={`finance-ring ${metric.tone}`}
                style={
                  {
                    "--ring-fill": `${index === 0 ? 86 : index === 1 ? 72 : 8}%`,
                  } as React.CSSProperties
                }
              >
                <div>
                  <span>
                    {index === 0
                      ? "Toplam"
                      : index === 1
                        ? "Gecikmiş"
                        : "Planlanmamış"}
                  </span>
                  <strong>{metric.value}</strong>
                </div>
              </div>
              <h3>{metric.label}</h3>
            </div>
          ))}
        </div>
        <div className="finance-detail-stack">
          {details.map((detail, index) => (
            <div key={detail.label}>
              {index ? <RefreshCw /> : <FileText />}
              <p>
                <strong>{detail.value}</strong>
                <small>{detail.label}</small>
              </p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function FinanceOverview() {
  return (
    <div className="finance-overview">
      <header className="finance-page-heading">
        <div>
          <FinanceBreadcrumb value="Muhasebe ve Finans / Güncel Durum" />
          <h1>Güncel Durum</h1>
          <p>Şirketin tahsilat, ödeme, banka ve nakit akışı görünümü.</p>
        </div>
        <div className="finance-heading-actions">
          <Link to="/apps/demo/finance/income/invoices/new">
            ＋ Tahsilat Ekle
          </Link>
          <Link to="/apps/demo/finance/expense/list/new/invoice">
            − Ödeme Ekle
          </Link>
          <button className="primary">＋ Gelir / Gider Ekle</button>
        </div>
      </header>
      <section className="finance-layout">
        <div className="finance-main-column">
          <SummaryPanel
            title="Tahsilatlar"
            metrics={financeOverviewData.receivables}
            details={financeOverviewData.receivableDetails}
            kind="receivable"
          />
          <SummaryPanel
            title="Ödemeler"
            metrics={financeOverviewData.payables}
            details={financeOverviewData.payableDetails}
            kind="payable"
          />
          <article className="ebru-card finance-bank-panel">
            <div className="finance-panel-head">
              <h2>Kasa ve Bankalar</h2>
              <button>
                Kasa ve Bankalar sayfasına git <ChevronRight />
              </button>
            </div>
            <div className="finance-bank-cards">
              {financeOverviewData.accounts.map((account, index) => (
                <div className="finance-bank-card" key={account.name}>
                  {index < 2 ? <Landmark /> : <Building2 />}
                  <span>{account.name}</span>
                  <strong>{account.balance}</strong>
                  <small>{account.detail}</small>
                </div>
              ))}
              <button className="finance-connect">
                <Plus />
                Yeni Hesap Bağla
              </button>
            </div>
          </article>
          <article className="ebru-card finance-cashflow">
            <div className="finance-panel-head">
              <div>
                <h2>Önümüzdeki 12 Haftanın Nakit Akışı</h2>
                <p>Planlanan tahsilat ve ödemelere göre tahmini bakiye.</p>
              </div>
              <button>
                Nakit Akışı Raporuna Git <ChevronRight />
              </button>
            </div>
            <div className="finance-cash-kpis">
              {financeOverviewData.cashFlow.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong className={item.tone || ""}>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="finance-chart">
              <svg
                viewBox="0 0 1000 240"
                preserveAspectRatio="none"
                aria-label="12 haftalık nakit akışı grafiği"
              >
                <defs>
                  <linearGradient
                    id="financeCashArea"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0" stopColor="#2f8cff" stopOpacity=".28" />
                    <stop offset="1" stopColor="#2f8cff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g className="grid-lines">
                  <line x1="0" y1="40" x2="1000" y2="40" />
                  <line x1="0" y1="100" x2="1000" y2="100" />
                  <line x1="0" y1="160" x2="1000" y2="160" />
                  <line x1="0" y1="220" x2="1000" y2="220" />
                </g>
                <path
                  className="area"
                  d="M0,150 C80,142 120,147 170,132 S280,120 340,125 S450,96 520,108 S650,92 720,85 S840,76 1000,58 L1000,240 L0,240 Z"
                />
                <path
                  className="line"
                  d="M0,150 C80,142 120,147 170,132 S280,120 340,125 S450,96 520,108 S650,92 720,85 S840,76 1000,58"
                />
                <line className="today-line" x1="55" y1="10" x2="55" y2="230" />
              </svg>
              <div className="finance-week-labels">
                {financeOverviewData.weeks.map((week) => (
                  <span key={week}>{week}</span>
                ))}
              </div>
            </div>
          </article>
        </div>
        <aside className="ebru-card finance-timeline-panel">
          <div className="finance-panel-head">
            <h2>Finans Takvimi</h2>
            <button>Tümünü Gör</button>
          </div>
          <div className="finance-timeline">
            {financeOverviewData.timeline.map((item, index) => (
              <div key={`${item.timing}-${item.title}`}>
                {index === 4 && (
                  <div className="finance-today">BUGÜN · 16 TEMMUZ</div>
                )}
                <div className={`finance-timeline-item ${item.status}`}>
                  <i />
                  <small>{item.timing}</small>
                  <strong>{item.title}</strong>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
