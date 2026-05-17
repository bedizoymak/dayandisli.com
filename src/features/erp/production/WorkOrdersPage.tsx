import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { createWorkOrder, listStakeholders, listWorkOrders } from "../shared/erpApi";
import { Stakeholder, WorkOrder } from "../shared/types";
import { WorkOrderForm } from "./WorkOrderForm";
import { WorkOrderTable } from "./WorkOrderTable";
import { WorkOrderOperations } from "./WorkOrderOperations";

export default function WorkOrdersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  const load = async () => {
    setLoading(true);
    const [workOrdersResult, stakeholdersResult] = await Promise.all([listWorkOrders(), listStakeholders()]);

    if (workOrdersResult.error) {
      toast({ title: "Hata", description: `İş emirleri yüklenemedi: ${workOrdersResult.error}`, variant: "destructive" });
    }

    if (stakeholdersResult.error) {
      toast({ title: "Hata", description: `Paydaşlar yüklenemedi: ${stakeholdersResult.error}`, variant: "destructive" });
    }

    setRows(workOrdersResult.data);
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

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (row) =>
        row.work_order_no.toLowerCase().includes(q) ||
        row.title.toLowerCase().includes(q) ||
        (row.part_name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <ERPLayout title="İş Emirleri">
      <PageHeader
        title="İş Emirleri"
        description="Üretim planlama, operasyon ve fason akışlarını iş emri merkezli yönetin."
      />

      <WorkOrderForm
        stakeholders={stakeholders}
        loading={saving}
        onSubmit={async (values) => {
          setSaving(true);
          const result = await createWorkOrder({
            stakeholder_id: values.stakeholder_id || null,
            title: values.title,
            part_name: values.part_name || undefined,
            quantity: Number(values.quantity || 1),
            planned_end_date: values.planned_end_date || null,
          });
          setSaving(false);

          if (result.error) {
            toast({ title: "Kayıt Hatası", description: result.error, variant: "destructive" });
            return;
          }

          toast({ title: "Başarılı", description: "İş emri oluşturuldu." });
          await load();
        }}
      />

      <div className="space-y-3">
        <Input placeholder="İş emri no, başlık veya parça ara..." value={search} onChange={(e) => setSearch(e.target.value)} />

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="İş emri bulunamadı" description="Yeni iş emri oluşturarak başlayabilirsiniz." />
        ) : (
          <WorkOrderTable
            data={filtered}
            stakeholderNameById={stakeholderNameById}
            onSelectOperations={(wo) => setSelectedWorkOrder(wo)}
          />
        )}
      </div>

      <WorkOrderOperations workOrder={selectedWorkOrder} />
    </ERPLayout>
  );
}
