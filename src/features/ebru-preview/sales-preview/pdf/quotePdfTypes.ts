export const DRAFT_QUOTE_KEY = "ebru-sales-draft-quote";

export type QuotePdfParty = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  taxNo: string;
};
export type QuotePdfLine = {
  code: string;
  name: string;
  description: string;
  material: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  vat: number;
  total: number;
};
export type QuotePdfDocument = {
  quoteId: string;
  quoteNo: string;
  quoteDate: string;
  validUntil: string;
  validity: string;
  currency: string;
  subject: string;
  project: string;
  issuer: QuotePdfParty & { website: string };
  customer: QuotePdfParty;
  deliveryLocation: string;
  lines: QuotePdfLine[];
  subtotal: number;
  discount: number;
  vat: number;
  grandTotal: number;
  estimatedDelivery: string;
  paymentTerms: string;
  notes: string;
  preparedBy: string;
};
