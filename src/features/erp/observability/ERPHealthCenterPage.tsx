import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Activity, AlertTriangle, Clock, Database, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import {
  getERPDatabaseStatus,
  acknowledgePlatformAlert,
  listAccountingEntries,
  listAuditLogs,
  listBranches,
  listCompanies,
  listDocuments,
  listInventoryItems,
  listInventoryMovements,
  listNotifications,
  listPaymentProviderEvents,
  listPaymentProviderHealth,
  listPaymentReconciliationLogs,
  listPaymentRefundOperations,
  listPlatformOperationalSummary,
  listShopFulfillmentHistory,
  listShopPaymentStatuses,
  listShopReturnRequests,
  listShopShipments,
  listWebsiteMediaAssets,
  resolvePlatformAlert,
  type PlatformOperationalSummary,
} from "../shared/erpApi";
import {
  AccountingEntry,
  Company,
  CompanyBranch,
  DocumentMetadata,
  ERPAuditLog,
  ERPDatabaseStatus,
  ERPNotification,
  InventoryItem,
  InventoryMovement,
  PaymentProviderEvent,
  PaymentProviderHealth,
  PaymentReconciliationLog,
  PaymentRefundOperation,
  PlatformAlertRecord,
  ShopFulfillmentHistory,
  ShopPaymentStatusRecord,
  ShopReturnRequest,
  ShopShipment,
  WebsiteMediaAsset,
} from "../shared/types";
import {
  AlertDefinition,
  HealthItem,
  OperationalMetric,
  OperationalTone,
  PlatformTimelineEvent,
  buildMetric,
  healthTone,
  percentage,
  sortTimeline,
  summarizeStatus,
} from "./observabilityMetrics";

type HealthData = {
  databaseStatus: ERPDatabaseStatus | null;
  companies: Company[];
  branches: CompanyBranch[];
  auditLogs: ERPAuditLog[];
  notifications: ERPNotification[];
  providerEvents: PaymentProviderEvent[];
  providerHealth: PaymentProviderHealth[];
  reconciliationLogs: PaymentReconciliationLog[];
  refunds: PaymentRefundOperation[];
  accountingEntries: AccountingEntry[];
  paymentStatuses: ShopPaymentStatusRecord[];
  shipments: ShopShipment[];
  fulfillment: ShopFulfillmentHistory[];
  returns: ShopReturnRequest[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  mediaAssets: WebsiteMediaAsset[];
  documents: DocumentMetadata[];
  platformSummary: PlatformOperationalSummary | null;
};

const emptyData: HealthData = {
  databaseStatus: null,
  companies: [],
  branches: [],
  auditLogs: [],
  notifications: [],
  providerEvents: [],
  providerHealth: [],
  reconciliationLogs: [],
  refunds: [],
  accountingEntries: [],
  paymentStatuses: [],
  shipments: [],
  fulfillment: [],
  returns: [],
  inventoryItems: [],
  inventoryMovements: [],
  mediaAssets: [],
  documents: [],
  platformSummary: null,
};

const alertLabels: Record<AlertDefinition["severity"], string> = {
  bilgi: "Bilgi",
  uyarı: "Uyarı",
  kritik: "Kritik",
};

function healthLabel(status: HealthItem["status"]) {
  if (status === "healthy") return "Sağlıklı";
  if (status === "warning") return "Uyarı";
  if (status === "critical") return "Kritik";
  return "Bilinmiyor";
}

function companyName(companies: Company[], id: string | null | undefined) {
  return companies.find((company) => company.id === id)?.trade_name || companies.find((company) => company.id === id)?.legal_name || "-";
}

function branchName(branches: CompanyBranch[], id: string | null | undefined) {
  return branches.find((branch) => branch.id === id)?.name || "-";
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function severityTone(severity: string): OperationalTone {
  if (severity === "success") return "success";
  if (severity === "warning") return "warning";
  if (severity === "critical") return "danger";
  return "default";
}

function severityLabel(severity: string) {
  if (severity === "critical") return "Kritik";
  if (severity === "warning") return "Uyarı";
  if (severity === "success") return "Başarılı";
  return "Bilgi";
}

function alertStatusLabel(status: PlatformAlertRecord["status"]) {
  if (status === "open") return "Açık";
  if (status === "acknowledged") return "Onaylandı";
  if (status === "resolved") return "Çözüldü";
  return "Kapatıldı";
}

export default function ERPHealthCenterPage() {
  const [data, setData] = useState<HealthData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    actor: "",
    companyId: "all",
    branchId: "all",
    module: "all",
    action: "all",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    const [
      databaseStatus,
      companies,
      branches,
      auditLogs,
      notifications,
      providerEvents,
      providerHealth,
      reconciliationLogs,
      refunds,
      accountingEntries,
      paymentStatuses,
      shipments,
      fulfillment,
      returns,
      inventoryItems,
      inventoryMovements,
      mediaAssets,
      documents,
      platformSummary,
    ] = await Promise.all([
      getERPDatabaseStatus(),
      listCompanies(),
      listBranches(),
      listAuditLogs({ limit: 300 }),
      listNotifications(200, true),
      listPaymentProviderEvents(),
      listPaymentProviderHealth(),
      listPaymentReconciliationLogs(),
      listPaymentRefundOperations(),
      listAccountingEntries(),
      listShopPaymentStatuses(),
      listShopShipments(),
      listShopFulfillmentHistory(),
      listShopReturnRequests(),
      listInventoryItems(),
      listInventoryMovements(),
      listWebsiteMediaAssets(),
      listDocuments(),
      listPlatformOperationalSummary(),
    ]);

    const firstError = [
      databaseStatus,
      companies,
      branches,
      auditLogs,
      notifications,
      providerEvents,
      providerHealth,
      reconciliationLogs,
      refunds,
      accountingEntries,
      paymentStatuses,
      shipments,
      fulfillment,
      returns,
      inventoryItems,
      inventoryMovements,
      mediaAssets,
      documents,
      platformSummary,
    ].find((result) => result.error)?.error;

    setError(firstError ?? null);
    setData({
      databaseStatus: databaseStatus.data,
      companies: companies.data,
      branches: branches.data,
      auditLogs: auditLogs.data,
      notifications: notifications.data,
      providerEvents: providerEvents.data,
      providerHealth: providerHealth.data,
      reconciliationLogs: reconciliationLogs.data,
      refunds: refunds.data,
      accountingEntries: accountingEntries.data,
      paymentStatuses: paymentStatuses.data,
      shipments: shipments.data,
      fulfillment: fulfillment.data,
      returns: returns.data,
      inventoryItems: inventoryItems.data,
      inventoryMovements: inventoryMovements.data,
      mediaAssets: mediaAssets.data,
      documents: documents.data,
      platformSummary: platformSummary.data,
    });
    setLoading(false);
  };

  const handleAcknowledgeAlert = async (id: string) => {
    const result = await acknowledgePlatformAlert(id);
    if (result.error) setError(result.error);
    await load();
  };

  const handleResolveAlert = async (id: string) => {
    const result = await resolvePlatformAlert(id, "Resolved from ERP Health Center.");
    if (result.error) setError(result.error);
    await load();
  };

  useEffect(() => {
    load();
  }, []);

  const auditModules = useMemo(() => Array.from(new Set(data.auditLogs.map((row) => row.entity_type).filter(Boolean))).sort(), [data.auditLogs]);
  const auditActions = useMemo(() => Array.from(new Set(data.auditLogs.map((row) => row.action).filter(Boolean))).sort(), [data.auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const needle = filters.search.trim().toLocaleLowerCase("tr-TR");
    return data.auditLogs.filter((row) => {
      const matchesSearch =
        !needle ||
        [row.actor_email, row.entity_type, row.action, row.description, row.old_status, row.new_status, row.company_id, row.branch_id]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(needle);
      const matchesActor = !filters.actor || (row.actor_email ?? "").toLocaleLowerCase("tr-TR").includes(filters.actor.toLocaleLowerCase("tr-TR"));
      const matchesCompany = filters.companyId === "all" || row.company_id === filters.companyId;
      const matchesBranch = filters.branchId === "all" || row.branch_id === filters.branchId;
      const matchesModule = filters.module === "all" || row.entity_type === filters.module;
      const matchesAction = filters.action === "all" || row.action === filters.action;
      return matchesSearch && matchesActor && matchesCompany && matchesBranch && matchesModule && matchesAction;
    });
  }, [data.auditLogs, filters]);

  const healthItems = useMemo<HealthItem[]>(() => {
    const failedProviderEvents = data.providerEvents.filter((row) => row.processing_status === "failed").length;
    const failedPayments = data.paymentStatuses.filter((row) => row.status === "failed").length;
    const pendingReconciliation = data.reconciliationLogs.filter((row) => row.status === "pending" || row.status === "manual_review").length;
    const providerIssues = data.providerHealth.filter((row) => row.status !== "healthy").length;
    const unreadNotifications = data.notifications.filter((row) => !row.is_read).length;
    const lowStock = data.inventoryItems.filter((row) => row.current_stock <= row.min_stock).length;
    const missingFiles = data.documents.filter((row) => !row.file_path).length + data.mediaAssets.filter((row) => !row.file_path).length;

    return [
      {
        key: "application",
        title: "Uygulama Sağlığı",
        status: error ? "warning" : "healthy",
        value: error ? "Uyarı" : "Çalışıyor",
        description: error ? "Veri yükleme sırasında uyarı alındı." : "ERP ekranı ve veri toplama çalışıyor.",
      },
      {
        key: "database",
        title: "Veritabanı Sağlığı",
        status: data.databaseStatus?.overall === "ready" ? "healthy" : data.databaseStatus?.overall === "rls_check_required" ? "warning" : "critical",
        value: data.databaseStatus?.label ?? "Bilinmiyor",
        description: `${data.databaseStatus?.tables.filter((table) => table.status === "ready").length ?? 0} tablo hazır.`,
      },
      {
        key: "edge",
        title: "Edge Function Sağlığı",
        status: summarizeStatus(failedProviderEvents, 1, 5),
        value: `${failedProviderEvents} hata`,
        description: "Webhook, ödeme, e-posta ve otomasyon fonksiyonları olay kayıtlarıyla izleniyor.",
      },
      {
        key: "payment",
        title: "Ödeme Sağlığı",
        status: summarizeStatus(failedPayments + providerIssues, 1, 5),
        value: `${failedPayments} başarısız ödeme`,
        description: `${providerIssues} sağlayıcı uyarısı izleniyor.`,
      },
      {
        key: "webhook",
        title: "Webhook Sağlığı",
        status: summarizeStatus(failedProviderEvents, 1, 3),
        value: `${failedProviderEvents} başarısız olay`,
        description: "İmza doğrulama, tekrar ve hata kayıtları ödeme olaylarından izleniyor.",
      },
      {
        key: "queue",
        title: "Kuyruk Sağlığı",
        status: summarizeStatus(unreadNotifications + pendingReconciliation, 10, 25),
        value: `${pendingReconciliation} mutabakat`,
        description: `${unreadNotifications} okunmamış bildirim ve bekleyen finans kontrolü.`,
      },
      {
        key: "storage",
        title: "Depolama Sağlığı",
        status: summarizeStatus(missingFiles, 1, 5),
        value: `${missingFiles} eksik yol`,
        description: `${data.documents.length} doküman ve ${data.mediaAssets.length} medya kaydı izleniyor.`,
      },
      {
        key: "inventory",
        title: "Stok Sağlığı",
        status: summarizeStatus(lowStock, 1, 10),
        value: `${lowStock} kritik stok`,
        description: "Stok minimumları ve hareket kayıtları operasyonel görünürlük için izleniyor.",
      },
    ];
  }, [data, error]);

  const metrics = useMemo<OperationalMetric[]>(() => {
    const persistedMetrics = data.platformSummary?.metrics ?? [];
    if (persistedMetrics.length) {
      return persistedMetrics.map((metric) =>
        buildMetric(
          metric.metric_key,
          metric.metric_name,
          metric.metric_value ?? "-",
          `${metric.source} / ${metric.module}${metric.metric_unit ? ` / ${metric.metric_unit}` : ""}`,
          severityTone(metric.severity),
        ),
      );
    }

    const failedProviderEvents = data.providerEvents.filter((row) => row.processing_status === "failed").length;
    const duplicateEvents = data.providerEvents.filter((row) => row.duplicate_detected).length;
    const failedPayments = data.paymentStatuses.filter((row) => row.status === "failed").length;
    const pendingRefunds = data.refunds.filter((row) => row.status === "requested" || row.status === "erp_review" || row.status === "provider_pending").length;
    const lowStock = data.inventoryItems.filter((row) => row.current_stock <= row.min_stock).length;
    const unreadNotifications = data.notifications.filter((row) => !row.is_read).length;
    const totalEvents = data.providerEvents.length + data.auditLogs.length + data.notifications.length;
    return [
      buildMetric("requests", "İşlem Hacmi", totalEvents, "Audit, bildirim ve ödeme olayları", "default"),
      buildMetric("failures", "Hata Oranı", percentage(failedProviderEvents + failedPayments, Math.max(totalEvents, 1)), "Ödeme ve webhook kaynaklı hatalar", failedProviderEvents + failedPayments ? "danger" : "success"),
      buildMetric("retries", "Tekrar Olayları", duplicateEvents, "Tekrar yakalanan webhook olayları", duplicateEvents ? "warning" : "success"),
      buildMetric("latency", "Gecikme Takibi", "Hazır", "Edge ve API süreleri için temel metrik alanı", "muted"),
      buildMetric("payment-events", "Ödeme Olayları", data.providerEvents.length, "Sağlayıcı olay kayıtları", "default"),
      buildMetric("webhook-events", "Webhook Hataları", failedProviderEvents, "Başarısız webhook işleme", failedProviderEvents ? "danger" : "success"),
      buildMetric("erp-actions", "ERP Aksiyonları", data.auditLogs.length, "Audit log kapsamı", "default"),
      buildMetric("inventory", "Stok Uyarısı", lowStock, "Minimum seviyedeki stoklar", lowStock ? "warning" : "success"),
      buildMetric("refunds", "Bekleyen İade", pendingRefunds, "İnceleme veya sağlayıcı bekleyen iadeler", pendingRefunds ? "warning" : "success"),
      buildMetric("queue", "Okunmamış Bildirim", unreadNotifications, "Operasyon kuyruğu sinyali", unreadNotifications ? "warning" : "success"),
    ];
  }, [data]);

  const alerts = useMemo<AlertDefinition[]>(() => {
    const persistedAlerts = data.platformSummary?.alerts ?? [];
    if (persistedAlerts.length) {
      return persistedAlerts.map((alert) => ({
        key: alert.id,
        title: alert.title,
        severity: alert.severity === "critical" ? "kritik" : alert.severity === "warning" ? "uyarı" : "bilgi",
        active: alert.status === "open" || alert.status === "acknowledged",
        count: 1,
        description: alert.description ?? `${alert.source} / ${alert.module}`,
      }));
    }

    const failedPayments = data.paymentStatuses.filter((row) => row.status === "failed").length;
    const webhookFailures = data.providerEvents.filter((row) => row.processing_status === "failed").length;
    const syncFailures = data.notifications.filter((row) => row.category === "system" && row.severity === "danger").length;
    const inventoryIssues = data.inventoryItems.filter((row) => row.current_stock <= row.min_stock).length;
    const authAnomalies = data.auditLogs.filter((row) => row.entity_type.includes("auth") || row.action.includes("login")).length;
    return [
      { key: "failed-payments", title: "Başarısız Ödeme", severity: failedPayments >= 5 ? "kritik" : "uyarı", active: failedPayments > 0, count: failedPayments, description: "Ödeme sağlayıcısı veya müşteri ödeme akışı hatası." },
      { key: "webhook-failures", title: "Webhook Hatası", severity: webhookFailures >= 3 ? "kritik" : "uyarı", active: webhookFailures > 0, count: webhookFailures, description: "İmza, tekrar veya işleme hatası." },
      { key: "sync-failures", title: "Senkronizasyon Hatası", severity: syncFailures >= 3 ? "kritik" : "uyarı", active: syncFailures > 0, count: syncFailures, description: "Otomasyon veya entegrasyon bildirimleri." },
      { key: "inventory", title: "Stok Tutarsızlığı", severity: inventoryIssues >= 10 ? "kritik" : "uyarı", active: inventoryIssues > 0, count: inventoryIssues, description: "Minimum stok ve hareket doğrulama sinyalleri." },
      { key: "auth", title: "Kimlik Anomalisi", severity: authAnomalies >= 5 ? "kritik" : "bilgi", active: authAnomalies > 0, count: authAnomalies, description: "Kimlik ve oturum audit olayları." },
    ];
  }, [data]);

  const timeline = useMemo<PlatformTimelineEvent[]>(() => {
    const persistedEvents = (data.platformSummary?.events ?? []).map((row) => ({
      id: `platform-${row.id}`,
      module: row.module,
      title: row.title,
      description: row.description || row.event_type,
      actor: row.actor_email || row.source,
      companyId: row.company_id,
      branchId: row.branch_id,
      createdAt: row.occurred_at,
      tone: severityTone(row.severity),
    } satisfies PlatformTimelineEvent));
    const paymentEvents = data.providerEvents.map((row) => ({
      id: `payment-${row.id}`,
      module: "Ödeme",
      title: row.event_type,
      description: `${row.provider} sağlayıcı olayı ${row.processing_status}`,
      actor: row.customer_user_id ?? "Sağlayıcı",
      companyId: row.company_id,
      branchId: row.branch_id,
      createdAt: row.received_at,
      tone: row.processing_status === "failed" ? "danger" : row.duplicate_detected ? "warning" : "success",
    } satisfies PlatformTimelineEvent));
    const fulfillmentEvents = data.fulfillment.map((row) => ({
      id: `fulfillment-${row.id}`,
      module: "Sevkiyat",
      title: row.to_status,
      description: row.description || "Fulfillment durumu güncellendi.",
      actor: row.created_by || row.customer_user_id || "Sistem",
      createdAt: row.created_at,
      tone: "default",
    } satisfies PlatformTimelineEvent));
    const inventoryEvents = data.inventoryMovements.slice(0, 60).map((row) => ({
      id: `inventory-${row.id}`,
      module: "Stok",
      title: row.movement_type,
      description: `${row.quantity} hareket kaydı`,
      actor: row.source_type || "ERP",
      companyId: row.company_id,
      branchId: row.branch_id,
      createdAt: row.created_at,
      tone: row.movement_type === "adjustment" ? "warning" : "default",
    } satisfies PlatformTimelineEvent));
    const auditEvents = data.auditLogs.slice(0, 80).map((row) => ({
      id: `audit-${row.id}`,
      module: row.entity_type,
      title: row.action,
      description: row.description || "ERP audit olayı",
      actor: row.actor_email || "Sistem",
      companyId: row.company_id,
      branchId: row.branch_id,
      createdAt: row.created_at,
      tone: row.action.includes("failed") ? "danger" : "default",
    } satisfies PlatformTimelineEvent));
    const automationEvents = data.notifications.slice(0, 60).map((row) => ({
      id: `notification-${row.id}`,
      module: row.category,
      title: row.title,
      description: row.body || "Sistem bildirimi",
      actor: row.recipient_email || "Otomasyon",
      companyId: row.company_id,
      branchId: row.branch_id,
      createdAt: row.created_at,
      tone: row.severity === "danger" ? "danger" : row.severity === "warning" ? "warning" : row.severity === "success" ? "success" : "default",
    } satisfies PlatformTimelineEvent));
    return sortTimeline([...persistedEvents, ...paymentEvents, ...fulfillmentEvents, ...inventoryEvents, ...auditEvents, ...automationEvents]).slice(0, 200);
  }, [data]);

  const activeAlerts = data.platformSummary?.openAlertCount ?? alerts.filter((alert) => alert.active).length;
  const criticalHealth = data.platformSummary?.criticalAlertCount ?? healthItems.filter((item) => item.status === "critical").length;

  return (
    <ERPLayout title="Sağlık Merkezi">
      <PageHeader
        title="Sağlık Merkezi"
        description="ERP, veritabanı, ödeme, webhook, kuyruk, depolama ve operasyon olayları için merkezi izleme ekranı."
        actions={<Button variant="outline" onClick={load} disabled={loading}>{loading ? "Yükleniyor" : "Yenile"}</Button>}
      />

      {error ? <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard title="Aktif Uyarı" value={activeAlerts} description="tanımlı alarm koşulu" tone={activeAlerts ? "warning" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
        <OverviewCard title="Kritik Sağlık" value={criticalHealth} description="kritik sistem başlığı" tone={criticalHealth ? "danger" : "success"} icon={<Activity className="h-4 w-4" />} />
        <OverviewCard title="Şirket Kapsamı" value={data.companies.length} description="izlenen şirket" tone="default" icon={<ShieldCheck className="h-4 w-4" />} />
        <OverviewCard title="Şube Kapsamı" value={data.branches.length} description="izlenen şube" tone="default" icon={<Database className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="health">Sağlık</TabsTrigger>
          <TabsTrigger value="metrics">Metrikler</TabsTrigger>
          <TabsTrigger value="audit">Audit Explorer</TabsTrigger>
          <TabsTrigger value="timeline">Zaman Çizelgesi</TabsTrigger>
          <TabsTrigger value="alerts">Alarmlar</TabsTrigger>
          <TabsTrigger value="governance">Yönetişim</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {healthItems.map((item) => (
              <Card key={item.key} className="erp-surface rounded-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-sm">
                    {item.title}
                    <StatusBadge label={healthLabel(item.status)} tone={healthTone(item.status)} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{item.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {metrics.map((metric) => <OverviewCard key={metric.key} title={metric.label} value={metric.value} description={metric.description} tone={metric.tone === "muted" ? "default" : metric.tone} />)}
          </div>
          <ScheduleFoundation jobRuns={data.platformSummary?.scheduledJobRuns ?? []} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card className="erp-surface rounded-lg">
            <CardHeader><CardTitle className="text-base">Audit Filtreleri</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <Input placeholder="Ara" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
              <Input placeholder="Aktör" value={filters.actor} onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value }))} />
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.companyId} onChange={(event) => setFilters((current) => ({ ...current, companyId: event.target.value, branchId: "all" }))}>
                <option value="all">Tüm Şirketler</option>
                {data.companies.map((company) => <option key={company.id} value={company.id}>{company.trade_name || company.legal_name}</option>)}
              </select>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.branchId} onChange={(event) => setFilters((current) => ({ ...current, branchId: event.target.value }))}>
                <option value="all">Tüm Şubeler</option>
                {data.branches.filter((branch) => filters.companyId === "all" || branch.company_id === filters.companyId).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.module} onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}>
                <option value="all">Tüm Modüller</option>
                {auditModules.map((module) => <option key={module} value={module}>{module}</option>)}
              </select>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}>
                <option value="all">Tüm Aksiyonlar</option>
                {auditActions.map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
            </CardContent>
          </Card>
          <DataTable
            data={filteredAuditLogs}
            rowKey={(row) => row.id}
            emptyMessage="Audit kaydı bulunamadı"
            columns={[
              { key: "time", header: "Zaman", render: (row) => dateLabel(row.created_at) },
              { key: "actor", header: "Aktör", render: (row) => row.actor_email || "Sistem" },
              { key: "scope", header: "Kapsam", render: (row) => <div><p>{companyName(data.companies, row.company_id)}</p><p className="text-xs text-muted-foreground">{branchName(data.branches, row.branch_id)}</p></div> },
              { key: "module", header: "Modül", render: (row) => row.entity_type },
              { key: "action", header: "Aksiyon", render: (row) => row.action },
              { key: "description", header: "Açıklama", render: (row) => row.description || "-" },
            ]}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <DataTable
            data={timeline}
            rowKey={(row) => row.id}
            emptyMessage="Olay kaydı bulunamadı"
            columns={[
              { key: "time", header: "Zaman", render: (row) => dateLabel(row.createdAt) },
              { key: "module", header: "Alan", render: (row) => <StatusBadge label={row.module} tone={row.tone} /> },
              { key: "title", header: "Olay", render: (row) => <div><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground">{row.description}</p></div> },
              { key: "actor", header: "Kaynak", render: (row) => row.actor },
              { key: "scope", header: "Kapsam", render: (row) => <div><p>{companyName(data.companies, row.companyId)}</p><p className="text-xs text-muted-foreground">{branchName(data.branches, row.branchId)}</p></div> },
            ]}
          />
        </TabsContent>

        <TabsContent value="alerts">
          {(data.platformSummary?.alerts ?? []).length ? (
            <DataTable
              data={data.platformSummary?.alerts ?? []}
              rowKey={(row) => row.id}
              emptyMessage="Alarm kaydı bulunamadı"
              columns={[
                { key: "time", header: "Zaman", render: (row) => dateLabel(row.created_at) },
                { key: "title", header: "Alarm", render: (row) => <div><p className="font-medium">{row.title}</p><p className="text-xs text-muted-foreground">{row.description || `${row.source} / ${row.module}`}</p></div> },
                { key: "severity", header: "Önem", render: (row) => <StatusBadge label={severityLabel(row.severity)} tone={severityTone(row.severity)} /> },
                { key: "status", header: "Durum", render: (row) => <StatusBadge label={alertStatusLabel(row.status)} tone={row.status === "resolved" ? "success" : row.status === "acknowledged" ? "warning" : row.status === "open" ? "danger" : "muted"} /> },
                { key: "scope", header: "Kapsam", render: (row) => <div><p>{companyName(data.companies, row.company_id)}</p><p className="text-xs text-muted-foreground">{branchName(data.branches, row.branch_id)}</p></div> },
                {
                  key: "actions",
                  header: "İşlem",
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={row.status !== "open" || loading} onClick={() => handleAcknowledgeAlert(row.id)}>Onayla</Button>
                      <Button size="sm" variant="outline" disabled={row.status === "resolved" || loading} onClick={() => handleResolveAlert(row.id)}>Çöz</Button>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {alerts.map((alert) => (
                <Card key={alert.key} className="erp-surface rounded-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-sm">
                      {alert.title}
                      <StatusBadge label={alert.active ? alertLabels[alert.severity] : "Pasif"} tone={alert.active ? alert.severity === "kritik" ? "danger" : alert.severity === "uyarı" ? "warning" : "default" : "muted"} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{alert.count}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{alert.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OverviewCard title="Güvenlik Özeti" value={data.auditLogs.filter((row) => row.action.includes("permission") || row.action.includes("role")).length} description="rol ve yetki audit olayı" tone="default" icon={<ShieldCheck className="h-4 w-4" />} />
            <OverviewCard title="Operasyon Özeti" value={timeline.length} description="birleşik zaman çizelgesi olayı" tone="default" icon={<Clock className="h-4 w-4" />} />
            <OverviewCard title="Yedek Doğrulama" value="Hazır" description="Phase 27 prosedürleriyle izlenir" tone="success" icon={<Database className="h-4 w-4" />} />
            <OverviewCard title="İncident Özeti" value={data.notifications.filter((row) => row.severity === "danger").length} description="kritik sistem bildirimi" tone={data.notifications.some((row) => row.severity === "danger") ? "danger" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
          </div>
          <Card className="erp-surface rounded-lg">
            <CardHeader><CardTitle className="text-base">Performans Görünürlüğü</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
              <p>Rota performansı için istemci tarafı süre ölçümü alanı hazır.</p>
              <p>API performansı Supabase istek sonuçları ve hata oranlarıyla izlenir.</p>
              <p>Veritabanı performansı tablo durumu ve gelecekteki sorgu metrikleriyle izlenir.</p>
              <p>Edge Function performansı olay kayıtları, hata oranı ve sağlayıcı sağlık kayıtlarıyla izlenir.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ERPLayout>
  );
}

function OverviewCard({ title, value, description, tone = "default", icon }: { title: string; value: number | string; description: string; tone?: "default" | "success" | "warning" | "danger"; icon?: React.ReactNode }) {
  const toneClass = tone === "success" ? "text-emerald-300" : tone === "warning" ? "text-amber-300" : tone === "danger" ? "text-red-300" : "text-foreground";
  return (
    <Card className="erp-surface rounded-lg">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function ScheduleFoundation({ jobRuns }: { jobRuns: PlatformOperationalSummary["scheduledJobRuns"] }) {
  const jobs = [
    { name: "Mutabakat Kontrolü", cadence: "Saatlik", owner: "Finans", status: "Hazır" },
    { name: "Stok Doğrulama", cadence: "Günlük", owner: "Depo", status: "Hazır" },
    { name: "Webhook Temizliği", cadence: "Günlük", owner: "Sistem", status: "Taslak" },
    { name: "Yedek Doğrulama", cadence: "Haftalık", owner: "Platform", status: "Taslak" },
    { name: "RLS Kontrolü", cadence: "Dağıtım Öncesi", owner: "Güvenlik", status: "Hazır" },
  ];
  return (
    <Card className="erp-surface rounded-lg">
      <CardHeader><CardTitle className="text-base">Planlı Operasyon Temeli</CardTitle></CardHeader>
      <CardContent>
        <DataTable
          data={jobRuns.length ? jobRuns.map((job) => ({ name: job.job_name, cadence: dateLabel(job.created_at), owner: job.module, status: job.status === "success" ? "Başarılı" : job.status === "failed" ? "Hatalı" : job.status === "running" ? "Çalışıyor" : "Planlandı" })) : jobs}
          rowKey={(row) => `${row.name}-${row.cadence}`}
          columns={[
            { key: "name", header: "İş", render: (row) => row.name },
            { key: "cadence", header: jobRuns.length ? "Son Kayıt" : "Sıklık", render: (row) => row.cadence },
            { key: "owner", header: "Sorumlu", render: (row) => row.owner },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.status} tone={row.status === "Hazır" || row.status === "Başarılı" ? "success" : row.status === "Hatalı" ? "danger" : "muted"} /> },
          ]}
        />
      </CardContent>
    </Card>
  );
}
