import { useEffect, useState } from "react";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { listMaintenanceTasks } from "../shared/erpApi";
import { formatDate } from "../shared/formatters";
import { MAINTENANCE_STATUS_LABELS } from "../shared/statusLabels";
import { MaintenanceTask } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

function tone(status: MaintenanceTask["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "in_progress") return "warning" as const;
  return "default" as const;
}

export default function MaintenancePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listMaintenanceTasks();
      if (result.error) {
        toast({ title: "Hata", description: `Bakım kayıtları yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Makine Bakım">
      <PageHeader
        title="Makine Bakım"
        description="Planlanan bakım, arıza ve tamamlanan bakım kayıtlarıni izleyin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Bakım kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Bakım kaydı yok" description="Henüz bakım görevi oluşturulmamış." />
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Görev", render: (row) => row.task_name },
            { key: "type", header: "Tip", render: (row) => row.task_type },
            { key: "date", header: "Planlanan Tarih", render: (row) => formatDate(row.planned_date) },
            {
              key: "status",
              header: "Durum",
              render: (row) => <StatusBadge label={MAINTENANCE_STATUS_LABELS[row.status] || row.status} tone={tone(row.status)} />,
            },
            { key: "created", header: "Kayıt", render: (row) => formatDate(row.created_at) },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Bakım kaydı bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
