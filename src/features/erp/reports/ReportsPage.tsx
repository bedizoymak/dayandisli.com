import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { getDashboardMetrics, listSalesOrders, listSubcontractingJobs, listWorkOrders } from "../shared/erpApi";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState({
    openOrders: 0,
    openWorkOrders: 0,
    lowStock: 0,
    waitingSubcontracting: 0,
  });

  useEffect(() => {
    const load = async () => {
      const [metricsResult, salesOrdersResult, workOrdersResult, subcontractingResult] = await Promise.all([
        getDashboardMetrics(),
        listSalesOrders(),
        listWorkOrders(),
        listSubcontractingJobs(),
      ]);

      if (metricsResult.error) {
        toast({ title: "Bilgi", description: `Rapor metriklerinde kismi eksik veri var: ${metricsResult.error}` });
      }

      setSummary({
        openOrders: salesOrdersResult.data.filter((x) => !["closed", "cancelled"].includes(x.status)).length,
        openWorkOrders: workOrdersResult.data.filter((x) => !["completed", "cancelled"].includes(x.status)).length,
        lowStock: metricsResult.data.lowStockItems,
        waitingSubcontracting: subcontractingResult.data.filter((x) => !["returned", "cancelled"].includes(x.status)).length,
      });
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Raporlama">
      <PageHeader
        title="Raporlama"
        description="Ilk sürüm raporlari: açik siparisler, is emri durum özeti, kritik stok ve fason bekleyen listesi."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Açik Siparisler</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.openOrders}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Açik Is Emirleri</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.openWorkOrders}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kritik Stok</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.lowStock}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fason Bekleyen</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.waitingSubcontracting}</CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Nakit akis raporu ve gelismis finans analizleri bir sonraki fazda eklenecektir.
      </p>
    </ERPLayout>
  );
}
