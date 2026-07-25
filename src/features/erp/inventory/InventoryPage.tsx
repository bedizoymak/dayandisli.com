import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [typeFilter, setTypeFilter] = useState<InventoryItem["item_type"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "critical" | "normal">("all");
  const [locationFilter, setLocationFilter] = useState("all");

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

  const locations = useMemo(() => Array.from(new Set(rows.map((item) => item.location || "Tanımsız"))).sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((item) => {
      const isCritical = item.current_stock <= item.min_stock;
      return (
        (!q || item.name.toLowerCase().includes(q) || (item.code || "").toLowerCase().includes(q)) &&
        (typeFilter === "all" || item.item_type === typeFilter) &&
        (locationFilter === "all" || (item.location || "Tanımsız") === locationFilter) &&
        (statusFilter === "all" || (statusFilter === "critical" ? isCritical : !isCritical))
      );
    });
  }, [rows, search, typeFilter, locationFilter, statusFilter]);

  const criticalCount = filtered.filter((item) => item.current_stock <= item.min_stock).length;
  const totalStock = filtered.reduce((sum, item) => sum + Number(item.current_stock || 0), 0);
  const groups = Object.entries(INVENTORY_ITEM_TYPE_LABELS).map(([type, label]) => {
    const items = filtered.filter((item) => item.item_type === type);
    return {
      type,
      label,
      count: items.length,
      stock: items.reduce((sum, item) => sum + Number(item.current_stock || 0), 0),
      critical: items.filter((item) => item.current_stock <= item.min_stock).length,
    };
  });
  const warehouses = locations.map((location) => {
    const items = filtered.filter((item) => (item.location || "Tanımsız") === location);
    return {
      location,
      count: items.length,
      stock: items.reduce((sum, item) => sum + Number(item.current_stock || 0), 0),
      critical: items.filter((item) => item.current_stock <= item.min_stock).length,
    };
  });

  return (
    <ERPLayout title="Stok ve Ambar Yönetimi">
      <PageHeader
        title="Stok ve Ambar Yönetimi"
        description="Ürünler, ürün grupları, depolar, stok hareketleri, sayım ve minimum stok seviyelerini merkezi olarak yönetin."
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
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_220px_auto]">
          <Input placeholder="Kod veya ürün adına göre ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as InventoryItem["item_type"] | "all")}>
            <option value="all">Tüm Ürün Grupları</option>
            {Object.entries(INVENTORY_ITEM_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
            <option value="all">Tüm Depolar</option>
            {locations.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "critical" | "normal")}>
            <option value="all">Tüm Stok Durumları</option>
            <option value="critical">Minimum Altı</option>
            <option value="normal">Normal</option>
          </select>
          <Button variant="outline" onClick={() => { setSearch(""); setTypeFilter("all"); setLocationFilter("all"); setStatusFilter("all"); }}>Temizle</Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ürün Kartı</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{filtered.length}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Toplam Stok</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatNumber(totalStock, 3)}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Minimum Altı</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{criticalCount}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Depo/Lokasyon</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{warehouses.filter((row) => row.count > 0).length}</CardContent></Card>
        </div>

        {criticalCount > 0 ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
            Kritik stok uyarısı: {criticalCount} kalemde stok seviyesi minimum değerin altında veya eşit.
          </div>
        ) : null}

        <Tabs defaultValue="products">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="products">Ürünler</TabsTrigger>
            <TabsTrigger value="groups">Ürün Grupları</TabsTrigger>
            <TabsTrigger value="warehouses">Depolar</TabsTrigger>
            <TabsTrigger value="counting">Stok Sayımı</TabsTrigger>
            <TabsTrigger value="minimum">Minimum Stok Seviyeleri</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            {loading ? (
              <p className="text-sm text-muted-foreground">Stok verisi yükleniyor...</p>
            ) : filtered.length === 0 ? (
              <EmptyState title="Stok kaydı bulunamadı" description="Yeni stok kartı ekleyerek başlayabilirsiniz." />
            ) : (
              <DataTable
                columns={[
                  { key: "code", header: "Kod", render: (row) => row.code || "-" },
                  { key: "name", header: "Ürün/Malzeme", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/inventory/${row.id}`}>{row.name}</Link> },
                  { key: "type", header: "Grup", render: (row) => INVENTORY_ITEM_TYPE_LABELS[row.item_type] },
                  { key: "stock", header: "Mevcut Stok", className: "text-right", render: (row) => formatNumber(row.current_stock, 3) },
                  { key: "min", header: "Minimum", className: "text-right", render: (row) => formatNumber(row.min_stock, 3) },
                  { key: "unit", header: "Birim", render: (row) => row.unit },
                  { key: "location", header: "Depo", render: (row) => row.location || "Tanımsız" },
                  { key: "status", header: "Durum", render: (row) => row.current_stock <= row.min_stock ? <StatusBadge label="Minimum Altı" tone="danger" /> : <StatusBadge label="Normal" tone="success" /> },
                ]}
                data={filtered}
                rowKey={(row) => row.id}
                emptyMessage="Stok kaydı bulunamadı"
              />
            )}
          </TabsContent>
          <TabsContent value="groups">
            <DataTable columns={[
              { key: "label", header: "Ürün Grubu", render: (row) => row.label },
              { key: "count", header: "Kart Sayısı", className: "text-right", render: (row) => row.count },
              { key: "stock", header: "Toplam Stok", className: "text-right", render: (row) => formatNumber(row.stock, 3) },
              { key: "critical", header: "Minimum Altı", className: "text-right", render: (row) => row.critical },
            ]} data={groups} rowKey={(row) => row.type} emptyMessage="Ürün grubu bulunamadı" />
          </TabsContent>
          <TabsContent value="warehouses">
            <DataTable columns={[
              { key: "location", header: "Depo/Lokasyon", render: (row) => row.location },
              { key: "count", header: "Kart Sayısı", className: "text-right", render: (row) => row.count },
              { key: "stock", header: "Toplam Stok", className: "text-right", render: (row) => formatNumber(row.stock, 3) },
              { key: "critical", header: "Minimum Altı", className: "text-right", render: (row) => row.critical },
            ]} data={warehouses} rowKey={(row) => row.location} emptyMessage="Depo kaydı bulunamadı" />
          </TabsContent>
          <TabsContent value="counting">
            <DataTable columns={[
              { key: "name", header: "Sayılacak Kalem", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/inventory/${row.id}`}>{row.name}</Link> },
              { key: "location", header: "Depo", render: (row) => row.location || "Tanımsız" },
              { key: "system", header: "Sistem Stok", className: "text-right", render: (row) => `${formatNumber(row.current_stock, 3)} ${row.unit}` },
              { key: "action", header: "Sayım İşlemi", render: () => <Link className="text-primary underline-offset-4 hover:underline" to="/inventory-movements">Düzeltme Hareketi Aç</Link> },
            ]} data={filtered} rowKey={(row) => row.id} emptyMessage="Sayım için stok kartı bulunamadı" />
          </TabsContent>
          <TabsContent value="minimum">
            <DataTable columns={[
              { key: "name", header: "Kalem", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/inventory/${row.id}`}>{row.name}</Link> },
              { key: "stock", header: "Mevcut", className: "text-right", render: (row) => formatNumber(row.current_stock, 3) },
              { key: "min", header: "Minimum", className: "text-right", render: (row) => formatNumber(row.min_stock, 3) },
              { key: "gap", header: "İhtiyaç", className: "text-right", render: (row) => formatNumber(Math.max(row.min_stock - row.current_stock, 0), 3) },
              { key: "status", header: "Durum", render: (row) => row.current_stock <= row.min_stock ? <StatusBadge label="Satın Alma İhtiyacı" tone="warning" /> : <StatusBadge label="Yeterli" tone="success" /> },
            ]} data={filtered} rowKey={(row) => row.id} emptyMessage="Minimum stok uyarısı yok" />
          </TabsContent>
        </Tabs>
      </div>
    </ERPLayout>
  );
}
