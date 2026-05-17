import { useEffect, useState } from "react";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { listQualityReports } from "../shared/erpApi";
import { formatDate } from "../shared/formatters";
import { QUALITY_RESULT_LABELS } from "../shared/statusLabels";
import { QualityReport } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

function tone(result: QualityReport["result"]) {
  if (result === "passed") return "success" as const;
  if (result === "failed") return "danger" as const;
  if (result === "conditional") return "warning" as const;
  return "default" as const;
}

export default function QualityReportsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<QualityReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listQualityReports();
      if (result.error) {
        toast({ title: "Hata", description: `Kalite raporlari yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Kalite Kontrol">
      <PageHeader
        title="Kalite Kontrol"
        description="Ölçüm raporlarini ve geçti/kaldi/sartli sonuçlarini takip edin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Kalite raporlari yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Kalite raporu yok" description="Henüz kalite kontrol raporu bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "report", header: "Rapor No", render: (row) => row.report_no },
            { key: "date", header: "Kontrol Tarihi", render: (row) => formatDate(row.inspection_date) },
            {
              key: "result",
              header: "Sonuç",
              render: (row) => <StatusBadge label={QUALITY_RESULT_LABELS[row.result] || row.result} tone={tone(row.result)} />,
            },
            { key: "created", header: "Kayit", render: (row) => formatDate(row.created_at) },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Kalite raporu bulunamadi"
        />
      )}
    </ERPLayout>
  );
}
