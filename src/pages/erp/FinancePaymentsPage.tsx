import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { FinanceTransactionTable } from "@/components/erp/finance/FinanceTransactionTable";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import type { FinancialTransaction } from "@/lib/finance/financeTypes";
import { getFinancialTransactions } from "@/services/financeService";

export default function FinancePaymentsPage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getFinancialTransactions();
      setTransactions(result.data);
      setError(result.error);
      setLoading(false);
    };
    load();
  }, []);

  const payments = useMemo(() => transactions.filter((row) => row.transaction_type === "payment_in" || row.transaction_type === "payment_out"), [transactions]);

  return (
    <ERPLayout title="Ödemeler">
      <PageHeader
        title="Ödemeler"
        description="Tahsilat ve ödeme hareketleri."
        actions={
          <Button asChild className="gap-2">
            <Link to="/erp/finans/hareketler/yeni">
              <Plus className="h-4 w-4" />
              Yeni Ödeme
            </Link>
          </Button>
        }
      />
      {error ? <MigrationNotice message={error} /> : null}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Ödemeler yükleniyor...</CardContent>
        </Card>
      ) : payments.length ? (
        <FinanceTransactionTable transactions={payments} />
      ) : (
        <EmptyState title="Ödeme kaydı bulunamadı" description="Tahsilat veya ödeme hareketi kaydedildiğinde burada görünür." />
      )}
    </ERPLayout>
  );
}
