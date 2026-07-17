import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/erp/DataTable";
import { useParasutSyncRunDetail } from "../api/queries";
import { formatCount, formatParasutDateTime } from "../utils/format";
import { ParasutErrorState, ParasutLoadingState, ParasutPermissionDeniedState } from "../components/ParasutStateViews";
import { RESOURCE_TYPE_LABELS, type SyncErrorRow } from "../types";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { PARASUT_SYNC_PERMISSION } from "../navigation";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-erp-muted">{label}</p>
      <p className="mt-0.5 text-sm text-erp-text">{value}</p>
    </div>
  );
}

function runStatusTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  if (status === "partial") return "secondary";
  return "outline";
}

const RUN_STATUS_LABELS: Record<string, string> = {
  completed: "Tamamlandı",
  failed: "Başarısız",
  partial: "Kısmi",
  running: "Çalışıyor",
};

function durationLabel(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const seconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  return `${seconds} sn`;
}

/** Only reads the non-secret resume cursor (see server/parasut/sync-checkpoint.ts) — never tokens/headers. */
function checkpointLabel(requestMetadata: Record<string, unknown> | null | undefined): string {
  const resume = requestMetadata?.resume as { last_completed_page?: number } | undefined;
  return typeof resume?.last_completed_page === "number" ? `Sayfa ${resume.last_completed_page}` : "—";
}

export default function SyncRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useERPAuth();
  const { data, isLoading, isError, error, refetch } = useParasutSyncRunDetail(runId);

  if (!hasPermission(PARASUT_SYNC_PERMISSION)) return <ParasutPermissionDeniedState />;

  const errorColumns: DataTableColumn<SyncErrorRow>[] = [
    { key: "external_id", header: "Harici ID", className: "font-mono text-xs", render: (row) => row.parasut_id ?? "—" },
    { key: "code", header: "Hata Kodu", render: (row) => row.error_code ?? "—" },
    { key: "message", header: "Hata Mesajı", render: (row) => row.sanitized_message },
    { key: "occurred", header: "Zaman", render: (row) => formatParasutDateTime(row.occurred_at) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Senkronizasyon Çalışması Detayı"
        description="Tek bir senkronizasyon çalışmasının tüm istatistikleri ve hataları. Erişim anahtarları veya kimlik bilgileri hiçbir zaman gösterilmez."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/apps/parasut/senkronizasyon")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Listeye Dön
          </Button>
        }
      />

      {isLoading ? (
        <ParasutLoadingState />
      ) : isError || !data ? (
        <ParasutErrorState message={error instanceof Error ? error.message : "Senkronizasyon çalışması bulunamadı."} onRetry={() => void refetch()} />
      ) : (
        <>
          <Card className="erp-surface">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">{RESOURCE_TYPE_LABELS[data.run.resource_type] ?? data.run.resource_type}</CardTitle>
              <Badge variant={runStatusTone(data.run.status)}>{RUN_STATUS_LABELS[data.run.status] ?? data.run.status}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="Başlangıç" value={formatParasutDateTime(data.run.started_at)} />
              <DetailField label="Bitiş" value={formatParasutDateTime(data.run.completed_at)} />
              <DetailField label="Süre" value={durationLabel(data.run.started_at, data.run.completed_at)} />
              <DetailField label="Sayfa Sayısı" value={formatCount(data.run.page_count)} />
              <DetailField label="Alınan Kayıt" value={formatCount(data.run.records_observed)} />
              <DetailField label="Eklenen" value={formatCount(data.run.records_inserted)} />
              <DetailField label="Güncellenen" value={formatCount(data.run.records_updated)} />
              <DetailField label="Değişmeyen" value={formatCount(data.run.records_unchanged)} />
              <DetailField label="Hatalı" value={formatCount(data.run.error_count)} />
              <DetailField label="Son Kontrol Noktası" value={checkpointLabel(data.run.request_metadata)} />
              <DetailField label="Şirket Kapsamı (ERP)" value={<span className="font-mono text-xs">{data.run.company_id}</span>} />
              <DetailField label="Paraşüt Şirket ID" value={<span className="font-mono text-xs">{data.run.parasut_company_id}</span>} />
            </CardContent>
          </Card>

          <Card className="erp-surface">
            <CardHeader>
              <CardTitle className="text-base">Bu Çalışmaya Ait Hatalar</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={errorColumns} data={data.errors} rowKey={(row) => row.id} emptyMessage="Bu çalışmada hata kaydedilmedi." />
            </CardContent>
          </Card>

          <p className="text-xs text-erp-muted">
            Bu sayfadaki hiçbir alan erişim anahtarı, yenileme anahtarı veya yetkilendirme başlığı içermez.{" "}
            <Link to="/apps/parasut/senkronizasyon" className="underline">
              Tüm çalışmalara dön
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
