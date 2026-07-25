import { useParams } from "react-router-dom";
import { SupplierDetailPage as SupplierDetailView } from "@/features/finance/OperationsPages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  usePageTitle(supplierId ? `Tedarikçi ${supplierId}` : "Tedarikçi Bulunamadı");
  return <SupplierDetailView supplierId={supplierId} />;
}
