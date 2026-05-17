import { useEffect, useState } from "react";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { listInvoices } from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Invoice } from "../shared/types";

function tone(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "partial") return "warning" as const;
  return "default" as const;
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listInvoices();
      if (result.error) {
        toast({ title: "Hata", description: `Faturalar yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Fatura Takibi">
      <PageHeader
        title="Fatura Takibi"
        description="Satış ve alış faturalarını durum bazlı takip edin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Faturalar yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Fatura kaydı yok" description="Henüz fatura kaydı bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "no", header: "Fatura No", render: (row) => row.invoice_no || "-" },
            { key: "type", header: "Tip", render: (row) => (row.invoice_type === "sales" ? "Satış" : "Alış") },
            { key: "date", header: "Tarih", render: (row) => formatDate(row.invoice_date) },
            { key: "due", header: "Vade", render: (row) => formatDate(row.due_date) },
            { key: "total", header: "Toplam", className: "text-right", render: (row) => formatCurrency(row.grand_total || 0, row.currency || "TRY") },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Fatura bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
