export type InvoiceLine = {
  product: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tax: number;
};

export const salesInvoiceCategories = [
  "Yurtiçi Satışlar",
  "İhracat Satışları",
  "Hizmet Satışları",
  "Yedek Parça Satışları",
  "Diğer Satışlar",
];

export const salesInvoiceDefaults: {
  name: string;
  customer: string;
  customerInfo: string;
  issueDate: string;
  dueDate: string;
  note: string;
  category: string;
  tags: string;
  lines: InvoiceLine[];
} = {
  name: "",
  customer: "",
  customerInfo: "",
  issueDate: "",
  dueDate: "",
  note: "",
  category: "",
  tags: "",
  lines: [],
};

export const expenseInvoiceDefaults = {
  name: "",
  supplier: "",
  supplierInfo: "",
  invoiceDate: "",
  total: "",
  vat: "",
  vatRate: "",
  paymentDate: "",
  category: "",
  tags: "",
};
