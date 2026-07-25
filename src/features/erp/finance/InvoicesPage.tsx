import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { createInvoice, listInvoices, listSalesOrders, listStakeholders, updateInvoice } from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { Invoice, InvoiceStatus, SalesOrder, Stakeholder } from "../shared/types";
import { INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS } from "../shared/statusLabels";

function tone(status: InvoiceStatus) {
  if (status === "paid") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "partial" || status === "issued") return "warning" as const;
  return "default" as const;
}

const today = new Date().toISOString().slice(0, 10);

export default function InvoicesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "sales" | "purchase">("all");
  const [form, setForm] = useState({
    invoice_type: "sales" as "sales" | "purchase",
    invoice_no: "",
    stakeholder_id: "",
    order_id: "",
    invoice_date: today,
    due_date: "",
    grand_total: "0",
    notes: "",
  });

  const stakeholderNameById = useMemo(() => Object.fromEntries(stakeholders.map((item) => [item.id, item.company_name])), [stakeholders]);
  const orderNameById = useMemo(() => Object.fromEntries(orders.map((item) => [item.id, `${item.order_no} - ${item.title}`])), [orders]);

  const load = async () => {
    setLoading(true);
    const [invoiceResult, stakeholderResult, orderResult] = await Promise.all([listInvoices(), listStakeholders(), listSalesOrders()]);
    if (invoiceResult.error) {
      setError(invoiceResult.error);
      toast({ title: "Hata", description: `Faturalar yüklenemedi: ${invoiceResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(invoiceResult.data);
    setStakeholders(stakeholderResult.data);
    setOrders(orderResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  const q = search.toLowerCase();
  const filtered = rows.filter((row) => {
    const stakeholder = row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "" : "";
    return (
      (!q || (row.invoice_no || "").toLowerCase().includes(q) || stakeholder.toLowerCase().includes(q) || (row.notes || "").toLowerCase().includes(q)) &&
      (typeFilter === "all" || row.invoice_type === typeFilter)
    );
  });
  const byStatus = (status: InvoiceStatus) => filtered.filter((row) => row.status === status);
  const overdue = filtered.filter((row) => row.due_date && row.due_date < today && !["paid", "cancelled"].includes(row.status));
  const issued = filtered.filter((row) => row.status === "issued" || row.status === "partial");
  const totals = {
    all: filtered.reduce((sum, row) => sum + Number(row.grand_total || 0), 0),
    overdue: overdue.reduce((sum, row) => sum + Number(row.grand_total || 0), 0),
  };

  const renderTable = (data: Invoice[]) => (
    data.length === 0 ? (
      <EmptyState title="Fatura kaydı yok" description="Seçili filtreye uygun fatura bulunmuyor." />
    ) : (
      <DataTable
        columns={[
          { key: "no", header: "Fatura No", render: (row) => row.invoice_no || "-" },
          { key: "type", header: "Tip", render: (row) => INVOICE_TYPE_LABELS[row.invoice_type] },
          { key: "stakeholder", header: "Cari", render: (row) => row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-" },
          { key: "order", header: "Sipariş Bağı", render: (row) => row.notes?.startsWith("Sipariş:") ? row.notes.split("\n")[0].replace("Sipariş:", "").trim() : "-" },
          { key: "date", header: "Tarih", render: (row) => formatDate(row.invoice_date) },
          { key: "due", header: "Vade", render: (row) => formatDate(row.due_date) },
          { key: "total", header: "Toplam", className: "text-right", render: (row) => formatCurrency(row.grand_total || 0, row.currency || "TRY") },
          { key: "status", header: "Durum", render: (row) => <StatusBadge label={INVOICE_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
          {
            key: "action",
            header: "Durum Güncelle",
            className: "text-right",
            render: (row) => (
              <select
                className="h-9 rounded-md border bg-background px-2 text-xs"
                value={row.status}
                onChange={async (event) => {
                  const result = await updateInvoice(row.id, { status: event.target.value as InvoiceStatus });
                  if (result.error) {
                    toast({ title: "Fatura", description: result.error, variant: "destructive" });
                    return;
                  }
                  await load();
                }}
              >
                {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ),
          },
        ]}
        data={data}
        rowKey={(row) => row.id}
        emptyMessage="Fatura bulunamadı"
      />
    )
  );

  return (
    <ERPLayout title="Fatura Takibi">
      <PageHeader title="Fatura Takibi" description="Satış ve alış faturalarını yaşam döngüsü, cari ve sipariş bağlantılarıyla takip edin." />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Fatura" description="Satış veya alış faturası oluşturun; sipariş bağlantısı varsa not alanına işlenir.">
        <form
          className="grid gap-3 xl:grid-cols-[140px_150px_1fr_1fr_150px_150px_140px_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const grandTotal = Number(form.grand_total || 0);
            if (grandTotal < 0) {
              toast({ title: "Hatalı Değer", description: "Fatura tutarı sıfır veya üzeri olmalıdır.", variant: "destructive" });
              return;
            }
            setSaving(true);
            const orderNote = form.order_id ? `Sipariş: ${orderNameById[form.order_id] || form.order_id}` : "";
            const result = await createInvoice({
              invoice_type: form.invoice_type,
              invoice_no: form.invoice_no || null,
              stakeholder_id: form.stakeholder_id || null,
              invoice_date: form.invoice_date,
              due_date: form.due_date || null,
              subtotal: grandTotal,
              grand_total: grandTotal,
              notes: [orderNote, form.notes].filter(Boolean).join("\n") || null,
            });
            setSaving(false);
            if (result.error) {
              toast({ title: "Fatura", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Fatura kaydı oluşturuldu." });
            setForm({ invoice_type: "sales", invoice_no: "", stakeholder_id: "", order_id: "", invoice_date: today, due_date: "", grand_total: "0", notes: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.invoice_type} onChange={(event) => setForm((prev) => ({ ...prev, invoice_type: event.target.value as "sales" | "purchase" }))}>
            {Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Input placeholder="Fatura no" value={form.invoice_no} onChange={(event) => setForm((prev) => ({ ...prev, invoice_no: event.target.value }))} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.stakeholder_id} onChange={(event) => setForm((prev) => ({ ...prev, stakeholder_id: event.target.value }))}>
            <option value="">Cari seçiniz</option>
            {stakeholders.map((stakeholder) => <option key={stakeholder.id} value={stakeholder.id}>{stakeholder.company_name}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.order_id} onChange={(event) => setForm((prev) => ({ ...prev, order_id: event.target.value }))}>
            <option value="">Sipariş bağlantısı yok</option>
            {orders.map((order) => <option key={order.id} value={order.id}>{order.order_no} - {order.title}</option>)}
          </select>
          <Input type="date" value={form.invoice_date} onChange={(event) => setForm((prev) => ({ ...prev, invoice_date: event.target.value }))} />
          <Input type="date" value={form.due_date} onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))} />
          <Input type="number" step="0.01" value={form.grand_total} onChange={(event) => setForm((prev) => ({ ...prev, grand_total: event.target.value }))} />
          <Input placeholder="Not" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        </form>
      </FormSection>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Toplam Fatura</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{filtered.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Fatura Tutarı</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(totals.all)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Geciken Fatura</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{overdue.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Geciken Tutar</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(totals.overdue)}</CardContent></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <Input placeholder="Fatura no, cari veya not ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | "sales" | "purchase")}>
          <option value="all">Tüm Fatura Tipleri</option>
          {Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button variant="outline" onClick={() => { setSearch(""); setTypeFilter("all"); }}>Temizle</Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Faturalar yükleniyor...</p> : (
        <Tabs defaultValue="all">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="all">Faturalar</TabsTrigger>
            <TabsTrigger value="draft">Taslak Faturalar</TabsTrigger>
            <TabsTrigger value="issued">Gönderilen Faturalar</TabsTrigger>
            <TabsTrigger value="paid">Tahsil Edilen Faturalar</TabsTrigger>
            <TabsTrigger value="overdue">Geciken Faturalar</TabsTrigger>
            <TabsTrigger value="cancelled">İptal Edilen Faturalar</TabsTrigger>
          </TabsList>
          <TabsContent value="all">{renderTable(filtered)}</TabsContent>
          <TabsContent value="draft">{renderTable(byStatus("draft"))}</TabsContent>
          <TabsContent value="issued">{renderTable(issued)}</TabsContent>
          <TabsContent value="paid">{renderTable(byStatus("paid"))}</TabsContent>
          <TabsContent value="overdue">{renderTable(overdue)}</TabsContent>
          <TabsContent value="cancelled">{renderTable(byStatus("cancelled"))}</TabsContent>
        </Tabs>
      )}
    </ERPLayout>
  );
}
