import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { createEmployeeTimeEntry, listEmployees, listEmployeeTimeEntries, listWorkOrders } from "../shared/erpApi";
import { formatDate, formatNumber } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { Employee, EmployeeTimeEntry, WorkOrder } from "../shared/types";

export default function TimeEntriesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<EmployeeTimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ employee_id: "", work_order_id: "", work_date: new Date().toISOString().slice(0, 10), regular_hours: "8", overtime_hours: "0", notes: "" });

  const load = async () => {
    setLoading(true);
    const [timeResult, employeeResult, workOrderResult] = await Promise.all([
      listEmployeeTimeEntries(),
      listEmployees(),
      listWorkOrders(),
    ]);
    if (timeResult.error) {
      setError(timeResult.error);
      toast({ title: "Hata", description: `Puantaj verisi alınamadı: ${timeResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(timeResult.data);
    setEmployees(employeeResult.data);
    setWorkOrders(workOrderResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  return (
    <ERPLayout title="Puantaj ve Mesai">
      <PageHeader
        title="Puantaj ve Mesai"
        description="Günlük çalışma saatleri, fazla mesai ve iş emri bağlantılarını takip edin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Puantaj Kaydı" description="Personel bazlı günlük çalışma ve fazla mesai kaydı girin.">
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!form.employee_id) return;
            const result = await createEmployeeTimeEntry({
              employee_id: form.employee_id,
              work_order_id: form.work_order_id || null,
              work_date: form.work_date,
              regular_hours: Number(form.regular_hours || 0),
              overtime_hours: Number(form.overtime_hours || 0),
              notes: form.notes || null,
            });
            if (result.error) {
              toast({ title: "Puantaj", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Puantaj kaydı oluşturuldu." });
            setForm({ employee_id: "", work_order_id: "", work_date: new Date().toISOString().slice(0, 10), regular_hours: "8", overtime_hours: "0", notes: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.employee_id} onChange={(event) => setForm((prev) => ({ ...prev, employee_id: event.target.value }))}>
            <option value="">Personel seçiniz</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.work_order_id} onChange={(event) => setForm((prev) => ({ ...prev, work_order_id: event.target.value }))}>
            <option value="">İş emri seçiniz</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                {wo.work_order_no} - {wo.title}
              </option>
            ))}
          </select>
          <Input type="date" value={form.work_date} onChange={(event) => setForm((prev) => ({ ...prev, work_date: event.target.value }))} />
          <Input type="number" step="0.25" value={form.regular_hours} onChange={(event) => setForm((prev) => ({ ...prev, regular_hours: event.target.value }))} />
          <Input type="number" step="0.25" value={form.overtime_hours} onChange={(event) => setForm((prev) => ({ ...prev, overtime_hours: event.target.value }))} />
          <div className="flex gap-2">
            <Input placeholder="Not" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Puantaj kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Puantaj kaydı yok" description="İlk kayıtlar geldikçe bu alanda listelenecektir." />
      ) : (
        <DataTable
          columns={[
            { key: "employee", header: "Personel", render: (row) => employees.find((employee) => employee.id === row.employee_id)?.full_name || row.employee_id },
            { key: "date", header: "Tarih", render: (row) => formatDate(row.work_date) },
            { key: "regular", header: "Normal Saat", className: "text-right", render: (row) => formatNumber(row.regular_hours || 0, 2) },
            { key: "ot", header: "Mesai", className: "text-right", render: (row) => formatNumber(row.overtime_hours || 0, 2) },
            { key: "wo", header: "İş Emri", render: (row) => workOrders.find((wo) => wo.id === row.work_order_id)?.work_order_no || "-" },
            { key: "note", header: "Not", render: (row) => row.notes || "-" },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Puantaj kaydı bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
