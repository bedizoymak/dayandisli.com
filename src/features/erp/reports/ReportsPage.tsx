import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import {
  getERPReportSummary,
  listInventoryItems,
  listPurchaseOrders,
  listQualityReports,
  listRecentAuditLogs,
  listSalesOrders,
  listShipments,
  listWorkOrders,
} from "../shared/erpApi";
import { exportRowsToCsv } from "../shared/exportUtils";
import { ERPReportSummary } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

const emptySummary: ERPReportSummary = {
  openSalesOrders: 0,
  overdueSalesOrders: 0,
  openWorkOrders: 0,
  overdueWorkOrders: 0,
  purchaseOrders: 0,
  auditLogs: 0,
  financialAccounts: 0,
  waitingSubcontracting: 0,
  lowStockItems: 0,
  inventoryMovements: 0,
  pendingQualityReports: 0,
  upcomingMaintenances: 0,
};

export default function ReportsPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState(emptySummary);

  useEffect(() => {
    const load = async () => {
      const result = await getERPReportSummary();
      if (result.error) toast({ title: "Rapor", description: result.error });
      setSummary(result.data);
    };
    load();
  }, [toast]);

  const exportSalesOrders = async () => exportRowsToCsv("satis-siparisleri.csv", (await listSalesOrders()).data as unknown as Record<string, unknown>[]);
  const exportWorkOrders = async () => exportRowsToCsv("is-emirleri.csv", (await listWorkOrders()).data as unknown as Record<string, unknown>[]);
  const exportInventory = async () => exportRowsToCsv("stok-listesi.csv", (await listInventoryItems()).data as unknown as Record<string, unknown>[]);
  const exportPurchaseOrders = async () => exportRowsToCsv("satinalma-siparisleri.csv", (await listPurchaseOrders()).data as unknown as Record<string, unknown>[]);
  const exportShipments = async () => exportRowsToCsv("sevkiyatlar.csv", (await listShipments()).data as unknown as Record<string, unknown>[]);
  const exportQuality = async () => exportRowsToCsv("kalite-raporlari.csv", (await listQualityReports()).data as unknown as Record<string, unknown>[]);
  const exportAuditLogs = async () => exportRowsToCsv("audit-kayitlari.csv", (await listRecentAuditLogs(500)).data as unknown as Record<string, unknown>[]);

  return (
    <ERPLayout title="Raporlama">
      <PageHeader
        title="Raporlama ve Dışa Aktarım"
        description="Açık işler, geciken kayıtlar, kritik stoklar ve temel CSV dışa aktarımlar."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <ReportCard title="Açık Siparişler" value={summary.openSalesOrders} />
        <ReportCard title="Geciken Siparişler" value={summary.overdueSalesOrders} />
        <ReportCard title="Açık İş Emirleri" value={summary.openWorkOrders} />
        <ReportCard title="Geciken İş Emirleri" value={summary.overdueWorkOrders} />
        <ReportCard title="Satın Alma" value={summary.purchaseOrders} />
        <ReportCard title="Audit Kayıtları" value={summary.auditLogs} />
        <ReportCard title="Finans Hesapları" value={summary.financialAccounts} />
        <ReportCard title="Fasonda Bekleyenler" value={summary.waitingSubcontracting} />
        <ReportCard title="Kritik Stoklar" value={summary.lowStockItems} />
        <ReportCard title="Stok Hareketleri" value={summary.inventoryMovements} />
        <ReportCard title="Kalite Bekleyenler" value={summary.pendingQualityReports} />
        <ReportCard title="Yaklaşan Bakımlar" value={summary.upcomingMaintenances} />
      </div>

      <section className="rounded-md border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">CSV Dışa Aktarım</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportSalesOrders}>Satış Siparişleri</Button>
          <Button variant="outline" onClick={exportWorkOrders}>İş Emirleri</Button>
          <Button variant="outline" onClick={exportInventory}>Stok Listesi</Button>
          <Button variant="outline" onClick={exportPurchaseOrders}>Satın Alma Siparişleri</Button>
          <Button variant="outline" onClick={exportShipments}>Sevkiyatlar</Button>
          <Button variant="outline" onClick={exportQuality}>Kalite Raporları</Button>
          <Button variant="outline" onClick={exportAuditLogs}>Audit Kayıtları</Button>
        </div>
      </section>
    </ERPLayout>
  );
}

function ReportCard({ title, value, subtitle }: { title: string; value: number; subtitle?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}
