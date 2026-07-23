import type { SalesQuote } from "./salesTypes";
import { DRAFT_QUOTE_KEY } from "./pdf/quotePdfTypes";
export const customerName = (_id: string) => "Senkronize müşteri seçilmedi";
export function openQuotePreview(quote: SalesQuote, print = false) {
  localStorage.setItem(DRAFT_QUOTE_KEY, JSON.stringify(quote));
  window.open(
    `/apps/sales/quotes/${quote.id}/print?draft=1${print ? "&print=1" : ""}`,
    "_blank",
    "noopener,noreferrer",
  );
}
export function printQuote(quote: SalesQuote) {
  openQuotePreview(quote, true);
}
