import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { listInventoryItems, listPurchaseOrders, listStakeholders } from "../shared/erpApi";
import { formatCurrency, formatDate, formatNumber } from "../shared/formatters";
import { PURCHASE_ORDER_STATUS_LABELS } from "../shared/statusLabels";
import { InventoryItem, PurchaseOrder, Stakeholder } from "../shared/types";

export default function PurchasingPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Stakeholder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrder["status"] | "all">("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [orderResult, stakeholderResult, inventoryResult] = await Promise.all([
        listPurchaseOrders(),
        listStakeholders(),
        listInventoryItems(),
      ]);
      setOrders(orderResult.data);
      setSuppliers(stakeholderResult.data.filter((item) => item.type === "supplier" || item.type === "subcontractor" || item.type === "both"));
      setInventory(inventoryResult.data);
      setLoading(false);
    };

    load();
  }, []);

  const supplierNameById = useMemo(() => Object.fromEntries(suppliers.map((item) => [item.id, item.company_name])), [suppliers]);
  const q = search.toLowerCase();
  const filteredOrders = orders.filter((order) => {
    const supplierName = order.supplier_id ? supplierNameById[order.supplier_id] || "" : "";
    return (
      (!q || order.purchase_order_no.toLowerCase().includes(q) || order.title.toLowerCase().includes(q) || supplierName.toLowerCase().includes(q)) &&
      (statusFilter === "all" || order.status === statusFilter)
    );
  });
  const criticalItems = inventory.filter((item) => item.current_stock <= item.min_stock);
  const openOrders = orders.filter((order) => !["received", "cancelled"].includes(order.status));
  const sentOrders = orders.filter((order) => order.status === "sent" || order.status === "partially_received");
  const supplierPerformance = suppliers.map((supplier) => {
    const supplierOrders = orders.filter((order) => order.supplier_id === supplier.id);
    const completed = supplierOrders.filter((order) => order.status === "received").length;
    return {
      id: supplier.id,
      name: supplier.company_name,
      contact: supplier.contact_name || "-",
      phone: supplier.phone || "-",
      orders: supplierOrders.length,
      completed,
      open: supplierOrders.length - completed,
      total: supplierOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0),
    };
  });

  return (
    <ERPLayout title="Satın Alma">
      <PageHeader
        title="Satın Alma ve Tedarik"
        description="Tedarikçiler, satın alma talepleri, teklif toplama, siparişler ve tedarikçi performansını tek akışta yönetin."
        actions={<Button asChild><Link to="/purchase-orders">Satın Alma Siparişleri</Link></Button>}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tedarikçi</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{suppliers.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Satın Alma İhtiyacı</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{criticalItems.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Açık Sipariş</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{openOrders.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Teslim Bekleyen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{sentOrders.length}</CardContent></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <Input placeholder="Tedarikçi, sipariş no veya başlık ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PurchaseOrder["status"] | "all")}>
          <option value="all">Tüm Durumlar</option>
          {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Temizle</Button>
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="suppliers">Tedarikçiler</TabsTrigger>
          <TabsTrigger value="requests">Satın Alma Talepleri</TabsTrigger>
          <TabsTrigger value="quotes">Teklif Toplama</TabsTrigger>
          <TabsTrigger value="orders">Satın Alma Siparişleri</TabsTrigger>
          <TabsTrigger value="performance">Tedarikçi Performansı</TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers">
          <DataTable columns={[
            { key: "name", header: "Tedarikçi", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/stakeholders/${row.id}`}>{row.company_name}</Link> },
            { key: "contact", header: "Yetkili", render: (row) => row.contact_name || "-" },
            { key: "phone", header: "Telefon", render: (row) => row.phone || "-" },
            { key: "email", header: "E-posta", render: (row) => row.email || "-" },
            { key: "status", header: "Durum", render: (row) => row.is_active ? <StatusBadge label="Aktif" tone="success" /> : <StatusBadge label="Pasif" tone="muted" /> },
          ]} data={suppliers} rowKey={(row) => row.id} emptyMessage="Tedarikçi kaydı yok" />
        </TabsContent>
        <TabsContent value="requests">
          <DataTable columns={[
            { key: "item", header: "Talep Kalemi", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/inventory/${row.id}`}>{row.name}</Link> },
            { key: "stock", header: "Mevcut", className: "text-right", render: (row) => formatNumber(row.current_stock, 3) },
            { key: "min", header: "Minimum", className: "text-right", render: (row) => formatNumber(row.min_stock, 3) },
            { key: "need", header: "Önerilen Talep", className: "text-right", render: (row) => formatNumber(Math.max(row.min_stock - row.current_stock, 0), 3) },
            { key: "approval", header: "Onay Yapısı", render: () => <StatusBadge label="Onaya Hazır" tone="warning" /> },
          ]} data={criticalItems} rowKey={(row) => row.id} emptyMessage={loading ? "Yükleniyor..." : "Satın alma talebi doğuran minimum stok kaydı yok"} />
        </TabsContent>
        <TabsContent value="quotes">
          <DataTable columns={[
            { key: "no", header: "Talep/Sipariş", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/purchase-orders/${row.id}`}>{row.purchase_order_no}</Link> },
            { key: "supplier", header: "Tedarikçi", render: (row) => row.supplier_id ? supplierNameById[row.supplier_id] || "-" : "Tedarikçi bekliyor" },
            { key: "title", header: "Konu", render: (row) => row.title },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.status === "draft" ? "Teklif Toplanıyor" : PURCHASE_ORDER_STATUS_LABELS[row.status]} tone={row.status === "draft" ? "warning" : "default"} /> },
            { key: "notes", header: "Not", render: (row) => row.notes || "-" },
          ]} data={filteredOrders.filter((order) => order.status === "draft")} rowKey={(row) => row.id} emptyMessage="Teklif toplama aşamasında kayıt yok" />
        </TabsContent>
        <TabsContent value="orders">
          <DataTable columns={[
            { key: "no", header: "Sipariş No", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/purchase-orders/${row.id}`}>{row.purchase_order_no}</Link> },
            { key: "supplier", header: "Tedarikçi", render: (row) => row.supplier_id ? supplierNameById[row.supplier_id] || "-" : "-" },
            { key: "title", header: "Başlık", render: (row) => row.title },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={PURCHASE_ORDER_STATUS_LABELS[row.status]} tone={row.status === "received" ? "success" : row.status === "cancelled" ? "danger" : "default"} /> },
            { key: "date", header: "Beklenen Teslim", render: (row) => formatDate(row.expected_delivery_date) },
            { key: "total", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.grand_total || 0, row.currency) },
          ]} data={filteredOrders} rowKey={(row) => row.id} emptyMessage="Satın alma siparişi yok" />
        </TabsContent>
        <TabsContent value="performance">
          <DataTable columns={[
            { key: "name", header: "Tedarikçi", render: (row) => row.name },
            { key: "contact", header: "Yetkili", render: (row) => row.contact },
            { key: "orders", header: "Toplam Sipariş", className: "text-right", render: (row) => row.orders },
            { key: "completed", header: "Teslim Alınan", className: "text-right", render: (row) => row.completed },
            { key: "open", header: "Açık", className: "text-right", render: (row) => row.open },
            { key: "total", header: "Toplam Tutar", className: "text-right", render: (row) => formatCurrency(row.total) },
          ]} data={supplierPerformance} rowKey={(row) => row.id} emptyMessage="Performans için tedarikçi yok" />
        </TabsContent>
      </Tabs>
    </ERPLayout>
  );
}
