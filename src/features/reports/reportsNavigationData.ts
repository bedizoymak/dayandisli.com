export const reportsNavigation = [
  {
    id: "collections",
    label: "Tahsilat Raporu",
    route: "/apps/reports/collections",
  },
  {
    id: "income-expense",
    label: "Gelir-Gider Raporu",
    route: "/apps/reports/income-expense",
  },
  {
    id: "cash-bank",
    label: "Kasa-Banka Raporu",
    route: "/apps/reports/cash-bank",
  },
  {
    id: "production",
    label: "Üretim Raporu",
    route: "/apps/reports/production",
  },
] as const;

export const productionReportRows = [
  {
    workOrder: "UE-2026-184",
    product: "Helisel Dişli",
    planned: "120 adet",
    completed: "84 adet",
    status: "Üretimde",
  },
  {
    workOrder: "UE-2026-179",
    product: "Konik Dişli Seti",
    planned: "48 set",
    completed: "48 set",
    status: "Tamamlandı",
  },
  {
    workOrder: "UE-2026-191",
    product: "Sonsuz Vida",
    planned: "30 adet",
    completed: "8 adet",
    status: "Üretimde",
  },
] as const;
