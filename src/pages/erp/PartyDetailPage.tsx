import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { PartySummaryCards } from "@/components/erp/party/PartySummaryCards";
import { PartyTabs } from "@/components/erp/party/PartyTabs";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import { calculatePartyFinancialSummary } from "@/lib/finance/calculateBalance";
import type { FinancialTransaction, Party, PartyFinancialSummary, PartyNote, PaymentDocument } from "@/lib/finance/financeTypes";
import { getPaymentDocuments } from "@/services/financeService";
import { getPartyById, getPartyNotes, getPartyTransactions } from "@/services/partiesService";

type PartyDetailPageProps = {
  mode: "customer" | "supplier";
};

const emptySummary: PartyFinancialSummary = {
  totalDebit: 0,
  totalCredit: 0,
  totalPayment: 0,
  currentBalance: 0,
  officialBalance: 0,
  operationalBalance: 0,
  lastTransactionDate: null,
  statusLabel: "Kapalı",
};

export default function PartyDetailPage({ mode }: PartyDetailPageProps) {
  const { id } = useParams();
  const [party, setParty] = useState<Party | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentDocument[]>([]);
  const [notes, setNotes] = useState<PartyNote[]>([]);
  const [summary, setSummary] = useState<PartyFinancialSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = mode === "customer" ? "/erp/musteriler" : "/erp/tedarikciler";
  const title = mode === "customer" ? "Müşteri Kartı" : "Tedarikçi Kartı";

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const [partyResult, transactionResult, paymentResult, noteResult] = await Promise.all([
        getPartyById(id),
        getPartyTransactions(id),
        getPaymentDocuments({ partyId: id }),
        getPartyNotes(id),
      ]);

      setParty(partyResult.data);
      setTransactions(transactionResult.data);
      setPayments(paymentResult.data);
      setNotes(noteResult.data);
      setSummary(calculatePartyFinancialSummary(transactionResult.data));
      setError(partyResult.error || transactionResult.error || paymentResult.error || noteResult.error);
      setLoading(false);
    };

    load();
  }, [id]);

  return (
    <ERPLayout title={title}>
      <PageHeader
        title={party?.title || title}
        description={mode === "customer" ? "Müşteri profili, siparişleri, teklifleri ve finans hareketleri." : "Tedarikçi profili, satın alma ve ödeme takibi."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to={basePath}>
                <ArrowLeft className="h-4 w-4" />
                Liste
              </Link>
            </Button>
            {party ? (
              <>
                <Button asChild variant="outline" className="gap-2">
                  <Link to={`${basePath}/${party.id}/duzenle`}>
                    <Pencil className="h-4 w-4" />
                    Düzenle
                  </Link>
                </Button>
                <Button asChild className="gap-2">
                  <Link to={`/erp/finans/hareketler/yeni?partyId=${party.id}`}>
                    <PlusCircle className="h-4 w-4" />
                    Yeni Finans Hareketi
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {error ? <MigrationNotice message={error} /> : null}

      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Cari kart yükleniyor...</CardContent>
        </Card>
      ) : !party ? (
        <EmptyState title="Cari kart bulunamadı" description="Kayıt silinmiş, pasifleştirilmiş veya erişim izniniz olmayabilir." />
      ) : (
        <>
          <PartySummaryCards summary={summary} mode={mode} />
          <PartyTabs party={party} mode={mode} transactions={transactions} payments={payments} notes={notes} />
        </>
      )}
    </ERPLayout>
  );
}
