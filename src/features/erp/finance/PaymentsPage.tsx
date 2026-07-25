import { useEffect, useMemo, useState } from "react";
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
import { createFinancialAccount, createPayment, listFinancialAccounts, listPayments, listStakeholders } from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";
import { FinancialAccount, Payment, Stakeholder } from "../shared/types";
import { FINANCIAL_ACCOUNT_TYPE_LABELS, PAYMENT_TYPE_LABELS } from "../shared/statusLabels";

const expenseCategories = ["Malzeme", "Fason", "Nakliye", "Kira", "Enerji", "Bakım", "Genel Gider", "Diğer"];

export default function PaymentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Payment[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "collection" | "payment">("all");
  const [form, setForm] = useState({
    payment_type: "collection" as "collection" | "payment",
    stakeholder_id: "",
    financial_account_id: "",
    amount: "0",
    payment_date: new Date().toISOString().slice(0, 10),
    category: "",
    description: "",
  });
  const [accountForm, setAccountForm] = useState({ account_type: "cash" as FinancialAccount["account_type"], name: "", opening_balance: "0" });

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

  const q = search.toLowerCase();
  const filtered = rows.filter((row) => {
    const stakeholder = row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "" : "";
    const account = row.financial_account_id ? accountNameById[row.financial_account_id] || "" : "";
    return (
      (!q || stakeholder.toLowerCase().includes(q) || account.toLowerCase().includes(q) || (row.description || "").toLowerCase().includes(q)) &&
      (typeFilter === "all" || row.payment_type === typeFilter)
    );
  });
  const collections = filtered.filter((row) => row.payment_type === "collection");
  const payments = filtered.filter((row) => row.payment_type === "payment");
  const transferMovements = filtered.filter((row) => (row.description || "").toLocaleLowerCase("tr-TR").includes("transfer"));
  const pendingExpenses = payments.filter((row) => (row.description || "").toLocaleLowerCase("tr-TR").includes("talep") || !row.financial_account_id);
  const cashAccounts = accounts.filter((account) => account.account_type === "cash");
  const bankAccounts = accounts.filter((account) => account.account_type === "bank");

  const renderPayments = (data: Payment[], empty = "Kayıt bulunamadı") => (
    data.length === 0 ? <EmptyState title={empty} description="Seçili filtreye uygun finans hareketi bulunmuyor." /> : (
      <DataTable
        columns={[
          { key: "type", header: "Tip", render: (row) => PAYMENT_TYPE_LABELS[row.payment_type] },
          { key: "stakeholder", header: "Cari", render: (row) => row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-" },
          { key: "account", header: "Kasa/Banka", render: (row) => row.financial_account_id ? accountNameById[row.financial_account_id] || "-" : "-" },
          { key: "date", header: "Tarih", render: (row) => formatDate(row.payment_date) },
          { key: "amount", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.amount || 0, row.currency || "TRY") },
          { key: "desc", header: "Açıklama/Not", render: (row) => row.description || "-" },
          { key: "invoice", header: "Fatura", render: (row) => row.related_invoice_id || "-" },
        ]}
        data={data}
        rowKey={(row) => row.id}
        emptyMessage={empty}
      />
    )
  );

  return (
    <ERPLayout title="Tahsilat, Ödeme ve Giderler">
      <PageHeader title="Tahsilat, Ödeme ve Giderler" description="Kasa, banka, para girişleri, para çıkışları, gider talepleri ve ödeme durumlarını yönetin." />

      {error ? <MigrationNotice message={error} /> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Kasa Hesabı</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{cashAccounts.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Banka Hesabı</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{bankAccounts.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Para Girişi</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(collections.reduce((sum, row) => sum + Number(row.amount || 0), 0))}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Para Çıkışı</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(payments.reduce((sum, row) => sum + Number(row.amount || 0), 0))}</CardContent></Card>
      </div>

      <FormSection title="Yeni Tahsilat / Ödeme / Gider" description="Para girişi, para çıkışı veya gider talebi kaydı oluşturun.">
        <form
          className="grid gap-3 xl:grid-cols-[140px_1fr_1fr_140px_150px_170px_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const amount = Number(form.amount || 0);
            if (amount <= 0) {
              toast({ title: "Hatalı Değer", description: "Tutar sıfırdan büyük olmalıdır.", variant: "destructive" });
              return;
            }
            setSaving(true);
            const categoryText = form.category ? `Kategori: ${form.category}` : "";
            const result = await createPayment({
              payment_type: form.payment_type,
              stakeholder_id: form.stakeholder_id || null,
              financial_account_id: form.financial_account_id || null,
              amount,
              payment_date: form.payment_date,
              description: [categoryText, form.description].filter(Boolean).join(" - ") || null,
            });
            setSaving(false);
            if (result.error) {
              toast({ title: "Ödeme", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Tahsilat/ödeme kaydı oluşturuldu." });
            setForm({ payment_type: "collection", stakeholder_id: "", financial_account_id: "", amount: "0", payment_date: new Date().toISOString().slice(0, 10), category: "", description: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.payment_type} onChange={(event) => setForm((prev) => ({ ...prev, payment_type: event.target.value as "collection" | "payment" }))}>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.stakeholder_id} onChange={(event) => setForm((prev) => ({ ...prev, stakeholder_id: event.target.value }))}>
            <option value="">Cari seçiniz</option>
            {stakeholders.map((stakeholder) => <option key={stakeholder.id} value={stakeholder.id}>{stakeholder.company_name}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.financial_account_id} onChange={(event) => setForm((prev) => ({ ...prev, financial_account_id: event.target.value }))}>
            <option value="">Kasa/banka seçiniz</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <Input type="number" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} />
          <Input type="date" value={form.payment_date} onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
            <option value="">Gider kategorisi yok</option>
            {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <Input placeholder="Açıklama / not" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        </form>
      </FormSection>

      <FormSection title="Kasa/Banka Hesabı" description="Kasa ve banka hesaplarını finansal hareketler için hazır tutun.">
        <form
          className="grid gap-3 md:grid-cols-[180px_1fr_160px_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!accountForm.name.trim()) {
              toast({ title: "Eksik Bilgi", description: "Hesap adı zorunludur.", variant: "destructive" });
              return;
            }
            const opening = Number(accountForm.opening_balance || 0);
            const result = await createFinancialAccount({
              account_type: accountForm.account_type,
              name: accountForm.name,
              opening_balance: opening,
              current_balance: opening,
            });
            if (result.error) {
              toast({ title: "Finans Hesabı", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Kasa/banka hesabı oluşturuldu." });
            setAccountForm({ account_type: "cash", name: "", opening_balance: "0" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={accountForm.account_type} onChange={(event) => setAccountForm((prev) => ({ ...prev, account_type: event.target.value as FinancialAccount["account_type"] }))}>
            <option value="cash">Kasa</option>
            <option value="bank">Banka</option>
          </select>
          <Input placeholder="Hesap adı" value={accountForm.name} onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))} />
          <Input type="number" step="0.01" value={accountForm.opening_balance} onChange={(event) => setAccountForm((prev) => ({ ...prev, opening_balance: event.target.value }))} />
          <Button type="submit">Hesap Ekle</Button>
        </form>
      </FormSection>

      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <Input placeholder="Cari, hesap veya açıklama ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | "collection" | "payment")}>
          <option value="all">Tüm Hareketler</option>
          {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Button variant="outline" onClick={() => { setSearch(""); setTypeFilter("all"); }}>Temizle</Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Ödeme kayıtları yükleniyor...</p> : (
        <Tabs defaultValue="movements">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="categories">Gider Kategorileri</TabsTrigger>
            <TabsTrigger value="expenses">Gider Kayıtları</TabsTrigger>
            <TabsTrigger value="requests">Gider Talepleri</TabsTrigger>
            <TabsTrigger value="approval">Onay Bekleyen Giderler</TabsTrigger>
            <TabsTrigger value="status">Ödeme Durumları</TabsTrigger>
            <TabsTrigger value="cash">Kasa Hesapları</TabsTrigger>
            <TabsTrigger value="bank">Banka Hesapları</TabsTrigger>
            <TabsTrigger value="movements">Para Hareketleri</TabsTrigger>
            <TabsTrigger value="transfer">Transfer Hareketleri</TabsTrigger>
          </TabsList>
          <TabsContent value="categories">
            <DataTable columns={[
              { key: "category", header: "Gider Kategorisi", render: (row) => row.category },
              { key: "count", header: "Kayıt", className: "text-right", render: (row) => row.count },
              { key: "total", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.total) },
            ]} data={expenseCategories.map((category) => {
              const categoryRows = payments.filter((row) => (row.description || "").includes(`Kategori: ${category}`));
              return { category, count: categoryRows.length, total: categoryRows.reduce((sum, row) => sum + Number(row.amount || 0), 0) };
            })} rowKey={(row) => row.category} emptyMessage="Gider kategorisi yok" />
          </TabsContent>
          <TabsContent value="expenses">{renderPayments(payments, "Gider kaydı yok")}</TabsContent>
          <TabsContent value="requests">{renderPayments(pendingExpenses, "Gider talebi yok")}</TabsContent>
          <TabsContent value="approval">{renderPayments(pendingExpenses, "Onay bekleyen gider yok")}</TabsContent>
          <TabsContent value="status">
            <div className="grid gap-3 md:grid-cols-3">
              <Card><CardHeader><CardTitle className="text-base">Ödenen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{payments.filter((row) => row.financial_account_id).length}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Hesap Bekleyen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{payments.filter((row) => !row.financial_account_id).length}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Talep/Onay Hazır</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{pendingExpenses.length}</CardContent></Card>
            </div>
          </TabsContent>
          <TabsContent value="cash">
            <AccountTable accounts={cashAccounts} />
          </TabsContent>
          <TabsContent value="bank">
            <AccountTable accounts={bankAccounts} />
          </TabsContent>
          <TabsContent value="movements">{renderPayments(filtered, "Para hareketi yok")}</TabsContent>
          <TabsContent value="transfer">{renderPayments(transferMovements, "Transfer hareketi yok")}</TabsContent>
        </Tabs>
      )}
    </ERPLayout>
  );
}

function AccountTable({ accounts }: { accounts: FinancialAccount[] }) {
  return (
    <DataTable
      columns={[
        { key: "type", header: "Hesap Tipi", render: (row) => FINANCIAL_ACCOUNT_TYPE_LABELS[row.account_type] },
        { key: "name", header: "Hesap", render: (row) => row.name },
        { key: "currency", header: "Para Birimi", render: (row) => row.currency },
        { key: "opening", header: "Açılış", className: "text-right", render: (row) => formatCurrency(row.opening_balance || 0, row.currency) },
        { key: "current", header: "Güncel", className: "text-right", render: (row) => formatCurrency(row.current_balance || 0, row.currency) },
        { key: "status", header: "Durum", render: (row) => row.is_active ? <StatusBadge label="Aktif" tone="success" /> : <StatusBadge label="Pasif" tone="muted" /> },
      ]}
      data={accounts}
      rowKey={(row) => row.id}
      emptyMessage="Hesap kaydı yok"
    />
  );
}
