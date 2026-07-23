export type PreviewRoute = { label: string; route: string; keywords?: string };

export const sidebarItems: PreviewRoute[] = [
  { label: "Dashboard", route: "/apps" },
  { label: "Favoriler", route: "/apps" },
  { label: "Muhasebe ve Finans", route: "/apps/finance" },
  { label: "Müşteri İlişkileri", route: "/apps/crm/customers" },
  { label: "Raporlar", route: "/apps/finance/income/collection-report" },
  { label: "Satış", route: "/apps/sales/quotes" },
  { label: "E-Ticaret", route: "/apps/commerce" },
  { label: "Üretim", route: "/apps/production" },
  { label: "Kalite ve Bakım Yönetimi", route: "/apps/quality" },
  { label: "İnsan Kaynakları", route: "/apps/hr/employees" },
  { label: "Web Sitesi", route: "/apps/website" },
  { label: "Ayarlar", route: "/apps/settings" },
];

export const searchRoutes: PreviewRoute[] = [
  { label: "Fatura Listesi", route: "/apps/finance/income/invoices", keywords: "fatura" },
  { label: "Müşteri Kartı", route: "/apps/finance/income/customers", keywords: "müşteri cari" },
  { label: "Teklif Listesi", route: "/apps/sales/quotes", keywords: "teklif satış" },
  { label: "İş Emirleri", route: "/apps/production", keywords: "iş emri üretim" },
  { label: "Gelir/Gider Raporu", route: "/apps/finance/expense/income-expense-report", keywords: "gelir gider rapor" },
  { label: "Kalite Kontrol", route: "/apps/quality", keywords: "kalite" },
  { label: "Bakım Planları", route: "/apps/maintenance", keywords: "bakım" },
];

export const quickActions: PreviewRoute[] = [
  { label: "Faturalar", route: "/apps/finance/income/invoices" },
  { label: "Teklifler", route: "/apps/sales/quotes" },
  { label: "Müşteriler", route: "/apps/finance/income/customers" },
  { label: "Gelir/Gider Raporu", route: "/apps/finance/expense/income-expense-report" },
];
