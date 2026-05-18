import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { MetricCard } from "@/components/erp/MetricCard";
import { AlertTriangle, ClipboardCheck, FileText, HardHat, Package, ShoppingCart, Truck, Users, Wrench } from "lucide-react";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { getERPDashboardActivity, getERPDashboardMetrics } from "../shared/erpApi";
import { DashboardMetrics, ERPDashboardActivity } from "../shared/types";
import { ERPModuleCard } from "../layout/ERPModuleCard";
import { formatCurrency, formatDate, formatDateTime } from "../shared/formatters";
import { AUDIT_ACTION_LABELS } from "../shared/statusLabels";
import { ERPDatabaseStatusWidget } from "./ERPDatabaseStatusWidget";

const defaultMetrics: DashboardMetrics = {
  stakeholderCount: 0,
  openQuotations: 0,
  activeSalesOrders: 0,
  openWorkOrders: 0,
  inventoryItemCount: 0,
  purchaseOrderCount: 0,
  auditLogCount: 0,
  activeOperations: 0,
  waitingSubcontracting: 0,
  lowStockItems: 0,
  pendingQualityChecks: 0,
  upcomingMaintenances: 0,
  todaysShipments: 0,
};

const defaultActivity: ERPDashboardActivity = {
  recentSalesOrders: [],
  recentWorkOrders: [],
  recentSubcontractingJobs: [],
  lowStockItems: [],
  pendingQualityReports: [],
  recentAuditLogs: [],
};

export default function ERPHomePage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics);
  const [activity, setActivity] = useState<ERPDashboardActivity>(defaultActivity);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [metricsResult, activityResult] = await Promise.all([getERPDashboardMetrics(), getERPDashboardActivity()]);
      setMetrics(metricsResult.data);
      setActivity(activityResult.data);
      setError(metricsResult.error || activityResult.error);
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
        <Link to="/erp/crm"><MetricCard title="Paydaş Sayısı" value={metrics.stakeholderCount} icon={<Users className="h-5 w-5" />} /></Link>
        <Link to="/erp/quotations"><MetricCard title="Açık Teklifler" value={metrics.openQuotations} icon={<FileText className="h-5 w-5" />} /></Link>
        <Link to="/erp/sales-orders"><MetricCard title="Aktif Siparişler" value={metrics.activeSalesOrders} icon={<ShoppingCart className="h-5 w-5" />} /></Link>
        <Link to="/erp/work-orders"><MetricCard title="Açık İş Emirleri" value={metrics.openWorkOrders} icon={<HardHat className="h-5 w-5" />} /></Link>
        <Link to="/erp/inventory"><MetricCard title="Stok Kalemleri" value={metrics.inventoryItemCount} icon={<Package className="h-5 w-5" />} /></Link>
        <Link to="/erp/purchase-orders"><MetricCard title="Satın Alma" value={metrics.purchaseOrderCount} icon={<ShoppingCart className="h-5 w-5" />} /></Link>
        <MetricCard title="Audit Kayıtları" value={metrics.auditLogCount} icon={<FileText className="h-5 w-5" />} />
        <MetricCard title="Devam Eden Operasyonlar" value={metrics.activeOperations} icon={<ClipboardCheck className="h-5 w-5" />} />
        <Link to="/erp/subcontracting"><MetricCard title="Fason Bekleyenler" value={metrics.waitingSubcontracting} icon={<Truck className="h-5 w-5" />} /></Link>
        <Link to="/erp/inventory"><MetricCard title="Kritik Stoklar" value={metrics.lowStockItems} icon={<Package className="h-5 w-5" />} /></Link>
        <Link to="/erp/quality"><MetricCard title="Bekleyen Kalite Kontrol" value={metrics.pendingQualityChecks} icon={<ClipboardCheck className="h-5 w-5" />} /></Link>
        <Link to="/erp/maintenance"><MetricCard title="Yaklaşan Bakımlar" value={metrics.upcomingMaintenances} icon={<Wrench className="h-5 w-5" />} /></Link>
        <MetricCard title="Bugünkü Sevkiyatlar" value={metrics.todaysShipments} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <ERPDatabaseStatusWidget />

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Son Satış Siparişleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.recentSalesOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıt yok.</p>
            ) : (
              activity.recentSalesOrders.map((order) => (
                <Link key={order.id} to={`/erp/sales-orders/${order.id}`} className="flex justify-between rounded-md border p-2 text-sm hover:bg-muted/50">
                  <span>{order.order_no} - {order.title}</span>
                  <span>{formatCurrency(order.grand_total || 0, order.currency)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Son İş Emirleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.recentWorkOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıt yok.</p>
            ) : (
              activity.recentWorkOrders.map((workOrder) => (
                <Link key={workOrder.id} to={`/erp/work-orders/${workOrder.id}`} className="flex justify-between rounded-md border p-2 text-sm hover:bg-muted/50">
                  <span>{workOrder.work_order_no} - {workOrder.part_name || workOrder.title}</span>
                  <span>{formatDate(workOrder.planned_end_date)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kritik Stok Listesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kritik stok yok.</p>
            ) : (
              activity.lowStockItems.map((item) => (
                <Link key={item.id} to={`/erp/inventory/${item.id}`} className="flex justify-between rounded-md border p-2 text-sm hover:bg-muted/50">
                  <span>{item.code ? `${item.code} - ${item.name}` : item.name}</span>
                  <span>{item.current_stock} / {item.min_stock}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bekleyen Kalite Kontrolleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.pendingQualityReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bekleyen kalite kaydı yok.</p>
            ) : (
              activity.pendingQualityReports.map((report) => (
                <Link key={report.id} to={`/erp/quality/${report.id}`} className="flex justify-between rounded-md border p-2 text-sm hover:bg-muted/50">
                  <span>{report.report_no}</span>
                  <span>{formatDate(report.inspection_date)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Son İşlem Geçmişi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!activity.recentAuditLogs?.length ? (
              <p className="text-sm text-muted-foreground">Audit kaydı yok.</p>
            ) : (
              activity.recentAuditLogs.map((log) => (
                <div key={log.id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{AUDIT_ACTION_LABELS[log.action] || log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.description || log.entity_type}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Metrikler güncelleniyor...</p> : null}
    </ERPLayout>
  );
}
