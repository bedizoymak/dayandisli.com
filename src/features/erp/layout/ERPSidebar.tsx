import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Boxes,
  ChartPie,
  ClipboardCheck,
  Factory,
  FileText,
  HardHat,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  Wallet,
  UserCircle,
} from "lucide-react";

const navItems = [
  { href: "/erp/dashboard", label: "Ana Panel", icon: ChartPie },
  { href: "/erp/crm", label: "CRM", icon: Users },
  { href: "/erp/quotations", label: "Teklifler", icon: FileText },
  { href: "/erp/sales-orders", label: "Siparisler", icon: ShoppingCart },
  { href: "/erp/production", label: "Üretim", icon: Factory },
  { href: "/erp/work-orders", label: "Is Emirleri", icon: HardHat },
  { href: "/erp/routes", label: "Rotalar", icon: Boxes },
  { href: "/erp/subcontracting", label: "Fason", icon: ShieldCheck },
  { href: "/erp/inventory", label: "Stok", icon: Package },
  { href: "/erp/inventory-movements", label: "Stok Hareket", icon: ClipboardCheck },
  { href: "/erp/finance", label: "Finans", icon: Wallet },
  { href: "/erp/invoices", label: "Faturalar", icon: FileText },
  { href: "/erp/payments", label: "Ödemeler", icon: Wallet },
  { href: "/erp/hr", label: "Personel", icon: UserCircle },
  { href: "/erp/time-entries", label: "Puantaj", icon: ClipboardCheck },
  { href: "/erp/logistics", label: "Lojistik", icon: Truck },
  { href: "/erp/quality", label: "Kalite", icon: ClipboardCheck },
  { href: "/erp/maintenance", label: "Bakim", icon: Wrench },
  { href: "/erp/documents", label: "Doküman", icon: FileText },
  { href: "/erp/reports", label: "Raporlar", icon: ChartPie },
  { href: "/erp/settings", label: "Ayarlar", icon: Settings },
];

type ERPSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function ERPSidebar({ mobileOpen, onCloseMobile }: ERPSidebarProps) {
  const location = useLocation();

  return (
    <>
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-card/50">
        <div className="px-4 py-4 border-b">
          <p className="text-xs text-muted-foreground">Modüler Sistem</p>
          <h2 className="font-semibold">ERP Menü</h2>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile}>
          <aside className="h-full w-72 bg-background border-r p-3" onClick={(e) => e.stopPropagation()}>
            <div className="px-2 py-3 border-b mb-2">
              <p className="text-xs text-muted-foreground">Modüler Sistem</p>
              <h2 className="font-semibold">ERP Menü</h2>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onCloseMobile}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
