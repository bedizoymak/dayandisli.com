import { ReactNode, useState } from "react";
import { ERPSidebar } from "./ERPSidebar";
import { ERPTopBar } from "./ERPTopBar";

type ERPLayoutProps = {
  title: string;
  children: ReactNode;
};

export function ERPLayout({ title, children }: ERPLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <ERPTopBar title={title} onMenuToggle={() => setMobileOpen((prev) => !prev)} />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <ERPSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <main className="min-w-0 flex-1 space-y-6 p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
