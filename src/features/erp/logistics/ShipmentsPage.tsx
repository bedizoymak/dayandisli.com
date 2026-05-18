import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import {
  createShipment,
  createShipmentFromSalesOrder,
  listSalesOrders,
  listShipmentItems,
  listShipments,
  listStakeholders,
  updateShipment,
} from "../shared/erpApi";
import { formatDate } from "../shared/formatters";
import { SHIPMENT_STATUS_LABELS } from "../shared/statusLabels";
import { SalesOrder, Shipment, ShipmentItem, ShipmentStatus, Stakeholder } from "../shared/types";
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
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [previewShipment, setPreviewShipment] = useState<Shipment | null>(null);
  const [previewItems, setPreviewItems] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ sales_order_id: "", carrier: "", tracking_no: "", delivery_note_no: "", package_count: "1" });

  const stakeholderNameById = useMemo(
    () =>
      stakeholders.reduce<Record<string, string>>((acc, stakeholder) => {
        acc[stakeholder.id] = stakeholder.company_name;
        return acc;
      }, {}),
    [stakeholders]
  );

  const load = async () => {
    setLoading(true);
    const [shipmentResult, orderResult, stakeholderResult] = await Promise.all([listShipments(), listSalesOrders(), listStakeholders()]);
    if (shipmentResult.error) {
      setError(shipmentResult.error);
      toast({ title: "Hata", description: `Sevkiyat verisi yüklenemedi: ${shipmentResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(shipmentResult.data);
    setOrders(orderResult.data);
    setStakeholders(stakeholderResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  const openPreview = async (shipment: Shipment) => {
    const items = await listShipmentItems(shipment.id);
    if (items.error) {
      toast({ title: "İrsaliye Önizleme", description: items.error, variant: "destructive" });
      return;
    }
    setPreviewShipment(shipment);
    setPreviewItems(items.data);
  };

  return (
    <ERPLayout title="Lojistik ve Sevkiyat">
      <PageHeader
        title="Lojistik ve Sevkiyat"
        description="Sevkiyat no, takip no, paket sayısı ve durum takibini buradan yapın."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Satış Siparişinden Sevkiyat Oluştur" description="Sipariş kalemlerini sevkiyat kalemlerine kopyalayarak planlı sevkiyat açın.">
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const selectedOrder = orders.find((order) => order.id === form.sales_order_id);
            const result = selectedOrder
              ? await createShipmentFromSalesOrder(selectedOrder)
              : await createShipment({ package_count: Number(form.package_count || 1), carrier: form.carrier || null, tracking_no: form.tracking_no || null, delivery_note_no: form.delivery_note_no || null });

            if (result.error && !result.data) {
              toast({ title: "Sevkiyat", description: result.error, variant: "destructive" });
              return;
            }

            if (result.data && !result.error) {
              await updateShipment(result.data.id, {
                carrier: form.carrier || null,
                tracking_no: form.tracking_no || null,
                delivery_note_no: form.delivery_note_no || null,
                package_count: Number(form.package_count || 1),
              });
            }

            toast({ title: "Kaydedildi", description: result.error || "Sevkiyat kaydı oluşturuldu." });
            setForm({ sales_order_id: "", carrier: "", tracking_no: "", delivery_note_no: "", package_count: "1" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.sales_order_id} onChange={(event) => setForm((prev) => ({ ...prev, sales_order_id: event.target.value }))}>
            <option value="">Satış siparişi seçiniz</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.order_no} - {order.title}
              </option>
            ))}
          </select>
          <Input placeholder="Taşıyıcı" value={form.carrier} onChange={(event) => setForm((prev) => ({ ...prev, carrier: event.target.value }))} />
          <Input placeholder="Kargo takip no" value={form.tracking_no} onChange={(event) => setForm((prev) => ({ ...prev, tracking_no: event.target.value }))} />
          <Input placeholder="Sevk irsaliyesi no" value={form.delivery_note_no} onChange={(event) => setForm((prev) => ({ ...prev, delivery_note_no: event.target.value }))} />
          <Input type="number" placeholder="Paket sayısı" value={form.package_count} onChange={(event) => setForm((prev) => ({ ...prev, package_count: event.target.value }))} />
          <Button type="submit">Sevkiyat Oluştur</Button>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Sevkiyatlar yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Sevkiyat kaydı yok" description="Henüz sevkiyat kaydı bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "no", header: "Sevkiyat No", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/erp/shipments/${row.id}`}>{row.shipment_no}</Link> },
            { key: "customer", header: "Müşteri", render: (row) => (row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-") },
            { key: "carrier", header: "Taşıyıcı", render: (row) => row.carrier || "-" },
            { key: "tracking", header: "Kargo Takip No", render: (row) => row.tracking_no || "-" },
            { key: "delivery", header: "İrsaliye No", render: (row) => row.delivery_note_no || "-" },
            { key: "package", header: "Paket Sayısı", className: "text-right", render: (row) => row.package_count },
            { key: "date", header: "Sevk Tarihi", render: (row) => formatDate(row.shipment_date) },
            {
              key: "status",
              header: "Durum",
              render: (row) => <StatusBadge label={SHIPMENT_STATUS_LABELS[row.status] || row.status} tone={tone(row.status)} />,
            },
            {
              key: "actions",
              header: "İşlem",
              className: "text-right",
              render: (row) => (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => openPreview(row)}>
                    İrsaliye Önizle
                  </Button>
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-xs"
                    value={row.status}
                    onChange={async (event) => {
                      const result = await updateShipment(row.id, { status: event.target.value as ShipmentStatus });
                      if (result.error) {
                        toast({ title: "Hata", description: result.error, variant: "destructive" });
                        return;
                      }
                      toast({ title: "Güncellendi", description: "Sevkiyat durumu güncellendi." });
                      await load();
                    }}
                  >
                    {Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ),
            },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Sevkiyat kaydı bulunamadı"
        />
      )}

      {previewShipment ? (
        <section className="rounded-md border bg-card p-5 print:shadow-none">
          <div className="mb-4 flex items-start justify-between gap-3 print:hidden">
            <div>
              <h2 className="text-lg font-semibold">Sevk İrsaliyesi Önizleme</h2>
              <p className="text-sm text-muted-foreground">Bu bölüm yazdırmaya uygundur; PDF çıktısı sonraki fazda eklenebilir.</p>
            </div>
            <Button variant="outline" onClick={() => window.print()}>Yazdır</Button>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div><span className="text-muted-foreground">Sevkiyat No</span><p className="font-medium">{previewShipment.shipment_no}</p></div>
            <div><span className="text-muted-foreground">Müşteri</span><p className="font-medium">{previewShipment.stakeholder_id ? stakeholderNameById[previewShipment.stakeholder_id] || "-" : "-"}</p></div>
            <div><span className="text-muted-foreground">İrsaliye No</span><p className="font-medium">{previewShipment.delivery_note_no || "-"}</p></div>
            <div><span className="text-muted-foreground">Paket Sayısı</span><p className="font-medium">{previewShipment.package_count}</p></div>
            <div><span className="text-muted-foreground">Taşıyıcı</span><p className="font-medium">{previewShipment.carrier || "-"}</p></div>
            <div><span className="text-muted-foreground">Takip No</span><p className="font-medium">{previewShipment.tracking_no || "-"}</p></div>
          </div>
          <div className="mt-4 rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Açıklama</th>
                  <th className="p-2 text-right">Miktar</th>
                  <th className="p-2 text-left">Birim</th>
                </tr>
              </thead>
              <tbody>
                {previewItems.length === 0 ? (
                  <tr><td className="p-4 text-center text-muted-foreground" colSpan={3}>Sevkiyat kalemi yok.</td></tr>
                ) : (
                  previewItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-right">{item.quantity}</td>
                      <td className="p-2">{item.unit}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </ERPLayout>
  );
}
