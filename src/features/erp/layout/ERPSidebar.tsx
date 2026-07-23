import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { cn } from "@/lib/utils";
import { buildUnifiedNavigation } from "@/features/erp/unified-shell/unifiedNavigation";

type ERPSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

function isItemActive(pathname: string, itemPath: string) {
  return (
    pathname === itemPath ||
    (itemPath !== "/" && pathname.startsWith(`${itemPath}/`)) ||
    (itemPath === "/dashboard" && pathname === "/apps") ||
    (itemPath === "/finans" && pathname.startsWith("/finance")) ||
    (itemPath === "/teklifler" && pathname.startsWith("/quotations")) ||
    (itemPath === "/siparisler" && pathname.startsWith("/sales-orders"))
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { hasPermission } = useERPAuth();
  const groups = buildUnifiedNavigation(hasPermission);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/80 px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dayan Dişli</p>
        <h2 className="mt-1 text-base font-semibold">ERP Operasyon Merkezi</h2>
      </div>
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {groups.map((group) => {
          const isCollapsed = collapsedGroups[group.id] ?? false;
          const groupHasActiveItem = group.items.some((item) => isItemActive(location.pathname, item.path));

          return (
            <div key={group.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={!isCollapsed}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  groupHasActiveItem ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{group.label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")} />
              </button>

              {isCollapsed ? null : (
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = isItemActive(location.pathname, item.path);

                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={onNavigate}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isActive
                            ? "border border-primary/20 bg-primary/15 text-primary shadow-sm shadow-primary/10"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {item.status === "soon" ? <span className="rounded border border-border bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">Yakında</span> : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
      <aside className="hidden w-72 shrink-0 border-r border-border/80 bg-erp-surface/80 shadow-xl shadow-black/10 backdrop-blur lg:block">
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
