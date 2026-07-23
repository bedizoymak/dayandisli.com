import {
  BarChart3,
  Banknote,
  FileStack,
  HandCoins,
  LayoutDashboard,
  Package,
  ReceiptText,
  RefreshCw,
  Boxes,
  FileCheck2,
  UserRound,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ParasutNavLeaf {
  id: string;
  label: string;
  route: string;
  available: boolean;
  unavailableReason?: string;
  requiredPermission?: string;
}

export interface ParasutNavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  requiredPermission?: string;
  items: ParasutNavLeaf[];
}

const MISSING_RESOURCE_MESSAGE = "Bu veri kaynağı mevcut Paraşüt aynasında bulunmuyor.";

export const parasutNavigation: ParasutNavGroup[] = [
  {
    id: "dashboard",
    label: "Güncel Durum",
    icon: LayoutDashboard,
    route: "",
    items: [],
  },
  {
    id: "sales",
    label: "Satışlar",
    icon: ShoppingCart,
    items: [
      { id: "quotes", label: "Teklifler", route: "satislar/teklifler", available: true },
      { id: "sales-invoices", label: "Faturalar", route: "satislar/faturalar", available: true },
      { id: "customers", label: "Müşteriler", route: "satislar/musteriler", available: true },
      { id: "sales-report", label: "Satışlar Raporu", route: "raporlar/satis", available: true },
      { id: "collections-report", label: "Tahsilatlar Raporu", route: "raporlar/tahsilat", available: true },
      { id: "income-expense-report", label: "Gelir Gider Raporu", route: "raporlar/gelir-gider", available: true },
    ],
  },
  {
    id: "purchasing",
    label: "Alışlar",
    icon: ShoppingBag,
    items: [
      { id: "expenses", label: "Giderler", route: "finans/giderler", available: true },
      { id: "purchase-bills", label: "Alış Faturaları", route: "alislar/faturalar", available: true },
      { id: "suppliers", label: "Tedarikçiler", route: "alislar/tedarikciler", available: true },
    ],
  },
  {
    id: "products",
    label: "Ürünler ve Hizmetler",
    icon: Package,
    route: "urunler",
    items: [],
  },
  {
    id: "accounts",
    label: "Kasa ve Bankalar",
    icon: Wallet,
    route: "kasa-banka",
    items: [],
  },
  {
    id: "collections",
    label: "Tahsilatlar",
    icon: HandCoins,
    route: "tahsilatlar",
    items: [],
  },
  {
    id: "payments",
    label: "Ödemeler",
    icon: ReceiptText,
    route: "odemeler",
    items: [],
  },
  {
    id: "finance-detail",
    label: "Finans Detayları",
    icon: Banknote,
    items: [
      { id: "transactions", label: "Hesap Hareketleri", route: "finans/hareketler", available: true },
      { id: "taxes", label: "Vergiler", route: "finans/vergiler", available: true },
    ],
  },
  {
    id: "stock",
    label: "Stok ve Depo",
    icon: Boxes,
    items: [
      { id: "inventory-levels", label: "Mevcut Stok", route: "stok/mevcut", available: true },
      { id: "stock-movements", label: "Stok Geçmişi", route: "stok/hareketler", available: true },
      { id: "stock-updates", label: "Stok Güncellemeleri", route: "stok/guncellemeler", available: true },
      { id: "shipments", label: "İrsaliyeler", route: "stok/irsaliyeler", available: true },
      { id: "categories", label: "Kategoriler", route: "stok/kategoriler", available: true },
    ],
  },
  {
    id: "hr",
    label: "İnsan Kaynakları",
    icon: UserRound,
    items: [
      { id: "employees", label: "Çalışanlar", route: "ik/calisanlar", available: true },
      { id: "salaries", label: "Maaşlar", route: "ik/maaslar", available: true },
    ],
  },
  {
    id: "e-documents",
    label: "E-Belgeler",
    icon: FileCheck2,
    items: [
      { id: "e-invoices", label: "E-Faturalar", route: "e-belgeler/e-faturalar", available: true },
      { id: "e-invoice-inboxes", label: "Gelen Kutuları", route: "e-belgeler/gelen-kutulari", available: true },
      { id: "e-archives", label: "E-Arşivler", route: "e-belgeler/e-arsivler", available: true },
      { id: "e-smms", label: "E-SMM", route: "e-belgeler/e-smm", available: true },
    ],
  },
  {
    id: "reports",
    label: "Raporlar",
    icon: BarChart3,
    route: "raporlar",
    items: [],
  },
  {
    id: "sync",
    label: "Senkronizasyon",
    icon: RefreshCw,
    route: "senkronizasyon",
    requiredPermission: "parasut.sync.view",
    items: [],
  },
  {
    id: "jobs",
    label: "Entegrasyon İşleri",
    icon: RefreshCw,
    route: "sistem/isler",
    requiredPermission: "parasut.sync.view",
    items: [],
  },
];

export const PARASUT_SYNC_PERMISSION = "parasut.sync.view";
export const PARASUT_MODULE_ICON: LucideIcon = Banknote;
export const PARASUT_MISSING_RESOURCE_MESSAGE = MISSING_RESOURCE_MESSAGE;
export const PARASUT_DOCUMENT_STACK_ICON = FileStack;
export const PARASUT_PEOPLE_ICON = Users;
