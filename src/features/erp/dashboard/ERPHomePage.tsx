import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarClock, FileText, ListTodo, Package, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatCard } from "@/components/erp/StatCard";
import { ModuleCard } from "@/components/erp/ModuleCard";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { FilterDrawer } from "@/components/erp/FilterDrawer";
import { ViewToggle, type ViewMode } from "@/components/erp/ViewToggle";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { dashboardModules, visibleErpModules } from "@/config/erpModules";
import { getERPDashboardActivity, getERPDashboardMetrics, listERPQuotationsFromExistingTable } from "../shared/erpApi";
import { formatDateTime } from "../shared/formatters";
import { AUDIT_ACTION_LABELS } from "../shared/statusLabels";
import { DashboardMetrics, ERPDashboardActivity } from "../shared/types";

const defaultMetrics: DashboardMetrics = {
  stakeholderCount: 0,
  openQuotations: 0,
  activeSalesOrders: 0,
  openWorkOrders: 0,
  inventoryItemCount: 0,
  purchaseOrderCount: 0,
  auditLogCount: 0,
  unreadNotificationCount: 0,
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
  recentNotifications: [],
};

const fallbackActivity = [
  {
    title: "ERP panel yapısı hazır",
    description: "Kontrol paneli, modül navigasyonu, hızlı işlem ve bildirim merkezi devrede.",
    time: "Sistem",
    tone: "success" as const,
  },
  {
    title: "Teklif akışı bağlandı",
    description: "Mevcut PDF, WhatsApp ve e-posta mantığı yeni ERP route altında korunuyor.",
    time: "Hazır",
    tone: "default" as const,
  },
  {
    title: "Veri bağlantısı bekleniyor",
    description: "Gerçek aktivite kayıtları geldiğinde bu alan Supabase verisiyle dolacak.",
    time: "Yedek",
    tone: "muted" as const,
  },
];

export default function ERPHomePage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(defaultMetrics);
  const [activity, setActivity] = useState<ERPDashboardActivity>(defaultActivity);
  const [totalQuotations, setTotalQuotations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleView, setModuleView] = useState<ViewMode>("card");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [metricsResult, activityResult, quotationsResult] = await Promise.all([
        getERPDashboardMetrics(),
        getERPDashboardActivity(),
        listERPQuotationsFromExistingTable(),
      ]);

      setMetrics(metricsResult.data);
      setActivity(activityResult.data);
      setTotalQuotations(quotationsResult.data.length);
      setError(metricsResult.error || activityResult.error || quotationsResult.error);
      setLoading(false);
    };

    load();
  }, []);

  const pendingWorkCount = metrics.openWorkOrders + metrics.pendingQualityChecks + metrics.waitingSubcontracting;

  const recentActivity = useMemo(() => {
    const auditRows =
      activity.recentAuditLogs?.map((log) => ({
        title: AUDIT_ACTION_LABELS[log.action] || log.action,
        description: log.description || log.entity_type,
        time: formatDateTime(log.created_at),
        tone: "default" as const,
      })) || [];

    const notificationRows =
      activity.recentNotifications?.map((notification) => ({
        title: notification.title,
        description: notification.body || "Bildirim detayı bulunmuyor.",
        time: formatDateTime(notification.created_at),
        tone: notification.is_read ? ("muted" as const) : ("warning" as const),
      })) || [];

    return [...notificationRows, ...auditRows].slice(0, 6);
  }, [activity]);

  return (
    <ERPLayout title="Kontrol Paneli">
      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <PageHeader
            title="ERP Paneli"
            description="Dayan Dişli operasyon yönetim merkezi. Tekliften sevkiyata kadar günlük akışı tek yerden yönetin."
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/teklifler/yeni">
                <Plus className="mr-2 h-4 w-4" />
                Yeni Teklif
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/calculator">Hesaplamayı Aç</Link>
            </Button>
          </div>
        </div>
      </section>

      {error ? <MigrationNotice message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Toplam Teklif" value={totalQuotations} description="quotations tablosu" icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Açık Teklifler" value={metrics.openQuotations} description="ERP teklif görünümü" icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Siparişler" value={metrics.activeSalesOrders} description="aktif satış siparişi" icon={<ShoppingCart className="h-5 w-5" />} />
        <StatCard title="Bekleyen İşler" value={pendingWorkCount} description="iş emri, kalite, fason" icon={<ListTodo className="h-5 w-5" />} />
        <StatCard title="Güncel Modüller" value={visibleErpModules.length} description="aktif ve hazırlanan modüller" icon={<Package className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Modül Erişimi</h2>
              <p className="text-sm text-muted-foreground">Ana operasyon araçları ve üretim destek modülleri.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterDrawer />
              <ViewToggle value={moduleView} onChange={setModuleView} />
            </div>
          </div>

          {moduleView === "card" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboardModules.map((module) => (
                <ModuleCard
                  key={module.id}
                  title={module.title}
                  description={module.description}
                  path={module.path}
                  icon={module.icon}
                  status={module.status}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {dashboardModules.map((module) => (
                    <Link key={module.id} to={module.path} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                          <module.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{module.title}</p>
                          <p className="truncate text-sm text-muted-foreground">{module.description}</p>
                        </div>
                      </div>
                      <StatusBadge label={module.status === "active" ? "Aktif" : module.status === "beta" ? "Geliştiriliyor" : "Yakında"} tone={module.status === "active" ? "success" : "warning"} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-primary" />
                Hızlı Aksiyonlar
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild variant="outline" className="justify-start">
                <Link to="/teklifler/yeni">Yeni Teklif</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/siparisler">Yeni Sipariş</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/kargo">Kargo Etiketi</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link to="/calculator">Hesaplamayı Aç</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-primary" />
                Son Aktivite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(recentActivity.length > 0 ? recentActivity : fallbackActivity).map((item) => (
                <div key={`${item.title}-${item.time}`} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <StatusBadge label={item.time} tone={item.tone} />
                  </div>
                </div>
              ))}
              {loading ? <p className="text-xs text-muted-foreground">Metrikler güncelleniyor...</p> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </ERPLayout>
  );
}
