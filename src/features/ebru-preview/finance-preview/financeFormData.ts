export const salesInvoiceDefaults = {
  name: "",
  customer: "",
  customerInfo: "",
  issueDate: "",
  dueDate: "",
  note: "",
  category: "",
  tags: "",
  lines: [] as {
    product: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    tax: number;
  }[],
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
