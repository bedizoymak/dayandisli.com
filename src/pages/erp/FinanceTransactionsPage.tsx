import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/EmptyState";
import { FilterDrawer } from "@/components/erp/FilterDrawer";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { FinanceTransactionTable } from "@/components/erp/finance/FinanceTransactionTable";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import type { AccountType, FinancialTransaction, TransactionStatus } from "@/lib/finance/financeTypes";
import { getFinancialTransactions } from "@/services/financeService";

export default function FinanceTransactionsPage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [accountType, setAccountType] = useState<AccountType | "all">("all");
  const [status, setStatus] = useState<TransactionStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getFinancialTransactions({ accountType, status });
      setTransactions(result.data);
      setError(result.error);
      setLoading(false);
    };
    load();
  }, [accountType, status]);

  const rows = useMemo(() => transactions, [transactions]);

  return (
    <ERPLayout title="Finans Hareketleri">
      <PageHeader
        title="Finans Hareketleri"
        description="Müşteri ve tedarikçi hesap hareketleri."
        actions={
          <Button asChild className="gap-2">
            <Link to="/erp/finans/hareketler/yeni">
              <Plus className="h-4 w-4" />
              Yeni Hareket
            </Link>
          </Button>
        }
      />
      {error ? <MigrationNotice message={error} /> : null}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center">
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={accountType} onChange={(event) => setAccountType(event.target.value as AccountType | "all")}>
            <option value="all">Tüm hesap tipleri</option>
            <option value="official">Resmi Hesap</option>
            <option value="operational">Operasyonel Takip</option>
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as TransactionStatus | "all")}>
            <option value="all">Tüm durumlar</option>
            <option value="planned">Planlandı</option>
            <option value="pending">Bekliyor</option>
            <option value="completed">Tamamlandı</option>
            <option value="cancelled">İptal</option>
          </select>
          <FilterDrawer />
        </CardContent>
      </Card>
      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Finans hareketleri yükleniyor...</CardContent>
        </Card>
      ) : rows.length ? (
        <FinanceTransactionTable transactions={rows} />
      ) : (
        <EmptyState
          icon={<ReceiptText className="h-5 w-5" />}
          title="Finans hareketi bulunamadı"
          description="Filtreleri temizleyebilir veya yeni bir finans hareketi oluşturabilirsiniz."
        />
      )}
    </ERPLayout>
  );
}
