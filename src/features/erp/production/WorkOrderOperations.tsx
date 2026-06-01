import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Truck } from "lucide-react";
import {
  createOperationsFromRoute,
  createInventoryMovement,
  createWorkOrderOperation,
  listInventoryMovements,
  listWorkOrderOperations,
  updateWorkOrderOperationStatus,
} from "../shared/erpApi";
import { InventoryItem, InventoryMovement, Machine, ProductionRoute, WorkOrder, WorkOrderOperation } from "../shared/types";
import { INVENTORY_ITEM_TYPE_LABELS, INVENTORY_MOVEMENT_TYPE_LABELS, WORK_ORDER_OPERATION_STATUS_LABELS, WORK_ORDER_STATUS_LABELS } from "../shared/statusLabels";
import { formatDate, formatDateTime, formatNumber } from "../shared/formatters";
import { WorkOrderPrintSheet } from "./WorkOrderPrintSheet";

type WorkOrderOperationsProps = {
  workOrder: WorkOrder | null;
  routes: ProductionRoute[];
  machines: Machine[];
  inventoryItems: InventoryItem[];
  stakeholderName?: string;
  onSendQuality: (workOrder: WorkOrder, operation?: WorkOrderOperation) => Promise<void>;
  onSendSubcontracting: (workOrder: WorkOrder, operation: WorkOrderOperation) => Promise<void>;
  onChanged: () => Promise<void>;
};

function tone(status: WorkOrderOperation["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "in_progress") return "warning" as const;
  if (status === "paused") return "muted" as const;
  return "default" as const;
}

export function WorkOrderOperations({ workOrder, routes, machines, inventoryItems, stakeholderName, onSendQuality, onSendSubcontracting, onChanged }: WorkOrderOperationsProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<WorkOrderOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [routeId, setRouteId] = useState("");
  const [materialForm, setMaterialForm] = useState({ inventory_item_id: "", quantity: "1", notes: "" });
  const [form, setForm] = useState({
    step_no: "10",
    operation_name: "",
    machine_id: "",
    planned_minutes: "0",
    quality_required: false,
    notes: "",
  });

  const machineNameById = useMemo(
    () =>
      machines.reduce<Record<string, string>>((acc, machine) => {
        acc[machine.id] = machine.name;
        return acc;
      }, {}),
    [machines]
  );

  const load = useCallback(async () => {
    if (!workOrder) return;
    setLoading(true);
    const result = await listWorkOrderOperations(workOrder.id);
    const movementResult = await listInventoryMovements();
    if (result.error) toast({ title: "Hata", description: result.error, variant: "destructive" });
    setRows(result.data);
    setMovements(movementResult.data.filter((movement) => movement.source_type === "work_order" && movement.source_id === workOrder.id));
    setLoading(false);
  }, [toast, workOrder]);

  useEffect(() => {
    setRows([]);
    setRouteId("");
    load();
  }, [load]);

  const updateOperation = async (operation: WorkOrderOperation, status: WorkOrderOperation["status"]) => {
    const actualMinutes =
      status === "completed"
        ? Number(window.prompt("Gerçek süreyi dakika olarak girin:", String(operation.actual_minutes || operation.planned_minutes || 0)) || operation.actual_minutes || 0)
        : undefined;

    const result = await updateWorkOrderOperationStatus(operation.id, status, actualMinutes);
    if (result.error) {
      toast({ title: "Operasyon Güncellenemedi", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Operasyon Güncellendi", description: WORK_ORDER_OPERATION_STATUS_LABELS[status] });
    await load();
    await onChanged();
  };

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

  const allOperationsCompleted = rows.length > 0 && rows.every((row) => row.status === "completed");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{workOrder.work_order_no} - {workOrder.title}</CardTitle>
              <CardDescription>{workOrder.part_name || "Parça bilgisi girilmemiş"}</CardDescription>
            </div>
            <StatusBadge label={WORK_ORDER_STATUS_LABELS[workOrder.status]} tone={workOrder.status === "completed" ? "success" : workOrder.status === "waiting_subcontractor" ? "warning" : "default"} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Müşteri</span>
            <p className="font-medium">{stakeholderName || "-"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Miktar</span>
            <p className="font-medium">{formatNumber(workOrder.quantity, 3)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Plan Başlangıç</span>
            <p className="font-medium">{formatDate(workOrder.planned_start_date)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Plan Bitiş</span>
            <p className="font-medium">{formatDate(workOrder.planned_end_date)}</p>
          </div>
          <div className="md:col-span-4">
            <span className="text-muted-foreground">Notlar</span>
            <p className="font-medium">{workOrder.notes || "-"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Operasyon Takibi</CardTitle>
          <CardDescription>Rota uygulayın, manuel operasyon ekleyin ve atölye durumlarını güncelleyin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
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
                if (rows.length > 0 && !window.confirm("Bu iş emrinde operasyon var. Yine de rota adımları eklenmeye çalışılsın mı?")) return;
                const result = await createOperationsFromRoute(workOrder.id, routeId, rows.length > 0);
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
            {allOperationsCompleted ? (
              <Button onClick={() => onSendQuality(workOrder)}>Kalite Kontrole Gönder</Button>
            ) : null}
          </div>

          <form
            className="grid gap-3 md:grid-cols-[100px_1fr_180px_130px_140px_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!form.operation_name.trim()) return;
              const result = await createWorkOrderOperation({
                work_order_id: workOrder.id,
                step_no: Number(form.step_no || 10),
                operation_name: form.operation_name,
                machine_id: form.machine_id || null,
                planned_minutes: Number(form.planned_minutes || 0),
                quality_required: form.quality_required,
                notes: form.notes || null,
              });
              if (result.error) {
                toast({ title: "Operasyon Eklenemedi", description: result.error, variant: "destructive" });
                return;
              }
              setForm((prev) => ({
                step_no: String(Number(prev.step_no || 0) + 10),
                operation_name: "",
                machine_id: "",
                planned_minutes: "0",
                quality_required: false,
                notes: "",
              }));
              await load();
            }}
          >
            <Input type="number" value={form.step_no} onChange={(event) => setForm((prev) => ({ ...prev, step_no: event.target.value }))} />
            <Input placeholder="Operasyon adı" value={form.operation_name} onChange={(event) => setForm((prev) => ({ ...prev, operation_name: event.target.value }))} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.machine_id} onChange={(event) => setForm((prev) => ({ ...prev, machine_id: event.target.value }))}>
              <option value="">Makine seçiniz</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>{machine.name}</option>
              ))}
            </select>
            <Input type="number" placeholder="Plan dk" value={form.planned_minutes} onChange={(event) => setForm((prev) => ({ ...prev, planned_minutes: event.target.value }))} />
            <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
              <input type="checkbox" checked={form.quality_required} onChange={(event) => setForm((prev) => ({ ...prev, quality_required: event.target.checked }))} />
              Kalite gerekli
            </label>
            <Button type="submit">Operasyon Ekle</Button>
            <Input className="md:col-span-6" placeholder="Operasyon notu" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
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
                { key: "machine", header: "Makine", render: (row) => (row.machine_id ? machineNameById[row.machine_id] || "-" : "-") },
                {
                  key: "status",
                  header: "Durum",
                  render: (row) => <StatusBadge label={WORK_ORDER_OPERATION_STATUS_LABELS[row.status]} tone={tone(row.status)} />,
                },
                { key: "planned", header: "Plan Süre", className: "text-right", render: (row) => `${formatNumber(row.planned_minutes, 0)} dk` },
                { key: "actual", header: "Gerçek Süre", className: "text-right", render: (row) => `${formatNumber(row.actual_minutes, 0)} dk` },
                { key: "started", header: "Başlangıç", render: (row) => formatDateTime(row.started_at) },
                { key: "completed", header: "Bitiş", render: (row) => formatDateTime(row.completed_at) },
                {
                  key: "actions",
                  header: "Aksiyonlar",
                  className: "text-right",
                  render: (row) => (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => updateOperation(row, "in_progress")}>Başlat</Button>
                      <Button variant="outline" size="sm" onClick={() => updateOperation(row, "paused")}>Duraklat</Button>
                      <Button variant="outline" size="sm" onClick={() => updateOperation(row, "completed")}>Tamamla</Button>
                      <Button variant="outline" size="sm" onClick={() => onSendQuality(workOrder, row)}>
                        <ClipboardCheck className="mr-1 h-3 w-3" />
                        Kalite
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onSendSubcontracting(workOrder, row)}>
                        <Truck className="mr-1 h-3 w-3" />
                        Fason
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => updateOperation(row, "cancelled")}>İptal</Button>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Malzeme Tüketimi ve Mamul Stok Temeli</CardTitle>
          <CardDescription>İş emrine bağlı stok çıkışı ve üretim sonrası stok hareketi altyapısını yönetin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 md:grid-cols-[1fr_140px_1fr_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!materialForm.inventory_item_id) {
                toast({ title: "Eksik Bilgi", description: "Stok kalemi seçiniz.", variant: "destructive" });
                return;
              }
              const result = await createInventoryMovement({
                inventory_item_id: materialForm.inventory_item_id,
                movement_type: "out",
                quantity: Number(materialForm.quantity || 0),
                source_type: "work_order",
                source_id: workOrder.id,
                notes: materialForm.notes || `${workOrder.work_order_no} üretim tüketimi`,
              });
              if (result.error) {
                toast({ title: "Malzeme Tüketimi", description: result.error, variant: "destructive" });
                return;
              }
              toast({ title: "Stok Hareketi Oluşturuldu", description: "Malzeme tüketimi iş emrine bağlandı." });
              setMaterialForm({ inventory_item_id: "", quantity: "1", notes: "" });
              await load();
              await onChanged();
            }}
          >
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={materialForm.inventory_item_id} onChange={(event) => setMaterialForm((prev) => ({ ...prev, inventory_item_id: event.target.value }))}>
              <option value="">Malzeme seçiniz</option>
              {inventoryItems
                .filter((item) => item.item_type !== "finished_good")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code ? `${item.code} - ${item.name}` : item.name} ({INVENTORY_ITEM_TYPE_LABELS[item.item_type]})
                  </option>
                ))}
            </select>
            <Input type="number" step="0.001" value={materialForm.quantity} onChange={(event) => setMaterialForm((prev) => ({ ...prev, quantity: event.target.value }))} />
            <Input placeholder="Tüketim notu" value={materialForm.notes} onChange={(event) => setMaterialForm((prev) => ({ ...prev, notes: event.target.value }))} />
            <Button type="submit">Tüketim İşle</Button>
          </form>

          <DataTable
            columns={[
              { key: "item", header: "Stok Kalemi", render: (row) => inventoryItems.find((item) => item.id === row.inventory_item_id)?.name || row.inventory_item_id },
              { key: "type", header: "Hareket", render: (row) => INVENTORY_MOVEMENT_TYPE_LABELS[row.movement_type] },
              { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
              { key: "date", header: "Tarih", render: (row) => formatDateTime(row.movement_date) },
              { key: "notes", header: "Not", render: (row) => row.notes || "-" },
            ]}
            data={movements}
            rowKey={(row) => row.id}
            emptyMessage="Bu iş emrine bağlı malzeme tüketimi yok."
          />

          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Mamul stok girişi için mevcut stok hareketi altyapısı hazırdır. Tam otomatik mamul girişi, üretim maliyeti ve lot/seri takibi sonraki faza bırakıldı.
          </div>
        </CardContent>
      </Card>

      <WorkOrderPrintSheet workOrder={workOrder} operations={rows} stakeholderName={stakeholderName} machines={machines} />
    </div>
  );
}
