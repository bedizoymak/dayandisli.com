import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { createSubcontractingJob, listStakeholders, listSubcontractingJobs, listWorkOrders, updateSubcontractingJob, updateWorkOrder } from "../shared/erpApi";
import { formatDate, formatNumber } from "../shared/formatters";
import { STAKEHOLDER_TYPE_LABELS, SUBCONTRACTING_STATUS_LABELS } from "../shared/statusLabels";
import { Stakeholder, SubcontractingJob, SubcontractingStatus, WorkOrder } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

function tone(status: SubcontractingJob["status"]) {
  if (status === "returned") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "sent" || status === "in_process") return "warning" as const;
  return "default" as const;
}

export default function SubcontractingPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SubcontractingJob[]>([]);
  const [suppliers, setSuppliers] = useState<Stakeholder[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    work_order_id: "",
    supplier_id: "",
    process_type: "",
    sent_date: "",
    expected_return_date: "",
    quantity_sent: "1",
  });

  const load = async () => {
    setLoading(true);
    const [jobsResult, stakeholdersResult, workOrdersResult] = await Promise.all([
      listSubcontractingJobs(),
      listStakeholders(),
      listWorkOrders(),
    ]);
    if (jobsResult.error) {
      setError(jobsResult.error);
      toast({ title: "Hata", description: `Fason kayıtları yüklenemedi: ${jobsResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(jobsResult.data);
    setSuppliers(stakeholdersResult.data.filter((item) => item.type === "supplier" || item.type === "subcontractor" || item.type === "both"));
    setWorkOrders(workOrdersResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  return (
    <ERPLayout title="Fason Takibi">
      <PageHeader
        title="Fason Takibi"
        description="Dış işlem süreçlerini (ısıl işlem, kaplama vb.) sevk-dönüş döngüsü ile izleyin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Fason Kaydı" description="İş emrini dış işlem için planlayın veya gönderime alın.">
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!form.process_type.trim()) return;
            const result = await createSubcontractingJob({
              work_order_id: form.work_order_id || null,
              supplier_id: form.supplier_id || null,
              process_type: form.process_type,
              sent_date: form.sent_date || null,
              expected_return_date: form.expected_return_date || null,
              quantity_sent: Number(form.quantity_sent || 0),
              status: form.sent_date ? "sent" : "planned",
            });
            if (result.error) {
              toast({ title: "Fason Kaydı", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Fason takip kaydı oluşturuldu." });
            setForm({ work_order_id: "", supplier_id: "", process_type: "", sent_date: "", expected_return_date: "", quantity_sent: "1" });
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
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.supplier_id} onChange={(event) => setForm((prev) => ({ ...prev, supplier_id: event.target.value }))}>
            <option value="">Fason/tedarikçi seçiniz</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.company_name} ({STAKEHOLDER_TYPE_LABELS[supplier.type]})
              </option>
            ))}
          </select>
          <Input placeholder="İşlem tipi" value={form.process_type} onChange={(event) => setForm((prev) => ({ ...prev, process_type: event.target.value }))} />
          <Input type="date" value={form.sent_date} onChange={(event) => setForm((prev) => ({ ...prev, sent_date: event.target.value }))} />
          <Input type="date" value={form.expected_return_date} onChange={(event) => setForm((prev) => ({ ...prev, expected_return_date: event.target.value }))} />
          <div className="flex gap-2">
            <Input type="number" step="0.001" value={form.quantity_sent} onChange={(event) => setForm((prev) => ({ ...prev, quantity_sent: event.target.value }))} />
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Fason kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Fason kaydı yok" description="İlk kayıtlar oluşturulduğunda bu ekranda listelenecektir." />
      ) : (
        <DataTable
          columns={[
            { key: "supplier", header: "Fason Firma", render: (row) => suppliers.find((supplier) => supplier.id === row.supplier_id)?.company_name || "-" },
            { key: "process", header: "İşlem Tipi", render: (row) => row.process_type },
            { key: "sent", header: "Gönderim Tarihi", render: (row) => formatDate(row.sent_date || row.created_at) },
            { key: "expected", header: "Beklenen Dönüş", render: (row) => formatDate(row.expected_return_date) },
            {
              key: "status",
              header: "Durum",
              render: (row) => <StatusBadge label={SUBCONTRACTING_STATUS_LABELS[row.status]} tone={tone(row.status)} />,
            },
            { key: "qty_sent", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity_sent, 3) },
            { key: "qty_returned", header: "Dönen", className: "text-right", render: (row) => formatNumber(row.quantity_returned, 3) },
            {
              key: "actions",
              header: "İşlem",
              className: "text-right",
              render: (row) => (
                <select
                  className="h-9 rounded-md border bg-background px-2 text-xs"
                  value={row.status}
                  onChange={async (event) => {
                    const status = event.target.value as SubcontractingStatus;
                    const patch: Partial<SubcontractingJob> = { status };
                    if (status === "sent") patch.sent_date = row.sent_date || new Date().toISOString().slice(0, 10);
                    if (status === "returned") patch.returned_date = new Date().toISOString().slice(0, 10);
                    const result = await updateSubcontractingJob(row.id, patch);
                    if (result.error) {
                      toast({ title: "Hata", description: result.error, variant: "destructive" });
                      return;
                    }
                    if (row.work_order_id && status === "returned") await updateWorkOrder(row.work_order_id, { status: "in_progress" });
                    toast({ title: "Güncellendi", description: "Fason durumu güncellendi." });
                    await load();
                  }}
                >
                  {Object.entries(SUBCONTRACTING_STATUS_LABELS).map(([value, label]) => (
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
          emptyMessage="Fason kaydı bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
