import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Settings, Scale, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalculatorLayoutProps {
  children: ReactNode;
}

export function CalculatorLayout({ children }: CalculatorLayoutProps) {
  const location = useLocation();
  const embeddedInErp = location.pathname.startsWith("/calculator");

  const navItems = [
    { href: "/calculator", label: "Ana Sayfa", icon: Home },
    { href: "/calculator/machines", label: "Makineler", icon: Settings },
    { href: "/calculator/weight", label: "Ağırlık Hesaplama", icon: Scale },
  ];

  const header = (
    <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
      <div className={embeddedInErp ? "px-4" : "container mx-auto px-4"}>
        <div className="flex min-h-16 flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
          <Link to="/calculator" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">DAYAN CALCULATOR</h1>
              <p className="text-xs text-slate-400">Dişli hesaplama aracı</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700/50 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );

  if (embeddedInErp) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950 shadow-sm">
        {header}
        <main className="px-4 py-6 md:px-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {header}
      <main className="container mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-slate-700/50 bg-slate-900/50 mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-slate-500">
            © {new Date().getFullYear()} Dayan Dişli Sanayi - DAYAN CALCULATOR
          </p>
        </div>
      </footer>
    </div>
  );
}
