import {
  BarChart3,
  Banknote,
  Calculator,
  ClipboardCheck,
  CreditCard,
  Factory,
  Globe2,
  HandCoins,
  HeartHandshake,
  PackageSearch,
  Palette,
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
  | "parasut"
  | "ebru-preview"
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
    id: "parasut",
    title: "Paraşüt",
    description: "Paraşüt finans, fatura, tahsilat ve gider verileri.",
    route: "/apps/parasut",
    icon: Banknote,
    permissionKey: "parasut.view",
    // Paraşüt uses a dedicated module shell (see features/erp/parasut) instead of
    // the generic ApplicationShellPage module-card layout, so this stays empty.
    modules: [],
  },
  {
    id: "website",
    title: "Web Sitesi",
    description: "Site içeriği, ürün görünürlüğü ve yönetim ekranları.",
    route: "/apps/website",
    icon: Globe2,
    permissionKey: "website.view",
    modules: [
      { title: "Sayfalar", description: "Yayındaki site sayfalarını ve içerik durumlarını yönetin.", route: "/website", permissionKey: "website.view" },
      { title: "SEO Ayarları", description: "Rota bazlı meta başlık ve açıklamaları hazırlayın.", route: "/website/seo", permissionKey: "website.view" },
      { title: "Menü Yönetimi", description: "Üst, alt ve mobil menü bağlantılarını yönetin.", route: "/website/menuler", permissionKey: "website.view" },
      { title: "Medya Kütüphanesi", description: "Yayındaki medya kayıtları ve kullanım alanlarını izleyin.", route: "/website/medya", permissionKey: "website.view" },
      { title: "Formlar", description: "Yayındaki form tanımları ve gönderimlerini yönetin.", route: "/website/formlar", permissionKey: "website.view" },
      { title: "Bannerlar", description: "Yayındaki banner kayıtları ve yayın alanlarını yönetin.", route: "/website/bannerlar", permissionKey: "website.view" },
      { title: "Yayın Durumu", description: "Sayfa ve banner yayın durumunu takip edin.", route: "/website/yayin", permissionKey: "website.view" },
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
      { title: "Ürünler", description: "Mağaza ürün katalog kayıtlarını yönetin.", route: "/commerce", permissionKey: "commerce.view" },
      { title: "Kategoriler", description: "Mağaza kategori yapısını yönetin.", route: "/commerce/kategoriler", permissionKey: "commerce.view" },
      { title: "Siparişler", description: "Mağaza siparişlerini görüntüleyin ve satış siparişine aktarın.", route: "/commerce/siparisler", permissionKey: "commerce.view" },
      { title: "Müşteriler", description: "Siparişle ilişkili müşteri kayıtlarını izleyin.", route: "/commerce/musteriler", permissionKey: "commerce.view" },
      { title: "Kampanyalar", description: "Kampanya ve indirim temelini yönetin.", route: "/commerce/kampanyalar", permissionKey: "commerce.view" },
      { title: "Sepetler", description: "Sepet durumlarını ve dönüşüm temelini takip edin.", route: "/commerce/sepetler", permissionKey: "commerce.view" },
      { title: "Ödeme Durumları", description: "Sipariş ödeme durumlarını izleyin.", route: "/commerce/odemeler", permissionKey: "commerce.view" },
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
      { title: "Paydaşlar", description: "Müşteri, tedarikçi ve fason firmaları tek listede yönetin.", route: "/crm", permissionKey: "crm.view" },
      { title: "Müşteriler", description: "Müşteri cari kartlarına erişin.", route: "/musteriler", permissionKey: "crm.view" },
      { title: "Tedarikçiler", description: "Tedarikçi cari kartlarına erişin.", route: "/tedarikciler", permissionKey: "crm.view" },
      { title: "Potansiyel Müşteriler", description: "Yeni talep ve aday müşteri kayıtlarını yönetin.", route: "/crm", permissionKey: "crm.view" },
      { title: "Fırsatlar", description: "Satış fırsatlarını ve aşamalarını takip edin.", route: "/crm", permissionKey: "crm.view" },
      { title: "Aktiviteler", description: "Görüşme, arama, toplantı ve takip aktivitelerini yönetin.", route: "/crm", permissionKey: "crm.view" },
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
      { title: "Teklifler", description: "Teklif kayıtlarını ve teklif oluşturma akışını açın.", route: "/teklifler", permissionKey: "sales.view" },
      { title: "Yeni Teklif", description: "Yeni teklif hazırlama ekranına geçin.", route: "/teklifler/yeni", permissionKey: "sales.view" },
      { title: "Satış Siparişleri", description: "Satış siparişlerini ve iş emri dönüşümlerini yönetin.", route: "/siparisler", permissionKey: "sales.view" },
      { title: "Satış Faaliyetleri", description: "Fırsat, teklif, sipariş ve müşteri temaslarını takip edin.", route: "/satis-faaliyetleri", permissionKey: "sales.view" },
    ],
  },
  {
    id: "invoicing",
    title: "Faturalama",
    description: "Satış ve alış faturalarının operasyon takibi.",
    route: "/apps/invoicing",
    icon: ReceiptText,
    permissionKey: "finance.view",
    modules: [
      { title: "Faturalar", description: "Satış ve alış faturalarını görüntüleyin.", route: "/invoices", permissionKey: "finance.view" },
      { title: "Ödemeler", description: "Fatura bağlantılı ödeme kayıtlarına geçin.", route: "/payments", permissionKey: "finance.view" },
      { title: "Finans", description: "Finans özet ekranını açın.", route: "/finans", permissionKey: "finance.view" },
    ],
  },
  {
    id: "accounting",
    title: "Muhasebe",
    description: "Finans hareketleri, tahsilat ve ödeme kayıtları.",
    route: "/apps/accounting",
    icon: Calculator,
    permissionKey: "finance.view",
    modules: [
      { title: "Finans Özeti", description: "Cari ve finans özetlerini görüntüleyin.", route: "/finans", permissionKey: "finance.view" },
      { title: "Finans Hareketleri", description: "Borç, alacak, tahsilat ve ödeme hareketlerini yönetin.", route: "/finans/hareketler", permissionKey: "finance.view" },
      { title: "Çekler ve Senetler", description: "Vadeli ödeme dokümanlarını takip edin.", route: "/finans/cekler", permissionKey: "finance.view" },
      { title: "Finans Raporları", description: "Finans rapor ekranlarına geçin.", route: "/finans/raporlar", permissionKey: "finance.view" },
    ],
  },
  {
    id: "expenses",
    title: "Gider Yönetimi",
    description: "Gider kayıtları ve ödeme çıkışlarının takibi.",
    route: "/apps/expenses",
    icon: CreditCard,
    permissionKey: "finance.view",
    modules: [
      { title: "Ödemeler", description: "Ödeme ve gider çıkışlarını görüntüleyin.", route: "/payments", permissionKey: "finance.view" },
      { title: "Finans Hareketi", description: "Yeni finans hareketi kaydı oluşturun.", route: "/finans/hareketler/yeni", permissionKey: "finance.view" },
      { title: "Raporlar", description: "Gider ve ödeme raporlarını açın.", route: "/finans/raporlar", permissionKey: "finance.view" },
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
      { title: "Stok Kartları", description: "Malzeme ve ürün stok kartlarını yönetin.", route: "/inventory", permissionKey: "inventory.view" },
      { title: "Stok Hareketleri", description: "Giriş, çıkış ve düzeltme hareketlerini takip edin.", route: "/inventory-movements", permissionKey: "inventory.view" },
      { title: "Satın Alma", description: "Stok bağlantılı satın alma kayıtlarına geçin.", route: "/purchase-orders", permissionKey: "purchasing.view" },
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
      { title: "Satın Alma Paneli", description: "Satın alma genel ekranına geçin.", route: "/purchasing", permissionKey: "purchasing.view" },
      { title: "Satın Alma Siparişleri", description: "Tedarik siparişlerini yönetin.", route: "/purchase-orders", permissionKey: "purchasing.view" },
      { title: "Tedarikçiler", description: "Tedarikçi kartlarını açın.", route: "/tedarikciler", permissionKey: "crm.view" },
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
      { title: "Üretim Paneli", description: "Üretim genel durumunu görüntüleyin.", route: "/production", permissionKey: "production.view" },
      { title: "İş Emirleri", description: "İş emirlerini ve operasyon durumlarını yönetin.", route: "/work-orders", permissionKey: "production.view" },
      { title: "Rotalar", description: "Üretim rota şablonlarını yönetin.", route: "/routes", permissionKey: "production.view" },
      { title: "Fason İşler", description: "Fason süreçleri takip edin.", route: "/subcontracting", permissionKey: "production.view" },
      { title: "Dişli Hesaplama", description: "Üretim hesaplama araçlarını açın.", route: "/calculator", permissionKey: "production.view" },
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
      { title: "Kalite Raporları", description: "Kontrol raporları ve ölçümleri yönetin.", route: "/quality", permissionKey: "quality.view" },
      { title: "İş Emirleri", description: "Kalite kontrol bekleyen iş emirlerine geçin.", route: "/work-orders", permissionKey: "production.view" },
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
      { title: "Bakım Görevleri", description: "Planlı bakım ve arıza kayıtlarını yönetin.", route: "/maintenance", permissionKey: "maintenance.view" },
      { title: "Makineler", description: "Makine bağlantılı üretim ekranlarına geçin.", route: "/routes", permissionKey: "production.view" },
    ],
  },
  {
    id: "repair",
    title: "Tamir Yönetimi",
    description: "Tamir işleri için üretim ve bakım ekranlarına hızlı geçiş.",
    route: "/apps/repair",
    icon: ClipboardCheck,
    permissionKey: "production.view",
    modules: [
      { title: "Tamir İş Emirleri", description: "Tamir işleri için iş emirlerini açın.", route: "/work-orders", permissionKey: "production.view" },
      { title: "Bakım Görevleri", description: "Arıza ve bakım kayıtlarına geçin.", route: "/maintenance", permissionKey: "maintenance.view" },
      { title: "Kalite Kontrol", description: "Tamir sonrası kalite raporlarını açın.", route: "/quality", permissionKey: "quality.view" },
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
      { title: "Çalışanlar", description: "Çalışan kartları, durum ve kullanıcı bağlantılarını yönetin.", route: "/hr", permissionKey: "hr.view" },
      { title: "Departmanlar", description: "Organizasyon departmanlarını ve yöneticilerini takip edin.", route: "/hr/departmanlar", permissionKey: "hr.view" },
      { title: "Pozisyonlar", description: "Pozisyon ve raporlama yapısını yönetin.", route: "/hr/pozisyonlar", permissionKey: "hr.view" },
      { title: "Devam Takibi", description: "Çalışma saati ve mesai kayıtlarını takip edin.", route: "/hr/devam", permissionKey: "hr.view" },
      { title: "İzin Yönetimi", description: "İzin taleplerini ve durumlarını izleyin.", route: "/hr/izinler", permissionKey: "hr.view" },
      { title: "İşe Alım", description: "Aday kayıtları ve işe alım sürecini yönetin.", route: "/hr/ise-alim", permissionKey: "hr.view" },
      { title: "Oryantasyon", description: "Yeni çalışan görevlerini takip edin.", route: "/hr/oryantasyon", permissionKey: "hr.view" },
      { title: "Çalışma Süreleri", description: "Personel çalışma kayıtlarını listeleyin.", route: "/time-entries", permissionKey: "hr.view" },
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
      { title: "Yönetim Paneli", description: "ERP genel KPI ve yönetim görünürlüğünü açın.", route: "/reports", permissionKey: "reports.view" },
      { title: "Sağlık Merkezi", description: "Operasyon sağlığı, audit kayıtları ve platform olaylarını izleyin.", route: "/health", permissionKey: "reports.view" },
      { title: "Satış Raporları", description: "Teklif, sipariş ve satış tutarlarını analiz edin.", route: "/reports", permissionKey: "reports.view" },
      { title: "CRM Raporları", description: "Müşteri, aday ve fırsat dağılımlarını görüntüleyin.", route: "/reports", permissionKey: "reports.view" },
      { title: "Stok Raporları", description: "Stok kartları, kritik stok ve hareket eğilimlerini izleyin.", route: "/reports", permissionKey: "reports.view" },
      { title: "Satın Alma Raporları", description: "Satın alma siparişleri ve tedarik akışını analiz edin.", route: "/reports", permissionKey: "reports.view" },
      { title: "Üretim Raporları", description: "İş emri ve üretim durumlarını takip edin.", route: "/reports", permissionKey: "reports.view" },
      { title: "Finans Raporları", description: "Fatura, alacak, borç ve hesap bakiyelerini görüntüleyin.", route: "/reports", permissionKey: "reports.view" },
      { title: "İnsan Kaynakları Raporları", description: "Çalışan ve departman dağılımlarını inceleyin.", route: "/reports", permissionKey: "reports.view" },
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
      { title: "ERP Ayarları", description: "ERP yapılandırma ekranını açın.", route: "/settings", permissionKey: "settings.view" },
      { title: "Yönetim Ayarları", description: "Yönetim ve erişim ayarlarına geçin.", route: "/ayarlar", permissionKey: "settings.view" },
      { title: "Veritabanı Durumu", description: "Migration ve RLS kontrol ekranlarını görüntüleyin.", route: "/dashboard", permissionKey: "dashboard.view" },
    ],
  },
  {
    id: "ebru-preview",
    title: "Ebru UI Preview",
    description: "Frontend tasarım çalışmalarını görüntüle",
    route: "/apps/ebru-preview",
    icon: Palette,
    permissionKey: "dashboard.view",
    modules: [],
  },
];

export function getErpApplication(id: string | undefined) {
  return erpApplications.find((app) => app.id === id);
}
