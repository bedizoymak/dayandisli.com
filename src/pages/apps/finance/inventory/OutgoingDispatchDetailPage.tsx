import { useParams } from "react-router-dom";
import { DispatchDetailPage } from "@/features/finance/OperationsPages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function OutgoingDispatchDetailPage() {
  const { dispatchNo } = useParams<{ dispatchNo: string }>();
  usePageTitle(dispatchNo ? `İrsaliye ${dispatchNo}` : "İrsaliye Bulunamadı");
  return <DispatchDetailPage type="outgoing" dispatchNo={dispatchNo} />;
}
