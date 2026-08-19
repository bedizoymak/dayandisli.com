import { useParams } from "react-router-dom";
import { QuotePrintPage as QuotePrintView } from "@/features/sales/pdf/QuotePrintPage";
import { usePageTitle } from "@/features/erp-shell/usePageTitle";

export default function QuotePrintPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  usePageTitle(quoteId ? `Teklif Yazdır · ${quoteId}` : "Teklif Bulunamadı");
  return <QuotePrintView quoteId={quoteId} />;
}
