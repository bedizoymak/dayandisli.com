export const expenseTypes = ["Fiş / Fatura", "Maaş / Prim", "Vergi / SGK Primi", "Banka Gideri", "Konaklama", "Diğer Gider"];
export const expensePaymentStatuses = ["Ödenecek", "Ödendi", "Çalışan Cebinden Ödedi", "Gecikmiş"];
export const newExpenseActions = [
  { label: "Yeni Fiş / Fatura", route: "/apps/finance/expense/list/new/invoice" },
  { label: "Yeni Maaş / Prim", route: "/apps/finance/expense/list/new/payroll" },
  { label: "Yeni Vergi / SGK Primi", route: "/apps/finance/expense/list/new/tax" },
  { label: "Yeni Banka Gideri", route: "/apps/finance/expense/list/new/bank-expense" },
  { label: "Yeni Konaklama Faturası", route: "/apps/finance/expense/list/new/accommodation" },
  { label: "Diğer Gider", route: "/apps/finance/expense/list/new/other" },
];

export const expenseRows: { name: string; party: string; type: string; issue: string; document: string; due: string; total: string; payment: string; status: string }[] = [];

export const incomingInvoiceRows: { sender: string; number: string; type: string; date: string; total: string; status: string }[] = [];

export const expenseFormDefaults = {
  name: "", supplier: "", supplierInfo: "", invoiceDate: "", invoiceNumber: "", total: 0, paymentDate: "", category: "", tags: "", employee: "", periodMonth: "", periodYear: "",
};
