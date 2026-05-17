import { useEffect, useState } from "react";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { MetricCard } from "@/components/erp/MetricCard";
import { AlertTriangle, ClipboardCheck, FileText, HardHat, Package, ShoppingCart, Truck, Wrench } from "lucide-react";
import { getDashboardMetrics } from "../shared/erpApi";
import { DashboardMetrics } from "../shared/types";
import { ERPModuleCard } from "../layout/ERPModuleCard";

const defaultMetrics: DashboardMetrics = {
  openQuotations: 0,
  activeSalesOrders: 0,
  openWorkOrders: 0,
  waitingSubcontracting: 0,
  lowStockItems: 0,
  pendingQualityChecks: 0,
  upcomingMaintenances: 0,
  todaysShipments: 0,
};

export default function ERPHomePage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getDashboardMetrics();
      setMetrics(result.data);
      setError(result.error);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <ERPLayout title="ERP Dashboard">
      <PageHeader
        title="Ana Panel"
        description="Atölye operasyonlarinin günlük durumunu tek ekranda izleyin."
      />

      {error ? (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-500">
          Bazi metrikler yüklenemedi: {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Açik Teklifler" value={metrics.openQuotations} icon={<FileText className="h-5 w-5" />} />
        <MetricCard title="Aktif Siparisler" value={metrics.activeSalesOrders} icon={<ShoppingCart className="h-5 w-5" />} />
        <MetricCard title="Açik Is Emirleri" value={metrics.openWorkOrders} icon={<HardHat className="h-5 w-5" />} />
        <MetricCard title="Fason Bekleyenler" value={metrics.waitingSubcontracting} icon={<Truck className="h-5 w-5" />} />
        <MetricCard title="Kritik Stoklar" value={metrics.lowStockItems} icon={<Package className="h-5 w-5" />} />
        <MetricCard title="Bekleyen Kalite Kontrolleri" value={metrics.pendingQualityChecks} icon={<ClipboardCheck className="h-5 w-5" />} />
        <MetricCard title="Yaklasan Bakimlar" value={metrics.upcomingMaintenances} icon={<Wrench className="h-5 w-5" />} />
        <MetricCard title="Bugünkü Sevkiyatlar" value={metrics.todaysShipments} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ERPModuleCard title="CRM" description="Müsteri, tedarikçi ve fason paydas yönetimi" href="/erp/crm" icon={<ShoppingCart className="h-5 w-5" />} />
        <ERPModuleCard title="Üretim" description="Is emri, rota ve operasyon takibi" href="/erp/work-orders" icon={<HardHat className="h-5 w-5" />} />
        <ERPModuleCard title="Stok" description="Stok kartlari ve kritik stok izlemesi" href="/erp/inventory" icon={<Package className="h-5 w-5" />} />
        <ERPModuleCard title="Kalite" description="Kalite raporlari ve ölçüm sonuçlari" href="/erp/quality" icon={<ClipboardCheck className="h-5 w-5" />} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Metrikler güncelleniyor...</p> : null}
    </ERPLayout>
  );
}
