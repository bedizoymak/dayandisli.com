import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { salesQuotes } from "../salesData";
import type { SalesQuote } from "../salesTypes";
import { adaptQuoteToPdf } from "./quotePdfAdapter";
import { QuoteDocument } from "./QuoteDocument";
import { DRAFT_QUOTE_KEY } from "./quotePdfTypes";
export function QuotePrintPage() {
  const { quoteId } = useParams();
  const [params] = useSearchParams();
  const quote = useMemo(() => {
    if (params.get("draft") === "1") {
      try {
        const raw = localStorage.getItem(DRAFT_QUOTE_KEY);
        return raw ? (JSON.parse(raw) as SalesQuote) : undefined;
      } catch {
        return undefined;
      }
    }
    return salesQuotes.find((q) => q.id === quoteId);
  }, [params, quoteId]);
  useEffect(() => {
    if (params.get("print") === "1" && quote) {
      const timer = window.setTimeout(() => window.print(), 300);
      return () => window.clearTimeout(timer);
    }
  }, [params, quote]);
  if (!quote)
    return <div className="quote-print-error">Teklif bulunamadı.</div>;
  return (
    <div className="quote-print-page">
      <div className="quote-print-toolbar">
        <div>
          <strong>Teklif Önizleme</strong>
          <span>Dayan Dişli kurumsal teklif şablonu</span>
        </div>
        <button onClick={() => window.print()}>PDF / Yazdır</button>
      </div>
      <QuoteDocument document={adaptQuoteToPdf(quote)} />
    </div>
  );
}
