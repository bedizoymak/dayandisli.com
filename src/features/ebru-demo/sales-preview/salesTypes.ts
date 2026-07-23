export type QuoteStatus =
  | "Taslak"
  | "Gönderildi"
  | "Beklemede"
  | "Kabul Edildi"
  | "Reddedildi"
  | "Süresi Doldu"
  | "Siparişe Dönüştürüldü";
export type QuoteLine = {
  productServiceId: string;
  code: string;
  name: string;
  material: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  vat: number;
};
export type SalesQuote = {
  id: string;
  no: string;
  customerId: string;
  contactId: string;
  contact: string;
  projectId: string;
  project: string;
  subject: string;
  currency: string;
  created: string;
  validUntil: string;
  status: QuoteStatus;
  lines: QuoteLine[];
  notes: string;
  paymentTerms: string;
  deliveryTerms: string;
  linkedOrderNo?: string;
};
export type SalesOrder = {
  id: string;
  no: string;
  customerId: string;
  sourceQuoteId?: string;
  sourceQuoteNo?: string;
  project: string;
  orderDate: string;
  dueDate: string;
  total: string;
  status: string;
};
export type SalesActivity = {
  id: string;
  date: string;
  type: string;
  customerId: string;
  relation: string;
  description: string;
  owner: string;
  status: string;
  quoteId?: string;
  orderId?: string;
};
