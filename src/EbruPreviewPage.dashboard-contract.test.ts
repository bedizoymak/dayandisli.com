import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appsSource = readFileSync("src/features/ebru-preview/EbruPreviewPage.tsx", "utf8");

// Demo-only fixture values that must never leak into the real Apps
// dashboard — if any of these literals appear in the apps source, a demo
// number was hardcoded instead of computed from a real query.
const DEMO_ONLY_VALUES = ["₺8.425.000", "₺8,42M", "₺612.480", "Atlas Makine", "Marmara Metal"];

describe("Apps dashboard — real data sourcing (no demo fixtures, no invented values)", () => {
  it("uses the real authenticated ERP profile for the greeting/avatar identity, never a raw email split", () => {
    expect(appsSource).toContain('import { resolveDisplayName, getInitials } from "@/features/erp/shared/displayName"');
    expect(appsSource).toContain("resolveDisplayName(erpUser, isAuthLoading)");
    // The demo file derives its display name from erpUser.email directly —
    // the apps file must not regress to that pattern.
    expect(appsSource).not.toMatch(/erpUser\?\.email\?\.split\("@"\)/);
  });

  it("sources KPIs, weather and exchange-rate figures from real queries, not the demo's static previewMetrics fixture", () => {
    expect(appsSource).toContain("useParasutDashboard()");
    expect(appsSource).toContain("useMarketData()");
    expect(appsSource).not.toContain("previewMetrics");
  });

  it("formats currency in the presentation layer via formatTryAmount, keeping tr-TR grouping", () => {
    expect(appsSource).toContain("formatTryAmount(rawValue)");
    expect(appsSource).toContain("formatTryAmount(gold.gramTry)");
  });

  it("never hardcodes a demo fixture value as if it were real production data", () => {
    for (const value of DEMO_ONLY_VALUES) {
      expect(appsSource).not.toContain(value);
    }
  });

  it("renders a neutral, Demo-styled empty state for approvals/notifications/calendar instead of inventing data — the missing-data-contract documented for a later phase", () => {
    // These three arrays/records are intentionally empty: production has no
    // approvals-queue, system-notifications, or payment-calendar data
    // source wired up yet. Per the convergence rule ("do not invent a
    // number, do not add a destructive schema change"), the correct
    // behavior is the shared .ebru-empty-state treatment, not fabricated
    // rows — this test locks that contract in so a future edit can't
    // silently swap in hardcoded numbers to "match demo" instead.
    expect(appsSource).toMatch(/const visualApprovals: \{ label: string; count: number \}\[\] = \[\];/);
    expect(appsSource).toMatch(/const visualNotifications: \{ title: string; description: string; relativeTime: string \}\[\] = \[\];/);
    expect(appsSource).toMatch(/const visualCalendar: Record<number, string> = \{\};/);
    expect(appsSource).toContain('<div className="ebru-empty-state">Bekleyen onay bulunmuyor.</div>');
    expect(appsSource).toContain('<div className="ebru-empty-state">Yeni sistem bildirimi bulunmuyor.</div>');
    expect(appsSource).toContain('<div className="ebru-empty-state">Planlanmış ödeme veya tahsilat bulunamadı.</div>');
  });

  it("shows a loading state for the finance calendar/upcoming list instead of a flash of empty content", () => {
    expect(appsSource).toContain('dashboardQuery.isLoading ? <div className="ebru-empty-state">Finans takvimi yükleniyor…</div>');
  });
});
