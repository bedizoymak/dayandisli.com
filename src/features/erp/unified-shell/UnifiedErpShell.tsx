import { lazy, Suspense, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { ERPSidebar } from "@/features/erp/layout/ERPSidebar";
import { ERPTopBar } from "@/features/erp/layout/ERPTopBar";
import { UnifiedErpShellProvider } from "./UnifiedErpShellContext";
import "./unified-erp-shell.css";

const ERPRoutes = lazy(() => import("@/features/erp").then((module) => ({ default: module.ERPRoutes })));
const ParasutModuleRoutes = lazy(() =>
  import("@/features/erp/parasut").then((module) => ({ default: module.ParasutModuleRoutes })),
);

function ShellLoading() {
  return <div className="min-w-0 flex-1 space-y-6 p-4 text-sm text-muted-foreground md:p-6 xl:p-8">Sayfa yükleniyor...</div>;
}

// Mounted once at /apps/* — every real ERP module renders inside this single
// sidebar + top header. /apps/ebru-preview/* is declared as a sibling route in
// App.tsx and never passes through here.
export function UnifiedErpShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <UnifiedErpShellProvider>
      <div className="erp-theme erp-shell unified-erp-shell">
        <ERPTopBar title="ERP" onMenuToggle={() => setMobileOpen((prev) => !prev)} />
        <div className="flex min-h-[calc(100vh-4rem)]">
          <ERPSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
          <Suspense fallback={<ShellLoading />}>
            <Routes>
              <Route path="parasut/*" element={<ParasutModuleRoutes />} />
              <Route path="*" element={<ERPRoutes />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </UnifiedErpShellProvider>
  );
}

export default UnifiedErpShell;
