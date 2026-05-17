import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { createEmployee, listEmployees } from "../shared/erpApi";
import { Employee } from "../shared/types";
import { formatDate } from "../shared/formatters";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";

export default function EmployeesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", role: "", department: "" });

  const load = async () => {
    setLoading(true);
    const result = await listEmployees();
    if (result.error) {
      toast({ title: "Hata", description: `Personel verisi alinamadi: ${result.error}`, variant: "destructive" });
    }
    setRows(result.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ERPLayout title="IK ve Personel">
      <PageHeader title="IK ve Personel" description="Personel listesi, görev rolleri ve aktiflik durumunu yönetin." />

      <FormSection title="Yeni Personel" description="Temel personel kartı oluşturun.">
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!form.full_name.trim()) return;

            setSaving(true);
            const result = await createEmployee(form);
            setSaving(false);

            if (result.error) {
              toast({ title: "Kayıt Hatası", description: result.error, variant: "destructive" });
              return;
            }

            toast({ title: "Başarılı", description: "Personel eklendi." });
            setForm({ full_name: "", role: "", department: "" });
            await load();
          }}
        >
          <Input
            placeholder="Ad Soyad *"
            value={form.full_name}
            onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
            required
          />
          <Input
            placeholder="Rol"
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
          />
          <Input
            placeholder="Departman"
            value={form.department}
            onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
          />

          <div className="md:col-span-3 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Personel Ekle"}
            </Button>
          </div>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Personel listesi yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Personel kaydı yok" description="Yeni personel ekleyerek başlayabilirsiniz." />
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Personel", render: (row) => row.full_name },
            { key: "role", header: "Rol", render: (row) => row.role || "-" },
            { key: "dept", header: "Departman", render: (row) => row.department || "-" },
            {
              key: "status",
              header: "Durum",
              render: (row) =>
                row.is_active ? <StatusBadge label="Aktif" tone="success" /> : <StatusBadge label="Pasif" tone="muted" />,
            },
            { key: "created", header: "Oluşturulma", render: (row) => formatDate(row.created_at) },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Personel kaydı bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
