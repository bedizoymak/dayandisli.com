import { ReactNode, useState } from "react";
import { ERPSidebar } from "./ERPSidebar";
import { ERPTopBar } from "./ERPTopBar";
import { useIsInsideUnifiedErpShell } from "@/features/erp/unified-shell/UnifiedErpShellContext";

type ERPLayoutProps = {
  title: string;
  children: ReactNode;
};

export function ERPLayout({ title, children }: ERPLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isEmbedded = useIsInsideUnifiedErpShell();

  // When UnifiedErpShell already mounted the sidebar/topbar for /apps/*, pages
  // that still call <ERPLayout> just render their content frame — this is what
  // prevents a duplicate shell without rewriting every page.
  if (isEmbedded) {
    return <div className="min-w-0 space-y-6">{children}</div>;
  }

  return (
    <div className="erp-theme erp-shell">
      <ERPTopBar title={title} onMenuToggle={() => setMobileOpen((prev) => !prev)} />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <ERPSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <main className="min-w-0 flex-1 space-y-6 p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
