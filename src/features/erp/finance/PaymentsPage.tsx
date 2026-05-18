import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { createPayment, listFinancialAccounts, listPayments, listStakeholders } from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { FinancialAccount, Payment, Stakeholder } from "../shared/types";
import { PAYMENT_TYPE_LABELS } from "../shared/statusLabels";

export default function PaymentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Payment[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ payment_type: "collection" as "collection" | "payment", stakeholder_id: "", financial_account_id: "", amount: "0", payment_date: new Date().toISOString().slice(0, 10), description: "" });

  const stakeholderNameById = useMemo(() => Object.fromEntries(stakeholders.map((item) => [item.id, item.company_name])), [stakeholders]);
  const accountNameById = useMemo(() => Object.fromEntries(accounts.map((item) => [item.id, item.name])), [accounts]);

  const load = async () => {
    setLoading(true);
    const [paymentResult, stakeholderResult, accountResult] = await Promise.all([listPayments(), listStakeholders(), listFinancialAccounts()]);
    if (paymentResult.error) {
      setError(paymentResult.error);
      toast({ title: "Hata", description: `Ödeme verisi yüklenemedi: ${paymentResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(paymentResult.data);
    setStakeholders(stakeholderResult.data);
    setAccounts(accountResult.data);
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
          className="grid gap-3 md:grid-cols-[150px_1fr_1fr_140px_150px_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const amount = Number(form.amount || 0);
            if (amount <= 0) {
              toast({ title: "Hatalı Değer", description: "Tutar sıfırdan büyük olmalıdır.", variant: "destructive" });
              return;
            }
            setSaving(true);
            const result = await createPayment({
              payment_type: form.payment_type,
              stakeholder_id: form.stakeholder_id || null,
              financial_account_id: form.financial_account_id || null,
              amount,
              payment_date: form.payment_date,
              description: form.description || null,
            });
            if (result.error) {
              toast({ title: "Ödeme", description: result.error, variant: "destructive" });
              setSaving(false);
              return;
            }
            toast({ title: "Kaydedildi", description: "Tahsilat/ödeme kaydı oluşturuldu." });
            setForm({ payment_type: "collection", stakeholder_id: "", financial_account_id: "", amount: "0", payment_date: new Date().toISOString().slice(0, 10), description: "" });
            await load();
            setSaving(false);
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.payment_type} onChange={(event) => setForm((prev) => ({ ...prev, payment_type: event.target.value as "collection" | "payment" }))}>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.stakeholder_id} onChange={(event) => setForm((prev) => ({ ...prev, stakeholder_id: event.target.value }))}>
            <option value="">Paydaş seçiniz</option>
            {stakeholders.map((stakeholder) => (
              <option key={stakeholder.id} value={stakeholder.id}>
                {stakeholder.company_name}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.financial_account_id} onChange={(event) => setForm((prev) => ({ ...prev, financial_account_id: event.target.value }))}>
            <option value="">Finans hesabı seçiniz</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <Input type="number" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} />
          <Input type="date" value={form.payment_date} onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))} />
          <Input placeholder="Açıklama" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Ödeme kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Ödeme kaydı yok" description="Henüz tahsilat/ödeme kaydı bulunmuyor." />
      ) : (
        <DataTable
          columns={[
            { key: "type", header: "Tip", render: (row) => PAYMENT_TYPE_LABELS[row.payment_type] },
            { key: "stakeholder", header: "Paydaş", render: (row) => (row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-") },
            { key: "account", header: "Hesap", render: (row) => (row.financial_account_id ? accountNameById[row.financial_account_id] || "-" : "-") },
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
