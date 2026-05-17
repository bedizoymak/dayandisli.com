import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { createSalesOrder, listSalesOrders, listStakeholders } from "../shared/erpApi";
import { SalesOrder, Stakeholder } from "../shared/types";
import { SalesOrderForm } from "./SalesOrderForm";
import { SalesOrderTable } from "./SalesOrderTable";

export default function SalesOrdersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SalesOrder[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [ordersResult, stakeholdersResult] = await Promise.all([listSalesOrders(), listStakeholders()]);

    if (ordersResult.error) {
      toast({ title: "Hata", description: `Siparisler yüklenemedi: ${ordersResult.error}`, variant: "destructive" });
    }

    if (stakeholdersResult.error) {
      toast({ title: "Hata", description: `Paydaslar yüklenemedi: ${stakeholdersResult.error}`, variant: "destructive" });
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

  return (
    <ERPLayout title="Siparis Yönetimi">
      <PageHeader
        title="Siparis Yönetimi"
        description="ERP satis siparislerini yönetin, durum ve öncelik takibini tek ekrandan yapin."
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
            toast({ title: "Kayit Hatasi", description: result.error, variant: "destructive" });
            return;
          }

          toast({ title: "Basarili", description: "Siparis kaydi olusturuldu." });
          await load();
        }}
      />

      <div className="space-y-3">
        <Input
          placeholder="Siparis no veya baslik ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : filteredRows.length === 0 ? (
          <EmptyState title="Siparis bulunamadi" description="Yeni siparis ekleyerek baslayabilirsiniz." />
        ) : (
          <SalesOrderTable data={filteredRows} stakeholderNameById={stakeholderNameById} />
        )}
      </div>
    </ERPLayout>
  );
}
