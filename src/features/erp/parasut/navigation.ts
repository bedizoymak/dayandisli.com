import {
  BarChart3,
  Banknote,
  FileStack,
  HandCoins,
  LayoutDashboard,
  Package,
  ReceiptText,
  RefreshCw,
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
      { id: "quotes", label: "Teklifler", route: "satislar/teklifler", available: false, unavailableReason: MISSING_RESOURCE_MESSAGE },
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
      { id: "expenses", label: "Giderler", route: "alislar/giderler", available: false, unavailableReason: MISSING_RESOURCE_MESSAGE },
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
];

export const PARASUT_SYNC_PERMISSION = "parasut.sync.view";
export const PARASUT_MODULE_ICON: LucideIcon = Banknote;
export const PARASUT_MISSING_RESOURCE_MESSAGE = MISSING_RESOURCE_MESSAGE;
export const PARASUT_DOCUMENT_STACK_ICON = FileStack;
export const PARASUT_PEOPLE_ICON = Users;
