import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPModuleCard } from "../layout/ERPModuleCard";
import { Factory, GitBranch, HardHat } from "lucide-react";
import { listSubcontractingJobs, listWorkOrders } from "../shared/erpApi";
import { WorkOrder } from "../shared/types";
import { formatDate } from "../shared/formatters";

export default function ProductionPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [subcontractingCount, setSubcontractingCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [workOrderResult, subcontractingResult] = await Promise.all([listWorkOrders(), listSubcontractingJobs()]);
      setWorkOrders(workOrderResult.data);
      setSubcontractingCount(subcontractingResult.data.filter((job) => !["returned", "cancelled"].includes(job.status)).length);
    };

    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const board = useMemo(() => {
    return {
      todayStart: workOrders.filter((wo) => wo.planned_start_date === today),
      inProgress: workOrders.filter((wo) => wo.status === "in_progress"),
      quality: workOrders.filter((wo) => wo.status === "quality_check"),
      late: workOrders.filter((wo) => wo.planned_end_date && wo.planned_end_date < today && !["completed", "cancelled"].includes(wo.status)),
    };
  }, [workOrders, today]);

  const renderList = (items: WorkOrder[]) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">Kayıt yok</p>;
    return (
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <div key={item.id} className="rounded-md border bg-background p-2 text-sm">
            <p className="font-medium">{item.work_order_no}</p>
            <p className="text-muted-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">Termin: {formatDate(item.planned_end_date)}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ERPLayout title="Üretim Yönetimi">
      <PageHeader
        title="Üretim Yönetimi"
        description="İş emri, rota ve operasyon takibini üretim odaklı ekranlardan yönetin."
        actions={
          <Button asChild>
            <Link to="/calculator">DAYAN Hesaplama</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <ERPModuleCard title="İş Emirleri" description="Planlama, durum takibi ve operasyon yönetimi" href="/work-orders" icon={<HardHat className="h-5 w-5" />} />
        <ERPModuleCard title="Rota Yönetimi" description="Operasyon sırası ve makine planı" href="/routes" icon={<GitBranch className="h-5 w-5" />} />
        <ERPModuleCard title="Genel Üretim" description="Üretim KPI ve özet görünüm" href="/dashboard" icon={<Factory className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card>
          <CardHeader><CardTitle className="text-base">Bugün Başlayacak İşler</CardTitle></CardHeader>
          <CardContent>{renderList(board.todayStart)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Devam Eden İş Emirleri</CardTitle></CardHeader>
          <CardContent>{renderList(board.inProgress)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Fasonda Bekleyenler</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{subcontractingCount}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Kalite Bekleyenler</CardTitle></CardHeader>
          <CardContent>{renderList(board.quality)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Geciken İşler</CardTitle></CardHeader>
          <CardContent>{renderList(board.late)}</CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
}
