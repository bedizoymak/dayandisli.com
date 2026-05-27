import {
  Bell,
  Calculator,
  ClipboardList,
  Factory,
  FileText,
  Handshake,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  StickyNote,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ErpModuleStatus = "active" | "beta" | "soon";

export type ErpModuleConfig = {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  status: ErpModuleStatus;
  requiredPermission?: string;
  visible?: boolean;
};

export const erpModules: ErpModuleConfig[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Günlük operasyon özeti ve hızlı erişimler",
    path: "/dashboard",
    icon: LayoutDashboard,
    status: "active",
  },
  {
    id: "customers",
    title: "Müşteriler",
    description: "Müşteri cari kartları, finans bakiyesi ve ilişki takibi",
    path: "/musteriler",
    icon: Users,
    status: "active",
  },
  {
    id: "suppliers",
    title: "Tedarikçiler",
    description: "Tedarikçi kartları, satın alma ve ödeme takibi",
    path: "/tedarikciler",
    icon: Handshake,
    status: "active",
  },
  {
    id: "erp",
    title: "ERP",
    description: "Üretim, stok, kalite ve sevkiyat yönetimi",
    path: "/",
    icon: Factory,
    status: "active",
    visible: false,
  },
  {
    id: "quotations",
    title: "Teklifler",
    description: "Teklif oluşturma, PDF, e-posta ve WhatsApp akışı",
    path: "/teklifler",
    icon: FileText,
    status: "active",
  },
  {
    id: "orders",
    title: "Siparişler",
    description: "Satış siparişleri ve iş emri dönüşümleri",
    path: "/siparisler",
    icon: ShoppingCart,
    status: "active",
  },
  {
    id: "finance",
    title: "Finans",
    description: "Cari hesap, ödeme ve resmi/operasyonel takip",
    path: "/finans",
    icon: Wallet,
    status: "active",
  },
  {
    id: "cargo",
    title: "Kargo",
    description: "Müşteri bazlı kargo etiketi ve PDF çıktısı",
    path: "/kargo",
    icon: Package,
    status: "active",
  },
  {
    id: "calculator",
    title: "Calculator",
    description: "Dişli hesaplama ve üretim reçetesi araçları",
    path: "/calculator",
    icon: Calculator,
    status: "active",
  },
  {
    id: "notifications",
    title: "Bildirimler",
    description: "Sistem uyarıları ve işlem geçmişi",
    path: "/bildirimler",
    icon: Bell,
    status: "active",
  },
  {
    id: "tasks",
    title: "Görevler",
    description: "Atanan işler ve takip listesi",
    path: "/gorevler",
    icon: ClipboardList,
    status: "soon",
  },
  {
    id: "notes",
    title: "Notlar",
    description: "Operasyon notları ve iç kayıtlar",
    path: "/notlar",
    icon: StickyNote,
    status: "soon",
  },
  {
    id: "settings",
    title: "Ayarlar",
    description: "ERP yapılandırma ve sistem ayarları",
    path: "/ayarlar",
    icon: Settings,
    status: "active",
  },
  {
    id: "logistics",
    title: "Sevkiyat",
    description: "ERP sevkiyat ve lojistik kayıtları",
    path: "/logistics",
    icon: Truck,
    status: "active",
    visible: false,
  },
];

export const visibleErpModules = erpModules.filter((module) => module.visible !== false);

export const dashboardModuleIds = ["customers", "suppliers", "quotations", "calculator", "orders", "cargo", "finance", "notifications"];

export const dashboardModules = visibleErpModules.filter((module) => dashboardModuleIds.includes(module.id));
