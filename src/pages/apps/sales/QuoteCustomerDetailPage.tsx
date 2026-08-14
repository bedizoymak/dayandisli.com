import { useParams } from "react-router-dom";
import { QuoteCustomerDetailPage as QuoteCustomerDetailView } from "@/features/sales/QuoteCustomerDetailPage";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function QuoteCustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  usePageTitle(customerId ? `Teklif Müşterisi · ${customerId}` : "Müşteri Bulunamadı");
  return <QuoteCustomerDetailView customerId={customerId} />;
}
