import { ReactNode, useState } from "react";
import { ParasutSidebar } from "./ParasutSidebar";
import { ParasutTopBar } from "./ParasutTopBar";
import { useIsInsideUnifiedErpShell } from "@/features/erp/unified-shell/UnifiedErpShellContext";

const BASE_PATH = "/apps/parasut";

export function ParasutLayout({ title, children }: { title: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isEmbedded = useIsInsideUnifiedErpShell();

  // Inside the unified ERP shell, Paraşüt keeps its own secondary module
  // navigation (genuinely module-specific) but must not render a second
  // full-width app topbar on top of the shell's own header.
  if (isEmbedded) {
    return (
      <div className="flex min-w-0 flex-1">
        <ParasutSidebar basePath={BASE_PATH} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <main className="min-w-0 flex-1 space-y-6 p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    );
  }

  return (
    <div className="erp-theme flex min-h-screen bg-background text-foreground">
      <ParasutSidebar basePath={BASE_PATH} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ParasutTopBar title={title} onMenuToggle={() => setMobileOpen((prev) => !prev)} />
        <main className="min-w-0 flex-1 space-y-6 p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
