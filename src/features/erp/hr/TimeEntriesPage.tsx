import { useEffect, useState } from "react";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { listEmployeeTimeEntries } from "../shared/erpApi";
import { formatDate, formatNumber } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { EmployeeTimeEntry } from "../shared/types";

export default function TimeEntriesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<EmployeeTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listEmployeeTimeEntries();
      if (result.error) {
        toast({ title: "Hata", description: `Puantaj verisi alınamadı: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Puantaj ve Mesai">
      <PageHeader
        title="Puantaj ve Mesai"
        description="Günlük çalışma saatleri, fazla mesai ve iş emri bağlantılarını takip edin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Puantaj kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Puantaj kaydı yok" description="İlk kayıtlar geldikçe bu alanda listelenecektir." />
      ) : (
        <DataTable
          columns={[
            { key: "employee", header: "Personel ID", render: (row) => row.employee_id },
            { key: "date", header: "Tarih", render: (row) => formatDate(row.work_date) },
            { key: "regular", header: "Normal Saat", className: "text-right", render: (row) => formatNumber(row.regular_hours || 0, 2) },
            { key: "ot", header: "Mesai", className: "text-right", render: (row) => formatNumber(row.overtime_hours || 0, 2) },
            { key: "wo", header: "İş Emri", render: (row) => row.work_order_id || "-" },
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
