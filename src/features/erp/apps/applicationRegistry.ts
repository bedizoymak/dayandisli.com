import {
  BarChart3,
  Calculator,
  ClipboardCheck,
  CreditCard,
  Factory,
  Globe2,
  HandCoins,
  HeartHandshake,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ErpApplicationId =
  | "website"
  | "commerce"
  | "crm"
  | "sales"
  | "invoicing"
  | "accounting"
  | "expenses"
  | "inventory"
  | "purchasing"
  | "production"
  | "quality"
  | "maintenance"
  | "repair"
  | "hr"
  | "reports"
  | "settings";

export type ErpApplication = {
  id: ErpApplicationId;
  title: string;
  description: string;
  route: string;
  icon: LucideIcon;
  permissionKey?: string;
  modules: ErpApplicationModule[];
};

export type ErpApplicationModule = {
  title: string;
  description: string;
  route: string;
  permissionKey?: string;
  status?: "active" | "planned";
};

export const erpApplications: ErpApplication[] = [
  {
    id: "website",
    title: "Web Sitesi",
    description: "Site içeriği, ürün görünürlüğü ve yönetim ekranları.",
    route: "/apps/website",
    icon: Globe2,
    permissionKey: "website.view",
    modules: [
      { title: "Genel Bakış", description: "Web sitesi yönetim özetine geçin.", route: "/dashboard", permissionKey: "website.overview" },
      { title: "Ürünler", description: "Web sitesinde gösterilen ürün kayıtlarını yönetin.", route: "/admin/urunler", permissionKey: "website.products" },
      { title: "Medya", description: "Ürün görselleri ve teknik doküman alanlarına erişin.", route: "/documents", permissionKey: "website.media" },
      { title: "SEO", description: "Arama görünürlüğü ayarları için ayrılan alan.", route: "/ayarlar", permissionKey: "website.seo", status: "planned" },
      { title: "Formlar", description: "İletişim ve talep formları için gelecekteki alan.", route: "/apps/website", permissionKey: "website.forms", status: "planned" },
    ],
  },
  {
    id: "commerce",
    title: "E-Ticaret",
    description: "Mağaza siparişleri, ürün katalogları ve satış akışı.",
    route: "/apps/commerce",
    icon: ShoppingBag,
    permissionKey: "commerce.view",
    modules: [
      { title: "Siparişler", description: "Mağaza siparişlerini görüntüleyin ve durumlarını yönetin.", route: "/admin/siparisler", permissionKey: "commerce.orders" },
      { title: "Ürünler", description: "Mağaza ürün katalog kayıtlarını yönetin.", route: "/admin/urunler", permissionKey: "commerce.products" },
      { title: "Müşteriler", description: "Siparişle ilişkili müşteri kayıtlarına geçin.", route: "/crm", permissionKey: "commerce.customers" },
      { title: "Kategoriler", description: "Kategori yönetimi için gelecekteki alan.", route: "/admin/urunler", permissionKey: "commerce.categories", status: "planned" },
    ],
  },
  {
    id: "crm",
    title: "Müşteri İlişkileri",
    description: "Müşteri, tedarikçi ve fason firma kartları.",
    route: "/apps/crm",
    icon: HeartHandshake,
    permissionKey: "crm.view",
    modules: [
      { title: "Paydaşlar", description: "Müşteri, tedarikçi ve fason firmaları tek listede yönetin.", route: "/crm", permissionKey: "crm.stakeholders" },
      { title: "Müşteriler", description: "Müşteri cari kartlarına erişin.", route: "/musteriler", permissionKey: "crm.customers" },
      { title: "Tedarikçiler", description: "Tedarikçi cari kartlarına erişin.", route: "/tedarikciler", permissionKey: "crm.suppliers" },
      { title: "Potansiyel Müşteriler", description: "Yeni talep ve aday müşteri kayıtlarını yönetin.", route: "/crm", permissionKey: "crm.leads" },
      { title: "Fırsatlar", description: "Satış fırsatlarını ve aşamalarını takip edin.", route: "/crm", permissionKey: "crm.opportunities" },
      { title: "Aktiviteler", description: "Görüşme, arama, toplantı ve takip aktivitelerini yönetin.", route: "/crm", permissionKey: "crm.activities" },
    ],
  },
  {
    id: "sales",
    title: "Satış",
    description: "Teklifler, satış siparişleri ve müşteri talepleri.",
    route: "/apps/sales",
    icon: ShoppingCart,
    permissionKey: "sales.view",
    modules: [
      { title: "Teklifler", description: "Teklif kayıtlarını ve teklif oluşturma akışını açın.", route: "/teklifler", permissionKey: "sales.quotations" },
      { title: "Yeni Teklif", description: "Yeni teklif hazırlama ekranına geçin.", route: "/teklifler/yeni", permissionKey: "sales.createQuotation" },
      { title: "Satış Siparişleri", description: "Satış siparişlerini ve iş emri dönüşümlerini yönetin.", route: "/siparisler", permissionKey: "sales.orders" },
      { title: "Satış Faaliyetleri", description: "Fırsat, teklif, sipariş ve müşteri temaslarını takip edin.", route: "/satis-faaliyetleri", permissionKey: "sales.activities" },
    ],
  },
  {
    id: "invoicing",
    title: "Faturalama",
    description: "Satış ve alış faturalarının operasyon takibi.",
    route: "/apps/invoicing",
    icon: ReceiptText,
    permissionKey: "invoicing.view",
    modules: [
      { title: "Faturalar", description: "Satış ve alış faturalarını görüntüleyin.", route: "/invoices", permissionKey: "invoicing.invoices" },
      { title: "Ödemeler", description: "Fatura bağlantılı ödeme kayıtlarına geçin.", route: "/payments", permissionKey: "invoicing.payments" },
      { title: "Finans", description: "Finans özet ekranını açın.", route: "/finans", permissionKey: "invoicing.finance" },
    ],
  },
  {
    id: "accounting",
    title: "Muhasebe",
    description: "Finans hareketleri, tahsilat ve ödeme kayıtları.",
    route: "/apps/accounting",
    icon: Calculator,
    permissionKey: "accounting.view",
    modules: [
      { title: "Finans Özeti", description: "Cari ve finans özetlerini görüntüleyin.", route: "/finans", permissionKey: "accounting.summary" },
      { title: "Finans Hareketleri", description: "Borç, alacak, tahsilat ve ödeme hareketlerini yönetin.", route: "/finans/hareketler", permissionKey: "accounting.transactions" },
      { title: "Çekler ve Senetler", description: "Vadeli ödeme dokümanlarını takip edin.", route: "/finans/cekler", permissionKey: "accounting.documents" },
      { title: "Finans Raporları", description: "Finans rapor ekranlarına geçin.", route: "/finans/raporlar", permissionKey: "accounting.reports" },
    ],
  },
  {
    id: "expenses",
    title: "Gider Yönetimi",
    description: "Gider kayıtları ve ödeme çıkışlarının takibi.",
    route: "/apps/expenses",
    icon: CreditCard,
    permissionKey: "expenses.view",
    modules: [
      { title: "Ödemeler", description: "Ödeme ve gider çıkışlarını görüntüleyin.", route: "/payments", permissionKey: "expenses.payments" },
      { title: "Finans Hareketi", description: "Yeni finans hareketi kaydı oluşturun.", route: "/finans/hareketler/yeni", permissionKey: "expenses.create" },
      { title: "Raporlar", description: "Gider ve ödeme raporlarını açın.", route: "/reports", permissionKey: "expenses.reports" },
    ],
  },
  {
    id: "inventory",
    title: "Stok Yönetimi",
    description: "Malzeme, ürün ve depo hareketleri.",
    route: "/apps/inventory",
    icon: PackageSearch,
    permissionKey: "inventory.view",
    modules: [
      { title: "Stok Kartları", description: "Malzeme ve ürün stok kartlarını yönetin.", route: "/inventory", permissionKey: "inventory.items" },
      { title: "Stok Hareketleri", description: "Giriş, çıkış ve düzeltme hareketlerini takip edin.", route: "/inventory-movements", permissionKey: "inventory.movements" },
      { title: "Satın Alma", description: "Stok bağlantılı satın alma kayıtlarına geçin.", route: "/purchase-orders", permissionKey: "inventory.purchasing" },
    ],
  },
  {
    id: "purchasing",
    title: "Satın Alma",
    description: "Satın alma siparişleri ve tedarik akışı.",
    route: "/apps/purchasing",
    icon: HandCoins,
    permissionKey: "purchasing.view",
    modules: [
      { title: "Satın Alma Paneli", description: "Satın alma genel ekranına geçin.", route: "/purchasing", permissionKey: "purchasing.dashboard" },
      { title: "Satın Alma Siparişleri", description: "Tedarik siparişlerini yönetin.", route: "/purchase-orders", permissionKey: "purchasing.orders" },
      { title: "Tedarikçiler", description: "Tedarikçi kartlarını açın.", route: "/tedarikciler", permissionKey: "purchasing.suppliers" },
    ],
  },
  {
    id: "production",
    title: "Üretim",
    description: "İş emirleri, rotalar ve üretim operasyonları.",
    route: "/apps/production",
    icon: Factory,
    permissionKey: "production.view",
    modules: [
      { title: "Üretim Paneli", description: "Üretim genel durumunu görüntüleyin.", route: "/production", permissionKey: "production.dashboard" },
      { title: "İş Emirleri", description: "İş emirlerini ve operasyon durumlarını yönetin.", route: "/work-orders", permissionKey: "production.workOrders" },
      { title: "Rotalar", description: "Üretim rota şablonlarını yönetin.", route: "/routes", permissionKey: "production.routes" },
      { title: "Fason İşler", description: "Fason süreçleri takip edin.", route: "/subcontracting", permissionKey: "production.subcontracting" },
      { title: "Dişli Hesaplama", description: "Üretim hesaplama araçlarını açın.", route: "/calculator", permissionKey: "production.calculator" },
    ],
  },
  {
    id: "quality",
    title: "Kalite Yönetimi",
    description: "Kalite raporları, ölçümler ve kontrol kayıtları.",
    route: "/apps/quality",
    icon: ShieldCheck,
    permissionKey: "quality.view",
    modules: [
      { title: "Kalite Raporları", description: "Kontrol raporları ve ölçümleri yönetin.", route: "/quality", permissionKey: "quality.reports" },
      { title: "İş Emirleri", description: "Kalite kontrol bekleyen iş emirlerine geçin.", route: "/work-orders", permissionKey: "quality.workOrders" },
    ],
  },
  {
    id: "maintenance",
    title: "Bakım Yönetimi",
    description: "Makine bakım planları ve arıza kayıtları.",
    route: "/apps/maintenance",
    icon: Wrench,
    permissionKey: "maintenance.view",
    modules: [
      { title: "Bakım Görevleri", description: "Planlı bakım ve arıza kayıtlarını yönetin.", route: "/maintenance", permissionKey: "maintenance.tasks" },
      { title: "Makineler", description: "Makine bağlantılı üretim ekranlarına geçin.", route: "/routes", permissionKey: "maintenance.machines" },
    ],
  },
  {
    id: "repair",
    title: "Tamir Yönetimi",
    description: "Tamir işleri için üretim ve bakım ekranlarına hızlı geçiş.",
    route: "/apps/repair",
    icon: ClipboardCheck,
    permissionKey: "repair.view",
    modules: [
      { title: "Tamir İş Emirleri", description: "Tamir işleri için iş emirlerini açın.", route: "/work-orders", permissionKey: "repair.workOrders" },
      { title: "Bakım Görevleri", description: "Arıza ve bakım kayıtlarına geçin.", route: "/maintenance", permissionKey: "repair.maintenance" },
      { title: "Kalite Kontrol", description: "Tamir sonrası kalite raporlarını açın.", route: "/quality", permissionKey: "repair.quality" },
    ],
  },
  {
    id: "hr",
    title: "İnsan Kaynakları",
    description: "Personel kayıtları ve çalışma süreleri.",
    route: "/apps/hr",
    icon: Users,
    permissionKey: "hr.view",
    modules: [
      { title: "Çalışanlar", description: "Çalışan kartları, durum ve kullanıcı bağlantılarını yönetin.", route: "/hr", permissionKey: "hr.employees" },
      { title: "Departmanlar", description: "Organizasyon departmanlarını ve yöneticilerini takip edin.", route: "/hr/departmanlar", permissionKey: "hr.departments" },
      { title: "Pozisyonlar", description: "Pozisyon ve raporlama yapısını yönetin.", route: "/hr/pozisyonlar", permissionKey: "hr.positions" },
      { title: "Devam Takibi", description: "Çalışma saati ve mesai kayıtlarını takip edin.", route: "/hr/devam", permissionKey: "hr.attendance" },
      { title: "İzin Yönetimi", description: "İzin taleplerini ve durumlarını izleyin.", route: "/hr/izinler", permissionKey: "hr.leave" },
      { title: "İşe Alım", description: "Aday kayıtları ve işe alım sürecini yönetin.", route: "/hr/ise-alim", permissionKey: "hr.recruitment" },
      { title: "Oryantasyon", description: "Yeni çalışan görevlerini takip edin.", route: "/hr/oryantasyon", permissionKey: "hr.onboarding" },
      { title: "Çalışma Süreleri", description: "Personel çalışma kayıtlarını listeleyin.", route: "/time-entries", permissionKey: "hr.timeEntries" },
    ],
  },
  {
    id: "reports",
    title: "Raporlar",
    description: "Yönetim, finans, üretim ve stok raporları.",
    route: "/apps/reports",
    icon: BarChart3,
    permissionKey: "reports.view",
    modules: [
      { title: "Yönetim Raporları", description: "ERP genel raporlarını görüntüleyin.", route: "/reports", permissionKey: "reports.management" },
      { title: "Finans Raporları", description: "Finans rapor ekranlarına geçin.", route: "/finans/raporlar", permissionKey: "reports.finance" },
      { title: "Kalite Raporları", description: "Kalite raporlarını açın.", route: "/quality", permissionKey: "reports.quality" },
    ],
  },
  {
    id: "settings",
    title: "Ayarlar",
    description: "Sistem, erişim ve ERP yapılandırması.",
    route: "/apps/settings",
    icon: Settings,
    permissionKey: "settings.view",
    modules: [
      { title: "ERP Ayarları", description: "ERP yapılandırma ekranını açın.", route: "/settings", permissionKey: "settings.erp" },
      { title: "Yönetim Ayarları", description: "Yönetim ve erişim ayarlarına geçin.", route: "/ayarlar", permissionKey: "settings.admin" },
      { title: "Veritabanı Durumu", description: "Migration ve RLS kontrol ekranlarını görüntüleyin.", route: "/dashboard", permissionKey: "settings.database" },
    ],
  },
];

export function getErpApplication(id: string | undefined) {
  return erpApplications.find((app) => app.id === id);
}
