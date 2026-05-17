import { useEffect, useState } from "react";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { listPayments } from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { Payment } from "../shared/types";

export default function PaymentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listPayments();
      if (result.error) {
        toast({ title: "Hata", description: `Ödeme verisi yüklenemedi: ${result.error}`, variant: "destructive" });
      }
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [toast]);

  return (
    <ERPLayout title="Tahsilat ve Ödemeler">
      <PageHeader
        title="Tahsilat ve Ödemeler"
        description="Kasa/banka hareketlerini ve cari ödeme kayıtlarını izleyin."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Ödeme kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Ödeme kaydı yok" description="Henüz tahsilat/ödeme kaydı bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "type", header: "Tip", render: (row) => (row.payment_type === "collection" ? "Tahsilat" : "Ödeme") },
            { key: "date", header: "Tarih", render: (row) => formatDate(row.payment_date) },
            { key: "amount", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.amount || 0, row.currency || "TRY") },
            { key: "desc", header: "Açıklama", render: (row) => row.description || "-" },
            { key: "invoice", header: "Fatura", render: (row) => row.related_invoice_id || "-" },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Ödeme kaydı bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
