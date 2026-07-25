export const incomeExpenseReport = {
  income: [
    { name: "Satış Faturaları", amount: "₺3.440.000", share: 72 },
    { name: "Hizmet Gelirleri", amount: "₺860.000", share: 18 },
    { name: "Diğer Gelirler", amount: "₺478.000", share: 10 },
  ],
  expense: [
    { name: "Malzeme ve Tedarik", amount: "₺1.620.000", share: 52 },
    { name: "Personel", amount: "₺935.000", share: 30 },
    { name: "Vergi ve Banka", amount: "₺560.000", share: 18 },
  ],
  totals: { income: "₺4.778.000", expense: "₺3.115.000", net: "₺1.663.000" },
};
export const paymentAging = [
  { label: "Planlanmamış", value: 199 },
  { label: "Güncel", value: 320 },
  { label: "1-30 Gün", value: 410 },
  { label: "31-60 Gün", value: 260 },
  { label: "61-90 Gün", value: 170 },
  { label: "91-120 Gün", value: 95 },
  { label: "120+ Gün", value: 166 },
];
export const pendingPayments = [
  {
    name: "Temmuz Sac Alımı",
    issue: "14.07.2026",
    due: "29.07.2026",
    delay: "13 gün kaldı",
    amount: "₺284.400",
  },
  {
    name: "Haziran SGK Primi",
    issue: "01.07.2026",
    due: "15.07.2026",
    delay: "1 gün gecikti",
    amount: "₺148.250",
  },
  {
    name: "Çelik Tedarik Ödemesi",
    issue: "03.07.2026",
    due: "18.07.2026",
    delay: "2 gün kaldı",
    amount: "₺260.000",
  },
];
export const vatMonths = [
  {
    month: "Temmuz 2026",
    calculated: "₺326.400",
    deductible: "₺125.391",
    net: "₺201.009",
  },
  {
    month: "Haziran 2026",
    calculated: "₺298.200",
    deductible: "₺142.700",
    net: "₺155.500",
  },
  {
    month: "Mayıs 2026",
    calculated: "₺271.600",
    deductible: "₺119.850",
    net: "₺151.750",
  },
];
export const vatDetails = [
  {
    type: "Satış",
    no: "FTR-2026-0718",
    name: "Redüktör Siparişi",
    party: "Atlas Makine",
    date: "16.07.2026",
    vat: "₺84.000",
  },
  {
    type: "Gider",
    no: "MM-2026-1842",
    name: "Temmuz Sac Alımı",
    party: "Marmara Metal",
    date: "14.07.2026",
    vat: "₺47.400",
  },
];
