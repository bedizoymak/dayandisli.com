export const salesInvoiceDefaults = {
  name: "Temmuz Satış Faturası",
  customer: "ABC Otomotiv A.Ş.",
  customerInfo: "İstanbul · Vergi No: 1234567890",
  issueDate: "2026-07-16",
  dueDate: "2026-08-15",
  note: "Sipariş kapsamındaki üretim hizmetleri.",
  category: "Yurtiçi Satışlar",
  tags: "Üretim, Temmuz",
  lines: [{ product: "Dişli Üretim Hizmeti", quantity: 1, unit: "Adet", unitPrice: 125000, tax: 20 }],
};

export const expenseInvoiceDefaults = {
  name: "Çelik Malzeme Alımı",
  supplier: "Çelik Tedarik A.Ş.",
  supplierInfo: "İstanbul · Vergi No: 9876543210",
  invoiceDate: "2026-07-16",
  total: "260000",
  vat: "43333.33",
  vatRate: "20",
  paymentDate: "2026-08-15",
  category: "Hammadde Giderleri",
  tags: "Çelik, Üretim",
};
