import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "../shared/formatters";
import { Machine, WorkOrder, WorkOrderOperation } from "../shared/types";

type WorkOrderPrintSheetProps = {
  workOrder: WorkOrder;
  operations: WorkOrderOperation[];
  stakeholderName?: string;
  machines: Machine[];
};

export function WorkOrderPrintSheet({ workOrder, operations, stakeholderName, machines }: WorkOrderPrintSheetProps) {
  const machineName = (machineId: string | null) => machines.find((machine) => machine.id === machineId)?.name || "-";

  return (
    <Card className="print:shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 print:hidden">
        <div>
          <CardTitle className="text-lg">İş Emri Formu</CardTitle>
          <p className="text-sm text-muted-foreground">Atölye çıktısı için sade üretim formu.</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          İş Emri Formu Yazdır
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="hidden text-center print:block">
          <h1 className="text-xl font-bold">DAYAN Dişli İş Emri Formu</h1>
        </div>

        <div className="grid gap-3 rounded-md border p-4 text-sm md:grid-cols-3">
          <div>
            <span className="text-muted-foreground">İş Emri No</span>
            <p className="font-semibold">{workOrder.work_order_no}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Müşteri</span>
            <p className="font-semibold">{stakeholderName || "-"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Termin</span>
            <p className="font-semibold">{formatDate(workOrder.planned_end_date)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Parça</span>
            <p className="font-semibold">{workOrder.part_name || workOrder.title}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Miktar</span>
            <p className="font-semibold">{formatNumber(workOrder.quantity, 3)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Öncelik</span>
            <p className="font-semibold">{workOrder.priority}</p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-semibold">Operasyon Listesi</h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Sıra</th>
                  <th className="p-2 text-left">Operasyon</th>
                  <th className="p-2 text-left">Makine</th>
                  <th className="p-2 text-right">Plan Süre</th>
                  <th className="p-2 text-left">Operatör İmza</th>
                </tr>
              </thead>
              <tbody>
                {operations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Operasyon kaydı bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  operations.map((operation) => (
                    <tr key={operation.id} className="border-t">
                      <td className="p-2">{operation.step_no}</td>
                      <td className="p-2">{operation.operation_name}</td>
                      <td className="p-2">{machineName(operation.machine_id)}</td>
                      <td className="p-2 text-right">{formatNumber(operation.planned_minutes, 0)} dk</td>
                      <td className="p-2">________________</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border p-4">
            <h3 className="mb-3 font-semibold">Notlar</h3>
            <p className="min-h-20 text-sm">{workOrder.notes || "-"}</p>
          </div>
          <div className="rounded-md border p-4">
            <h3 className="mb-3 font-semibold">Kalite Kontrol Alanı</h3>
            <p className="text-sm">Ölçüm sonucu: ________________________</p>
            <p className="mt-3 text-sm">Kontrol eden: ________________________</p>
            <p className="mt-3 text-sm">Tarih / İmza: ________________________</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
