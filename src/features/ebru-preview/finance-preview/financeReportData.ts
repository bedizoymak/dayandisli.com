export const incomeExpenseReport = {
  income: [
    { name: "Satış Faturaları", amount: "—", share: 0 },
    { name: "Hizmet Gelirleri", amount: "—", share: 0 },
    { name: "Diğer Gelirler", amount: "—", share: 0 },
  ],
  expense: [
    { name: "Malzeme ve Tedarik", amount: "—", share: 0 },
    { name: "Personel", amount: "—", share: 0 },
    { name: "Vergi ve Banka", amount: "—", share: 0 },
  ],
  totals: { income: "—", expense: "—", net: "—" },
};
export const paymentAging = [
  { label: "Planlanmamış", value: 0 },
  { label: "Güncel", value: 0 },
  { label: "1-30 Gün", value: 0 },
  { label: "31-60 Gün", value: 0 },
  { label: "61-90 Gün", value: 0 },
  { label: "91-120 Gün", value: 0 },
  { label: "120+ Gün", value: 0 },
];
export const pendingPayments: { name: string; issue: string; due: string; delay: string; amount: string }[] = [];
export const vatMonths = [
  { month: "Bu ay", calculated: "—", deductible: "—", net: "—" },
  { month: "Geçen ay", calculated: "—", deductible: "—", net: "—" },
  { month: "Önceki ay", calculated: "—", deductible: "—", net: "—" },
];
export const vatDetails: { type: string; no: string; name: string; party: string; date: string; vat: string }[] = [];
