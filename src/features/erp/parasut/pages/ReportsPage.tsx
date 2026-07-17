import { useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/erp/DataTable";
import { useParasutReports } from "../api/queries";
import { formatParasutCurrency } from "../utils/format";
import { ParasutErrorState, ParasutLoadingState } from "../components/ParasutStateViews";
import type { AgingBucket, ContactAttributes, CurrencyTotal, DocumentSummaryRow, MirrorRowBase, MonthlyTrendEntry } from "../types";

export const REPORT_TABS = [
  { value: "satis", label: "Satış Özeti" },
  { value: "tahsilat", label: "Tahsilat Özeti" },
  { value: "alis", label: "Alış Özeti" },
  { value: "odeme", label: "Ödeme Özeti" },
  { value: "gelir-gider", label: "Gelir Gider Karşılaştırması" },
  { value: "alacak-yaslandirma", label: "Alacak Yaşlandırma" },
  { value: "borc-yaslandirma", label: "Borç Yaşlandırma" },
  { value: "musteri-bakiye", label: "Müşteri Bakiyeleri" },
  { value: "tedarikci-bakiye", label: "Tedarikçi Bakiyeleri" },
  { value: "aylik-trend", label: "Aylık Fatura Trendi" },
] as const;

function DocumentSummaryTable({ rows }: { rows: DocumentSummaryRow[] }) {
  const columns: DataTableColumn<DocumentSummaryRow>[] = [
    { key: "currency", header: "Para Birimi", render: (row) => row.currency },
    { key: "count", header: "Adet", className: "text-right", render: (row) => row.count },
    { key: "net", header: "Ara Toplam", className: "text-right", render: (row) => formatParasutCurrency(row.net, row.currency) },
    { key: "vat", header: "Vergi", className: "text-right", render: (row) => formatParasutCurrency(row.vat, row.currency) },
    { key: "gross", header: "Genel Toplam", className: "text-right", render: (row) => formatParasutCurrency(row.gross, row.currency) },
  ];
  return rows.length === 0 ? <p className="text-sm text-muted-foreground">Veri yok.</p> : <DataTable columns={columns} data={rows} rowKey={(row) => row.currency} />;
}

function CurrencyTotalTable({ rows, label }: { rows: CurrencyTotal[]; label: string }) {
  const columns: DataTableColumn<CurrencyTotal>[] = [
    { key: "currency", header: "Para Birimi", render: (row) => row.currency },
    { key: "total", header: label, className: "text-right", render: (row) => formatParasutCurrency(row.total, row.currency) },
  ];
  return rows.length === 0 ? <p className="text-sm text-muted-foreground">Veri yok.</p> : <DataTable columns={columns} data={rows} rowKey={(row) => row.currency} />;
}

function AgingTable({ buckets }: { buckets: AgingBucket[] }) {
  const columns: DataTableColumn<AgingBucket>[] = [
    { key: "bucket", header: "Vade Aralığı", render: (row) => row.bucket },
    { key: "count", header: "Belge Sayısı", className: "text-right", render: (row) => row.count },
    {
      key: "totals",
      header: "Tutar",
      className: "text-right",
      render: (row) => (row.totals.length === 0 ? "—" : row.totals.map((total) => <div key={total.currency}>{formatParasutCurrency(total.total, total.currency)}</div>)),
    },
  ];
  return <DataTable columns={columns} data={buckets} rowKey={(row) => row.bucket} />;
}

function BalanceTable({ rows }: { rows: (MirrorRowBase & { attributes: ContactAttributes })[] }) {
  const columns: DataTableColumn<MirrorRowBase & { attributes: ContactAttributes }>[] = [
    { key: "name", header: "Ad / Ünvan", render: (row) => row.attributes.name ?? "—" },
    { key: "balance", header: "Bakiye (TL)", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.trl_balance, "TRY") },
  ];
  return rows.length === 0 ? <p className="text-sm text-muted-foreground">Veri yok.</p> : <DataTable columns={columns} data={rows} rowKey={(row) => row.parasut_id} />;
}

function mergeTrendByMonth(sales: MonthlyTrendEntry[], purchases: MonthlyTrendEntry[]) {
  const months = Array.from(new Set([...sales.map((e) => e.month), ...purchases.map((e) => e.month)])).sort();
  return months.map((month) => ({
    month,
    Satış: sales.filter((e) => e.month === month).reduce((sum, e) => sum + Number(e.total), 0),
    Alış: purchases.filter((e) => e.month === month).reduce((sum, e) => sum + Number(e.total), 0),
  }));
}

function TrendChart({ data, series }: { data: Record<string, unknown>[]; series: { key: string; color: string }[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Grafik için yeterli veri yok.</p>;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--erp-border))" vertical={false} />
          <XAxis dataKey="month" stroke="hsl(var(--erp-text-muted))" fontSize={12} />
          <YAxis stroke="hsl(var(--erp-text-muted))" fontSize={12} />
          <Tooltip contentStyle={{ background: "hsl(var(--erp-surface-raised))", border: "1px solid hsl(var(--erp-border))", color: "hsl(var(--erp-text))" }} />
          <Legend />
          {series.map((entry) => (
            <Bar key={entry.key} dataKey={entry.key} fill={entry.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const activeTab = REPORT_TABS.some((tab) => tab.value === section) ? section! : "satis";
  const { data, isLoading, isError, error, refetch } = useParasutReports();

  return (
    <div className="space-y-6">
      <PageHeader title="Raporlar" description="Paraşüt aynasından hesaplanan satış, tahsilat, alış, ödeme ve bakiye raporları. Farklı para birimleri birleştirilmeden ayrı gösterilir." />

      {isLoading ? (
        <ParasutLoadingState label="Raporlar hesaplanıyor..." />
      ) : isError || !data ? (
        <ParasutErrorState message={error instanceof Error ? error.message : "Raporlar yüklenemedi."} onRetry={() => void refetch()} />
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => navigate(`/apps/parasut/raporlar/${value}`)}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            {REPORT_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="satis">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Satış Özeti</CardTitle></CardHeader>
              <CardContent><DocumentSummaryTable rows={data.salesSummary} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tahsilat">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Tahsilat Özeti</CardTitle></CardHeader>
              <CardContent><CurrencyTotalTable rows={data.collectionSummary} label="Tahsil Edilen" /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alis">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Alış Özeti</CardTitle></CardHeader>
              <CardContent><DocumentSummaryTable rows={data.purchaseSummary} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="odeme">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Ödeme Özeti</CardTitle></CardHeader>
              <CardContent><CurrencyTotalTable rows={data.paymentSummary} label="Ödenen" /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gelir-gider">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Gelir Gider Karşılaştırması</CardTitle></CardHeader>
              <CardContent>
                <TrendChart
                  data={mergeTrendByMonth(data.incomeExpenseComparison.sales, data.incomeExpenseComparison.purchases)}
                  series={[
                    { key: "Satış", color: "hsl(var(--erp-primary))" },
                    { key: "Alış", color: "hsl(var(--erp-danger))" },
                  ]}
                />
                <p className="mt-3 text-xs text-erp-muted">Grafik tüm para birimlerinin sayısal toplamını gösterir; kesin tutarlar için Satış/Alış Özeti sekmelerindeki para birimi bazlı tabloları kullanın.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alacak-yaslandirma">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Alacak Yaşlandırma</CardTitle></CardHeader>
              <CardContent><AgingTable buckets={data.receivablesAging} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="borc-yaslandirma">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Borç Yaşlandırma</CardTitle></CardHeader>
              <CardContent><AgingTable buckets={data.payablesAging} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="musteri-bakiye">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Müşteri Bakiyeleri</CardTitle></CardHeader>
              <CardContent><BalanceTable rows={data.customerBalances} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tedarikci-bakiye">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Tedarikçi Bakiyeleri</CardTitle></CardHeader>
              <CardContent><BalanceTable rows={data.supplierBalances} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aylik-trend">
            <Card className="erp-surface">
              <CardHeader><CardTitle className="text-base">Aylık Fatura Trendi</CardTitle></CardHeader>
              <CardContent>
                <TrendChart data={data.monthlyInvoiceTrend.map((entry) => ({ month: entry.month, Tutar: Number(entry.total) }))} series={[{ key: "Tutar", color: "hsl(var(--erp-primary))" }]} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
