import { useEffect, useState } from "react";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { listSubcontractingJobs } from "../shared/erpApi";
import { formatDate, formatNumber } from "../shared/formatters";
import { SubcontractingJob } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

function tone(status: SubcontractingJob["status"]) {
  if (status === "returned") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "sent" || status === "in_process") return "warning" as const;
  return "default" as const;
}

export default function SubcontractingPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SubcontractingJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listSubcontractingJobs();
      if (result.error) {
        toast({ title: "Hata", description: `Fason kayıtları yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Fason Takibi">
      <PageHeader
        title="Fason Takibi"
        description="Dis islem süreçlerini (isil islem, kaplama vb.) sevk-dönüs döngüsü ile izleyin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Fason kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Fason kaydı yok" description="İlk kayıtlar oluşturulduğunda bu ekranda listelenecektir." />
      ) : (
        <DataTable
          columns={[
            { key: "supplier", header: "Fason Firma", render: (row) => row.supplier?.company_name || "-" },
            { key: "process", header: "İşlem Tipi", render: (row) => row.process_type },
            { key: "sent", header: "Gönderim Tarihi", render: (row) => formatDate(row.created_at) },
            { key: "expected", header: "Beklenen Dönüs", render: (row) => formatDate(row.expected_return_date) },
            {
              key: "status",
              header: "Durum",
              render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} />,
            },
            { key: "qty_sent", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity_sent, 3) },
            { key: "qty_returned", header: "Dönen", className: "text-right", render: (row) => formatNumber(row.quantity_returned, 3) },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Fason kaydı bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
