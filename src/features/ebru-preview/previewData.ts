export type PreviewRoute = { label: string; route: string; keywords?: string };

export const sidebarItems: PreviewRoute[] = [
  { label: "Dashboard", route: "/apps" },
  { label: "Favoriler", route: "/apps" },
  { label: "Muhasebe ve Finans", route: "/finans" },
  { label: "Müşteri İlişkileri", route: "/crm" },
  { label: "Raporlar", route: "/reports" },
  { label: "Satış", route: "/teklifler" },
  { label: "E-Ticaret", route: "/commerce" },
  { label: "Üretim", route: "/production" },
  { label: "Kalite ve Bakım Yönetimi", route: "/quality" },
  { label: "İnsan Kaynakları", route: "/hr" },
  { label: "Web Sitesi", route: "/website" },
  { label: "Ayarlar", route: "/settings" },
];

export const searchRoutes: PreviewRoute[] = [
  { label: "Fatura Listesi", route: "/invoices", keywords: "fatura" },
  { label: "Müşteri Kartı", route: "/musteriler", keywords: "müşteri cari" },
  { label: "Teklif Oluştur", route: "/teklifler/yeni", keywords: "teklif satış" },
  { label: "Teklif Listesi", route: "/teklifler", keywords: "teklif satış" },
  { label: "İş Emirleri", route: "/work-orders", keywords: "iş emri üretim" },
  { label: "Gelir/Gider Raporu", route: "/finans/raporlar", keywords: "gelir gider rapor" },
  { label: "Kalite Kontrol", route: "/quality", keywords: "kalite" },
  { label: "Bakım Planları", route: "/maintenance", keywords: "bakım" },
];

export const quickActions: PreviewRoute[] = [
  { label: "Fatura Oluştur", route: "/invoices" },
  { label: "Teklif Oluştur", route: "/teklifler/yeni" },
  { label: "Müşteriler", route: "/musteriler" },
  { label: "Gelir/Gider Raporu", route: "/finans/raporlar" },
];

export const previewMetrics = {
  weather: { temperature: "29°C", location: "İstanbul · Açık" },
  exchange: [
    { label: "Dolar / TL", value: "43,52", change: "▲ %0,18", trend: "up" },
    { label: "Euro / TL", value: "50,26", change: "▲ %0,11", trend: "up" },
    { label: "Altın / TL (Gr)", value: "4.382,90", change: "▼ %0,08", trend: "down" },
  ],
  kpis: [
    { label: "Toplam Tahsil Edilecek", value: "₺ 8.425.000", detail: "▲ %8,4 geçen aya göre", tone: "blue" },
    { label: "Üretimdeki İş Emri", value: "18", detail: "12 aktif · 4 beklemede · 2 gecikmiş", tone: "green" },
    { label: "Bu Ay Oluşan KDV", value: "₺ 612.480", detail: "▲ %5,2 önceki aya göre", tone: "purple" },
  ],
  receivables: { total: "₺ 9,60M", normal: "₺ 8.425.000", normalPercent: 88, overdue: "₺ 1.175.000", overduePercent: 12 },
  payables: { total: "₺ 5,40M", normal: "₺ 4.680.000", normalPercent: 87, overdue: "₺ 720.000", overduePercent: 13 },
};

export const upcomingItems = [
  { day: "17", month: "TEM", title: "ABC Otomotiv Tahsilatı", note: "Satış Faturası #SF-2026-148", amount: "+₺485.000", kind: "income" },
  { day: "18", month: "TEM", title: "Çelik Tedarik Ödemesi", note: "Satın Alma #SA-2026-072", amount: "-₺260.000", kind: "expense" },
  { day: "21", month: "TEM", title: "XYZ Makine Tahsilatı", note: "Satış Faturası #SF-2026-152", amount: "+₺720.000", kind: "income" },
  { day: "25", month: "TEM", title: "Personel Ödemeleri", note: "Temmuz bordro planı", amount: "-₺935.000", kind: "expense" },
];

export const approvals = [
  { label: "Satın Alma Talepleri", count: 4 },
  { label: "Masraf Onayları", count: 2 },
  { label: "İş Emri Onayları", count: 3 },
  { label: "İzin Talepleri", count: 5 },
];

export const systemNotifications = [
  { title: "Yeni tahsilat kaydı", description: "ABC Otomotiv ödemesi plana eklendi.", relativeTime: "12 dk önce" },
  { title: "İş emri güncellendi", description: "UE-2026-184 üretim aşamasına geçti.", relativeTime: "38 dk önce" },
  { title: "Onay bekleniyor", description: "İki masraf kaydı incelemenizi bekliyor.", relativeTime: "1 sa önce" },
];

export const calendarEvents: Record<number, string> = { 3: "Tahsilat", 7: "Ödeme", 12: "Tahsilat", 17: "Tahsilat", 18: "Ödeme", 21: "Tahsilat", 25: "Personel" };
