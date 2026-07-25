import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditTimeline } from "@/components/erp/AuditTimeline";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { PageHeader } from "@/components/erp/PageHeader";
import { PrintPage } from "@/components/erp/PrintPage";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { DocumentLinksPanel } from "../documents/DocumentLinksPanel";
import {
  createPurchaseOrderItem,
  getPurchaseOrderById,
  listInventoryItems,
  listPurchaseOrderItems,
  listStakeholders,
  receivePurchaseOrderItem,
  updatePurchaseOrder,
} from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { PURCHASE_ORDER_STATUS_LABELS } from "../shared/statusLabels";
import { InventoryItem, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Stakeholder } from "../shared/types";
import { isNonNegativeNumber, isPositiveNumber, isRequired } from "../shared/validation";
import { useToast } from "@/hooks/use-toast";

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [receivingItemId, setReceivingItemId] = useState<string | null>(null);
  const [form, setForm] = useState({ inventory_item_id: "", description: "", quantity: "1", unit: "adet", unit_price: "0" });

  const supplierNameById = useMemo(() => Object.fromEntries(stakeholders.map((item) => [item.id, item.company_name])), [stakeholders]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [orderResult, itemResult, inventoryResult, stakeholderResult] = await Promise.all([
      getPurchaseOrderById(id),
      listPurchaseOrderItems(id),
      listInventoryItems(),
      listStakeholders(),
    ]);
    setOrder(orderResult.data);
    setItems(itemResult.data);
    setInventory(inventoryResult.data);
    setStakeholders(stakeholderResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return <ERPLayout title="Satın Alma Detayı"><p className="text-sm text-muted-foreground">Satın alma siparişi yükleniyor...</p></ERPLayout>;
  }

  if (!order) {
    return <ERPLayout title="Satın Alma Detayı"><EmptyState title="Kayıt bulunamadı" description="Satın alma siparişi görüntülenemedi." /></ERPLayout>;
  }

  const supplierName = order.supplier_id ? supplierNameById[order.supplier_id] || "-" : "-";

  return (
    <ERPLayout title={order.purchase_order_no}>
      <PageHeader
        title={order.purchase_order_no}
        description={order.title}
        actions={<Button asChild variant="outline"><Link to="/purchase-orders">Listeye Dön</Link></Button>}
      />

      <section className="grid gap-3 rounded-md border bg-card p-4 text-sm md:grid-cols-4">
        <div><span className="text-muted-foreground">Tedarikçi</span><p className="font-medium">{supplierName}</p></div>
        <div><span className="text-muted-foreground">Durum</span><p><StatusBadge label={PURCHASE_ORDER_STATUS_LABELS[order.status]} tone={order.status === "received" ? "success" : order.status === "cancelled" ? "danger" : "default"} /></p></div>
        <div><span className="text-muted-foreground">Sipariş Tarihi</span><p className="font-medium">{formatDate(order.order_date)}</p></div>
        <div><span className="text-muted-foreground">Beklenen Teslim</span><p className="font-medium">{formatDate(order.expected_delivery_date)}</p></div>
        <div><span className="text-muted-foreground">Tutar</span><p className="font-medium">{formatCurrency(order.grand_total || 0, order.currency)}</p></div>
        <div className="md:col-span-3"><span className="text-muted-foreground">Not</span><p className="font-medium">{order.notes || "-"}</p></div>
      </section>

      <FormSection title="Kalem Ekle" description="Malzeme veya hizmet kalemlerini satın alma siparişine bağlayın.">
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_120px_120px_140px_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!isRequired(form.description)) {
              toast({ title: "Eksik Bilgi", description: "Açıklama zorunludur.", variant: "destructive" });
              return;
            }
            if (!isPositiveNumber(form.quantity) || !isNonNegativeNumber(form.unit_price)) {
              toast({ title: "Hatalı Değer", description: "Miktar sıfırdan büyük, birim fiyat sıfır veya üzeri olmalıdır.", variant: "destructive" });
              return;
            }
            const quantity = Number(form.quantity);
            const unitPrice = Number(form.unit_price);
            const result = await createPurchaseOrderItem({
              purchase_order_id: order.id,
              inventory_item_id: form.inventory_item_id || null,
              description: form.description,
              quantity,
              unit: form.unit || "adet",
              unit_price: unitPrice,
              total: quantity * unitPrice,
            });
            if (result.error) {
              toast({ title: "Kalem Eklenemedi", description: result.error, variant: "destructive" });
              return;
            }
            setForm({ inventory_item_id: "", description: "", quantity: "1", unit: "adet", unit_price: "0" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.inventory_item_id} onChange={(event) => setForm((prev) => ({ ...prev, inventory_item_id: event.target.value }))}>
            <option value="">Stok kalemi seçiniz</option>
            {inventory.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} - ${item.name}` : item.name}</option>)}
          </select>
          <Input placeholder="Açıklama *" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          <Input type="number" step="0.001" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} />
          <Input value={form.unit} onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))} />
          <Input type="number" step="0.01" value={form.unit_price} onChange={(event) => setForm((prev) => ({ ...prev, unit_price: event.target.value }))} />
          <Button type="submit">Kalem Ekle</Button>
        </form>
      </FormSection>

      <DataTable
        columns={[
          { key: "desc", header: "Açıklama", render: (row) => row.description },
          { key: "qty", header: "Miktar", className: "text-right", render: (row) => row.quantity },
          { key: "received", header: "Gelen", className: "text-right", render: (row) => row.received_quantity },
          { key: "unit", header: "Birim", render: (row) => row.unit },
          { key: "total", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.total || 0, order.currency) },
          {
            key: "receive",
            header: "Teslim Al",
            className: "text-right",
            render: (row) => (
              <Button
                variant="outline"
                size="sm"
                disabled={receivingItemId === row.id || Number(row.received_quantity) >= Number(row.quantity)}
                onClick={async () => {
                  const remaining = Math.max(Number(row.quantity) - Number(row.received_quantity), 0);
                  const value = Number(window.prompt("Teslim alınacak miktar:", String(remaining)) || 0);
                  if (value <= 0) return;
                  if (value > remaining) {
                    toast({ title: "Teslim Alma Hatası", description: "Teslim alınacak miktar kalan miktarı aşamaz.", variant: "destructive" });
                    return;
                  }
                  setReceivingItemId(row.id);
                  const result = await receivePurchaseOrderItem(row, value);
                  setReceivingItemId(null);
                  if (result.error) {
                    toast({ title: "Teslim Alma Hatası", description: result.error, variant: "destructive" });
                    return;
                  }
                  await load();
                }}
              >
                {receivingItemId === row.id ? "İşleniyor..." : "Teslim Al"}
              </Button>
            ),
          },
        ]}
        data={items}
        rowKey={(row) => row.id}
        emptyMessage="Satın alma kalemi yok."
      />

      <div className="flex flex-wrap gap-2">
        {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => (
          <Button
            key={value}
            variant={order.status === value ? "default" : "outline"}
            size="sm"
            onClick={async () => {
              const result = await updatePurchaseOrder(order.id, { status: value as PurchaseOrderStatus });
              if (result.error) {
                toast({ title: "Durum Güncellenemedi", description: result.error, variant: "destructive" });
                return;
              }
              await load();
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      <PrintPage title="Satın Alma Siparişi Önizleme" subtitle="Tedarikçiye gönderim için yazdırılabilir çıktı.">
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div><span className="text-muted-foreground">Belge No</span><p className="font-medium">{order.purchase_order_no}</p></div>
          <div><span className="text-muted-foreground">Tedarikçi</span><p className="font-medium">{supplierName}</p></div>
          <div><span className="text-muted-foreground">Tarih</span><p className="font-medium">{formatDate(order.order_date)}</p></div>
        </div>
      </PrintPage>

      <DocumentLinksPanel entityType="purchase_order" entityId={order.id} />
      <AuditTimeline entityType="purchase_order" entityId={order.id} />
    </ERPLayout>
  );
}
