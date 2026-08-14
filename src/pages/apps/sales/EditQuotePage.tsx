import { useParams } from "react-router-dom";
import { QuoteFormPage } from "@/features/sales/QuotePages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function EditQuotePage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  usePageTitle(quoteId ? `Teklif Düzenle · ${quoteId}` : "Teklif Bulunamadı");
  return <QuoteFormPage quoteId={quoteId} />;
}
