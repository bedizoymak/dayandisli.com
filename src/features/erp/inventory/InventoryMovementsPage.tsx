import { useEffect, useState } from "react";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { listInventoryMovements } from "../shared/erpApi";
import { formatDateTime, formatNumber } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { InventoryMovement } from "../shared/types";

export default function InventoryMovementsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listInventoryMovements();
      if (result.error) {
        toast({ title: "Hata", description: `Stok hareketleri yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Stok Hareketleri">
      <PageHeader
        title="Stok Hareketleri"
        description="Giris, çikis ve düzeltme hareketlerini tarih sirasina göre izleyin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Hareketler yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Stok hareketi yok" description="Henüz hareket kaydi bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "item", header: "Kalem ID", render: (row) => row.inventory_item_id },
            { key: "type", header: "Hareket Tipi", render: (row) => row.movement_type },
            { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
            { key: "source", header: "Kaynak", render: (row) => row.source_type || "-" },
            { key: "date", header: "Tarih", render: (row) => formatDateTime(row.movement_date) },
            { key: "notes", header: "Not", render: (row) => row.notes || "-" },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Stok hareketi bulunamadi"
        />
      )}
    </ERPLayout>
  );
}
