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
    <ERPLayout title="Üretim Rotaları">
      <PageHeader
        title="Üretim ve Rota Yönetimi"
        description="Rota şablonlarini ve operasyon sıralarını yönetin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Rotalar yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Rota kaydı bulunamadı"
          description="İlk sürümde rota adımları için metadata yapısı hazırdır. Sonraki fazda rota adım editörü eklenecektir."
        />
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Rota Adı", render: (row) => row.name },
            { key: "description", header: "Açıklama", render: (row) => row.description || "-" },
            { key: "template", header: "Şablon", render: (row) => (row.is_template ? "Evet" : "Hayır") },
            { key: "created", header: "Oluşturulma", render: (row) => formatDateTime(row.created_at) },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Rota kaydı yok"
        />
      )}
    </ERPLayout>
  );
}
