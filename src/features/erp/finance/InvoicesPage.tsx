import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { createInvoice, listInvoices, listStakeholders } from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Invoice, Stakeholder } from "../shared/types";

function tone(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "partial") return "warning" as const;
  return "default" as const;
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ invoice_type: "sales" as "sales" | "purchase", invoice_no: "", stakeholder_id: "", invoice_date: new Date().toISOString().slice(0, 10), grand_total: "0" });

  const load = async () => {
    setLoading(true);
    const [invoiceResult, stakeholderResult] = await Promise.all([listInvoices(), listStakeholders()]);
    if (invoiceResult.error) {
      setError(invoiceResult.error);
      toast({ title: "Hata", description: `Faturalar yüklenemedi: ${invoiceResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(invoiceResult.data);
    setStakeholders(stakeholderResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  return (
    <ERPLayout title="Fatura Takibi">
      <PageHeader
        title="Fatura Takibi"
        description="Satış ve alış faturalarını durum bazlı takip edin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Fatura" description="Ön muhasebe için basit satış/alış faturası kaydı oluşturun.">
        <form
          className="grid gap-3 md:grid-cols-[160px_1fr_1fr_160px_160px_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const grandTotal = Number(form.grand_total || 0);
            const result = await createInvoice({
              invoice_type: form.invoice_type,
              invoice_no: form.invoice_no || null,
              stakeholder_id: form.stakeholder_id || null,
              invoice_date: form.invoice_date,
              subtotal: grandTotal,
              grand_total: grandTotal,
            });
            if (result.error) {
              toast({ title: "Fatura", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Fatura kaydı oluşturuldu." });
            setForm({ invoice_type: "sales", invoice_no: "", stakeholder_id: "", invoice_date: new Date().toISOString().slice(0, 10), grand_total: "0" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.invoice_type} onChange={(event) => setForm((prev) => ({ ...prev, invoice_type: event.target.value as "sales" | "purchase" }))}>
            <option value="sales">Satış</option>
            <option value="purchase">Alış</option>
          </select>
          <Input placeholder="Fatura no" value={form.invoice_no} onChange={(event) => setForm((prev) => ({ ...prev, invoice_no: event.target.value }))} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.stakeholder_id} onChange={(event) => setForm((prev) => ({ ...prev, stakeholder_id: event.target.value }))}>
            <option value="">Paydaş seçiniz</option>
            {stakeholders.map((stakeholder) => (
              <option key={stakeholder.id} value={stakeholder.id}>
                {stakeholder.company_name}
              </option>
            ))}
          </select>
          <Input type="date" value={form.invoice_date} onChange={(event) => setForm((prev) => ({ ...prev, invoice_date: event.target.value }))} />
          <Input type="number" step="0.01" value={form.grand_total} onChange={(event) => setForm((prev) => ({ ...prev, grand_total: event.target.value }))} />
          <Button type="submit">Kaydet</Button>
        </form>
      </FormSection>

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
