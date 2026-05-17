import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { createInventoryMovement, listInventoryItems, listInventoryMovements } from "../shared/erpApi";
import { formatDateTime, formatNumber } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { INVENTORY_MOVEMENT_TYPE_LABELS } from "../shared/statusLabels";
import { InventoryItem, InventoryMovement, InventoryMovementType } from "../shared/types";

export default function InventoryMovementsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<InventoryMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    inventory_item_id: "",
    movement_type: "in" as InventoryMovementType,
    quantity: "1",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const [movementResult, itemResult] = await Promise.all([listInventoryMovements(), listInventoryItems()]);
    if (movementResult.error) {
      setError(movementResult.error);
      toast({ title: "Hata", description: `Stok hareketleri yüklenemedi: ${movementResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(movementResult.data);
    setItems(itemResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  return (
    <ERPLayout title="Stok Hareketleri">
      <PageHeader
        title="Stok Hareketleri"
        description="Giriş, çıkış ve düzeltme hareketlerini tarih sırasına göre izleyin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Stok Hareketi" description="Giriş, çıkış, iade veya düzeltme hareketi kaydedin.">
        <form
          className="grid gap-3 md:grid-cols-[1fr_180px_160px_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!form.inventory_item_id) return;
            const result = await createInventoryMovement({
              inventory_item_id: form.inventory_item_id,
              movement_type: form.movement_type,
              quantity: Number(form.quantity || 0),
              notes: form.notes || null,
            });
            if (result.error) {
              toast({ title: "Stok Hareketi", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Stok hareketi işlendi." });
            setForm({ inventory_item_id: "", movement_type: "in", quantity: "1", notes: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.inventory_item_id} onChange={(event) => setForm((prev) => ({ ...prev, inventory_item_id: event.target.value }))}>
            <option value="">Stok kalemi seçin</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code ? `${item.code} - ${item.name}` : item.name}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.movement_type} onChange={(event) => setForm((prev) => ({ ...prev, movement_type: event.target.value as InventoryMovementType }))}>
            {Object.entries(INVENTORY_MOVEMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input type="number" step="0.001" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} />
          <Input placeholder="Not" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          <Button type="submit">Kaydet</Button>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Hareketler yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Stok hareketi yok" description="Henüz hareket kaydı bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "item", header: "Kalem", render: (row) => items.find((item) => item.id === row.inventory_item_id)?.name || row.inventory_item_id },
            { key: "type", header: "Hareket Tipi", render: (row) => INVENTORY_MOVEMENT_TYPE_LABELS[row.movement_type] || row.movement_type },
            { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
            { key: "source", header: "Kaynak", render: (row) => row.source_type || "-" },
            { key: "date", header: "Tarih", render: (row) => formatDateTime(row.movement_date) },
            { key: "notes", header: "Not", render: (row) => row.notes || "-" },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Stok hareketi bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
