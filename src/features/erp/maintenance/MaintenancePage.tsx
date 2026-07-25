import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { createMaintenanceTask, listMachines, listMaintenanceTasks, updateMaintenanceTask } from "../shared/erpApi";
import { formatDate } from "../shared/formatters";
import { MAINTENANCE_STATUS_LABELS } from "../shared/statusLabels";
import { Machine, MaintenanceStatus, MaintenanceTask } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

function tone(status: MaintenanceTask["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "in_progress") return "warning" as const;
  return "default" as const;
}

export default function MaintenancePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<MaintenanceTask[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ machine_id: "", task_name: "", task_type: "periodic" as MaintenanceTask["task_type"], planned_date: "" });

  const load = async () => {
    setLoading(true);
    const [taskResult, machineResult] = await Promise.all([listMaintenanceTasks(), listMachines()]);
    if (taskResult.error) {
      setError(taskResult.error);
      toast({ title: "Hata", description: `Bakım kayıtları yüklenemedi: ${taskResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(taskResult.data);
    setMachines(machineResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  return (
    <ERPLayout title="Makine Bakım">
      <PageHeader
        title="Makine Bakım"
        description="Planlanan bakım, arıza ve tamamlanan bakım kayıtlarını izleyin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Bakım Görevi" description="Makine bazlı planlı bakım veya arıza kaydı oluşturun.">
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_180px_160px_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!form.task_name.trim()) return;
            const result = await createMaintenanceTask({
              machine_id: form.machine_id || null,
              task_name: form.task_name,
              task_type: form.task_type,
              planned_date: form.planned_date || null,
            });
            if (result.error) {
              toast({ title: "Bakım Görevi", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Bakım görevi oluşturuldu." });
            setForm({ machine_id: "", task_name: "", task_type: "periodic", planned_date: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.machine_id} onChange={(event) => setForm((prev) => ({ ...prev, machine_id: event.target.value }))}>
            <option value="">Makine seçiniz</option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.name}
              </option>
            ))}
          </select>
          <Input placeholder="Görev adı" value={form.task_name} onChange={(event) => setForm((prev) => ({ ...prev, task_name: event.target.value }))} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.task_type} onChange={(event) => setForm((prev) => ({ ...prev, task_type: event.target.value as MaintenanceTask["task_type"] }))}>
            <option value="periodic">Periyodik</option>
            <option value="breakdown">Arıza</option>
            <option value="inspection">Kontrol</option>
          </select>
          <Input type="date" value={form.planned_date} onChange={(event) => setForm((prev) => ({ ...prev, planned_date: event.target.value }))} />
          <Button type="submit">Kaydet</Button>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Bakım kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Bakım kaydı yok" description="Henüz bakım görevi oluşturulmamış." />
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Görev", render: (row) => row.task_name },
            { key: "type", header: "Tip", render: (row) => row.task_type },
            { key: "machine", header: "Makine", render: (row) => machines.find((machine) => machine.id === row.machine_id)?.name || "-" },
            { key: "date", header: "Planlanan Tarih", render: (row) => formatDate(row.planned_date) },
            {
              key: "status",
              header: "Durum",
              render: (row) => <StatusBadge label={MAINTENANCE_STATUS_LABELS[row.status] || row.status} tone={tone(row.status)} />,
            },
            { key: "created", header: "Kayıt", render: (row) => formatDate(row.created_at) },
            {
              key: "actions",
              header: "İşlem",
              className: "text-right",
              render: (row) => (
                <select
                  className="h-9 rounded-md border bg-background px-2 text-xs"
                  value={row.status}
                  onChange={async (event) => {
                    const status = event.target.value as MaintenanceStatus;
                    const result = await updateMaintenanceTask(row.id, {
                      status,
                      completed_date: status === "completed" ? new Date().toISOString().slice(0, 10) : row.completed_date,
                    });
                    if (result.error) {
                      toast({ title: "Hata", description: result.error, variant: "destructive" });
                      return;
                    }
                    toast({ title: "Güncellendi", description: "Bakım durumu güncellendi." });
                    await load();
                  }}
                >
                  {Object.entries(MAINTENANCE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Bakım kaydı bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
