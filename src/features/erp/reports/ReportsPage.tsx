import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { getERPDashboardMetrics } from "../shared/erpApi";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState({
    openOrders: 0,
    openWorkOrders: 0,
    lowStock: 0,
    waitingSubcontracting: 0,
    pendingQuality: 0,
    upcomingMaintenance: 0,
  });

  useEffect(() => {
    const load = async () => {
      const metricsResult = await getERPDashboardMetrics();

      if (metricsResult.error) {
        toast({ title: "Bilgi", description: `Rapor metriklerinde kismi eksik veri var: ${metricsResult.error}` });
      }

      setSummary({
        openOrders: metricsResult.data.activeSalesOrders,
        openWorkOrders: metricsResult.data.openWorkOrders,
        lowStock: metricsResult.data.lowStockItems,
        waitingSubcontracting: metricsResult.data.waitingSubcontracting,
        pendingQuality: metricsResult.data.pendingQualityChecks,
        upcomingMaintenance: metricsResult.data.upcomingMaintenances,
      });
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Raporlama">
      <PageHeader
        title="Raporlama"
        description="İlk sürüm raporları: açık siparişler, iş emri durum özeti, kritik stok ve fason bekleyen listesi."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Açık Siparişler</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.openOrders}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Açık İş Emirleri</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kalite Bekleyen</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.pendingQuality}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yaklaşan Bakımlar</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.upcomingMaintenance}</CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Nakit akış raporu ve gelişmiş finans analizleri bir sonraki fazda eklenecektir.
      </p>
    </ERPLayout>
  );
}
