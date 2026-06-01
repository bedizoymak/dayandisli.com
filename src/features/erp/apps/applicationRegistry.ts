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
};

export const erpApplications: ErpApplication[] = [
  {
    id: "website",
    title: "Web Sitesi",
    description: "Site içeriği, ürün görünürlüğü ve yönetim ekranları.",
    route: "/admin",
    icon: Globe2,
    permissionKey: "website.view",
  },
  {
    id: "commerce",
    title: "E-Ticaret",
    description: "Mağaza siparişleri, ürün katalogları ve satış akışı.",
    route: "/admin/siparisler",
    icon: ShoppingBag,
    permissionKey: "commerce.view",
  },
  {
    id: "crm",
    title: "Müşteri İlişkileri",
    description: "Müşteri, tedarikçi ve fason firma kartları.",
    route: "/crm",
    icon: HeartHandshake,
    permissionKey: "crm.view",
  },
  {
    id: "sales",
    title: "Satış",
    description: "Teklifler, satış siparişleri ve müşteri talepleri.",
    route: "/teklifler",
    icon: ShoppingCart,
    permissionKey: "sales.view",
  },
  {
    id: "invoicing",
    title: "Faturalama",
    description: "Satış ve alış faturalarının operasyon takibi.",
    route: "/invoices",
    icon: ReceiptText,
    permissionKey: "invoicing.view",
  },
  {
    id: "accounting",
    title: "Muhasebe",
    description: "Finans hareketleri, tahsilat ve ödeme kayıtları.",
    route: "/finans",
    icon: Calculator,
    permissionKey: "accounting.view",
  },
  {
    id: "expenses",
    title: "Gider Yönetimi",
    description: "Gider kayıtları ve ödeme çıkışlarının takibi.",
    route: "/payments",
    icon: CreditCard,
    permissionKey: "expenses.view",
  },
  {
    id: "inventory",
    title: "Stok Yönetimi",
    description: "Malzeme, ürün ve depo hareketleri.",
    route: "/inventory",
    icon: PackageSearch,
    permissionKey: "inventory.view",
  },
  {
    id: "purchasing",
    title: "Satın Alma",
    description: "Satın alma siparişleri ve tedarik akışı.",
    route: "/purchasing",
    icon: HandCoins,
    permissionKey: "purchasing.view",
  },
  {
    id: "production",
    title: "Üretim",
    description: "İş emirleri, rotalar ve üretim operasyonları.",
    route: "/production",
    icon: Factory,
    permissionKey: "production.view",
  },
  {
    id: "quality",
    title: "Kalite Yönetimi",
    description: "Kalite raporları, ölçümler ve kontrol kayıtları.",
    route: "/quality",
    icon: ShieldCheck,
    permissionKey: "quality.view",
  },
  {
    id: "maintenance",
    title: "Bakım Yönetimi",
    description: "Makine bakım planları ve arıza kayıtları.",
    route: "/maintenance",
    icon: Wrench,
    permissionKey: "maintenance.view",
  },
  {
    id: "repair",
    title: "Tamir Yönetimi",
    description: "Tamir işleri için üretim ve bakım ekranlarına hızlı geçiş.",
    route: "/work-orders",
    icon: ClipboardCheck,
    permissionKey: "repair.view",
  },
  {
    id: "hr",
    title: "İnsan Kaynakları",
    description: "Personel kayıtları ve çalışma süreleri.",
    route: "/hr",
    icon: Users,
    permissionKey: "hr.view",
  },
  {
    id: "reports",
    title: "Raporlar",
    description: "Yönetim, finans, üretim ve stok raporları.",
    route: "/reports",
    icon: BarChart3,
    permissionKey: "reports.view",
  },
  {
    id: "settings",
    title: "Ayarlar",
    description: "Sistem, erişim ve ERP yapılandırması.",
    route: "/settings",
    icon: Settings,
    permissionKey: "settings.view",
  },
];
