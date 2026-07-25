import { useParams } from "react-router-dom";
import { SalesInvoiceForm } from "@/features/finance/FinanceInvoicePages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function EditInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  usePageTitle(invoiceId ? `Fatura Düzenle · ${invoiceId}` : "Fatura Bulunamadı");
  return <SalesInvoiceForm mode="edit" invoiceId={invoiceId} />;
}
