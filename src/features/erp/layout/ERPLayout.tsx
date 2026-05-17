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
    <div className="min-h-screen bg-background text-foreground">
      <ERPTopBar title={title} onMenuToggle={() => setMobileOpen((prev) => !prev)} />
      <div className="flex min-h-[calc(100vh-56px)]">
        <ERPSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <main className="flex-1 p-4 md:p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}
