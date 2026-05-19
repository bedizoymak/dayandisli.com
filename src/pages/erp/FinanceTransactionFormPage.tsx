import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { FinanceTransactionForm } from "@/components/erp/finance/FinanceTransactionForm";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import { useToast } from "@/hooks/use-toast";
import type { Party } from "@/lib/finance/financeTypes";
import { createFinancialTransaction, createPaymentDocument, type FinancialTransactionPayload } from "@/services/financeService";
import { getParties } from "@/services/partiesService";

export default function FinanceTransactionFormPage() {
  const [searchParams] = useSearchParams();
  const initialPartyId = searchParams.get("partyId");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getParties({ type: "all" });
      setParties(result.data);
      setError(result.error);
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async (
    payload: FinancialTransactionPayload,
    paymentDocument?: { document_type: "cheque" | "promissory_note"; document_no: string | null; bank_name: string | null; branch_name: string | null; due_date: string | null },
  ) => {
    setSaving(true);
    const result = await createFinancialTransaction(payload);

    if (result.error || !result.data) {
      setSaving(false);
      toast({ title: "Kayıt Hatası", description: result.error || "Finans hareketi kaydedilemedi.", variant: "destructive" });
      return;
    }

    if (paymentDocument) {
      const documentResult = await createPaymentDocument({
        party_id: payload.party_id,
        transaction_id: result.data.id,
        document_type: paymentDocument.document_type,
        document_no: paymentDocument.document_no,
        bank_name: paymentDocument.bank_name,
        branch_name: paymentDocument.branch_name,
        due_date: paymentDocument.due_date,
        amount: payload.amount,
        currency: payload.currency || "TRY",
      });

      if (documentResult.error) {
        toast({ title: "Ödeme Dokümanı", description: documentResult.error, variant: "destructive" });
      }
    }

    setSaving(false);
    toast({ title: "Kaydedildi", description: "Finans hareketi oluşturuldu." });
    navigate(`/erp/finans/hareketler/${result.data.id}`);
  };

  return (
    <ERPLayout title="Yeni Finans Hareketi">
      <PageHeader
        title="Yeni Finans Hareketi"
        description="Cari hesap hareketi, ödeme yöntemi ve hesap tipi bilgilerini kaydedin."
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/erp/finans/hareketler">
              <ArrowLeft className="h-4 w-4" />
              Hareketler
            </Link>
          </Button>
        }
      />
      {error ? <MigrationNotice message={error} /> : null}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Cari listesi yükleniyor...</CardContent>
        </Card>
      ) : (
        <FinanceTransactionForm parties={parties} initialPartyId={initialPartyId} loading={saving} onSubmit={handleSubmit} />
      )}
    </ERPLayout>
  );
}
