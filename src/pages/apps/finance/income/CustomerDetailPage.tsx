import { useParams } from "react-router-dom";
import { FinanceCustomerDetailPage } from "@/features/finance/FinanceIncomePages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  usePageTitle(customerId ? `Müşteri ${customerId}` : "Müşteri Bulunamadı");
  return <FinanceCustomerDetailPage customerId={customerId} />;
}
