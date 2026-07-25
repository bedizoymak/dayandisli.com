import { useParams } from "react-router-dom";
import { QuoteDetailPage as QuoteDetailView } from "@/features/sales/QuotePages";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function QuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  usePageTitle(quoteId ? `Teklif ${quoteId}` : "Teklif Bulunamadı");
  return <QuoteDetailView quoteId={quoteId} />;
}
