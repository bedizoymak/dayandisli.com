import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { visibleErpModules } from "@/config/erpModules";
import { cn } from "@/lib/utils";

type ERPSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/80 px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operasyon</p>
        <h2 className="mt-1 text-base font-semibold">ERP Modülleri</h2>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {visibleErpModules.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.id !== "erp" && location.pathname.startsWith(`${item.path}/`)) ||
            (item.id === "dashboard" && location.pathname === "/dashboard") ||
            (item.id === "quotations" && location.pathname.startsWith("/quotations")) ||
            (item.id === "orders" && location.pathname.startsWith("/sales-orders")) ||
            (item.id === "finance" && location.pathname.startsWith("/finance")) ||
            (item.id === "notifications" && location.pathname.startsWith("/notifications")) ||
            (item.id === "settings" && location.pathname.startsWith("/settings"));

          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.status === "soon" ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Yakında</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/80 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Dayan Dişli operasyon merkezi. Rol bazlı izinler için modül yapılandırması hazırlandı.
        </p>
      </div>
    </div>
  );
}

export function ERPSidebar({ mobileOpen, onCloseMobile }: ERPSidebarProps) {
  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-border/80 bg-card/70 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onCloseMobile}>
          <aside
            className="h-full w-[min(84vw,320px)] overflow-hidden border-r border-border bg-background shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-end border-b px-3 py-3">
              <Button variant="ghost" size="icon" onClick={onCloseMobile}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent onNavigate={onCloseMobile} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
