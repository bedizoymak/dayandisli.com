// AnalyticsService — ERP business layer's dashboard composition layer.
// Deliberately does NOT re-derive raw mirror data itself; it composes the
// already-typed outputs of FinanceService (and, in a later phase, a
// company-wide product/customer aggregate) into dashboard-shaped results.
// See ERP_BUSINESS_ARCHITECTURE.md.
import { subtractDecimalStrings, sumDecimalStrings } from "../decimal.ts";
import { FinanceService, type FinanceRepository } from "./finance-service.ts";
import type { FinanceDashboardResult, FinanceSummary, GrowthMetric, KpiCard, TrendPoint } from "../types.ts";

export function buildKpiCards(finance: FinanceSummary): KpiCard[] {
  return [
    { key: "receivables", label: "Alacaklar", values: finance.totalReceivables },
    { key: "payables", label: "Borçlar", values: finance.totalPayables },
    { key: "overdue_receivables", label: "Vadesi Geçmiş Alacaklar", values: finance.overdueReceivables },
    { key: "overdue_payables", label: "Vadesi Geçmiş Borçlar", values: finance.overduePayables },
    { key: "cash_position", label: "Kasa/Banka Durumu", values: finance.cashPosition },
  ];
}

/**
 * Compares the most recent month's total against the prior month's, per
 * currency. Returns `growthPercent: null` (never 0% or Infinity) when the
 * prior period had no activity — percentage growth from zero is undefined.
 */
export function computeGrowth(trend: TrendPoint[]): GrowthMetric[] {
  const months = Array.from(new Set(trend.map((point) => point.month))).sort();
  if (months.length < 2) return [];
  const [previousMonth, currentMonth] = months.slice(-2);

  const currencies = Array.from(new Set(trend.map((point) => point.currency)));
  return currencies.map((currency) => {
    const currentTotal = trend.find((point) => point.month === currentMonth && point.currency === currency)?.total ?? "0.00";
    const previousTotal = trend.find((point) => point.month === previousMonth && point.currency === currency)?.total ?? "0.00";
    const previousValue = Number(previousTotal);
    const growthPercent = previousValue > 0 ? Math.round(((Number(currentTotal) - previousValue) / previousValue) * 1000) / 10 : null;
    return { currency, currentPeriodTotal: currentTotal, previousPeriodTotal: previousTotal, growthPercent };
  });
}

/**
 * Sales net minus purchase net per currency, present only for currencies
 * that had sales activity — labeled an ESTIMATE (see FinanceDashboardResult
 * doc comment): excludes overhead, COGS precision, and any cost not routed
 * through a purchase bill. Mirrors the same honesty convention as the
 * Paraşüt monthly VAT estimate elsewhere in this codebase.
 */
export function computeGrossProfitEstimate(revenueTrend: TrendPoint[], purchaseTrend: TrendPoint[]): FinanceDashboardResult["grossProfitEstimate"] {
  const currencies = Array.from(new Set(revenueTrend.map((point) => point.currency)));
  return currencies.map((currency) => ({
    currency,
    amount: subtractDecimalStrings(sumTrendTotals(revenueTrend, currency), sumTrendTotals(purchaseTrend, currency)),
  }));
}

function sumTrendTotals(trend: TrendPoint[], currency: string): string {
  return sumDecimalStrings(trend.filter((point) => point.currency === currency).map((point) => point.total));
}

/** Pure compositor — kept independently callable/testable with an already-computed FinanceSummary (e.g. from a cache, in a later phase). */
export function buildDashboard(finance: FinanceSummary, now: Date = new Date()): FinanceDashboardResult {
  return {
    kpis: buildKpiCards(finance),
    revenueTrend: finance.monthlyReceivablesSummary,
    purchaseTrend: finance.monthlyPayablesSummary,
    revenueGrowth: computeGrowth(finance.monthlyReceivablesSummary),
    grossProfitEstimate: computeGrossProfitEstimate(finance.monthlyReceivablesSummary, finance.monthlyPayablesSummary),
    finance,
    calculatedAt: now.toISOString(),
  };
}

export class AnalyticsService {
  private readonly financeService: FinanceService;

  constructor(provider: FinanceRepository) {
    this.financeService = new FinanceService(provider);
  }

  /** Fetches a fresh FinanceSummary from the provider and composes it into a dashboard result. */
  async getDashboard(now: Date = new Date()): Promise<FinanceDashboardResult> {
    const finance = await this.financeService.getSummary(now);
    return buildDashboard(finance, now);
  }
}
