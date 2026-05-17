import { useEffect, useState } from "react";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { listShipments } from "../shared/erpApi";
import { formatDate } from "../shared/formatters";
import { SHIPMENT_STATUS_LABELS } from "../shared/statusLabels";
import { Shipment } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

function tone(status: Shipment["status"]) {
  if (status === "delivered") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "shipped") return "warning" as const;
  return "default" as const;
}

export default function ShipmentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listShipments();
      if (result.error) {
        toast({ title: "Hata", description: `Sevkiyat verisi yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Lojistik ve Sevkiyat">
      <PageHeader
        title="Lojistik ve Sevkiyat"
        description="Sevkiyat no, takip no, paket sayisi ve durum takibini buradan yapin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Sevkiyatlar yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Sevkiyat kaydi yok" description="Henüz sevkiyat kaydi bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "no", header: "Sevkiyat No", render: (row) => row.shipment_no },
            { key: "carrier", header: "Tasiyici", render: (row) => row.carrier || "-" },
            { key: "tracking", header: "Kargo Takip No", render: (row) => row.tracking_no || "-" },
            { key: "package", header: "Paket Sayisi", className: "text-right", render: (row) => row.package_count },
            { key: "date", header: "Sevk Tarihi", render: (row) => formatDate(row.shipment_date) },
            {
              key: "status",
              header: "Durum",
              render: (row) => <StatusBadge label={SHIPMENT_STATUS_LABELS[row.status] || row.status} tone={tone(row.status)} />,
            },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Sevkiyat kaydi bulunamadi"
        />
      )}
    </ERPLayout>
  );
}
