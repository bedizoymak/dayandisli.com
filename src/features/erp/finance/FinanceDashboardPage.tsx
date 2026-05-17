import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/erp/MetricCard";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { listInvoices, listPayments } from "../shared/erpApi";
import { formatCurrency } from "../shared/formatters";
import { Invoice, Payment } from "../shared/types";
import { FileText, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FinanceDashboardPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const load = async () => {
      const [invoiceResult, paymentResult] = await Promise.all([listInvoices(), listPayments()]);

      if (invoiceResult.error) {
        toast({ title: "Hata", description: `Fatura verisi alınamadı: ${invoiceResult.error}`, variant: "destructive" });
      }
      if (paymentResult.error) {
        toast({ title: "Hata", description: `Ödeme verisi alınamadı: ${paymentResult.error}`, variant: "destructive" });
      }

      setInvoices(invoiceResult.data);
      setPayments(paymentResult.data);
    };

    load();
  }, [toast]);

  const totals = useMemo(() => {
    const invoiceTotal = invoices.reduce((sum, row) => sum + Number(row.grand_total || 0), 0);
    const paymentTotal = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const openInvoiceCount = invoices.filter((row) => !["paid", "cancelled"].includes(row.status)).length;

    return { invoiceTotal, paymentTotal, openInvoiceCount };
  }, [invoices, payments]);

  return (
    <ERPLayout title="Finans">
      <PageHeader
        title="Ön Muhasebe ve Finans"
        description="Cari, fatura ve tahsilat/ödeme hareketlerinin özet görünümü."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Açık Faturalar" value={totals.openInvoiceCount} icon={<FileText className="h-5 w-5" />} />
        <MetricCard
          title="Toplam Fatura Tutarı"
          value={Math.round(totals.invoiceTotal)}
          subtitle={formatCurrency(totals.invoiceTotal)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <MetricCard
          title="Toplam Tahsilat/Ödeme"
          value={Math.round(totals.paymentTotal)}
          subtitle={formatCurrency(totals.paymentTotal)}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Not: İlk sürümde kompleks muhasebe fişi ve büyük defter yerine operasyonel finans görünümü hedeflenmiştir.
      </p>
    </ERPLayout>
  );
}
