import type { SalesQuote } from "../salesTypes";
import type { QuotePdfDocument } from "./quotePdfTypes";
export function adaptQuoteToPdf(quote: SalesQuote): QuotePdfDocument {
  const lines = quote.lines.map((line) => {
    const base = line.quantity * line.unitPrice;
    const discounted = base * (1 - line.discount / 100);
    return {
      code: line.code,
      name: line.name,
      description: `${quote.subject} kapsamında ürün / hizmet`,
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
    validity: "15 Gün",
    currency: quote.currency,
    subject: quote.subject,
    project: quote.project,
    issuer: {
      name: "Dayan Dişli Sanayi",
      contact: "Hayrettin Dayan",
      phone: "+90 536 583 74 20",
      email: "info@dayandisli.com",
      website: "www.dayandisli.com",
      address:
        "İkitelli O.S.B. Çevre Sanayi Sitesi, 8. Blok No: 45/47 Başakşehir / İstanbul",
      taxNo: "Vergi bilgisi frontend yapılandırmasından sağlanacak",
    },
    customer: {
      name: quote.contact || "Müşteri",
      contact: quote.contact,
      phone: "",
      email: "",
      address: quote.deliveryTerms,
      taxNo: "",
    },
    deliveryLocation: quote.deliveryTerms,
    lines,
    subtotal,
    discount,
    vat,
    grandTotal: subtotal - discount + vat,
    estimatedDelivery: "15 iş günü",
    paymentTerms: quote.paymentTerms,
    notes: quote.notes,
    preparedBy: "Dayan Dişli Satış Ekibi",
  };
}
