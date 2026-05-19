import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import { ACCOUNT_TYPE_LABELS, formatMoney, PAYMENT_METHOD_LABELS, TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/finance/financeLabels";
import type { FinancialTransaction } from "@/lib/finance/financeTypes";
import { getFinancialTransactionById } from "@/services/financeService";

export default function FinanceTransactionDetailPage() {
  const { id } = useParams();
  const [transaction, setTransaction] = useState<FinancialTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const result = await getFinancialTransactionById(id);
      setTransaction(result.data);
      setError(result.error);
      setLoading(false);
    };
    load();
  }, [id]);

  return (
    <ERPLayout title="Finans Hareketi">
      <PageHeader
        title="Finans Hareketi"
        description="Cari hesap hareketi detayları."
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
          <CardContent className="py-8 text-sm text-muted-foreground">Hareket yükleniyor...</CardContent>
        </Card>
      ) : !transaction ? (
        <EmptyState title="Finans hareketi bulunamadı" description="Kayıt silinmiş, pasifleştirilmiş veya erişim izniniz olmayabilir." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{transaction.party?.title || "Cari hareket"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <Info label="Tarih" value={new Intl.DateTimeFormat("tr-TR").format(new Date(transaction.transaction_date))} />
            <Info label="Tip" value={TRANSACTION_TYPE_LABELS[transaction.transaction_type]} />
            <Info label="Hesap Tipi" value={ACCOUNT_TYPE_LABELS[transaction.account_type]} />
            <Info label="Ödeme Yöntemi" value={transaction.payment_method ? PAYMENT_METHOD_LABELS[transaction.payment_method] : "-"} />
            <Info label="Tutar" value={formatMoney(transaction.amount, transaction.currency)} />
            <div>
              <p className="text-muted-foreground">Durum</p>
              <div className="mt-1">
                <StatusBadge label={TRANSACTION_STATUS_LABELS[transaction.status]} />
              </div>
            </div>
            <Info label="Referans No" value={transaction.reference_no} />
            <Info label="Vade Tarihi" value={transaction.due_date ? new Intl.DateTimeFormat("tr-TR").format(new Date(transaction.due_date)) : "-"} />
            <Info label="Açıklama" value={transaction.description} wide />
          </CardContent>
        </Card>
      )}
    </ERPLayout>
  );
}

function Info({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value || "-"}</p>
    </div>
  );
}
