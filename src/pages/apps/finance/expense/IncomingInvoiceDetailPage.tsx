import { useParams } from "react-router-dom";
import { IncomingInvoiceDetailPage as IncomingInvoiceDetailView } from "@/features/finance/FinanceExpensePages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function IncomingInvoiceDetailPage() {
  const { incomingInvoiceId } = useParams<{ incomingInvoiceId: string }>();
  usePageTitle(incomingInvoiceId ? `Gelen Fatura ${incomingInvoiceId}` : "Fatura Bulunamadı");
  return <IncomingInvoiceDetailView incomingInvoiceId={incomingInvoiceId} />;
}
