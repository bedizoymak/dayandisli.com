import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mockNotifications, type MockNotificationCategory } from "@/data/mockNotifications";
import { cn } from "@/lib/utils";

type NotificationFilter = "all" | MockNotificationCategory;

const filters: Array<{ id: NotificationFilter; label: string }> = [
  { id: "all", label: "Tümü" },
  { id: "assigned", label: "Bana Atanan" },
  { id: "system", label: "Sistem" },
  { id: "activity", label: "İşlem Geçmişi" },
];

export function NotificationCenter() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unreadCount = mockNotifications.filter((item) => item.unread).length;
  const visibleNotifications = useMemo(
    () => mockNotifications.filter((item) => filter === "all" || item.category === filter),
    [filter],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,420px)] p-0">
        <div className="p-4">
          <DropdownMenuLabel className="p-0 text-base">Bildirim Merkezi</DropdownMenuLabel>
          <p className="mt-1 text-xs text-muted-foreground">Gerçek tablo hazır olduğunda bu yapı Supabase verisine bağlanabilir.</p>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="flex gap-1 overflow-x-auto p-3">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="max-h-[360px] overflow-y-auto px-3 pb-3">
          {visibleNotifications.map((notification) => (
            <div key={notification.id} className="mb-2 rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{notification.description}</p>
                </div>
                {notification.unread ? <span className="mt-1 h-2 w-2 rounded-full bg-primary" /> : null}
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">{notification.time}</p>
            </div>
          ))}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/erp/bildirimler">Tüm Bildirimleri Aç</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
