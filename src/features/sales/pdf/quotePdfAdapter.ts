import type { SalesQuote } from "../salesTypes";
import type { QuotePdfDocument } from "./quotePdfTypes";
export function adaptQuoteToPdf(quote: SalesQuote): QuotePdfDocument {
  const lines = quote.lines.map((line) => {
    const base = line.quantity * line.unitPrice;
    const discounted = base * (1 - line.discount / 100);
    return {
      code: line.code,
      name: line.name,
      description: quote.subject,
      material: line.material,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      discount: line.discount,
      vat: line.vat,
      total: discounted * (1 + line.vat / 100),
    };
  });
  const subtotal = quote.lines.reduce(
    (s, l) => s + l.quantity * l.unitPrice,
    0,
  );
  const discount = quote.lines.reduce(
    (s, l) => s + (l.quantity * l.unitPrice * l.discount) / 100,
    0,
  );
  const vat = quote.lines.reduce(
    (s, l) =>
      s + (l.quantity * l.unitPrice * (1 - l.discount / 100) * l.vat) / 100,
    0,
  );
  return {
    quoteId: quote.id,
    quoteNo: quote.no,
    quoteDate: quote.created,
    validUntil: quote.validUntil,
    validity: quote.validUntil,
    currency: quote.currency,
    subject: quote.subject,
    project: quote.project,
    issuer: {
      name: "—",
      contact: "—",
      phone: "—",
      email: "—",
      website: "—",
      address: "—",
      taxNo: "—",
    },
    customer: {
      name: "—",
      contact: quote.contact || "—",
      phone: "—",
      email: "—",
      address: "—",
      taxNo: "—",
    },
    deliveryLocation: quote.deliveryTerms,
    lines,
    subtotal,
    discount,
    vat,
    grandTotal: subtotal - discount + vat,
    estimatedDelivery: "—",
    paymentTerms: quote.paymentTerms,
    notes: quote.notes,
    preparedBy: "—",
  };
}
