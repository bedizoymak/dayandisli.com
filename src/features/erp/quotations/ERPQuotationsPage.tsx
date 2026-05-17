import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { listQuotations } from "../shared/erpApi";
import { formatCurrency, formatDateTime } from "../shared/formatters";
import { ERPQuotation } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

export default function ERPQuotationsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ERPQuotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listQuotations();
      if (result.error) {
        toast({ title: "Hata", description: `Teklifler yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Teklif Yönetimi">
      <PageHeader
        title="ERP Teklif Görünümü"
        description="Mevcut quotations tablosundaki teklifleri ERP ekranında görüntüleyin."
        actions={
          <Button asChild>
            <Link to="/teklif-sayfasi">Teklif Oluşturucuya Git</Link>
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Teklifler yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Teklif kaydı yok" description="Henüz kayıtlı teklif bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "teklif", header: "Teklif No", render: (row) => row.teklif_no },
            { key: "firma", header: "Firma", render: (row) => row.firma },
            { key: "ilgili", header: "Ilgili Kisi", render: (row) => row.ilgili_kisi },
            {
              key: "tutar",
              header: "Toplam",
              className: "text-right",
              render: (row) => formatCurrency(row.total ?? 0, row.active_currency || "TRY"),
            },
            { key: "tarih", header: "Oluşturulma", render: (row) => formatDateTime(row.created_at) },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Teklif bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
