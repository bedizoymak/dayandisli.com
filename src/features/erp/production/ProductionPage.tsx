import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPModuleCard } from "../layout/ERPModuleCard";
import { Factory, GitBranch, HardHat } from "lucide-react";
import { listMachines, listSubcontractingJobs, listWorkOrderOperations, listWorkOrders } from "../shared/erpApi";
import { Machine, WorkOrder, WorkOrderOperation } from "../shared/types";
import { formatDate, formatDateTime, formatNumber } from "../shared/formatters";
import { WORK_ORDER_OPERATION_STATUS_LABELS, WORK_ORDER_STATUS_LABELS } from "../shared/statusLabels";

export default function ProductionPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [operations, setOperations] = useState<WorkOrderOperation[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [subcontractingCount, setSubcontractingCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [workOrderResult, subcontractingResult, machineResult] = await Promise.all([listWorkOrders(), listSubcontractingJobs(), listMachines()]);
      setWorkOrders(workOrderResult.data);
      setMachines(machineResult.data);
      setSubcontractingCount(subcontractingResult.data.filter((job) => !["returned", "cancelled"].includes(job.status)).length);
      const operationResults = await Promise.all(workOrderResult.data.slice(0, 50).map((order) => listWorkOrderOperations(order.id)));
      setOperations(operationResults.flatMap((result) => result.data));
    };

    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const board = useMemo(() => ({
    planned: workOrders.filter((wo) => wo.status === "planned" || wo.status === "released"),
    todayStart: workOrders.filter((wo) => wo.planned_start_date === today),
    inProgress: workOrders.filter((wo) => wo.status === "in_progress"),
    quality: workOrders.filter((wo) => wo.status === "quality_check"),
    completed: workOrders.filter((wo) => wo.status === "completed"),
    late: workOrders.filter((wo) => wo.planned_end_date && wo.planned_end_date < today && !["completed", "cancelled"].includes(wo.status)),
  }), [workOrders, today]);

  const machineNameById = useMemo(() => Object.fromEntries(machines.map((machine) => [machine.id, machine.name])), [machines]);
  const workOrderById = useMemo(() => Object.fromEntries(workOrders.map((order) => [order.id, order])), [workOrders]);
  const workCenters = machines.map((machine) => {
    const machineOperations = operations.filter((operation) => operation.machine_id === machine.id);
    return {
      ...machine,
      operationCount: machineOperations.length,
      activeCount: machineOperations.filter((operation) => operation.status === "in_progress").length,
      completedCount: machineOperations.filter((operation) => operation.status === "completed").length,
    };
  });

  const renderList = (items: WorkOrder[]) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">Kayıt yok</p>;
    return (
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <Link key={item.id} to={`/work-orders/${item.id}`} className="block rounded-md border bg-background p-2 text-sm hover:bg-muted/50">
            <p className="font-medium">{item.work_order_no}</p>
            <p className="text-muted-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">Termin: {formatDate(item.planned_end_date)}</p>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <ERPLayout title="Üretim Yönetimi">
      <PageHeader
        title="Üretim Yönetimi"
        description="Üretim emirleri, planlama, iş merkezleri, operasyonlar, durumlar ve üretim geçmişini yönetin."
        actions={<Button asChild><Link to="/work-orders">Üretim Emri Aç</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <ERPModuleCard title="Üretim Emirleri" description="Planlama, durum takibi ve operasyon yönetimi" href="/work-orders" icon={<HardHat className="h-5 w-5" />} />
        <ERPModuleCard title="İş Merkezleri ve Rotalar" description="Operasyon sırası ve makine planı" href="/routes" icon={<GitBranch className="h-5 w-5" />} />
        <ERPModuleCard title="Üretim Hesaplama" description="Dişli üretim hesaplama araçları" href="/calculator" icon={<Factory className="h-5 w-5" />} />
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Planlanan</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{board.planned.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Devam Eden</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{board.inProgress.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Fason</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{subcontractingCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Kalite Bekleyen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{board.quality.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Geciken</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{board.late.length}</CardContent></Card>
      </div>

      <Tabs defaultValue="planning">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="orders">Üretim Emirleri</TabsTrigger>
          <TabsTrigger value="planning">Üretim Planlama</TabsTrigger>
          <TabsTrigger value="centers">İş Merkezleri</TabsTrigger>
          <TabsTrigger value="operations">Operasyonlar</TabsTrigger>
          <TabsTrigger value="status">Üretim Durumları</TabsTrigger>
          <TabsTrigger value="history">Üretim Geçmişi</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <DataTable columns={[
            { key: "no", header: "Üretim Emri", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/work-orders/${row.id}`}>{row.work_order_no}</Link> },
            { key: "title", header: "Başlık", render: (row) => row.title },
            { key: "part", header: "Parça", render: (row) => row.part_name || "-" },
            { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={WORK_ORDER_STATUS_LABELS[row.status]} tone={row.status === "completed" ? "success" : row.status === "cancelled" ? "danger" : "default"} /> },
          ]} data={workOrders} rowKey={(row) => row.id} emptyMessage="Üretim emri yok" />
        </TabsContent>
        <TabsContent value="planning">
          <div className="grid gap-4 lg:grid-cols-4">
            <Card><CardHeader><CardTitle className="text-base">Bugün Başlayacak İşler</CardTitle></CardHeader><CardContent>{renderList(board.todayStart)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Devam Eden İş Emirleri</CardTitle></CardHeader><CardContent>{renderList(board.inProgress)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Kalite Bekleyenler</CardTitle></CardHeader><CardContent>{renderList(board.quality)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Geciken İşler</CardTitle></CardHeader><CardContent>{renderList(board.late)}</CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="centers">
          <DataTable columns={[
            { key: "name", header: "İş Merkezi", render: (row) => row.name },
            { key: "code", header: "Kod", render: (row) => row.code || "-" },
            { key: "type", header: "Tip", render: (row) => row.machine_type || "-" },
            { key: "location", header: "Lokasyon", render: (row) => row.location || "-" },
            { key: "active", header: "Aktif Operasyon", className: "text-right", render: (row) => row.activeCount },
            { key: "total", header: "Toplam Operasyon", className: "text-right", render: (row) => row.operationCount },
          ]} data={workCenters} rowKey={(row) => row.id} emptyMessage="İş merkezi yok" />
        </TabsContent>
        <TabsContent value="operations">
          <DataTable columns={[
            { key: "wo", header: "Üretim Emri", render: (row) => workOrderById[row.work_order_id]?.work_order_no || row.work_order_id },
            { key: "step", header: "Sıra", render: (row) => row.step_no },
            { key: "operation", header: "Operasyon", render: (row) => row.operation_name },
            { key: "machine", header: "İş Merkezi", render: (row) => row.machine_id ? machineNameById[row.machine_id] || "-" : "-" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={WORK_ORDER_OPERATION_STATUS_LABELS[row.status]} tone={row.status === "completed" ? "success" : row.status === "cancelled" ? "danger" : "default"} /> },
            { key: "planned", header: "Plan Süre", className: "text-right", render: (row) => `${formatNumber(row.planned_minutes, 0)} dk` },
          ]} data={operations} rowKey={(row) => row.id} emptyMessage="Operasyon kaydı yok" />
        </TabsContent>
        <TabsContent value="status">
          <div className="grid gap-3 md:grid-cols-4">
            {Object.entries(WORK_ORDER_STATUS_LABELS).map(([status, label]) => (
              <Card key={status}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{workOrders.filter((order) => order.status === status).length}</CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="history">
          <DataTable columns={[
            { key: "no", header: "Üretim Emri", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/work-orders/${row.id}`}>{row.work_order_no}</Link> },
            { key: "title", header: "Başlık", render: (row) => row.title },
            { key: "start", header: "Başlangıç", render: (row) => formatDateTime(row.actual_start_at) },
            { key: "end", header: "Bitiş", render: (row) => formatDateTime(row.actual_end_at) },
            { key: "qty", header: "Mamul Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
          ]} data={board.completed} rowKey={(row) => row.id} emptyMessage="Tamamlanan üretim emri yok" />
        </TabsContent>
      </Tabs>
    </ERPLayout>
  );
}
