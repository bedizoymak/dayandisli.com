import { Building2, ChevronRight, FileText, Landmark, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { FinanceBreadcrumb } from "./FinanceNavigationTools";
import { useParasutDashboard } from "@/features/erp/parasut/api/queries";
import type { CurrencyTotal, OpenDocumentSummary } from "@/features/erp/parasut/types";
import { formatParasutCurrency, formatParasutDate } from "@/features/erp/parasut/utils/format";
import "./finance-preview.css";

function totals(values: CurrencyTotal[]) {
  if (!values.length) return "Kullanılabilir veri yok";
  return values.map((value) => formatParasutCurrency(value.total, value.currency)).join(" · ");
}

function SummaryPanel({ title, summary, kind }: { title: string; summary: OpenDocumentSummary; kind: "receivable" | "payable" }) {
  const target = kind === "receivable" ? "/apps/finance/income/invoices" : "/apps/finance/expense/incoming-invoices";
  const metrics = [
    { label: kind === "receivable" ? "Toplam Tahsil Edilecek" : "Toplam Ödenecek", value: totals(summary.totalDue), tone: "blue" },
    { label: kind === "receivable" ? "Gecikmiş Tahsilat" : "Gecikmiş Ödeme", value: totals(summary.overdue), tone: "red" },
    { label: "Planlanmamış", value: totals(summary.unscheduled), tone: "yellow" },
  ];
  return <article className={`ebru-card finance-summary ${kind}`}>
    <div className="finance-panel-head"><h2>{title}</h2><Link className="finance-detail-link" to={target}>Detaya git <ChevronRight /></Link></div>
    <div className="finance-summary-layout"><div className="finance-metrics">{metrics.map((metric) => <div className="finance-metric" key={metric.label}><div className={`finance-ring ${metric.tone}`} style={{ "--ring-fill": "100%" } as React.CSSProperties}><div><span>Gerçek bakiye</span><strong>{metric.value}</strong></div></div><h3>{metric.label}</h3></div>)}</div>
      <div className="finance-detail-stack"><div><FileText /><p><strong>{summary.overdueCount}</strong><small>Gecikmiş belge</small></p></div><div><RefreshCw /><p><strong>{summary.recurringCount}</strong><small>Tekrarlayan belge</small></p></div></div>
    </div>
  </article>;
}

export function FinanceOverview() {
  const query = useParasutDashboard();
  if (query.isLoading) return <div className="finance-overview"><div className="ebru-card income-state">Finans verileri yükleniyor…</div></div>;
  if (query.isError || !query.data) return <div className="finance-overview"><div className="ebru-card income-state income-state-error">Finans verileri yüklenemedi: {query.error instanceof Error ? query.error.message : "Beklenmeyen hata"}</div></div>;
  const data = query.data;
  return <div className="finance-overview" data-provider="parasut">
    <header className="finance-page-heading"><div><FinanceBreadcrumb value="Muhasebe ve Finans / Güncel Durum" /><h1>Güncel Durum</h1><p>Paraşüt ayna verilerinden tahsilat, ödeme, banka ve nakit görünümü.</p></div><div className="finance-heading-actions"><button disabled title="Henüz kullanıma açık değil">＋ Tahsilat Ekle</button><button disabled title="Henüz kullanıma açık değil">− Ödeme Ekle</button><button disabled className="primary" title="Henüz kullanıma açık değil">＋ Gelir / Gider Ekle</button></div></header>
    <section className="finance-layout"><div className="finance-main-column">
      <SummaryPanel title="Tahsilatlar" summary={data.collectionsSummary} kind="receivable" />
      <SummaryPanel title="Ödemeler" summary={data.paymentsSummary} kind="payable" />
      <article className="ebru-card finance-bank-panel"><div className="finance-panel-head"><h2>Kasa ve Bankalar</h2><Link className="finance-detail-link" to="/apps/finance/cash/accounts">Kasa ve Bankalar sayfasına git <ChevronRight /></Link></div><div className="finance-bank-cards">
        {!data.accounts.length ? <div className="income-state">Senkronize hesap bulunamadı.</div> : data.accounts.map((account, index) => <div className="finance-bank-card" key={account.parasut_id}>{index < 2 ? <Landmark /> : <Building2 />}<span>{account.attributes.name ?? "Adsız hesap"}</span><strong>{formatParasutCurrency(account.attributes.balance, account.attributes.currency)}</strong><small>{account.attributes.bank_name ?? account.attributes.account_type ?? "Paraşüt hesabı"}</small></div>)}
      </div></article>
      <article className="ebru-card finance-cashflow"><div className="finance-panel-head"><div><h2>Nakit Akışı</h2><p>Güvenilir bir dönemsel bakiye serisi mevcut olmadığından tahmin üretilmiyor.</p></div><Link className="finance-detail-link" to="/apps/finance/cash/cash-flow-report">Rapora git <ChevronRight /></Link></div><div className="income-state">Kullanılabilir nakit akışı serisi yok.</div></article>
    </div><aside className="ebru-card finance-timeline-panel"><div className="finance-panel-head"><h2>Finans Takvimi</h2></div><div className="finance-timeline">
      {!data.timeline.length ? <div className="income-state">Planlanmış tahsilat veya ödeme bulunamadı.</div> : data.timeline.map((item) => <div key={`${item.kind}-${item.parasutId}`}><div className={`finance-timeline-item ${item.overdue ? "overdue" : "normal"}`}><i /><small>{formatParasutDate(item.dueDate)}</small><strong>{item.partyName ?? item.documentNo ?? "Paraşüt belgesi"} · {formatParasutCurrency(item.amount, item.currency)}</strong></div></div>)}
    </div></aside></section>
  </div>;
}
