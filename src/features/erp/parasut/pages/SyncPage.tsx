import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/erp/DataTable";
import { useParasutSyncStatus } from "../api/queries";
import { formatCount, formatParasutDateTime } from "../utils/format";
import { ParasutErrorState, ParasutLoadingState, ParasutPermissionDeniedState } from "../components/ParasutStateViews";
import { RESOURCE_TYPE_LABELS, type SyncErrorRow, type SyncRunRow } from "../types";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { PARASUT_SYNC_PERMISSION } from "../navigation";

function runStatusTone(status: SyncRunRow["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  if (status === "partial") return "secondary";
  return "outline";
}

const RUN_STATUS_LABELS: Record<SyncRunRow["status"], string> = {
  completed: "Tamamlandı",
  failed: "Başarısız",
  partial: "Kısmi",
  running: "Çalışıyor",
};

export default function SyncPage() {
  const { hasPermission } = useERPAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useParasutSyncStatus({ page, pageSize: 20 });

  if (!hasPermission(PARASUT_SYNC_PERMISSION)) return <ParasutPermissionDeniedState />;

  const runColumns: DataTableColumn<SyncRunRow>[] = [
    { key: "resource", header: "Kaynak", render: (row) => RESOURCE_TYPE_LABELS[row.resource_type] ?? row.resource_type },
    { key: "status", header: "Durum", render: (row) => <Badge variant={runStatusTone(row.status)}>{RUN_STATUS_LABELS[row.status]}</Badge> },
    { key: "started", header: "Başlangıç", render: (row) => formatParasutDateTime(row.started_at) },
    { key: "finished", header: "Bitiş", render: (row) => formatParasutDateTime(row.completed_at) },
    { key: "inserted", header: "Eklenen", className: "text-right", render: (row) => formatCount(row.records_inserted) },
    { key: "updated", header: "Güncellenen", className: "text-right", render: (row) => formatCount(row.records_updated) },
    { key: "unchanged", header: "Değişmeyen", className: "text-right", render: (row) => formatCount(row.records_unchanged) },
    { key: "failed", header: "Hatalı", className: "text-right", render: (row) => formatCount(row.error_count) },
    {
      key: "duration",
      header: "Süre",
      render: (row) => {
        if (!row.completed_at) return "—";
        const seconds = Math.max(0, Math.round((new Date(row.completed_at).getTime() - new Date(row.started_at).getTime()) / 1000));
        return `${seconds} sn`;
      },
    },
  ];

  const errorColumns: DataTableColumn<SyncErrorRow>[] = [
    { key: "resource", header: "Kaynak", render: (row) => RESOURCE_TYPE_LABELS[row.resource_type] ?? row.resource_type },
    { key: "operation", header: "İşlem", render: (row) => (row.parasut_id ? `Kayıt: ${row.parasut_id}` : "Genel") },
    { key: "external_id", header: "Harici ID", className: "font-mono text-xs", render: (row) => row.parasut_id ?? "—" },
    { key: "code", header: "Hata Kodu", render: (row) => row.error_code ?? "—" },
    { key: "message", header: "Hata Mesajı", render: (row) => row.sanitized_message },
    { key: "occurred", header: "Zaman", render: (row) => formatParasutDateTime(row.occurred_at) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Senkronizasyon" description="Paraşüt aynası senkronizasyon çalışmaları ve hataları. Tüm hata mesajları kayıt sırasında maskelenmiştir; erişim anahtarları burada gösterilmez." />

      {isLoading ? (
        <ParasutLoadingState />
      ) : isError || !data ? (
        <ParasutErrorState message={error instanceof Error ? error.message : "Senkronizasyon durumu alınamadı."} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {data.latestRunPerResource.map((entry) => (
              <Card key={entry.resourceType} className="erp-surface">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{RESOURCE_TYPE_LABELS[entry.resourceType] ?? entry.resourceType}</CardTitle>
                </CardHeader>
                <CardContent>
                  {entry.latestRun ? (
                    <>
                      <Badge variant={runStatusTone(entry.latestRun.status)}>{RUN_STATUS_LABELS[entry.latestRun.status]}</Badge>
                      <p className="mt-2 text-xs text-erp-muted">Son çalışma: {formatParasutDateTime(entry.latestRun.started_at)}</p>
                    </>
                  ) : (
                    <p className="text-xs text-erp-muted">Henüz senkronizasyon çalıştırılmadı.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="erp-surface">
            <CardHeader>
              <CardTitle className="text-base">Senkronizasyon Çalışmaları</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={runColumns}
                data={data.runs}
                rowKey={(row) => row.id}
                emptyMessage="Henüz senkronizasyon çalışması yok."
                onRowClick={(row) => navigate(`/apps/parasut/senkronizasyon/${row.id}`)}
              />
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>Toplam {formatCount(data.runTotal)} çalışma</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40">
                    Önceki
                  </button>
                  <button
                    type="button"
                    disabled={page * data.pageSize >= data.runTotal}
                    onClick={() => setPage((prev) => prev + 1)}
                    className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="erp-surface">
            <CardHeader>
              <CardTitle className="text-base">Senkronizasyon Hataları</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={errorColumns} data={data.errors} rowKey={(row) => row.id} emptyMessage="Kayıtlı senkronizasyon hatası yok." />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
