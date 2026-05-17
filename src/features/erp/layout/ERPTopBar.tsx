import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Factory, LayoutDashboard, PanelLeft } from "lucide-react";

type ERPTopBarProps = {
  title: string;
  onMenuToggle?: () => void;
};

export function ERPTopBar({ title, onMenuToggle }: ERPTopBarProps) {
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
