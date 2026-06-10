import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createAuditLog } from "../shared/erpApi";
import { ERPUser } from "../shared/types";

type AppsLayoutProps = {
  title: string;
  user?: ERPUser | null;
  children: ReactNode;
};

export function AppsLayout({ title, user, children }: AppsLayoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await createAuditLog({
      entity_type: "auth_session",
      action: "logout",
      description: `${user?.email ?? "Bilinmeyen kullanıcı"} ERP oturumunu kapattı.`,
      metadata: { email: user?.email ?? null },
    });
    await supabase.auth.signOut();
    localStorage.removeItem("auth_redirect_path");
    navigate("/login", { replace: true });
  };

  return (
    <main className="erp-theme apps-launcher-shell">
      <header className="border-b border-border/80 bg-erp-surface/95 shadow-lg shadow-black/10 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/apps" className="flex min-w-0 items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Dayan Dişli" className="h-10 w-auto object-contain" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Dayan Dişli</p>
              <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
              {user?.email ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}
            </div>
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Çıkış Yap
          </Button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</section>
    </main>
  );
}
