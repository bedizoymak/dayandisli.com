import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Factory, LayoutDashboard, PanelLeft } from "lucide-react";
import { getUnreadNotificationCount } from "../shared/erpApi";

type ERPTopBarProps = {
  title: string;
  onMenuToggle?: () => void;
};

export function ERPTopBar({ title, onMenuToggle }: ERPTopBarProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    getUnreadNotificationCount().then((result) => {
      if (mounted && !result.error) setUnreadCount(result.data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuToggle}>
            <PanelLeft className="h-5 w-5" />
          </Button>
          <Factory className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">DAYAN Disli ERP</p>
            <h1 className="text-sm md:text-base font-semibold">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/erp/notifications" className="relative">
              <Bell className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Bildirimler</span>
              {unreadCount > 0 ? (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/erp/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Panel
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/apps">Uygulamalar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
