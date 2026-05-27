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
import { createPurchaseOrder, getCurrentERPUser, listPurchaseOrders, listStakeholders, updatePurchaseOrder } from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { PURCHASE_ORDER_STATUS_LABELS } from "../shared/statusLabels";
import { ERPUser, PurchaseOrder, PurchaseOrderStatus, Stakeholder } from "../shared/types";
import { exportRowsToCsv } from "../shared/exportUtils";
import { canEditFinance, canManageERP } from "../shared/permissions";
import { isRequired } from "../shared/validation";
import { useToast } from "@/hooks/use-toast";

function tone(status: PurchaseOrderStatus) {
  if (status === "received") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "sent" || status === "partially_received") return "warning" as const;
  return "default" as const;
}

export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<ERPUser | null>(null);
  const [form, setForm] = useState({ supplier_id: "", title: "", expected_delivery_date: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const [ordersResult, stakeholdersResult, userResult] = await Promise.all([listPurchaseOrders(), listStakeholders(), getCurrentERPUser()]);
    if (ordersResult.error) setError(ordersResult.error);
    else setError(null);
    setRows(ordersResult.data);
    setSuppliers(stakeholdersResult.data.filter((item) => item.type === "supplier" || item.type === "subcontractor" || item.type === "both"));
    setUser(userResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const supplierNameById = useMemo(() => Object.fromEntries(suppliers.map((item) => [item.id, item.company_name])), [suppliers]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((row) => {
      const matchSearch = !q || row.purchase_order_no.toLowerCase().includes(q) || row.title.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || row.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);
  const canEdit = canManageERP(user) || canEditFinance(user);

  return (
    <ERPLayout title="Satın Alma Siparişleri">
      <PageHeader
        title="Satın Alma Siparişleri"
        description="Tedarikçi siparişleri, beklenen teslimler ve stok giriş bağlantılarını yönetin."
        actions={<Button variant="outline" onClick={() => exportRowsToCsv("satın-alma-siparisleri.csv", filtered as unknown as Record<string, unknown>[])}>CSV Dışa Aktar</Button>}
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Satın Alma Siparişi" description="Tedarikçiye gönderilecek satın alma kaydını oluşturun.">
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_180px_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!isRequired(form.title)) {
              toast({ title: "Eksik Bilgi", description: "Başlık zorunludur.", variant: "destructive" });
              return;
            }
            if (!canEdit) {
              toast({ title: "Yetki Gerekli", description: "Satın alma oluşturmak için admin, planner veya finance rolü gerekir.", variant: "destructive" });
              return;
            }
            const result = await createPurchaseOrder({
              supplier_id: form.supplier_id || null,
              title: form.title,
              expected_delivery_date: form.expected_delivery_date || null,
              notes: form.notes || null,
            });
            if (result.error) {
              toast({ title: "Kayıt oluşturulamadı", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kayıt başarıyla oluşturuldu.", description: "Satın alma siparişi eklendi." });
            setForm({ supplier_id: "", title: "", expected_delivery_date: "", notes: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.supplier_id} onChange={(event) => setForm((prev) => ({ ...prev, supplier_id: event.target.value }))}>
            <option value="">Tedarikçi seçiniz</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.company_name}</option>)}
          </select>
          <Input placeholder="Başlık *" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
          <Input type="date" value={form.expected_delivery_date} onChange={(event) => setForm((prev) => ({ ...prev, expected_delivery_date: event.target.value }))} />
          <Input placeholder="Not" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          <Button type="submit" disabled={!canEdit}>Oluştur</Button>
        </form>
      </FormSection>

      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <Input placeholder="Satın alma no veya başlık ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PurchaseOrderStatus | "all")}>
          <option value="all">Tüm Durumlar</option>
          {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Filtreleri Temizle</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Satın alma siparişleri yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Satın alma siparişi yok" description="Yeni satın alma kaydı oluşturarak başlayabilirsiniz." />
      ) : (
        <DataTable
          columns={[
            { key: "no", header: "Sipariş No", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/purchase-orders/${row.id}`}>{row.purchase_order_no}</Link> },
            { key: "supplier", header: "Tedarikçi", render: (row) => (row.supplier_id ? supplierNameById[row.supplier_id] || "-" : "-") },
            { key: "title", header: "Başlık", render: (row) => row.title },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={PURCHASE_ORDER_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
            { key: "expected", header: "Beklenen Teslim", render: (row) => formatDate(row.expected_delivery_date) },
            { key: "total", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.grand_total || 0, row.currency) },
            {
              key: "action",
              header: "İşlem",
              className: "text-right",
              render: (row) => (
                <select
                  className="h-9 rounded-md border bg-background px-2 text-xs"
                  value={row.status}
                  onChange={async (event) => {
                    if (!canEdit) {
                      toast({ title: "Yetki Gerekli", description: "Bu işlem için yazma yetkisi gerekir.", variant: "destructive" });
                      return;
                    }
                    const result = await updatePurchaseOrder(row.id, { status: event.target.value as PurchaseOrderStatus });
                    if (result.error) {
                      toast({ title: "Hata", description: result.error, variant: "destructive" });
                      return;
                    }
                    await load();
                  }}
                >
                  {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ),
            },
          ]}
          data={filtered}
          rowKey={(row) => row.id}
        />
      )}
    </ERPLayout>
  );
}
