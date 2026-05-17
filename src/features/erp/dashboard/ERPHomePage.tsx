import { useEffect, useState } from "react";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { MetricCard } from "@/components/erp/MetricCard";
import { AlertTriangle, ClipboardCheck, FileText, HardHat, Package, ShoppingCart, Truck, Users, Wrench } from "lucide-react";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { getERPDashboardMetrics } from "../shared/erpApi";
import { DashboardMetrics } from "../shared/types";
import { ERPModuleCard } from "../layout/ERPModuleCard";

const defaultMetrics: DashboardMetrics = {
  stakeholderCount: 0,
  openQuotations: 0,
  activeSalesOrders: 0,
  openWorkOrders: 0,
  activeOperations: 0,
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
      const result = await getERPDashboardMetrics();
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
        description="Atölye operasyonlarının günlük durumunu tek ekranda izleyin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Paydaş Sayısı" value={metrics.stakeholderCount} icon={<Users className="h-5 w-5" />} />
        <MetricCard title="Açık Teklifler" value={metrics.openQuotations} icon={<FileText className="h-5 w-5" />} />
        <MetricCard title="Aktif Siparişler" value={metrics.activeSalesOrders} icon={<ShoppingCart className="h-5 w-5" />} />
        <MetricCard title="Açık İş Emirleri" value={metrics.openWorkOrders} icon={<HardHat className="h-5 w-5" />} />
        <MetricCard title="Devam Eden Operasyonlar" value={metrics.activeOperations} icon={<ClipboardCheck className="h-5 w-5" />} />
        <MetricCard title="Fason Bekleyenler" value={metrics.waitingSubcontracting} icon={<Truck className="h-5 w-5" />} />
        <MetricCard title="Kritik Stoklar" value={metrics.lowStockItems} icon={<Package className="h-5 w-5" />} />
        <MetricCard title="Bekleyen Kalite Kontrol" value={metrics.pendingQualityChecks} icon={<ClipboardCheck className="h-5 w-5" />} />
        <MetricCard title="Yaklaşan Bakımlar" value={metrics.upcomingMaintenances} icon={<Wrench className="h-5 w-5" />} />
        <MetricCard title="Bugünkü Sevkiyatlar" value={metrics.todaysShipments} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <section className="rounded-md border bg-card p-4">
        <h2 className="text-lg font-semibold">Üretim Akışı</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          {["Teklif", "Sipariş", "İş Emri", "Operasyon", "Kalite", "Sevkiyat"].map((step, index) => (
            <div key={step} className="rounded-md border bg-background p-3 text-sm">
              <span className="text-xs text-muted-foreground">{index + 1}</span>
              <p className="font-medium">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ERPModuleCard title="CRM" description="Müşteri, tedarikçi ve fason paydaş yönetimi" href="/erp/crm" icon={<ShoppingCart className="h-5 w-5" />} />
        <ERPModuleCard title="Üretim" description="İş emri, rota ve operasyon takibi" href="/erp/work-orders" icon={<HardHat className="h-5 w-5" />} />
        <ERPModuleCard title="Stok" description="Stok kartları ve kritik stok izlemesi" href="/erp/inventory" icon={<Package className="h-5 w-5" />} />
        <ERPModuleCard title="Kalite" description="Kalite raporları ve ölçüm sonuçları" href="/erp/quality" icon={<ClipboardCheck className="h-5 w-5" />} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Metrikler güncelleniyor...</p> : null}
    </ERPLayout>
  );
}
