export const expenseTypes = ["Fiş / Fatura", "Maaş / Prim", "Vergi / SGK Primi", "Banka Gideri", "Konaklama", "Diğer Gider"];
export const expensePaymentStatuses = ["Ödenecek", "Ödendi", "Çalışan Cebinden Ödedi", "Gecikmiş"];
export const newExpenseActions = [
  { label: "Yeni Fiş / Fatura", route: "/apps/ebru-preview/finance/expense/list/new/invoice" },
  { label: "Yeni Maaş / Prim", route: "/apps/ebru-preview/finance/expense/list/new/payroll" },
  { label: "Yeni Vergi / SGK Primi", route: "/apps/ebru-preview/finance/expense/list/new/tax" },
  { label: "Yeni Banka Gideri", route: "/apps/ebru-preview/finance/expense/list/new/bank-expense" },
  { label: "Yeni Konaklama Faturası", route: "/apps/ebru-preview/finance/expense/list/new/accommodation" },
  { label: "Diğer Gider", route: "/apps/ebru-preview/finance/expense/list/new/other" },
];

export const expenseRows = [
  { name: "Temmuz Sac Alımı", party: "Marmara Metal A.Ş.", type: "Fiş / Fatura", issue: "14.07.2026", document: "MM-2026-1842", due: "29.07.2026", total: "₺284.400", payment: "Ödenecek", status: "Onaylandı" },
  { name: "Haziran Performans Primi", party: "Üretim Ekibi", type: "Maaş / Prim", issue: "30.06.2026", document: "IK-0626", due: "18.07.2026", total: "₺96.000", payment: "Ödenecek", status: "Taslak" },
  { name: "Haziran SGK Primi", party: "SGK", type: "Vergi / SGK Primi", issue: "01.07.2026", document: "SGK-2026-06", due: "15.07.2026", total: "₺148.250", payment: "Gecikmiş", status: "Onaylandı" },
  { name: "POS Komisyonu", party: "Garanti BBVA", type: "Banka Gideri", issue: "12.07.2026", document: "GB-0712", due: "12.07.2026", total: "₺4.860", payment: "Ödendi", status: "Tamamlandı" },
];

export const incomingInvoiceRows = [
  { sender: "Anadolu Rulman San. A.Ş.", number: "ARS20260000418", type: "Ticari e-Fatura", date: "15.07.2026", total: "₺186.720", status: "Onay Bekliyor" },
  { sender: "Marmara Metal A.Ş.", number: "MMA20260001842", type: "Temel e-Fatura", date: "14.07.2026", total: "₺284.400", status: "Kabul Edildi" },
  { sender: "Kent Enerji", number: "KEA20260009214", type: "e-Arşiv", date: "11.07.2026", total: "₺42.680", status: "Gider Kaydına Aktarıldı" },
  { sender: "Teknik Hırdavat Ltd.", number: "THL20260000671", type: "İade", date: "09.07.2026", total: "-₺8.940", status: "Reddedildi" },
];

export const expenseFormDefaults = {
  name: "Temmuz tedarik gideri", supplier: "Marmara Metal A.Ş.", supplierInfo: "Bursa / Türkiye · VKN 1234567890", invoiceDate: "2026-07-16", invoiceNumber: "", total: 0, paymentDate: "2026-08-15", category: "Malzeme ve Tedarik", tags: "Üretim", employee: "Ahmet Yılmaz", periodMonth: "Temmuz", periodYear: "2026",
};
