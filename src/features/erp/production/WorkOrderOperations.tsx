import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import {
  createOperationsFromRoute,
  createWorkOrderOperation,
  listWorkOrderOperations,
  updateWorkOrderOperationStatus,
} from "../shared/erpApi";
import { ProductionRoute, WorkOrder, WorkOrderOperation } from "../shared/types";
import { WORK_ORDER_OPERATION_STATUS_LABELS } from "../shared/statusLabels";
import { formatDateTime, formatNumber } from "../shared/formatters";

type WorkOrderOperationsProps = {
  workOrder: WorkOrder | null;
  routes: ProductionRoute[];
  onChanged: () => Promise<void>;
};

function tone(status: WorkOrderOperation["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "in_progress") return "warning" as const;
  if (status === "paused") return "muted" as const;
  return "default" as const;
}

export function WorkOrderOperations({ workOrder, routes, onChanged }: WorkOrderOperationsProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<WorkOrderOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [form, setForm] = useState({ step_no: "10", operation_name: "", planned_minutes: "0" });

  const load = async () => {
    if (!workOrder) return;
    setLoading(true);
    const result = await listWorkOrderOperations(workOrder.id);
    if (result.error) toast({ title: "Hata", description: result.error, variant: "destructive" });
    setRows(result.data);
    setLoading(false);
  };

  useEffect(() => {
    setRows([]);
    setRouteId("");
    load();
  }, [workOrder?.id]);

  if (!workOrder) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Operasyon Takibi</CardTitle>
          <CardDescription>Bir iş emri seçtiğinizde operasyon adımlarını burada yönetebilirsiniz.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Operasyon Takibi: {workOrder.work_order_no}</CardTitle>
        <CardDescription>{workOrder.part_name || workOrder.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={routeId} onChange={(event) => setRouteId(event.target.value)}>
            <option value="">Rota şablonu seçin</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={!routeId}
            onClick={async () => {
              const result = await createOperationsFromRoute(workOrder.id, routeId);
              if (result.error) {
                toast({ title: "Rota Uygulanamadı", description: result.error, variant: "destructive" });
                return;
              }
              toast({ title: "Rota Uygulandı", description: "Operasyonlar iş emrine eklendi." });
              await load();
              await onChanged();
            }}
          >
            Rota Uygula
          </Button>
        </div>

        <form
          className="grid gap-3 md:grid-cols-[120px_1fr_160px_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!form.operation_name.trim()) return;
            const result = await createWorkOrderOperation({
              work_order_id: workOrder.id,
              step_no: Number(form.step_no || 10),
              operation_name: form.operation_name,
              planned_minutes: Number(form.planned_minutes || 0),
            });
            if (result.error) {
              toast({ title: "Operasyon Eklenemedi", description: result.error, variant: "destructive" });
              return;
            }
            setForm({ step_no: String(Number(form.step_no || 0) + 10), operation_name: "", planned_minutes: "0" });
            await load();
          }}
        >
          <Input type="number" value={form.step_no} onChange={(event) => setForm((prev) => ({ ...prev, step_no: event.target.value }))} />
          <Input placeholder="Operasyon adı" value={form.operation_name} onChange={(event) => setForm((prev) => ({ ...prev, operation_name: event.target.value }))} />
          <Input type="number" placeholder="Plan dk" value={form.planned_minutes} onChange={(event) => setForm((prev) => ({ ...prev, planned_minutes: event.target.value }))} />
          <Button type="submit">Operasyon Ekle</Button>
        </form>

        {loading ? (
          <p className="text-sm text-muted-foreground">Operasyonlar yükleniyor...</p>
        ) : rows.length === 0 ? (
          <EmptyState title="Operasyon yok" description="Rota uygulayın veya manuel operasyon ekleyin." />
        ) : (
          <DataTable
            columns={[
              { key: "step", header: "Sıra", render: (row) => row.step_no },
              { key: "name", header: "Operasyon", render: (row) => row.operation_name },
              {
                key: "status",
                header: "Durum",
                render: (row) => <StatusBadge label={WORK_ORDER_OPERATION_STATUS_LABELS[row.status]} tone={tone(row.status)} />,
              },
              { key: "planned", header: "Plan Dk", className: "text-right", render: (row) => formatNumber(row.planned_minutes, 0) },
              { key: "actual", header: "Fiili Dk", className: "text-right", render: (row) => formatNumber(row.actual_minutes, 0) },
              { key: "started", header: "Başlangıç", render: (row) => formatDateTime(row.started_at) },
              { key: "completed", header: "Bitiş", render: (row) => formatDateTime(row.completed_at) },
              {
                key: "actions",
                header: "İşlem",
                className: "text-right",
                render: (row) => (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateWorkOrderOperationStatus(row.id, "in_progress").then(load)}>
                      Başlat
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => updateWorkOrderOperationStatus(row.id, "paused").then(load)}>
                      Duraklat
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => updateWorkOrderOperationStatus(row.id, "completed").then(load)}>
                      Tamamla
                    </Button>
                  </div>
                ),
              },
            ]}
            data={rows}
            rowKey={(row) => row.id}
          />
        )}
      </CardContent>
    </Card>
  );
}
