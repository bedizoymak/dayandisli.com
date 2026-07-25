import { ReactNode, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Database,
  Factory,
  FileBarChart,
  Home,
  ImageIcon,
  Menu,
  Package,
  ReceiptText,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AdminLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

const navGroups = [
  {
    label: "Genel",
    items: [
      { label: "Genel Bakış", path: "/admin", icon: Home, end: true },
      { label: "Raporlar", path: "/admin/raporlar", icon: FileBarChart },
    ],
  },
  {
    label: "Site İçeriği",
    items: [
      { label: "Ürün Kataloğu", path: "/admin/urunler", icon: Package },
      { label: "Teklifler", path: "/admin/teklifler", icon: ReceiptText },
      { label: "Mağaza Siparişleri", path: "/admin/siparisler", icon: ShoppingCart },
      { label: "Medya", path: "/admin/medya", icon: ImageIcon },
    ],
  },
  {
    label: "Operasyon",
    items: [
      { label: "Cari Yönetimi", path: "/admin/cariler", icon: Users },
      { label: "Üretim", path: "/admin/uretim", icon: Factory },
      { label: "Stok ve Satın Alma", path: "/admin/stok", icon: Boxes },
      { label: "Kalite ve Bakım", path: "/admin/kalite", icon: ClipboardList },
      { label: "Finans", path: "/admin/finans", icon: BarChart3 },
    ],
  },
  {
    label: "Sistem",
    items: [
      { label: "Ayarlar", path: "/admin/ayarlar", icon: Settings },
      { label: "SQL Düzenleyici", path: "/admin/sql-editor", icon: Database },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#111827] text-slate-100">
      <div className="border-b border-white/10 px-5 py-5">
        <Link to="/apps" onClick={onNavigate} className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Dayan Dişli" className="h-10 w-auto rounded bg-white px-2 py-1" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">ERP</p>
            <h2 className="text-sm font-semibold">Uygulamalar</h2>
          </div>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-sky-500 text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4 text-xs leading-relaxed text-slate-400">
        Ürün, teklif, üretim ve finans verileri aynı Supabase ERP tablolarından yönetilir.
      </div>
    </div>
  );
}

export default function AdminLayout({ title, description, children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 lg:block">
          <Sidebar />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)}>
            <aside className="h-full w-[min(86vw,320px)]" onClick={(event) => event.stopPropagation()}>
              <div className="flex justify-end bg-[#111827] p-3">
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-white hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold md:text-xl">{title}</h1>
                  {description ? <p className="truncate text-sm text-slate-500">{description}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/apps">Uygulamalar</Link>
                </Button>
                <Button variant="ghost" size="icon" title="Yetki" className="hidden md:inline-flex">
                  <Shield className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={signOut}>
                  Çıkış
                </Button>
              </div>
            </div>
          </header>
          <main className="space-y-6 p-4 md:p-6 xl:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
