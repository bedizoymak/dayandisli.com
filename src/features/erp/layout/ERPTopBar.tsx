import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Factory, LogOut, Menu, Search, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/erp/NotificationCenter";
import { QuickActionMenu } from "@/components/erp/QuickActionMenu";
import { supabase } from "@/integrations/supabase/client";
import { createAuditLog } from "../shared/erpApi";

type ERPTopBarProps = {
  title: string;
  onMenuToggle?: () => void;
};

export function ERPTopBar({ title, onMenuToggle }: ERPTopBarProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setEmail(data.session?.user.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const initials = useMemo(() => {
    if (!email) return "DD";
    return email
      .split("@")[0]
      .split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [email]);

  const handleLogout = async () => {
    await createAuditLog({
      entity_type: "auth_session",
      action: "logout",
      description: `${email ?? "Bilinmeyen kullanıcı"} ERP oturumunu kapattı.`,
      metadata: { email },
    });
    await supabase.auth.signOut();
    localStorage.removeItem("auth_redirect_path");
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-erp-surface/95 shadow-lg shadow-black/10 backdrop-blur supports-[backdrop-filter]:bg-erp-surface/80">
      <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/apps">Uygulamalar</Link>
          </Button>
          <Link to="/apps" className="flex min-w-0 items-center gap-3">
            <div className="erp-icon-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Factory className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dayan Dişli</p>
              <h1 className="truncate text-sm font-semibold text-foreground md:text-base">{title}</h1>
            </div>
          </Link>
        </div>

        <div className="hidden min-w-[240px] max-w-md flex-1 md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 border-border/80 bg-muted/40 pl-9 focus-visible:ring-primary" placeholder="Modül, müşteri veya teklif ara..." />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationCenter />
          <QuickActionMenu />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                {email ? <span className="text-xs font-semibold">{initials}</span> : <UserCircle className="h-5 w-5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <span className="block text-sm">Kullanıcı</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">{email || "Oturum bilgisi alınıyor"}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/ayarlar">Ayarlar</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
