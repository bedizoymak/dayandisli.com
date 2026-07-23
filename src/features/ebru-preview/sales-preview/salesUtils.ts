import { crmCustomers } from "../crm-preview/crmCustomerData";
import type { SalesQuote } from "./salesTypes";
import { DRAFT_QUOTE_KEY } from "./pdf/quotePdfTypes";
export const customerName = (id: string) =>
  crmCustomers.find((c) => c.id === id)?.name ?? "Bilinmeyen Müşteri";
export function openQuotePreview(quote: SalesQuote, print = false) {
  localStorage.setItem(DRAFT_QUOTE_KEY, JSON.stringify(quote));
  window.open(
    `/apps/ebru-preview/sales/quotes/${quote.id}/print?draft=1${print ? "&print=1" : ""}`,
    "_blank",
    "noopener,noreferrer",
  );
}
export function printQuote(quote: SalesQuote) {
  openQuotePreview(quote, true);
}
