import { Link } from "react-router-dom";
import { AlertCircle, CalendarClock, Landmark, RefreshCw, Repeat, SendHorizonal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/erp/PageHeader";
import { useParasutDashboard } from "../api/queries";
import { formatParasutCurrency, formatParasutDate, formatParasutDateTime, formatRelativeDays } from "../utils/format";
import { ParasutErrorState, ParasutLoadingState } from "../components/ParasutStateViews";
import type { CurrencyTotal } from "../types";

function CurrencyTotals({ totals }: { totals: CurrencyTotal[] }) {
  if (totals.length === 0) return <span className="text-2xl font-semibold text-erp-text">{formatParasutCurrency(0, "TRY")}</span>;
  return (
    <div className="space-y-0.5">
      {totals.map((entry) => (
        <p key={entry.currency} className="text-2xl font-semibold tracking-tight text-erp-text">
          {formatParasutCurrency(entry.total, entry.currency)}
        </p>
      ))}
    </div>
  );
}

function MetricTile({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-erp-muted">
        {label}
        {tooltip ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="cursor-help text-erp-muted/70" aria-label={tooltip}>
                  <AlertCircle className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </p>
      {children}
    </div>
  );
}

export default function ParasutDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useParasutDashboard();

  return (
    <div className="space-y-6">
      <PageHeader title="Güncel Durum" description="Paraşüt aynasından hesaplanan finansal özet. Tüm rakamlar en son senkronizasyon anındaki mirror verisine dayanır." />

      {isLoading ? (
        <ParasutLoadingState label="Güncel durum hesaplanıyor..." />
      ) : isError || !data ? (
        <ParasutErrorState message={error instanceof Error ? error.message : "Güncel durum yüklenemedi."} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <Card className="erp-surface">
                <CardHeader>
                  <CardTitle className="text-base">Tahsilatlar</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricTile label="Toplam Tahsil Edilecek">
                    <CurrencyTotals totals={data.collectionsSummary.totalDue} />
                  </MetricTile>
                  <MetricTile label={`Gecikmiş (${data.collectionsSummary.overdueCount})`}>
                    <CurrencyTotals totals={data.collectionsSummary.overdue} />
                  </MetricTile>
                  <MetricTile label={`Planlanmamış (${data.collectionsSummary.unscheduledCount})`} tooltip="Vade tarihi girilmemiş açık satış faturaları.">
                    <CurrencyTotals totals={data.collectionsSummary.unscheduled} />
                  </MetricTile>
                  <MetricTile label="Yazdırılmamış / Gönderilmemiş" tooltip="Hiç yazdırılmamış (printed_at boş) ve hiç paylaşılmamış (sharings_count = 0) faturalar.">
                    <p className="text-2xl font-semibold text-erp-text">{data.unsentSummary.count}</p>
                  </MetricTile>
                  <MetricTile label="Tekrarlayan" tooltip="is_recurred_item alanı true olan açık satış faturaları.">
                    <p className="flex items-center gap-1.5 text-2xl font-semibold text-erp-text">
                      <Repeat className="h-4 w-4 text-erp-muted" aria-hidden="true" />
                      {data.collectionsSummary.recurringCount}
                    </p>
                  </MetricTile>
                </CardContent>
              </Card>

              <Card className="erp-surface">
                <CardHeader>
                  <CardTitle className="text-base">Ödemeler</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricTile label="Toplam Ödenecek">
                    <CurrencyTotals totals={data.paymentsSummary.totalDue} />
                  </MetricTile>
                  <MetricTile label={`Gecikmiş (${data.paymentsSummary.overdueCount})`}>
                    <CurrencyTotals totals={data.paymentsSummary.overdue} />
                  </MetricTile>
                  <MetricTile label={`Planlanmamış (${data.paymentsSummary.unscheduledCount})`} tooltip="Vade tarihi girilmemiş açık alış faturaları.">
                    <CurrencyTotals totals={data.paymentsSummary.unscheduled} />
                  </MetricTile>
                  <MetricTile
                    label="Bu Ay Oluşan KDV (tahmini)"
                    tooltip="Bu ayki satış faturalarının KDV toplamından, bu ayki alış faturalarının KDV toplamı düşülerek hesaplanmıştır. Devreden KDV ve diğer beyanname düzeltmeleri dahil değildir; resmi beyanname tutarı olarak kullanılmamalıdır."
                  >
                    {data.vatEstimate.length === 0 ? (
                      <p className="text-2xl font-semibold text-erp-text">{formatParasutCurrency(0, "TRY")}</p>
                    ) : (
                      <div className="space-y-0.5">
                        {data.vatEstimate.map((entry) => (
                          <p key={entry.currency} className="text-2xl font-semibold text-erp-text">
                            {formatParasutCurrency(entry.netVat, entry.currency)}
                          </p>
                        ))}
                      </div>
                    )}
                  </MetricTile>
                  <MetricTile label="Tekrarlayan" tooltip="is_recurred_item alanı true olan açık alış faturaları.">
                    <p className="flex items-center gap-1.5 text-2xl font-semibold text-erp-text">
                      <Repeat className="h-4 w-4 text-erp-muted" aria-hidden="true" />
                      {data.paymentsSummary.recurringCount}
                    </p>
                  </MetricTile>
                </CardContent>
              </Card>

              <Card className="erp-surface">
                <CardHeader>
                  <CardTitle className="text-base">Kasa ve Bankalar</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Senkronize edilmiş kasa/banka hesabı bulunmuyor.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {data.accounts.map((account) => (
                        <div key={account.parasut_id} className="rounded-lg border border-erp-border bg-erp-surface-raised/60 p-3">
                          <div className="flex items-center gap-2">
                            <Landmark className="h-4 w-4 text-erp-muted" aria-hidden="true" />
                            <p className="truncate text-sm font-medium text-erp-text">{account.attributes.name}</p>
                          </div>
                          <p className="mt-2 text-lg font-semibold text-erp-text">{formatParasutCurrency(account.attributes.balance, account.attributes.currency)}</p>
                          <p className="mt-1 text-xs text-erp-muted">
                            {account.attributes.account_type === "bank" ? "Banka" : account.attributes.account_type === "cash" ? "Kasa" : account.attributes.account_type ?? "—"}
                            {" · "}Son senk.: {formatParasutDateTime(account.synced_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="erp-surface flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  Yaklaşan / Geciken
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-1 overflow-y-auto">
                {data.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Vadeli açık kayıt bulunmuyor.</p>
                ) : (
                  data.timeline.map((entry) => (
                    <div key={`${entry.kind}-${entry.parasutId}`} className={`rounded-lg border p-3 ${entry.overdue ? "border-erp-danger/30 bg-erp-danger/10" : "border-erp-border bg-erp-surface-raised/40"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${entry.overdue ? "text-erp-danger" : "text-erp-muted"}`}>{formatRelativeDays(entry.daysFromToday)}</span>
                        <span className="text-xs text-erp-muted">{entry.kind === "receivable" ? "Tahsilat" : "Ödeme"}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-erp-text">{entry.partyName ?? "—"}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-erp-muted">{entry.documentNo ?? entry.parasutId}</span>
                        <span className="text-sm font-semibold text-erp-text">{formatParasutCurrency(entry.amount, entry.currency)}</span>
                      </div>
                    </div>
                  ))
                )}
                <p className="pt-2 text-xs text-erp-muted/70">Çek/senet kayıtları mevcut Paraşüt aynasında bulunmuyor.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="erp-surface">
            <CardHeader>
              <CardTitle className="text-base">Son Hareketler</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-erp-muted">
                  <SendHorizonal className="h-3.5 w-3.5" /> Son Satış Faturaları
                </p>
                {data.recentActivity.invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Kayıt yok.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.recentActivity.invoices.map((invoice) => (
                      <li key={invoice.parasut_id}>
                        <Link to={`/apps/parasut/satislar/faturalar/${invoice.parasut_id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-erp-surface-raised">
                          <span className="truncate text-erp-text">{invoice.attributes.invoice_no ?? invoice.parasut_id}</span>
                          <span className="text-erp-muted">{formatParasutDate(invoice.attributes.issue_date)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-erp-muted">
                  <RefreshCw className="h-3.5 w-3.5" /> Son Senkronizasyon Çalışmaları
                </p>
                {data.recentActivity.syncRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz senkronizasyon çalıştırılmadı.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.recentActivity.syncRuns.map((run) => (
                      <li key={run.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
                        <span className="text-erp-text">{run.resource_type}</span>
                        <span className="text-erp-muted">{run.status} · {formatParasutDateTime(run.started_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {data.recentActivity.syncErrors.length > 0 ? (
                  <p className="mt-2 text-xs text-erp-danger">{data.recentActivity.syncErrors.length} son senkronizasyon hatası. Detaylar için Senkronizasyon sayfasına bakın.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
