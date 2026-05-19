import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileBarChart, Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
              <Link to="/erp/finans/hareketler/yeni">
                <Plus className="h-4 w-4" />
                Finans Hareketi Ekle
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/erp/finans/raporlar">
                <FileBarChart className="h-4 w-4" />
                Raporlar
              </Link>
            </Button>
          </div>
        }
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FinanceSummaryCards summary={summary} />

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
            {selectedParty ? (
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
                  <Link to={`/erp/finans/hareketler/yeni?partyId=${selectedParty.id}`}>
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
                <Link to="/erp/finans/hareketler">Tümünü Gör</Link>
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
                <Link to="/erp/finans/cekler">Tümünü Gör</Link>
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
