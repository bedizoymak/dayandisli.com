import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { FinanceSummaryCards } from "@/components/erp/finance/FinanceSummaryCards";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import { formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/finance/financeLabels";
import type { FinanceDashboardSummary, FinancialTransaction } from "@/lib/finance/financeTypes";
import { getFinanceDashboardSummary, getFinancialTransactions } from "@/services/financeService";

const emptySummary: FinanceDashboardSummary = {
  totalReceivable: 0,
  totalPayable: 0,
  collected: 0,
  paid: 0,
  pendingPayments: 0,
  overduePayments: 0,
  officialBalance: 0,
  operationalBalance: 0,
};

export default function FinanceReportsPage() {
  const [summary, setSummary] = useState<FinanceDashboardSummary>(emptySummary);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [summaryResult, transactionResult] = await Promise.all([getFinanceDashboardSummary(), getFinancialTransactions()]);
      setSummary(summaryResult.data);
      setTransactions(transactionResult.data);
      setError(summaryResult.error || transactionResult.error);
    };
    load();
  }, []);

  const methodTotals = useMemo(() => {
    return transactions.reduce<Record<string, number>>((acc, transaction) => {
      const key = transaction.payment_method || "other";
      acc[key] = (acc[key] || 0) + Number(transaction.amount || 0);
      return acc;
    }, {});
  }, [transactions]);

  return (
    <ERPLayout title="Finans Raporları">
      <PageHeader title="Finans Raporları" description="Cari bakiye, hesap tipi ve ödeme yöntemi kırılımları." />
      {error ? <MigrationNotice message={error} /> : null}
      <FinanceSummaryCards summary={summary} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Müşteri Bakiye Raporu" description="Müşteri bazlı alacak ve tahsilat kırılımı için hazır rapor alanı." />
        <ReportCard title="Tedarikçi Bakiye Raporu" description="Tedarikçi borç ve ödeme takibi için hazır rapor alanı." />
        <ReportCard title="Resmi / Operasyonel Hesap Ayrımı" description={`Resmi hesap: ${formatMoney(summary.officialBalance)} · Operasyonel takip: ${formatMoney(summary.operationalBalance)}`} />
        <ReportCard title="Vadesi Geçenler" description={`${summary.overduePayments} adet vadesi geçen hareket bulunuyor.`} />
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ödeme Yöntemi Kırılımı</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {Object.entries(methodTotals).length ? (
              Object.entries(methodTotals).map(([method, amount]) => (
                <div key={method} className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] || "Diğer"}</p>
                  <p className="mt-1 text-lg font-semibold">{formatMoney(amount)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Henüz ödeme yöntemi içeren hareket yok.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
}

function ReportCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
