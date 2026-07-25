import { useParams } from "react-router-dom";
import { ExpenseDetailPage as ExpenseDetailView } from "@/features/finance/FinanceExpensePages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function ExpenseDetailPage() {
  const { expenseId } = useParams<{ expenseId: string }>();
  usePageTitle(expenseId ? `Gider ${expenseId}` : "Gider Bulunamadı");
  return <ExpenseDetailView expenseId={expenseId} />;
}
