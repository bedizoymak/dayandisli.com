import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../shared/erpApi";
import { formatDateTime } from "../shared/formatters";
import { NOTIFICATION_CATEGORY_LABELS, NOTIFICATION_SEVERITY_LABELS } from "../shared/statusLabels";
import { ERPNotification } from "../shared/types";

function severityTone(severity: ERPNotification["severity"]) {
  if (severity === "success") return "success" as const;
  if (severity === "warning") return "warning" as const;
  if (severity === "danger") return "danger" as const;
  return "default" as const;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ERPNotification[]>([]);
  const [includeRead, setIncludeRead] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listNotifications(200, includeRead);
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
    }
    setRows(result.data);
    setLoading(false);
  }, [includeRead]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(() => rows.filter((row) => !row.is_read).length, [rows]);

  const markRead = async (notification: ERPNotification) => {
    const result = await markNotificationRead(notification.id);
    if (result.error) {
      toast({ title: "Bildirim", description: result.error, variant: "destructive" });
      return;
    }
    await load();
  };

  const markAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (result.error) {
      toast({ title: "Bildirim", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Bildirimler güncellendi", description: "Tüm bildirimler okundu işaretlendi." });
    await load();
  };

  return (
    <ERPLayout title="Bildirimler">
      <PageHeader
        title="Bildirimler"
        description="Üretim, kalite, fason ve sevkiyat akışlarından gelen uyarıları takip edin."
        actions={
          <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
            Tümünü Okundu İşaretle
          </Button>
        }
      />

      {error ? <MigrationNotice message={error} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4">
        <div>
          <p className="text-sm text-muted-foreground">Okunmamış</p>
          <p className="text-2xl font-semibold">{unreadCount}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeRead} onChange={(event) => setIncludeRead(event.target.checked)} />
          Okunmuşları göster
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Bildirimler yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Bildirim yok" description="Akış bildirimleri burada görünecek." />
      ) : (
        <DataTable
          columns={[
            {
              key: "severity",
              header: "Seviye",
              render: (row) => <StatusBadge label={NOTIFICATION_SEVERITY_LABELS[row.severity] || row.severity} tone={severityTone(row.severity)} />,
            },
            { key: "category", header: "Kategori", render: (row) => NOTIFICATION_CATEGORY_LABELS[row.category] || row.category },
            {
              key: "title",
              header: "Bildirim",
              render: (row) => (
                <div>
                  <p className={row.is_read ? "font-medium text-muted-foreground" : "font-semibold"}>{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.body || "-"}</p>
                </div>
              ),
            },
            { key: "date", header: "Tarih", render: (row) => formatDateTime(row.created_at) },
            {
              key: "actions",
              header: "İşlem",
              className: "text-right",
              render: (row) => (
                <div className="flex justify-end gap-2">
                  {row.action_url ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to={row.action_url}>Aç</Link>
                    </Button>
                  ) : null}
                  {!row.is_read ? (
                    <Button variant="outline" size="sm" onClick={() => markRead(row)}>
                      Okundu
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          data={rows}
          rowKey={(row) => row.id}
        />
      )}
    </ERPLayout>
  );
}
