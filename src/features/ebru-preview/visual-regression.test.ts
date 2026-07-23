import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shellSource = readFileSync("src/features/ebru-preview/EbruPreviewPage.tsx", "utf8");
const resourceSource = readFileSync("src/features/ebru-preview/finance-preview/CanonicalParasutPages.tsx", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");

describe("canonical Ebru visual architecture", () => {
  it("keeps canonical routes inside the approved single Ebru shell", () => {
    expect(appSource).toContain('path="/apps/*"');
    expect(appSource).toContain("<EbruPreviewPage />");
    expect(shellSource).toContain('className="ebru-sidebar"');
    expect(shellSource).toContain('className="ebru-topbar"');
    expect(shellSource).toContain('className="ebru-footer"');
  });

  it("keeps customer and invoice pages in the approved Ebru list layout", () => {
    expect(resourceSource).toContain('className="income-page-head"');
    expect(resourceSource).toContain('className="ebru-card income-filters"');
    expect(resourceSource).toContain('className="ebru-card income-table-card"');
    expect(resourceSource).toContain('className="income-pagination"');
  });

  it("uses the design-system Button for manual synchronization", () => {
    expect(resourceSource).toContain('import { Button } from "@/components/ui/button"');
    expect(resourceSource).toContain('<Button className="income-sync-button"');
  });

  it("does not mount obsolete standalone or primitive resource shells", () => {
    expect(shellSource).not.toContain("DomainResourcePage");
    expect(appSource).not.toContain("<ParasutModuleRoutes");
    expect(appSource).toContain('path="/apps/ebru-preview/*"');
    expect(appSource).toContain('path="/apps/parasut/*"');
  });

  it("does not import historical demo datasets into production pages", () => {
    for (const forbidden of ["financeIncomeData", "financeExpenseData", "cashReportData", "demoFallback"]) {
      expect(shellSource).not.toContain(forbidden);
      expect(resourceSource).not.toContain(forbidden);
    }
  });
});
