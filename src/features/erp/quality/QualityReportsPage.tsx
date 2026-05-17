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
import { createQualityReport, listSalesOrders, listWorkOrders, listQualityReports, updateQualityReport } from "../shared/erpApi";
import { formatDate } from "../shared/formatters";
import { QUALITY_RESULT_LABELS } from "../shared/statusLabels";
import { QualityReport, QualityResult, SalesOrder, WorkOrder } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

function tone(result: QualityReport["result"]) {
  if (result === "passed") return "success" as const;
  if (result === "failed") return "danger" as const;
  if (result === "conditional") return "warning" as const;
  return "default" as const;
}

export default function QualityReportsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<QualityReport[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ work_order_id: "", sales_order_id: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const [qualityResult, workOrderResult, salesOrderResult] = await Promise.all([
      listQualityReports(),
      listWorkOrders(),
      listSalesOrders(),
    ]);
    if (qualityResult.error) {
      setError(qualityResult.error);
      toast({ title: "Hata", description: `Kalite raporları yüklenemedi: ${qualityResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(qualityResult.data);
    setWorkOrders(workOrderResult.data);
    setSalesOrders(salesOrderResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  return (
    <ERPLayout title="Kalite Kontrol">
      <PageHeader
        title="Kalite Kontrol"
        description="Ölçüm raporlarını ve geçti/kaldı/şartlı sonuçlarını takip edin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Kalite Raporu" description="İş emri veya satış siparişine kalite kontrol kaydı açın.">
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await createQualityReport({
              work_order_id: form.work_order_id || null,
              sales_order_id: form.sales_order_id || null,
              result: "pending",
              notes: form.notes || null,
            });
            if (result.error) {
              toast({ title: "Kalite Raporu", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Kalite raporu oluşturuldu." });
            setForm({ work_order_id: "", sales_order_id: "", notes: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.work_order_id} onChange={(event) => setForm((prev) => ({ ...prev, work_order_id: event.target.value }))}>
            <option value="">İş emri seçiniz</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                {wo.work_order_no} - {wo.title}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.sales_order_id} onChange={(event) => setForm((prev) => ({ ...prev, sales_order_id: event.target.value }))}>
            <option value="">Satış siparişi seçiniz</option>
            {salesOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.order_no} - {order.title}
              </option>
            ))}
          </select>
          <Input placeholder="Not" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          <Button type="submit">Rapor Aç</Button>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Kalite raporları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Kalite raporu yok" description="Henüz kalite kontrol raporu bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "report", header: "Rapor No", render: (row) => row.report_no },
            { key: "date", header: "Kontrol Tarihi", render: (row) => formatDate(row.inspection_date) },
            {
              key: "result",
              header: "Sonuç",
              render: (row) => <StatusBadge label={QUALITY_RESULT_LABELS[row.result] || row.result} tone={tone(row.result)} />,
            },
            { key: "created", header: "Kayıt", render: (row) => formatDate(row.created_at) },
            {
              key: "actions",
              header: "Sonuç",
              className: "text-right",
              render: (row) => (
                <select
                  className="h-9 rounded-md border bg-background px-2 text-xs"
                  value={row.result}
                  onChange={async (event) => {
                    const result = await updateQualityReport(row.id, { result: event.target.value as QualityResult });
                    if (result.error) {
                      toast({ title: "Hata", description: result.error, variant: "destructive" });
                      return;
                    }
                    toast({ title: "Güncellendi", description: "Kalite sonucu güncellendi." });
                    await load();
                  }}
                >
                  {Object.entries(QUALITY_RESULT_LABELS).map(([value, label]) => (
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
          emptyMessage="Kalite raporu bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
