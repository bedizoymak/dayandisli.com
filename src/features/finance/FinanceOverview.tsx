import {
  Building2,
  ChevronRight,
  FileText,
  Landmark,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import { FinanceBreadcrumb } from "./FinanceNavigationTools";
import { financeOverviewData } from "./financeNavigation";
import "./finance-overview.css";

interface ReceivablesSummary {
  outstanding_total: number;
  overdue_total: number;
  unscheduled_total: number;
  overdue_count: number;
  unscheduled_count: number;
  invoice_count: number;
  check_count: number;
}

/** Reads live Tahsilatlar totals from parasut_readable via the parasut-api Edge Function (action: "receivables-summary"). Returns null while loading or on error/no-access — callers must not fall back to demo values in either case. */
function useReceivablesSummary() {
  const [summary, setSummary] = useState<ReceivablesSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", { body: { action: "receivables-summary" } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || typeof data.outstanding_total !== "number") {
          setStatus("error");
          return;
        }
        setSummary(data as ReceivablesSummary);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, status };
}

interface PayablesSummary {
  outstanding_total: number;
  overdue_total: number;
  unscheduled_total: number;
  overdue_count: number;
  unscheduled_count: number;
  document_count: number;
  check_count: number;
}

/** Reads live Ödemeler totals from parasut_readable via the parasut-api Edge Function (action: "payables-summary"). Returns null while loading or on error/no-access — callers must not fall back to demo values in either case. */
function usePayablesSummary() {
  const [summary, setSummary] = useState<PayablesSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", { body: { action: "payables-summary" } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || typeof data.outstanding_total !== "number") {
          setStatus("error");
          return;
        }
        setSummary(data as PayablesSummary);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, status };
}

interface VatSummary {
  vat_this_month: number;
  sales_vat: number;
  purchase_vat: number;
}

/** Reads the live "Bu Ay Oluşan KDV" estimate from parasut_readable via the parasut-api Edge Function (action: "vat-summary"). Returns null while loading or on error/no-access — callers must not fall back to demo values in either case. */
function useVatSummary() {
  const [summary, setSummary] = useState<VatSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", { body: { action: "vat-summary" } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || typeof data.vat_this_month !== "number") {
          setStatus("error");
          return;
        }
        setSummary(data as VatSummary);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, status };
}

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
      ? "/apps/finance/income/invoices"
      : "/apps/finance/expense/incoming-invoices";
  return (
    <article className={`erp-card finance-summary ${kind}`}>
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
  const navigate = useNavigate();
  const { summary: receivablesSummary, status: receivablesStatus } = useReceivablesSummary();
  const { summary: payablesSummary, status: payablesStatus } = usePayablesSummary();
  const { summary: vatSummary, status: vatStatus } = useVatSummary();

  const receivables = financeOverviewData.receivables.map((metric, index) => {
    if (index === 0) {
      return {
        ...metric,
        value:
          receivablesStatus === "ready" && receivablesSummary
            ? formatMoney(receivablesSummary.outstanding_total)
            : receivablesStatus === "error"
              ? "—"
              : "…",
      };
    }
    if (index === 1) {
      return {
        ...metric,
        value:
          receivablesStatus === "ready" && receivablesSummary
            ? formatMoney(receivablesSummary.overdue_total)
            : receivablesStatus === "error"
              ? "—"
              : "…",
      };
    }
    if (index === 2) {
      return {
        ...metric,
        value:
          receivablesStatus === "ready" && receivablesSummary
            ? formatMoney(receivablesSummary.unscheduled_total)
            : receivablesStatus === "error"
              ? "—"
              : "…",
      };
    }
    return metric;
  });

  const payables = financeOverviewData.payables.map((metric, index) => {
    if (index === 0) {
      return {
        ...metric,
        value:
          payablesStatus === "ready" && payablesSummary
            ? formatMoney(payablesSummary.outstanding_total)
            : payablesStatus === "error"
              ? "—"
              : "…",
      };
    }
    if (index === 1) {
      return {
        ...metric,
        value:
          payablesStatus === "ready" && payablesSummary
            ? formatMoney(payablesSummary.overdue_total)
            : payablesStatus === "error"
              ? "—"
              : "…",
      };
    }
    if (index === 2) {
      return {
        ...metric,
        value:
          payablesStatus === "ready" && payablesSummary
            ? formatMoney(payablesSummary.unscheduled_total)
            : payablesStatus === "error"
              ? "—"
              : "…",
      };
    }
    return metric;
  });

  const payableDetails = financeOverviewData.payableDetails.map((detail, index) => {
    if (index === 0) {
      return {
        ...detail,
        value:
          vatStatus === "ready" && vatSummary
            ? formatMoney(vatSummary.vat_this_month)
            : vatStatus === "error"
              ? "—"
              : "…",
      };
    }
    return detail;
  });

  return (
    <div className="finance-overview">
      <header className="finance-page-heading">
        <div>
          <FinanceBreadcrumb value="Muhasebe ve Finans / Güncel Durum" />
          <h1>Güncel Durum</h1>
          <p>Şirketin tahsilat, ödeme, banka ve nakit akışı görünümü.</p>
        </div>
        <div className="finance-heading-actions">
          <Link to="/apps/finance/income/invoices/new">
            ＋ Tahsilat Ekle
          </Link>
          <Link to="/apps/finance/expense/list/new/invoice">
            − Ödeme Ekle
          </Link>
          <button className="primary" type="button" disabled title="Tahsilat veya ödeme eklemek için soldaki bağlantıları kullanın">
            ＋ Gelir / Gider Ekle
          </button>
        </div>
      </header>
      <section className="finance-layout">
        <div className="finance-main-column">
          <SummaryPanel
            title="Tahsilatlar"
            metrics={receivables}
            details={financeOverviewData.receivableDetails}
            kind="receivable"
          />
          <SummaryPanel
            title="Ödemeler"
            metrics={payables}
            details={payableDetails}
            kind="payable"
          />
          <article className="erp-card finance-bank-panel">
            <div className="finance-panel-head">
              <h2>Kasa ve Bankalar</h2>
              <button type="button" onClick={() => navigate("/apps/finance/cash/accounts")}>
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
              <button className="finance-connect" type="button" disabled title="Bu demo ortamında devre dışıdır">
                <Plus />
                Yeni Hesap Bağla
              </button>
            </div>
          </article>
          <article className="erp-card finance-cashflow">
            <div className="finance-panel-head">
              <div>
                <h2>Önümüzdeki 12 Haftanın Nakit Akışı</h2>
                <p>Planlanan tahsilat ve ödemelere göre tahmini bakiye.</p>
              </div>
              <button type="button" onClick={() => navigate("/apps/finance/cash/cash-flow-report")}>
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
        <aside className="erp-card finance-timeline-panel">
          <div className="finance-panel-head">
            <h2>Finans Takvimi</h2>
            <button type="button" disabled title="Takvim görünümü için üst menüdeki takvim simgesini kullanın">
              Tümünü Gör
            </button>
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
