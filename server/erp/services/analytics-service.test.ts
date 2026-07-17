import { describe, expect, it } from "vitest";
import { AnalyticsService, buildDashboard, buildKpiCards, computeGrossProfitEstimate, computeGrowth } from "./analytics-service.ts";
import type { FinanceRepository } from "./finance-service.ts";
import type { FinanceSummary, MirrorAccount, MirrorDocument, TrendPoint } from "../types.ts";

const NOW = new Date("2026-07-15T00:00:00.000Z");

const finance: FinanceSummary = {
  totalReceivables: [{ currency: "TRY", amount: "1000.00" }],
  totalPayables: [{ currency: "TRY", amount: "500.00" }],
  overdueReceivables: [{ currency: "TRY", amount: "200.00" }],
  overduePayables: [{ currency: "TRY", amount: "100.00" }],
  overdueReceivableCount: 3,
  overduePayableCount: 1,
  cashPosition: [{ currency: "TRY", amount: "5000.00" }],
  monthlyReceivablesSummary: [
    { month: "2026-05", currency: "TRY", total: "1000.00", documentCount: 5 },
    { month: "2026-06", currency: "TRY", total: "1500.00", documentCount: 6 },
  ],
  monthlyPayablesSummary: [{ month: "2026-06", currency: "TRY", total: "800.00", documentCount: 4 }],
  calculatedAt: NOW.toISOString(),
};

describe("buildKpiCards", () => {
  it("builds one card per finance metric, each grouped by currency", () => {
    const cards = buildKpiCards(finance);
    expect(cards.find((card) => card.key === "receivables")?.values).toEqual([{ currency: "TRY", amount: "1000.00" }]);
    expect(cards.find((card) => card.key === "cash_position")?.values).toEqual([{ currency: "TRY", amount: "5000.00" }]);
  });
});

describe("computeGrowth", () => {
  it("compares the last two months and computes a percentage", () => {
    const growth = computeGrowth(finance.monthlyReceivablesSummary);
    // (1500 - 1000) / 1000 * 100 = 50%
    expect(growth).toEqual([{ currency: "TRY", currentPeriodTotal: "1500.00", previousPeriodTotal: "1000.00", growthPercent: 50 }]);
  });

  it("returns null growthPercent rather than Infinity/0 when the prior period had no activity", () => {
    const trend: TrendPoint[] = [
      { month: "2026-05", currency: "TRY", total: "0.00", documentCount: 0 },
      { month: "2026-06", currency: "TRY", total: "300.00", documentCount: 2 },
    ];
    expect(computeGrowth(trend)).toEqual([{ currency: "TRY", currentPeriodTotal: "300.00", previousPeriodTotal: "0.00", growthPercent: null }]);
  });

  it("returns an empty array with fewer than two months of data", () => {
    expect(computeGrowth([{ month: "2026-06", currency: "TRY", total: "100.00", documentCount: 1 }])).toEqual([]);
  });
});

describe("computeGrossProfitEstimate", () => {
  it("subtracts total purchases from total sales per currency across the whole trend", () => {
    // sales: 1000 + 1500 = 2500; purchases: 800; estimate = 1700
    expect(computeGrossProfitEstimate(finance.monthlyReceivablesSummary, finance.monthlyPayablesSummary)).toEqual([{ currency: "TRY", amount: "1700.00" }]);
  });

  it("treats a currency with sales but no purchase activity as zero purchases, not an error", () => {
    const revenueTrend: TrendPoint[] = [{ month: "2026-06", currency: "USD", total: "100.00", documentCount: 1 }];
    expect(computeGrossProfitEstimate(revenueTrend, [])).toEqual([{ currency: "USD", amount: "100.00" }]);
  });
});

describe("buildDashboard (pure compositor)", () => {
  it("composes a full dashboard result from an already-computed FinanceSummary", () => {
    const dashboard = buildDashboard(finance, NOW);
    expect(dashboard.kpis.length).toBe(5);
    expect(dashboard.revenueTrend).toBe(finance.monthlyReceivablesSummary);
    expect(dashboard.grossProfitEstimate).toEqual([{ currency: "TRY", amount: "1700.00" }]);
    expect(dashboard.calculatedAt).toBe(NOW.toISOString());
  });
});

describe("AnalyticsService", () => {
  it("fetches from the injected AccountingProvider and composes the dashboard", async () => {
    const receivable: MirrorDocument = {
      id: "inv-1",
      partyId: "cust-1",
      currency: "TRY",
      netTotal: "800.00",
      grossTotal: "1000.00",
      remaining: "1000.00",
      totalPaid: "0.00",
      issueDate: "2026-06-10",
      dueDate: "2026-06-20",
      archived: false,
    };
    const account: MirrorAccount = { id: "a1", name: "Main", currency: "TRY", balance: "2000.00", archived: false };
    const provider: FinanceRepository = {
      getAllReceivableDocuments: async () => [receivable],
      getAllPayableDocuments: async () => [],
      getAccounts: async () => [account],
    };

    const dashboard = await new AnalyticsService(provider).getDashboard(NOW);
    expect(dashboard.finance.totalReceivables).toEqual([{ currency: "TRY", amount: "1000.00" }]);
    expect(dashboard.finance.cashPosition).toEqual([{ currency: "TRY", amount: "2000.00" }]);
    expect(dashboard.calculatedAt).toBe(NOW.toISOString());
  });
});
