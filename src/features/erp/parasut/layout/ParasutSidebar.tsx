import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { cn } from "@/lib/utils";
import { PARASUT_MODULE_ICON, parasutNavigation, type ParasutNavGroup } from "../navigation";

function isGroupActive(group: ParasutNavGroup, pathname: string, basePath: string) {
  if (group.route !== undefined) return pathname === `${basePath}/${group.route}`.replace(/\/$/, "") || (group.route === "" && pathname === basePath);
  return group.items.some((item) => pathname.startsWith(`${basePath}/${item.route}`));
}

function NavIconButton({ group, basePath, onNavigate }: { group: ParasutNavGroup; basePath: string; onNavigate?: () => void }) {
  const location = useLocation();
  const { hasPermission } = useERPAuth();
  const active = isGroupActive(group, location.pathname, basePath);
  const allowed = !group.requiredPermission || hasPermission(group.requiredPermission);
  const Icon = group.icon;

  if (!allowed) return null;

  if (group.route !== undefined) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={`${basePath}/${group.route}`.replace(/\/$/, "") || basePath}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-erp-surface",
                active ? "border-primary/40 bg-primary/15 text-primary" : "border-transparent text-erp-muted hover:bg-erp-surface-raised hover:text-erp-text",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">{group.label}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{group.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-erp-surface",
                  active ? "border-primary/40 bg-primary/15 text-primary" : "border-transparent text-erp-muted hover:bg-erp-surface-raised hover:text-erp-text",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">{group.label}</span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{group.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent side="right" align="start" className="w-64">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
        {group.items.map((item) => (
          <DropdownMenuItem key={item.id} asChild disabled={!item.available}>
            {item.available ? (
              <Link to={`${basePath}/${item.route}`} onClick={onNavigate} className="cursor-pointer">
                {item.label}
              </Link>
            ) : (
              <span className="flex w-full items-center justify-between text-muted-foreground" title={item.unavailableReason}>
                {item.label}
                <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px]">Yakında</span>
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({ basePath, onNavigate, showLabels }: { basePath: string; onNavigate?: () => void; showLabels?: boolean }) {
  const { hasPermission } = useERPAuth();
  const Icon = PARASUT_MODULE_ICON;

  if (showLabels) {
    return (
      <nav className="space-y-4 p-3">
        {parasutNavigation.map((group) => {
          if (group.requiredPermission && !hasPermission(group.requiredPermission)) return null;
          return (
            <div key={group.id}>
              {group.route !== undefined ? (
                <Link
                  to={`${basePath}/${group.route}`.replace(/\/$/, "") || basePath}
                  onClick={onNavigate}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-erp-muted hover:bg-erp-surface-raised hover:text-erp-text"
                >
                  <group.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {group.label}
                </Link>
              ) : (
                <div>
                  <p className="flex items-center gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-erp-muted">
                    <group.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {group.label}
                  </p>
                  <div className="ml-4 space-y-0.5 border-l border-erp-border pl-3">
                    {group.items.map((item) =>
                      item.available ? (
                        <Link key={item.id} to={`${basePath}/${item.route}`} onClick={onNavigate} className="block rounded-md px-2 py-1.5 text-sm text-erp-muted hover:bg-erp-surface-raised hover:text-erp-text">
                          {item.label}
                        </Link>
                      ) : (
                        <span key={item.id} title={item.unavailableReason} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-erp-muted/60">
                          {item.label}
                          <span className="ml-2 rounded border border-border px-1 text-[10px]">Yakında</span>
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col items-center gap-2 py-3" aria-label="Paraşüt modül gezinmesi">
      {parasutNavigation.map((group) => (
        <NavIconButton key={group.id} group={group} basePath={basePath} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

export function ParasutSidebar({ basePath, mobileOpen, onCloseMobile }: { basePath: string; mobileOpen: boolean; onCloseMobile: () => void }) {
  const Icon = PARASUT_MODULE_ICON;
  return (
    <>
      <aside className="hidden w-16 shrink-0 flex-col border-r border-erp-border bg-erp-surface lg:flex" aria-label="Paraşüt modülü">
        <Link to={basePath} className="flex h-16 items-center justify-center border-b border-erp-border text-primary" aria-label="Güncel Duruma git">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </Link>
        <SidebarBody basePath={basePath} />
        <div className="mt-auto border-t border-erp-border py-3">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/apps" className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg text-erp-muted hover:bg-erp-surface-raised hover:text-erp-text">
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">ERP Uygulamalarına dön</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">ERP Uygulamalarına Dön</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onCloseMobile}>
          <aside className="h-full w-[min(86vw,320px)] overflow-y-auto border-r border-erp-border bg-erp-surface shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-erp-border px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-erp-text">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                Paraşüt
              </span>
              <Button variant="ghost" size="icon" onClick={onCloseMobile} aria-label="Menüyü kapat">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarBody basePath={basePath} onNavigate={onCloseMobile} showLabels />
            <div className="border-t border-erp-border p-3">
              <Link to="/apps" onClick={onCloseMobile} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-erp-muted hover:bg-erp-surface-raised hover:text-erp-text">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                ERP Uygulamalarına Dön
                <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
