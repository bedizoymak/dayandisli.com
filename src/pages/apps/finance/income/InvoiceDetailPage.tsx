import { useParams } from "react-router-dom";
import { InvoiceDetailPage as InvoiceDetailView } from "@/features/finance/FinanceIncomePages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  usePageTitle(invoiceId ? `Fatura ${invoiceId}` : "Fatura Bulunamadı");
  return <InvoiceDetailView invoiceId={invoiceId} />;
}
