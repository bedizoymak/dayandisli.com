import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { PaymentDocumentTable } from "@/components/erp/finance/PaymentDocumentTable";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import type { PaymentDocument } from "@/lib/finance/financeTypes";
import { getPaymentDocuments } from "@/services/financeService";

export default function PaymentDocumentsPage() {
  const [documents, setDocuments] = useState<PaymentDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getPaymentDocuments();
      setDocuments(result.data);
      setError(result.error);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <ERPLayout title="Çekler ve Senetler">
      <PageHeader title="Çekler ve Senetler" description="Vade, banka, tutar ve bağlı firma takibi." />
      {error ? <MigrationNotice message={error} /> : null}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Ödeme dokümanları yükleniyor...</CardContent>
        </Card>
      ) : documents.length ? (
        <PaymentDocumentTable documents={documents} />
      ) : (
        <EmptyState title="Çek veya senet kaydı bulunamadı" description="Çek/senet yöntemli ödeme hareketleri kaydedildiğinde bu liste dolacak." />
      )}
    </ERPLayout>
  );
}
