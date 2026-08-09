import { useParams } from "react-router-dom";
import { OrderDetailPage as OrderDetailView } from "@/features/finance/OperationsPages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function OrderDetailPage() {
  const { orderNo } = useParams<{ orderNo: string }>();
  usePageTitle(orderNo ? `Sipariş ${orderNo}` : "Sipariş Bulunamadı");
  return <OrderDetailView orderNo={orderNo} />;
}
