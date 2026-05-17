import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { createPayment, listPayments, listStakeholders } from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { Payment, Stakeholder } from "../shared/types";

export default function PaymentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Payment[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ payment_type: "collection" as "collection" | "payment", stakeholder_id: "", amount: "0", payment_date: new Date().toISOString().slice(0, 10), description: "" });

  const load = async () => {
    setLoading(true);
    const [paymentResult, stakeholderResult] = await Promise.all([listPayments(), listStakeholders()]);
    if (paymentResult.error) {
      setError(paymentResult.error);
      toast({ title: "Hata", description: `Ödeme verisi yüklenemedi: ${paymentResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(paymentResult.data);
    setStakeholders(stakeholderResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  return (
    <ERPLayout title="Tahsilat ve Ödemeler">
      <PageHeader
        title="Tahsilat ve Ödemeler"
        description="Kasa/banka hareketlerini ve cari ödeme kayıtlarını izleyin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Tahsilat / Ödeme" description="Ön muhasebe için basit para hareketi kaydı oluşturun.">
        <form
          className="grid gap-3 md:grid-cols-[160px_1fr_160px_160px_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await createPayment({
              payment_type: form.payment_type,
              stakeholder_id: form.stakeholder_id || null,
              amount: Number(form.amount || 0),
              payment_date: form.payment_date,
              description: form.description || null,
            });
            if (result.error) {
              toast({ title: "Ödeme", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Tahsilat/ödeme kaydı oluşturuldu." });
            setForm({ payment_type: "collection", stakeholder_id: "", amount: "0", payment_date: new Date().toISOString().slice(0, 10), description: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.payment_type} onChange={(event) => setForm((prev) => ({ ...prev, payment_type: event.target.value as "collection" | "payment" }))}>
            <option value="collection">Tahsilat</option>
            <option value="payment">Ödeme</option>
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.stakeholder_id} onChange={(event) => setForm((prev) => ({ ...prev, stakeholder_id: event.target.value }))}>
            <option value="">Paydaş seçiniz</option>
            {stakeholders.map((stakeholder) => (
              <option key={stakeholder.id} value={stakeholder.id}>
                {stakeholder.company_name}
              </option>
            ))}
          </select>
          <Input type="number" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} />
          <Input type="date" value={form.payment_date} onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))} />
          <Input placeholder="Açıklama" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          <Button type="submit">Kaydet</Button>
        </form>
      </FormSection>

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
