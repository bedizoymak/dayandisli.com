import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { ConfirmDialog } from "@/components/erp/ConfirmDialog";
import { createSalesOrder, createWorkOrderFromSalesOrder, listSalesOrders, listStakeholders, updateSalesOrder } from "../shared/erpApi";
import { SalesOrder, Stakeholder } from "../shared/types";
import { SalesOrderForm } from "./SalesOrderForm";
import { SalesOrderTable } from "./SalesOrderTable";

export default function SalesOrdersPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<SalesOrder[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [ordersResult, stakeholdersResult] = await Promise.all([listSalesOrders(), listStakeholders()]);

    if (ordersResult.error) {
      setError(ordersResult.error);
      toast({ title: "Hata", description: `Siparişler yüklenemedi: ${ordersResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }

    if (stakeholdersResult.error) {
      toast({ title: "Hata", description: `Paydaşlar yüklenemedi: ${stakeholdersResult.error}`, variant: "destructive" });
    }

    setRows(ordersResult.data);
    setStakeholders(stakeholdersResult.data.filter((item) => item.is_active));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stakeholderNameById = useMemo(() => {
    return stakeholders.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.company_name;
      return acc;
    }, {});
  }, [stakeholders]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) => row.order_no.toLowerCase().includes(q) || row.title.toLowerCase().includes(q));
  }, [rows, search]);

  const convertSelectedOrder = async () => {
    const order = selectedOrder;
    if (!order) return;

    const result = await createWorkOrderFromSalesOrder(order);
    setSelectedOrder(null);

    if (result.error && !result.data) {
      toast({ title: "İş Emri", description: result.error, variant: "destructive" });
      return;
    }

    toast({
      title: result.error ? "Mevcut İş Emri Bulundu" : "İş Emri Oluşturuldu",
      description: result.error || `${order.order_no} üretime aktarıldı.`,
    });
    await load();
    navigate("/work-orders");
  };

  return (
    <ERPLayout title="Sipariş Yönetimi">
      <PageHeader
        title="Sipariş Yönetimi"
        description="ERP satış siparişlerini yönetin, durum ve öncelik takibini tek ekrandan yapın."
      />

      <SalesOrderForm
        stakeholders={stakeholders}
        loading={saving}
        onSubmit={async (values) => {
          setSaving(true);
          const result = await createSalesOrder({
            stakeholder_id: values.stakeholder_id || null,
            title: values.title,
            due_date: values.due_date || null,
            priority: values.priority,
          });
          setSaving(false);

          if (result.error) {
            toast({ title: "Kayıt Hatası", description: result.error, variant: "destructive" });
            return;
          }

          toast({ title: "Başarılı", description: "Sipariş kaydı oluşturuldu." });
          await load();
        }}
      />

      <div className="space-y-3">
        {error ? <MigrationNotice message={error} /> : null}

        <Input
          placeholder="Sipariş no veya başlık ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : filteredRows.length === 0 ? (
          <EmptyState title="Sipariş bulunamadı" description="Yeni sipariş ekleyerek başlayabilirsiniz." />
        ) : (
          <SalesOrderTable
            data={filteredRows}
            stakeholderNameById={stakeholderNameById}
            onStatusChange={async (order, status) => {
              const result = await updateSalesOrder(order.id, { status });
              if (result.error) {
                toast({ title: "Hata", description: result.error, variant: "destructive" });
                return;
              }
              toast({ title: "Güncellendi", description: "Sipariş durumu güncellendi." });
              await load();
            }}
            onConvertToWorkOrder={(order) => setSelectedOrder(order)}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
        title="Sipariş iş emrine dönüştürülsün mü?"
        description={selectedOrder ? `${selectedOrder.order_no} - ${selectedOrder.title}` : ""}
        confirmText="İş Emrine Dönüştür"
        onConfirm={convertSelectedOrder}
      />
    </ERPLayout>
  );
}
