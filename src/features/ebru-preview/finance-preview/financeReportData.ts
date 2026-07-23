export const incomeExpenseReport = {
  income: [] as { name: string; amount: string; share: number }[],
  expense: [] as { name: string; amount: string; share: number }[],
  totals: { income: "—", expense: "—", net: "—" },
};
export const paymentAging: { label: string; value: number }[] = [];
export const pendingPayments: { name: string; issue: string; due: string; delay: string; amount: string }[] = [];
export const vatMonths: { month: string; calculated: string; deductible: string; net: string }[] = [];
export const vatDetails: { type: string; no: string; name: string; party: string; date: string; vat: string }[] = [];
