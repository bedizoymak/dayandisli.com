import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import {
  createQualityReport,
  createSubcontractingJob,
  createWorkOrder,
  listMachines,
  listProductionRoutes,
  listStakeholders,
  listWorkOrders,
  updateWorkOrder,
} from "../shared/erpApi";
import { Machine, ProductionRoute, Stakeholder, WorkOrder } from "../shared/types";
import { WorkOrderForm } from "./WorkOrderForm";
import { WorkOrderTable } from "./WorkOrderTable";
import { WorkOrderOperations } from "./WorkOrderOperations";

export default function WorkOrdersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [routes, setRoutes] = useState<ProductionRoute[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [workOrdersResult, stakeholdersResult, routesResult, machinesResult] = await Promise.all([
      listWorkOrders(),
      listStakeholders(),
      listProductionRoutes(),
      listMachines(),
    ]);

    if (workOrdersResult.error) {
      setError(workOrdersResult.error);
      toast({ title: "Hata", description: `İş emirleri yüklenemedi: ${workOrdersResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }

    if (stakeholdersResult.error) {
      toast({ title: "Hata", description: `Paydaşlar yüklenemedi: ${stakeholdersResult.error}`, variant: "destructive" });
    }

    setRows(workOrdersResult.data);
    setStakeholders(stakeholdersResult.data.filter((item) => item.is_active));
    setRoutes(routesResult.data.filter((route) => route.is_template));
    setMachines(machinesResult.data);
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

  const sendToQuality = async (wo: WorkOrder) => {
    const result = await createQualityReport({
      work_order_id: wo.id,
      sales_order_id: wo.sales_order_id,
      result: "pending",
      notes: "İş emri ekranından kalite kontrole gönderildi.",
    });
    if (result.error) {
      toast({ title: "Kalite Kontrol", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Kalite Kontrole Gönderildi", description: "Bekleyen kalite raporu oluşturuldu." });
    await load();
  };

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
        {error ? <MigrationNotice message={error} /> : null}

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
            onStatusChange={async (wo, status) => {
              const patch: Partial<WorkOrder> = { status };
              if (status === "in_progress") patch.actual_start_at = wo.actual_start_at ?? new Date().toISOString();
              if (status === "completed") patch.actual_end_at = new Date().toISOString();
              const result = await updateWorkOrder(wo.id, patch);
              if (result.error) {
                toast({ title: "Hata", description: result.error, variant: "destructive" });
                return;
              }
              toast({ title: "Güncellendi", description: "İş emri durumu güncellendi." });
              await load();
            }}
            onSendSubcontracting={async (wo) => {
              const result = await createSubcontractingJob({
                work_order_id: wo.id,
                supplier_id: null,
                process_type: "fason işlem",
                status: "planned",
                quantity_sent: wo.quantity,
              });
              if (result.error) {
                toast({ title: "Fason Kaydı", description: result.error, variant: "destructive" });
                return;
              }
              await updateWorkOrder(wo.id, { status: "waiting_subcontractor" });
              toast({ title: "Fason Kaydı Oluşturuldu", description: "İş emri fason takip listesine alındı." });
              await load();
            }}
            onSendQuality={sendToQuality}
          />
        )}
      </div>

      <WorkOrderOperations
        workOrder={selectedWorkOrder}
        routes={routes}
        machines={machines}
        stakeholderName={selectedWorkOrder?.stakeholder_id ? stakeholderNameById[selectedWorkOrder.stakeholder_id] : undefined}
        onSendQuality={sendToQuality}
        onChanged={load}
      />
    </ERPLayout>
  );
}
