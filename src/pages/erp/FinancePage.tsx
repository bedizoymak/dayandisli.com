import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileBarChart, Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { AccountTypeSelector } from "@/components/erp/finance/AccountTypeSelector";
import { FinanceSummaryCards } from "@/components/erp/finance/FinanceSummaryCards";
import { FinanceTransactionTable } from "@/components/erp/finance/FinanceTransactionTable";
import { PaymentDocumentTable } from "@/components/erp/finance/PaymentDocumentTable";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import { calculatePartyFinancialSummary } from "@/lib/finance/calculateBalance";
import { ACCOUNT_TYPE_LABELS, formatMoney } from "@/lib/finance/financeLabels";
import type { AccountType, FinanceDashboardSummary, FinancialTransaction, Party, PaymentDocument } from "@/lib/finance/financeTypes";
import { getFinanceDashboardSummary, getFinancialTransactions, getPaymentDocuments } from "@/services/financeService";
import { getParties } from "@/services/partiesService";

const emptySummary: FinanceDashboardSummary = {
  totalReceivable: 0,
  totalPayable: 0,
  collected: 0,
  paid: 0,
  pendingPayments: 0,
  overduePayments: 0,
  officialBalance: 0,
  operationalBalance: 0,
};

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceDashboardSummary>(emptySummary);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [documents, setDocuments] = useState<PaymentDocument[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("official");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [summaryResult, transactionResult, documentResult, partyResult] = await Promise.all([
        getFinanceDashboardSummary(),
        getFinancialTransactions(),
        getPaymentDocuments(),
        getParties({ type: "all" }),
      ]);

      setSummary(summaryResult.data);
      setTransactions(transactionResult.data);
      setDocuments(documentResult.data);
      setParties(partyResult.data);
      setError(summaryResult.error || transactionResult.error || documentResult.error || partyResult.error);
      setLoading(false);
    };

    load();
  }, []);

  const selectedParty = parties.find((party) => party.id === selectedPartyId) || null;
  const q = search.toLocaleLowerCase("tr-TR");
  const filteredTransactions = transactions.filter((transaction) => {
    const partyTitle = transaction.party?.title || parties.find((party) => party.id === transaction.party_id)?.title || "";
    return (
      !q ||
      partyTitle.toLocaleLowerCase("tr-TR").includes(q) ||
      (transaction.reference_no || "").toLocaleLowerCase("tr-TR").includes(q) ||
      (transaction.description || "").toLocaleLowerCase("tr-TR").includes(q)
    );
  });
  const selectedPartySummary = useMemo(
    () => calculatePartyFinancialSummary(transactions.filter((transaction) => transaction.party_id === selectedPartyId)),
    [selectedPartyId, transactions],
  );

  return (
    <ERPLayout title="Finans">
      <PageHeader
        title="Finans"
        description="Cari hesap, resmi hesap ve operasyonel takip hareketleri."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2">
              <Link to="/finans/hareketler/yeni">
                <Plus className="h-4 w-4" />
                Finans Hareketi Ekle
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/finans/raporlar">
                <FileBarChart className="h-4 w-4" />
                Raporlar
              </Link>
            </Button>
          </div>
        }
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FinanceSummaryCards summary={summary} />

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_220px_auto]">
          <Input placeholder="Cari, referans veya açıklama ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={accountType} onChange={(event) => setAccountType(event.target.value as AccountType)}>
            <option value="official">Resmi Hesap</option>
            <option value="operational">Operasyonel Takip</option>
          </select>
          <Button variant="outline" onClick={() => setSearch("")}>Temizle</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="transactions">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="chart">Hesap Planı</TabsTrigger>
          <TabsTrigger value="vouchers">Muhasebe Fişleri</TabsTrigger>
          <TabsTrigger value="journal">Yevmiye Kayıtları</TabsTrigger>
          <TabsTrigger value="transactions">Finansal Hareketler</TabsTrigger>
          <TabsTrigger value="parties">Cari Hesaplar</TabsTrigger>
          <TabsTrigger value="periods">Dönemsel Hareketler</TabsTrigger>
        </TabsList>
        <TabsContent value="chart">
          <DataTable
            columns={[
              { key: "code", header: "Hesap Kodu", render: (row) => row.code },
              { key: "name", header: "Hesap Adı", render: (row) => row.name },
              { key: "type", header: "Hesap Tipi", render: (row) => row.type },
              { key: "source", header: "Kaynak", render: (row) => row.source },
            ]}
            data={[
              { code: "100", name: "Kasa", type: "Varlık", source: "Kasa hesapları" },
              { code: "102", name: "Bankalar", type: "Varlık", source: "Banka hesapları" },
              { code: "120", name: "Alıcılar", type: "Cari", source: "Müşteri cari hesapları" },
              { code: "320", name: "Satıcılar", type: "Cari", source: "Tedarikçi cari hesapları" },
              { code: "600", name: "Yurt İçi Satışlar", type: "Gelir", source: "Satış faturaları" },
              { code: "770", name: "Genel Yönetim Giderleri", type: "Gider", source: "Gider kayıtları" },
            ]}
            rowKey={(row) => row.code}
            emptyMessage="Hesap planı yok"
          />
        </TabsContent>
        <TabsContent value="vouchers">
          <DataTable
            columns={[
              { key: "ref", header: "Fiş No", render: (row) => row.reference_no || row.id.slice(0, 8) },
              { key: "party", header: "Cari", render: (row) => row.party?.title || parties.find((party) => party.id === row.party_id)?.title || "-" },
              { key: "date", header: "Tarih", render: (row) => row.transaction_date },
              { key: "status", header: "Durum", render: (row) => row.status === "completed" ? "Tamamlandı" : row.status === "cancelled" ? "İptal" : row.status === "planned" ? "Planlandı" : "Bekliyor" },
              { key: "amount", header: "Tutar", className: "text-right", render: (row) => formatMoney(row.amount, row.currency) },
            ]}
            data={filteredTransactions}
            rowKey={(row) => row.id}
            emptyMessage="Muhasebe fişi yok"
          />
        </TabsContent>
        <TabsContent value="journal">
          <DataTable
            columns={[
              { key: "date", header: "Yevmiye Tarihi", render: (row) => row.transaction_date },
              { key: "desc", header: "Açıklama", render: (row) => row.description || "-" },
              { key: "debit", header: "Borç", className: "text-right", render: (row) => row.transaction_type === "debit" ? formatMoney(row.amount, row.currency) : "-" },
              { key: "credit", header: "Alacak", className: "text-right", render: (row) => row.transaction_type === "credit" ? formatMoney(row.amount, row.currency) : "-" },
              { key: "method", header: "Ödeme Yöntemi", render: (row) => row.payment_method || "-" },
            ]}
            data={filteredTransactions}
            rowKey={(row) => row.id}
            emptyMessage="Yevmiye kaydı yok"
          />
        </TabsContent>
        <TabsContent value="transactions">
          {filteredTransactions.length ? (
            <FinanceTransactionTable transactions={filteredTransactions} />
          ) : (
            <EmptyState icon={<ReceiptText className="h-5 w-5" />} title="Finans hareketi yok" description="Arama veya filtreye uygun hareket bulunamadı." />
          )}
        </TabsContent>
        <TabsContent value="parties">
          <DataTable
            columns={[
              { key: "title", header: "Cari", render: (row) => row.title },
              { key: "type", header: "Tip", render: (row) => row.party_type === "supplier" ? "Tedarikçi" : row.party_type === "both" ? "Müşteri/Tedarikçi" : "Müşteri" },
              { key: "balance", header: "Bakiye", className: "text-right", render: (row) => formatMoney(calculatePartyFinancialSummary(transactions.filter((transaction) => transaction.party_id === row.id)).currentBalance, row.currency) },
              { key: "status", header: "Durum", render: (row) => row.is_active ? "Aktif" : "Pasif" },
            ]}
            data={parties}
            rowKey={(row) => row.id}
            emptyMessage="Cari hesap yok"
          />
        </TabsContent>
        <TabsContent value="periods">
          <DataTable
            columns={[
              { key: "period", header: "Dönem", render: (row) => row.period },
              { key: "count", header: "Hareket", className: "text-right", render: (row) => row.count },
              { key: "in", header: "Giriş", className: "text-right", render: (row) => formatMoney(row.incoming) },
              { key: "out", header: "Çıkış", className: "text-right", render: (row) => formatMoney(row.outgoing) },
            ]}
            data={Object.values(filteredTransactions.reduce<Record<string, { period: string; count: number; incoming: number; outgoing: number }>>((acc, transaction) => {
              const period = (transaction.transaction_date || "").slice(0, 7) || "Tarihsiz";
              if (!acc[period]) acc[period] = { period, count: 0, incoming: 0, outgoing: 0 };
              acc[period].count += 1;
              if (transaction.direction === "in") acc[period].incoming += Number(transaction.amount || 0);
              else acc[period].outgoing += Number(transaction.amount || 0);
              return acc;
            }, {}))}
            rowKey={(row) => row.period}
            emptyMessage="Dönemsel hareket yok"
          />
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Cari Hesap Seçimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedPartyId} onChange={(event) => setSelectedPartyId(event.target.value)}>
              <option value="">Müşteri veya tedarikçi seçin</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.title} · {party.party_type === "supplier" ? "Tedarikçi" : party.party_type === "both" ? "Müşteri/Tedarikçi" : "Müşteri"}
                </option>
              ))}
            </select>
            <AccountTypeSelector value={accountType} onChange={setAccountType} />
            {parties.length === 0 && !loading ? (
              <EmptyState
                title="Cari kart bulunamadı"
                description="Finans işlemleri için önce Müşteriler modülünden customer_full kayıtlarını getirin veya yeni müşteri/tedarikçi oluşturun."
                action={
                  <Button asChild>
                    <Link to="/musteriler">Müşterileri Getir</Link>
                  </Button>
                }
              />
            ) : selectedParty ? (
              <div className="rounded-lg border bg-background p-4 text-sm">
                <p className="font-semibold">{selectedParty.title}</p>
                <p className="mt-1 text-muted-foreground">{selectedParty.contact_name || "İlgili kişi girilmemiş"}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Hesap Tipi</p>
                    <p className="font-medium">{ACCOUNT_TYPE_LABELS[accountType]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Güncel Bakiye</p>
                    <p className="font-medium">{formatMoney(selectedPartySummary.currentBalance, selectedParty.currency)}</p>
                  </div>
                </div>
                <Button asChild className="mt-4 w-full gap-2">
                  <Link to={`/finans/hareketler/yeni?partyId=${selectedParty.id}`}>
                    <Plus className="h-4 w-4" />
                    Bu Cari İçin Hareket Ekle
                  </Link>
                </Button>
              </div>
            ) : (
              <EmptyState title="Cari seçilmedi" description="Müşteri veya tedarikçi seçerek hesap özetini görüntüleyin." />
            )}
          </CardContent>
        </Card>

        <section className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Son Finans Hareketleri</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/finans/hareketler">Tümünü Gör</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Finans hareketleri yükleniyor...</p>
              ) : transactions.length ? (
                <FinanceTransactionTable transactions={transactions.slice(0, 8)} />
              ) : (
                <EmptyState icon={<ReceiptText className="h-5 w-5" />} title="Finans hareketi yok" description="Henüz cari hesap hareketi kaydedilmemiş." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Çek/Senet Listesi</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/finans/cekler">Tümünü Gör</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {documents.length ? (
                <PaymentDocumentTable documents={documents.slice(0, 6)} />
              ) : (
                <EmptyState title="Ödeme dokümanı yok" description="Çek, senet veya dekont kaydı oluştuğunda burada listelenir." />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </ERPLayout>
  );
}
