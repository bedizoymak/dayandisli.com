import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { createInventoryItem, listInventoryItems } from "../shared/erpApi";
import { formatNumber } from "../shared/formatters";
import { INVENTORY_ITEM_TYPE_LABELS } from "../shared/statusLabels";
import { InventoryItem } from "../shared/types";
import { InventoryItemForm } from "./InventoryItemForm";

export default function InventoryPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const result = await listInventoryItems();
    if (result.error) {
      toast({ title: "Hata", description: `Stok verisi yüklenemedi: ${result.error}`, variant: "destructive" });
    }
    setRows(result.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((item) => item.name.toLowerCase().includes(q) || (item.code || "").toLowerCase().includes(q));
  }, [rows, search]);

  const criticalCount = filtered.filter((item) => item.current_stock <= item.min_stock).length;

  return (
    <ERPLayout title="Stok ve Ambar Yönetimi">
      <PageHeader
        title="Stok ve Ambar Yönetimi"
        description="Kritik stoklari takip edin ve stok kartlarini merkezi olarak yönetin."
      />

      <InventoryItemForm
        loading={saving}
        onSubmit={async (values) => {
          setSaving(true);
          const result = await createInventoryItem({
            item_type: values.item_type,
            code: values.code || undefined,
            name: values.name,
            unit: values.unit || "adet",
            current_stock: Number(values.current_stock || 0),
            min_stock: Number(values.min_stock || 0),
            location: values.location || undefined,
          });
          setSaving(false);

          if (result.error) {
            toast({ title: "Kayıt Hatası", description: result.error, variant: "destructive" });
            return;
          }

          toast({ title: "Başarılı", description: "Stok kartı eklendi." });
          await load();
        }}
      />

      <div className="space-y-3">
        <Input placeholder="Kod veya ürün adina göre ara..." value={search} onChange={(e) => setSearch(e.target.value)} />

        {criticalCount > 0 ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
            Kritik stok uyarisi: {criticalCount} kalemde stok seviyesi minimum degerin altinda veya esit.
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Stok verisi yükleniyor...</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="Stok kaydı bulunamadı" description="Yeni stok kartı ekleyerek başlayabilirsiniz." />
        ) : (
          <DataTable
            columns={[
              { key: "code", header: "Kod", render: (row) => row.code || "-" },
              { key: "name", header: "Ürün/Malzeme", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/erp/inventory/${row.id}`}>{row.name}</Link> },
              { key: "type", header: "Tip", render: (row) => INVENTORY_ITEM_TYPE_LABELS[row.item_type] },
              { key: "stock", header: "Stok", className: "text-right", render: (row) => formatNumber(row.current_stock, 3) },
              { key: "min", header: "Min Stok", className: "text-right", render: (row) => formatNumber(row.min_stock, 3) },
              { key: "unit", header: "Birim", render: (row) => row.unit },
              { key: "location", header: "Lokasyon", render: (row) => row.location || "-" },
              {
                key: "status",
                header: "Durum",
                render: (row) =>
                  row.current_stock <= row.min_stock ? (
                    <StatusBadge label="Kritik" tone="danger" />
                  ) : (
                    <StatusBadge label="Normal" tone="success" />
                  ),
              },
            ]}
            data={filtered}
            rowKey={(row) => row.id}
            emptyMessage="Stok kaydı bulunamadı"
          />
        )}
      </div>
    </ERPLayout>
  );
}
