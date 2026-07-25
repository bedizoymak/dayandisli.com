import { useParams } from "react-router-dom";
import { CustomerDetailPage } from "@/features/crm/CustomerDetailPage";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function CrmCustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  usePageTitle(customerId ? `Müşteri ${customerId}` : "Müşteri Bulunamadı");
  return <CustomerDetailPage customerId={customerId} />;
}
