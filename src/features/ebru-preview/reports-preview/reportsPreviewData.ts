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

export const productionReportRows: {
  workOrder: string;
  product: string;
  planned: string;
  completed: string;
  status: string;
}[] = [];
