import { useParams } from "react-router-dom";
import { SalesOrderDetailPage as SalesOrderDetailView } from "@/features/sales/QuotePages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  usePageTitle(orderId ? `Sipariş ${orderId}` : "Sipariş Bulunamadı");
  return <SalesOrderDetailView orderId={orderId} />;
}
