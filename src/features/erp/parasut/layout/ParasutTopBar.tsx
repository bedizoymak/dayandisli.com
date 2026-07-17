import { Link } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useERPAuth } from "@/contexts/ERPAuthContext";

export function ParasutTopBar({ title, onMenuToggle }: { title: string; onMenuToggle: () => void }) {
  const { erpUser, signOut } = useERPAuth();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-erp-border bg-erp-surface px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle} aria-label="Menüyü aç">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-primary">Paraşüt</p>
          <h1 className="truncate text-base font-semibold text-erp-text md:text-lg">{title}</h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="hidden text-right md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-erp-muted">Dayan Dişli</p>
          <p className="truncate text-sm text-erp-text">{erpUser?.full_name || erpUser?.email || "—"}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/apps">Uygulamalar</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void signOut()} className="text-erp-muted hover:text-erp-text">
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Çıkış Yap</span>
        </Button>
      </div>
    </header>
  );
}
