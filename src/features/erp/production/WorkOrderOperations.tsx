import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkOrder } from "../shared/types";

type WorkOrderOperationsProps = {
  workOrder: WorkOrder | null;
};

export function WorkOrderOperations({ workOrder }: WorkOrderOperationsProps) {
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
        <CardDescription>
          İlk sürümde operasyon detay ekranı temel seviyededir. Sonraki aşamada adım bazlı süre ve çalışan atamasi eklenecektir.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>Parça: {workOrder.part_name || workOrder.title}</p>
        <p className="mt-1">Durum: {workOrder.status}</p>
      </CardContent>
    </Card>
  );
}
