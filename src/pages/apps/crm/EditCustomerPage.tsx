import { useParams } from "react-router-dom";
import { CustomerFormPage } from "@/features/crm/CustomerFormPage";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function EditCustomerPage() {
  const { customerId } = useParams<{ customerId: string }>();
  usePageTitle(customerId ? `Müşteri Düzenle · ${customerId}` : "Müşteri Bulunamadı");
  return <CustomerFormPage edit />;
}
