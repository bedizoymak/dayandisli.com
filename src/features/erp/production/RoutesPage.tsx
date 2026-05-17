import { useEffect, useState } from "react";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { listProductionRoutes } from "../shared/erpApi";
import { ProductionRoute } from "../shared/types";
import { formatDateTime } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";

export default function RoutesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ProductionRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listProductionRoutes();
      if (result.error) {
        toast({ title: "Hata", description: `Rotalar yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Üretim Rotalari">
      <PageHeader
        title="Üretim ve Rota Yönetimi"
        description="Rota sablonlarini ve operasyon siralarini yönetin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Rotalar yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Rota kaydi bulunamadi"
          description="Ilk sürümde rota adimlari için metadata yapisi hazirdir. Sonraki fazda rota adim editörü eklenecektir."
        />
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Rota Adi", render: (row) => row.name },
            { key: "description", header: "Açiklama", render: (row) => row.description || "-" },
            { key: "template", header: "Sablon", render: (row) => (row.is_template ? "Evet" : "Hayir") },
            { key: "created", header: "Olusturulma", render: (row) => formatDateTime(row.created_at) },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Rota kaydi yok"
        />
      )}
    </ERPLayout>
  );
}
