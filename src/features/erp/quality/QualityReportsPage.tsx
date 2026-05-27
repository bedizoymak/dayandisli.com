import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import {
  createQualityMeasurement,
  createQualityReport,
  listEmployees,
  listQualityMeasurements,
  listQualityReports,
  listSalesOrders,
  listWorkOrders,
  updateQualityReport,
  updateWorkOrder,
} from "../shared/erpApi";
import { formatDate } from "../shared/formatters";
import { MEASUREMENT_RESULT_LABELS, QUALITY_RESULT_LABELS } from "../shared/statusLabels";
import { Employee, MeasurementResult, QualityMeasurement, QualityReport, QualityResult, SalesOrder, WorkOrder } from "../shared/types";
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [selectedReport, setSelectedReport] = useState<QualityReport | null>(null);
  const [measurements, setMeasurements] = useState<QualityMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ work_order_id: "", sales_order_id: "", notes: "" });
  const [measurementForm, setMeasurementForm] = useState({
    characteristic: "",
    nominal_value: "",
    tolerance: "",
    measured_value: "",
    result: "pending" as MeasurementResult,
  });

  const load = async () => {
    setLoading(true);
    const [qualityResult, workOrderResult, salesOrderResult, employeeResult] = await Promise.all([
      listQualityReports(),
      listWorkOrders(),
      listSalesOrders(),
      listEmployees(),
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
    setEmployees(employeeResult.data);
    setLoading(false);
  };

  const loadMeasurements = async (report: QualityReport) => {
    setSelectedReport(report);
    const result = await listQualityMeasurements(report.id);
    if (result.error) {
      toast({ title: "Ölçüm Satırları", description: result.error, variant: "destructive" });
      return;
    }
    setMeasurements(result.data);
  };

  useEffect(() => {
    load();
  }, [toast]);

  return (
    <ERPLayout title="Kalite Kontrol">
      <PageHeader
        title="Kalite Kontrol"
        description="Ölçüm raporlarını, geçti/kaldı/şartlı sonuçlarını ve ölçüm satırlarını takip edin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Kalite Raporu" description="İş emri veya satış siparişine kalite kontrol kaydı açın.">
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const selectedWorkOrder = workOrders.find((wo) => wo.id === form.work_order_id);
            const result = await createQualityReport({
              work_order_id: form.work_order_id || null,
              sales_order_id: form.sales_order_id || selectedWorkOrder?.sales_order_id || null,
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
            { key: "report", header: "Rapor No", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/quality/${row.id}`}>{row.report_no}</Link> },
            { key: "date", header: "Kontrol Tarihi", render: (row) => formatDate(row.inspection_date) },
            { key: "inspector", header: "Kontrol Eden", render: (row) => row.inspector_employee_id ? employees.find((employee) => employee.id === row.inspector_employee_id)?.full_name || "-" : "-" },
            {
              key: "result",
              header: "Sonuç",
              render: (row) => <StatusBadge label={QUALITY_RESULT_LABELS[row.result] || row.result} tone={tone(row.result)} />,
            },
            { key: "created", header: "Kayıt", render: (row) => formatDate(row.created_at) },
            {
              key: "actions",
              header: "İşlem",
              className: "text-right",
              render: (row) => (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadMeasurements(row)}>
                    Ölçümler
                  </Button>
                  {row.result === "passed" && row.work_order_id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await updateWorkOrder(row.work_order_id!, { status: "completed" });
                        if (result.error) {
                          toast({ title: "İş Emri", description: result.error, variant: "destructive" });
                          return;
                        }
                        toast({ title: "İş Emri Tamamlandı", description: "Kalite sonucu geçtiği için iş emri tamamlandı yapıldı." });
                      }}
                    >
                      İş Emrini Tamamlandı Yap
                    </Button>
                  ) : null}
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
                </div>
              ),
            },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Kalite raporu bulunamadı"
        />
      )}

      {selectedReport ? (
        <FormSection title={`Ölçüm Satırları - ${selectedReport.report_no}`} description="Ölçülen karakteristikleri rapora bağlayın.">
          <form
            className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px_140px_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!measurementForm.characteristic.trim()) return;
              const result = await createQualityMeasurement({
                quality_report_id: selectedReport.id,
                characteristic: measurementForm.characteristic,
                nominal_value: measurementForm.nominal_value || null,
                tolerance: measurementForm.tolerance || null,
                measured_value: measurementForm.measured_value || null,
                result: measurementForm.result,
              });
              if (result.error) {
                toast({ title: "Ölçüm Eklenemedi", description: result.error, variant: "destructive" });
                return;
              }
              setMeasurementForm({ characteristic: "", nominal_value: "", tolerance: "", measured_value: "", result: "pending" });
              await loadMeasurements(selectedReport);
            }}
          >
            <Input placeholder="Karakteristik" value={measurementForm.characteristic} onChange={(event) => setMeasurementForm((prev) => ({ ...prev, characteristic: event.target.value }))} />
            <Input placeholder="Nominal" value={measurementForm.nominal_value} onChange={(event) => setMeasurementForm((prev) => ({ ...prev, nominal_value: event.target.value }))} />
            <Input placeholder="Tolerans" value={measurementForm.tolerance} onChange={(event) => setMeasurementForm((prev) => ({ ...prev, tolerance: event.target.value }))} />
            <Input placeholder="Ölçülen" value={measurementForm.measured_value} onChange={(event) => setMeasurementForm((prev) => ({ ...prev, measured_value: event.target.value }))} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={measurementForm.result} onChange={(event) => setMeasurementForm((prev) => ({ ...prev, result: event.target.value as MeasurementResult }))}>
              {Object.entries(MEASUREMENT_RESULT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Button type="submit">Ekle</Button>
          </form>

          <DataTable
            columns={[
              { key: "characteristic", header: "Karakteristik", render: (row) => row.characteristic },
              { key: "nominal", header: "Nominal", render: (row) => row.nominal_value || "-" },
              { key: "tolerance", header: "Tolerans", render: (row) => row.tolerance || "-" },
              { key: "measured", header: "Ölçülen", render: (row) => row.measured_value || "-" },
              { key: "result", header: "Sonuç", render: (row) => MEASUREMENT_RESULT_LABELS[row.result] },
            ]}
            data={measurements}
            rowKey={(row) => row.id}
            emptyMessage="Ölçüm satırı bulunamadı"
          />
        </FormSection>
      ) : null}
    </ERPLayout>
  );
}
