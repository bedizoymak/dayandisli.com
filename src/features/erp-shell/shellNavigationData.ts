export type ShellRoute = { label: string; route: string; keywords?: string };

// Sidebar module entries in the approved fixed shell order. `disabled: true`
// marks modules with no implemented screens yet — they render as a visible,
// non-navigating sidebar entry (not a broken link, not a fabricated page).
// Disabled entries intentionally carry no `route` at all: there is nothing
// to navigate to, so ErpLayout must not (and does not) read a route value
// for them — see the `item.disabled` branch in src/layouts/ErpLayout.tsx.
export type SidebarModule = { label: string; route?: string; disabled?: boolean };

export const sidebarItems: SidebarModule[] = [
  { label: "Dashboard", route: "/apps" },
  { label: "Favoriler", route: "/apps" },
  { label: "Muhasebe ve Finans", route: "/apps/finance" },
  { label: "Müşteri İlişkileri", route: "/apps/crm/customers" },
  { label: "Raporlar", route: "/apps/reports/collections" },
  { label: "Satış", route: "/apps/sales/quotes" },
  { label: "E-Ticaret", disabled: true },
  { label: "Üretim", disabled: true },
  { label: "Kalite ve Bakım Yönetimi", disabled: true },
  { label: "İnsan Kaynakları", disabled: true },
  { label: "Web Sitesi", disabled: true },
  { label: "Ayarlar", disabled: true },
];

export const searchRoutes: ShellRoute[] = [
  { label: "Fatura Listesi", route: "/apps/finance/income/invoices", keywords: "fatura" },
  { label: "Müşteri Kartı", route: "/apps/finance/income/customers", keywords: "müşteri cari" },
  { label: "Teklif Oluştur", route: "/apps/sales/quotes/new", keywords: "teklif satış" },
  { label: "Teklif Listesi", route: "/apps/sales/quotes", keywords: "teklif satış" },
  { label: "Gelir/Gider Raporu", route: "/apps/reports/income-expense", keywords: "gelir gider rapor" },
];

export const quickActions: ShellRoute[] = [
  { label: "Fatura Oluştur", route: "/apps/finance/income/invoices/new" },
  { label: "Teklif Oluştur", route: "/apps/sales/quotes/new" },
  { label: "Müşteriler", route: "/apps/finance/income/customers" },
  { label: "Gelir/Gider Raporu", route: "/apps/reports/income-expense" },
];
